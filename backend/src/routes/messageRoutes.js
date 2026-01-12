const express = require('express');
const MessageRouter = express.Router();
const usermiddleware = require('../middlewares/Auth.js');
const {
    sendMessage,
    getMessages,
} = require('../controllers/messageController.js');

// Nested routes pattern is preferred by user request: /channels/:channelId/messages
// But since we are mounting at /api/messages or similar, let's see server.js
// If we mount at /api, then we define the full path here.
// Or we can simple mount at /api and have paths start with /channels/...

MessageRouter.post('/channels/:channelId/messages', usermiddleware, sendMessage);
MessageRouter.get('/channels/:channelId/messages', usermiddleware, getMessages);

module.exports = MessageRouter;
