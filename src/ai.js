const { GoogleGenerativeAI } = require("@google/generative-ai");
const { SYSTEM_INSTRUCTION } = require('./persona'); 
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 🧠 BRAIN 1: The New Lite Model
const primaryModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

// 🧠 BRAIN 2: The Reliable Backup
const backupModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

async function generateSmartResponse(historyContext, dataContext, userText, mediaPart) {
    let promptParts = [];

    // 🔥 STRONGER PROMPT ENGINEERING
    const fullPrompt = `
    ${SYSTEM_INSTRUCTION}
    
    CONTEXT FROM CHAT HISTORY:
    ${historyContext}
    
    🚨 IMPORTANT LOCAL DATA (PRIORITY):
    ${dataContext ? dataContext : "(No specific local shops found in database. Use general knowledge.)"}

    INSTRUCTIONS:
    1. If the "IMPORTANT LOCAL DATA" section above lists specific shops or labs, you **MUST** recommend them.
    2. Do NOT say "visit any local agrovet" if I have provided a specific partner name and phone number above.
    3. If the user asks for a shop but none are listed above, ask them: "Which town are you in?"
    `;

    promptParts.push(fullPrompt);

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
        const result = await primaryModel.generateContent(promptParts);
        return result.response.text();
    } catch (primaryError) {
        console.log(`⚠️ Primary Brain Busy. Switching to Backup...`);
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
