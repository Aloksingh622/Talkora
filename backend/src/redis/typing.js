const redisclient = require('../database/redis');
const { getTypingKey } = require('./keys');

const TYPING_TTL = 3; // 3 seconds

const setTypingStatus = async (channelId, userId) => {
    try {
        const key = getTypingKey(channelId, userId);
        await redisclient.set(key, 'true', { EX: TYPING_TTL });
    } catch (error) {
        console.error('Redis setTypingStatus error:', error);
    }
};

const removeTypingStatus = async (channelId, userId) => {
    try {
        const key = getTypingKey(channelId, userId);
        await redisclient.del(key);
    } catch (error) {
        console.error('Redis removeTypingStatus error:', error);
    }
};

module.exports = {
    setTypingStatus,
    removeTypingStatus,
};
