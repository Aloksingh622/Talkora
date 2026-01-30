# Complete Dependency Analysis for backend-realtime Migration

## 📋 Executive Summary

**Goal:** Split `backend/` into two services:
1. `backend-realtime/` - WebSocket only
2. `backend-api/` - REST API + everything else

**Critical Finding:** Realtime service has deep dependencies on 17 files across 7 directories!

---

## 🎯 Dependency Tree

### **Core Realtime Files (MUST MOVE):**

```
backend/src/realtime/
├── socket.js (104 lines)
│   └── Imports:
│       ├── socket.io ✅ NPM package
│       ├── ./socket.auth ✅ Same directory
│       ├── ./socket.events ✅ Same directory
│       ├── @socket.io/redis-adapter ✅ NPM package
│       ├── redis ✅ NPM package
│       └── ../redis/presence ⚠️ DEPENDENCY
│
├── socket.auth.js (53 lines)
│   └── Imports:
│       ├── jsonwebtoken ✅ NPM package
│       └── ../utils/prisma ⚠️ DEPENDENCY
│
└── socket.events.js (500 lines) 🔥 LARGEST FILE
    └── Imports:
        ├── ../utils/prisma ⚠️ DEPENDENCY
        ├── ../redis/typing ⚠️ DEPENDENCY
        ├── ../redis/ratelimit ⚠️ DEPENDENCY
        ├── ../redis/presence ⚠️ DEPENDENCY
        └── ../kafka/producer ⚠️ DEPENDENCY
```

---

## 🔗 Level 1 Dependencies (Direct)

### **1. Kafka Producer** (MOVE)

**File:** `backend/src/kafka/producer.js` (54 lines)

**Dependencies:**
```javascript
const kafka = require('../config/kafka');  // ⚠️ DEPENDENCY
const { CompressionTypes } = require('kafkajs');  // ✅ NPM
```

**Exports:**
- `send(topic, key, message)` - Used by socket.events.js

**Action:** ✅ **MOVE** to `backend-realtime/src/kafka/producer.js`

---

### **2. Redis Modules** (MOVE ALL)

#### **A. redis/presence.js** (105 lines)

**Dependencies:**
```javascript
const redisclient = require('../database/redis');  // ⚠️ DEPENDENCY
const {
    getOnlineUserKey,
    getPresenceLastSeenKey,
    getPresenceConnectionsKey,
    getSocketUserKey
} = require('./keys');  // ⚠️ DEPENDENCY
```

**Exports:**
- `addUserSession(socketId, userId)` - Used by socket.js
- `removeUserSession(socketId)` - Used by socket.events.js
- `refreshOnlineStatus(userId)` - Used by socket.events.js
- `getPresence(userId)` - NOT used by realtime

**Action:** ✅ **MOVE** to `backend-realtime/src/redis/presence.js`

---

#### **B. redis/typing.js** (28 lines)

**Dependencies:**
```javascript
const redisclient = require('../database/redis');  // ⚠️ DEPENDENCY
const { getTypingKey } = require('./keys');  // ⚠️ DEPENDENCY
```

**Exports:**
- `setTypingStatus(channelId, userId)` - Used by socket.events.js
- `removeTypingStatus(channelId, userId)` - Used by socket.events.js

**Action:** ✅ **MOVE** to `backend-realtime/src/redis/typing.js`

---

#### **C. redis/ratelimit.js** (33 lines)

**Dependencies:**
```javascript
const redisclient = require('../database/redis');  // ⚠️ DEPENDENCY
const { getRateLimitKey } = require('./keys');  // ⚠️ DEPENDENCY
```

**Exports:**
- `checkRateLimit(userId)` - Used by socket.events.js

**Action:** ✅ **MOVE** to `backend-realtime/src/redis/ratelimit.js`

---

#### **D. redis/keys.js** (21 lines)

**Dependencies:**
```javascript
// NO DEPENDENCIES! ✅
```

**Exports:**
- `getOnlineUserKey(userId)`
- `getPresenceLastSeenKey(userId)`
- `getPresenceConnectionsKey(userId)`
- `getSocketUserKey(socketId)`
- `getTypingKey(channelId, userId)`
- `getRateLimitKey(userId)`

**Action:** ✅ **MOVE** to `backend-realtime/src/redis/keys.js`

---

### **3. Utils** (COPY, DON'T MOVE)

#### **A. utils/prisma.js** (23 lines)

**Dependencies:**
```javascript
const { PrismaClient } = require('@prisma/client');  // ✅ NPM
const { Pool } = require('pg');  // ✅ NPM
const { PrismaPg } = require('@prisma/adapter-pg');  // ✅ NPM
const dotenv = require('dotenv');  // ✅ NPM
```

**Used By:**
- `socket.auth.js` - User authentication
- `socket.events.js` - Channel/member validation (20+ DB queries!)

**Action:** ✅ **COPY** to `backend-realtime/src/utils/prisma.js`
- ⚠️ Keep in backend-api (API service needs it!)

---

#### **B. utils/authUtils.js** (157 lines)

**Dependencies:**
```javascript
const prisma = require('./prisma');  // ⚠️ DEPENDENCY
```

**Exports:**
- `isServerOwner(userId, serverId)`
- `requireServerOwner(req, res, next)`
- `canManageMember(userId, serverId, targetUserId)`
- `createAuditLog(...)`
- `isUserBanned(userId, serverId)` - 🔥 Used by socket.events.js!
- `isUserTimedOut(userId, serverId)` - 🔥 Used by socket.events.js!

**Used By:**
- `socket.events.js` - Ban/timeout checks

**Action:** ⚠️ **COPY** parts to `backend-realtime/src/utils/authUtils.js`
- Only copy: `isUserBanned`, `isUserTimedOut`
- Keep full file in backend-api

---

### **4. Database/Config** (COPY)

#### **A. database/redis.js** (15 lines)

**Dependencies:**
```javascript
const redis = require('redis');  // ✅ NPM
const dotenv = require('dotenv');  // ✅ NPM
```

**Exports:**
- `redisclient` - Redis connection (SHARED by all Redis modules)

**Action:** ✅ **COPY** to `backend-realtime/src/database/redis.js`
- ⚠️ Keep in backend-api (used by presence routes, etc.)

---

#### **B. config/kafka.js** (9 lines)

**Dependencies:**
```javascript
const { Kafka } = require('kafkajs');  // ✅ NPM
```

**Exports:**
- `kafka` - Kafka client instance

**Action:** ✅ **COPY** to `backend-realtime/src/config/kafka.js`
- ❌ Remove from backend-api (API doesn't use Kafka)

---

## 📦 NPM Dependencies

### **backend-realtime/package.json** (New)

**Required Dependencies:**
```json
{
  "dependencies": {
    "socket.io": "^4.8.3",                    // WebSocket server
    "@socket.io/redis-adapter": "^8.3.0",     // Redis Adapter
    "redis": "^5.10.0",                       // Redis client
    "kafkajs": "^2.2.4",                      // Kafka producer
    "jsonwebtoken": "^9.0.3",                 // JWT validation
    "@prisma/client": "^6.0.0",               // Database queries
    "@prisma/adapter-pg": "^6.0.0",           // Prisma adapter
    "pg": "^8.16.3",                          // PostgreSQL
    "dotenv": "^17.2.3",                      // Environment vars
    "express": "^5.2.1"                       // For health check endpoint (optional)
  }
}
```

**NOT Needed:**
- `cors` - No REST API
- `cookie-parser` - No REST API
- `bcryptjs` - No authentication
- `firebase-admin` - No authentication
- `@sendgrid/mail` - No email
- `cloudinary` - No file uploads
- `multer` - No file uploads
- `otp-generator` - No OTP generation

---

## 🔍 Database Queries in Realtime (socket.events.js)

### **Critical: 23 Database Queries!** ⚠️

```javascript
// socket.events.js line-by-line analysis:

// JOIN_CHANNEL event:
- prisma.channel.findUnique()           // Line 22
- prisma.serverMember.findUnique()      // Line 33

// SEND_MESSAGE event:
- prisma.channel.findUnique()           // Line ~100
- prisma.serverMember.findUnique()      // Line ~120
- isUserBanned() → prisma.ban.findUnique()
- isUserTimedOut() → prisma.timeout.findUnique()

// JOIN_DM event:
- prisma.directMessageChannel.findFirst()  // Line ~200
- prisma.friendShip.findFirst()            // Line ~220

// SEND_DM event:
- prisma.directMessageChannel.findFirst()
- prisma.friendShip.findFirst()
- isUserBanned()
- isUserTimedOut()

// EDIT_MESSAGE event:
- prisma.message.findUnique()
- prisma.serverMember.findUnique()

// DELETE_MESSAGE event:
- prisma.message.findUnique()
- prisma.serverMember.findUnique()

// Total: ~20 different query locations!
```

**Optimization Opportunity:**
- Cache membership in Redis (avoid 70% of DB queries)
- Cache ban/timeout status in Redis
- Reduce DB load on realtime service

---

## 🌐 Frontend Dependencies

### **Critical Files:**

#### **1. frontend/src/utils/socket.js** (40 lines)

**Current Configuration:**
```javascript
socket = io(import.meta.env.VITE_API_URL || 'http://localhost:4000', socketOptions);
```

**Used By:**
- `pages/ChatPage.jsx` - `initSocket()`, `disconnectSocket()`, `getSocket()`
- `components/ChatArea.jsx` - `getSocket()`
- `components/ChannelList.jsx` - `getSocket()`

**Breaking Change Required:**
```javascript
// BEFORE:
VITE_API_URL=http://localhost:4000  (WebSocket + REST)

// AFTER:
VITE_REALTIME_URL=http://localhost:3001  (WebSocket only)
VITE_API_URL=http://localhost:3002        (REST only)
```

**Updated Code:**
```javascript
// socket.js
socket = io(import.meta.env.VITE_REALTIME_URL || 'http://localhost:3001', socketOptions);
```

---

#### **2. frontend/src/utils/axios.js** (12 lines)

**Current Configuration:**
```javascript
const axios_Client = axios.create({
    baseURL: import.meta.env.VITE_API_URL,  // http://localhost:4000
    // ...
});
```

**No Change Required!**
- REST API moves to port 3002
- Just update `VITE_API_URL` env var

---

#### **3. frontend/.env** (11 lines)

**Current:**
```env
VITE_API_URL=http://localhost:4000
```

**Updated:**
```env
VITE_REALTIME_URL=http://localhost:3001  # WebSocket
VITE_API_URL=http://localhost:3002       # REST API
```

---

## 📊 Complete File Migration Map

### **MOVE to backend-realtime/** ✅

```
backend-realtime/
├── src/
│   ├── server.js                    [NEW - Create]
│   ├── realtime/
│   │   ├── socket.js               [MOVE]
│   │   ├── socket.events.js        [MOVE]
│   │   └── socket.auth.js          [MOVE]
│   ├── kafka/
│   │   └── producer.js             [MOVE]
│   ├── redis/
│   │   ├── presence.js             [MOVE]
│   │   ├── typing.js               [MOVE]
│   │   ├── ratelimit.js            [MOVE]
│   │   └── keys.js                 [MOVE]
│   ├── utils/
│   │   ├── prisma.js               [COPY]
│   │   └── authUtils.js            [COPY - partial]
│   ├── database/
│   │   └── redis.js                [COPY]
│   └── config/
│       └── kafka.js                [COPY]
├── package.json                     [NEW - Create]
├── .env                             [NEW - Create]
├── .gitignore                       [COPY]
└── README.md                        [NEW - Create]
```

---

### **KEEP in backend-api/** (Rest of backend)

```
backend-api/
├── src/
│   ├── server.js                   [MODIFY - Remove Socket.IO]
│   ├── routes/                     [KEEP ALL]
│   ├── controllers/                [KEEP ALL]
│   ├── middlewares/                [KEEP ALL]
│   ├── emailservice/               [KEEP]
│   ├── database/
│   │   ├── redis.js               [KEEP]
│   │   └── cloudinary.js          [KEEP]
│   ├── utils/
│   │   ├── prisma.js              [KEEP]
│   │   ├── authUtils.js           [KEEP]
│   │   └── token.js               [KEEP]
│   └── validator/                  [KEEP]
├── prisma/                          [KEEP]
├── public/                          [KEEP]
├── scripts/                         [KEEP]
├── ServiceAccount.json              [KEEP]
├── package.json                     [MODIFY - Remove Socket.IO deps]
└── .env                             [MODIFY - Update PORT]
```

---

## ⚠️ Breaking Changes Checklist

### **1. Frontend Changes:**

- [x] Update `frontend/.env`:
  ```env
  VITE_REALTIME_URL=http://localhost:3001
  VITE_API_URL=http://localhost:3002
  ```

- [x] Update `frontend/src/utils/socket.js`:
  ```javascript
  socket = io(import.meta.env.VITE_REALTIME_URL || 'http://localhost:3001', socketOptions);
  ```

- [x] **NO** changes needed for axios (uses VITE_API_URL)

---

### **2. Backend Realtime Changes:**

- [x] Create new `backend-realtime/src/server.js`
- [x] Update all relative imports (up one level less)
- [x] Copy `.env` with new PORT=3001
- [x] Remove REST API dependencies from package.json

---

### **3. Backend API Changes:**

- [x] Update `backend-api/src/server.js`:
  - Remove Socket.IO initialization
  - Remove `const initSocket = require('./realtime/socket');`
  - Remove `io.on('connection', ...)`
  
- [x] Update `.env`:
  ```env
  PORT=3002  # Changed from 4000
  ```

- [x] Update `package.json`:
  - Remove `socket.io`
  - Remove `@socket.io/redis-adapter`
  - Remove `kafkajs` (API doesn't produce to Kafka)

---

## 🚨 Critical Issues to Address

### **Issue 1: Shared Redis Client**

**Problem:**
- Both services connect to same Redis
- Need separate connection pools

**Solution:**
```javascript
// backend-realtime/src/database/redis.js
const redisclient = redis.createClient({
    username: 'default',
    password: process.env.REDISPASS,
    socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDISPORT
    }
});

// Same for backend-api
```

**Action:** Separate Redis clients (OK, they can share  Redis server)

---

### **Issue 2: Prisma Client instances**

**Problem:**
- Both services need Prisma
- Should they share the same connection pool?

**Solution:**
- Separate Prisma instances (OK, PostgreSQL handles connection pooling)
- Each service connects independently

**Action:** Copy `utils/prisma.js` to both services

---

### **Issue 3: Database Queries in Realtime** 🔥

**Problem:**
- `socket.events.js` makes 20+ DB queries per message!
- This defeats the purpose of separating services

**Solution (Phase 2 - after migration):**
```javascript
// Cache membership in Redis:
socket.on('JOIN_CHANNEL', async ({ channelId }) => {
    // Instead of:
    // const member = await prisma.serverMember.findUnique(...);
    
    // Do:
    const isMember = await redisclient.sismember(
        `server:${serverId}:members`, 
        userId
    );
});
```

**Action:** 
- ✅ Phase 1: Move as-is (DB queries stay)
- ⚠️ Phase 2: Implement Redis caching (reduce 70% of queries)

---

### **Issue 4: authUtils Duplication**

**Problem:**
- `isUserBanned` and `isUserTimedOut` needed in realtime
- But they're in `authUtils.js` with other REST-only functions

**Solution:**
```javascript
// backend-realtime/src/utils/authUtils.js (minimal)
const prisma = require('./prisma');

async function isUserBanned(userId, serverId) {
    const ban = await prisma.ban.findUnique({
        where: { userId_serverId: { userId, serverId } }
    });
    return !!ban;
}

async function isUserTimedOut(userId, serverId) {
    const timeout = await prisma.timeout.findUnique({
        where: { userId_serverId: { userId, serverId } }
    });
    if (!timeout) return { isTimedOut: false };
    if (new Date() > timeout.expiresAt) {
        await prisma.timeout.delete({ where: { id: timeout.id } });
        return { isTimedOut: false };
    }
    return { isTimedOut: true, timeout };
}

module.exports = { isUserBanned, isUserTimedOut };
```

**Action:** Create minimal `authUtils.js` for realtime

---

## 📋 Migration Checklist (Detailed)

### **Step 1: Create backend-realtime structure** (30 min)

```bash
mkdir backend-realtime
cd backend-realtime
npm init -y
mkdir -p src/{realtime,kafka,redis,utils,database,config}
```

### **Step 2: Copy files** (1 hour)

```bash
# Copy realtime files
cp ../backend/src/realtime/* src/realtime/

# Copy dependencies
cp ../backend/src/kafka/producer.js src/kafka/
cp ../backend/src/redis/{presence,typing,ratelimit,keys}.js src/redis/
cp ../backend/src/utils/prisma.js src/utils/
cp ../backend/src/database/redis.js src/database/
cp ../backend/src/config/kafka.js src/config/

# Copy config
cp ../backend/.env .env
cp ../backend/.gitignore .gitignore
```

### **Step 3: Create server.js** (1 hour)

```javascript
// backend-realtime/src/server.js
const http = require('http');
const initSocket = require('./realtime/socket');
const kafkaProducer = require('./kafka/producer');
const redisclient = require('./database/redis');

const app = require('express')();
const server = http.createServer(app);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'realtime' });
});

const PORT = process.env.PORT || 3001;

const start = async () => {
  try {
    // Connect to Redis
    await redisclient.connect();
    console.log('Redis connected');

    // Connect to Kafka
    await kafkaProducer.connect();
    console.log('Kafka connected');

    // Initialize Socket.IO
    const io = initSocket(server);
    console.log('Socket.IO initialized');

    // Start server
    server.listen(PORT, () => {
      console.log(`Realtime Service running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Startup error:', err);
    process.exit(1);
  }
};

start();
```

### **Step 4: Create authUtils.js minimal version** (30 min)

- Extract only `isUserBanned` and `isUserTimedOut`

### **Step 5: Install dependencies** (10 min)

```bash
npm install socket.io @socket.io/redis-adapter redis kafkajs jsonwebtoken @prisma/client @prisma/adapter-pg pg dotenv express
```

### **Step 6: Update .env** (5 min)

```env
PORT=3001
```

### **Step 7: Test realtime service** (1 hour)

```bash
npm start
# Test WebSocket connection
# Test message sending
```

### **Step 8: Update frontend** (30 min)

- Update `.env`
- Update `socket.js`
- Test connection

### **Step 9: Update backend-api** (1 hour)

- Remove Socket.IO from server.js
- Update PORT to 3002
- Remove Socket.IO dependencies
- Test REST endpoints

### **Step 10: Deploy both services** (2 hours)

- Start realtime on port 3001
- Start API on port 3002
- Test integration
- Monitor logs

---

## 🎯 Final Summary

**Files to Move:** 13 files  
**Files to Copy:** 4 files  
**Files to Create:** 3 files  
**Frontend Files to Update:** 2 files  

**Total Effort:** 1 day (8 hours)

**Risk Level:** Medium
- High dependency count
- Database queries in realtime
- Frontend breaking changes

**Mitigation:**
- Keep old backend running during migration
- Test extensively before shutdown
- Gradual traffic migration

---

Ready to proceed! 🚀
