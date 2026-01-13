const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const admin = require('firebase-admin');

const redisclient = require('./database/redis');
const AuthRouter = require('./routes/authRoutes');
const serviceAccount = require("../ServiceAccount.json");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Middleware
app.use(cors({
  origin: ["http://localhost:5173"],
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());

// Routes
app.use('/api/auth', AuthRouter);
const ServerRouter = require('./routes/serverRoutes');
app.use('/api/servers', ServerRouter);
const ChannelRouter = require('./routes/channelRoutes');
app.use('/api/channels', ChannelRouter);
const MessageRouter = require('./routes/messageRoutes');
app.use('/api', MessageRouter); // Mount at /api so routes are /api/channels/:id/messages
const PresenceRouter = require('./routes/presenceRoutes');
app.use('/api', PresenceRouter); // Mount at /api so routes are /api/users/:id/presence


const aiRouter = require("./routes/aiRoutes");
app.use("/api/ai", aiRouter);

app.get('/', (req, res) => {
  res.json({ message: 'Discord Clone Backend API is running' });
});



const http = require('http');
const initSocket = require('./realtime/socket');

const Initializationconnection = async () => {
  try {
    const server = http.createServer(app);

    // Initialize Socket.IO
    const io = initSocket(server);

    // Make io accessible to controllers
    app.set('io', io);

    await Promise.all([redisclient.connect()]);
    console.log("DB connected");
    server.listen(PORT, () => {
      console.log(" Server running on port", PORT);
    });
  }
  catch (err) {
    console.log("Error", err);
  }
}

Initializationconnection();
