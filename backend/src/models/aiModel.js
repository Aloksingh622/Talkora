const { GoogleGenAI } = require("@google/genai");
const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey });

module.exports = ai;