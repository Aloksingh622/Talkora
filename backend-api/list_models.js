const fs = require('fs');
require('dotenv').config();

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("No API KEY found in .env");
        return;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        fs.writeFileSync('models.json', JSON.stringify(data, null, 2));
        console.log("Models written to models.json");
    } catch (error) {
        console.error("Error fetching models:", error);
    }
}

listModels();
