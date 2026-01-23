const prisma = require('../utils/prisma');
const uploadOnCloudinary = require('../database/cloudinary');

const createServer = async (req, res) => {
    try {
        const { name, type, isPrivate } = req.body;
        const userId = req.user.id;
        const file = req.file;

        if (!name || name.trim() === '') {
            return res.status(400).json({ message: "Server name is required" });
        }

        let iconUrl = '';

        if (file) {
            const result = await uploadOnCloudinary(file.path);
            if (result) {
                iconUrl = result;
            }
        } else {
            // Default avatar if no image provided
            // Switch to diverse DiceBear collections for variety (Humans, Robots, etc.)
            const collections = ['adventurer', 'avataaars', 'big-ears', 'bottts', 'fun-emoji', 'lorelei', 'notionists', 'open-peeps', 'pixel-art'];
            const randomCollection = collections[Math.floor(Math.random() * collections.length)];
            iconUrl = `https://api.dicebear.com/9.x/${randomCollection}/svg?seed=${encodeURIComponent(name)}`
        }

        // Convert isPrivate to boolean (FormData sends strings)
        const isPrivateBoolean = isPrivate === 'true' || isPrivate === true;

        // specific transaction to create server and add owner as member
        const server = await prisma.$transaction(async (prisma) => {
            const newServer = await prisma.server.create({
                data: {
                    name,
                    ownerId: userId,
                    icon: iconUrl,
                    type: type || 'FRIENDS', // Default to FRIENDS if not provided or invalid
                    isPrivate: isPrivateBoolean,
                    inviteCode: Math.random().toString(36).substring(2, 12),
                },
            });

            await prisma.serverMember.create({
                data: {
                    userId: userId,
                    serverId: newServer.id,
                    role: 'OWNER',
                },
            });

            return newServer;
        });

        res.status(201).json({
            message: "Server created successfully",
            server,
        });
    } catch (err) {
        console.error("Create server error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};

const getMyServers = async (req, res) => {
    try {
        const userId = req.user.id;

        const memberships = await prisma.serverMember.findMany({
            where: { userId },
            include: {
                server: true,
            },
        });

        const servers = memberships.map((membership) => ({
            id: membership.server.id,
            name: membership.server.name,
            icon: membership.server.icon,
            type: membership.server.type,
            role: membership.role,
            ownerId: membership.server.ownerId,
            inviteCode: membership.server.inviteCode,
        }));

        res.status(200).json({ servers });
    } catch (err) {
        console.error("Get my servers error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};

const searchServers = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query || query.trim() === '') {
            return res.status(400).json({ message: "Search query is required" });
        }

        const servers = await prisma.server.findMany({
            where: {
                name: {
                    contains: query,
                    mode: 'insensitive'
                },
                // Removed isPrivate: false filter to show private servers in search
            },
            take: 10,
            select: {
                id: true,
                name: true,
                icon: true,
                type: true,
                isPrivate: true, // Return privacy status
                _count: {
                    select: { members: true }
                }
            }
        });

        res.status(200).json({ servers });
    } catch (err) {
        console.error("Search servers error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};

const joinServer = async (req, res) => {
    try {
        const userId = req.user.id;
        const serverId = parseInt(req.params.id);

        if (isNaN(serverId)) {
            return res.status(400).json({ message: "Invalid server ID" });
        }

        const server = await prisma.server.findUnique({
            where: { id: serverId },
        });

        if (!server) {
            return res.status(404).json({ message: "Server not found" });
        }

        if (server.isPrivate) {
            return res.status(403).json({ message: "This server is private. You must request to join." });
        }

        // Check if user is banned from this server (CHECK FIRST, before member check)
        const ban = await prisma.ban.findUnique({
            where: {
                userId_serverId: {
                    userId,
                    serverId
                }
            }
        });

        if (ban) {
            return res.status(403).json({
                message: "You are banned from this server and cannot rejoin",
                bannedAt: ban.bannedAt,
                reason: ban.reason
            });
        }

        const existingMember = await prisma.serverMember.findUnique({
            where: {
                userId_serverId: {
                    userId,
                    serverId
                }
            },
        });

        if (existingMember) {
            return res.status(400).json({ message: "You are already a member of this server" });
        }

        await prisma.serverMember.create({
            data: {
                userId,
                serverId,
                role: 'MEMBER',
            },
        });

        res.status(200).json({ message: "Joined server successfully" });
    } catch (err) {
        console.error("Join server error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};

const requestJoinServer = async (req, res) => {
    try {
        const userId = req.user.id;
        const serverId = parseInt(req.params.id);

        if (isNaN(serverId)) {
            return res.status(400).json({ message: "Invalid server ID" });
        }

        const server = await prisma.server.findUnique({
            where: { id: serverId },
        });

        if (!server) {
            return res.status(404).json({ message: "Server not found" });
        }

        // Check if user is banned from this server (CHECK FIRST)
        const ban = await prisma.ban.findUnique({
            where: {
                userId_serverId: {
                    userId,
                    serverId
                }
            }
        });

        if (ban) {
            return res.status(403).json({
                message: "You are banned from this server and cannot request to join",
                bannedAt: ban.bannedAt,
                reason: ban.reason
            });
        }

        // Check if already member
        const existingMember = await prisma.serverMember.findUnique({
            where: { userId_serverId: { userId, serverId } },
        });

        if (existingMember) {
            return res.status(400).json({ message: "You are already a member of this server" });
        }

        // Check if already requested
        const existingRequest = await prisma.joinRequest.findUnique({
            where: { userId_serverId: { userId, serverId } },
        });

        if (existingRequest) {
            return res.status(400).json({ message: "You have already valid request pending" });
        }

        await prisma.joinRequest.create({
            data: {
                userId,
                serverId,
            }
        });

        res.status(200).json({ message: "Request sent successfully" });

    } catch (err) {
        console.error("Request join server error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};

const getJoinRequests = async (req, res) => {
    try {
        const userId = req.user.id;
        const serverId = parseInt(req.params.id);
        const { query } = req.query; // Search by username

        if (isNaN(serverId)) {
            return res.status(400).json({ message: "Invalid server ID" });
        }

        // Check permission (Owner only for now)
        const member = await prisma.serverMember.findUnique({
            where: { userId_serverId: { userId, serverId } },
        });

        if (!member || member.role !== 'OWNER') {
            return res.status(403).json({ message: "Only owner can view requests" });
        }

        const whereClause = {
            serverId,
            status: 'PENDING'
        };

        if (query) {
            whereClause.user = {
                username: {
                    contains: query,
                    mode: 'insensitive'
                }
            };
        }

        const requests = await prisma.joinRequest.findMany({
            where: whereClause,
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        avatar: true,
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json({ requests });

    } catch (err) {
        console.error("Get join requests error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};

const handleJoinRequest = async (req, res) => {
    try {
        const userId = req.user.id;
        const requestId = parseInt(req.params.requestId);
        const { status } = req.body; // 'APPROVED' or 'REJECTED'

        if (isNaN(requestId) || !['APPROVED', 'REJECTED'].includes(status)) {
            return res.status(400).json({ message: "Invalid request" });
        }

        const request = await prisma.joinRequest.findUnique({
            where: { id: requestId },
        });

        if (!request) {
            return res.status(404).json({ message: "Request not found" });
        }

        // Check permission (Owner)
        const member = await prisma.serverMember.findUnique({
            where: { userId_serverId: { userId, serverId: request.serverId } },
        });

        if (!member || member.role !== 'OWNER') {
            return res.status(403).json({ message: "Only owner can manage requests" });
        }

        if (status === 'APPROVED') {
            await prisma.$transaction([
                prisma.serverMember.create({
                    data: {
                        userId: request.userId,
                        serverId: request.serverId,
                        role: 'MEMBER'
                    }
                }),
                prisma.joinRequest.delete({
                    where: { id: requestId }
                })
            ]);
        } else {
            await prisma.joinRequest.delete({
                where: { id: requestId }
            });
        }

        res.status(200).json({ message: `Request ${status.toLowerCase()} successfully` });

    } catch (err) {
        console.error("Handle join request error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};


const leaveServer = async (req, res) => {
    try {
        const userId = req.user.id;
        const serverId = parseInt(req.params.id);

        if (isNaN(serverId)) {
            return res.status(400).json({ message: "Invalid server ID" });
        }

        const member = await prisma.serverMember.findUnique({
            where: {
                userId_serverId: {
                    userId,
                    serverId
                }
            },
            include: { server: true } // Include server to check ownerId
        });

        if (!member) {
            return res.status(404).json({ message: "You are not a member of this server" });
        }

        if (member.role === 'OWNER') {
            return res.status(400).json({ message: "Owner cannot leave the server. You must delete it or transfer ownership." });
        }

        await prisma.serverMember.delete({
            where: {
                userId_serverId: {
                    userId,
                    serverId
                }
            }
        });

        res.status(200).json({ message: "Left server successfully" });
    } catch (err) {
        console.error("Leave server error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};

const deleteServer = async (req, res) => {
    try {
        const userId = req.user.id;
        const serverId = parseInt(req.params.id);

        if (isNaN(serverId)) {
            return res.status(400).json({ message: "Invalid server ID" });
        }

        const server = await prisma.server.findUnique({
            where: { id: serverId },
        });

        if (!server) {
            return res.status(404).json({ message: "Server not found" });
        }

        if (server.ownerId !== userId) {
            return res.status(403).json({ message: "Only the owner can delete the server" });
        }

        await prisma.server.delete({
            where: { id: serverId },
        });

        res.status(200).json({ message: "Server deleted successfully" });
    } catch (err) {
        console.error("Delete server error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};

const getServerMembers = async (req, res) => {

    try {
        const { serverId } = req.params;
        const userId = req.user.id;
        const serverIdInt = parseInt(serverId);

        if (isNaN(serverIdInt)) {
            return res.status(400).json({ message: "Invalid server ID" });
        }

        // Check if user is a member
        const member = await prisma.serverMember.findUnique({
            where: {
                userId_serverId: {
                    userId,
                    serverId: serverIdInt
                }
            }
        });

        if (!member) {
            return res.status(403).json({ message: "You must be a member to view members" });
        }

        // Get all members with user details
        const members = await prisma.serverMember.findMany({
            where: { serverId: serverIdInt },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        avatar: true
                    }
                }
            },
            orderBy: { id: 'asc' }
        });

        res.status(200).json({ members });
    } catch (err) {
        console.error("=== GET SERVER MEMBERS ERROR ===");
        console.error("Error:", err);
        res.status(500).json({ message: "Internal server error", error: err.message });
    }
};

const getInvite = async (req, res) => {
    try {
        const { code } = req.params;
        const server = await prisma.server.findUnique({
            where: { inviteCode: code },
            select: {
                id: true,
                name: true,
                icon: true,
                isPrivate: true,
                _count: {
                    select: { members: true }
                }
            }
        });

        if (!server) {
            return res.status(404).json({ message: "Invalid invite code" });
        }

        res.status(200).json({ server });
    } catch (err) {
        console.error("Get invite error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};

/**
 * Update server settings (owner only)
 * PATCH /servers/:id/settings
 */
const updateServerSettings = async (req, res) => {
    try {
        const userId = req.user.id;
        const serverId = parseInt(req.params.id);
        const { name, type, isPrivate } = req.body;
        const file = req.file;

        if (isNaN(serverId)) {
            return res.status(400).json({ message: "Invalid server ID" });
        }

        const server = await prisma.server.findUnique({
            where: { id: serverId }
        });

        if (!server) {
            return res.status(404).json({ message: "Server not found" });
        }

        if (server.ownerId !== userId) {
            return res.status(403).json({ message: "Only the server owner can update settings" });
        }

        const updateData = {};

        if (name && name.trim() !== '') {
            updateData.name = name.trim();
        }

        if (type) {
            updateData.type = type;
        }

        if (typeof isPrivate === 'boolean' || isPrivate === 'true' || isPrivate === 'false') {
            updateData.isPrivate = isPrivate === true || isPrivate === 'true';
        }

        if (file) {
            const result = await uploadOnCloudinary(file.path);
            if (result) {
                updateData.icon = result;
            }
        }

        const updatedServer = await prisma.server.update({
            where: { id: serverId },
            data: updateData
        });

        // Broadcast update
        const io = req.app.get('io');
        if (io) {
            io.emit('SERVER_UPDATED', {
                serverId,
                server: updatedServer
            });
        }

        res.status(200).json({
            message: "Server settings updated successfully",
            server: updatedServer
        });
    } catch (err) {
        console.error("Update server settings error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};

/**
 * Transfer server ownership to another member
 * POST /servers/:id/transfer-ownership
 */
const transferOwnership = async (req, res) => {
    try {
        const currentOwnerId = req.user.id;
        const serverId = parseInt(req.params.id);
        const { newOwnerId } = req.body;

        if (isNaN(serverId) || !newOwnerId || isNaN(parseInt(newOwnerId))) {
            return res.status(400).json({ message: "Invalid request. New owner ID is required." });
        }

        const newOwnerIdInt = parseInt(newOwnerId);

        if (currentOwnerId === newOwnerIdInt) {
            return res.status(400).json({ message: "You are already the owner" });
        }

        const server = await prisma.server.findUnique({
            where: { id: serverId }
        });

        if (!server) {
            return res.status(404).json({ message: "Server not found" });
        }

        if (server.ownerId !== currentOwnerId) {
            return res.status(403).json({ message: "Only the server owner can transfer ownership" });
        }

        // Check if new owner is a member
        const newOwnerMembership = await prisma.serverMember.findUnique({
            where: {
                userId_serverId: {
                    userId: newOwnerIdInt,
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

        if (!newOwnerMembership) {
            return res.status(400).json({ message: "New owner must be a member of the server" });
        }

        // Transfer ownership in transaction
        await prisma.$transaction(async (tx) => {
            // Update server owner
            await tx.server.update({
                where: { id: serverId },
                data: { ownerId: newOwnerIdInt }
            });

            // Update new owner's role to OWNER
            await tx.serverMember.update({
                where: {
                    userId_serverId: {
                        userId: newOwnerIdInt,
                        serverId
                    }
                },
                data: { role: 'OWNER' }
            });

            // Update old owner's role to MEMBER
            await tx.serverMember.update({
                where: {
                    userId_serverId: {
                        userId: currentOwnerId,
                        serverId
                    }
                },
                data: { role: 'MEMBER' }
            });
        });

        // Broadcast ownership transfer
        const io = req.app.get('io');
        if (io) {
            io.emit('OWNERSHIP_TRANSFERRED', {
                serverId,
                oldOwnerId: currentOwnerId,
                newOwnerId: newOwnerIdInt
            });
        }

        res.status(200).json({
            message: "Ownership transferred successfully",
            newOwner: newOwnerMembership.user
        });
    } catch (err) {
        console.error("Transfer ownership error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = {
    createServer,
    getMyServers,
    searchServers,
    joinServer,
    leaveServer,
    deleteServer,
    getServerMembers,
    requestJoinServer,
    getJoinRequests,
    handleJoinRequest,
    getInvite,
    updateServerSettings,
    transferOwnership
};

