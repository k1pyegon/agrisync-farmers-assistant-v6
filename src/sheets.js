const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const creds = require('../credentials.json'); // The file you just uploaded

// 👇 REPLACE THIS WITH YOUR LONG SPREADSHEET ID
const SPREADSHEET_ID = '1nOZqays29402e7dgJO4deJvLXnIG-N37UgIlFa6VS-E'; 

const serviceAccountAuth = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);

async function logToSheet(phone, role, message, category = "General") {
    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0]; // The first tab

        await sheet.addRow({
            Date: new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' }),
            "Farmer Phone": phone,
            Type: role,
            Message: message,
            "Trigger/Category": category
        });
    } catch (error) {
        console.error("❌ Sheets Error:", error.message);
    }
}

module.exports = { logToSheet };
