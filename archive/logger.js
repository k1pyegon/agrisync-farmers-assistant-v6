const fs = require('fs');

const CSV_FILE = 'farmer_data.csv';

// Ensure file exists
if (!fs.existsSync(CSV_FILE)) {
    fs.writeFileSync(CSV_FILE, 'Timestamp,PhoneNumber,Sender,Message\n');
}

function logConversation(phoneNumber, messageType, content) {
    const date = new Date();
    const timestamp = date.toLocaleString('en-KE').replace(/,/g, ''); 
    
    // Clean content to avoid CSV breaking
    const cleanContent = content ? content.replace(/,/g, " ").replace(/\n/g, " ").substring(0, 100) : "Media";
    const logEntry = `${timestamp},${phoneNumber},${messageType},"${cleanContent}"\n`;
    
    fs.appendFile(CSV_FILE, logEntry, (err) => { 
        if (err) console.error("❌ Log Error:", err); 
    });
}

module.exports = { logConversation };