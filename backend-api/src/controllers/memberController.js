const prisma = require('../utils/prisma');
const { canManageMember, createAuditLog, isServerOwner } = require('../utils/authUtils');

/**
 * Kick a member from the server
 * POST /servers/:id/members/:userId/kick
 */
const kickMember = async (req, res) => {
    try {
        const ownerId = req.user.id;
        const serverId = parseInt(req.params.id);
        const targetUserId = parseInt(req.params.userId);

        if (isNaN(serverId) || isNaN(targetUserId)) {
            return res.status(400).json({ message: "Invalid server or user ID" });
        }

        // Check if user can manage this member
        const { canManage, reason } = await canManageMember(ownerId, serverId, targetUserId);
        if (!canManage) {
            return res.status(403).json({ message: reason });
        }

        // Check if target is a member
        const membership = await prisma.serverMember.findUnique({
            where: {
                userId_serverId: {
                    userId: targetUserId,
                    serverId
                }
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        avatar: true
                    }
                }
            }
        });

        if (!membership) {
            return res.status(404).json({ message: "User is not a member of this server" });
        }

        // Remove member
        await prisma.serverMember.delete({
            where: {
                userId_serverId: {
                    userId: targetUserId,
                    serverId
                }
            }
        });

        // Create audit log
        await createAuditLog(serverId, 'KICK', ownerId, targetUserId, {
            username: membership.user.username
        });

        // Broadcast via WebSocket
        const io = req.app.get('io');
        if (io) {
            io.emit('MEMBER_KICKED', {
                serverId,
                userId: targetUserId
            });
        }

        res.status(200).json({
            message: "Member kicked successfully",
            user: membership.user
        });
    } catch (err) {
        console.error("Kick member error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};

/**
 * Ban a member from the server
 * POST /servers/:id/members/:userId/ban
 * Body: { reason?: string, deleteMessages?: boolean }
 */
const banMember = async (req, res) => {
    try {
        const ownerId = req.user.id;
        const serverId = parseInt(req.params.id);
        const targetUserId = parseInt(req.params.userId);
        const { reason, deleteMessages } = req.body;

        if (isNaN(serverId) || isNaN(targetUserId)) {
            return res.status(400).json({ message: "Invalid server or user ID" });
        }

        // Check if user can manage this member
        const { canManage, reason: cannotManageReason } = await canManageMember(ownerId, serverId, targetUserId);
        if (!canManage) {
            return res.status(403).json({ message: cannotManageReason });
        }

        // Check if already banned
        const existingBan = await prisma.ban.findUnique({
            where: {
                userId_serverId: {
                    userId: targetUserId,
                    serverId
                }
            }
        });

        if (existingBan) {
            return res.status(400).json({ message: "User is already banned" });
        }

        // Get user info before banning
        const membership = await prisma.serverMember.findUnique({
            where: {
                userId_serverId: {
                    userId: targetUserId,
                    serverId
                }
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        avatar: true
                    }
                }
            }
        });

        // Execute ban in transaction
        await prisma.$transaction(async (tx) => {
            // Create ban record
            await tx.ban.create({
                data: {
                    userId: targetUserId,
                    serverId,
                    reason,
                    bannedBy: ownerId
                }
            });

            // DON'T delete ServerMember - keep them in server
            // They will stay in member list but can't message or see new messages

            // Delete messages if requested
            if (deleteMessages) {
                // Get all channels in the server
                const channels = await tx.channel.findMany({
                    where: { serverId },
                    select: { id: true }
                });

                const channelIds = channels.map(c => c.id);

                // Delete all messages from this user in server channels
                await tx.message.deleteMany({
                    where: {
                        userId: targetUserId,
                        channelId: { in: channelIds }
                    }
                });
            }
        });

        // Create audit log
        await createAuditLog(serverId, 'BAN', ownerId, targetUserId, {
            username: membership?.user?.username || 'Unknown',
            reason,
            deleteMessages
        });

        // Broadcast via WebSocket
        const io = req.app.get('io');
        if (io) {
            io.emit('MEMBER_BANNED', {
                serverId,
                userId: targetUserId,
                deleteMessages
            });
        }

        res.status(200).json({
            message: "Member banned successfully",
            user: membership?.user
        });
    } catch (err) {
        console.error("Ban member error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};

/**
 * Unban a member
 * DELETE /servers/:id/bans/:userId
 */
const unbanMember = async (req, res) => {
    try {
        const ownerId = req.user.id;
        const serverId = parseInt(req.params.id);
        const targetUserId = parseInt(req.params.userId);

        if (isNaN(serverId) || isNaN(targetUserId)) {
            return res.status(400).json({ message: "Invalid server or user ID" });
        }

        // Check ownership
        const isOwner = await isServerOwner(ownerId, serverId);
        if (!isOwner) {
            return res.status(403).json({ message: "Only the server owner can unban members" });
        }

        // Check if user is banned
        const ban = await prisma.ban.findUnique({
            where: {
                userId_serverId: {
                    userId: targetUserId,
                    serverId
                }
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        avatar: true
                    }
                }
            }
        });

        if (!ban) {
            return res.status(404).json({ message: "User is not banned" });
        }

        // Remove ban
        await prisma.ban.delete({
            where: {
                userId_serverId: {
                    userId: targetUserId,
                    serverId
                }
            }
        });

        // Create audit log
        await createAuditLog(serverId, 'UNBAN', ownerId, targetUserId, {
            username: ban.user.username
        });

        // Broadcast via WebSocket
        const io = req.app.get('io');
        if (io) {
            io.emit('MEMBER_UNBANNED', {
                serverId,
                userId: targetUserId
            });
        }

        res.status(200).json({
            message: "Member unbanned successfully",
            user: ban.user
        });
    } catch (err) {
        console.error("Unban member error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};

/**
 * Get all banned members
 * GET /servers/:id/bans
 */
const getBannedMembers = async (req, res) => {
    try {
        const userId = req.user.id;
        const serverId = parseInt(req.params.id);

        if (isNaN(serverId)) {
            return res.status(400).json({ message: "Invalid server ID" });
        }

        // Check ownership
        const isOwner = await isServerOwner(userId, serverId);
        if (!isOwner) {
            return res.status(403).json({ message: "Only the server owner can view bans" });
        }

        const bans = await prisma.ban.findMany({
            where: { serverId },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        avatar: true
                    }
                },
                bannedByUser: {
                    select: {
                        id: true,
                        username: true
                    }
                }
            },
            orderBy: { bannedAt: 'desc' }
        });

        res.status(200).json({ bans });
    } catch (err) {
        console.error("Get banned members error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};

/**
 * Timeout a member
 * POST /servers/:id/members/:userId/timeout
 * Body: { duration: number (in seconds), reason?: string }
 */
const timeoutMember = async (req, res) => {
    try {
        const ownerId = req.user.id;
        const serverId = parseInt(req.params.id);
        const targetUserId = parseInt(req.params.userId);
        const { duration, reason } = req.body;

        if (isNaN(serverId) || isNaN(targetUserId) || !duration || isNaN(duration)) {
            return res.status(400).json({ message: "Invalid request. Duration is required." });
        }

        // Check if user can manage this member
        const { canManage, reason: cannotManageReason } = await canManageMember(ownerId, serverId, targetUserId);
        if (!canManage) {
            return res.status(403).json({ message: cannotManageReason });
        }

        // Check if member exists
        const membership = await prisma.serverMember.findUnique({
            where: {
                userId_serverId: {
                    userId: targetUserId,
                    serverId
                }
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        avatar: true
                    }
                }
            }
        });

        if (!membership) {
            return res.status(404).json({ message: "User is not a member of this server" });
        }

        const expiresAt = new Date(Date.now() + duration * 1000);

        // Create or update timeout
        const timeout = await prisma.timeout.upsert({
            where: {
                userId_serverId: {
                    userId: targetUserId,
                    serverId
                }
            },
            update: {
                expiresAt,
                reason,
                timedOutBy: ownerId
            },
            create: {
                userId: targetUserId,
                serverId,
                expiresAt,
                reason,
                timedOutBy: ownerId
            }
        });

        // Create audit log
        await createAuditLog(serverId, 'TIMEOUT', ownerId, targetUserId, {
            username: membership.user.username,
            duration,
            reason,
            expiresAt: expiresAt.toISOString()
        });

        // Broadcast via WebSocket
        const io = req.app.get('io');
        if (io) {
            io.emit('MEMBER_TIMED_OUT', {
                serverId,
                userId: targetUserId,
                expiresAt: expiresAt.toISOString()
            });
        }

        res.status(200).json({
            message: "Member timed out successfully",
            timeout,
            user: membership.user
        });
    } catch (err) {
        console.error("Timeout member error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};

/**
 * Remove timeout from a member
 * DELETE /servers/:id/members/:userId/timeout
 */
const removeTimeout = async (req, res) => {
    try {
        const ownerId = req.user.id;
        const serverId = parseInt(req.params.id);
        const targetUserId = parseInt(req.params.userId);

        if (isNaN(serverId) || isNaN(targetUserId)) {
            return res.status(400).json({ message: "Invalid server or user ID" });
        }

        // Check ownership
        const isOwner = await isServerOwner(ownerId, serverId);
        if (!isOwner) {
            return res.status(403).json({ message: "Only the server owner can remove timeouts" });
        }

        // Check if timeout exists
        const timeout = await prisma.timeout.findUnique({
            where: {
                userId_serverId: {
                    userId: targetUserId,
                    serverId
                }
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        avatar: true
                    }
                }
            }
        });

        if (!timeout) {
            return res.status(404).json({ message: "User is not timed out" });
        }

        // Remove timeout
        await prisma.timeout.delete({
            where: {
                userId_serverId: {
                    userId: targetUserId,
                    serverId
                }
            }
        });

        // Create audit log
        await createAuditLog(serverId, 'TIMEOUT_REMOVED', ownerId, targetUserId, {
            username: timeout.user.username
        });

        // Broadcast via WebSocket
        const io = req.app.get('io');
        if (io) {
            io.emit('TIMEOUT_REMOVED', {
                serverId,
                userId: targetUserId
            });
        }

        res.status(200).json({
            message: "Timeout removed successfully",
            user: timeout.user
        });
    } catch (err) {
        console.error("Remove timeout error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};

/**
 * Get all active timeouts
 * GET /servers/:id/timeouts
 */
const getActiveTimeouts = async (req, res) => {
    try {
        const userId = req.user.id;
        const serverId = parseInt(req.params.id);

        if (isNaN(serverId)) {
            return res.status(400).json({ message: "Invalid server ID" });
        }

        // Check ownership
        const isOwner = await isServerOwner(userId, serverId);
        if (!isOwner) {
            return res.status(403).json({ message: "Only the server owner can view timeouts" });
        }

        const timeouts = await prisma.timeout.findMany({
            where: {
                serverId,
                expiresAt: {
                    gt: new Date() // Only active timeouts
                }
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        avatar: true
                    }
                },
                timedOutByUser: {
                    select: {
                        id: true,
                        username: true
                    }
                }
            },
            orderBy: { expiresAt: 'asc' }
        });

        res.status(200).json({ timeouts });
    } catch (err) {
        console.error("Get active timeouts error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};

/**
 * Check if current user is banned or timed out in a server
 * GET /servers/:id/members/me/status
 */
const getMyMemberStatus = async (req, res) => {
    try {
        const userId = req.user.id;
        const serverId = parseInt(req.params.id);

        if (isNaN(serverId)) {
            return res.status(400).json({ message: "Invalid server ID" });
        }

        // Check if banned
        const ban = await prisma.ban.findUnique({
            where: {
                userId_serverId: {
                    userId,
                    serverId
                }
            }
        });

        // Check if timed out
        const timeout = await prisma.timeout.findUnique({
            where: {
                userId_serverId: {
                    userId,
                    serverId
                }
            }
        });

        // Check if timeout is still active
        let activeTimeout = null;
        if (timeout && timeout.expiresAt > new Date()) {
            activeTimeout = {
                expiresAt: timeout.expiresAt,
                reason: timeout.reason
            };
        }

        res.status(200).json({
            banned: !!ban,
            banReason: ban?.reason || null,
            bannedAt: ban?.bannedAt || null,
            timedOut: !!activeTimeout,
            timeout: activeTimeout
        });
    } catch (err) {
        console.error("Get my member status error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = {
    kickMember,
    banMember,
    unbanMember,
    getBannedMembers,
    timeoutMember,
    removeTimeout,
    getActiveTimeouts,
    getMyMemberStatus
};
