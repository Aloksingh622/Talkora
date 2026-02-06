const redis = require('redis');
require('dotenv').config();

// Create a DEDICATED Redis client for caching to avoid conflict with Pub/Sub clients
const redisclient = redis.createClient({
    username: 'default',
    password: process.env.REDISPASS,
    socket: {
        host: 'redis-19553.crce179.ap-south-1-1.ec2.cloud.redislabs.com',
        port: process.env.REDISPORT
    }
});

redisclient.connect().catch(console.error);

const prisma = require('../utils/prisma');
const { getChannelServerKey, getUserPermissionsKey, getDMChannelKey } = require('./keys');
const authUtils = require('../utils/authUtils');

// TTLs
const CHANNEL_TTL = 3600; // 1 hour (Channel -> Server mapping rarely changes)
const PERMS_TTL = 60;     // 60 seconds (User perms/bans/timeouts)

/**
 * Get DM Channel Members (Cached)
 * @param {number} channelId 
 * @returns {Promise<{user1Id: number, user2Id: number}|null>}
 */
const getCachedDMChannelMembers = async (channelId) => {
    if (!channelId) return null;
    const key = getDMChannelKey(channelId);

    try {
        // 1. Check Cache
        const cached = await redisclient.get(key);
        if (cached) {
            return JSON.parse(cached);
        }

        // 2. Cache MISS - Query DB
        const dmChannel = await prisma.directMessageChannel.findUnique({
            where: { id: channelId },
            select: { user1Id: true, user2Id: true }
        });

        if (!dmChannel) return null;

        // 3. Set Cache
        await redisclient.set(key, JSON.stringify(dmChannel), { EX: CHANNEL_TTL });
        return dmChannel;

    } catch (err) {
        console.error('Cache Error (DM):', err);
        const dmChannel = await prisma.directMessageChannel.findUnique({
            where: { id: channelId },
            select: { user1Id: true, user2Id: true }
        });
        return dmChannel;
    }
};

/**
 * Get Server ID for a Channel (Cached)
 * @param {number} channelId 
 * @returns {Promise<number|null>} serverId
 */
const getCachedChannelServerId = async (channelId) => {
    if (!channelId) return null;
    const key = getChannelServerKey(channelId);

    try {
        // 1. Check Cache
        const cached = await redisclient.get(key);
        if (cached) {
            // console.log(`[CACHE] HIT channel:${channelId} -> server:${cached}`);
            return parseInt(cached);
        }

        // 2. Cache MISS - Query DB
        // console.log(`[CACHE] MISS channel:${channelId} (Querying DB)`);
        const channel = await prisma.channel.findUnique({
            where: { id: channelId },
            select: { serverId: true }
        });

        if (!channel) return null;

        // 3. Set Cache
        await redisclient.set(key, channel.serverId.toString(), { EX: CHANNEL_TTL });
        return channel.serverId;
    } catch (err) {
        console.error('Cache Error (Channel):', err);
        // Fallback to DB if Redis fails
        const channel = await prisma.channel.findUnique({
            where: { id: channelId },
            select: { serverId: true }
        });
        return channel ? channel.serverId : null;
    }
};

/**
 * Get User Permissions for a Server (Cached)
 * Checks: Membership, Owner, Ban, Timeout
 * @param {number} userId 
 * @param {number} serverId 
 * @returns {Promise<{allowed: boolean, error?: string, details?: any}>}
 */
const getCachedUserPermissions = async (userId, serverId) => {
    if (!userId || !serverId) return { allowed: false, error: 'Invalid parameters' };
    const key = getUserPermissionsKey(userId, serverId);

    try {
        // 1. Check Cache
        const cached = await redisclient.get(key);
        if (cached) {
            // console.log(`[CACHE] HIT user:${userId}:server:${serverId} -> perms`);
            const data = JSON.parse(cached);

            // Check expiry logic for timeout if needed (though we cache the result state)
            // If cached rejected state, return it
            if (!data.allowed) return data;

            return { allowed: true };
        }

        // 2. Cache MISS - Query DB (Parallelize for speed)
        // console.log(`[CACHE] MISS user:${userId}:server:${serverId} (Querying DB)`);

        // We need: Member check, Owner check, Ban check, Timeout check
        // Check Membership first as it's the base requirement
        const member = await prisma.serverMember.findUnique({
            where: { userId_serverId: { userId, serverId } }
        });

        if (!member) {
            const result = { allowed: false, error: 'Access denied' };
            // Cache "Not a member" (short TTL is fine)
            await redisclient.set(key, JSON.stringify(result), { EX: PERMS_TTL });
            return result;
        }

        // Parallel checks
        const [isOwner, isBanned, timeoutResult] = await Promise.all([
            authUtils.isServerOwner(userId, serverId),
            authUtils.isUserBanned(userId, serverId),
            authUtils.isUserTimedOut(userId, serverId)
        ]);

        if (isOwner) {
            const result = { allowed: true };
            await redisclient.set(key, JSON.stringify(result), { EX: PERMS_TTL });
            return result;
        }

        if (isBanned) {
            const result = { allowed: false, error: 'You are banned from this server' };
            await redisclient.set(key, JSON.stringify(result), { EX: PERMS_TTL });
            return result;
        }

        if (timeoutResult.isTimedOut) {
            const result = {
                allowed: false,
                error: 'You are timed out from this server',
                details: {
                    expiresAt: timeoutResult.timeout.expiresAt,
                    reason: timeoutResult.timeout.reason
                }
            };
            // Calculate remaining TTL for the cache key based on timeout? 
            // Stick to standard TTL for simplicity. If they are timed out for 5 mins, 
            // refreshing cache every 60s is fine.
            await redisclient.set(key, JSON.stringify(result), { EX: PERMS_TTL });
            return result;
        }

        // Success
        const result = { allowed: true };
        await redisclient.set(key, JSON.stringify(result), { EX: PERMS_TTL });
        return result;

    } catch (err) {
        console.error('Cache Error (Perms):', err);
        // Fallback to non-cached
        return { allowed: false, error: 'Internal server error (Cache Fail)' };
    }
};

module.exports = {
    getCachedChannelServerId,
    getCachedUserPermissions,
    getCachedDMChannelMembers
};
