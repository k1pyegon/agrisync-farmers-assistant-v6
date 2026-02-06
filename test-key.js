require('dotenv').config();

async function checkModels() {
    const key = process.env.GEMINI_API_KEY;
    console.log("🔑 Testing Key starting with: " + key.substring(0, 8) + "...");

    try {
        // Ask Google directly what models are available for this key
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await response.json();

        if (data.error) {
            console.log("\n❌ GOOGLE ERROR:");
            console.log(data.error.message);
        } else if (data.models) {
            console.log("\n✅ SUCCESS! Your Key works. Here are the EXACT names you must use:");
            // Filter for "generateContent" models only
            const validModels = data.models.filter(m => m.supportedGenerationMethods.includes("generateContent"));
            validModels.forEach(m => console.log(" 👉 " + m.name.replace("models/", "")));
        } else {
            console.log("\n⚠️ Weird Response:", data);
        }
    } catch (error) {
        console.log("\n❌ NETWORK ERROR:", error.message);
    }
}

checkModels();
