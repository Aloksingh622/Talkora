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
const PORT = process.env.PORT || 3002;

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
const FriendRouter = require('./routes/friendRoutes');
app.use('/api/friends', FriendRouter);
const DMRouter = require('./routes/dmRoutes');
app.use('/api/dm', DMRouter);
const UploadRouter = require('./routes/uploadRoutes');
app.use('/api/upload', UploadRouter);

app.get('/', (req, res) => {
  res.json({
    message: 'Discord Clone REST API Service',
    version: '2.0.0',
    service: 'api'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'api',
    timestamp: new Date().toISOString()
  });
});

const Initializationconnection = async () => {
  try {
    // Connect to Redis
    await redisclient.connect();
    console.log('✅ Redis connected');

    // Start server
    app.listen(PORT, () => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🌐 API Service running');
      console.log(`📡 Port: ${PORT}`);
      console.log(`🏥 Health: http://localhost:${PORT}/health`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });
  }
  catch (err) {
    console.error('❌ Startup error:', err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  try {
    await redisclient.quit();
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
});

Initializationconnection();
