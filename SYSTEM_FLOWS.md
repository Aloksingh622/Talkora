# SparkHub System Flow Documentation

## 1. Server Creation Flow

### Overview
Creating a server initializes a new community space and automatically assigns the creator as the owner.

### Flow Step-by-Step

1.  **Frontend Trigger**
    *   **User Action:** User clicks "Create Server", enters a name, and optionally uploads an icon.
    *   **Logic:** `serverService.createServer` constructs a `FormData` object containing the `name`, `type`, and the image file.
    *   **API Call:** Sends a `POST` request to `/api/servers` with `Content-Type: multipart/form-data`.

2.  **Backend Processing** (`serverController.createServer`)
    *   **Validation:** Checks if the server name is present.
    *   **Image Upload:**
        *   If a file is provided, it's uploaded to **Cloudinary**.
        *   The returned secure URL is used as the server icon.
        *   If no file is provided, a default avatar is generated using `ui-avatars.com`.
    *   **Database Transaction (Prisma):**
        *   A database transaction is used to ensure data integrity.
        *   **Action 1:** Creates a new `Server` record with the name, icon, and owner ID.
        *   **Action 2:** Automatically creates a `ServerMember` record for the requesting user, setting their role to `OWNER`.
    *   **Response:** Returns the newly created server object (including the icon URL) to the client.

## 2. Channel Creation Flow

### Overview
Channels are created within servers to organize conversations. Only Owners or Admins can create them.

### Flow Step-by-Step

1.  **Frontend Trigger**
    *   **User Action:** User clicks "Create Channel" in the sidebar.
    *   **API Call:** `channelService.createChannel` sends a `POST` request to `/api/servers/:serverId/channels` with the channel name.

2.  **Backend Processing** (`channelController.createChannel`)
    *   **Validation:** Checks for a valid channel name and server ID.
    *   **Permission Check:**
        *   Queries the database to find the user's membership in this server.
        *   Verifies that the user's role is either `OWNER` or `ADMIN`. If not, returns a 403 Forbidden error.
    *   **Database Action:** Creates a new `Channel` record linked to the server.
    *   **Real-time Broadcast:**
        *   The server emits a global `CHANNEL_CREATED` Socket.io event containing the new channel details and `serverId`.
        *   (Note: This allows all connected clients to instantly see the new channel without refreshing).

## 3. Messaging Flow (Send & Receive)

### Overview
SparkHub uses a dual-strategy for messaging: **Socket.io** is the primary method for real-time performance, with a REST API fallback.

### A. Sending a Message

1.  **Frontend Trigger** (`ChatArea.jsx`)
    *   **User Action:** User types a message and hits Enter.
    *   **Optimistic UI:** The message is immediately added to the local state (displayed as "sending...") to make the app feel instant.
    *   **Primary Path (Socket.io):**
        *   Checks if the socket connection is active.
        *   Emits a `SEND_MESSAGE` event with `{ channelId, content }`.
        *   Waits for an acknowledgement (Ack) from the server.
    *   **Fallback Path (REST):**
        *   If the socket is unavailable, it sends a `POST` request to `/api/channels/:channelId/messages`.

2.  **Backend Processing** (`socket.events.js` - `SEND_MESSAGE` handler)
    *   **Rate Limiting:** Checks Redis to ensure the user isn't spamming.
    *   **Validation:**
        *   Verifies the message is not empty and under 2000 characters.
        *   **Crucial Check:** Verifies the user is a member of the server that the channel belongs to.
    *   **Database Action:** Creates a new `Message` record in PostgreSQL via Prisma.
    *   **Broadcast:**
        *   Emits a `NEW_MESSAGE` event specifically to the **Socket.io Room** for that channel (`channel:${channelId}`).
        *   This ensures only users currently looking at that channel receive the update.
    *   **Ack:** Sends a success acknowledgement back to the sender with the full message object.

### B. Receiving a Message

1.  **Joining the Room**
    *   When a user clicks on a channel, the frontend emits `JOIN_CHANNEL` with the `{ channelId }`.
    *   The backend validates membership and adds the user's socket to the `channel:${channelId}` room.

2.  **Listening for Updates**
    *   The frontend listens for the `NEW_MESSAGE` event.
    *   **Event Handler:**
        *   Receives the message object.
        *   Checks if the message belongs to the currently open channel (double-check).
        *   **Deduplication:** Checks if the message ID already exists (handling the overlap between Optimistic UI and the incoming broadcast).
        *   Updates the message list, replacing the "temporary/optimistic" message with the real one from the server.
