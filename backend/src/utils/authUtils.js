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
 * Middleware to require server ownership
 * Usage: ServerRouter.post('/:serverId/action', usermiddleware, requireServerOwner, handler);
 */
async function requireServerOwner(req, res, next) {
    try {
        const userId = req.user.id;
        const serverId = parseInt(req.params.id || req.params.serverId);

        if (isNaN(serverId)) {
            return res.status(400).json({ message: "Invalid server ID" });
        }

        const isOwner = await isServerOwner(userId, serverId);

        if (!isOwner) {
            return res.status(403).json({ message: "Only the server owner can perform this action" });
        }

        // Store serverId in request for use in controller
        req.serverId = serverId;
        next();
    } catch (err) {
        console.error("requireServerOwner middleware error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
}

/**
 * Check if a user can manage another member
 * Owner can manage anyone, even admins
 * @param {number} userId - The user ID performing the action
 * @param {number} serverId - The server ID
 * @param {number} targetUserId - The target user ID
 * @returns {Promise<{canManage: boolean, reason?: string}>}
 */
async function canManageMember(userId, serverId, targetUserId) {
    // Cannot manage yourself
    if (userId === targetUserId) {
        return { canManage: false, reason: "You cannot perform this action on yourself" };
    }

    // Check if user is owner
    const isOwner = await isServerOwner(userId, serverId);

    if (!isOwner) {
        return { canManage: false, reason: "Only the server owner can manage members" };
    }

    // Check if target is also owner (cannot manage the owner)
    const targetIsOwner = await isServerOwner(targetUserId, serverId);
    if (targetIsOwner) {
        return { canManage: false, reason: "Cannot perform this action on the server owner" };
    }

    // Owner can manage all non-owner members
    return { canManage: true };
}

/**
 * Create an audit log entry
 * @param {number} serverId - Server ID
 * @param {string} action - Action type (KICK, BAN, TIMEOUT, etc.)
 * @param {number} performedBy - User ID who performed the action
 * @param {number?} targetUserId - Target user ID (optional)
 * @param {object?} details - Additional details (optional)
 * @returns {Promise<AuditLog>}
 */
async function createAuditLog(serverId, action, performedBy, targetUserId = null, details = null) {
    return await prisma.auditLog.create({
        data: {
            serverId,
            action,
            performedBy,
            targetUserId,
            details: details ? JSON.stringify(details) : null
        }
    });
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
    requireServerOwner,
    canManageMember,
    createAuditLog,
    isUserBanned,
    isUserTimedOut
};
