const fs = require('fs');
const path = require('path');

// File will be created in the main folder (where index.js is)
const CSV_FILE = path.join(__dirname, '../alerts.csv');

// Create Header if file doesn't exist
if (!fs.existsSync(CSV_FILE)) {
    fs.writeFileSync(CSV_FILE, 'Timestamp,Phone,Risk_Type,Message\n');
}

function logCriticalEvent(phone, riskType, message) {
    const timestamp = new Date().toLocaleString();
    const cleanMessage = message.replace(/,/g, ' ').replace(/\n/g, ' '); // Remove commas to keep CSV clean
    
    const row = `${timestamp},${phone},${riskType},"${cleanMessage}"\n`;

    fs.appendFile(CSV_FILE, row, (err) => {
        if (err) console.error("❌ CSV Write Failed:", err);
        else console.log(`📝 Alert Logged to CSV: ${riskType}`);
    });
}

module.exports = { logCriticalEvent };