const fs = require('fs');

function getDatabaseContext(text) {
    let dataContext = "";
    let detectedTown = "";
    const cleanText = text.toLowerCase();

    try {
        // 1. Check Town Map
        if (fs.existsSync('town_map.json')) {
            const townMap = JSON.parse(fs.readFileSync('town_map.json', 'utf8'));
            for (const [minor, major] of Object.entries(townMap)) {
                if (cleanText.includes(minor.toLowerCase())) {
                    detectedTown = `(User is in ${minor}, showing options for ${major})`;
                    text += " " + major.toLowerCase(); 
                    break;
                }
            }
        }

        // 2. Check Soil Labs
        if (cleanText.includes('soil') || cleanText.includes('lab') || cleanText.includes('test')) {
            if (fs.existsSync('soil_labs.json')) {
                const labDB = JSON.parse(fs.readFileSync('soil_labs.json', 'utf8'));
                const matchingLabs = labDB.filter(lab => {
                    const labTown = lab.major_town ? lab.major_town.toLowerCase() : "";
                    return cleanText.includes(labTown) && labTown.length > 2;
                });

                if (matchingLabs.length > 0) {
                    const labList = matchingLabs.map(l => `- ${l.lab_name} (${l.location}): ${l.services}`).join("\n");
                    // 🔥 STRONGER HEADER
                    dataContext = `\n[🚨 MANDATORY: RECOMMEND THESE VERIFIED LABS]:\n${labList}\n${detectedTown}`;
                } else {
                    const nationalLabs = labDB.filter(lab => lab.location.includes("Countrywide") || lab.lab_name.includes("KALRO"));
                    const labList = nationalLabs.map(l => `- ${l.lab_name}: ${l.services}`).join("\n");
                    dataContext = `\n[🚨 SUGGESTED NATIONAL LABS]:\n${labList}`;
                }
            }
        
        // 3. Check Agrovet Shops
        } else if (fs.existsSync('shops.json')) {
            const shopDB = JSON.parse(fs.readFileSync('shops.json', 'utf8'));
            
            const matchingShops = shopDB.filter(shop => {
                const shopTown = shop.major_town ? shop.major_town.toLowerCase() : "";
                const shopName = shop.shop_name ? shop.shop_name.toLowerCase() : "";
                
                // Check if user mentioned the town OR the shop name specifically
                const townMatch = shopTown.length > 2 && cleanText.includes(shopTown);
                const nameMatch = shopName.length > 2 && cleanText.includes(shopName);
                
                return townMatch || nameMatch;
            });

            if (matchingShops.length > 0) {
                const shopList = matchingShops.map((s, i) => `${i + 1}. **${s.shop_name}** (${s.location}) - 📞 ${s.phone_number}`).join("\n");
                // 🔥 STRONGER HEADER forces AI to use this
                dataContext = `\n[🚨 MANDATORY: RECOMMEND THESE VERIFIED PARTNERS]:\n${shopList}\n${detectedTown}\n(You MUST give these details to the farmer instead of generic advice).`;
            }
        }
    } catch (err) {
        console.error("Database Read Error:", err.message);
    }

    return dataContext;
}

module.exports = { getDatabaseContext };
