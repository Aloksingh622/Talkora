const prisma = require('../utils/prisma');

/**
 * Get all DM conversations for current user
 * GET /api/dm
 */
const getDMConversations = async (req, res) => {
    try {
        const userId = req.user.id;

        // Get all DM channels where user is involved
        const dmChannels = await prisma.directMessageChannel.findMany({
            where: {
                OR: [
                    { user1Id: userId },
                    { user2Id: userId }
                ]
            },
            include: {
                user1: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true
                    }
                },
                user2: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true
                    }
                },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1 // Get last message
                }
            },
            orderBy: {
                updatedAt: 'desc'
            }
        });

        // Transform to include other user and last message
        const conversations = dmChannels.map(channel => {
            const otherUser = channel.user1Id === userId ? channel.user2 : channel.user1;
            const lastMessage = channel.messages[0] || null;

            // Count unread messages
            const unreadCount = 0; // Will be implemented with Redis

            return {
                channelId: channel.id,
                user: otherUser,
                lastMessage,
                unreadCount,
                updatedAt: channel.updatedAt
            };
        });

        res.status(200).json({ conversations });
    } catch (error) {
        console.error('Get DM conversations error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Get DM channel info by ID
 * GET /api/dm/:channelId/info
 */
const getDMChannelInfo = async (req, res) => {
    try {
        const userId = req.user.id;
        const channelId = parseInt(req.params.channelId);

        const dmChannel = await prisma.directMessageChannel.findUnique({
            where: { id: channelId },
            include: {
                user1: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true
                    }
                },
                user2: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true
                    }
                }
            }
        });

        if (!dmChannel) {
            return res.status(404).json({ message: 'DM channel not found' });
        }

        if (dmChannel.user1Id !== userId && dmChannel.user2Id !== userId) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Determine the other user
        const otherUser = dmChannel.user1Id === userId ? dmChannel.user2 : dmChannel.user1;

        res.status(200).json({
            channel: {
                id: dmChannel.id,
                otherUser
            }
        });
    } catch (error) {
        console.error('Get DM channel info error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Create or get existing DM channel with a user
 * POST /api/dm/:userId
 */
const createOrGetDMChannel = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const otherUserId = parseInt(req.params.userId);

        // Validation
        if (currentUserId === otherUserId) {
            return res.status(400).json({ message: 'Cannot create DM with yourself' });
        }

        // Check if other user exists
        const otherUser = await prisma.user.findUnique({
            where: { id: otherUserId },
            select: {
                id: true,
                username: true,
                displayName: true,
                avatar: true
            }
        });

        if (!otherUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if users are friends
        const friendship = await prisma.friendship.findFirst({
            where: {
                OR: [
                    { requesterId: currentUserId, addresseeId: otherUserId },
                    { requesterId: otherUserId, addresseeId: currentUserId }
                ],
                status: 'ACCEPTED'
            }
        });

        if (!friendship) {
            return res.status(403).json({ message: 'You can only DM friends' });
        }

        // Ensure user1Id < user2Id for consistent lookups
        const user1Id = Math.min(currentUserId, otherUserId);
        const user2Id = Math.max(currentUserId, otherUserId);

        // Check if DM channel already exists
        let dmChannel = await prisma.directMessageChannel.findUnique({
            where: {
                user1Id_user2Id: {
                    user1Id,
                    user2Id
                }
            },
            include: {
                user1: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true
                    }
                },
                user2: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true
                    }
                }
            }
        });

        // Create if doesn't exist
        if (!dmChannel) {
            dmChannel = await prisma.directMessageChannel.create({
                data: {
                    user1Id,
                    user2Id
                },
                include: {
                    user1: {
                        select: {
                            id: true,
                            username: true,
                            displayName: true,
                            avatar: true
                        }
                    },
                    user2: {
                        select: {
                            id: true,
                            username: true,
                            displayName: true,
                            avatar: true
                        }
                    }
                }
            });
        }

        res.status(200).json({ dmChannel });
    } catch (error) {
        console.error('Create/get DM channel error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Get DM messages for a channel
 * GET /api/dm/:channelId/messages
 */
const getDMMessages = async (req, res) => {
    try {
        const userId = req.user.id;
        const channelId = parseInt(req.params.channelId);
        const { limit = 50, before } = req.query;

        // Verify user is part of this DM channel
        const dmChannel = await prisma.directMessageChannel.findUnique({
            where: { id: channelId }
        });

        if (!dmChannel) {
            return res.status(404).json({ message: 'DM channel not found' });
        }

        if (dmChannel.user1Id !== userId && dmChannel.user2Id !== userId) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Build query
        const query = {
            where: { channelId },
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit),
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
        };

        // Pagination: get messages before a certain message ID
        if (before) {
            query.where.id = { lt: parseInt(before) };
        }

        const messages = await prisma.directMessage.findMany(query);

        // Mark messages as read
        await prisma.directMessage.updateMany({
            where: {
                channelId,
                senderId: { not: userId },
                isRead: false
            },
            data: { isRead: true }
        });

        res.status(200).json({ messages: messages.reverse() });
    } catch (error) {
        console.error('Get DM messages error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Send a DM message (REST endpoint)
 * POST /api/dm/:channelId/messages
 */
const sendDMMessage = async (req, res) => {
    try {
        const userId = req.user.id;
        const channelId = parseInt(req.params.channelId);
        const { content, fileUrl, fileType, fileName } = req.body;

        // Validation
        if (!content && !fileUrl) {
            return res.status(400).json({ message: 'Message cannot be empty' });
        }

        if (content && content.length > 2000) {
            return res.status(400).json({ message: 'Message is too long (max 2000 characters)' });
        }

        // Verify channel exists and user has access
        const dmChannel = await prisma.directMessageChannel.findUnique({
            where: { id: channelId }
        });

        if (!dmChannel) {
            return res.status(404).json({ message: 'DM channel not found' });
        }

        if (dmChannel.user1Id !== userId && dmChannel.user2Id !== userId) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Create message
        const message = await prisma.directMessage.create({
            data: {
                content,
                fileUrl,
                fileType,
                fileName,
                senderId: userId,
                channelId
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
            where: { id: channelId },
            data: { updatedAt: new Date() }
        });

        // Emit real-time notification
        const io = req.app.get('io');
        if (io) {
            const recipientId = dmChannel.user1Id === userId ? dmChannel.user2Id : dmChannel.user1Id;

            // Emit to DM room
            io.to(`dm:${channelId}`).emit('NEW_DM', message);

            // Also emit to user's personal room (for notification)
            io.to(`user:${recipientId}`).emit('DM_NOTIFICATION', {
                channelId,
                message,
                sender: message.sender
            });
        }

        res.status(201).json({ message });
    } catch (error) {
        console.error('Send DM message error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    getDMConversations,
    getDMChannelInfo,
    createOrGetDMChannel,
    getDMMessages,
    sendDMMessage
};
