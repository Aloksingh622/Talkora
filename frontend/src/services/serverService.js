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

// Search Servers
export const searchServers = async (query) => {
    const response = await axios_Client.get(`/api/servers/search?query=${query}`);
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

// Request to join a private server
export const requestJoinServer = async (serverId) => {
    const response = await axios_Client.post(`/api/servers/${serverId}/request`);
    return response.data;
};

// Get join requests for a server (Owner only)
export const getJoinRequests = async (serverId, query = '') => {
    const response = await axios_Client.get(`/api/servers/${serverId}/requests?query=${query}`);
    return response.data;
};

// Respond to a join request (Approve/Reject)
export const respondToJoinRequest = async (serverId, requestId, status) => {
    const response = await axios_Client.post(`/api/servers/${serverId}/requests/${requestId}/respond`, { status });
    return response.data;
};

// Get server by invite code
export const getInvite = async (code) => {
    const response = await axios_Client.get(`/api/servers/invite/${code}`);
    return response.data;
};

// Update server settings (Owner only)
export const updateServerSettings = async (serverId, formData) => {
    const response = await axios_Client.patch(`/api/servers/${serverId}/settings`, formData, {
        headers: {
            "Content-Type": "multipart/form-data",
        },
    });
    return response.data;
};

// Transfer server ownership (Owner only)
export const transferOwnership = async (serverId, newOwnerId) => {
    const response = await axios_Client.post(`/api/servers/${serverId}/transfer-ownership`, {
        newOwnerId
    });
    return response.data;
};

// Get audit logs (Owner only)
export const getAuditLogs = async (serverId, page = 1, limit = 50, action = null) => {
    let url = `/api/servers/${serverId}/audit-logs?page=${page}&limit=${limit}`;
    if (action) {
        url += `&action=${action}`;
    }
    const response = await axios_Client.get(url);
    return response.data;
};

