const { Kafka } = require('kafkajs');
const { Emitter } = require('@socket.io/redis-emitter');
const redis = require('redis');
require('dotenv').config();

const kafka = new Kafka({
    clientId: 'realtime-consumer',
    brokers: ['localhost:9092', 'localhost:9093', 'localhost:9094'],
});

const consumer = kafka.consumer({ groupId: 'realtime-group' });

// Redis connection for Emitter
// const  = createClient({
//     url: process.env.REDIS_URL
// });

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

const run = async () => {
    await redisClient.connect();
    console.log('Redis Emitter connected');

    // Debug: Log what we're publishing to Redis
    redisClient.on('ready', () => {
        console.log('[REDIS-EMITTER] Redis client ready for publishing');
    });

    // Debug: Intercept Redis PUBLISH to see exact channels used
    const originalPublish = redisClient.publish.bind(redisClient);
    redisClient.publish = async (channel, message) => {
        console.log(`[REDIS-EMITTER] 📤 Publishing to channel: "${channel}"`);
        return originalPublish(channel, message);
    };

    await consumer.connect();
    console.log('Realtime Consumer connected');

    await consumer.subscribe({ topic: 'channel.message', fromBeginning: false });
    await consumer.subscribe({ topic: 'dm.message', fromBeginning: false });

    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            const payload = JSON.parse(message.value.toString());
            console.log(`[REALTIME-CONSUMER] Broadcasting ${topic} - type: ${payload.type} to room:`,
                topic === 'channel.message' ? `channel:${payload.channelId}` : `dm:${payload.channelId}`);

            if (topic === 'channel.message') {
                // Handle different message types
                if (payload.type === 'NEW_MESSAGE') {
                    // Broadcast to channel room
                    const messageWithChannel = {
                        ...payload.payload,
                        channelId: payload.channelId
                    };
                    console.log(`[REALTIME-CONSUMER] Broadcasting message:`, JSON.stringify(messageWithChannel, null, 2));
                    io.to(`channel:${payload.channelId}`).emit('NEW_MESSAGE', messageWithChannel);
                    console.log(`[REALTIME-CONSUMER] Emitted NEW_MESSAGE to channel:${payload.channelId}`);
                }
                else if (payload.type === 'MESSAGE_EDITED') {
                    // Broadcast edited message
                    console.log(`[REALTIME-CONSUMER] Broadcasting MESSAGE_EDITED:`, payload.payload);
                    io.to(`channel:${payload.channelId}`).emit('MESSAGE_EDITED', payload.payload);
                    console.log(`[REALTIME-CONSUMER] Emitted MESSAGE_EDITED to channel:${payload.channelId}`);
                }
                else if (payload.type === 'MESSAGE_DELETED') {
                    // Broadcast deleted message
                    console.log(`[REALTIME-CONSUMER] Broadcasting MESSAGE_DELETED:`, payload.payload);
                    io.to(`channel:${payload.channelId}`).emit('MESSAGE_DELETED', payload.payload);
                    console.log(`[REALTIME-CONSUMER] Emitted MESSAGE_DELETED to channel:${payload.channelId}`);
                }
            } else if (topic === 'dm.message') {
                if (payload.type === 'NEW_DM') {
                    // Broadcast to DM room
                    const messageWithChannel = {
                        ...payload.payload,
                        channelId: payload.channelId
                    };
                    io.to(`dm:${payload.channelId}`).emit('NEW_DM', messageWithChannel);
                    console.log(`[REALTIME-CONSUMER] Emitted NEW_DM to dm:${payload.channelId}`);
                }
                else if (payload.type === 'EDIT_DM' || payload.type === 'MESSAGE_EDITED') {
                    console.log(`[REALTIME-CONSUMER] Broadcasting MESSAGE_EDITED (DM):`, payload.payload);
                    io.to(`dm:${payload.channelId}`).emit('MESSAGE_EDITED', payload.payload);
                }
                else if (payload.type === 'DELETE_DM' || payload.type === 'MESSAGE_DELETED') {
                    console.log(`[REALTIME-CONSUMER] Broadcasting MESSAGE_DELETED (DM):`, payload.payload);
                    io.to(`dm:${payload.channelId}`).emit('MESSAGE_DELETED', payload.payload);
                }
            }
        },
    });
};

run().catch(console.error);
