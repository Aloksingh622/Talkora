import axios_Client from "../utils/axios";

// Create Channel
export const createChannel = async (serverId, name) => {
    const response = await axios_Client.post(`/api/servers/${serverId}/channels`, { name });
    return response.data;
};
export const getChannels = async (serverId) => {
    const response = await axios_Client.get(`/api/servers/${serverId}/channels`);
    return response.data;
};

export const deleteChannel = async (channelId) => {
    const response = await axios_Client.delete(`/api/channels/${channelId}`);
    return response.data;
};
