const fs = require('fs').promises;
const path = require('path');

// File path where chat history will be permanently saved as JSON
const dbPath = path.resolve(__dirname, '../chat_history.json');

// Helper function to safely read the JSON file
async function readDataFile() {
    try {
        const data = await fs.readFile(dbPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // If file doesn't exist yet (first run), return an empty object
        if (error.code === 'ENOENT') {
            return {};
        }
        console.error("❌ JSON History Read Error:", error.message);
        return {};
    }
}

// Helper function to safely write the JSON file
async function writeDataFile(data) {
    try {
        // The 'null, 2' formats the JSON so it is readable if you ever open it
        await fs.writeFile(dbPath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error("❌ JSON History Write Error:", error.message);
        return false;
    }
}

// Fetch the last N messages for a specific farmer
async function getChatHistory(phoneNumber, limit = 6) {
    const data = await readDataFile();
    const userHistory = data[phoneNumber] || [];
    
    // Return only the last N messages requested
    return userHistory.slice(-limit);
}

// Save a new message to the history file
async function saveChatMessage(phoneNumber, role, text) {
    const data = await readDataFile();
    
    if (!data[phoneNumber]) {
        data[phoneNumber] = [];
    }
    
    // Push the new message into the array
    data[phoneNumber].push({
        role: role,
        text: text,
        timestamp: new Date().toISOString()
    });
    
    // To prevent the JSON file from growing indefinitely, cap individual context at 20 messages
    if (data[phoneNumber].length > 20) {
        data[phoneNumber] = data[phoneNumber].slice(-20);
    }
    
    return await writeDataFile(data);
}

module.exports = { getChatHistory, saveChatMessage };
