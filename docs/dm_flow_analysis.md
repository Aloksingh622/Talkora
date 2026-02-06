# Direct Message (DM) Flow: Deep Dive

This document details the end-to-end processing of Direct Messages in Talkora, from the user clicking "Send" to the recipient receiving it. It parallels the Channel Message flow but uses distinct events (`SEND_DM`, `NEW_DM`) and data structures.

## 🏗️ 1. The High-Level Architecture

```mermaid
sequenceDiagram
    participant UserA as Sender (Frontend)
    participant API as Backend API
    participant WS as Backend Realtime
    participant Kafka as Kafka (dm.message)
    participant Consumer as Backend Consumer
    participant Redis as Redis Pub/Sub
    participant UserB as Recipient (Frontend)

    Note over UserA, API: 1. Initiation Phase
    UserA->>API: GET /api/dm/:userId (Check/Create DM Channel)
    API-->>UserA: Returns DM Channel ID (e.g., 456)

    Note over UserA, WS: 2. Sending Phase
    UserA->>WS: Emit 'JOIN_DM' { channelId: 456 }
    UserA->>WS: Emit 'SEND_DM' { channelId: 456, content: "Hello!" }

    Note over WS: 3. Processing Phase
    WS->>WS: Validate Access (DB Check)
    WS->>Kafka: Produce to topic 'dm.message'

    Note over Consumer: 4. Consumption Phase
    Kafka->>Consumer: Consume Message
    Consumer->>DB: Persist Message
    Consumer->>Redis: Publish to 'socket.io#dm:456#'

    Note over Redis, UserB: 5. Delivery Phase
    Redis->>WS: Broadcast to subscribes
    WS->>UserB: Emit 'NEW_DM'
```

---

## 🔍 2. Detailed Process Breakdown

### Phase 1: Initiation (REST API)
**File**: `frontend/src/services/dmService.js` & `backend-api/src/controllers/dmController.js`

Before chatting, a "DM Channel" must exist.
1.  **Frontend**: Calls `createOrGetDMChannel(userId)`.
2.  **Backend API**:
    *   Checks if users are friends.
    *   Checks if a `DirectMessageChannel` row exists between `user1` and `user2`.
    *   If not, creates it.
    *   Returns the `channel.id` (This is the room ID).

### Phase 2: Sending (Realtime Socket)
**File**: `backend-realtime/src/realtime/socket.events.js` (Line 360)

The actual message is sent via WebSocket, NOT REST.
1.  **Event**: `socket.on('SEND_DM', ...)` triggered.
2.  **Rate Limit**: Checks if user is spamming.
3.  **Validation**:
    *   `prisma.directMessageChannel.findUnique({ id: 456 })`
    *   Ensures `socket.user.id` is either `user1Id` or `user2Id` of the channel. **Critical Security Check**.
4.  **Kafka Production**:
    *   Topic: `dm.message`
    *   Key: `${user1}:${user2}` (Ensures strict ordering per conversation).
    *   Payload: `{ type: 'NEW_DM', channelId: 456, content: ... }`

### Phase 3: Consumption Rule (The Separator)
**File**: `backend-consumer/src/consumers/realtime.js` (Line 83)

The consumer specifically listens for the `dm.message` topic.
1.  **Differentiator**: It checks `if (topic === 'dm.message')`.
2.  **Event Type**: If `payload.type === 'NEW_DM'`:
    *   It prepares a broadcast.
    *   **Crucial Difference**: It emits to room `dm:${channelId}` instead of `channel:${channelId}`.

### Phase 4: Delivery (Redis -> Socket)
**File**: `backend-consumer/src/consumers/realtime.js` (Line 90)

```javascript
io.to(`dm:${payload.channelId}`).emit('NEW_DM', messageWithChannel);
```

1.  **Publisher**: The consumer (via Redis Emitter) publishes to channel `socket.io#dm:456#`.
2.  **Subscribers**: All Realtime Servers receive this.
3.  **Final Mile**:
    *   Server A checks: "Is User A (Sender) connected here?" -> Yes -> Emits `NEW_DM` (So sender sees their own message confirmed).
    *   Server B checks: "Is User B (Recipient) connected here?" -> Yes -> Emits `NEW_DM`.
    *   User C (not in DM) -> Server ignores.

---

## 🛡️ Key Security Features
1.  **Friend-Only-First**: You cannot start a DM via REST API unless you are friends (`dmController.js` line 164).
2.  **Participant Validation**: Steps 450-456 in `socket.events.js` ensure you can't listen/type in a DM you don't belong to.
3.  **Encapsulation**: DM logic is isolated in `dm.message` Kafka topic, preventing queue blocking from busy public channels.

## ⚠️ Potential Bottlenecks (Optimization targets)
1.  **Validation Query**: `prisma.directMessageChannel.findUnique` runs on **every single message**. Cache this in Redis (`dm:access:456:user1`) to save DB items.
2.  **Friend Check**: The initial "Start DM" check is heavy.
