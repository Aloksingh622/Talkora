import axios_Client from "../utils/axios";

export const getUserPresence = async (userId) => {
    const response = await axios_Client.get(`/api/users/${userId}/presence`);
    return response.data;
};
