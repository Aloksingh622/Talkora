const prisma = require('../utils/prisma');
const { isServerOwner } = require('../utils/authUtils');

/**
 * Get audit logs for a server
 * GET /servers/:id/audit-logs
 */
const getAuditLogs = async (req, res) => {
    try {
        const userId = req.user.id;
        const serverId = parseInt(req.params.id);
        const { page = 1, limit = 50, action } = req.query;

        if (isNaN(serverId)) {
            return res.status(400).json({ message: "Invalid server ID" });
        }

        // Check ownership
        const isOwner = await isServerOwner(userId, serverId);
        if (!isOwner) {
            return res.status(403).json({ message: "Only the server owner can view audit logs" });
        }

        const pageInt = parseInt(page);
        const limitInt = Math.min(parseInt(limit), 100); // Max 100 per page
        const skip = (pageInt - 1) * limitInt;

        const whereClause = { serverId };
        if (action) {
            whereClause.action = action;
        }

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where: whereClause,
                include: {
                    performedByUser: {
                        select: {
                            id: true,
                            username: true,
                            avatar: true
                        }
                    },
                    targetUser: {
                        select: {
                            id: true,
                            username: true,
                            avatar: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitInt
            }),
            prisma.auditLog.count({ where: whereClause })
        ]);

        // Parse details JSON
        const logsWithParsedDetails = logs.map(log => ({
            ...log,
            details: log.details ? JSON.parse(log.details) : null
        }));

        res.status(200).json({
            logs: logsWithParsedDetails,
            pagination: {
                page: pageInt,
                limit: limitInt,
                total,
                totalPages: Math.ceil(total / limitInt)
            }
        });
    } catch (err) {
        console.error("Get audit logs error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = {
    getAuditLogs
};
