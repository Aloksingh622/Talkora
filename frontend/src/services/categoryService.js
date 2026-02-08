import axios_Client from '../utils/axios';

export const createCategory = async (serverId, name) => {
    const response = await axios_Client.post(`/api/categories/${serverId}`, { name });
    return response.data;
};

export const getCategories = async (serverId) => {
    const response = await axios_Client.get(`/api/categories/${serverId}`);
    return response.data;
};

export const updateCategory = async (categoryId, name) => {
    const response = await axios_Client.patch(`/api/categories/${categoryId}`, { name });
    return response.data;
};

export const deleteCategory = async (categoryId) => {
    const response = await axios_Client.delete(`/api/categories/${categoryId}`);
    return response.data;
};
