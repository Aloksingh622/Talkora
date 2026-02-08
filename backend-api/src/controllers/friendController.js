const prisma = require('../utils/prisma');

/**
 * Send a friend request
 * POST /api/friends/request
 */
const sendFriendRequest = async (req, res) => {
    try {
        const requesterId = req.user.id;
        const { addresseeId: lookupValue } = req.body;

        // Validation
        if (!lookupValue) {
            return res.status(400).json({ message: 'Username or ID is required' });
        }

        if (requesterId === lookupValue) {
            return res.status(400).json({ message: 'You cannot send a friend request to yourself' });
        }

        // Find addressee by ID or Username
        let addressee;
        const potentialId = parseInt(lookupValue);

        if (!isNaN(potentialId)) {
            addressee = await prisma.user.findUnique({ where: { id: potentialId } });
        }

        if (!addressee) {
            addressee = await prisma.user.findUnique({ where: { username: lookupValue.toString() } });
        }

        if (!addressee) {
            return res.status(404).json({ message: `User '${lookupValue}' not found` });
        }

        // Use the resolved integer ID
        const targetId = addressee.id;

        if (requesterId === targetId) {
            return res.status(400).json({ message: 'You cannot send a friend request to yourself' });
        }

        // Check if friendship already exists (in either direction)
        const existingFriendship = await prisma.friendship.findFirst({
            where: {
                OR: [
                    { requesterId, addresseeId: targetId },
                    { requesterId: targetId, addresseeId: requesterId }
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
                addresseeId: targetId,
                status: 'PENDING'
            },
            include: {
                requester: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true,
                        bannerColor: true,
                        bannerImage: true,
                        ringColor: true,
                        bio: true,
                        createdAt: true,
                    }
                },
                addressee: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true,
                        bannerColor: true,
                        bannerImage: true,
                        ringColor: true,
                        bio: true,
                        createdAt: true,
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
                        avatar: true,
                        bannerColor: true,
                        bannerImage: true,
                        ringColor: true,
                        bio: true,
                        createdAt: true,
                    }
                },
                addressee: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true,
                        bannerColor: true,
                        bannerImage: true,
                        ringColor: true,
                        bio: true,
                        createdAt: true,
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
                        avatar: true,
                        bannerColor: true,
                        bannerImage: true,
                        ringColor: true,
                        bio: true,
                        createdAt: true,
                    }
                },
                addressee: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true,
                        bannerColor: true,
                        bannerImage: true,
                        ringColor: true,
                        bio: true,
                        createdAt: true,
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

// Import getPresence at the top
const { getPresence } = require('../redis/presence');

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
                        avatar: true,
                        bannerColor: true,
                        bannerImage: true,
                        ringColor: true,
                        bio: true,
                        createdAt: true,
                    }
                },
                addressee: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatar: true,
                        bannerColor: true,
                        bannerImage: true,
                        ringColor: true,
                        bio: true,
                        createdAt: true,
                    }
                }
            },
            orderBy: {
                updatedAt: 'desc'
            }
        });

        // Transform to simple friend list with Presence
        const friends = await Promise.all(friendships.map(async (friendship) => {
            const friend = friendship.requesterId === userId
                ? friendship.addressee
                : friendship.requester;

            // Fetch presence from Redis
            const presence = await getPresence(friend.id);

            return {
                friendshipId: friendship.id,
                ...friend,
                online: presence.online,
                lastSeen: presence.lastSeen,
                friendsSince: friendship.createdAt
            };
        }));

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
                        avatar: true,
                        bannerColor: true,
                        bannerImage: true,
                        ringColor: true,
                        bio: true,
                        createdAt: true,
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
                        avatar: true,
                        bannerColor: true,
                        bannerImage: true,
                        ringColor: true,
                        bio: true,
                        createdAt: true,
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

/**
 * Search users by username or displayName
 * GET /api/friends/search?query=xxx
 */
const searchUsers = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const { query } = req.query;

        // Validation: minimum 2 characters
        if (!query || query.trim().length < 2) {
            return res.status(400).json({ message: 'Search query must be at least 2 characters' });
        }

        const searchTerm = query.trim();

        // Search users by username or displayName (case-insensitive)
        const users = await prisma.user.findMany({
            where: {
                AND: [
                    { id: { not: currentUserId } }, // Exclude current user
                    {
                        OR: [
                            { username: { contains: searchTerm, mode: 'insensitive' } },
                            { displayName: { contains: searchTerm, mode: 'insensitive' } }
                        ]
                    }
                ]
            },
            select: {
                id: true,
                username: true,
                displayName: true,
                avatar: true
            },
            take: 10 // Limit to 10 results
        });

        // Get friendship statuses for each user
        const friendships = await prisma.friendship.findMany({
            where: {
                OR: [
                    { requesterId: currentUserId, addresseeId: { in: users.map(u => u.id) } },
                    { addresseeId: currentUserId, requesterId: { in: users.map(u => u.id) } }
                ]
            }
        });

        console.log('Search query:', searchTerm, '| Found users:', users.length, users.map(u => u.username));

        // Map users with their friendship status
        const usersWithStatus = users.map(user => {
            const friendship = friendships.find(
                f => (f.requesterId === currentUserId && f.addresseeId === user.id) ||
                    (f.addresseeId === currentUserId && f.requesterId === user.id)
            );

            let friendshipStatus = 'none';
            if (friendship) {
                if (friendship.status === 'ACCEPTED') {
                    friendshipStatus = 'friends';
                } else if (friendship.status === 'PENDING') {
                    friendshipStatus = friendship.requesterId === currentUserId
                        ? 'pending_outgoing'
                        : 'pending_incoming';
                }
            }

            return {
                ...user,
                friendshipStatus
            };
        });

        console.log('Returning users with status:', usersWithStatus.length);
        res.json({ users: usersWithStatus });

    } catch (error) {
        console.error('Search users error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    sendFriendRequest,
    acceptFriendRequest,
    rejectOrRemoveFriend,
    getFriends,
    getPendingRequests,
    searchUsers
};
