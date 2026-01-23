const prisma = require('../utils/prisma');

/**
 * Send a friend request
 * POST /api/friends/request
 */
const sendFriendRequest = async (req, res) => {
    try {
        const requesterId = req.user.id;
        const { addresseeId } = req.body;

        // Validation
        if (!addresseeId) {
            return res.status(400).json({ message: 'Addressee ID is required' });
        }

        if (requesterId === addresseeId) {
            return res.status(400).json({ message: 'You cannot send a friend request to yourself' });
        }

        // Check if addressee exists
        const addressee = await prisma.user.findUnique({
            where: { id: addresseeId }
        });

        if (!addressee) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if friendship already exists (in either direction)
        const existingFriendship = await prisma.friendship.findFirst({
            where: {
                OR: [
                    { requesterId, addresseeId },
                    { requesterId: addresseeId, addresseeId: requesterId }
                ]
            }
        });

        if (existingFriendship) {
            if (existingFriendship.status === 'ACCEPTED') {
                return res.status(400).json({ message: 'You are already friends' });
            }
            if (existingFriendship.status === 'PENDING') {
                return res.status(400).json({ message: 'Friend request already sent' });
            }
            if (existingFriendship.status === 'BLOCKED') {
                return res.status(403).json({ message: 'Cannot send friend request' });
            }
        }

        // Create friend request
        const friendship = await prisma.friendship.create({
            data: {
                requesterId,
                addresseeId,
                status: 'PENDING'
            },
            include: {
                requester: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true
                    }
                },
                addressee: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true
                    }
                }
            }
        });

        // Emit real-time notification to addressee (if online)
        const io = req.app.get('io');
        if (io) {
            io.to(`user:${addresseeId}`).emit('FRIEND_REQUEST', friendship);
        }

        res.status(201).json({
            message: 'Friend request sent',
            friendship
        });
    } catch (error) {
        console.error('Send friend request error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Accept a friend request
 * POST /api/friends/:id/accept
 */
const acceptFriendRequest = async (req, res) => {
    try {
        const userId = req.user.id;
        const friendshipId = parseInt(req.params.id);

        // Find the friend request
        const friendship = await prisma.friendship.findUnique({
            where: { id: friendshipId },
            include: {
                requester: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true
                    }
                },
                addressee: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true
                    }
                }
            }
        });

        if (!friendship) {
            return res.status(404).json({ message: 'Friend request not found' });
        }

        // Verify user is the addressee
        if (friendship.addresseeId !== userId) {
            return res.status(403).json({ message: 'You can only accept requests sent to you' });
        }

        if (friendship.status !== 'PENDING') {
            return res.status(400).json({ message: 'This friend request is not pending' });
        }

        // Update status to ACCEPTED
        const updatedFriendship = await prisma.friendship.update({
            where: { id: friendshipId },
            data: { status: 'ACCEPTED' },
            include: {
                requester: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true
                    }
                },
                addressee: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true
                    }
                }
            }
        });

        // Emit real-time notification to requester
        const io = req.app.get('io');
        if (io) {
            io.to(`user:${friendship.requesterId}`).emit('FRIEND_ACCEPTED', updatedFriendship);
        }

        res.status(200).json({
            message: 'Friend request accepted',
            friendship: updatedFriendship
        });
    } catch (error) {
        console.error('Accept friend request error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Reject or remove a friend
 * DELETE /api/friends/:id
 */
const rejectOrRemoveFriend = async (req, res) => {
    try {
        const userId = req.user.id;
        const friendshipId = parseInt(req.params.id);

        // Find the friendship
        const friendship = await prisma.friendship.findUnique({
            where: { id: friendshipId }
        });

        if (!friendship) {
            return res.status(404).json({ message: 'Friendship not found' });
        }

        // Verify user is part of this friendship
        if (friendship.requesterId !== userId && friendship.addresseeId !== userId) {
            return res.status(403).json({ message: 'You are not part of this friendship' });
        }

        // Delete the friendship
        await prisma.friendship.delete({
            where: { id: friendshipId }
        });

        // Emit real-time notification
        const io = req.app.get('io');
        if (io) {
            const otherUserId = friendship.requesterId === userId
                ? friendship.addresseeId
                : friendship.requesterId;
            io.to(`user:${otherUserId}`).emit('FRIEND_REMOVED', { friendshipId });
        }

        res.status(200).json({ message: 'Friendship removed' });
    } catch (error) {
        console.error('Remove friend error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Get all friends (accepted friendships)
 * GET /api/friends
 */
const getFriends = async (req, res) => {
    try {
        const userId = req.user.id;

        // Get all accepted friendships where user is involved
        const friendships = await prisma.friendship.findMany({
            where: {
                OR: [
                    { requesterId: userId },
                    { addresseeId: userId }
                ],
                status: 'ACCEPTED'
            },
            include: {
                requester: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true
                    }
                },
                addressee: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true
                    }
                }
            },
            orderBy: {
                updatedAt: 'desc'
            }
        });

        // Transform to simple friend list
        const friends = friendships.map(friendship => {
            const friend = friendship.requesterId === userId
                ? friendship.addressee
                : friendship.requester;

            return {
                friendshipId: friendship.id,
                ...friend,
                friendsSince: friendship.createdAt
            };
        });

        res.status(200).json({ friends });
    } catch (error) {
        console.error('Get friends error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Get pending friend requests
 * GET /api/friends/requests
 */
const getPendingRequests = async (req, res) => {
    try {
        const userId = req.user.id;

        // Get pending requests sent TO this user
        const incomingRequests = await prisma.friendship.findMany({
            where: {
                addresseeId: userId,
                status: 'PENDING'
            },
            include: {
                requester: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Get pending requests sent BY this user
        const outgoingRequests = await prisma.friendship.findMany({
            where: {
                requesterId: userId,
                status: 'PENDING'
            },
            include: {
                addressee: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        res.status(200).json({
            incoming: incomingRequests,
            outgoing: outgoingRequests
        });
    } catch (error) {
        console.error('Get pending requests error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    sendFriendRequest,
    acceptFriendRequest,
    rejectOrRemoveFriend,
    getFriends,
    getPendingRequests
};
