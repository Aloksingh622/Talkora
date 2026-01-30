import { io } from "socket.io-client";


let socket;

export const initSocket = (token) => {
    if (socket) return socket;

    const socketOptions = {
        withCredentials: true,
        transports: ['websocket'], // Force WebSocket only - bypass polling
    };

    // Only add auth if token is provided (for manual token auth)
    // Otherwise, cookies will be used for authentication
    if (token) {
        socketOptions.auth = { token };
    }

    socket = io(import.meta.env.VITE_REALTIME_URL || 'http://localhost:3001', socketOptions);

    socket.on("connect", () => {
        console.log("✅ WebSocket connected:", socket.id);
    });

    socket.on("disconnect", (reason) => {
        console.warn("❌ WebSocket disconnected. Reason:", reason);
        if (reason === "io server disconnect") {
            console.error("Server disconnected the client - check backend logs!");
        } else if (reason === "transport close") {
            console.error("Transport closed - possible NGINX/network issue");
        }
    });

    socket.on("connect_error", (err) => {
        console.error("🔴 WebSocket connection error:", err.message, err);
    });

    socket.on("error", (err) => {
        console.error("🔴 WebSocket error:", err);
    });

    return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};
