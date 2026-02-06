const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { logConversation } = require('./src/logger');
const { getDatabaseContext } = require('./src/database');
const { generateSmartResponse } = require('./src/ai');
const { checkTriggers } = require('./src/triggers'); 
const { logCriticalEvent } = require('./src/csv_logger'); 
// 👇 Import the Sheets Logger (Make sure src/sheets.js exists!)
const { logToSheet } = require('./src/sheets'); 
require('dotenv').config();

const chatHistory = new Map();
const processedIds = new Set();

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    console.log('SCAN QR CODE NOW:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ FARMERS ASSISTANT IS ONLINE');
});

client.on('message_create', async msg => {
    if (msg.isStatus || msg.type === 'e2e_notification' || msg.fromMe) return;
    if (processedIds.has(msg.id.id)) return;
    processedIds.add(msg.id.id);

    console.log(`📩 Message from ${msg.from}: "${msg.body}"`);
    
    // Log incoming message to CSV & Sheets
    const logContent = msg.hasMedia ? `[Media: ${msg.type}]` : msg.body;
    logConversation(msg.from.replace('@c.us', ''), 'Farmer', logContent);
    // 📊 Log to Sheets
    logToSheet(msg.from.replace('@c.us', ''), 'Farmer', logContent, "Incoming");

    const text = msg.body.toLowerCase().trim();

    // ⚡ STEP 1: CHECK TRIGGERS
    const triggerAction = checkTriggers(text);

    if (triggerAction) {
        console.log(`⚡ Trigger Activated: ${triggerAction.type}`);
        
        // 🚨 CRITICAL LOGGING & ADMIN ALERT
        if (triggerAction.logToCsv) {
            logCriticalEvent(msg.from.replace('@c.us', ''), triggerAction.type, msg.body);
            
            // 📊 Log Critical Event to Sheets
            logToSheet(msg.from.replace('@c.us', ''), 'Farmer', msg.body, `TRIGGER: ${triggerAction.type}`);

            if (process.env.ADMIN_PHONE) {
                const adminMsg = `🚨 *ADMIN ALERT* 🚨\n\n` +
                                 `**Type:** ${triggerAction.type}\n` +
                                 `**Farmer:** ${msg.from.replace('@c.us', '')}\n` +
                                 `**Message:** "${msg.body}"\n\n` +
                                 `_Check this immediately._`;
                
                await client.sendMessage(process.env.ADMIN_PHONE + '@c.us', adminMsg);
            }
        }

        // Send Reply to Farmer
        await client.sendMessage(msg.from, triggerAction.reply);
        
        logConversation(msg.from.replace('@c.us', ''), 'System', triggerAction.type);
        // 📊 Log Reply to Sheets
        logToSheet(msg.from.replace('@c.us', ''), 'Bot', triggerAction.reply, "Auto-Reply");
        
        return; 
    }

    // 🧠 STEP 2: AI PROCESSING (The part that was broken)
    try {
        const dataContext = getDatabaseContext(text);

        let mediaPart = null;
        if (msg.hasMedia) {
            const media = await msg.downloadMedia();
            mediaPart = { 
                inlineData: { data: media.data, mimeType: media.mimetype },
                isAudio: (msg.type === 'ptt' || msg.type === 'audio')
            };
            if (mediaPart.isAudio) await client.sendMessage(msg.from, "👂...");
        }

        let userHistory = chatHistory.get(msg.from) || [];
        const historyContext = userHistory.map(entry => `${entry.role}: ${entry.text}`).join("\n");

        // Call AI
        const replyText = await generateSmartResponse(historyContext, dataContext, msg.body, mediaPart);

        // Send Reply
        await client.sendMessage(msg.from, replyText);
        
        logConversation(msg.from.replace('@c.us', ''), 'Bot', replyText);
        // 📊 Log AI Reply to Sheets
        logToSheet(msg.from.replace('@c.us', ''), 'Bot', replyText, "AI Response");

        // Update History
        userHistory.push({ role: 'User', text: msg.hasMedia ? `[${msg.type}]` : msg.body });
        userHistory.push({ role: 'Assistant', text: replyText });
        if (userHistory.length > 6) userHistory = userHistory.slice(-6);
        chatHistory.set(msg.from, userHistory);

    } catch (error) { // <--- This is the Catch Block you were missing!
        console.error("❌ System Error:", error.message);
        // await client.sendMessage(msg.from, "Network error. Please try again.");
    }
});

client.initialize();
