import axios_Client from "../utils/axios";

export const enhanceMessage = async (text) => {
    try {
        const response = await axios_Client.post("/api/ai/enhanceMsg", { message: text });
        console.log("message is :", response);
        return response.data;
    } catch (error) {
        console.error("Error enhancing message:", error);
        throw error;
    }
};
