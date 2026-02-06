const { GoogleGenerativeAI } = require("@google/generative-ai");
const { SYSTEM_INSTRUCTION } = require('./persona'); 
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ✅ MODELS (Based on your approved list)
const primaryModel = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
const backupModel = genAI.getGenerativeModel({ model: "gemini-flah-lite" });

async function generateSmartResponse(historyContext, dataContext, userText, mediaPart) {
    let promptParts = [];

    // 🌾 THE "SILENT PARTNER" PROMPT 🌾
    const fullPrompt = `
    ${SYSTEM_INSTRUCTION}

    CONTEXT:
    ${historyContext}

    DATABASE INFO:
    ${dataContext}

    🎯 RESPONSE RULES (STRICT):
    1. **Format:** Your answers MUST use this specific structure for advice:
       * **Diagnosis:** [One sentence identifying the issue]
       * **Remedy:** [The recommended product]
       * **Application:** [Dosage and method]
       * **Timing:** [When to apply]
    
    2. **Name Usage:** Do NOT use the user's name in every message. It is annoying. Only use it once at the very start of a new conversation or for serious alerts.
    
    3. **Location:** Use the location (Kericho) to filter your advice (e.g. recommend high-altitude crops), but do NOT say "Since you are in Kericho" unless strictly necessary. Just give the correct advice for that region naturally.

    4. **Small Talk:** If the user says "Thank you", "Great", or "Okay", simply reply: "Karibu sana! Happy farming." (Do not give new advice).
    `;

    promptParts.push(fullPrompt);

    // Clean Media Handling
    if (mediaPart) {
        const cleanApiPart = { inlineData: mediaPart.inlineData };
        promptParts.push(cleanApiPart);

        if (mediaPart.isAudio) {
            promptParts.push("Listen to this voice note. Output ONLY the technical advice in the structured format above.");
        } else {
            promptParts.push("Diagnose this photo. Output ONLY the technical advice in the structured format above (Diagnosis, Remedy, Application, Timing).");
        }
    } else {
        promptParts.push(`User Query: ${userText}`);
    }

    // 🔄 SMART EXECUTION (Primary -> Backup)
    try {
        console.log("🧠 AI Attempt: PRIMARY Brain...");
        const result = await primaryModel.generateContent(promptParts);
        return result.response.text();

    } catch (primaryError) {
        console.warn(`⚠️ Primary Brain Limit (${primaryError.message.split('[')[0]}). Switching to Backup...`);
        
        try {
            console.log("🔄 AI Attempt: BACKUP Brain...");
            const result = await backupModel.generateContent(promptParts);
            return result.response.text();
        } catch (backupError) {
            console.error("❌ Both Brains Failed:", backupError.message);
            return "My connection is a bit weak right now. Please ask me again in a moment. 🌾";
        }
    }
}

module.exports = { generateSmartResponse };
