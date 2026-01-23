import axios_Client from "../utils/axios";

// Get all DM conversations
export const getDMConversations = async () => {
    const response = await axios_Client.get('/api/dm');
    return response.data; // { conversations: [...] }
};

// Create or get DM channel with a user
export const createOrGetDMChannel = async (userId) => {
    // API expects userId in path: POST /api/dm/:userId
    const response = await axios_Client.post(`/api/dm/${userId}`);
    return response.data; // { channel: { id, ... } }
};

// Get DM channel by ID (to fetch other user info)
export const getDMChannel = async (channelId) => {
    const response = await axios_Client.get(`/api/dm/${channelId}/info`);
    return response.data; // { channel: { id, user1, user2, ... } }
};

// Get messages in a DM channel
export const getDMMessages = async (channelId, limit = 50, cursor = null) => {
    let url = `/api/dm/${channelId}/messages?limit=${limit}`;
    if (cursor) {
        url += `&cursor=${cursor}`;
    }
    const response = await axios_Client.get(url);
    return response.data;
};

// Send a DM message
export const sendDMMessage = async (channelId, content, file = null) => {
    const formData = new FormData();
    if (content) formData.append('content', content);
    if (file) formData.append('file', file);

    const response = await axios_Client.post(`/api/dm/${channelId}/messages`, formData, {
        headers: {
            "Content-Type": "multipart/form-data",
        },
    });
    return response.data;
};
