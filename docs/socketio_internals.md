# Socket.IO Architecture Deep Dive: WebSocket Storage, Adapter, and Emitter

## 🎯 Quick Answer

**Where WebSocket Objects Are Stored:**
- ❌ **NOT in Redis** - Redis only stores user presence/typing data
- ✅ **In Backend Memory** - Node.js process memory (RAM)
- ✅ **Socket.IO Internal Map** - `io.sockets.sockets` 

**What Each Component Does:**
- **Redis Adapter** = Backend **RECEIVES** messages from Redis → broadcasts to connected sockets
- **Redis Emitter** = Backend Consumer **SENDS** messages to Redis → other processes receive
- **Redis Pub/Sub** = The messaging channel that connects them

---

## 📦 Where WebSocket Objects Are Stored

### **1. Backend Memory (Node.js Process)**

When a user connects, Socket.IO creates a WebSocket object and stores it **in-memory**:

```javascript
// backend/src/server.js

const io = new Server(httpServer);

io.on('connection', (socket) => {
  // 'socket' is the WebSocket object
  // Stored in: io.sockets.sockets (a Map)
  
  console.log('Socket connected:', socket.id);
  // socket.id = "5XJACI1ro_dU0UpNAABC"
  
  // After authentication:
  socket.user = { id: 2, username: 'Paarth', avatar: '...' };
});
```

### **Internal Storage Structure:**

```javascript
// Socket.IO stores sockets in a Map:
io.sockets.sockets = Map {
  "5XJACI1ro_dU0UpNAABC" => Socket {
    id: "5XJACI1ro_dU0UpNAABC",
    user: { id: 2, username: 'Paarth' },
    rooms: Set { "5XJACI1ro_dU0UpNAABC", "channel:1" },
    connected: true,
    // ... many other properties
  },
  "9kL2pQwErT3yHjKlMnOp" => Socket {
    id: "9kL2pQwErT3yHjKlMnOp",
    user: { id: 1, username: 'alok' },
    rooms: Set { "9kL2pQwErT3yHjKlMnOp", "channel:1" },
    connected: true,
  }
}
```

### **Room Storage (Also In-Memory):**

```javascript
// Rooms are also stored in memory:
io.sockets.adapter.rooms = Map {
  "channel:1" => Set { "5XJACI1ro_dU0UpNAABC", "9kL2pQwErT3yHjKlMnOp" },
  "channel:2" => Set { "5XJACI1ro_dU0UpNAABC" },
  "5XJACI1ro_dU0UpNAABC" => Set { "5XJACI1ro_dU0UpNAABC" }, // Personal room
  "9kL2pQwErT3yHjKlMnOp" => Set { "9kL2pQwErT3yHjKlMnOp" }  // Personal room
}
```

**Note:** Each socket automatically joins a room with its own socket.id (personal room).

---

## 🔌 What We Store in Redis vs Memory

| Data | Storage Location | Why | Example |
|------|-----------------|-----|---------|
| **WebSocket Object** | Backend Memory | Too large, not serializable | `socket` object with connection state |
| **Socket ID** | Backend Memory | Temporary, changes on reconnect | `"5XJACI1ro_dU0UpNAABC"` |
| **Rooms** | Backend Memory | Managed by Socket.IO | `Map { "channel:1" => Set {...} }` |
| **User Presence** | Redis (TTL: 5 min) | Shared across backend instances | `presence:2 => { online: true }` |
| **Typing Indicators** | Redis (TTL: 5 sec) | Temporary, needs to expire | `typing:channel:1:2 => { ... }` |
| **Socket.IO Pub/Sub** | Redis (no TTL) | Real-time message passing | `socket.io#/#channel:1#` |

---

## 🔄 Redis Adapter vs Redis Emitter

### **Redis Adapter** (Backend Side - RECEIVER)

**Purpose:** Allows Socket.IO server to **receive** messages from Redis and broadcast to connected clients.

**Installation:**
```javascript
// backend/src/server.js
const { createAdapter } = require('@socket.io/redis-adapter');
const redis = require('redis');

const pubClient = redis.createClient({ url: 'redis://localhost:6379' });
const subClient = pubClient.duplicate();

io.adapter(createAdapter(pubClient, subClient));
```

**What It Does:**

1. **Subscribes to Redis Channels:**
   - Subscribes to patterns like `socket.io#/#channel:1#`
   - Listens for messages from Redis

2. **Broadcasts to Local Sockets:**
   - When message arrives from Redis → finds local sockets in that room → broadcasts to them

3. **Publishes Outgoing Messages:**
   - When backend calls `io.to('channel:1').emit()` → publishes to Redis
   - This allows other backend instances to receive and broadcast

**Flow:**
```
Backend Instance 1                  Redis                    Backend Instance 2
     │                               │                            │
     │──io.to('channel:1').emit()──▶│                            │
     │    (via Adapter)               │                            │
     │                               │────Pub/Sub Channel────────▶│
     │                               │  "socket.io#/#channel:1#"  │
     │                               │                            │
     │                               │                  (Adapter receives)
     │                               │                            │
     │                               │              Broadcast to local sockets
     │                               │                      in 'channel:1'
```

---

### **Redis Emitter** (Backend Consumer Side - SENDER)

**Purpose:** Allows external processes (without Socket.IO) to **send** messages to Socket.IO clients via Redis.

**Installation:**
```javascript
// backend-consumer/src/consumers/realtime.js
const { Emitter } = require('@socket.io/redis-emitter');
const redis = require('redis');

const redisClient = redis.createClient({ url: 'redis://localhost:6379' });
const io = new Emitter(redisClient);
```

**What It Does:**

1. **No WebSocket Connections:**
   - Backend consumer doesn't have any connected clients
   - Can't directly call `io.emit()` because it's not a Socket.IO server

2. **Publishes to Redis:**
   - Uses Redis Emitter to publish messages to Redis channels
   - Format matches Socket.IO's internal protocol

3. **Backend Adapters Receive:**
   - All backend instances with Redis Adapter receive the message
   - They broadcast to their local connected sockets

**Flow:**
```
Backend Consumer           Redis                    Backend Instance 1        Backend Instance 2
     │                      │                              │                         │
     │──io.to('channel:1')──▶│                             │                         │
     │   .emit('NEW_MESSAGE')│                             │                         │
     │    (via Emitter)      │                             │                         │
     │                       │────Pub/Sub────────────────▶│                         │
     │                       │  "socket.io#/#channel:1#"   │                         │
     │                       │────Pub/Sub────────────────────────────────────────▶│
     │                       │                             │                         │
     │                       │              (Adapter receives)         (Adapter receives)
     │                       │                             │                         │
     │                       │         Broadcast to local sockets  Broadcast to local sockets
```

---

## 📡 Redis Pub/Sub Explained

**Pub/Sub = Publish/Subscribe Pattern**

### **What is Pub/Sub?**

Redis Pub/Sub is a messaging pattern where:
- **Publishers** send messages to **channels**
- **Subscribers** listen to **channels**
- Messages are **broadcast** to all subscribers

**Not Like a Queue:**
- Messages are not stored (fire-and-forget)
- If no subscribers are listening, message is lost
- Multiple subscribers receive the same message

### **How Socket.IO Uses It:**

**1. Channel Format:**
```
socket.io#/#channel:1#
socket.io#/#dm:1#
socket.io#/namespace#room#
```

**2. Message Format:**
```json
{
  "type": 2,  // Event type (2 = emit)
  "data": ["NEW_MESSAGE", { "content": "Hello!", "userId": 2 }],
  "nsp": "/",
  "rooms": ["channel:1"]
}
```

**3. Flow:**

```
┌────────────────────┐
│ Backend Instance 1 │
│                    │
│ io.to('channel:1') │
│   .emit()          │
└─────────┬──────────┘
          │ Adapter publishes
          ▼
┌─────────────────────────────────┐
│         REDIS PUB/SUB           │
│                                 │
│ Channel: socket.io#/#channel:1# │
│                                 │
│ Message: {                      │
│   type: 2,                      │
│   data: ["NEW_MESSAGE", {...}]  │
│ }                               │
└────┬──────────────────────┬─────┘
     │                      │
     │ Adapter subscribes   │ Adapter subscribes
     ▼                      ▼
┌──────────────┐      ┌──────────────┐
│  Backend 1   │      │  Backend 2   │
│              │      │              │
│ Broadcasts   │      │ Broadcasts   │
│ to local     │      │ to local     │
│ sockets in   │      │ sockets in   │
│ 'channel:1'  │      │ 'channel:1'  │
└──────────────┘      └──────────────┘
```

---

## 🎨 Complete Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│                   (React + Socket.IO Client)                    │
└───────────┬─────────────────────────────────────┬───────────────┘
            │ WebSocket                           │ WebSocket
            │ (User A)                            │ (User B)
            ▼                                     ▼
┌─────────────────────┐                ┌─────────────────────┐
│  BACKEND INSTANCE 1 │                │  BACKEND INSTANCE 2 │
│                     │                │                     │
│  ┌───────────────┐  │                │  ┌───────────────┐  │
│  │Socket.IO      │  │                │  │Socket.IO      │  │
│  │Sockets (Map)  │  │                │  │Sockets (Map)  │  │
│  │               │  │                │  │               │  │
│  │ socketId →    │  │                │  │ socketId →    │  │
│  │   WebSocket   │  │                │  │   WebSocket   │  │
│  │   Object      │  │                │  │   Object      │  │
│  └───────────────┘  │                │  └───────────────┘  │
│                     │                │                     │
│  ┌───────────────┐  │                │  ┌───────────────┐  │
│  │Redis Adapter  │  │                │  │Redis Adapter  │  │
│  │(SUBSCRIBER)   │  │                │  │(SUBSCRIBER)   │  │
│  └───────┬───────┘  │                │  └───────┬───────┘  │
└──────────┼──────────┘                └──────────┼──────────┘
           │                                      │
           │ Subscribe to                         │ Subscribe to
           │ "socket.io#/#channel:1#"             │ "socket.io#/#channel:1#"
           │                                      │
           └──────────────┬───────────────────────┘
                          ▼
              ┌─────────────────────┐
              │   REDIS PUB/SUB     │
              │                     │
              │  Channels:          │
              │  - socket.io#/...   │
              │                     │
              │  (In-memory only,   │
              │   not persisted)    │
              └──────────┬──────────┘
                         ▲
                         │ Publish to
                         │ "socket.io#/#channel:1#"
                         │
              ┌──────────┴──────────┐
              │  BACKEND CONSUMER   │
              │  (Realtime)         │
              │                     │
              │  ┌───────────────┐  │
              │  │Redis Emitter  │  │
              │  │(PUBLISHER)    │  │
              │  └───────────────┘  │
              │                     │
              │  (No WebSocket      │
              │   connections,      │
              │   only Redis)       │
              └─────────────────────┘
```

---

## 🔬 Code Example: How It All Works Together

### **Backend: Setting Up Adapter**

```javascript
// backend/src/server.js

const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const redis = require('redis');

// 1. Create Socket.IO server
const io = new Server(httpServer);

// 2. Create Redis clients
const pubClient = redis.createClient({ url: 'redis://localhost:6379' });
const subClient = pubClient.duplicate();

await pubClient.connect();
await subClient.connect();

// 3. Attach Redis Adapter
io.adapter(createAdapter(pubClient, subClient));
// Now io can send/receive via Redis Pub/Sub

// 4. Handle connections
io.on('connection', (socket) => {
  // Socket stored in memory: io.sockets.sockets.get(socket.id)
  
  socket.on('JOIN_CHANNEL', ({ channelId }) => {
    socket.join(`channel:${channelId}`);
    // Room stored in memory: io.sockets.adapter.rooms.get(`channel:${channelId}`)
    
    // This will:
    // 1. Publish to Redis channel "socket.io#/#channel:1#"
    // 2. All backend instances receive via Adapter
    // 3. Each broadcasts to local sockets in 'channel:1'
    io.to(`channel:${channelId}`).emit('JOINED_CHANNEL', { channelId });
  });
});
```

---

### **Backend Consumer: Setting Up Emitter**

```javascript
// backend-consumer/src/consumers/realtime.js

const { Emitter } = require('@socket.io/redis-emitter');
const redis = require('redis');

// 1. Create Redis client
const redisClient = redis.createClient({ url: 'redis://localhost:6379' });
await redisClient.connect();

// 2. Create Redis Emitter
const io = new Emitter(redisClient);

// 3. Consume from Kafka
await kafka.subscribe(['channel.message']);

for await (const { topic, message } of kafka.consume()) {
  const payload = JSON.parse(message.value.toString());
  
  // 4. Emit via Redis (no direct socket connections!)
  io.to(`channel:${payload.channelId}`).emit('NEW_MESSAGE', {
    ...payload.payload,
    id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  });
  
  // This publishes to Redis channel: "socket.io#/#channel:1#"
  // All backend instances with Adapter will receive and broadcast
}
```

---

## 🎯 Summary: Key Differences

| Feature | Redis Adapter | Redis Emitter |
|---------|--------------|---------------|
| **Used By** | Backend (Socket.IO Server) | Backend Consumer (No Socket.IO) |
| **Purpose** | Receive & Send via Redis | Send only via Redis |
| **Has WebSockets?** | ✅ Yes, manages connections | ❌ No connections |
| **Storage** | Stores sockets in memory | No storage |
| **Redis Role** | Subscribe + Publish | Publish only |
| **When to Use** | Main Socket.IO server | External services sending events |

---

## ❓ Common Questions

### **Q: Why not store WebSocket objects in Redis?**
**A:** WebSocket objects contain:
- Active TCP connections (not serializable)
- Event listeners (functions, not serializable)
- Internal state (buffers, timers)
- Too large and complex to serialize/deserialize

### **Q: What happens if Backend crashes?**
**A:** 
- All WebSocket connections to that instance are lost
- Clients auto-reconnect to any available backend instance
- New socket IDs are assigned
- No messages lost (Kafka persists them)

### **Q: Why two Redis clients (pubClient, subClient)?**
**A:**
- Redis best practice: separate connections for pub and sub
- Prevents blocking issues
- Better performance

### **Q: Can I scale without Redis?**
**A:**
- Without Redis Adapter: Sticky sessions required (all requests from one user go to same backend)
- With Redis Adapter: Any backend can handle any user (better load balancing)

---

## 📚 File References

- **Backend Adapter Setup:** [backend/src/server.js](file:///c:/Users/salok/OneDrive/Desktop/discord/backend/src/server.js)
- **Consumer Emitter Setup:** [backend-consumer/src/consumers/realtime.js](file:///c:/Users/salok/OneDrive/Desktop/discord/backend-consumer/src/consumers/realtime.js)
- **Socket Events:** [backend/src/realtime/socket.events.js](file:///c:/Users/salok/OneDrive/Desktop/discord/backend/src/realtime/socket.events.js)
