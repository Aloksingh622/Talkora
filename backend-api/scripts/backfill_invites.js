const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfillInvites() {
    console.log("Starting backfill of invite codes...");
    try {
        const servers = await prisma.server.findMany({
            where: { inviteCode: null }
        });

        console.log(`Found ${servers.length} servers without invite codes.`);

        for (const server of servers) {
            // Generate a simple 10-char random string
            const inviteCode = Math.random().toString(36).substring(2, 12);
            await prisma.server.update({
                where: { id: server.id },
                data: { inviteCode }
            });
            console.log(`Updated server ${server.name} with code: ${inviteCode}`);
        }

        console.log("Backfill complete.");
    } catch (err) {
        console.error("Backfill failed:", err);
    } finally {
        await prisma.$disconnect();
    }
}

backfillInvites();
