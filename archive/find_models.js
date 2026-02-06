const https = require('https');
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

console.log("🕵️‍♀️ Asking Google for your available models...");

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        const response = JSON.parse(data);
        if (response.error) {
            console.error("❌ API Error:", response.error.message);
        } else if (response.models) {
            console.log("\n✅ AVAILABLE MODELS (Copy one of these names!):");
            console.log("------------------------------------------------");
            response.models.forEach(m => {
                // We only want models that support 'generateContent'
                if (m.supportedGenerationMethods.includes("generateContent")) {
                    console.log(`🌟 ${m.name.replace('models/', '')}`);
                }
            });
            console.log("------------------------------------------------");
        } else {
            console.log("⚠️ No models found. Check your API Key.");
        }
    });
}).on('error', (e) => {
    console.error("Connection Error:", e.message);
});