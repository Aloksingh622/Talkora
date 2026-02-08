const { Server } = require('socket.io');
const socketAuthMiddleware = require('./socket.auth');
const registerSocketEvents = require('./socket.events');
const { addUserSession } = require('../redis/presence');

const initSocket = (httpServer) => {
    const io = new Server(httpServer, {
        cors: {
            origin: "http://localhost:5173",
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    const { createAdapter } = require('@socket.io/redis-adapter');
    const { createClient } = require('redis');

    // Create dedicated Pub/Sub clients for the Adapter
    const pubClient = createClient({
        username: 'default',
        password: process.env.REDISPASS,
        socket: {
            host: 'redis-19553.crce179.ap-south-1-1.ec2.cloud.redislabs.com',
            port: process.env.REDISPORT
        }
    });

    const subClient = pubClient.duplicate();

    pubClient.on('error', (err) => console.error('Redis Pub Client Error:', err));
    subClient.on('error', (err) => console.error('Redis Sub Client Error:', err));

    pubClient.on('connect', () => console.log('Redis Pub Client connecting...'));
    subClient.on('connect', () => console.log('Redis Sub Client connecting...'));

    pubClient.on('ready', () => console.log('Redis Pub Client ready'));
    subClient.on('ready', () => console.log('Redis Sub Client ready'));

    const GATEWAY_ID = `gateway:${process.env.PORT || 3001}`;

    Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
        // IMPORTANT: Attach event listeners BEFORE creating adapter
        // so we can capture subscription events during adapter initialization

        // Debug: Log ALL Redis pub/sub activity with gateway identification
        subClient.on('message', (channel, message) => {
            try {
                // Try to parse and extract room info
                const parsed = JSON.parse(message);
                const room = parsed.rooms?.[0] || 'unknown';
                const event = parsed.data?.[0] || 'unknown';

                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log(`📨 [${GATEWAY_ID}] RECEIVED MESSAGE FROM REDIS`);
                console.log(`   └─ Channel: ${channel}`);
                console.log(`   └─ Room: ${room}`);
                console.log(`   └─ Event: ${event}`);
                console.log(`   └─ Time: ${new Date().toLocaleTimeString()}`);
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            } catch (e) {
                // If parsing fails, just log raw
                console.log(`[${GATEWAY_ID}] 📨 Message on channel "${channel}":`, message.substring(0, 150));
            }
        });

        subClient.on('pmessage', (pattern, channel, message) => {
            try {
                const parsed = JSON.parse(message);
                const room = parsed.rooms?.[0] || 'unknown';
                const event = parsed.data?.[0] || 'unknown';

                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log(`📨 [${GATEWAY_ID}] RECEIVED PATTERN MESSAGE FROM REDIS`);
                console.log(`   └─ Pattern: ${pattern}`);
                console.log(`   └─ Channel: ${channel}`);
                console.log(`   └─ Room: ${room}`);
                console.log(`   └─ Event: ${event}`);
                console.log(`   └─ Time: ${new Date().toLocaleTimeString()}`);
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            } catch (e) {
                console.log(`[${GATEWAY_ID}] 📨 Pattern message - pattern: "${pattern}", channel: "${channel}":`, message.substring(0, 150));
            }
        });

        subClient.on('subscribe', (channel, count) => {
            console.log(`[${GATEWAY_ID}] ✅ Subscribed to channel: "${channel}" (count: ${count})`);
        });

        subClient.on('psubscribe', (pattern, count) => {
            console.log(`[${GATEWAY_ID}] ✅ Pattern subscribed to: "${pattern}" (count: ${count})`);
        });

        // NOW create the adapter (this will trigger subscription events)
        const adapter = createAdapter(pubClient, subClient, {
            key: 'socket.io'
        });
        io.adapter(adapter);
        console.log(`✅ [${GATEWAY_ID}] Redis Adapter for Socket.IO connected successfully!`);

        // Debug: Check subscriptions after adapter initialization
        setTimeout(async () => {
            console.log(`[${GATEWAY_ID}] 🔍 Checking subscription state...`);
            try {
                // Try to get subscription info (this might not work with all Redis clients)
                const info = await subClient.sendCommand(['PUBSUB', 'CHANNELS', 'socket.io*']);
                console.log(`[${GATEWAY_ID}] 📋 Active channels matching "socket.io*":`, info);

                const patterns = await subClient.sendCommand(['PUBSUB', 'NUMPAT']);
                console.log(`[${GATEWAY_ID}] 📋 Number of pattern subscriptions:`, patterns);
            } catch (err) {
                console.log(`[${GATEWAY_ID}] ⚠️ Could not query subscription state:`, err.message);
            }
        }, 2000);
    }).catch(err => {
        console.error('❌ Redis Adapter connection FAILED:', err);
    });

    io.use(socketAuthMiddleware);

    io.on('connection', async (socket) => {
        const instanceId = `INSTANCE-${process.env.PORT || 3001}`;
        const port = process.env.PORT || 3001;

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`🔌 NEW CONNECTION`);
        console.log(`   └─ Instance: ${instanceId} (Port ${port})`);
        console.log(`   └─ Socket ID: ${socket.id}`);
        console.log(`   └─ User: ${socket.user.username} (ID: ${socket.user.id})`);
        console.log(`   └─ Time: ${new Date().toLocaleTimeString()}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        try {
            await addUserSession(socket.id, socket.user.id);
            console.log(`✅ User ${socket.user.id} (${socket.user.username}) presence tracked on ${instanceId}`);

            // 1. Join User Room (for receiving personalized events like Friend Requests, DM notifications, Presence updates)
            const userRoom = `user:${socket.user.id}`;
            socket.join(userRoom);
            console.log(`✅ User ${socket.user.id} joined personal room: ${userRoom}`);

            // 2. Broadcast ONLINE status to friends
            // We need to find all friends of this user to notify them
            const prisma = require('../utils/prisma');
            const friendships = await prisma.friendship.findMany({
                where: {
                    OR: [
                        { requesterId: socket.user.id },
                        { addresseeId: socket.user.id }
                    ],
                    status: 'ACCEPTED'
                }
            });

            // Extract friend IDs
            const friendIds = friendships.map(f =>
                f.requesterId === socket.user.id ? f.addresseeId : f.requesterId
            );

            // Emit to each friend's personal room
            if (friendIds.length > 0) {
                // We can emit to multiple rooms? No, io.to takes a room or list.
                // Ideally we emit to each friend room.
                friendIds.forEach(friendId => {
                    io.to(`user:${friendId}`).emit('PRESENCE_UPDATE', {
                        userId: socket.user.id,
                        status: 'online',
                        lastSeen: null
                    });
                });
                console.log(`📢 Broadcasted ONLINE status to ${friendIds.length} friends`);
            }

        } catch (err) {
            console.error('Failed to update presence/notify friends:', err);
        }

        registerSocketEvents(io, socket);
    });

    return io;
};

module.exports = initSocket;
