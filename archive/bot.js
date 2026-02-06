const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs'); 
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ✅ USE THE SMART MODEL (From your available list)
const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash-lite" 
});

const chatHistory = new Map();
const processedIds = new Set();

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// --- 📊 ANALYTICS LOGGER (Clean Date for DB) ---
function logConversation(phoneNumber, messageType, content) {
    const date = new Date();
    const timestamp = date.toLocaleString('en-KE').replace(/,/g, ''); 
    const cleanContent = content ? content.replace(/,/g, " ").replace(/\n/g, " ").substring(0, 100) : "Media";
    const logEntry = `${timestamp},${phoneNumber},${messageType},"${cleanContent}"\n`;
    
    fs.appendFile('farmer_data.csv', logEntry, (err) => { 
        if (err) console.error("❌ Log Error:", err); 
    });
}

// --- 🔄 AUTO-RETRY HELPER ---
async function generateWithRetry(promptParts, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const result = await model.generateContent(promptParts);
            return await result.response.text();
        } catch (error) {
            if (error.message.includes('429') && i < retries - 1) {
                console.log(`⚠️ Rate Limit Hit. Waiting 10s before retry ${i+1}...`);
                await new Promise(resolve => setTimeout(resolve, 10000)); 
            } else {
                throw error; 
            }
        }
    }
}

client.on('qr', (qr) => {
    console.log('SCAN QR CODE NOW:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ FARMERS ASSISTANT IS ONLINE (Field Officer Mode 🚜)');
    if (!fs.existsSync('farmer_data.csv')) {
        fs.writeFileSync('farmer_data.csv', 'Timestamp,PhoneNumber,Sender,Message\n');
    }
});

client.on('message_create', async msg => {
    if (msg.isStatus || msg.type === 'e2e_notification' || msg.fromMe) return;
    if (processedIds.has(msg.id.id)) return;
    processedIds.add(msg.id.id);

    console.log(`📩 Message from ${msg.from} [${msg.type}]`);
    const logContent = msg.hasMedia ? `[Media: ${msg.type}]` : msg.body;
    logConversation(msg.from.replace('@c.us', ''), 'Farmer', logContent);

    const text = msg.body.toLowerCase();
    const greetings = ['hi', 'hello', 'habari', 'jambo', 'start', 'niaje'];

    if (greetings.includes(text) && !msg.hasMedia) {
        chatHistory.delete(msg.from);
        const welcomeMsg = 
            "Habari Mkulima! 🌾 Farmers Assistant here.\n\n" +
            "I can SEE photos and LISTEN to voice notes! 📸🎙️\n\n" +
            "1. Send a photo of a sick plant.\n" +
            "2. Send a Voice Note with your question.\n" +
            "3. Ask about Shops & Soil Labs.\n\n" +
            "How can I help you today?";
        await client.sendMessage(msg.from, welcomeMsg);
        logConversation(msg.from.replace('@c.us', ''), 'Bot', 'Welcome Message');
        return;
    }

    try {
        let promptParts = [];
        let dataContext = ""; 
        let detectedTown = "";

        // --- DATABASE SEARCH ---
        if (msg.type === 'chat' || msg.type === 'image') {
            try {
                let searchTerms = [text];
                // Town Map
                if (fs.existsSync('town_map.json')) {
                    const townMap = JSON.parse(fs.readFileSync('town_map.json', 'utf8'));
                    for (const [minor, major] of Object.entries(townMap)) {
                        if (text.includes(minor)) {
                            searchTerms.push(major.toLowerCase());
                            detectedTown = `(User is in ${minor}, show options for ${major})`;
                            break;
                        }
                    }
                }
                
                // Shops & Labs
                if (text.includes('soil') || text.includes('lab')) {
                    if (fs.existsSync('soil_labs.json')) {
                        const labDB = JSON.parse(fs.readFileSync('soil_labs.json', 'utf8'));
                        const matchingLabs = labDB.filter(lab => 
                            searchTerms.some(term => lab.major_town.toLowerCase().includes(term))
                        );
                        if (matchingLabs.length > 0) {
                            const labList = matchingLabs.map(l => `- ${l.lab_name} (${l.location}): ${l.services}`).join("\n");
                            dataContext = `\n[🧪 FOUND SOIL LABS]:\n${labList}\n${detectedTown}`;
                        }
                    }
                } else if (fs.existsSync('shops.json')) {
                     const shopDB = JSON.parse(fs.readFileSync('shops.json', 'utf8'));
                     const matchingShops = shopDB.filter(shop => {
                        const shopTown = shop.major_town ? shop.major_town.toLowerCase() : "";
                        return searchTerms.some(term => shopTown.includes(term));
                     });
                     if (matchingShops.length > 0) {
                        const shopList = matchingShops.map((s, i) => `${i + 1}. ${s.shop_name} (${s.location}) - ${s.phone_number}`).join("\n");
                        dataContext = `\n[📍 FOUND SHOPS]:\n${shopList}\n${detectedTown}`;
                     }
                }
            } catch (err) { console.error("DB Error:", err.message); }
        }

        // --- STRICT PROMPT (THE FIX) ---
        let userHistory = chatHistory.get(msg.from) || [];
        const historyContext = userHistory.map(entry => `${entry.role}: ${entry.text}`).join("\n");

        const systemInstruction = `
        You are "Farmers Assistant", a practical Kenyan Agricultural Field Officer.
        
        CONTEXT:
        ${historyContext}
        
        DATABASE INFO:
        ${dataContext}
        
        STRICT RULES:
        1. **No Fluff:** Do not say "Hello there" or "I have examined the photo". Start directly with the answer.
        2. **Length:** Max 15 words per bullet point. Keep it short for WhatsApp.
        3. **Brands:** Recommend specific Kenyan brands (e.g., "Spray Escort or Thunder") NOT generic chemicals like "Cypermethrin".
        4. **Format:** Use Numbered Lists.
        5. **Database:** If 'DATABASE INFO' is found, show it.
        
        RESPONSE STRUCTURE:
        [Diagnosis/Direct Answer]
        1. [Step 1: Specific Action/Product]
        2. [Step 2: Specific Action/Product]
        3. [Step 3: Prevention]
        [Short Closing]
        `;

        promptParts.push(systemInstruction);

        if (msg.hasMedia) {
            const media = await msg.downloadMedia();
            const mediaPart = { inlineData: { data: media.data, mimeType: media.mimetype } };
            
            if (msg.type === 'ptt' || msg.type === 'audio') {
                await client.sendMessage(msg.from, "👂 Listening...");
                promptParts.push(mediaPart);
                promptParts.push("Listen to this farmer's voice note and provide a short, direct answer.");
            } else if (msg.type === 'image') {
                await client.sendMessage(msg.from, "👀 Checking photo...");
                promptParts.push(mediaPart);
                promptParts.push(`Diagnose this crop issue. Be direct. Suggest specific Kenyan products.`);
            }
        } else {
            promptParts.push(`User Query: ${msg.body}`);
        }

        // --- GENERATE ---
        const replyText = await generateWithRetry(promptParts);

        await client.sendMessage(msg.from, replyText);
        logConversation(msg.from.replace('@c.us', ''), 'Bot', replyText);

        userHistory.push({ role: 'User', text: msg.hasMedia ? `[${msg.type}]` : msg.body });
        userHistory.push({ role: 'Assistant', text: replyText });
        if (userHistory.length > 6) userHistory = userHistory.slice(-6);
        chatHistory.set(msg.from, userHistory);

    } catch (error) {
        console.error("   -> ❌ Final Error:", error.message);
        await client.sendMessage(msg.from, "Pole sana, the system is very busy. 🚜 Please try again in 1 minute.");
    }
});

client.initialize();