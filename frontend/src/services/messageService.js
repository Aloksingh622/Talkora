import axios_Client from "../utils/axios";

// Send Message (REST fallback)
export const sendMessageREST = async (channelId, content) => {
    const response = await axios_Client.post(`/api/channels/${channelId}/messages`, { content });
    return response.data;
};

// Get Messages
export const getMessages = async (channelId, limit = 50, cursor = null) => {
    let url = `/api/channels/${channelId}/messages?limit=${limit}`;
    if (cursor) {
        url += `&cursor=${cursor}`;
    }
    const response = await axios_Client.get(url);
    return response.data;
};
