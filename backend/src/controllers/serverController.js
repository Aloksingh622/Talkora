const prisma = require('../utils/prisma');
const uploadOnCloudinary = require('../database/cloudinary');

const createServer = async (req, res) => {
    try {
        const { name, type } = req.body;
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
            iconUrl = `https://ui-avatars.com/api/?name=${name.replace(" ", "+")}&background=random`
        }

        // specific transaction to create server and add owner as member
        const server = await prisma.$transaction(async (prisma) => {
            const newServer = await prisma.server.create({
                data: {
                    name,
                    ownerId: userId,
                    icon: iconUrl,
                    type: type || 'FRIENDS', // Default to FRIENDS if not provided or invalid
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
        }));

        res.status(200).json({ servers });
    } catch (err) {
        console.error("Get my servers error:", err);
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

const leaveServer = async (req, res) => {
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

        const membership = await prisma.serverMember.findUnique({
            where: {
                userId_serverId: {
                    userId,
                    serverId
                }
            },
        });

        if (!membership) {
            return res.status(400).json({ message: "You are not a member of this server" });
        }

        if (membership.role === 'OWNER') {
            return res.status(403).json({ message: "Owners cannot leave their own server. Delete it instead." });
        }

        await prisma.serverMember.delete({
            where: {
                id: membership.id,
            },
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

        // Broadcast server deletion BEFORE deleting
        const io = req.app.get('io');
        if (io) {
            io.emit('SERVER_DELETED', {
                serverId: serverId,
                serverName: server.name
            });
        }

        // Prisma handles cascading delete for members if configured, but let's be safe or rely on schema cascade
        // Schema has `onDelete: Cascade` for members, so deleting server deletes members.
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
        console.log('=== GET SERVER MEMBERS START ===');
        console.log('Request params:', req.params);
        console.log('User ID:', req.user?.id);

        const { serverId } = req.params;
        const userId = req.user.id;
        const serverIdInt = parseInt(serverId);

        console.log('Parsed server ID:', serverIdInt);

        if (isNaN(serverIdInt)) {
            console.log('Invalid server ID');
            return res.status(400).json({ message: "Invalid server ID" });
        }

        // Check if user is a member
        console.log('Checking membership for user:', userId, 'server:', serverIdInt);
        const member = await prisma.serverMember.findUnique({
            where: {
                userId_serverId: {
                    userId,
                    serverId: serverIdInt
                }
            }
        });

        console.log('Member found:', member);

        if (!member) {
            console.log('User is not a member');
            return res.status(403).json({ message: "You must be a member to view members" });
        }

        // Get all members with user details
        console.log('Fetching all members...');
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

        console.log('Members found:', members.length);
        console.log('=== GET SERVER MEMBERS SUCCESS ===');
        res.status(200).json({ members });
    } catch (err) {
        console.error("=== GET SERVER MEMBERS ERROR ===");
        console.error("Error:", err);
        console.error("Error message:", err.message);
        console.error("Error stack:", err.stack);
        res.status(500).json({ message: "Internal server error", error: err.message });
    }
};

module.exports = {
    createServer,
    getMyServers,
    joinServer,
    leaveServer,
    deleteServer,
    getServerMembers,
};
