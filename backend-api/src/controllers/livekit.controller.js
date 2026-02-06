const { AccessToken } = require('livekit-server-sdk');
const prisma = require('../utils/prisma');

/**
 * Generate LiveKit access token for a user to join a voice/video channel
 * GET /api/livekit/token?channelId=123
 */
const getToken = async (req, res) => {
    try {
        const { channelId } = req.query;
        const userId = req.user.id;

        if (!channelId) {
            return res.status(400).json({ error: 'channelId is required' });
        }

        const channelIdInt = parseInt(channelId);

        // Verify channel exists and is a voice/video channel
        const channel = await prisma.channel.findUnique({
            where: { id: channelIdInt },
            select: { 
                id: true, 
                name: true, 
                type: true, 
                serverId: true 
            }
        });

        if (!channel) {
            return res.status(404).json({ error: 'Channel not found' });
        }

        if (channel.type === 'TEXT') {
            return res.status(400).json({ error: 'Cannot join text channel with LiveKit' });
        }

        // Verify user is a member of the server
        const member = await prisma.serverMember.findUnique({
            where: {
                userId_serverId: {
                    userId: userId,
                    serverId: channel.serverId
                }
            }
        });

        if (!member) {
            return res.status(403).json({ error: 'You are not a member of this server' });
        }

        // Check if user is banned (import authUtils for production)
        // For now, we'll skip ban checks to keep it simple

        // Generate LiveKit token
        const roomName = `channel-${channelIdInt}`;
        const participantName = `user-${userId}`;

        const at = new AccessToken(
            process.env.LIVEKIT_API_KEY,
            process.env.LIVEKIT_API_SECRET,
            {
                identity: participantName,
                name: req.user.username,
            }
        );

        at.addGrant({
            room: roomName,
            roomJoin: true,
            canPublish: true,
            canSubscribe: true,
        });

        const token = await at.toJwt();

        return res.json({
            token,
            url: process.env.LIVEKIT_URL,
            roomName,
            channelId: channelIdInt,
            channelName: channel.name
        });

    } catch (err) {
        console.error('LiveKit token generation error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Generate LiveKit access token for DM calls
 * GET /api/livekit/dm-token?channelId=123
 */
const getDMToken = async (req, res) => {
    try {
        const { channelId } = req.query;
        const userId = req.user.id;

        if (!channelId) {
            return res.status(400).json({ error: 'channelId is required' });
        }

        const channelIdInt = parseInt(channelId);

        // Verify DM channel exists and user is a participant
        const dmChannel = await prisma.directMessageChannel.findUnique({
            where: { id: channelIdInt },
            include: {
                user1: { select: { id: true, username: true, avatar: true } },
                user2: { select: { id: true, username: true, avatar: true } }
            }
        });

        if (!dmChannel) {
            return res.status(404).json({ error: 'DM channel not found' });
        }

        // Verify user is a participant
        if (dmChannel.user1Id !== userId && dmChannel.user2Id !== userId) {
            return res.status(403).json({ error: 'You are not a participant in this DM' });
        }

        // Generate LiveKit token
        const roomName = `dm-${channelIdInt}`;
        const participantName = `user-${userId}`;

        const at = new AccessToken(
            process.env.LIVEKIT_API_KEY,
            process.env.LIVEKIT_API_SECRET,
            {
                identity: participantName,
                name: req.user.username,
            }
        );

        at.addGrant({
            room: roomName,
            roomJoin: true,
            canPublish: true,
            canSubscribe: true,
        });

        const token = await at.toJwt();

        // Get other user info
        const otherUser = dmChannel.user1Id === userId ? dmChannel.user2 : dmChannel.user1;

        const responseData = {
            token,
            url: process.env.LIVEKIT_URL,
            roomName,
            channelId: channelIdInt,
            otherUser
        };

        console.log('[getDMToken] Returning:', { url: responseData.url, roomName: responseData.roomName, userId });

        return res.json(responseData);

    } catch (err) {
        console.error('LiveKit DM token generation error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = { getToken, getDMToken };
