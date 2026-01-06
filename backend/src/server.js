const http = require('http');
const app = require('./app');
const dotenv = require('dotenv');
const redisclient = require('./database/redis')
const initializeSocket = require('./socket');
const admin = require('firebase-admin');
const serviceAccount = require("../ServiceAccount.json")

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

dotenv.config();

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);
const io = initializeSocket(server);

app.set('io', io);

const Initializationconnection = async () => {
  try {
    await Promise.all([redisclient.connect()]);
    console.log("DB connected")
    app.listen(PORT, () => {
      console.log(" Server running on port", PORT);
    });
  }
  catch (err) {
    console.log("Error", err)
  }
}

Initializationconnection();
