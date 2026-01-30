const http = require('http');
const express = require('express');
const dotenv = require('dotenv');

const initSocket = require('./realtime/socket');
const kafkaProducer = require('./kafka/producer');
const redisclient = require('./database/redis');

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3001;

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'realtime',
        timestamp: new Date().toISOString()
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'Discord Realtime Service',
        version: '1.0.0',
        websocket: 'Socket.IO'
    });
});

const start = async () => {
    try {
        console.log('🚀 Starting Realtime Service...');

        // Connect to Redis
        await redisclient.connect();
        console.log('✅ Redis connected');

        // Connect to Kafka
        await kafkaProducer.connect();
        console.log('✅ Kafka Producer connected');

        // Initialize Socket.IO
        const io = initSocket(server);
        console.log('✅ Socket.IO initialized');

        // Start server
        server.listen(PORT, () => {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🎯 Realtime Service running');
            console.log(`📡 Port: ${PORT}`);
            console.log(`🔢 Instance ID: INSTANCE-${PORT}`);
            console.log(`🌐 Health: http://localhost:${PORT}/health`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        });
    } catch (err) {
        console.error('❌ Startup error:', err);
        process.exit(1);
    }
};

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    try {
        await kafkaProducer.disconnect();
        await redisclient.quit();
        server.close(() => {
            console.log('✅ Server closed');
            process.exit(0);
        });
    } catch (err) {
        console.error('Error during shutdown:', err);
        process.exit(1);
    }
});

start();
