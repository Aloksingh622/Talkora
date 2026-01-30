const prisma = require('./prisma');

/**
 * Check if a user is the owner of a server
 * @param {number} userId - The user ID
 * @param {number} serverId - The server ID
 * @returns {Promise<boolean>} - True if user is owner
 */
async function isServerOwner(userId, serverId) {
    const server = await prisma.server.findUnique({
        where: { id: serverId },
        select: { ownerId: true }
    });

    return server && server.ownerId === userId;
}

/**
 * Check if a user is banned from a server
 * @param {number} userId - User ID
 * @param {number} serverId - Server ID
 * @returns {Promise<boolean>}
 */
async function isUserBanned(userId, serverId) {
    const ban = await prisma.ban.findUnique({
        where: {
            userId_serverId: {
                userId,
                serverId
            }
        }
    });

    return !!ban;
}

/**
 * Check if a user is currently timed out
 * @param {number} userId - User ID
 * @param {number} serverId - Server ID
 * @returns {Promise<{isTimedOut: boolean, timeout?: Timeout}>}
 */
async function isUserTimedOut(userId, serverId) {
    const timeout = await prisma.timeout.findUnique({
        where: {
            userId_serverId: {
                userId,
                serverId
            }
        }
    });

    if (!timeout) {
        return { isTimedOut: false };
    }

    // Check if timeout has expired
    if (new Date() > timeout.expiresAt) {
        // Auto-cleanup expired timeout
        await prisma.timeout.delete({
            where: { id: timeout.id }
        });
        return { isTimedOut: false };
    }

    return { isTimedOut: true, timeout };
}

module.exports = {
    isServerOwner,
    isUserBanned,
    isUserTimedOut
};
