const express = require('express');
const MessageRouter = express.Router();
const usermiddleware = require('../middlewares/Auth.js');
const upload = require('../middlewares/multer.middleware.js');
const {
    sendMessage,
    getMessages,
    editMessage,
    deleteMessage,
} = require('../controllers/messageController.js');

MessageRouter.post('/channels/:channelId/messages', usermiddleware, upload.single('file'), sendMessage);
MessageRouter.get('/channels/:channelId/messages', usermiddleware, getMessages);
MessageRouter.patch('/channels/:channelId/messages/:messageId', usermiddleware, editMessage);
MessageRouter.delete('/channels/:channelId/messages/:messageId', usermiddleware, deleteMessage);

module.exports = MessageRouter;
