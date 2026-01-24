const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { logConversation } = require('./src/logger');
const { getDatabaseContext } = require('./src/database');
const { generateSmartResponse } = require('./src/ai');
const { checkTriggers } = require('./src/triggers'); 
const { logCriticalEvent } = require('./src/csv_logger'); 
require('dotenv').config(); // Load .env for Admin Number

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
    const logContent = msg.hasMedia ? `[Media: ${msg.type}]` : msg.body;
    logConversation(msg.from.replace('@c.us', ''), 'Farmer', logContent);

    const text = msg.body.toLowerCase().trim();

    // ⚡ STEP 1: CHECK TRIGGERS
    const triggerAction = checkTriggers(text);

    if (triggerAction) {
        console.log(`⚡ Trigger Activated: ${triggerAction.type}`);
        
        // 🚨 CRITICAL LOGGING & ADMIN ALERT
        if (triggerAction.logToCsv) {
            // 1. Save to File
            logCriticalEvent(msg.from.replace('@c.us', ''), triggerAction.type, msg.body);

            // 2. Notify Admin via WhatsApp
            if (process.env.ADMIN_PHONE) {
                const adminMsg = `🚨 *ADMIN ALERT* 🚨\n\n` +
                                 `**Type:** ${triggerAction.type}\n` +
                                 `**Farmer:** ${msg.from.replace('@c.us', '')}\n` +
                                 `**Message:** "${msg.body}"\n\n` +
                                 `_Check this immediately._`;
                
                // Send to Admin
                await client.sendMessage(process.env.ADMIN_PHONE + '@c.us', adminMsg);
                console.log(`📲 Alert sent to Admin (${process.env.ADMIN_PHONE})`);
            }
        }

        // Send Reply to Farmer
        await client.sendMessage(msg.from, triggerAction.reply);
        logConversation(msg.from.replace('@c.us', ''), 'System', triggerAction.type);
        return; 
    }

    // 🧠 STEP 2: AI PROCESSING
    try {
        const dataContext = getDatabaseContext(text);

        let mediaPart = null;
        if (msg.hasMedia) {
            const media = await msg.downloadMedia();
            mediaPart = { 
                inlineData: { data: media.data, mimeType: media.mimetype },
                isAudio: (msg.type === 'ptt' || msg.type === 'audio')
            };
            if (mediaPart.isAudio) await client.sendMessage(msg.from, "👂 Listening...");
            else await client.sendMessage(msg.from, "👀 Checking photo...");
        }

        let userHistory = chatHistory.get(msg.from) || [];
        const historyContext = userHistory.map(entry => `${entry.role}: ${entry.text}`).join("\n");

        const replyText = await generateSmartResponse(historyContext, dataContext, msg.body, mediaPart);

        await client.sendMessage(msg.from, replyText);
        logConversation(msg.from.replace('@c.us', ''), 'Bot', replyText);

        userHistory.push({ role: 'User', text: msg.hasMedia ? `[${msg.type}]` : msg.body });
        userHistory.push({ role: 'Assistant', text: replyText });
        if (userHistory.length > 6) userHistory = userHistory.slice(-6);
        chatHistory.set(msg.from, userHistory);

    } catch (error) {
        console.error("❌ System Error:", error.message);
        await client.sendMessage(msg.from, "Pole sana, network issue. Please try again.");
    }
});

client.initialize();