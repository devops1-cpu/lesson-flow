const express = require('express');
const { GoogleGenAI } = require('@google/genai');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODELS = ['gemini-flash-latest', 'gemini-1.5-pro-latest'];

let ai = null;
function getClient() {
    if (!GEMINI_API_KEY) return null;
    if (!ai) ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    return ai;
}

// Retry helper with model fallback
async function callGemini(prompt, config = {}) {
    const client = getClient();
    if (!client) throw new Error('Gemini API key not configured');

    for (const model of MODELS) {
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                const response = await client.models.generateContent({
                    model,
                    contents: prompt,
                    config: { temperature: 0.7, ...config }
                });
                return response.text;
            } catch (err) {
                const is429 = err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED');
                if (is429 && attempt < 2) {
                    await new Promise(r => setTimeout(r, 2000));
                    continue;
                }
                if (is429 && model !== MODELS[MODELS.length - 1]) break;
                throw err;
            }
        }
    }
    throw new Error('Gemini API unavailable');
}

function buildPlanSummary(plan) {
    const parts = [];
    if (plan.title) parts.push(`Title: ${plan.title}`);
    if (plan.subject) parts.push(`Subject: ${plan.subject}`);
    if (plan.grade) parts.push(`Grade: ${plan.grade}`);
    if (plan.duration) parts.push(`Duration: ${plan.duration}`);
    if (plan.objectives) {
        const obj = Array.isArray(plan.objectives) ? plan.objectives.filter(Boolean).join(', ') : plan.objectives;
        if (obj) parts.push(`Objectives: ${obj}`);
    }
    if (plan.materials) {
        const mat = Array.isArray(plan.materials) ? plan.materials.filter(Boolean).join(', ') : plan.materials;
        if (mat) parts.push(`Materials: ${mat}`);
    }
    if (plan.warmUp) parts.push(`Warm-Up: ${plan.warmUp}`);
    if (plan.instruction) parts.push(`Instruction: ${plan.instruction}`);
    if (plan.guidedPractice) parts.push(`Guided Practice: ${plan.guidedPractice}`);
    if (plan.independentPractice) parts.push(`Independent Practice: ${plan.independentPractice}`);
    if (plan.closure) parts.push(`Closure: ${plan.closure}`);
    if (plan.assessment) parts.push(`Assessment: ${plan.assessment}`);
    if (plan.differentiation) parts.push(`Differentiation: ${plan.differentiation}`);
    if (plan.homework) parts.push(`Homework: ${plan.homework}`);
    if (plan.notes) parts.push(`Notes: ${plan.notes}`);
    return parts.join('\n');
}

const SYSTEM_PROMPT = `You are LessonFlow AI Tutor — a friendly, expert teaching assistant embedded in a lesson planning platform.

Your role:
1. Help teachers write BETTER lesson plans by analyzing their current content
2. Check if the lesson plan content is RELEVANT to the stated subject and grade level
3. Spot missing sections, weak areas, or vague content
4. Suggest concrete improvements with specific examples
5. Answer pedagogical questions about teaching strategies

Your personality:
- Friendly but professional — like a supportive department head
- Concise — keep responses to 3-5 sentences unless asked for detail
- Actionable — every suggestion should be something the teacher can immediately do
- Encouraging — acknowledge what's good before suggesting improvements

When analyzing relevance:
- Check if objectives match the subject and grade level
- Flag content that seems off-topic or grade-inappropriate
- Suggest how to better align instruction with objectives

IMPORTANT: Always respond in plain text. Do not use markdown headers (##) or complex formatting. Use simple bullets (•) for lists. Keep responses SHORT and actionable.`;

// POST /api/tutor/chat
router.post('/chat', authenticate, async (req, res) => {
    try {
        const { message, lessonPlan, history } = req.body;

        if (!message) return res.status(400).json({ error: 'Message is required.' });
        if (!GEMINI_API_KEY) return res.status(503).json({ error: 'AI Tutor is not available — no API key configured.' });

        const planContext = lessonPlan ? buildPlanSummary(lessonPlan) : 'No lesson plan data provided yet.';

        // Build conversation history for context
        const conversationHistory = (history || []).slice(-6).map(m =>
            `${m.role === 'user' ? 'Teacher' : 'Tutor'}: ${m.text}`
        ).join('\n');

        let userMessage = message;

        // Special auto-analyze command
        if (message === '__analyze__') {
            userMessage = `Please analyze my current lesson plan and give me:
1. A relevance score (how well the content matches the subject "${lessonPlan?.subject || 'unknown'}" for Grade ${lessonPlan?.grade || 'unknown'})
2. The top 3 strengths
3. The top 3 areas that need improvement
4. Any missing sections I should fill in

Be specific and reference actual content from my plan.`;
        }

        const prompt = `${SYSTEM_PROMPT}

=== CURRENT LESSON PLAN ===
${planContext}
=== END PLAN ===

${conversationHistory ? `=== RECENT CONVERSATION ===\n${conversationHistory}\n=== END CONVERSATION ===\n` : ''}
Teacher: ${userMessage}

Tutor:`;

        const response = await callGemini(prompt, { temperature: 0.7 });

        res.json({
            reply: response.trim(),
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Tutor error:', error.message);
        if (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED')) {
            return res.status(429).json({ error: 'AI is busy right now. Please try again in a few seconds.' });
        }
        res.status(500).json({ error: 'Failed to get AI response. Please try again.' });
    }
});

module.exports = router;
