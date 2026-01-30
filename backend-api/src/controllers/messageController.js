const prisma = require('../utils/prisma');
const uploadOnCloudinary = require('../database/cloudinary');

const sendMessage = async (req, res) => {
    try {

        const { content } = req.body;
        const { channelId } = req.params;
        const userId = req.user.id; // From auth middleware
        const file = req.file;

        // If no content AND no file, error
        if ((!content || content.trim() === '') && !file) {
            return res.status(400).json({ message: "Message content or file is required" });
        }

        if (content && content.length > 2000) {
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

        // Check if user is banned (import authUtils first)
        const { isUserBanned, isUserTimedOut, isServerOwner } = require('../utils/authUtils');

        // Owner can always send messages
        const isOwner = await isServerOwner(userId, channel.serverId);

        if (!isOwner) {
            // Check if user is banned
            const banned = await isUserBanned(userId, channel.serverId);
            if (banned) {
                return res.status(403).json({ message: "You are banned from this server" });
            }

            // Check if user is timed out
            const { isTimedOut, timeout } = await isUserTimedOut(userId, channel.serverId);
            if (isTimedOut) {
                const expiresIn = Math.ceil((timeout.expiresAt - new Date()) / 1000);
                return res.status(403).json({
                    message: "You are timed out from this server",
                    expiresAt: timeout.expiresAt,
                    expiresIn,
                    reason: timeout.reason
                });
            }
        }



        // Handle file upload
        let fileUrl = null;
        let fileType = null;
        let fileName = null;

        if (file) {
            // Upload to Cloudinary
            const result = await uploadOnCloudinary(file.path);
            if (result) {
                fileUrl = result;
                fileName = file.originalname;

                // Determine simplistic file type
                if (file.mimetype.startsWith('image/')) fileType = 'IMAGE';
                else if (file.mimetype.startsWith('video/')) fileType = 'VIDEO';
                else if (file.mimetype === 'application/pdf') fileType = 'PDF';
                else fileType = 'FILE';
            }
        }

        // Create message
        const message = await prisma.message.create({
            data: {
                content: content ? content.trim() : null,
                userId,
                channelId: channelIdInt,
                fileUrl,
                fileType,
                fileName
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


const editMessage = async (req, res) => {
    try {
        const { content } = req.body;
        const { channelId, messageId } = req.params;
        const userId = req.user.id;

        if (!content || content.trim() === '') {
            return res.status(400).json({ message: "Message content is required" });
        }

        if (content.length > 2000) {
            return res.status(400).json({ message: "Message content exceeds 2000 characters" });
        }

        const messageIdInt = parseInt(messageId);
        const channelIdInt = parseInt(channelId);

        // Find the message
        const message = await prisma.message.findUnique({
            where: { id: messageIdInt },
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

        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }

        // Verify ownership
        if (message.userId !== userId) {
            return res.status(403).json({ message: "You can only edit your own messages" });
        }

        // Verify channel matches
        if (message.channelId !== channelIdInt) {
            return res.status(400).json({ message: "Message does not belong to this channel" });
        }

        // Update message
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
                        avatar: true,
                    }
                }
            }
        });

        // Broadcast to WebSocket room
        const io = req.app.get('io');
        if (io) {
            io.to(`channel:${channelIdInt}`).emit('MESSAGE_EDITED', updatedMessage);
        }

        res.status(200).json({
            message: "Message updated successfully",
            data: updatedMessage,
        });
    } catch (err) {
        console.error("Edit message error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};

const deleteMessage = async (req, res) => {
    try {
        const { channelId, messageId } = req.params;
        const userId = req.user.id;

        const messageIdInt = parseInt(messageId);
        const channelIdInt = parseInt(channelId);

        // Find the message
        const message = await prisma.message.findUnique({
            where: { id: messageIdInt },
        });

        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }

        // Verify ownership
        if (message.userId !== userId) {
            return res.status(403).json({ message: "You can only delete your own messages" });
        }

        // Verify channel matches
        if (message.channelId !== channelIdInt) {
            return res.status(400).json({ message: "Message does not belong to this channel" });
        }

        // Delete message
        await prisma.message.delete({
            where: { id: messageIdInt },
        });

        // Broadcast to WebSocket room
        const io = req.app.get('io');
        if (io) {
            io.to(`channel:${channelIdInt}`).emit('MESSAGE_DELETED', { id: messageIdInt, channelId: channelIdInt });
        }

        res.status(200).json({
            message: "Message deleted successfully",
        });
    } catch (err) {
        console.error("Delete message error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = {
    sendMessage,
    getMessages,
    editMessage,
    deleteMessage,
};
