import axios_Client from "../utils/axios";

// Create Server
export const createServer = async (formData) => {
    const response = await axios_Client.post("/api/servers", formData, {
        headers: {
            "Content-Type": "multipart/form-data",
        },
    });
    return response.data;
};

// Get My Servers
export const getMyServers = async () => {
    const response = await axios_Client.get("/api/servers");
    return response.data;
};

// Join Server
export const joinServer = async (serverId) => {
    const response = await axios_Client.post(`/api/servers/${serverId}/join`);
    return response.data;
};

// Leave Server
export const leaveServer = async (serverId) => {
    const response = await axios_Client.post(`/api/servers/${serverId}/leave`);
    return response.data;
};

export const deleteServer = async (serverId) => {
    const response = await axios_Client.delete(`/api/servers/${serverId}`);
    return response.data;
};
