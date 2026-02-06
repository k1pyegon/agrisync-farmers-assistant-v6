const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
require('dotenv').config();

async function check() {
    console.log("🕵️ INSPECTING YOUR SHEET COLUMNS...\n");
    
    const serviceAccountAuth = new JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0]; 
    const rows = await sheet.getRows();

    if (rows.length === 0) {
        console.log("❌ The sheet is EMPTY!");
        return;
    }

    const firstRow = rows[0]._rawData;

    console.log("👇 HERE IS YOUR DATA STRUCTURE. MATCH THE NUMBERS:");
    console.log("------------------------------------------------");
    firstRow.forEach((value, index) => {
        console.log(`[ Column ${index} ] : ${value}`);
    });
    console.log("------------------------------------------------");
    console.log("👉 Tell me: Which number has the SHOP NAME? Which has the TOWN? Which has the PHONE?");
}

check();
