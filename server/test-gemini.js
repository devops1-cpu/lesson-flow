// Quick test to verify Gemini API key with retry
require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

const key = process.env.GEMINI_API_KEY;
if (!key) {
    console.log('❌ No GEMINI_API_KEY found in .env');
    process.exit(1);
}
console.log('✅ Key found (' + key.length + ' chars)');

const models = ['gemini-2.0-flash-lite-001', 'gemini-flash-latest'];

async function test() {
    const ai = new GoogleGenAI({ apiKey: key });

    for (const model of models) {
        console.log('\n⏳ Testing model:', model);
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const result = await ai.models.generateContent({
                    model,
                    contents: 'Reply with exactly one word: WORKING',
                    config: { temperature: 0 }
                });
                console.log('✅ Response:', result.text.trim());
                console.log('🎉 API Key is WORKING with', model);
                process.exit(0);
            } catch (err) {
                const is429 = err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED');
                if (is429 && attempt < 3) {
                    const delay = attempt * 3;
                    console.log('  ⏳ Rate limited, waiting ' + delay + 's... (attempt ' + attempt + '/3)');
                    await new Promise(r => setTimeout(r, delay * 1000));
                } else if (is429) {
                    console.log('  ⚠️ Still rate limited on', model, '— trying next model...');
                    break;
                } else {
                    console.log('  ❌ Error:', err.message?.substring(0, 200));
                    break;
                }
            }
        }
    }

    console.log('\n❌ All models rate limited. This is temporary — wait a minute and try again.');
    console.log('   The free tier allows 15 requests/minute. Your quota may need a moment to reset.');
    process.exit(1);
}
test();
