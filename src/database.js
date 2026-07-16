const fs = require('fs');
const { getShopCache } = require('./shops'); 

// ⚡ Renamed to 'getDatabaseContext' to properly link with index.js!
function getDatabaseContext(text) {
    if (!text) return "";
    const cleanText = text.toLowerCase();
    
    const allShops = getShopCache(); 
    let majorTown = "";

    if (fs.existsSync('town_map.json')) {
        const townMap = JSON.parse(fs.readFileSync('town_map.json', 'utf8'));
        for (const [minor, major] of Object.entries(townMap)) {
            if (cleanText.includes(minor.toLowerCase())) {
                majorTown = major.toLowerCase();
                break;
            }
        }
    }

    const matches = allShops.filter(s => {
        const shopTown = (s.town || "").toLowerCase();
        // Guard blank/too-short towns: "".includes("") is always true, so an empty
        // Town cell would otherwise match every message and misroute farmers.
        if (shopTown.length < 3) return false;
        return (majorTown && shopTown === majorTown) || cleanText.includes(shopTown);
    });

    if (matches.length > 0) {
        const list = matches.map(s => `📍 ${s.name} - 📞 ${s.phone} (${s.town})`).join("\n");
        return `\n🚨 IMPORTANT LOCAL DATA (PRIORITY):\n${list}\n`;
    }
    
    return ""; 
}

// Ensure the export name matches index.js exactly
module.exports = { getDatabaseContext };
