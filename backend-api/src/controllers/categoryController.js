const prisma = require('../utils/prisma');

const createCategory = async (req, res) => {
    try {
        const { name } = req.body;
        const { serverId } = req.params;
        const userId = req.user.id;

        if (!name || name.trim() === '') {
            return res.status(400).json({ message: "Category name is required" });
        }

        const serverIdInt = parseInt(serverId);
        if (isNaN(serverIdInt)) {
            return res.status(400).json({ message: "Invalid server ID" });
        }

        // Check permissions (Owner/Admin)
        const member = await prisma.serverMember.findUnique({
            where: {
                userId_serverId: {
                    userId,
                    serverId: serverIdInt,
                },
            },
        });

        if (!member || (member.role !== 'OWNER' && member.role !== 'ADMIN')) {
            return res.status(403).json({ message: "Only Owner or Admin can create categories" });
        }

        const category = await prisma.category.create({
            data: {
                name: name.trim(),
                serverId: serverIdInt,
                order: 0, // Default order, can be updated later
            },
        });

        const io = req.app.get('io');
        if (io) {
            io.emit('CATEGORY_CREATED', {
                category,
                serverId: serverIdInt
            });
        }

        res.status(201).json({ category });
    } catch (err) {
        console.error("Create category error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};

const getCategories = async (req, res) => {
    try {
        const { serverId } = req.params;
        const serverIdInt = parseInt(serverId);

        if (isNaN(serverIdInt)) {
            return res.status(400).json({ message: "Invalid server ID" });
        }

        const categories = await prisma.category.findMany({
            where: { serverId: serverIdInt },
            orderBy: { createdAt: 'asc' }, // Or order field if I implement it fully
            include: {
                channels: true
            }
        });

        res.status(200).json({ categories });
    } catch (err) {
        console.error("Get categories error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};

const updateCategory = async (req, res) => {
    try {
        const { categoryId } = req.params;
        const { name } = req.body;
        const userId = req.user.id;

        const categoryIdInt = parseInt(categoryId);
        if (isNaN(categoryIdInt)) {
            return res.status(400).json({ message: "Invalid category ID" });
        }

        const category = await prisma.category.findUnique({ where: { id: categoryIdInt } });
        if (!category) return res.status(404).json({ message: "Category not found" });

        // Check permissions (Owner/Admin)
        const member = await prisma.serverMember.findUnique({
            where: {
                userId_serverId: {
                    userId,
                    serverId: category.serverId,
                },
            },
        });

        if (!member || (member.role !== 'OWNER' && member.role !== 'ADMIN')) {
            return res.status(403).json({ message: "You do not have permission to update this category" });
        }

        const updatedCategory = await prisma.category.update({
            where: { id: categoryIdInt },
            data: { name: name.trim() }
        });

        const io = req.app.get('io');
        if (io) {
            io.emit('CATEGORY_UPDATED', {
                category: updatedCategory,
                serverId: category.serverId
            });
        }

        res.status(200).json({ category: updatedCategory });

    } catch (err) {
        console.error("Update category error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
}

const deleteCategory = async (req, res) => {
    try {
        const { categoryId } = req.params;
        const userId = req.user.id;

        const categoryIdInt = parseInt(categoryId);
        if (isNaN(categoryIdInt)) {
            return res.status(400).json({ message: "Invalid category ID" });
        }

        const category = await prisma.category.findUnique({ where: { id: categoryIdInt } });
        if (!category) return res.status(404).json({ message: "Category not found" });

        // Check permissions (Owner/Admin)
        const member = await prisma.serverMember.findUnique({
            where: {
                userId_serverId: {
                    userId,
                    serverId: category.serverId,
                },
            },
        });

        if (!member || (member.role !== 'OWNER' && member.role !== 'ADMIN')) {
            return res.status(403).json({ message: "You do not have permission to delete this category" });
        }

        // When deleting a category, we should probably set the categoryId of its channels to null (uncategorized)
        // Prisma `onDelete: SetNull` on the relation might handle this, but let's be explicit or check schema
        // Schema says: category   Category?  @relation(fields: [categoryId], references: [id], onDelete: SetNull)
        // So the DB handles it!

        await prisma.category.delete({
            where: { id: categoryIdInt }
        });

        const io = req.app.get('io');
        if (io) {
            io.emit('CATEGORY_DELETED', {
                categoryId: categoryIdInt,
                serverId: category.serverId
            });
        }

        res.status(200).json({ message: "Category deleted successfully" });

    } catch (err) {
        console.error("Delete category error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
}


module.exports = {
    createCategory,
    getCategories,
    updateCategory,
    deleteCategory
};
