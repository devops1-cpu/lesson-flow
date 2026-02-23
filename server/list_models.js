// List available Gemini models
require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

const key = process.env.GEMINI_API_KEY;
if (!key) { console.log('No key'); process.exit(1); }

async function list() {
    const ai = new GoogleGenAI({ apiKey: key });
    try {
        console.log('Fetching models...');
        // The SDK might have a different way to list models, let's try the standard REST way if SDK fails
        // But first let's see if we can just try 'gemini-pro' which is usually standard
        const response = await ai.models.list();
        console.log('models:', response);
    } catch (err) {
        console.log('SDK list error:', err.message);
    }
}
list();
