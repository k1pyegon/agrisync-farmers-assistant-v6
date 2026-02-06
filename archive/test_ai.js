require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testBrain() {
    console.log("🧠 Testing AI Connection...");

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.error("❌ ERROR: No GEMINI_API_KEY found in .env file!");
        return;
    }
    console.log(`🔑 API Key found (starts with): ${key.substring(0, 5)}...`);

    try {
        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = "Hello! Are you working?";
        const result = await model.generateContent(prompt);
        const response = await result.response;
        
        console.log("✅ SUCCESS! AI Replied:", response.text());
    } catch (error) {
        console.error("💥 AI BROKEN:", error.message);
    }
}

testBrain();
