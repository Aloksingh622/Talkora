import axios_Client from "../utils/axios";

// Send Message (REST fallback)
// Send Message (REST fallback)
export const sendMessageREST = async (channelId, content, file = null) => {
    const formData = new FormData();
    if (content) formData.append('content', content);
    if (file) formData.append('file', file);

    const response = await axios_Client.post(`/api/channels/${channelId}/messages`, formData, {
        headers: {
            "Content-Type": "multipart/form-data",
        },
    });
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

// Edit Message
export const editMessage = async (channelId, messageId, content) => {
    const response = await axios_Client.patch(`/api/channels/${channelId}/messages/${messageId}`, { content });
    return response.data;
};

// Delete Message
export const deleteMessage = async (channelId, messageId) => {
    const response = await axios_Client.delete(`/api/channels/${channelId}/messages/${messageId}`);
    return response.data;
};
