const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
// We assume credentials.json is in the main folder
const creds = require('../credentials.json'); 

// 👇👇👇 PASTE THE ID OF YOUR *NEW* USER DATABASE SHEET HERE 👇👇👇
const SPREADSHEET_ID = '1G9OCTZ6ZPxdiRL4_DC2lC0Hv9tN8RJfTVDsymQUCMcc';
const SHEET_TITLE = 'Users';

const serviceAccountAuth = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function getDoc() {
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    return doc;
}

// 1. FIND A USER
async function findUser(phoneNumber) {
    try {
        const doc = await getDoc();
        const sheet = doc.sheetsByTitle[SHEET_TITLE];
        if (!sheet) {
            console.log(`⚠️ Tab '${SHEET_TITLE}' not found.`);
            return null;
        }
        
        const rows = await sheet.getRows();
        const userRow = rows.find(row => row.get('Phone') == phoneNumber); // Loose equality for string/number match
        
        if (userRow) {
            return {
                phone: userRow.get('Phone'),
                name: userRow.get('Name'),
                location: userRow.get('Location'),
                crops: userRow.get('Crops'),
                exists: true
            };
        }
        return null;
    } catch (error) {
        console.error("Error finding user:", error.message);
        return null;
    }
}

// 2. SAVE OR UPDATE USER
async function saveUser(phoneNumber, data) {
    try {
        const doc = await getDoc();
        const sheet = doc.sheetsByTitle[SHEET_TITLE];
        if (!sheet) return;

        const rows = await sheet.getRows();
        const existingRow = rows.find(row => row.get('Phone') == phoneNumber);

        if (existingRow) {
            // Update existing user
            if (data.name) existingRow.assign({ Name: data.name });
            if (data.location) existingRow.assign({ Location: data.location });
            if (data.crops) existingRow.assign({ Crops: data.crops });
            await existingRow.save();
            console.log(`📝 Updated farmer: ${phoneNumber}`);
        } else {
            // Create new user
            await sheet.addRow({
                'Phone': phoneNumber,
                'Name': data.name || 'Unknown',
                'Location': data.location || 'Unknown',
                'Crops': data.crops || '',
                'Joined': new Date().toISOString().split('T')[0]
            });
            console.log(`✨ Added new farmer: ${phoneNumber}`);
        }
    } catch (error) {
        console.error("Error saving user:", error.message);
    }
}

// === TEST BLOCK (Runs only when you run this file directly) ===
if (require.main === module) {
    (async () => {
        console.log("🧪 Testing Connection to User DB...");
        // Test: Add a fake user
        await saveUser("254700TEST01", { 
            name: "Test Farmer", 
            location: "Nairobi", 
            crops: "Testing" 
        });
    })();
}

module.exports = { findUser, saveUser };
