const { Server } = require('socket.io');
const socketAuthMiddleware = require('./socket.auth');
const registerSocketEvents = require('./socket.events');
const { addUserSession } = require('../redis/presence');

const initSocket = (httpServer) => {
    const io = new Server(httpServer, {
        cors: {
            origin: "http://localhost:5173", // Allow frontend
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    // Apply Auth Middleware
    io.use(socketAuthMiddleware);

    io.on('connection', async (socket) => {
        console.log(`Socket connected: ${socket.id} (User: ${socket.user.username})`);

        // Track user presence in Redis
        try {
            await addUserSession(socket.id, socket.user.id);
            console.log(`User ${socket.user.id} (${socket.user.username}) presence tracked`);
        } catch (err) {
            console.error('Failed to track user presence:', err);
        }

        // Register Events
        registerSocketEvents(io, socket);
    });

    return io;
};

module.exports = initSocket;
