const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { getDatabaseContext } = require('./src/database');
const { generateSmartResponse } = require('./src/ai');
const { checkTriggers } = require('./src/triggers');
const { logToSheet } = require('./src/sheets');
require('dotenv').config();

const chatHistory = new Map();
const processedIds = new Set();

// 🛡️ ROBUST ADMIN CONFIGURATION
// This checks for ADMIN_NUMBER or ADMIN_PHONE to avoid .env errors
const ADMIN_NUMBER = process.env.ADMIN_NUMBER || process.env.ADMIN_PHONE;

if (!ADMIN_NUMBER) {
    console.error("⚠️ WARNING: No Admin Number found in .env! Admin commands will not work.");
} else {
    console.log(`🔒 Admin System Active for: ${ADMIN_NUMBER}`);
}

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { 
        headless: true, 
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote', '--disable-gpu'] 
    }
});

client.on('qr', (qr) => { qrcode.generate(qr, { small: true }); });

client.on('ready', () => { 
    console.log('✅ FARMERS ASSISTANT IS ONLINE');
    console.log(`📱 Connected as: ${client.info.wid.user}`);
});

client.on('message_create', async msg => {
    // 🛑 1. PREVENT LOOPS & DUPLICATES
    if (msg.isStatus || processedIds.has(msg.id.id)) return;
    processedIds.add(msg.id.id);

    const rawFrom = msg.from;
    const senderNumber = rawFrom.replace('@c.us', '');
    const isMe = msg.fromMe;
    const cleanBody = msg.body.trim(); // Removes accidental spaces at start/end

// 👮‍♂️ 2. ADMIN COMMANDS
    // We check if it STARTS with "!dm" first. 
    // If it doesn't, we skip this whole block (so "hi" doesn't trigger errors).
    if (cleanBody.toLowerCase().startsWith('!dm') || cleanBody.toLowerCase().startsWith('! dm')) {
        
        // 🔒 AUTHENTICATION
        // Fix: If 'isMe' is true, we trust you immediately. 
        // We don't compare numbers because of the confusing '@lid' issue.
        const isAuthorized = (senderNumber === ADMIN_NUMBER) || isMe;

        if (isAuthorized) {
            console.log(`🔐 Admin Command Received from ${senderNumber}`);
            try {
                // Remove the "!dm" part
                const args = cleanBody.replace(/^!\s?dm\s*/i, '').split(/\s+/);
                
                // args[0] is the target number, the rest is the message
                const targetPhone = args[0].includes('@') ? args[0] : args[0] + '@c.us';
                const messageContent = args.slice(1).join(' '); 

                if (!args[0] || !messageContent) throw new Error("Missing info");

                await client.sendMessage(targetPhone, messageContent);
                console.log(`✅ Sent to ${args[0]}: "${messageContent}"`);

                if (!isMe) await client.sendMessage(msg.from, `✅ Sent to ${args[0]}`);

                if (logToSheet) await logToSheet(args[0], 'Bot (Initiated)', messageContent, "Admin Outreach");

            } catch (error) {
                console.error("❌ Admin Error:", error.message);
                if (!isMe) await client.sendMessage(msg.from, '❌ Usage: !dm 254712345678 Message');
            }
        } else {
            // This log ONLY prints if someone tries "!dm" but isn't you.
            console.log(`⛔ Unauthorized Admin Attempt from ${senderNumber}`);
        }
        return; // 🛑 STOP HERE for all "!dm" messages (authorized or not)
    }

    // 🛑 3. IGNORE MYSELF (Standard Bot Behavior)
    // Now that Admin checks are done, we can safely ignore other messages from the host phone
    if (isMe) return;

    // 🚜 4. REGULAR FARMER INTERACTION
    const logContent = msg.hasMedia ? `[Media: ${msg.type}]` : msg.body;
    
    // 📊 Log Incoming
    if (logToSheet) await logToSheet(senderNumber, 'Farmer', logContent, "Incoming");

    // ⚡ Check Triggers (Menu, specific words)
    const triggerAction = checkTriggers(msg.body.toLowerCase().trim());
    if (triggerAction) {
        await client.sendMessage(msg.from, triggerAction.reply);
        if (logToSheet) await logToSheet(senderNumber, 'Bot', triggerAction.reply, `TRIGGER: ${triggerAction.type}`);
        return; 
    }

    // 🧠 AI Processing
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
        
        if (logToSheet) await logToSheet(senderNumber, 'Bot', replyText, "AI Response");

        userHistory.push({ role: 'User', text: logContent }, { role: 'Assistant', text: replyText });
        chatHistory.set(msg.from, userHistory.slice(-6));
    } catch (e) { 
        console.error("Error generating response:", e.message); 
    }
});

client.initialize();
