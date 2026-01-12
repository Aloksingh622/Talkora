const prisma = require('../utils/prisma');

const sendMessage = async (req, res) => {
    try {
        const { content } = req.body;
        const { channelId } = req.params;
        const userId = req.user.id; // From auth middleware

        if (!content || content.trim() === '') {
            return res.status(400).json({ message: "Message content is required" });
        }

        if (content.length > 2000) {
            return res.status(400).json({ message: "Message content exceeds 2000 characters" });
        }

        const channelIdInt = parseInt(channelId);
        if (isNaN(channelIdInt)) {
            return res.status(400).json({ message: "Invalid channel ID" });
        }

        // Verify channel exists
        const channel = await prisma.channel.findUnique({
            where: { id: channelIdInt },
        });

        if (!channel) {
            return res.status(404).json({ message: "Channel not found" });
        }

        // Verify user is a member of the server
        const member = await prisma.serverMember.findUnique({
            where: {
                userId_serverId: {
                    userId,
                    serverId: channel.serverId,
                },
            },
        });

        if (!member) {
            return res.status(403).json({ message: "You must be a member of the server to send messages" });
        }

        // Create message
        const message = await prisma.message.create({
            data: {
                content: content.trim(),
                userId,
                channelId: channelIdInt,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        avatar: true,
                    }
                }
            }
        });

        // Broadcast to WebSocket room for real-time updates
        const io = req.app.get('io');
        if (io) {
            io.to(`channel:${channelIdInt}`).emit('NEW_MESSAGE', message);
        }

        res.status(201).json({
            message: "Message sent successfully",
            data: message,
        });
    } catch (err) {
        console.error("Send message error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};

const getMessages = async (req, res) => {
    try {
        const { channelId } = req.params;
        const { cursor, limit = 50 } = req.query;
        const userId = req.user.id;

        const channelIdInt = parseInt(channelId);
        const limitInt = parseInt(limit);

        if (isNaN(channelIdInt)) {
            return res.status(400).json({ message: "Invalid channel ID" });
        }

        // Verify user is a member of the server (indirectly via channel -> server)
        const channel = await prisma.channel.findUnique({
            where: { id: channelIdInt },
        });

        if (!channel) {
            return res.status(404).json({ message: "Channel not found" });
        }

        const member = await prisma.serverMember.findUnique({
            where: {
                userId_serverId: {
                    userId,
                    serverId: channel.serverId,
                },
            },
        });

        if (!member) {
            return res.status(403).json({ message: "You must be a member of the server to view messages" });
        }

        const queryOptions = {
            take: limitInt,
            where: { channelId: channelIdInt },
            orderBy: { createdAt: 'desc' }, // Newest first
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        avatar: true,
                    }
                }
            }
        };

        if (cursor) {
            queryOptions.cursor = { id: parseInt(cursor) };
            queryOptions.skip = 1; // Skip the cursor itself
        }

        const messages = await prisma.message.findMany(queryOptions);

        let nextCursor = null;
        if (messages.length === limitInt) {
            nextCursor = messages[messages.length - 1].id;
        }

        res.status(200).json({
            messages,
            nextCursor,
        });
    } catch (err) {
        console.error("Get messages error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = {
    sendMessage,
    getMessages,
};
