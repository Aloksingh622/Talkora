const redisclient = require('../database/redis');
const { getRateLimitKey } = require('./keys');

const RATE_LIMIT_WINDOW = 10; // 10 seconds
const RATE_LIMIT_MAX = 5; // 5 messages per window

const checkRateLimit = async (userId) => {
    try {
        const key = getRateLimitKey(userId);

        // Increment the counter
        const currentCount = await redisclient.incr(key);

        // If it's the first message, set the expiration
        if (currentCount === 1) {
            await redisclient.expire(key, RATE_LIMIT_WINDOW);
        }

        if (currentCount > RATE_LIMIT_MAX) {
            return false; // Rate limit exceeded
        }

        return true; // Allowed
    } catch (error) {
        console.error('Redis checkRateLimit error:', error);
        return true; // Fail open (allow message) if Redis fails
    }
};

module.exports = {
    checkRateLimit,
};
