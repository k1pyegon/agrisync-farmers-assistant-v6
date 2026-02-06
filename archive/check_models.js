const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
  try {
    const models = await genAI.getGenerativeModel({ model: "gemini-pro" }).apiKey; 
    // Note: The SDK doesn't have a direct 'listModels' in some versions, 
    // so we use a direct fetch to be 100% sure.

    const key = process.env.GEMINI_API_KEY;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    const data = await response.json();

    console.log("=== AVAILABLE MODELS ===");
    if (data.models) {
        data.models.forEach(m => {
            // Only show models that support generating content
            if (m.supportedGenerationMethods.includes("generateContent")) {
                console.log(`✅ ${m.name.replace("models/", "")}`);
            }
        });
    } else {
        console.log("No models found. Check your API Key.");
        console.log(data);
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

listModels();