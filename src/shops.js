const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
require('dotenv').config();

let cachedShops = [];

async function syncShopsFromSheet() {
    try {
        console.log("🔄 Syncing Shop Database from Google Sheets...");
        
        const serviceAccountAuth = new JWT({
            email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const doc = new GoogleSpreadsheet(process.env.SHOPS_SHEET_ID, serviceAccountAuth);
        await doc.loadInfo(); 
        const sheet = doc.sheetsByIndex[0]; 
        const rows = await sheet.getRows();

        cachedShops = rows.map(row => ({
            name: row.get('Shop Name'),
            town: row.get('Town'),
            phone: row.get('Contact'),
            lat: parseFloat(row.get('Latitude')),
            lon: parseFloat(row.get('Longitude'))
        }));

        console.log(`✅ Successfully cached ${cachedShops.length} shops into memory.`);
    } catch (error) {
        console.error("❌ Failed to sync shops:", error.message);
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 0.5 - Math.cos(dLat)/2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * (1 - Math.cos(dLon))/2;
    return R * 2 * Math.asin(Math.sqrt(a));
}

function getNearestShop(farmerLat, farmerLon) {
    if (cachedShops.length === 0) return null;

    let nearestShop = null;
    let shortestDistance = Infinity;

    cachedShops.forEach(shop => {
        if (!shop.lat || !shop.lon) return; 

        const distance = calculateDistance(farmerLat, farmerLon, shop.lat, shop.lon);
        
        if (distance < shortestDistance) {
            shortestDistance = distance;
            nearestShop = { ...shop, distanceAway: distance.toFixed(1) };
        }
    });

    return nearestShop;
}

function getShopCache() {
    return cachedShops;
}

module.exports = { syncShopsFromSheet, getNearestShop, getShopCache };
