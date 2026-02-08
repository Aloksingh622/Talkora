const express = require('express');
const AiRouter = express.Router();
const usermiddleware = require('../middlewares/Auth.js');
const { enhanceMessage, summarizeMessages, askChatbot } = require('../controllers/aiController');

AiRouter.post('/enhance', usermiddleware, enhanceMessage);
AiRouter.post('/summarize/:channelId', usermiddleware, summarizeMessages);
AiRouter.post('/ask', usermiddleware, askChatbot);

module.exports = AiRouter;
