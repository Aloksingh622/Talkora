const express = require('express');
const friendRouter = express.Router();
const usermiddleware = require('../middlewares/Auth');
const {
    sendFriendRequest,
    acceptFriendRequest,
    rejectOrRemoveFriend,
    getFriends,
    getPendingRequests
} = require('../controllers/friendController');

// All routes require authentication
friendRouter.use(usermiddleware);

// Send friend request
friendRouter.post('/request', sendFriendRequest);

// Accept friend request
friendRouter.post('/:id/accept', acceptFriendRequest);

// Reject or remove friend
friendRouter.delete('/:id', rejectOrRemoveFriend);

// Get all friends
friendRouter.get('/', getFriends);

// Get pending friend requests
friendRouter.get('/requests', getPendingRequests);

module.exports = friendRouter;
