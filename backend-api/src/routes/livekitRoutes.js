const express = require('express');
const router = express.Router();
const { getToken, getDMToken } = require('../controllers/livekit.controller');
const authMiddleware = require('../middlewares/Auth');

// GET /api/livekit/token?channelId=123
router.get('/token', authMiddleware, getToken);

// GET /api/livekit/dm-token?channelId=123
router.get('/dm-token', authMiddleware, getDMToken);

module.exports = router;
