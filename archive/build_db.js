const fs = require('fs');
const csv = require('csv-parser');

const LOG_FILE = 'farmer_data.csv';
const DB_FILE = 'user_database.json';

const users = {};

// Load existing DB if it exists
if (fs.existsSync(DB_FILE)) {
    const raw = fs.readFileSync(DB_FILE);
    Object.assign(users, JSON.parse(raw));
}

console.log("🔄 Reading logs to build User Database...");

fs.createReadStream(LOG_FILE)
    .pipe(csv())
    .on('data', (row) => {
        // We only care about messages FROM the Farmer
        if (row.Sender === 'Farmer') {
            const phone = row.PhoneNumber;
            const msg = row.Message.toLowerCase();
            const date = row.Timestamp;

            if (!users[phone]) {
                // New User Found!
                users[phone] = {
                    phone: phone,
                    date_joined: date,
                    last_active: date,
                    message_count: 0,
                    interests: [], // We will tag them based on keywords
                    location_hint: "Unknown"
                };
            }

            // Update Stats
            users[phone].last_active = date;
            users[phone].message_count++;

            // 🧠 Smart Tagging: Guess their interests
            if (msg.includes('maize') && !users[phone].interests.includes('Maize')) users[phone].interests.push('Maize');
            if (msg.includes('cow') || msg.includes('milk')) { if (!users[phone].interests.includes('Dairy')) users[phone].interests.push('Dairy'); }
            if (msg.includes('potato')) { if (!users[phone].interests.includes('Potato')) users[phone].interests.push('Potato'); }
            
            // 📍 Smart Location: Guess their town from keywords
            // You can add more towns here based on your 'town_map.json'
            const towns = ['kericho', 'bomet', 'nakuru', 'eldoret', 'thika', 'kiambu'];
            towns.forEach(town => {
                if (msg.includes(town)) users[phone].location_hint = town.charAt(0).toUpperCase() + town.slice(1);
            });
        }
    })
    .on('end', () => {
        // Save the clean database
        fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
        console.log(`✅ Database Updated! Tracking ${Object.keys(users).length} unique farmers.`);
        console.log(`📂 Saved to: ${DB_FILE}`);
    });