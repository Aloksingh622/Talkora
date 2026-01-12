const express = require('express');
const ServerRouter = express.Router();
const usermiddleware = require('../middlewares/Auth.js');
const {
    createServer,
    getMyServers,
    joinServer,
    leaveServer,
    deleteServer,
    getServerMembers,
} = require('../controllers/serverController.js');
const {
    createChannel,
    getChannelsByServer
} = require('../controllers/channelController.js');

const upload = require('../middlewares/multer.middleware');

ServerRouter.post('/', usermiddleware, upload.single('icon'), createServer);
ServerRouter.get('/', usermiddleware, getMyServers);
ServerRouter.post('/:id/join', usermiddleware, joinServer);
ServerRouter.post('/:id/leave', usermiddleware, leaveServer);
ServerRouter.delete('/:id', usermiddleware, deleteServer);

// Get server members
ServerRouter.get('/:serverId/members', usermiddleware, getServerMembers);

// Channel routes nested under server
ServerRouter.post('/:serverId/channels', usermiddleware, createChannel);
ServerRouter.get('/:serverId/channels', usermiddleware, getChannelsByServer);

module.exports = ServerRouter;
