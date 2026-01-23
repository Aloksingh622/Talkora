const express = require('express');
const ServerRouter = express.Router();
const usermiddleware = require('../middlewares/Auth.js');
const {
    createServer,
    getMyServers,
    searchServers,
    joinServer,
    leaveServer,
    deleteServer,
    getServerMembers,
    requestJoinServer,
    getJoinRequests,
    handleJoinRequest,
    getInvite,
    updateServerSettings,
    transferOwnership
} = require('../controllers/serverController.js');
const {
    createChannel,
    getChannelsByServer
} = require('../controllers/channelController.js');
const {
    kickMember,
    banMember,
    unbanMember,
    getBannedMembers,
    timeoutMember,
    removeTimeout,
    getActiveTimeouts,
    getMyMemberStatus
} = require('../controllers/memberController.js');
const {
    getAuditLogs
} = require('../controllers/auditController.js');

const upload = require('../middlewares/multer.middleware');

// Server CRUD
ServerRouter.post('/', usermiddleware, upload.single('icon'), createServer);
ServerRouter.get('/', usermiddleware, getMyServers);
ServerRouter.get('/search', usermiddleware, searchServers);
ServerRouter.post('/:id/join', usermiddleware, joinServer);
ServerRouter.post('/:id/leave', usermiddleware, leaveServer);
ServerRouter.delete('/:id', usermiddleware, deleteServer);

// Server settings (owner only)
ServerRouter.patch('/:id/settings', usermiddleware, upload.single('icon'), updateServerSettings);
ServerRouter.post('/:id/transfer-ownership', usermiddleware, transferOwnership);

// Invite routes
ServerRouter.get('/invite/:code', getInvite);

// Join Request routes
ServerRouter.post('/:id/request', usermiddleware, requestJoinServer);
ServerRouter.get('/:id/requests', usermiddleware, getJoinRequests);
ServerRouter.post('/:id/requests/:requestId/respond', usermiddleware, handleJoinRequest);

// Get server members
ServerRouter.get('/:serverId/members', usermiddleware, getServerMembers);

// Check my member status (ban/timeout) - any member can check their own status
ServerRouter.get('/:id/members/me/status', usermiddleware, getMyMemberStatus);

// Member management (owner only)
ServerRouter.post('/:id/members/:userId/kick', usermiddleware, kickMember);
ServerRouter.post('/:id/members/:userId/ban', usermiddleware, banMember);
ServerRouter.post('/:id/members/:userId/timeout', usermiddleware, timeoutMember);
ServerRouter.delete('/:id/members/:userId/timeout', usermiddleware, removeTimeout);

// Ban management (owner only)
ServerRouter.delete('/:id/bans/:userId', usermiddleware, unbanMember);
ServerRouter.get('/:id/bans', usermiddleware, getBannedMembers);

// Timeout management (owner only)
ServerRouter.get('/:id/timeouts', usermiddleware, getActiveTimeouts);

// Audit logs (owner only)
ServerRouter.get('/:id/audit-logs', usermiddleware, getAuditLogs);

// Channel routes nested under server
ServerRouter.post('/:serverId/channels', usermiddleware, createChannel);
ServerRouter.get('/:serverId/channels', usermiddleware, getChannelsByServer);

module.exports = ServerRouter;

