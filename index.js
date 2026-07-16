const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { getDatabaseContext = () => "" } = require('./src/database');
const { generateSmartResponse } = require('./src/ai');
const { checkTriggers } = require('./src/triggers');
const { logToSheet } = require('./src/sheets');
const { getChatHistory, saveChatMessage } = require('./src/history'); 
const { syncShopsFromSheet, getShopCache } = require('./src/shops');
require('dotenv').config();

const processedIds = new Set();
const MAX_PROCESSED_IDS = 5000; // bound the dedup set so it can't leak memory over the process lifetime

// ⚡ Asynchronous Task Queue
const aiTaskQueue = [];
let isQueueActive = false;

async function processTaskQueue() {
    if (isQueueActive || aiTaskQueue.length === 0) return;
    isQueueActive = true;

    while (aiTaskQueue.length > 0) {
        const currentTask = aiTaskQueue.shift();
        try {
            await currentTask(); 
        } catch (error) {
            console.error("❌ Queue Processing Error:", error.message);
        }
    }
    isQueueActive = false;
}

const ADMIN_NUMBER = process.env.ADMIN_NUMBER || process.env.ADMIN_PHONE;

if (!ADMIN_NUMBER) {
    console.error("⚠️ WARNING: No Admin Number found in .env!");
} else {
    console.log(`🔒 Admin System Active for: ${ADMIN_NUMBER}`);
}

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { 
        headless: true, 
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote']
    }
});

client.on('qr', (qr) => { qrcode.generate(qr, { small: true }); });

client.on('ready', async () => { 
    console.log('✅ FARMERS ASSISTANT IS ONLINE');
    console.log(`📱 Connected as: ${client.info.wid.user}`);
    
    await syncShopsFromSheet();
    setInterval(syncShopsFromSheet, 6 * 60 * 60 * 1000); 
});

client.on('message_create', async msg => {
    // 🛑 1. PREVENT LOOPS & DUPLICATES
    if (msg.isStatus || processedIds.has(msg.id.id)) return;
    processedIds.add(msg.id.id);
    // Evict the oldest id once over the cap (Set preserves insertion order)
    if (processedIds.size > MAX_PROCESSED_IDS) {
        processedIds.delete(processedIds.values().next().value);
    }

    // 🛑 2. ZAO UPGRADE: BLOCK SILENT WHATSAPP SYSTEM MESSAGES
    const ignoredTypes = ['e2e_notification', 'protocol', 'ciphertext', 'call_log', 'gp2', 'broadcast_notification', 'revoked'];
    if (ignoredTypes.includes(msg.type)) {
        console.log(`🔇 Ignored silent system message: ${msg.type}`);
        return; 
    }

    // 🛑 3. IGNORE EMPTY MESSAGES
    if (!msg.body && !msg.hasMedia) return;

    const rawFrom = msg.from;
    const senderNumber = rawFrom.replace('@c.us', '');
    const isMe = msg.fromMe;
    const cleanBody = msg.body ? msg.body.trim() : ""; 

    // 👮‍♂️ ADMIN COMMANDS
    if (cleanBody.toLowerCase().startsWith('!dm') || cleanBody.toLowerCase().startsWith('! dm')) {
        const isAuthorized = (senderNumber === ADMIN_NUMBER) || isMe;
        if (isAuthorized) {
            try {
                const args = cleanBody.replace(/^!\s?dm\s*/i, '').split(/\s+/);
                const targetPhone = args[0].includes('@') ? args[0] : args[0] + '@c.us';
                const messageContent = args.slice(1).join(' '); 

                if (!args[0] || !messageContent) throw new Error("Missing info");

                await client.sendMessage(targetPhone, messageContent);
                console.log(`✅ Sent to ${args[0]}: "${messageContent}"`);

                if (!isMe) await client.sendMessage(msg.from, `✅ Sent to ${args[0]}`);
                if (logToSheet) logToSheet(args[0], 'Bot (Initiated)', messageContent, "Admin Outreach");

            } catch (error) {
                console.error("❌ Admin Error:", error.message);
            }
        }
        return; 
    }

    if (isMe) return;

    const logContent = msg.hasMedia ? `[Media: ${msg.type}]` : msg.body;
    if (logToSheet) logToSheet(senderNumber, 'Farmer', logContent, "Incoming");

    const triggerAction = checkTriggers(cleanBody.toLowerCase());
    if (triggerAction) {
        await client.sendMessage(msg.from, triggerAction.reply);
        if (logToSheet) logToSheet(senderNumber, 'Bot', triggerAction.reply, `TRIGGER: ${triggerAction.type}`);
        return; 
    }

    // 🧠 AI Processing Queue
    aiTaskQueue.push(async () => {
        try {
            // 🗣️ UX UPGRADE: Give the farmer visual feedback instantly
            const chat = await msg.getChat();
            await chat.sendSeen();
            await chat.sendStateTyping(); 

            const dataContext = getDatabaseContext(msg.body, getShopCache());
            let mediaPart = null;
            
            if (msg.hasMedia) {
                const media = await msg.downloadMedia();
                mediaPart = { inlineData: { data: media.data, mimeType: media.mimetype }, isAudio: (msg.type === 'ptt') };
            }

            let userHistory = await getChatHistory(msg.from, 6);
            const historyText = userHistory.map(h => `${h.role}: ${h.text}`).join("\n");

            const startTime = Date.now();
            const aiResponse = await generateSmartResponse(historyText, dataContext, msg.body, mediaPart);
            const latency = Date.now() - startTime;

            await client.sendMessage(msg.from, aiResponse.text);

            if (aiResponse.failed) {
                console.log(`⚠️ [FAILOVER] Sent fallback message to ${senderNumber} after ${latency}ms`);
            } else {
                console.log(`✅ [AI SUCCESS] Replied to ${senderNumber} | Time: ${latency}ms | Tokens: ${aiResponse.tokens}`);
            }

            if (logToSheet) logToSheet(senderNumber, 'Bot', aiResponse.text, "AI Response");

            if (!aiResponse.failed) {
                await saveChatMessage(msg.from, 'User', logContent);
                await saveChatMessage(msg.from, 'Assistant', aiResponse.text);
            }

        } catch (e) { 
            console.error("❌ Critical Queue Error:", e.message); 
            await client.sendMessage(msg.from, "Pole sana Mkulima, mfumo wetu una shida kidogo. Tafadhali jaribu tena baadaye.");
        }
    });

    processTaskQueue();
});

// 🛑 ZAO UPGRADE: GRACEFUL SHUTDOWN (Kills Zombie Browsers)
process.on('SIGINT', async () => {
    console.log("\n🛑 Shutting down gracefully... closing WhatsApp browser.");
    try {
        await client.destroy();
        console.log("✅ Browser closed. Exiting.");
    } catch (e) {
        console.error("❌ Error destroying client:", e.message);
    }
    process.exit(0);
});

client.initialize();
