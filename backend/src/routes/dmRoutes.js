const express = require('express');
const dmRouter = express.Router();
const usermiddleware = require('../middlewares/Auth');
const {
    getDMConversations,
    getDMChannelInfo,
    createOrGetDMChannel,
    getDMMessages,
    sendDMMessage
} = require('../controllers/dmController');

// All routes require authentication
dmRouter.use(usermiddleware);

// Get all DM conversations
dmRouter.get('/', getDMConversations);

// Create or get DM channel with a user
dmRouter.post('/:userId', createOrGetDMChannel);

// Get DM channel info
dmRouter.get('/:channelId/info', getDMChannelInfo);

// Get messages in a DM channel
dmRouter.get('/:channelId/messages', getDMMessages);

const upload = require('../middlewares/multer.middleware.js');

// Send a DM message
dmRouter.post('/:channelId/messages', upload.single('file'), sendDMMessage);

module.exports = dmRouter;
