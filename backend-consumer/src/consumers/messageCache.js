const { Kafka } = require('kafkajs');
const redis = require('redis');
require('dotenv').config();

const kafka = new Kafka({
    clientId: 'message-cache-consumer',
    brokers: ['localhost:9092', 'localhost:9093', 'localhost:9094'],
});

const consumer = kafka.consumer({ groupId: 'message-cache-group' });

const redisClient = redis.createClient({
    username: 'default',
    password: process.env.REDISPASS,
    // Using same Redis config as realtime.js
    socket: {
        host: 'redis-19553.crce179.ap-south-1-1.ec2.cloud.redislabs.com',
        port: process.env.REDISPORT
    }
});

const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 Days
const MAX_CACHE_SIZE = 100; // Keep extensive history for fast scrolling

const run = async () => {
    console.log('[CACHE-CONSUMER] Connecting to Redis...');
    try {
        await redisClient.connect();
        console.log('[CACHE-CONSUMER] ✅ Redis connected');
    } catch (err) {
        console.error('[CACHE-CONSUMER] ❌ Redis Connection Failed:', err);
        throw err;
    }

    await consumer.connect();
    console.log('[CACHE-CONSUMER] ✅ Kafka Consumer connected');

    await consumer.subscribe({ topic: 'channel.message', fromBeginning: false });

    await consumer.run({
        eachBatchAutoResolve: false,
        eachBatch: async ({ batch, resolveOffset, heartbeat, isRunning, isStale }) => {
            console.log(`[CACHE-CONSUMER] Processing batch of ${batch.messages.length} messages`);

            const pipeline = redisClient.multi();
            let opCount = 0;

            for (const message of batch.messages) {
                if (!isRunning() || isStale()) break;

                try {
                    const payload = JSON.parse(message.value.toString());

                    // Only cache NEW_MESSAGE events
                    if (payload.type === 'NEW_MESSAGE') {
                        const msg = payload.payload;
                        const channelId = payload.channelId;
                        const cacheKey = `channel:${channelId}:messages`;

                        // 1. Add to Sorted Set (Score = Timestamp)
                        // Using createdAt as score ensures correct time-ordering
                        const score = new Date(msg.createdAt).getTime();

                        pipeline.zAdd(cacheKey, {
                            score: score,
                            value: JSON.stringify(msg)
                        });

                        // 2. Trim to max size (Keep newest 100)
                        // ZREMRANGEBYRANK key 0 -(MAX+1) 
                        // Removes strictly the oldest elements, keeping the top MAX
                        pipeline.zRemRangeByRank(cacheKey, 0, -(MAX_CACHE_SIZE + 1));

                        // 3. Set Expiry (Refresh TTL on every write)
                        pipeline.expire(cacheKey, CACHE_TTL_SECONDS);

                        opCount++;
                    }

                    resolveOffset(message.offset);
                } catch (err) {
                    console.error(`[CACHE-CONSUMER] Error processing message:`, err);
                }
            }

            if (opCount > 0) {
                try {
                    await pipeline.exec();
                    console.log(`[CACHE-CONSUMER] 💾 Cached ${opCount} messages to Redis (Ready for API)`);
                } catch (err) {
                    console.error('[CACHE-CONSUMER] Redis Pipeline Failed:', err);
                }
            }

            await heartbeat();
        },
    });
};

run().catch(console.error);
