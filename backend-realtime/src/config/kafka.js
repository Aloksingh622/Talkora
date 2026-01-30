const { Kafka } = require('kafkajs');

const kafka = new Kafka({
    clientId: 'discord-backend',
    brokers: ['localhost:9092', 'localhost:9093', 'localhost:9094'], 
});

module.exports = kafka;
