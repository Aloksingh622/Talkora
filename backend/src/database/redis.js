const redis = require('redis');
const dotenv=require('dotenv').config()

const redisclient=redis.createClient({
    username: 'default',
    password: process.env.REDISPASS,
    socket: {
        host: 'redis-19553.crce179.ap-south-1-1.ec2.cloud.redislabs.com',
        port: process.env.REDISPORT
    }
});


module.exports=redisclient;
