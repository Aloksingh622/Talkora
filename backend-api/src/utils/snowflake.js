const crypto = require('crypto');

/**
 * Snowflake-like ID Generator
 * Format: msg_{timestamp}_{randomHex}
 * Example: msg_1738963200000_a1b2c3d4e5f6g7h8
 * 
 * Why?
 * 1. Timestamp is first (sortable + extractable).
 * 2. Random hex ensures uniqueness across distributed systems.
 * 3. "msg_" prefix identifies the entity type.
 */

const generateMessageId = () => {
    const timestamp = Date.now();
    const randomHex = crypto.randomBytes(8).toString('hex'); // 16 chars
    return `msg_${timestamp}_${randomHex}`;
};

const getTimestampFromId = (messageId) => {
    if (!messageId || typeof messageId !== 'string') return null;

    const parts = messageId.split('_');
    // Expected format: msg_1234567890_abcdef
    if (parts.length !== 3 || parts[0] !== 'msg') return null;

    const timestamp = parseInt(parts[1], 10);
    return isNaN(timestamp) ? null : timestamp;
};

const getAgeInDays = (messageId) => {
    const timestamp = getTimestampFromId(messageId);
    if (!timestamp) return Infinity; // Treat malformed as "Old" (go to DB)

    const now = Date.now();
    const diffMs = now - timestamp;
    const days = diffMs / (1000 * 60 * 60 * 24);

    // Handle clock skew (future timestamps treated as 0 age)
    return Math.max(0, days);
};

module.exports = {
    generateMessageId,
    getTimestampFromId,
    getAgeInDays
};
