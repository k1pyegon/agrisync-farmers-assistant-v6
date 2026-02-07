const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { getDatabaseContext } = require('./src/database');
const { generateSmartResponse } = require('./src/ai');
const { checkTriggers } = require('./src/triggers');
const { logToSheet } = require('./src/sheets');
require('dotenv').config();

const chatHistory = new Map();
const processedIds = new Set();

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { 
        headless: true, 
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', // 👈 Prevents memory crashes
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ] 
    }
});

client.on('qr', (qr) => { qrcode.generate(qr, { small: true }); });

client.on('ready', () => { console.log('✅ FARMERS ASSISTANT IS ONLINE'); });

client.on('message_create', async msg => {
    if (msg.isStatus || msg.fromMe || processedIds.has(msg.id.id)) return;
    processedIds.add(msg.id.id);

    const phone = msg.from.replace('@c.us', '');
    const logContent = msg.hasMedia ? `[Media: ${msg.type}]` : msg.body;
    
    // 📊 Log Incoming
    if (logToSheet) await logToSheet(phone, 'Farmer', logContent, "Incoming");

    // ⚡ Check Triggers (Menu, etc)
    const triggerAction = checkTriggers(msg.body.toLowerCase().trim());
    if (triggerAction) {
        await client.sendMessage(msg.from, triggerAction.reply);
        if (logToSheet) await logToSheet(phone, 'Bot', triggerAction.reply, `TRIGGER: ${triggerAction.type}`);
        return; 
    }

    // 🧠 AI Response
    try {
        const dataContext = getDatabaseContext(msg.body);
        let mediaPart = null;
        if (msg.hasMedia) {
            const media = await msg.downloadMedia();
            mediaPart = { inlineData: { data: media.data, mimeType: media.mimetype }, isAudio: (msg.type === 'ptt') };
        }

        let userHistory = chatHistory.get(msg.from) || [];
        const historyText = userHistory.map(h => `${h.role}: ${h.text}`).join("\n");

        const replyText = await generateSmartResponse(historyText, dataContext, msg.body, mediaPart);
        await client.sendMessage(msg.from, replyText);
        
        if (logToSheet) await logToSheet(phone, 'Bot', replyText, "AI Response");

        userHistory.push({ role: 'User', text: logContent }, { role: 'Assistant', text: replyText });
        chatHistory.set(msg.from, userHistory.slice(-6));
    } catch (e) { console.error("Error:", e.message); }
});

client.initialize();
