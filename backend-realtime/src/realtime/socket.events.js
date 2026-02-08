const prisma = require('../utils/prisma');
const { setTypingStatus, removeTypingStatus } = require('../redis/typing');
const { checkRateLimit } = require('../redis/ratelimit');
const { refreshOnlineStatus } = require('../redis/presence');
const { getCachedChannelServerId, getCachedUserPermissions, getCachedDMChannelMembers } = require('../redis/cache');
const { userJoinedRoom, userLeftRoom } = require('../redis/roomRegistry');
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

            // Track this socket's rooms for disconnect cleanup
            if (!socket.joinedRooms) socket.joinedRooms = new Set();
            socket.joinedRooms.add(roomName);

            // Register gateway for this room (for targeted Redis publishing)
            await userJoinedRoom(roomName);

            console.log(`✅ [JOIN_CHANNEL] User ${socket.user.id} (${socket.user.username}) successfully joined ${roomName}`);

            // Optional: Ack back to client
            socket.emit('JOINED_CHANNEL', { channelId: channelIdInt });

        } catch (err) {
            console.error("[JOIN_CHANNEL] ERROR:", err);
            socket.emit('ERROR', { message: 'Internal server error' });
        }
    });

    // 2. LEAVE_CHANNEL
    socket.on('LEAVE_CHANNEL', async ({ channelId }) => {
        if (!channelId) return;
        const roomName = `channel:${parseInt(channelId)}`;
        socket.leave(roomName);

        // Remove from socket's tracked rooms
        if (socket.joinedRooms) socket.joinedRooms.delete(roomName);

        // Unregister gateway if last user leaves
        await userLeftRoom(roomName);

        console.log(`User ${socket.user.id} left ${roomName}`);
    });

    // Note: JOIN_DM handler is defined later in the DM EVENTS section (with database verification)

    // 2c. LEAVE_DM - Leave a DM room (early handler, main one is below)
    // Note: This is kept for backwards compatibility, main LEAVE_DM handler is in DM section

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
                    displayName: socket.user.displayName,
                    avatar: socket.user.avatar,
                    bannerColor: socket.user.bannerColor,
                    bannerImage: socket.user.bannerImage,
                    ringColor: socket.user.ringColor,
                    bio: socket.user.bio,
                    createdAt: socket.user.createdAt
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
        console.log('🔵 JOIN_DM event received!', { channelId, userId: socket.user?.id });
        try {
            console.log(`[JOIN_DM] Request from user ${socket.user.id} for channel ${channelId}`);

            if (!channelId) {
                console.log('[JOIN_DM] No channelId provided');
                return;
            }
            const channelIdInt = parseInt(channelId);

            // Verify user is part of this DM channel (Cached)
            const dmChannel = await getCachedDMChannelMembers(channelIdInt);

            if (!dmChannel) {
                console.log(`[JOIN_DM] DM channel ${channelIdInt} not found`);
                socket.emit('ERROR', { message: 'DM channel not found' });
                return;
            }

            if (dmChannel.user1Id !== socket.user.id && dmChannel.user2Id !== socket.user.id) {
                console.log(`[JOIN_DM] User ${socket.user.id} not authorized for channel ${channelIdInt}`);
                socket.emit('ERROR', { message: 'Access denied' });
                return;
            }

            const roomName = `dm:${channelIdInt}`;
            socket.join(roomName);

            // Track this socket's rooms for disconnect cleanup
            if (!socket.joinedRooms) socket.joinedRooms = new Set();
            socket.joinedRooms.add(roomName);

            // Register gateway for this room (for targeted Redis publishing)
            await userJoinedRoom(roomName);

            console.log(`✅ User ${socket.user.id} (${socket.user.username}) joined ${roomName}`);

            socket.emit('JOINED_DM', { channelId: channelIdInt });

        } catch (err) {
            console.error("Join DM error:", err);
            socket.emit('ERROR', { message: 'Internal server error' });
        }
    });

    // Leave DM room
    socket.on('LEAVE_DM', async ({ channelId }) => {
        if (!channelId) return;
        const roomName = `dm:${parseInt(channelId)}`;
        socket.leave(roomName);

        // Remove from socket's tracked rooms
        if (socket.joinedRooms) socket.joinedRooms.delete(roomName);

        // Unregister gateway if last user leaves
        await userLeftRoom(roomName);

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
                    avatar: socket.user.avatar,
                    bannerColor: socket.user.bannerColor,
                    bannerImage: socket.user.bannerImage,
                    ringColor: socket.user.ringColor,
                    bio: socket.user.bio,
                    createdAt: socket.user.createdAt
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

    // ============================================
    // DM CALL EVENTS
    // ============================================

    // INITIATE_CALL - User starts a call
    socket.on('INITIATE_CALL', async ({ channelId, callType }, callback) => {
        try {
            const channelIdInt = parseInt(channelId);
            const userId = socket.user.id;

            // Verify DM channel and get other participant
            const dmChannel = await prisma.directMessageChannel.findUnique({
                where: { id: channelIdInt },
                include: {
                    user1: { select: { id: true, username: true, avatar: true } },
                    user2: { select: { id: true, username: true, avatar: true } }
                }
            });

            if (!dmChannel) {
                if (typeof callback === 'function') callback({ error: 'DM channel not found' });
                return;
            }

            // Verify user is a participant
            if (dmChannel.user1Id !== userId && dmChannel.user2Id !== userId) {
                if (typeof callback === 'function') callback({ error: 'Access denied' });
                return;
            }

            // Get other user
            const otherUser = dmChannel.user1Id === userId ? dmChannel.user2 : dmChannel.user1;

            // Send INCOMING_CALL to other user
            io.to(`dm:${channelIdInt}`).emit('INCOMING_CALL', {
                channelId: channelIdInt,
                callType,
                from: {
                    id: socket.user.id,
                    username: socket.user.username,
                    avatar: socket.user.avatar
                }
            });

            console.log(`📞 Call initiated: ${socket.user.username} → ${otherUser.username} (${callType})`);

            if (typeof callback === 'function') callback({ success: true });

        } catch (err) {
            console.error('[INITIATE_CALL] Error:', err);
            if (typeof callback === 'function') callback({ error: 'Internal server error' });
        }
    });

    // ANSWER_CALL - User answers an incoming call
    socket.on('ANSWER_CALL', async ({ channelId }, callback) => {
        try {
            const channelIdInt = parseInt(channelId);

            // Broadcast to both users in the DM
            io.to(`dm:${channelIdInt}`).emit('CALL_ANSWERED', {
                channelId: channelIdInt
            });

            console.log(`✅ Call answered on channel ${channelIdInt}`);

            if (typeof callback === 'function') callback({ success: true });

        } catch (err) {
            console.error('[ANSWER_CALL] Error:', err);
            if (typeof callback === 'function') callback({ error: 'Internal server error' });
        }
    });

    // DECLINE_CALL - User declines an incoming call
    socket.on('DECLINE_CALL', async ({ channelId }, callback) => {
        try {
            const channelIdInt = parseInt(channelId);

            // Notify the caller
            io.to(`dm:${channelIdInt}`).emit('CALL_DECLINED', {
                channelId: channelIdInt
            });

            console.log(`❌ Call declined on channel ${channelIdInt}`);

            if (typeof callback === 'function') callback({ success: true });

        } catch (err) {
            console.error('[DECLINE_CALL] Error:', err);
            if (typeof callback === 'function') callback({ error: 'Internal server error' });
        }
    });

    // END_CALL - Either user ends the call
    socket.on('END_CALL', async ({ channelId }, callback) => {
        try {
            const channelIdInt = parseInt(channelId);

            // Notify both users
            io.to(`dm:${channelIdInt}`).emit('CALL_ENDED', {
                channelId: channelIdInt
            });

            console.log(`🔚 Call ended on channel ${channelIdInt}`);

            if (typeof callback === 'function') callback({ success: true });

        } catch (err) {
            console.error('[END_CALL] Error:', err);
            if (typeof callback === 'function') callback({ error: 'Internal server error' });
        }
    });

    // CANCEL_CALL - Caller cancels before answer
    socket.on('CANCEL_CALL', async ({ channelId }, callback) => {
        try {
            const channelIdInt = parseInt(channelId);

            // Notify the other user
            io.to(`dm:${channelIdInt}`).emit('CALL_CANCELLED', {
                channelId: channelIdInt
            });

            console.log(`🚫 Call cancelled on channel ${channelIdInt}`);

            if (typeof callback === 'function') callback({ success: true });

        } catch (err) {
            console.error('[CANCEL_CALL] Error:', err);
            if (typeof callback === 'function') callback({ error: 'Internal server error' });
        }
    });

    // 10. CALL SIGNALING (WebRTC / LiveKit Notification)
    socket.on('INITIATE_CALL', async (payload, callback) => {
        try {
            const { channelId, callType } = payload;
            if (!channelId) return;
            const channelIdInt = parseInt(channelId);

            // Verify DM channel access
            const dmChannel = await prisma.directMessageChannel.findUnique({
                where: { id: channelIdInt }
            });

            if (!dmChannel || (dmChannel.user1Id !== socket.user.id && dmChannel.user2Id !== socket.user.id)) {
                if (typeof callback === 'function') callback({ error: 'Access denied' });
                return;
            }

            // Identify the recipient
            const recipientId = (dmChannel.user1Id === socket.user.id) ? dmChannel.user2Id : dmChannel.user1Id;

            // Broadcast to the RECIPIENT'S personal room `user:{recipientId}`
            console.log(`[CALL] User ${socket.user.username} initiating ${callType} call to user ${recipientId} in DM ${channelIdInt}`);
            
            socket.to(`user:${recipientId}`).emit('INCOMING_CALL', {
                channelId: channelIdInt,
                from: {
                    id: socket.user.id,
                    username: socket.user.username,
                    displayName: socket.user.displayName,
                    avatar: socket.user.avatar
                },
                callType
            });
            
            if (typeof callback === 'function') callback({ success: true });

        } catch (err) {
            console.error("Initiate call error:", err);
            if (typeof callback === 'function') callback({ error: 'Internal server error' });
        }
    });

    socket.on('ANSWER_CALL', async (payload, callback) => {
        const { channelId } = payload;
        if (!channelId) return;
        const channelIdInt = parseInt(channelId);
        
        console.log(`[CALL] User ${socket.user.username} answered call in DM ${channelIdInt}`);
        
        // Notify DM room (legacy/backup)
        socket.to(`dm:${channelIdInt}`).emit('CALL_ANSWERED', { 
            channelId: channelIdInt,
            by: socket.user.id 
        });

        // Also notify via Personal Rooms (robustness)
        try {
            const dmChannel = await prisma.directMessageChannel.findUnique({
                where: { id: channelIdInt }
            });
            if (dmChannel) {
                const otherUserId = (dmChannel.user1Id === socket.user.id) ? dmChannel.user2Id : dmChannel.user1Id;
                socket.to(`user:${otherUserId}`).emit('CALL_ANSWERED', { 
                    channelId: channelIdInt,
                    by: socket.user.id 
                });
            }
        } catch (e) { console.error("Error notifying personal room for ANSWER:", e); }

        if (typeof callback === 'function') callback({ success: true });
    });

    socket.on('DECLINE_CALL', async (payload) => {
        const { channelId } = payload;
        if (!channelId) return;
        const channelIdInt = parseInt(channelId);

        console.log(`[CALL] User ${socket.user.username} declined call in DM ${channelIdInt}`);
        
        socket.to(`dm:${channelIdInt}`).emit('CALL_DECLINED', { 
            channelId: channelIdInt,
            by: socket.user.id 
        });

        // Notify Personal Room
        try {
            const dmChannel = await prisma.directMessageChannel.findUnique({
                where: { id: channelIdInt }
            });
            if (dmChannel) {
                const otherUserId = (dmChannel.user1Id === socket.user.id) ? dmChannel.user2Id : dmChannel.user1Id;
                socket.to(`user:${otherUserId}`).emit('CALL_DECLINED', { 
                    channelId: channelIdInt,
                    by: socket.user.id 
                });
            }
        } catch (e) { console.error("Error notifying personal room for DECLINE:", e); }
    });

    socket.on('END_CALL', async (payload) => {
        const { channelId } = payload;
        if (!channelId) return;
        const channelIdInt = parseInt(channelId);

        console.log(`[CALL] User ${socket.user.username} ended call in DM ${channelIdInt}`);
        
        socket.to(`dm:${channelIdInt}`).emit('CALL_ENDED', { 
            channelId: channelIdInt,
            by: socket.user.id 
        });

        // Notify Personal Rooms (Both participants ideally, to be safe)
        try {
            const dmChannel = await prisma.directMessageChannel.findUnique({
                where: { id: channelIdInt }
            });
            if (dmChannel) {
                const otherUserId = (dmChannel.user1Id === socket.user.id) ? dmChannel.user2Id : dmChannel.user1Id;
                socket.to(`user:${otherUserId}`).emit('CALL_ENDED', { 
                    channelId: channelIdInt,
                    by: socket.user.id 
                });
            }
        } catch (e) { console.error("Error notifying personal room for END:", e); }
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

            // Clean up room registry for all rooms this socket was in
            if (socket.joinedRooms && socket.joinedRooms.size > 0) {
                console.log(`[DISCONNECT] Cleaning up ${socket.joinedRooms.size} rooms for socket ${socket.id}`);
                for (const roomName of socket.joinedRooms) {
                    await userLeftRoom(roomName);
                }
                socket.joinedRooms.clear();
            }

            // Remove user session and clean up presence data
            const { removeUserSession } = require('../redis/presence');
            await removeUserSession(socket.id);

            console.log(`✅ User ${socket.user?.id} presence cleaned up from ${instanceId}`);

            // 3. Broadcast OFFLINE status to friends
            if (socket.user?.id) {
                const friendships = await prisma.friendship.findMany({
                    where: {
                        OR: [
                            { requesterId: socket.user.id },
                            { addresseeId: socket.user.id }
                        ],
                        status: 'ACCEPTED'
                    }
                });

                const friendIds = friendships.map(f =>
                    f.requesterId === socket.user.id ? f.addresseeId : f.requesterId
                );

                if (friendIds.length > 0) {
                    const io = socket.server; // Get IO instance
                    friendIds.forEach(friendId => {
                        io.to(`user:${friendId}`).emit('PRESENCE_UPDATE', {
                            userId: socket.user.id,
                            status: 'offline',
                            lastSeen: Date.now()
                        });
                    });
                    console.log(`📢 Broadcasted OFFLINE status to ${friendIds.length} friends`);
                }
            }

        } catch (err) {
            console.error('Disconnect cleanup error:', err);
        }
    });
};

module.exports = registerSocketEvents;
