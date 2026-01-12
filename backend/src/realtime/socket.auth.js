const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');

// Helper function to parse cookies from header string
const parseCookies = (cookieHeader) => {
    if (!cookieHeader) return {};

    return cookieHeader.split(';').reduce((cookies, cookie) => {
        const [name, value] = cookie.trim().split('=');
        cookies[name] = value;
        return cookies;
    }, {});
};

const socketAuthMiddleware = async (socket, next) => {
    try {
        // Try to get token from auth, query, or cookies
        let token = socket.handshake.auth.token || socket.handshake.query.token;

        // If no token in auth/query, try cookies
        if (!token) {
            const cookieHeader = socket.handshake.headers.cookie;
            const cookies = parseCookies(cookieHeader);
            token = cookies.token;
        }

        if (!token) {
            return next(new Error('Authentication error: Token not provided'));
        }

        const decoded = jwt.verify(token, process.env.private_key);

        if (!decoded) {
            return next(new Error('Authentication error: Invalid token'));
        }

        // Verify user existence
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: { id: true, username: true }
        });

        if (!user) {
            return next(new Error('Authentication error: User not found'));
        }

        socket.user = user;
        next();
    } catch (err) {
        console.error("Socket auth error:", err.message);
        next(new Error('Authentication error'));
    }
};

module.exports = socketAuthMiddleware;
