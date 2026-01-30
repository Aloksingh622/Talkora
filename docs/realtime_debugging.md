# Realtime Consumer Debugging Guide

## Current Status

### ✅ What's Working
- Database Consumer: Messages ARE being saved to DB
- Users joining Socket.IO rooms successfully
- Kafka brokers running and messages flowing
- Redis connections established on both backend and consumer

### ❌ What's NOT Working  
- Messages not appearing in real-time (need page refresh)
- Redis Emitter → Redis Adapter communication issue

## Architecture Overview

```
Frontend → Backend API → Kafka → Consumer Service
                              ↓
                           (DB Save + Redis Broadcast)
                              ↓
Backend Socket.IO ← Redis ← Consumer
```

## Step-by-Step Verification

### 1. Check Consumer Logs
Open `backend-consumer` terminal and verify:
```
✅ DB Consumer connected
✅ Redis Emitter connected  
✅ Realtime Consumer connected
✅ [REDIS-EMITTER] Redis client ready for publishing
```

### 2. Send a Test Message
From your browser, send "TEST" in any channel.

**Consumer logs should show:**
```
[DB-CONSUMER] Processing channel.message: {...}
[DB-CONSUMER] Saved channel message to DB
[REALTIME-CONSUMER] Broadcasting channel.message to room: channel:1
[REALTIME-CONSUMER] Emitted NEW_MESSAGE to channel:1
```

### 3. Check Backend Server Logs
Open `backend` terminal and verify:

**On user joining channel:**
```
✅ [JOIN_CHANNEL] User 1 successfully joined channel:1
```

**On message sent (CRITICAL):**
```
[REDIS-ADAPTER] Received on channel "socket.io#/#": ...
```

**If you DON'T see `[REDIS-ADAPTER] Received`** → Redis pub/sub is broken

### 4. Check Browser Console (F12)
Open DevTools → Console tab:

**Expected logs:**
```
NEW_MESSAGE received: {content: "TEST", channelId: 1, ...}
```

**If you DON'T see this** → Socket.IO event listener issue

## Common Issues & Fixes

### Issue 1: Redis Adapter Not Receiving Messages

**Symptoms:**
- Consumer shows "Emitted NEW_MESSAGE"  
- Backend does NOT show "[REDIS-ADAPTER] Received"

**Possible Causes:**
1. Different Redis instances
2. Key prefix mismatch
3. Authentication failure (wrong password)

**Fix:**
Check `.env` files match:
```bash
# Backend .env
REDISPASS='VV1HSYdKZa7QXKPZv5sRhitpCoOeAaQn'
REDISPORT=19553

# Consumer .env (MUST MATCH)
REDISPASS='VV1HSYdKZa7QXKPZv5sRhitpCoOeAaQn'
REDISPORT=19553
```

### Issue 2: Frontend Not Receiving Socket Events

**Symptoms:**
- Backend shows "[REDIS-ADAPTER] Received"
- Browser console does NOT show "NEW_MESSAGE received"

**Possible Causes:**
1. Frontend not listening for 'NEW_MESSAGE' event
2. Message validation failing (channelId check)
3. Socket disconnected

**Fix:**
Check browser console for Socket.IO connection:
```
WebSocket connected: <socket_id>
```

### Issue 3: Message Channel ID Mismatch

**Symptoms:**
- Browser receives message but doesn't display it
- Console shows: "NEW_MESSAGE received: {channelId: undefined}"

**Fix:**
Verify consumer `realtime.js` includes `channelId`:
```javascript
const messageWithChannel = {
    ...payload.payload,
    channelId: payload.channelId
};
io.to(`channel:${payload.channelId}`).emit('NEW_MESSAGE', messageWithChannel);
```

## Testing Commands

### Test Redis Connection (Backend)
```powershell
cd backend
npm run dev
# Look for: "✅ Redis Adapter for Socket.IO connected successfully!"
```

### Test Redis Connection (Consumer)
```powershell  
cd backend-consumer
nodemon index.js
# Look for: "Redis Emitter connected"
```

### Monitor Kafka Messages
```powershell
cd docker-kafka
docker exec -it kafka-1 kafka-console-consumer --bootstrap-server kafka-1:29092 --topic channel.message --from-beginning
```

## Next Steps

1. **Send a test message** and collect ALL logs (backend, consumer, browser)
2. **Identify exactly where the flow breaks** using the checklist above
3. **Share the logs** showing where it fails

The system IS working up to the database save, so the issue is ONLY in the Redis broadcasting step.
