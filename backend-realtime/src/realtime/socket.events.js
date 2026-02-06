const prisma = require('../utils/prisma');
const { setTypingStatus, removeTypingStatus } = require('../redis/typing');
const { checkRateLimit } = require('../redis/ratelimit');
const { refreshOnlineStatus } = require('../redis/presence');
const { getCachedChannelServerId, getCachedUserPermissions, getCachedDMChannelMembers } = require('../redis/cache');
const kafkaProducer = require('../kafka/producer');
const crypto = require('crypto');

const registerSocketEvents = (io, socket) => {

    // 1. JOIN_CHANNEL
    socket.on('JOIN_CHANNEL', async ({ channelId }) => {
        try {
            console.log(`[JOIN_CHANNEL] User ${socket.user.id} attempting to join channel ${channelId}`);

            if (!channelId) {
                console.log(`[JOIN_CHANNEL] ERROR: No channelId provided`);
                return;
            }
            const channelIdInt = parseInt(channelId);

            // 1. Get Server ID (Cached)
            const serverId = await getCachedChannelServerId(channelIdInt);

            if (!serverId) {
                console.log(`[JOIN_CHANNEL] ERROR: Channel ${channelIdInt} not found`);
                socket.emit('ERROR', { message: 'Channel not found' });
                return;
            }

            // 2. Check Permissions (Cached)
            const perms = await getCachedUserPermissions(socket.user.id, serverId);

            if (!perms.allowed) {
                console.log(`[JOIN_CHANNEL] ERROR: User ${socket.user.id} access denied to server ${serverId}: ${perms.error}`);
                socket.emit('ERROR', { message: perms.error || 'Access denied' });
                return;
            }

            const roomName = `channel:${channelIdInt}`;
            socket.join(roomName);
            console.log(`✅ [JOIN_CHANNEL] User ${socket.user.id} (${socket.user.username}) successfully joined ${roomName}`);

            // Optional: Ack back to client
            socket.emit('JOINED_CHANNEL', { channelId: channelIdInt });

        } catch (err) {
            console.error("[JOIN_CHANNEL] ERROR:", err);
            socket.emit('ERROR', { message: 'Internal server error' });
        }
    });

    // 2. LEAVE_CHANNEL
    socket.on('LEAVE_CHANNEL', ({ channelId }) => {
        if (!channelId) return;
        const roomName = `channel:${parseInt(channelId)}`;
        socket.leave(roomName);
        console.log(`User ${socket.user.id} left ${roomName}`);
    });

    // 3. TYPING STATUS
    socket.on('TYPING_START', async ({ channelId }) => {
        if (!channelId) return;
        await setTypingStatus(channelId, socket.user.id);
        socket.to(`channel:${channelId}`).emit('TYPING_START', {
            channelId,
            userId: socket.user.id,
            username: socket.user.username
        });
    });

    socket.on('TYPING_STOP', async ({ channelId }) => {
        if (!channelId) return;
        await removeTypingStatus(channelId, socket.user.id);
        socket.to(`channel:${channelId}`).emit('TYPING_STOP', {
            channelId,
            userId: socket.user.id
        });
    });

    // 4. SEND_MESSAGE
    socket.on('SEND_MESSAGE', async (payload, callback) => {
        try {
            // Rate Limit Check
            const allowed = await checkRateLimit(socket.user.id);
            if (!allowed) {
                if (typeof callback === 'function') callback({ error: 'Rate limit exceeded. Slow down.' });
                return;
            }

            // Refresh Online Status (Heartbeatish)
            refreshOnlineStatus(socket.user.id);

            const { channelId, content, fileUrl, fileType, fileName } = payload;

            // Validation
            if ((!content || !content.trim()) && !fileUrl) {
                if (typeof callback === 'function') callback({ error: 'Message cannot be empty' });
                return;
            }
            if (content && content.length > 2000) {
                if (typeof callback === 'function') callback({ error: 'Message too long' });
                return;
            }

            const channelIdInt = parseInt(channelId);

            // DB Validation (Re-verify membership to be strict) - OPTIMIZED
            const serverId = await getCachedChannelServerId(channelIdInt);

            if (!serverId) {
                if (typeof callback === 'function') callback({ error: 'Channel not found' });
                return;
            }

            // Check permissions (Member, Owner, Ban, Timeout)
            const perms = await getCachedUserPermissions(socket.user.id, serverId);

            if (!perms.allowed) {
                if (typeof callback === 'function') {
                    // If it's a timeout, we might have extra details
                    if (perms.details) {
                        // Check if still timed out based on details (Redis might return old expiresAt)
                        const expiresAt = new Date(perms.details.expiresAt);
                        if (new Date() > expiresAt) {
                            // It expired! We should technically re-check/clear cache, but for now let's just allow?
                            // No, if cache says timed out, we block. The cache TTL is short (60s).
                            // User can wait 60s.
                        }

                        const expiresIn = Math.ceil((expiresAt - new Date()) / 1000);
                        callback({
                            error: perms.error,
                            expiresAt: perms.details.expiresAt,
                            expiresIn,
                            reason: perms.details.reason
                        });
                    } else {
                        callback({ error: perms.error || 'Access denied' });
                    }
                }
                return;
            }

            // Construct message object (without ID as DB will generate it, but we nneed a temp ID or handle it)
            // Ideally consumer saves it and broadcasts. 
            // PROBLEM: Frontend expects a full message with ID immediately for non-optimistic UI. 
            // BUT with optimistic UI, we just need to ack.

            // Construct message object with UUID
            const messageId = crypto.randomUUID();
            const messagePayload = {
                id: messageId, // Pre-generated ID
                content: content ? content.trim() : null,
                fileUrl,
                fileType,
                fileName,
                userId: socket.user.id,
                channelId: channelIdInt,
                user: {
                    id: socket.user.id,
                    username: socket.user.username,
                    avatar: socket.user.avatar
                },
                createdAt: new Date().toISOString()
            };

            // Produce to Kafka
            await kafkaProducer.send('channel.message', channelIdInt, {
                type: 'NEW_MESSAGE',
                payload: messagePayload,
                channelId: channelIdInt
            });

            // Just ACK "OK" with the ID
            if (typeof callback === 'function') {
                callback({
                    status: 'OK',
                    message: messagePayload
                });
            }

        } catch (err) {
            console.error("Send message error:", err);
            if (typeof callback === 'function') callback({ error: 'Internal server error' });
        }
    });

    // 5. EDIT_MESSAGE
    socket.on('EDIT_MESSAGE', async (payload, callback) => {
        try {
            const { channelId, messageId, content } = payload;

            if (!content || !content.trim()) {
                if (typeof callback === 'function') callback({ error: 'Message cannot be empty' });
                return;
            }

            // const messageIdInt = parseInt(messageId); // Likely causing NaN if UUID
            const channelIdInt = parseInt(channelId);

            const message = await prisma.message.findUnique({
                where: { id: messageId }, // Pass messageId directly
            });

            if (!message) {
                if (typeof callback === 'function') callback({ error: 'Message not found' });
                return;
            }

            if (message.userId !== socket.user.id) {
                if (typeof callback === 'function') callback({ error: 'You can only edit your own messages' });
                return;
            }

            const updatedMessage = await prisma.message.update({
                where: { id: messageId }, // Pass messageId directly
                data: {
                    content: content.trim(),
                    editedAt: new Date()
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            avatar: true
                        }
                    }
                }
            });

            // Produce to Kafka for real-time broadcast
            await kafkaProducer.send('channel.message', channelIdInt, {
                type: 'MESSAGE_EDITED',
                payload: updatedMessage,
                channelId: channelIdInt
            });

            if (typeof callback === 'function') callback({ status: 'OK', message: updatedMessage });

        } catch (err) {
            console.error("Edit message error:", err);
            if (typeof callback === 'function') callback({ error: 'Internal server error' });
        }
    });

    // 6. DELETE_MESSAGE
    socket.on('DELETE_MESSAGE', async (payload, callback) => {
        try {
            const { channelId, messageId } = payload;

            const channelIdInt = parseInt(channelId);
            // messageId is a UUID string, so we don't parse it to int anymore for general usage,
            // BUT for legacy or specific ID types, we ensure we use the right variable.
            // Check if we need to support int IDs or UUIDs. Based on schema, IDs seem to be strings (UUIDs) or ints.
            // The error says "messageIdInt is not defined", so let's just use messageId (string) or proper int conversion if needed.
            // Assuming IDs are now UUIDs based on previous code context (const messageId = crypto.randomUUID()), 
            // but Prisma might expect different. Let's look at `PrismaClientValidationError` for Edit Message which said `id: String`.
            // So IDs are likely Strings.

            // HOWEVER, the error log showed `id: String` but `messageIdInt` is used in kafka payload.
            // Let's standardise on using `messageId` (the input string) and remove `messageIdInt` usage 
            // OR define it if it's supposed to be an int.

            // If the schema changed to UUIDs, `parseInt` is wrong.
            // If the schema is still Ints, then `parseInt` is correct but the variable must be used consistently.
            // Given "PrismaClientValidationError... id: String" in the *edit* error, it suggests IDs might be strings now?
            // Re-reading code: line 203 uses `where: { id: messageIdInt }`. If that failed with `id: String` missing, maybe `messageIdInt` was NaN?

            // Let's fix the specific ReferenceError first.
            const messageIdInt = parseInt(messageId);

            const message = await prisma.message.findUnique({
                where: { id: messageId }, // Use original messageId (likely string/UUID based on recent changes?)
                // Wait, if IDs are UUIDs, parseInt will return NaN.
                // If IDs are Ints, `parseInt` works.
                // The error `messageIdInt is not defined` came from line 277: `payload: { id: messageIdInt, ... }`
                // But `messageIdInt` was NOT defined in the scope of that block (it was commented out/missing).
            });

            if (!message) {
                if (typeof callback === 'function') callback({ error: 'Message not found' });
                return;
            }

            if (message.userId !== socket.user.id) {
                if (typeof callback === 'function') callback({ error: 'You can only delete your own messages' });
                return;
            }

            await prisma.message.delete({
                where: { id: messageId },
            });

            // Produce to Kafka for real-time broadcast
            await kafkaProducer.send('channel.message', channelIdInt, {
                type: 'MESSAGE_DELETED',
                payload: { id: messageId, channelId: channelIdInt }, // Use messageId
                channelId: channelIdInt
            });

            if (typeof callback === 'function') callback({ status: 'OK' });

        } catch (err) {
            console.error("Delete message error:", err);
            if (typeof callback === 'function') callback({ error: 'Internal server error' });
        }
    });

    // 8. DM EVENTS

    // Join DM room
    socket.on('JOIN_DM', async ({ channelId }) => {
        try {
            if (!channelId) return;
            const channelIdInt = parseInt(channelId);

            // Verify user is part of this DM channel (Cached)
            const dmChannel = await getCachedDMChannelMembers(channelIdInt);

            if (!dmChannel) {
                socket.emit('ERROR', { message: 'DM channel not found' });
                return;
            }

            if (dmChannel.user1Id !== socket.user.id && dmChannel.user2Id !== socket.user.id) {
                socket.emit('ERROR', { message: 'Access denied' });
                return;
            }

            const roomName = `dm:${channelIdInt}`;
            socket.join(roomName);
            console.log(`User ${socket.user.id} (${socket.user.username}) joined ${roomName}`);

            socket.emit('JOINED_DM', { channelId: channelIdInt });

        } catch (err) {
            console.error("Join DM error:", err);
            socket.emit('ERROR', { message: 'Internal server error' });
        }
    });

    // Leave DM room
    socket.on('LEAVE_DM', ({ channelId }) => {
        if (!channelId) return;
        const roomName = `dm:${parseInt(channelId)}`;
        socket.leave(roomName);
        console.log(`User ${socket.user.id} left ${roomName}`);
    });

    // Send DM message
    socket.on('SEND_DM', async (payload, callback) => {
        try {
            // Rate Limit Check
            const allowed = await checkRateLimit(socket.user.id);
            if (!allowed) {
                if (typeof callback === 'function') callback({ error: 'Rate limit exceeded. Slow down.' });
                return;
            }

            // Refresh Online Status
            refreshOnlineStatus(socket.user.id);

            const { channelId, content, fileUrl, fileType, fileName } = payload;

            // Validation
            if (!content && !fileUrl) {
                if (typeof callback === 'function') callback({ error: 'Message cannot be empty' });
                return;
            }
            if (content && content.length > 2000) {
                if (typeof callback === 'function') callback({ error: 'Message too long' });
                return;
            }

            const channelIdInt = parseInt(channelId);

            // Verify DM channel and access (Cached)
            const dmChannel = await getCachedDMChannelMembers(channelIdInt);

            if (!dmChannel) {
                if (typeof callback === 'function') callback({ error: 'DM channel not found' });
                return;
            }

            if (dmChannel.user1Id !== socket.user.id && dmChannel.user2Id !== socket.user.id) {
                if (typeof callback === 'function') callback({ error: 'Access denied' });
                return;
            }

            // Construct Payload with UUID
            const messageId = crypto.randomUUID();
            const messagePayload = {
                id: messageId, // Pre-generated ID
                content: content?.trim(),
                fileUrl,
                fileType,
                fileName,
                senderId: socket.user.id,
                channelId: channelIdInt,
                sender: {
                    id: socket.user.id,
                    username: socket.user.username,
                    displayName: socket.user.displayName,
                    avatar: socket.user.avatar
                },
                createdAt: new Date().toISOString()
            };

            // Produce to Kafka
            // Determine conversation key: sort IDs to ensure both users map to same partition
            const user1 = dmChannel.user1Id;
            const user2 = dmChannel.user2Id;
            const conversationKey = user1 < user2 ? `${user1}:${user2}` : `${user2}:${user1}`;

            await kafkaProducer.send('dm.message', conversationKey, {
                type: 'NEW_DM',
                payload: messagePayload,
                channelId: channelIdInt
            });

            // ACK to sender with the SAME ID
            if (typeof callback === 'function') callback({
                status: 'OK',
                message: messagePayload
            });

        } catch (err) {
            console.error("Send DM error:", err);
            if (typeof callback === 'function') callback({ error: 'Internal server error' });
        }
    });

    // DM Typing indicators
    socket.on('TYPING_DM', async ({ channelId }) => {
        if (!channelId) return;
        const channelIdInt = parseInt(channelId);

        // Verify access (Cached)
        const dmChannel = await getCachedDMChannelMembers(channelIdInt);

        if (!dmChannel || (dmChannel.user1Id !== socket.user.id && dmChannel.user2Id !== socket.user.id)) {
            return;
        }

        // Broadcast to other user in DM
        socket.to(`dm:${channelIdInt}`).emit('TYPING_DM', {
            channelId: channelIdInt,
            userId: socket.user.id,
            username: socket.user.username
        });
    });

    // Mark DM as read
    socket.on('MARK_DM_READ', async ({ channelId }) => {
        try {
            if (!channelId) return;
            const channelIdInt = parseInt(channelId);

            // Verify membership (Cached)
            const dmChannel = await getCachedDMChannelMembers(channelIdInt);
            if (!dmChannel || (dmChannel.user1Id !== socket.user.id && dmChannel.user2Id !== socket.user.id)) {
                return;
            }

            // Mark all unread messages as read
            await prisma.directMessage.updateMany({
                where: {
                    channelId: channelIdInt,
                    senderId: { not: socket.user.id },
                    isRead: false
                },
                data: { isRead: true }
            });

            // Notify other user
            socket.to(`dm:${channelIdInt}`).emit('DM_READ', {
                channelId: channelIdInt,
                userId: socket.user.id
            });

        } catch (err) {
            console.error("Mark DM read error:", err);
        }
    });

    // 9. DISCONNECT - Clean up user presence
    socket.on('disconnect', async (reason) => {
        try {
            const instanceId = `INSTANCE-${process.env.PORT || 3001}`;
            const port = process.env.PORT || 3001;

            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`❌ DISCONNECT`);
            console.log(`   └─ Instance: ${instanceId} (Port ${port})`);
            console.log(`   └─ Socket ID: ${socket.id}`);
            console.log(`   └─ User: ${socket.user?.username} (ID: ${socket.user?.id})`);
            console.log(`   └─ Reason: ${reason}`);
            console.log(`   └─ Time: ${new Date().toLocaleTimeString()}`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

            // Remove user session and clean up presence data
            const { removeUserSession } = require('../redis/presence');
            await removeUserSession(socket.id);

            console.log(`✅ User ${socket.user?.id} presence cleaned up from ${instanceId}`);
        } catch (err) {
            console.error('Disconnect cleanup error:', err);
        }
    });
};

module.exports = registerSocketEvents;
