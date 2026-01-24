const { GoogleGenerativeAI } = require("@google/generative-ai");
const { SYSTEM_INSTRUCTION } = require('./persona'); 
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 🧠 BRAIN 1: The New Lite Model (Hits limits fast)
const primaryModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// 🧠 BRAIN 2: The Reliable Backup (Unlimited*)
// ✅ FIX: Using the alias that we confirmed works for your account
const backupModel = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

async function generateSmartResponse(historyContext, dataContext, userText, mediaPart) {
    let promptParts = [];

    // Build Prompt
    const fullPrompt = `
    ${SYSTEM_INSTRUCTION}
    
    CONTEXT:
    ${historyContext}
    
    DATABASE INFO:
    ${dataContext}
    `;

    promptParts.push(fullPrompt);

    // Clean Media Handling
    if (mediaPart) {
        const cleanApiPart = { inlineData: mediaPart.inlineData };
        promptParts.push(cleanApiPart);

        if (mediaPart.isAudio) {
            promptParts.push("Listen to this farmer's voice note and provide a technical, actionable answer in English.");
        } else {
            promptParts.push("Diagnose this crop issue from the photo. Provide specific chemical treatment with dosage.");
        }
    } else {
        promptParts.push(`User Query: ${userText}`);
    }

    // 🔄 SMART EXECUTION STRATEGY
    try {
        // Attempt 1: Try Primary (Lite)
        const result = await primaryModel.generateContent(promptParts);
        return result.response.text();
    } catch (primaryError) {
        console.log(`⚠️ Primary Brain Busy/Limit. Switching to Backup...`);
        
        // Attempt 2: Try Backup (Standard) immediately
        try {
            const result = await backupModel.generateContent(promptParts);
            return result.response.text();
        } catch (backupError) {
            console.error("❌ Both Brains Failed:", backupError.message);
            throw backupError;
        }
    }
}

module.exports = { generateSmartResponse };