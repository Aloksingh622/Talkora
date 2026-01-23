import axios_Client from "../utils/axios";

// Send friend request
export const sendFriendRequest = async (userId) => {
    // API expects addresseeId in body
    const response = await axios_Client.post('/api/friends/request', { addresseeId: userId });
    return response.data;
};

// Accept friend request
export const acceptFriendRequest = async (requestId) => {
    const response = await axios_Client.post(`/api/friends/${requestId}/accept`);
    return response.data;
};

// Reject request or Remove friend
export const rejectOrRemoveFriend = async (friendId) => {
    const response = await axios_Client.delete(`/api/friends/${friendId}`);
    return response.data;
};

// Get all friends
export const getFriends = async () => {
    const response = await axios_Client.get('/api/friends');
    return response.data; // { friends: [...] }
};

// Get pending requests
export const getPendingRequests = async () => {
    const response = await axios_Client.get('/api/friends/requests');
    return response.data; // { requests: [...] }
};
