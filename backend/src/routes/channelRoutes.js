const express = require('express');
const ChannelRouter = express.Router();
const usermiddleware = require('../middlewares/Auth.js');
const {
    deleteChannel,
} = require('../controllers/channelController.js');

ChannelRouter.delete('/:channelId', usermiddleware, deleteChannel);

module.exports = ChannelRouter;
