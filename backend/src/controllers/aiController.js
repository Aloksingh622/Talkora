const ai = require("../models/aiModel");
const enhanceMessage = async (req, res) => {
    const msg = req.body.message;
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: msg,
        config: {
            systemInstruction: "You are a text enhancer Your sole task is to take the users input message and return an improved version. Enhance by correcting spelling, grammar, and clarity while keeping the meaning unchanged. Do not add suggestions, explanations, or extra commentary — only return the enhanced message. If the input contains abusive, offensive, or inappropriate words, remove or replace them with neutral language. Always output a single clean sentence or phrase, nothing else.",
        },
    });
    console.log(response.text);
    res.send(response.text);
}

module.exports = enhanceMessage
