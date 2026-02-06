const fs = require('fs');
const path = require('path');

/**
 * Searches for soil labs based on the user's mentioned town
 * @param {string} text - The user's message
 * @param {string} mappedMajorTown - The major town found by town_map.json
 */
function getLabContext(text, mappedMajorTown) {
    const labFilePath = path.join(__dirname, '../soil_labs.json');
    const cleanText = text.toLowerCase();
    
    if (!fs.existsSync(labFilePath)) return "";

    try {
        const labs = JSON.parse(fs.readFileSync(labFilePath, 'utf8'));
        
        // Find labs where the major_town matches the user's town or the mapped town
        const matchingLabs = labs.filter(lab => {
            const labTown = lab.major_town.toLowerCase();
            return cleanText.includes(labTown) || (mappedMajorTown && mappedMajorTown.toLowerCase() === labTown);
        });

        if (matchingLabs.length === 0) return "";

        const labList = matchingLabs.map(l => 
            `*${l.lab_name}*\n- 📍 Location: ${l.location}\n- 🧪 Services: ${l.services}\n- 📞 Contact: ${l.contact}`
        ).join("\n\n");

        return `\n[🚨 VERIFIED SOIL TESTING LABS]:\n${labList}`;
    } catch (error) {
        console.error("❌ Soil Lab JSON Error:", error.message);
        return "";
    }
}

module.exports = { getLabContext };
