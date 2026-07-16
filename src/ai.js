require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { SYSTEM_INSTRUCTION } = require('../persona'); 

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 🧠 PRIMARY BRAIN: Gemini 2.5 Flash
const primaryModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// 🧠 BACKUP BRAIN: Gemini 2.5 Flash Lite
const backupModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

async function generateSmartResponse(historyContext, dataContext, userText, mediaPart) {
    let promptParts = [];

    // --- STEP 1: BUILD THE CONTEXT ---
    const fullPrompt = `
    ${SYSTEM_INSTRUCTION}
    
    CHAT HISTORY:
    ${historyContext}
    
    🚨 IMPORTANT LOCAL DATA (PRIORITY):
    ${dataContext ? dataContext : "(No specific local shops found. Ask for their town.)"}
    
    INSTRUCTIONS:
    1. If specific shops are listed above, you MUST recommend them.
    2. Do NOT say "visit any local agrovet" if partner data is provided.
    3. If no shops are listed, ask: "Which town are you in?"
    `;

    promptParts.push({ text: fullPrompt });

    // --- STEP 2: HANDLE MEDIA ---
    if (mediaPart) {
        if (!mediaPart.isAudio) {
            promptParts.push({ inlineData: mediaPart.inlineData });
            promptParts.push({ text: `User Query: ${userText || "Diagnose this image."}` });
        } else {
            // 📊 ZAO UPGRADE: Audio fallback must return an object now
            return {
                text: "Pole sana Mkulima, siwezi kusikiliza sauti kwa sasa. Tafadhali andika ujumbe wako au tuma picha! 🚜",
                tokens: 0,
                failed: true
            };
        }
    } else {
        promptParts.push({ text: `User Query: ${userText || "Hello"}` });
    }

    // --- STEP 3: TRY PRIMARY BRAIN (2.5 FLASH) ---
    try {
        const result = await primaryModel.generateContent({
            contents: [{ role: "user", parts: promptParts }],
            generationConfig: {
                temperature: 0.1, // Keeps the formatting clean (No Bolding)
            }
        });
        
        // 📊 ZAO UPGRADE: Return tokens alongside text
        return { 
            text: result.response.text(), 
            tokens: result.response.usageMetadata?.totalTokenCount || 0 
        };

    } catch (primaryError) {
        console.log(`⚠️ Primary Brain Failed/Busy. Switching to Backup (2.5 Flash Lite)...`);

        // --- STEP 4: EMERGENCY BACKUP (2.5 LITE) ---
        try {
            const backupResult = await backupModel.generateContent({
                contents: [{ role: "user", parts: promptParts }],
                generationConfig: {
                    temperature: 0.1,
                }
            });
            
            // 📊 ZAO UPGRADE: Return tokens alongside text
            return { 
                text: backupResult.response.text(), 
                tokens: backupResult.response.usageMetadata?.totalTokenCount || 0 
            };

        } catch (backupError) {
            console.error("❌ Both Brains Failed:", backupError.message);
            // 📊 ZAO UPGRADE: Return the failover object
            return {
                text: "Pole sana Mkulima, nina shida kidogo ya mtandao kwa sasa. Tafadhali jaribu tena baada ya dakika chache! 🚜",
                tokens: 0,
                failed: true
            };
        }
    }
}

module.exports = { generateSmartResponse };
