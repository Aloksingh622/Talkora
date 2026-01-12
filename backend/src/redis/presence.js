const redisclient = require('../database/redis');
const {
    getOnlineUserKey,
    getPresenceLastSeenKey,
    getPresenceConnectionsKey,
    getSocketUserKey
} = require('./keys');

const ONLINE_TTL = 120; // 120 seconds

const addUserSession = async (socketId, userId) => {
    if (!userId) return;

    const onlineKey = getOnlineUserKey(userId);
    const lastSeenKey = getPresenceLastSeenKey(userId);
    const connectionsKey = getPresenceConnectionsKey(userId);
    const socketUserKey = getSocketUserKey(socketId);

    try {
        await Promise.all([
            // Increment connections
            redisclient.incr(connectionsKey),
            // Mark online with TTL
            redisclient.set(onlineKey, 'true', { EX: ONLINE_TTL }),
            // Remove last seen (user is active)
            redisclient.del(lastSeenKey),
            // Map socket
            redisclient.set(socketUserKey, userId.toString())
        ]);
    } catch (error) {
        console.error('Redis addUserSession error:', error);
    }
};

const removeUserSession = async (socketId) => {
    try {
        const socketUserKey = getSocketUserKey(socketId);
        const userId = await redisclient.get(socketUserKey);

        if (userId) {
            const onlineKey = getOnlineUserKey(userId);
            const connectionsKey = getPresenceConnectionsKey(userId);
            const lastSeenKey = getPresenceLastSeenKey(userId);

            // Decrement connections
            const count = await redisclient.decr(connectionsKey);

            // Clean up socket mapping
            await redisclient.del(socketUserKey);

            if (count <= 0) {
                // User is offline - clean up all presence data
                await Promise.all([
                    redisclient.del(onlineKey),
                    redisclient.set(lastSeenKey, Date.now().toString(), { EX: 86400 * 30 }), // Keep lastSeen for 30 days
                    redisclient.del(connectionsKey) // Delete instead of setting to 0
                ]);
            } else {
                // Still has other connections, set TTL on connections count
                await redisclient.expire(connectionsKey, ONLINE_TTL);
            }
        }
    } catch (error) {
        console.error('Redis removeUserSession error:', error);
    }
};

const refreshOnlineStatus = async (userId) => {
    if (!userId) return;
    try {
        const onlineKey = getOnlineUserKey(userId);
        await redisclient.expire(onlineKey, ONLINE_TTL);
    } catch (error) {
        console.error('Redis refreshOnlineStatus error:', error);
    }
};

const getPresence = async (userId) => {
    try {
        const onlineKey = getOnlineUserKey(userId);
        const lastSeenKey = getPresenceLastSeenKey(userId);

        // Check if online
        const isOnline = await redisclient.get(onlineKey);

        // Get last seen
        const lastSeen = await redisclient.get(lastSeenKey);

        return {
            online: isOnline === 'true',
            lastSeen: lastSeen ? parseInt(lastSeen) : null,
        };
    } catch (err) {
        console.error('Redis getPresence error:', err);
        return { online: false, lastSeen: null };
    }
}

module.exports = {
    addUserSession,
    removeUserSession,
    refreshOnlineStatus,
    getPresence,
};
