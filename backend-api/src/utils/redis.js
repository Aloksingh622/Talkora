const redis = require('redis');

// Redis Client Configuration
const redisClient = redis.createClient({
    username: 'default',
    password: process.env.REDISPASS,
    socket: {
        host: 'redis-19553.crce179.ap-south-1-1.ec2.cloud.redislabs.com',
        port: process.env.REDISPORT
    }
});

redisClient.on('error', (err) => console.log('[API-REDIS] Client Error', err));

// Connect immediately
(async () => {
    try {
        await redisClient.connect();
        console.log('[API-REDIS] Connected to Redis Cloud');
    } catch (err) {
        console.error('[API-REDIS] Connection Failed', err);
    }
})();

module.exports = redisClient;
