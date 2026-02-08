/**
 * Room Registry Module
 * 
 * Tracks which gateways have active users in each room.
 * Enables targeted Redis publishing instead of broadcasting to all gateways.
 * 
 * Data structures in Redis:
 * - room:{roomName}:gateways (SET) - Set of gateway IDs that have users in this room
 * - gateway:{gatewayId}:room:{roomName}:count (STRING) - Count of users on this gateway in this room
 * - gateway:{gatewayId}:rooms (SET) - Reverse index of rooms this gateway is registered for
 */

const redisClient = require('../database/redis');

// Gateway ID is based on the port this instance runs on
const GATEWAY_ID = `gateway:${process.env.PORT || 3001}`;

// Key builders
const keys = {
    roomGateways: (roomName) => `room:${roomName}:gateways`,
    gatewayRoomCount: (roomName) => `${GATEWAY_ID}:room:${roomName}:count`,
    gatewayRooms: () => `${GATEWAY_ID}:rooms`,
};

/**
 * Called when a user joins a room on this gateway.
 * Increments the count and registers the gateway if it's the first user.
 * 
 * @param {string} roomName - The room name (e.g., "channel:123" or "dm:456")
 * @returns {Promise<{count: number, isFirstUser: boolean}>}
 */
async function userJoinedRoom(roomName) {
    try {
        // Atomically increment the count
        const newCount = await redisClient.incr(keys.gatewayRoomCount(roomName));

        const isFirstUser = newCount === 1;

        if (isFirstUser) {
            // First user on this gateway for this room - register the gateway
            await Promise.all([
                redisClient.sAdd(keys.roomGateways(roomName), GATEWAY_ID),
                redisClient.sAdd(keys.gatewayRooms(), roomName),
            ]);
            console.log(`[ROOM-REGISTRY] Registered ${GATEWAY_ID} for room ${roomName}`);
        }

        console.log(`[ROOM-REGISTRY] User joined ${roomName} on ${GATEWAY_ID} (count: ${newCount})`);

        return { count: newCount, isFirstUser };
    } catch (err) {
        console.error(`[ROOM-REGISTRY] Error in userJoinedRoom:`, err);
        throw err;
    }
}

/**
 * Called when a user leaves a room on this gateway.
 * Decrements the count and unregisters the gateway if it's the last user.
 * 
 * @param {string} roomName - The room name (e.g., "channel:123" or "dm:456")
 * @returns {Promise<{count: number, isLastUser: boolean}>}
 */
async function userLeftRoom(roomName) {
    try {
        // Atomically decrement the count
        const newCount = await redisClient.decr(keys.gatewayRoomCount(roomName));

        const isLastUser = newCount <= 0;

        if (isLastUser) {
            // Last user on this gateway for this room - unregister the gateway
            await Promise.all([
                redisClient.sRem(keys.roomGateways(roomName), GATEWAY_ID),
                redisClient.sRem(keys.gatewayRooms(), roomName),
                redisClient.del(keys.gatewayRoomCount(roomName)),
            ]);
            console.log(`[ROOM-REGISTRY] Unregistered ${GATEWAY_ID} from room ${roomName}`);
        }

        console.log(`[ROOM-REGISTRY] User left ${roomName} on ${GATEWAY_ID} (count: ${Math.max(0, newCount)})`);

        return { count: Math.max(0, newCount), isLastUser };
    } catch (err) {
        console.error(`[ROOM-REGISTRY] Error in userLeftRoom:`, err);
        throw err;
    }
}

/**
 * Get all gateways that have active users in a specific room.
 * Used by the consumer to do targeted publishing.
 * 
 * @param {string} roomName - The room name (e.g., "channel:123" or "dm:456")
 * @returns {Promise<string[]>} - Array of gateway IDs
 */
async function getGatewaysForRoom(roomName) {
    try {
        const gateways = await redisClient.sMembers(keys.roomGateways(roomName));
        return gateways || [];
    } catch (err) {
        console.error(`[ROOM-REGISTRY] Error in getGatewaysForRoom:`, err);
        return []; // Return empty array on error - will fall back to broadcast
    }
}

/**
 * Clean up all room registrations for this gateway.
 * Called on gateway shutdown or for periodic cleanup.
 */
async function cleanupGateway() {
    try {
        // Get all rooms this gateway is registered for
        const rooms = await redisClient.sMembers(keys.gatewayRooms());

        if (!rooms || rooms.length === 0) {
            console.log(`[ROOM-REGISTRY] No rooms to clean up for ${GATEWAY_ID}`);
            return;
        }

        console.log(`[ROOM-REGISTRY] Cleaning up ${rooms.length} rooms for ${GATEWAY_ID}`);

        // Remove this gateway from each room's gateway set
        const cleanupPromises = rooms.map(async (roomName) => {
            await Promise.all([
                redisClient.sRem(keys.roomGateways(roomName), GATEWAY_ID),
                redisClient.del(keys.gatewayRoomCount(roomName)),
            ]);
        });

        await Promise.all(cleanupPromises);

        // Clear the gateway's room set
        await redisClient.del(keys.gatewayRooms());

        console.log(`[ROOM-REGISTRY] Cleanup complete for ${GATEWAY_ID}`);
    } catch (err) {
        console.error(`[ROOM-REGISTRY] Error in cleanupGateway:`, err);
    }
}

/**
 * Get current gateway ID
 */
function getGatewayId() {
    return GATEWAY_ID;
}

module.exports = {
    userJoinedRoom,
    userLeftRoom,
    getGatewaysForRoom,
    cleanupGateway,
    getGatewayId,
    keys, // Export for consumer to use
};
