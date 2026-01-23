import axios_Client from '../utils/axios';

/**
 * Kick a member from the server
 */
export const kickMember = async (serverId, userId) => {
    const response = await axios_Client.post(`/api/servers/${serverId}/members/${userId}/kick`);
    return response.data;
};

/**
 * Ban a member from the server
 */
export const banMember = async (serverId, userId, reason = null, deleteMessages = false) => {
    const response = await axios_Client.post(`/api/servers/${serverId}/members/${userId}/ban`, {
        reason,
        deleteMessages
    });
    return response.data;
};

/**
 * Unban a member
 */
export const unbanMember = async (serverId, userId) => {
    const response = await axios_Client.delete(`/api/servers/${serverId}/bans/${userId}`);
    return response.data;
};

/**
 * Get all banned members
 */
export const getBannedMembers = async (serverId) => {
    const response = await axios_Client.get(`/api/servers/${serverId}/bans`);
    return response.data;
};

/**
 * Timeout a member
 */
export const timeoutMember = async (serverId, userId, duration, reason = null) => {
    const response = await axios_Client.post(`/api/servers/${serverId}/members/${userId}/timeout`, {
        duration, // in seconds
        reason
    });
    return response.data;
};

/**
 * Remove timeout from a member
 */
export const removeTimeout = async (serverId, userId) => {
    const response = await axios_Client.delete(`/api/servers/${serverId}/members/${userId}/timeout`);
    return response.data;
};

/**
 * Get all active timeouts
 */
export const getActiveTimeouts = async (serverId) => {
    const response = await axios_Client.get(`/api/servers/${serverId}/timeouts`);
    return response.data;
};

// Check if current user is banned or timed out
export const getMyMemberStatus = async (serverId) => {
    const response = await axios_Client.get(`/api/servers/${serverId}/members/me/status`);
    return response.data;
};

export default {
    kickMember,
    banMember,
    unbanMember,
    getBannedMembers,
    timeoutMember,
    removeTimeout,
    getActiveTimeouts
};
