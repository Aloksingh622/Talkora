const { Kafka } = require('kafkajs');
const { Emitter } = require('@socket.io/redis-emitter');
const redis = require('redis');
require('dotenv').config();

const kafka = new Kafka({
    clientId: 'realtime-consumer',
    brokers: ['localhost:9092', 'localhost:9093', 'localhost:9094'],
});

const consumer = kafka.consumer({ groupId: 'realtime-group' });

const redisClient = redis.createClient({
    username: 'default',
    password: process.env.REDISPASS,
    socket: {
        host: 'redis-19553.crce179.ap-south-1-1.ec2.cloud.redislabs.com',
        port: process.env.REDISPORT
    }
});

const io = new Emitter(redisClient, {
    key: 'socket.io'
});

// Statistics for monitoring
const stats = {
    messagesProcessed: 0,
    messagesPublished: 0,
    messagesSkipped: 0,
    lastLogTime: Date.now()
};

/**
 * Get gateways that have active users in a room.
 */
async function getGatewaysForRoom(roomName) {
    try {
        const gateways = await redisClient.sMembers(`room:${roomName}:gateways`);
        return gateways || [];
    } catch (err) {
        console.error(`[ROOM-REGISTRY] Error getting gateways for ${roomName}:`, err);
        return null; // Return null on error to fall back to broadcast
    }
}

/**
 * Check if a room has any active gateways with users.
 */
async function shouldPublishToRoom(roomName) {
    const gateways = await getGatewaysForRoom(roomName);

    // If error occurred, fall back to broadcasting
    if (gateways === null) {
        console.log(`[TARGETED-PUBLISH] ⚠️ Error checking ${roomName} - falling back to broadcast`);
        stats.messagesPublished++;
        return { shouldPublish: true, gatewayCount: '?', gateways: null };
    }

    if (gateways.length === 0) {
        console.log(`[TARGETED-PUBLISH] ⏭️ Skipping ${roomName} - no active gateways`);
        stats.messagesSkipped++;
        return { shouldPublish: false, gatewayCount: 0, gateways: [] };
    }

    console.log(`[TARGETED-PUBLISH] ✅ Publishing to ${roomName} → ${gateways.length} gateway(s): [${gateways.join(', ')}]`);
    stats.messagesPublished++;
    return { shouldPublish: true, gatewayCount: gateways.length, gateways };
}

/**
 * Log statistics periodically (every 60 seconds)
 */
function logStats() {
    const now = Date.now();
    if (now - stats.lastLogTime >= 60000) {
        const total = stats.messagesPublished + stats.messagesSkipped;
        const savedPercent = total > 0 ? ((stats.messagesSkipped / total) * 100).toFixed(1) : 0;

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('[TARGETED-PUBLISH] 📊 Statistics (last 60s):');
        console.log(`   └─ Messages processed: ${stats.messagesProcessed}`);
        console.log(`   └─ Messages published: ${stats.messagesPublished}`);
        console.log(`   └─ Messages skipped:   ${stats.messagesSkipped}`);
        console.log(`   └─ Bandwidth saved:    ${savedPercent}%`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        stats.messagesProcessed = 0;
        stats.messagesPublished = 0;
        stats.messagesSkipped = 0;
        stats.lastLogTime = now;
    }
}

const run = async () => {
    console.log('[REALTIME-CONSUMER] Connecting to Redis...');
    try {
        await redisClient.connect();
        console.log('[REALTIME-CONSUMER] ✅ Redis Emitter connected');
        console.log('[REALTIME-CONSUMER] ✅ Smart Room Registry ENABLED');
    } catch (err) {
        console.error('[REALTIME-CONSUMER] ❌ Redis Connection Failed:', err);
        throw err;
    }

    redisClient.on('ready', () => {
        console.log('[REDIS-EMITTER] Redis client ready for publishing');
    });

    await consumer.connect();
    console.log('Realtime Consumer connected');

    await consumer.subscribe({ topic: 'channel.message', fromBeginning: false });
    await consumer.subscribe({ topic: 'dm.message', fromBeginning: false });

    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            const payload = JSON.parse(message.value.toString());
            stats.messagesProcessed++;

            const roomName = topic === 'channel.message'
                ? `channel:${payload.channelId}`
                : `dm:${payload.channelId}`;

            console.log(`[REALTIME-CONSUMER] Processing ${topic} - type: ${payload.type} for room: ${roomName}`);

            // Check if any gateways have users in this room
            const { shouldPublish, gatewayCount } = await shouldPublishToRoom(roomName);

            if (!shouldPublish) {
                logStats();
                return;
            }

            if (topic === 'channel.message') {
                if (payload.type === 'NEW_MESSAGE') {
                    const messageWithChannel = {
                        ...payload.payload,
                        channelId: payload.channelId
                    };
                    io.to(roomName).emit('NEW_MESSAGE', messageWithChannel);
                    console.log(`[REALTIME-CONSUMER] ✅ Emitted NEW_MESSAGE to ${roomName} (${gatewayCount} gateways)`);
                }
                else if (payload.type === 'MESSAGE_EDITED') {
                    io.to(roomName).emit('MESSAGE_EDITED', payload.payload);
                    console.log(`[REALTIME-CONSUMER] ✅ Emitted MESSAGE_EDITED to ${roomName}`);
                }
                else if (payload.type === 'MESSAGE_DELETED') {
                    io.to(roomName).emit('MESSAGE_DELETED', payload.payload);
                    console.log(`[REALTIME-CONSUMER] ✅ Emitted MESSAGE_DELETED to ${roomName}`);
                }
            } else if (topic === 'dm.message') {
                if (payload.type === 'NEW_DM') {
                    const messageWithChannel = {
                        ...payload.payload,
                        channelId: payload.channelId
                    };
                    io.to(roomName).emit('NEW_DM', messageWithChannel);
                    console.log(`[REALTIME-CONSUMER] ✅ Emitted NEW_DM to ${roomName} (${gatewayCount} gateways)`);
                }
                else if (payload.type === 'EDIT_DM' || payload.type === 'MESSAGE_EDITED') {
                    io.to(roomName).emit('MESSAGE_EDITED', payload.payload);
                    console.log(`[REALTIME-CONSUMER] ✅ Emitted MESSAGE_EDITED (DM) to ${roomName}`);
                }
                else if (payload.type === 'DELETE_DM' || payload.type === 'MESSAGE_DELETED') {
                    io.to(roomName).emit('MESSAGE_DELETED', payload.payload);
                    console.log(`[REALTIME-CONSUMER] ✅ Emitted MESSAGE_DELETED (DM) to ${roomName}`);
                }
            }

            logStats();
        },
    });
};

run().catch(console.error);

