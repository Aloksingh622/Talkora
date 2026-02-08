const { GoogleGenAI } = require("@google/genai");

const enhanceMessage = async (req, res) => {
    try {
        const { content } = req.body;

        if (!content || content.trim() === '') {
            return res.status(400).json({ message: "Message content is required" });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error("GEMINI_API_KEY is not defined in environment variables");
            return res.status(500).json({ message: "AI service configuration missing" });
        }

        const ai = new GoogleGenAI({
            apiKey: apiKey
        });

        // Using the syntax and model provided by the user
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: content,
            config: {
                systemInstruction: "You are a professional editor. Refine and enhance the following chat message to make it clearer, more professional, or better phrased while maintaining its original intent and tone. Output ONLY the enhanced text content, without quotes or additional comments.",
            },
        });

        // The response structure might differ slightly from @google/generative-ai
        // Based on the snippet, response.text contains the result
        const enhancedText = response.text.trim();

        // Remove any surrounding quotes just in case
        const cleanedText = enhancedText.replace(/^"|"$/g, '');

        res.status(200).json({
            original: content,
            enhanced: cleanedText
        });
    } catch (err) {
        console.error("AI Enhance Error:", err);
        res.status(500).json({ message: "Failed to enhance message using Gemini AI" });
    }
};

const summarizeMessages = async (req, res) => {
    try {
        const { channelId } = req.params;
        const { type, value } = req.body; // type: 'time' or 'count', value: e.g., 1 (hour) or 50 (messages)

        if (!channelId) {
            return res.status(400).json({ message: "Channel ID is required" });
        }

        const prisma = require('../utils/prisma');
        const channelIdInt = parseInt(channelId);

        let messages = [];
        if (type === 'count') {
            messages = await prisma.message.findMany({
                where: { channelId: channelIdInt },
                take: parseInt(value) || 50,
                orderBy: { createdAt: 'desc' },
                include: { user: { select: { username: true } } }
            });
        } else {
            const hours = parseInt(value) || 1;
            const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
            messages = await prisma.message.findMany({
                where: {
                    channelId: channelIdInt,
                    createdAt: { gte: startTime }
                },
                orderBy: { createdAt: 'desc' },
                include: { user: { select: { username: true } } }
            });
        }

        if (messages.length === 0) {
            return res.status(200).json({ summary: "No messages found to summarize." });
        }

        // Reverse to get chronological order for Gemini context
        const history = messages.reverse().map(msg => ({
            role: "user",
            parts: [{ text: `${msg.user.username}: ${msg.content}` }]
        }));

        const apiKey = process.env.GEMINI_API_KEY;
        const ai = new GoogleGenAI(apiKey);

        const chat = ai.chats.create({
            model: "gemini-3-flash-preview",
            history: history,
        });

        const response = await chat.sendMessage({
            message: "Summarize the above chat history concisely. Focus on the main topics discussed and any key decisions or information shared.",
        });

        res.status(200).json({
            summary: response.text.trim(),
            count: messages.length
        });
    } catch (err) {
        console.error("AI Summarize Error:", err);
        res.status(500).json({ message: "Failed to summarize chat history" });
    }
};

const askChatbot = async (req, res) => {
    console.log("DEBUG: Backend askChatbot called with body:", req.body);
    try {
        const { question } = req.body;

        if (!question || question.trim() === '') {
            console.warn("DEBUG: Empty question received");
            return res.status(400).json({ message: "Question is required" });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error("DEBUG: GEMINI_API_KEY is missing");
            return res.status(500).json({ message: "AI service configuration missing" });
        }

        const ai = new GoogleGenAI({
            apiKey: apiKey
        });

        console.log("DEBUG: Generating content with Gemini (gemini-3-flash-preview)...");
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: question,
            config: {
                systemInstruction: "You are the SparkHub assistant. Answer the following question accurately and concisely. Maintain a helpful and professional tone.",
            },
        });

        const text = response.text.trim();
        console.log("DEBUG: Generated response:", text);

        res.status(200).json({
            question,
            answer: text
        });
    } catch (err) {
        console.error("DEBUG: AI Chatbot Error:", err);
        res.status(500).json({ message: "Failed to get response from SparkHub AI" });
    }
};



module.exports = {
    enhanceMessage,
    summarizeMessages,
    askChatbot
};


