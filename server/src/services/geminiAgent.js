/**
 * Gemini AI Agent for Lesson Plan Readiness Assessment
 * 
 * Uses Google Gemini API to:
 * 1. Generate context-aware probing questions based on the lesson plan
 * 2. Evaluate teacher answers with deep analysis across 4 dimensions
 * 3. Detect AI-generated content
 * 
 * Falls back gracefully if GEMINI_API_KEY is not set.
 */

const { GoogleGenAI } = require('@google/genai');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODELS = ['gemini-flash-latest', 'gemini-1.5-pro-latest']; // verified available for this key

let ai = null;

function getClient() {
    if (!GEMINI_API_KEY) return null;
    if (!ai) {
        ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    }
    return ai;
}

/**
 * Call Gemini with retry + model fallback on 429
 */
async function callGemini(client, prompt, config = {}) {
    const maxRetries = 3;
    for (const model of MODELS) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await client.models.generateContent({
                    model,
                    contents: prompt,
                    config: { responseMimeType: 'application/json', temperature: 0.5, ...config }
                });
                return response.text;
            } catch (err) {
                const is429 = err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED');
                if (is429 && attempt < maxRetries) {
                    const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
                    console.log(`⏳ Gemini rate limited (${model}), retrying in ${delay / 1000}s... (attempt ${attempt}/${maxRetries})`);
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }
                if (is429 && model !== MODELS[MODELS.length - 1]) {
                    console.log(`🔄 Switching from ${model} to next model...`);
                    break; // try next model
                }
                throw err; // non-429 error or exhausted retries
            }
        }
    }
    throw new Error('All Gemini models exhausted');
}

/**
 * Check if Gemini is available
 */
function isAvailable() {
    return !!GEMINI_API_KEY;
}

/**
 * Generate context-aware questions for a lesson plan
 * @param {Object} plan - The lesson plan object from the database
 * @returns {Array} Array of question objects: {id, question, category, weight}
 */
async function generateQuestions(plan) {
    const client = getClient();
    if (!client) throw new Error('Gemini API key not configured');

    const planContext = buildPlanContext(plan);

    const prompt = `You are an expert educational evaluator. A teacher has created the following lesson plan and you need to generate 5 probing questions to assess whether they are truly prepared to deliver this lesson.

=== LESSON PLAN ===
${planContext}
=== END LESSON PLAN ===

Generate exactly 5 questions following these rules:
1. Each question must be SPECIFIC to this exact lesson plan — reference actual content from the plan (specific objectives, topics, methods mentioned)
2. Questions should test whether the teacher truly understands the material and has thought through execution, not just whether they can recite their plan back
3. Prefer "how" and "what will you do if" questions over "what" questions
4. Each question should probe a different aspect of readiness

Categories and weights:
- "Learning Objectives" (weight: 25) — Can they measure whether students achieved the objectives?
- "Instructional Strategy" (weight: 25) — Do they have a clear, step-by-step approach with backup plans?
- "Differentiation" (weight: 20) — Can they support struggling AND advanced learners?
- "Assessment" (weight: 20) — Can they check understanding in real-time during the lesson?
- "Preparation" (weight: 10) — Do they know the hardest parts and have contingencies?

Return a JSON array with exactly 5 objects, each having: id (q1-q5), question, category, weight.
Example format:
[
  {"id": "q1", "question": "Your lesson mentions... How will you...", "category": "Learning Objectives", "weight": 25}
]

IMPORTANT: Questions must directly reference content from THIS lesson plan. Do not generate generic teaching questions.`;

    const text = await callGemini(client, prompt, { temperature: 0.7 });
    const questions = JSON.parse(text);

    // Validate structure
    if (!Array.isArray(questions) || questions.length < 3) {
        throw new Error('Invalid questions format from Gemini');
    }

    // Ensure proper structure
    return questions.map((q, i) => ({
        id: q.id || `q${i + 1}`,
        question: q.question,
        category: q.category || ['Learning Objectives', 'Instructional Strategy', 'Differentiation', 'Assessment', 'Preparation'][i],
        weight: q.weight || [25, 25, 20, 20, 10][i]
    }));
}

/**
 * Evaluate teacher answers using Gemini
 * @param {Array} questions - Array of question objects
 * @param {Object} answers - Map of questionId -> answer text
 * @param {Object} plan - The lesson plan for context
 * @returns {Object} Evaluation result with per-question breakdowns
 */
async function evaluateAnswers(questions, answers, plan) {
    const client = getClient();
    if (!client) throw new Error('Gemini API key not configured');

    const planContext = buildPlanContext(plan);

    // Build Q&A section
    const qaSection = questions.map(q => {
        const answer = answers[q.id] || '';
        return `--- Question ${q.id} (${q.category}, ${q.weight} pts) ---
Q: ${q.question}
A: ${answer || '[NO ANSWER PROVIDED]'}`;
    }).join('\n\n');

    const prompt = `You are a strict but fair educational evaluator. Evaluate a teacher's answers to readiness assessment questions about their lesson plan.

=== LESSON PLAN CONTEXT ===
${planContext}
=== END CONTEXT ===

=== QUESTIONS AND TEACHER'S ANSWERS ===
${qaSection}
=== END Q&A ===

For EACH answer, evaluate across these 4 dimensions (each scored 0-25):

1. **Relevance** (0-25): Does the answer directly address what was asked? Does it reference the specific lesson content?
   - 20-25: Directly addresses the question with lesson-specific details
   - 12-19: Partially addresses but somewhat generic
   - 5-11: Tangentially related but mostly off-topic
   - 0-4: Doesn't address the question at all

2. **Specificity** (0-25): Does it include concrete examples, specific steps, named tools/activities, or numbers?
   - 20-25: Multiple concrete examples, step-by-step approach, names specific activities
   - 12-19: Some specific details but could be more concrete
   - 5-11: Mostly vague or generic language
   - 0-4: Completely abstract with no concrete details

3. **Depth** (0-25): Is there enough substance? Does it show deep thinking about the topic?
   - 20-25: Thorough, shows clear forethought, considers edge cases
   - 12-19: Reasonable depth but missing some important considerations
   - 5-11: Superficial treatment of the topic
   - 0-4: Minimal or no substance

4. **Clarity** (0-25): Is it well-organized, readable, and logically structured?
   - 20-25: Clear, well-organized, easy to follow
   - 12-19: Generally clear but could be better organized
   - 5-11: Somewhat confusing or poorly structured
   - 0-4: Incoherent or very difficult to understand

Also check for AI-generated content:
- Look for excessive use of phrases like "it is important to note", "furthermore", "in conclusion", "leverage", "utilize", "robust", "comprehensive", "facilitate", "holistic", "paramount", "delve"
- Suspiciously uniform sentence structure
- Overly formal with zero contractions or informal language
- Unusually long, perfectly structured responses for a quick assessment

Return your evaluation as JSON with this exact structure:
{
  "perQuestion": [
    {
      "questionId": "q1",
      "category": "Learning Objectives",
      "score": <weighted score based on dimensions and question weight>,
      "maxScore": <question weight>,
      "breakdown": {
        "relevance": <0-25>,
        "specificity": <0-25>,
        "depth": <0-25>,
        "clarity": <0-25>
      },
      "feedback": "<1-2 sentence actionable feedback>",
      "grade": "<EXCELLENT|GOOD|NEEDS_WORK|INSUFFICIENT|NOT_ANSWERED>",
      "wordCount": <word count of answer>,
      "aiSuspicion": {
        "isAI": <boolean>,
        "confidence": <0-100>,
        "reason": "<brief reason or empty string>"
      }
    }
  ],
  "totalScore": <sum of all question scores, 0-100>,
  "overallFeedback": "<2-3 sentence summary of overall readiness>",
  "anyAIDetected": <boolean>,
  "aiFlags": [
    {
      "questionId": "q1",
      "category": "category name",
      "confidence": <0-100>,
      "signals": ["signal1", "signal2"]
    }
  ]
}

SCORING RULES:
- The score for each question = round(weight * (relevance + specificity + depth + clarity) / 100)
- If an answer is detected as AI-generated, apply a 70% penalty to the score
- If no answer is provided, score is 0 and grade is NOT_ANSWERED
- Be strict but fair — teachers should demonstrate genuine preparation, not just echo their lesson plan back

IMPORTANT: Return ONLY valid JSON, no markdown formatting.`;

    const text = await callGemini(client, prompt, { temperature: 0.3 });
    const result = JSON.parse(text);

    // Validate and normalize
    if (!result.perQuestion || !Array.isArray(result.perQuestion)) {
        throw new Error('Invalid evaluation format from Gemini');
    }

    // Build feedback array for backward compatibility
    const feedback = [];
    for (const pq of result.perQuestion) {
        feedback.push(pq.feedback);
    }
    if (result.anyAIDetected) {
        feedback.push('');
        feedback.push('🚨 AI-GENERATED CONTENT DETECTED: One or more answers appear to be AI-generated. Only original, authentic responses are accepted.');
    }
    feedback.push(result.overallFeedback);

    return {
        score: result.anyAIDetected ? Math.min(result.totalScore, 30) : result.totalScore,
        feedback,
        perQuestion: result.perQuestion,
        anyAIDetected: result.anyAIDetected || false,
        aiFlags: result.aiFlags || []
    };
}

/**
 * Analyze lesson plan section by section for detailed HOD feedback
 * @param {Object} plan - The lesson plan object
 * @returns {Object} Map of section name -> 1-sentence critique
 */
async function analyzeLessonPlan(plan) {
    const client = getClient();
    if (!client) throw new Error('Gemini API key not configured');

    const planContext = buildPlanContext(plan);

    const prompt = `You are an expert instructional coach analyzing a lesson plan for a Head of Department (HOD).
Your goal is to provide a brief, constructive critique for each specific section of the plan.

=== LESSON PLAN ===
${planContext}
=== END LESSON PLAN ===

For each of the following sections present in the plan, provide a 1-sentence specific critique.
Focus on alignment, clarity, and effectiveness.
If a section is missing or too short, note that.

Sections to analyze if present:
- Learning Objectives (measurable? clear?)
- Materials (sufficient?)
- Instruction (clear steps?)
- Guided Practice (scaffolded?)
- Independent Practice (aligned?)
- Assessment (aligned to objectives?)
- Differentiation (inclusive?)
- Closure (effective wrap-up?)

Return a JSON object where keys are the section names (camelCase) and values are the critiques.
Keys: objectives, materials, instruction, guidedPractice, independentPractice, assessment, differentiation, closure.

Example:
{
  "objectives": "Objectives are clear but could be more measurable.",
  "differentiation": "Good strategies for diverse learners."
}

Only return JSON.`;

    const text = await callGemini(client, prompt, { temperature: 0.4 });
    try {
        const analysis = JSON.parse(text);
        return analysis;
    } catch (e) {
        console.error('Failed to parse analysis JSON', e);
        return {};
    }
}

/**
 * Build a text representation of the lesson plan for Gemini context
 */
function buildPlanContext(plan) {
    const sections = [];
    sections.push(`Title: ${plan.title || 'Untitled'}`);
    sections.push(`Subject: ${plan.subject || 'Not specified'}`);
    sections.push(`Grade: ${plan.grade || 'Not specified'}`);
    sections.push(`Duration: ${plan.duration || 'Not specified'}`);

    if (plan.objectives) {
        const obj = Array.isArray(plan.objectives) ? plan.objectives.join(', ') : plan.objectives;
        sections.push(`Learning Objectives: ${obj}`);
    }
    if (plan.materials) sections.push(`Materials: ${plan.materials}`);
    if (plan.warmUp) sections.push(`Warm-Up Activity: ${plan.warmUp}`);
    if (plan.instruction) sections.push(`Direct Instruction: ${plan.instruction}`);
    if (plan.guidedPractice) sections.push(`Guided Practice: ${plan.guidedPractice}`);
    if (plan.independentPractice) sections.push(`Independent Practice: ${plan.independentPractice}`);
    if (plan.closure) sections.push(`Closure: ${plan.closure}`);
    if (plan.assessment) sections.push(`Assessment: ${plan.assessment}`);
    if (plan.differentiation) sections.push(`Differentiation: ${plan.differentiation}`);
    if (plan.homework) sections.push(`Homework: ${plan.homework}`);
    if (plan.notes) sections.push(`Teacher Notes: ${plan.notes}`);

    return sections.join('\n');
}

module.exports = {
    isAvailable,
    generateQuestions,
    evaluateAnswers,
    analyzeLessonPlan
};
