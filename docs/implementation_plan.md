# Multi-Server Message Flow Architecture

## Goal
Decouple message processing and broadcasting to support multiple API servers and a dedicated Consumer service.

## Current Flow (Monolith)
1.  **User A** sends message (Socket/REST).
2.  **Server 1** receives request.
3.  **Server 1** writes to Postgres (DB).
4.  **Server 1** broadcasts to local Socket clients (`io.to(room).emit()`).
    *   *Problem*: If User B is connected to **Server 2**, they NEVER get the message.

## New Flow (Distributed)

### 1. Sending (Producer)
- **User A** sends message (Socket/REST) to **Server 1**.
- **Server 1** validates request.
- **Server 1** produces message to **Kafka** (`channel.message` or `dm.message`).
- **Server 1** returns "Pending/Ack" to User A.
- *Note*: Server 1 does **NOT** write to DB or broadcast yet.

### 2. Processing (Consumer Service)
- **Database Group** (Consumer Server):
    - Reads from Kafka.
    - Writes to **Postgres** (Prisma).
- **Realtime Group** (Consumer Server):
    - Reads from Kafka.
    - Publishes message to **Redis Pub/Sub** (`channel:1:messages`).

### 3. Broadcasting (All API Servers)
- **Server 1, Server 2, Server 3** all subscribe to Redis.
- When **Redis** receives the message:
    - **Server 1** checks: "Do I have users in Channel 1?" -> Yes, broadcast.
    - **Server 2** checks: "Do I have users in Channel 1?" -> Yes, broadcast.
    - **Server 3** checks: "Do I have users in Channel 1?" -> No, ignore.

## Implementation Steps

### Phase 1: Redis Adapter
- [ ] Install `@socket.io/redis-adapter` on Backend.
- [ ] Configure Socket.IO to use Redis. This automatically handles the "Server 1 -> Redis -> Server 2" broadcasting!

### Phase 2: Consumer Service
- [ ] Create `backend-consumer` project.
- [ ] Implement `db-consumer`: Kafka -> Prisma.
- [ ] Implement `realtime-consumer`: Kafka -> Redis (or Kafka -> Socket.IO Emitter).
    *   *Simpler Approach*: We can use `@socket.io/redis-emitter` in the Consumer to push directly to the Redis channels that the API servers are listening to.

### Phase 3: Cleanup Backend
- [ ] Remove `prisma.create` from `socket.events.js` and `dmController.js`.
- [ ] Remove `io.to().emit()` from `socket.events.js` (replaced by Kafka producer).
