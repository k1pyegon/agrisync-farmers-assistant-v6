const fs = require('fs');
const db = require('./database');

async function getSearchContext(text) {
    const cleanText = text.toLowerCase();
    const allShops = await db.getShopData();
    let majorTown = "";

    // 1. Map minor towns to Major Towns
    if (fs.existsSync('town_map.json')) {
        const townMap = JSON.parse(fs.readFileSync('town_map.json', 'utf8'));
        for (const [minor, major] of Object.entries(townMap)) {
            if (cleanText.includes(minor)) {
                majorTown = major;
                break;
            }
        }
    }

    // 2. Filter Shops
    const matches = allShops.filter(s => 
        (majorTown && s.town === majorTown) || cleanText.includes(s.town)
    );

    if (matches.length > 0) {
        const list = matches.map(s => `${s.name} - ${s.phone} (${s.location})`).join("\n");
        return `\nVERIFIED PARTNERS:\n${list}\n(Share these with the farmer).`;
    }
    return "No specific partners found in this area.";
}

module.exports = { getSearchContext };
