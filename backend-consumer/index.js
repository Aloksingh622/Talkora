const cluster = require('cluster');
require('dotenv').config();

// Reduced to 5 workers to stay under Redis connection limit (30 partitions / 5 = 6 partitions per worker)
const numWorkers = 1;

if (cluster.isPrimary) {
    console.log(`Master ${process.pid} is running`);
    console.log(`Forking ${numWorkers} workers for backend consumers...`);

    // Fork workers.
    for (let i = 0; i < numWorkers; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`worker ${worker.process.pid} died. Restarting...`);
        cluster.fork();
    });
} else {
    // Workers can share any TCP connection
    console.log(`Worker ${process.pid} started`);

    // Start Database Consumer
    try {
        require('./src/consumers/database');
    } catch (err) {
        console.error(`Worker ${process.pid} failed to start database consumer:`, err);
    }

    // Start Realtime Consumer
    try {
        require('./src/consumers/realtime');
    } catch (err) {
        console.error(`Worker ${process.pid} failed to start realtime consumer:`, err);
    }
}
