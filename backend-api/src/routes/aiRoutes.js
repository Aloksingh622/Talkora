const express = require('express');
const AiRouter = express.Router();
const usermiddleware = require('../middlewares/Auth.js');
const { enhanceMessage, summarizeMessages, askChatbot } = require('../controllers/aiController');

AiRouter.post('/ai/enhance', usermiddleware, enhanceMessage);
AiRouter.post('/ai/summarize/:channelId', usermiddleware, summarizeMessages);
AiRouter.post('/ai/ask', usermiddleware, askChatbot);

module.exports = AiRouter;

