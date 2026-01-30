const prisma = require('../utils/prisma');

const createChannel = async (req, res) => {
    try {
        const { name } = req.body;
        const { serverId } = req.params;
        const userId = req.user.id; // From auth middleware

        if (!name || name.trim() === '') {
            return res.status(400).json({ message: "Channel name is required" });
        }

        const serverIdInt = parseInt(serverId);
        if (isNaN(serverIdInt)) {
            return res.status(400).json({ message: "Invalid server ID" });
        }

        // Check if user is OWNER or ADMIN of the server
        const member = await prisma.serverMember.findUnique({
            where: {
                userId_serverId: {
                    userId,
                    serverId: serverIdInt,
                },
            },
        });

        if (!member) {
            return res.status(404).json({ message: "Server not found or you are not a member" });
        }

        if (member.role !== 'OWNER' && member.role !== 'ADMIN') {
            return res.status(403).json({ message: "Only Owner or Admin can create channels" });
        }

        // Create channel
        // Unique constraint on [serverId, name] will handle duplicates
        const channel = await prisma.channel.create({
            data: {
                name: name.trim(),
                serverId: serverIdInt,
                type: 'TEXT', // Default for now
            },
        });

        // Broadcast channel creation to all connected clients
        const io = req.app.get('io');
        if (io) {
            io.emit('CHANNEL_CREATED', {
                channel,
                serverId: serverIdInt
            });
        }

        res.status(201).json({
            message: "Channel created successfully",
            channel,
        });
    } catch (err) {
        if (err.code === 'P2002') { // Unique constraint violation
            return res.status(409).json({ message: "Channel with this name already exists in this server" });
        }
        console.error("Create channel error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};

const getChannelsByServer = async (req, res) => {
    try {
        const { serverId } = req.params;
        const userId = req.user.id;

        const serverIdInt = parseInt(serverId);
        if (isNaN(serverIdInt)) {
            return res.status(400).json({ message: "Invalid server ID" });
        }

        // Check if user is a MEMBER of the server
        const member = await prisma.serverMember.findUnique({
            where: {
                userId_serverId: {
                    userId,
                    serverId: serverIdInt,
                },
            },
        });

        if (!member) {
            return res.status(403).json({ message: "You must be a member of the server to view channels" });
        }

        const channels = await prisma.channel.findMany({
            where: { serverId: serverIdInt },
            orderBy: { createdAt: 'asc' },
        });

        res.status(200).json({ channels });
    } catch (err) {
        console.error("Get channels error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};

const deleteChannel = async (req, res) => {
    try {
        const { channelId } = req.params;
        const userId = req.user.id;

        const channelIdInt = parseInt(channelId);
        if (isNaN(channelIdInt)) {
            return res.status(400).json({ message: "Invalid channel ID" });
        }

        // Find channel to get serverId
        const channel = await prisma.channel.findUnique({
            where: { id: channelIdInt },
        });

        if (!channel) {
            return res.status(404).json({ message: "Channel not found" });
        }

        // Check permissions (Owner/Admin of the server)
        const member = await prisma.serverMember.findUnique({
            where: {
                userId_serverId: {
                    userId,
                    serverId: channel.serverId,
                },
            },
        });

        if (!member || (member.role !== 'OWNER' && member.role !== 'ADMIN')) {
            return res.status(403).json({ message: "You do not have permission to delete this channel" });
        }

        await prisma.channel.delete({
            where: { id: channelIdInt },
        });

        // Broadcast channel deletion to all connected clients via WebSocket
        const io = req.app.get('io');
        if (io) {
            io.emit('CHANNEL_DELETED', {
                channelId: channelIdInt,
                serverId: channel.serverId
            });
        }

        res.status(200).json({ message: "Channel deleted successfully" });
    } catch (err) {
        console.error("Delete channel error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = {
    createChannel,
    getChannelsByServer,
    deleteChannel,
};
