# Backend Realtime Service

Real-time WebSocket service for Discord clone application.

## 🎯 Purpose

Handles all real-time WebSocket connections using Socket.IO:
- Message sending/receiving
- Typing indicators
- User presence
- Channel join/leave events
- Direct messages

## 🚀 Features

- **Socket.IO** - WebSocket server
- **Redis Adapter** - Horizontal scaling across multiple instances
- **Kafka Producer** - Asynchronous message publishing
- **JWT Authentication** - Secure WebSocket connections
- **Rate Limiting** - Prevent spam
- **Presence Tracking** - Online/offline status

## 📦 Installation

```bash
npm install
```

## 🔧 Configuration

Create `.env` file with:

```env
PORT=3001
DATABASE_URL=your_postgresql_url
REDISPASS=your_redis_password
REDISPORT=your_redis_port
private_key=your_jwt_secret
```

## 🏃 Running

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

## 🏥 Health Check

```bash
curl http://localhost:3001/health
```

## 📡 WebSocket Events

### Client → Server:
- `JOIN_CHANNEL` - Join a channel room
- `LEAVE_CHANNEL` - Leave a channel room
- `SEND_MESSAGE` - Send message to channel
- `SEND_DM` - Send direct message
- `TYPING_START` - Start typing indicator
- `TYPING_STOP` - Stop typing indicator

### Server → Client:
- `NEW_MESSAGE` - New channel message
- `NEW_DM` - New direct message
- `TYPING` - User typing in channel
- `USER_ONLINE` - User came online
- `USER_OFFLINE` - User went offline

## 🔌 Dependencies

**Must be running:**
- PostgreSQL (database)
- Redis (pub/sub, presence, rate limiting)
- Kafka (message queue)

**Services:**
- Kafka brokers on ports 9092, 9093, 9094
- Redis on configured port
- Frontend on configured VITE_REALTIME_URL

## 📊 Architecture

```
Frontend (WebSocket)
     ↓
Realtime Service (port 3001)
     ├─ Socket.IO (WebSocket)
     ├─ Redis Adapter (pub/sub)
     ├─ Kafka Producer (async)
     ↓
Backend Consumer
     ├─ Saves to Database
     └─ Broadcasts via Redis
```

## 🔐 Security

- JWT validation on connection
- Rate limiting (5 messages / 10 seconds)
- Member verification before message send
- Ban/timeout checking

## 🎛️ Environment

- **Development**: `npm run dev` (nodemon with auto-restart)
- **Production**: `npm start` (node without restart)

## 📝 Notes

- This service handles ONLY WebSocket connections
- REST API is handled by separate `backend-api` service
- Supports horizontal scaling via Redis Adapter
- For 100K users, run 10+ instances behind load balancer

## 🐛 Debugging

Enable Socket.IO debug logs:
```bash
set DEBUG=socket.io:* && npm run dev
```

## 👥 Scaling

For multiple instances:
1. Run on different ports (3001, 3011, 3021...)
2. Use Nginx load balancer with `ip_hash`
3. Redis Adapter handles inter-instance communication

See `ecosystem.config.js` for PM2 configuration.
