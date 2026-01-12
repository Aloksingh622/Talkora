import { io } from "socket.io-client";

// Singleton socket instance
let socket;

export const initSocket = (token) => {
    if (socket) return socket;

    const socketOptions = {
        withCredentials: true,
    };

    // Only add auth if token is provided (for manual token auth)
    // Otherwise, cookies will be used for authentication
    if (token) {
        socketOptions.auth = { token };
    }

    socket = io(import.meta.env.VITE_API_URL || 'http://localhost:4000', socketOptions);

    socket.on("connect", () => {
        console.log("WebSocket connected:", socket.id);
    });

    socket.on("connect_error", (err) => {
        console.error("WebSocket connection error:", err.message);
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
