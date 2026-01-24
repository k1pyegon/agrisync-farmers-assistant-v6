// src/triggers.js

const DANGER_WORDS = ['poison', 'death', 'died', 'kill', 'suicide', 'accident', 'hospital', 'emergency', 'swallowed','chocking'];
const SUPPORT_WORDS = ['agent', 'support', 'human', 'call', 'admin', 'help me'];

function checkTriggers(text) {
    const cleanText = text.toLowerCase().trim();
    console.log(`🔎 Checking Triggers for: "${cleanText}"`);

    // 1. 🚨 DANGER CHECK (Logs to CSV)
    if (DANGER_WORDS.some(word => cleanText.includes(word))) {
        return {
            type: 'DANGER',
            logToCsv: true,
            reply: "🚨 **EMERGENCY DETECTED** 🚨\n\n" +
                   "Please stop handling chemicals immediately.\n" +
                   "Call the National Poison Board: **0800 720 021**\n" +
                   "Or rush to the nearest hospital.\n\n" +
                   "I have notified a human agent to check this chat."
        };
    }

    // 2. 📞 SUPPORT CHECK (Logs to CSV)
    if (SUPPORT_WORDS.some(word => cleanText.includes(word))) {
        return {
            type: 'SUPPORT',
            logToCsv: true,
            reply: "📞 You can reach our Head Office support line at: **0700-123-456** (Mon-Fri, 8am-5pm).\n\n" +
                   "I have logged your request for a callback."
        };
    }

    // 3. 📜 MENU / WELCOME MESSAGE (Updated)
    if (['hi', 'hello', 'habari', 'start', 'menu', 'niaje'].includes(cleanText)) {
        return {
            type: 'MENU',
            logToCsv: false,
            reply: "Habari Mkulima! 🌾\n\n" +
                   "It's me, your Field Officer. I hope the shamba is doing well? I am here to share knowledge and help you solve any challenges you are facing today. 🤝\n\n" +
                   "What are we working on? You can explain it to me, or:\n\n" +
                   "1. 📸 *Send a Photo* (If you see a sick crop)\n" +
                   "2. 🎙️ *Send a Voice Note* (Ask for expert advice)\n\n" +
                   "I'm listening!"
        };
    }

    console.log("❌ No trigger matched. Sending to AI...");
    return null;
}

module.exports = { checkTriggers };