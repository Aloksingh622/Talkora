const prisma = require('../utils/prisma');
const { setTypingStatus, removeTypingStatus } = require('../redis/typing');
const { checkRateLimit } = require('../redis/ratelimit');
const { refreshOnlineStatus } = require('../redis/presence');

const registerSocketEvents = (io, socket) => {

    // 1. JOIN_CHANNEL
    socket.on('JOIN_CHANNEL', async ({ channelId }) => {
        try {
            if (!channelId) return;
            const channelIdInt = parseInt(channelId);

            // Validate channel existence and membership
            // Optimization: We could cache members in Redis later. For now, DB query.
            const channel = await prisma.channel.findUnique({
                where: { id: channelIdInt },
                select: { serverId: true }
            });

            if (!channel) {
                socket.emit('ERROR', { message: 'Channel not found' });
                return;
            }

            const member = await prisma.serverMember.findUnique({
                where: {
                    userId_serverId: {
                        userId: socket.user.id,
                        serverId: channel.serverId
                    }
                }
            });

            if (!member) {
                socket.emit('ERROR', { message: 'Access denied' });
                return;
            }

            const roomName = `channel:${channelIdInt}`;
            socket.join(roomName);
            console.log(`User ${socket.user.id} (${socket.user.username}) joined ${roomName}`);

            // Optional: Ack back to client
            socket.emit('JOINED_CHANNEL', { channelId: channelIdInt });

        } catch (err) {
            console.error("Join channel error:", err);
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

            const { channelId, content } = payload;

            // Validation
            if (!content || !content.trim()) {
                if (typeof callback === 'function') callback({ error: 'Message cannot be empty' });
                return;
            }
            if (content.length > 2000) {
                if (typeof callback === 'function') callback({ error: 'Message too long' });
                return;
            }

            const channelIdInt = parseInt(channelId);

            // DB Validation (Re-verify membership to be strict)
            const channel = await prisma.channel.findUnique({
                where: { id: channelIdInt },
                select: { serverId: true }
            });

            if (!channel) {
                if (typeof callback === 'function') callback({ error: 'Channel not found' });
                return;
            }

            const member = await prisma.serverMember.findUnique({
                where: {
                    userId_serverId: {
                        userId: socket.user.id,
                        serverId: channel.serverId
                    }
                }
            });

            if (!member) {
                if (typeof callback === 'function') callback({ error: 'Access denied' });
                return;
            }

            // Check if user is banned or timed out (import authUtils)
            const { isUserBanned, isUserTimedOut, isServerOwner } = require('../utils/authUtils');

            // Owner can always send messages
            const isOwner = await isServerOwner(socket.user.id, channel.serverId);

            if (!isOwner) {
                // Check if user is banned
                const banned = await isUserBanned(socket.user.id, channel.serverId);
                if (banned) {
                    if (typeof callback === 'function') callback({ error: 'You are banned from this server' });
                    return;
                }

                // Check if user is timed out
                const { isTimedOut, timeout } = await isUserTimedOut(socket.user.id, channel.serverId);
                if (isTimedOut) {
                    const expiresIn = Math.ceil((timeout.expiresAt - new Date()) / 1000);
                    if (typeof callback === 'function') callback({
                        error: 'You are timed out from this server',
                        expiresAt: timeout.expiresAt,
                        expiresIn,
                        reason: timeout.reason
                    });
                    return;
                }
            }

            // DB Write
            const message = await prisma.message.create({
                data: {
                    content: content.trim(),
                    userId: socket.user.id,
                    channelId: channelIdInt,
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

            // Broadcast to room (excluding sender - they get it via ACK)
            const roomName = `channel:${channelIdInt}`;
            const roomClients = io.sockets.adapter.rooms.get(roomName);
            const clientCount = roomClients ? roomClients.size : 0;
            console.log(`Broadcasting NEW_MESSAGE to ${roomName} (${clientCount} clients in room, excluding sender = ${clientCount - 1} recipients)`);
            io.to(roomName).emit('NEW_MESSAGE', message);

            // ACK to sender with the full message
            if (typeof callback === 'function') callback({ status: 'OK', message });

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

            const messageIdInt = parseInt(messageId);
            const channelIdInt = parseInt(channelId);

            const message = await prisma.message.findUnique({
                where: { id: messageIdInt },
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
                where: { id: messageIdInt },
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

            // Broadcast to room
            socket.to(`channel:${channelIdInt}`).emit('MESSAGE_EDITED', updatedMessage);

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

            const messageIdInt = parseInt(messageId);
            const channelIdInt = parseInt(channelId);

            const message = await prisma.message.findUnique({
                where: { id: messageIdInt },
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
                where: { id: messageIdInt },
            });

            // Broadcast to room
            socket.to(`channel:${channelIdInt}`).emit('MESSAGE_DELETED', { id: messageIdInt, channelId: channelIdInt });

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

            // Verify user is part of this DM channel
            const dmChannel = await prisma.directMessageChannel.findUnique({
                where: { id: channelIdInt }
            });

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

            // Verify DM channel and access
            const dmChannel = await prisma.directMessageChannel.findUnique({
                where: { id: channelIdInt }
            });

            if (!dmChannel) {
                if (typeof callback === 'function') callback({ error: 'DM channel not found' });
                return;
            }

            if (dmChannel.user1Id !== socket.user.id && dmChannel.user2Id !== socket.user.id) {
                if (typeof callback === 'function') callback({ error: 'Access denied' });
                return;
            }

            // Create DM message
            const message = await prisma.directMessage.create({
                data: {
                    content: content?.trim(),
                    fileUrl,
                    fileType,
                    fileName,
                    senderId: socket.user.id,
                    channelId: channelIdInt
                },
                include: {
                    sender: {
                        select: {
                            id: true,
                            username: true,
                            displayName: true,
                            avatar: true
                        }
                    }
                }
            });

            // Update channel's updatedAt
            await prisma.directMessageChannel.update({
                where: { id: channelIdInt },
                data: { updatedAt: new Date() }
            });

            // Broadcast to DM room
            const roomName = `dm:${channelIdInt}`;
            io.to(roomName).emit('NEW_DM', message);

            // Also emit to recipient's user room for notification
            const recipientId = dmChannel.user1Id === socket.user.id ? dmChannel.user2Id : dmChannel.user1Id;
            io.to(`user:${recipientId}`).emit('DM_NOTIFICATION', {
                channelId: channelIdInt,
                message,
                sender: message.sender
            });

            // ACK to sender
            if (typeof callback === 'function') callback({ status: 'OK', message });

        } catch (err) {
            console.error("Send DM error:", err);
            if (typeof callback === 'function') callback({ error: 'Internal server error' });
        }
    });

    // DM Typing indicators
    socket.on('TYPING_DM', async ({ channelId }) => {
        if (!channelId) return;
        const channelIdInt = parseInt(channelId);

        // Verify access
        const dmChannel = await prisma.directMessageChannel.findUnique({
            where: { id: channelIdInt }
        });

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
    socket.on('disconnect', async () => {
        try {
            console.log(`Socket disconnected: ${socket.id} (User: ${socket.user?.username})`);

            // Remove user session and clean up presence data
            const { removeUserSession } = require('../redis/presence');
            await removeUserSession(socket.id);

            console.log(`User ${socket.user?.id} presence cleaned up`);
        } catch (err) {
            console.error('Disconnect cleanup error:', err);
        }
    });
};

module.exports = registerSocketEvents;
