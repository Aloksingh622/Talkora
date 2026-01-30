const kafka = require('../config/kafka');
const { CompressionTypes } = require('kafkajs');

class KafkaProducer {
    constructor() {
        this.producer = kafka.producer();
        this.isConnected = false;
    }

    async connect() {
        if (!this.isConnected) {
            try {
                await this.producer.connect();
                this.isConnected = true;
                console.log('Kafka Producer connected');
            } catch (error) {
                console.error('Error connecting Kafka Producer:', error);
            }
        }
    }

    async send(topic, key, message) {
        if (!this.isConnected) {
            await this.connect();
        }
        try {
            await this.producer.send({
                topic,
                compression: CompressionTypes.GZIP,
                messages: [
                    {
                        key: key ? String(key) : undefined,
                        value: JSON.stringify(message)
                    },
                ],
            });
            // console.log(`Message sent to topic ${topic} with key ${key}`);
        } catch (error) {
            console.error(`Error sending message to ${topic}:`, error);
        }
    }

    async disconnect() {
        if (this.isConnected) {
            await this.producer.disconnect();
            this.isConnected = false;
            console.log('Kafka Producer disconnected');
        }
    }
}

// Export a singleton instance
module.exports = new KafkaProducer();
