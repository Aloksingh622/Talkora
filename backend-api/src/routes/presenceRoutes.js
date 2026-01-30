const express = require('express');
const PresenceRouter = express.Router();
const usermiddleware = require('../middlewares/Auth.js');
const {
    getUserPresence,
} = require('../controllers/presenceController.js');

PresenceRouter.get('/users/:userId/presence', usermiddleware, getUserPresence);

module.exports = PresenceRouter;
