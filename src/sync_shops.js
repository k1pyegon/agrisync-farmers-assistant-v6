const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const fs = require('fs');
// Assumes credentials.json is in the main folder
const creds = require('../credentials.json'); 

// 👇👇👇 PASTE YOUR LONG SPREADSHEET ID HERE 👇👇👇
const SPREADSHEET_ID = '1-8YPQIRkOM4AGRa7YWXinGBpQO_AVUJrceM3PFUYweo'; 
const SHEET_TITLE = 'Shop_Directory';

const serviceAccountAuth = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function syncShops() {
    console.log("🔄 Syncing Shop Directory from Google Sheets...");
    
    try {
        const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
        await doc.loadInfo();
        
        // Try to find the specific tab, otherwise grab the first one
        let sheet = doc.sheetsByTitle[SHEET_TITLE];
        if (!sheet) {
            console.log(`⚠️ Tab '${SHEET_TITLE}' not found. Using the first tab.`);
            sheet = doc.sheetsByIndex[0];
        }

        const rows = await sheet.getRows();
        
        // Map Sheet Columns back to Bot JSON format
        const shopList = rows.map(row => {
            return {
                shop_name: row.get('Shop Name'),
                contact_person: row.get('Contact Person'),
                phone_number: row.get('Phone Number'),
                major_town: row.get('Major Town'),
                location: row.get('Location')
            };
        }).filter(s => s.shop_name && s.major_town); // Only keep valid rows

        // Save to the local file
        fs.writeFileSync('shops.json', JSON.stringify(shopList, null, 2));
        console.log(`✅ SUCCESS: Synced ${shopList.length} shops to local database.`);
        
    } catch (error) {
        console.error("❌ Sync Failed:", error.message);
    }
}

syncShops();
