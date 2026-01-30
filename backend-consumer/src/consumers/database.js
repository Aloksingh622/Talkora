const { Kafka } = require('kafkajs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const kafka = new Kafka({
    clientId: 'db-consumer',
    brokers: ['localhost:9092', 'localhost:9093', 'localhost:9094'],
});

const consumer = kafka.consumer({ groupId: 'database-group' });

const run = async () => {
    await consumer.connect();
    console.log('DB Consumer connected');

    await consumer.subscribe({ topic: 'channel.message', fromBeginning: false });
    await consumer.subscribe({ topic: 'dm.message', fromBeginning: false });

    await consumer.run({
        eachBatchAutoResolve: false, // We will manually resolve offsets
        eachBatch: async ({ batch, resolveOffset, heartbeat, isRunning, isStale }) => {
            console.log(`[DB-CONSUMER] Processing batch of ${batch.messages.length} messages for topic ${batch.topic}`);

            const channelMessages = [];
            const dmMessages = [];

            for (const message of batch.messages) {
                if (!isRunning() || isStale()) break;

                try {
                    const payload = JSON.parse(message.value.toString());

                    if (batch.topic === 'channel.message') {
                        if (payload.type === 'NEW_MESSAGE') {
                            // Just Save (expecting ID in payload now)
                            channelMessages.push({
                                id: payload.payload.id,
                                content: payload.payload.content,
                                fileUrl: payload.payload.fileUrl,
                                fileType: payload.payload.fileType,
                                fileName: payload.payload.fileName,
                                userId: payload.payload.user.id,
                                channelId: payload.channelId,
                                createdAt: payload.payload.createdAt
                            });
                        }
                    } else if (batch.topic === 'dm.message') {
                        if (payload.type === 'NEW_DM') {
                            // Just Save (expecting ID in payload now)
                            dmMessages.push({
                                id: payload.payload.id,
                                content: payload.payload.content,
                                fileUrl: payload.payload.fileUrl,
                                fileType: payload.payload.fileType,
                                fileName: payload.payload.fileName,
                                senderId: payload.payload.senderId,
                                channelId: payload.channelId,
                                isRead: false,
                                createdAt: payload.payload.createdAt
                            });
                        }
                    }

                    // Mark offset as resolved (processed)
                    resolveOffset(message.offset);
                } catch (err) {
                    console.error(`[DB-CONSUMER] Error processing message in batch:`, err);
                }
            }

            // Bulk Insert Channel Messages
            if (channelMessages.length > 0) {
                try {
                    await prisma.message.createMany({
                        data: channelMessages,
                        skipDuplicates: true
                    });
                    console.log(`[DB-CONSUMER] Bulk inserted ${channelMessages.length} channel messages`);
                } catch (error) {
                    console.error(`[DB-CONSUMER] Error bulk inserting channel messages:`, error);
                }
            }

            // Bulk Insert DM Messages
            if (dmMessages.length > 0) {
                try {
                    await prisma.directMessage.createMany({
                        data: dmMessages,
                        skipDuplicates: true
                    });
                    console.log(`[DB-CONSUMER] Bulk inserted ${dmMessages.length} DM messages`);
                } catch (error) {
                    console.error(`[DB-CONSUMER] Error bulk inserting DM messages:`, error);
                }
            }

            await heartbeat();
        },
    });
};

run().catch(console.error);
