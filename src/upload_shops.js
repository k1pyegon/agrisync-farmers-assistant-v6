const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const fs = require('fs');
const creds = require('../credentials.json');

// 👇 REPLACE WITH YOUR SHEET ID
const SPREADSHEET_ID = '1-8YPQIRkOM4AGRa7YWXinGBpQO_AVUJrceM3PFUYweo';

const serviceAccountAuth = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function uploadShops() {
    console.log("🚀 Connecting to Fix Sheet...");
    
    try {
        const rawData = fs.readFileSync('shops.json');
        const shops = JSON.parse(rawData);

        const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
        await doc.loadInfo();
        
        // Just grab the FIRST sheet (Sheet1) to be safe
        const sheet = doc.sheetsByIndex[0];
        console.log(`📝 Writing to tab: '${sheet.title}'`);

        // 1. CLEAR the sheet first (to avoid duplicates)
        await sheet.clear();

        // 2. SET HEADERS explicitly (This fixes the "Empty Sheet" bug)
        await sheet.setHeaderRow(['Shop Name', 'Contact Person', 'Phone Number', 'Major Town', 'Location']);
        console.log("✅ Headers created successfully.");

        // 3. Prepare Rows
        const rowsToAdd = shops.map(s => ({
            'Shop Name': s.shop_name,
            'Contact Person': s.contact_person,
            'Phone Number': s.phone_number,
            'Major Town': s.major_town,
            'Location': s.location
        }));

        // 4. Upload Data
        await sheet.addRows(rowsToAdd);
        console.log(`✅ SUCCESS! Uploaded ${rowsToAdd.length} shops. Refresh your iPad now!`);
        
    } catch (error) {
        console.error("❌ FAILED:", error.message);
    }
}

uploadShops();
