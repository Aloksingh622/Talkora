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

    Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
        // IMPORTANT: Attach event listeners BEFORE creating adapter
        // so we can capture subscription events during adapter initialization

        // Debug: Log ALL Redis pub/sub activity
        subClient.on('message', (channel, message) => {
            console.log(`[REDIS-ADAPTER] 📨 Message on channel "${channel}":`, message.substring(0, 100));
        });

        subClient.on('pmessage', (pattern, channel, message) => {
            console.log(`[REDIS-ADAPTER] 📨 Pattern message - pattern: "${pattern}", channel: "${channel}":`, message.substring(0, 100));
        });

        subClient.on('subscribe', (channel, count) => {
            console.log(`[REDIS-ADAPTER] ✅ Subscribed to channel: "${channel}" (count: ${count})`);
        });

        subClient.on('psubscribe', (pattern, count) => {
            console.log(`[REDIS-ADAPTER] ✅ Pattern subscribed to: "${pattern}" (count: ${count})`);
        });

        // NOW create the adapter (this will trigger subscription events)
        const adapter = createAdapter(pubClient, subClient, {
            key: 'socket.io'
        });
        io.adapter(adapter);
        console.log('✅ Redis Adapter for Socket.IO connected successfully!');

        // Debug: Check subscriptions after adapter initialization
        setTimeout(async () => {
            console.log('[REDIS-ADAPTER] 🔍 Checking subscription state...');
            try {
                // Try to get subscription info (this might not work with all Redis clients)
                const info = await subClient.sendCommand(['PUBSUB', 'CHANNELS', 'socket.io*']);
                console.log('[REDIS-ADAPTER] 📋 Active channels matching "socket.io*":', info);

                const patterns = await subClient.sendCommand(['PUBSUB', 'NUMPAT']);
                console.log('[REDIS-ADAPTER] 📋 Number of pattern subscriptions:', patterns);
            } catch (err) {
                console.log('[REDIS-ADAPTER] ⚠️ Could not query subscription state:', err.message);
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
        } catch (err) {
            console.error('Failed to track user presence:', err);
        }

        registerSocketEvents(io, socket);
    });

    return io;
};

module.exports = initSocket;
