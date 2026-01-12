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
            console.log(`User ${socket.user.id} joined ${roomName}`);

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
            socket.to(`channel:${channelIdInt}`).emit('NEW_MESSAGE', message);

            // ACK to sender with the full message
            if (typeof callback === 'function') callback({ status: 'OK', message });

        } catch (err) {
            console.error("Send message error:", err);
            if (typeof callback === 'function') callback({ error: 'Internal server error' });
        }
    });

    // 5. DISCONNECT - Clean up user presence
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
