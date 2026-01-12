// Redis Key Namespace Management

const getOnlineUserKey = (userId) => `presence:${userId}:online`; // Updated to match requirement
const getPresenceLastSeenKey = (userId) => `presence:${userId}:lastSeen`;
const getPresenceConnectionsKey = (userId) => `presence:${userId}:connections`;
// Kept for backward compat or internal use if needed, but presence keys should be primary
const getSocketUserKey = (socketId) => `socket:${socketId}:user`;
const getUserSocketKey = (userId) => `user:${userId}:socket`;
const getTypingKey = (channelId, userId) => `typing:${channelId}:${userId}`;
const getRateLimitKey = (userId) => `rate:message:${userId}`;

module.exports = {
    getOnlineUserKey,
    getPresenceLastSeenKey,
    getPresenceConnectionsKey,
    getSocketUserKey,
    getUserSocketKey,
    getTypingKey,
    getRateLimitKey,
};
