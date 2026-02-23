const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const geminiAgent = require('../services/geminiAgent');
const prisma = require('../config/prisma.js');

const router = express.Router();
/**
 * AI Readiness Assessment — Robust Evaluation Engine
 * 
 * Evaluates teacher answers across multiple quality dimensions:
 * 1. Relevance — does the answer address the question?
 * 2. Specificity — does it include concrete details, examples, or steps?
 * 3. Depth — is there enough substance for a thoughtful response?
 * 4. Pedagogical alignment — does it align with teaching best practices?
 * 5. AI Detection — flags machine-generated or copy-pasted content.
 * 6. Section Analysis — provides HOD-level critique for each plan section.
 */

// ─── Section Analysis ───────────────────────────────────────────────

router.post('/analyze', authenticate, async (req, res) => {
    try {
        const { planId } = req.body;
        if (!planId) return res.status(400).json({ error: 'Plan ID required.' });

        const plan = await prisma.lessonPlan.findUnique({
            where: { id: planId },
            include: { readinessAssessment: true }
        });

        if (!plan) return res.status(404).json({ error: 'Plan not found.' });

        // Generate critique
        const analysis = await geminiAgent.analyzeLessonPlan(plan);

        // Save to DB
        const updated = await prisma.readinessAssessment.upsert({
            where: { lessonPlanId: planId },
            update: { sectionAnalysis: analysis },
            create: {
                lessonPlanId: planId,
                sectionAnalysis: analysis,
                status: 'PENDING'
            }
        });

        res.json(updated.sectionAnalysis);

    } catch (error) {
        console.error('Section analysis error:', error);
        res.status(500).json({ error: 'Failed to analyze plan.' });
    }
});

// ─── Question Generation ────────────────────────────────────────────

function generateQuestions(plan) {
    const questions = [];

    // Q1: Learning Objectives — probes measurability and clarity
    if (plan.objectives?.length) {
        const obj = plan.objectives[0];
        questions.push({
            id: 'q1',
            question: `Your lesson lists "${obj}" as the primary objective. Describe exactly how you will measure whether each student has achieved this by the end of the class — what observable behaviors or outputs will you look for?`,
            category: 'Learning Objectives',
            weight: 25,
            // Keywords the answer should touch on for relevance
            relevanceKeywords: ['measure', 'assess', 'check', 'observe', 'student', 'understand', 'demonstrate', 'show', 'quiz', 'question', 'activity', 'output', 'evidence', 'indicator', 'criteria', 'exit', 'ticket', 'rubric', 'performance', 'success'],
            requiresSpecificity: true,
        });
    } else {
        questions.push({
            id: 'q1',
            question: `Your lesson plan does not list specific learning objectives. What are the 2-3 concrete, measurable outcomes you want every student to achieve by the end of this lesson?`,
            category: 'Learning Objectives',
            weight: 25,
            relevanceKeywords: ['objective', 'outcome', 'student', 'learn', 'achieve', 'understand', 'demonstrate', 'able', 'skill', 'know', 'apply'],
            requiresSpecificity: true,
        });
    }

    // Q2: Instructional Strategy — probes pedagogical approach
    if (plan.instruction) {
        questions.push({
            id: 'q2',
            question: `Walk me through your exact step-by-step approach to explaining the core concept during direct instruction. What specific examples or analogies will you use? What will you do in the first 30 seconds if you notice confused faces?`,
            category: 'Instructional Strategy',
            weight: 25,
            relevanceKeywords: ['explain', 'example', 'step', 'demonstrate', 'show', 'visual', 'analogy', 'ask', 'question', 'check', 'confused', 'alternative', 'approach', 'repeat', 'simplify', 'break down', 'model', 'scaffold'],
            requiresSpecificity: true,
        });
    } else {
        questions.push({
            id: 'q2',
            question: `How will you introduce and teach the main concept of this ${plan.subject || ''} lesson? Describe your approach step by step, including at least one concrete example you will use.`,
            category: 'Instructional Strategy',
            weight: 25,
            relevanceKeywords: ['teach', 'explain', 'introduce', 'example', 'step', 'approach', 'method', 'demonstrate', 'show'],
            requiresSpecificity: true,
        });
    }

    // Q3: Differentiation — probes inclusive teaching
    if (plan.differentiation) {
        questions.push({
            id: 'q3',
            question: `You mention differentiation in your plan. Give me a specific example: if a student in your class is reading two grade levels below, what exact modifications will you make to this lesson so they can still access the core learning? And what about a student who finishes early?`,
            category: 'Differentiation',
            weight: 20,
            relevanceKeywords: ['student', 'below', 'above', 'advanced', 'struggling', 'modify', 'adapt', 'support', 'scaffold', 'extension', 'challenge', 'group', 'pair', 'simplify', 'visual', 'extra', 'alternative', 'level'],
            requiresSpecificity: true,
        });
    } else {
        questions.push({
            id: 'q3',
            question: `How will you ensure every student in your class can access this lesson — including those who struggle with the basics and those who are already advanced? Give at least one specific adjustment for each group.`,
            category: 'Differentiation',
            weight: 20,
            relevanceKeywords: ['student', 'struggling', 'advanced', 'adjust', 'support', 'modify', 'different', 'level', 'ability', 'pair', 'group', 'scaffold'],
            requiresSpecificity: true,
        });
    }

    // Q4: Assessment — probes formative checking
    if (plan.assessment) {
        questions.push({
            id: 'q4',
            question: `Describe how your assessment method works in real-time during the lesson. At what exact point will you pause to check understanding? How quickly can you identify which students need help — and what will you do with that information in the moment?`,
            category: 'Assessment',
            weight: 20,
            relevanceKeywords: ['check', 'understand', 'pause', 'question', 'observe', 'student', 'identify', 'help', 'support', 'quiz', 'exit', 'ticket', 'formative', 'response', 'feedback', 'adjust', 'reteach', 'minute'],
            requiresSpecificity: true,
        });
    } else {
        questions.push({
            id: 'q4',
            question: `You haven't specified an assessment method. What formative assessment technique will you use during this lesson to check understanding in real-time? How will you know — within the first 15 minutes — if students are lost?`,
            category: 'Assessment',
            weight: 20,
            relevanceKeywords: ['check', 'assess', 'formative', 'question', 'quiz', 'understand', 'know', 'observe', 'response', 'feedback', 'student'],
            requiresSpecificity: true,
        });
    }

    // Q5: Preparation & Contingency
    questions.push({
        id: 'q5',
        question: `What is the single hardest concept or potential confusion point in this lesson? Walk me through your Plan B — what specific backup activity or alternative explanation will you use if your primary approach fails?`,
        category: 'Preparation',
        weight: 10,
        relevanceKeywords: ['hard', 'difficult', 'challenge', 'confus', 'backup', 'alternative', 'plan b', 'if', 'fail', 'struggle', 'instead', 'approach', 'activity', 'explain', 'different', 'way'],
        requiresSpecificity: true,
    });

    return questions;
}


// ─── AI Detection Engine ────────────────────────────────────────────

function detectAIGenerated(text) {
    if (!text || text.trim().length < 20) return { isAI: false, confidence: 0, signals: [] };

    const signals = [];
    let aiScore = 0;
    const lower = text.toLowerCase();

    // 1. AI filler phrases
    const aiPhrases = [
        'it is important to note', "it's important to note",
        'it is worth mentioning', "it's worth mentioning",
        'in conclusion', 'to summarize',
        'firstly', 'secondly', 'thirdly', 'furthermore', 'moreover',
        'in today\'s', 'in the context of',
        'it is essential', "it's essential",
        'this ensures that', 'this allows for',
        'by leveraging', 'by utilizing',
        'a comprehensive', 'a holistic',
        'foster an environment', 'conducive to learning',
        'multifaceted approach', 'diverse learning needs',
        'facilitate learning', 'optimal learning',
        'in this regard', 'in light of',
        'as an educator', 'as a teacher',
        'delve into', 'delve deeper',
        'crucial', 'pivotal', 'paramount',
        'landscape', 'ecosystem', 'paradigm',
        'harness', 'leverage', 'utilize',
        'robust', 'streamline',
        'tapestry', 'nuanced', 'myriad',
        'in essence', 'it should be noted',
        'needless to say', 'in other words',
    ];

    let phraseHits = 0;
    for (const phrase of aiPhrases) {
        if (lower.includes(phrase)) phraseHits++;
    }
    if (phraseHits >= 5) {
        aiScore += 40;
        signals.push(`High density of AI-typical phrases (${phraseHits} detected)`);
    } else if (phraseHits >= 3) {
        aiScore += 25;
        signals.push(`Multiple AI-typical phrases found (${phraseHits} detected)`);
    } else if (phraseHits >= 1) {
        aiScore += 8;
    }

    // 2. Sentence structure uniformity
    const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 5);
    if (sentences.length >= 3) {
        const lengths = sentences.map(s => s.split(/\s+/).length);
        const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
        const variance = lengths.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / lengths.length;
        const stdDev = Math.sqrt(variance);
        if (stdDev < 3 && avg > 10) {
            aiScore += 15;
            signals.push('Suspiciously uniform sentence lengths');
        }
    }

    // 3. Bullet/list patterns
    const bulletCount = (text.match(/^\s*[-*\d]+[.)]/gm) || []).length;
    if (bulletCount >= 4) {
        aiScore += 12;
        signals.push('Excessive bullet/list formatting in free-text response');
    }

    // 4. High vocabulary sophistication
    const sophisticatedWords = [
        'aforementioned', 'subsequently', 'pedagogical', 'metacognitive',
        'heterogeneous', 'homogeneous', 'constructivist', 'didactic',
        'taxonomy', 'constructivism', 'behaviorism', 'synergy', 'stakeholders',
        'methodology', 'strategically', 'proactively', 'systematically',
        'comprehensively', 'collaboratively', 'implementable'
    ];
    let sophCount = 0;
    for (const sw of sophisticatedWords) {
        if (lower.includes(sw)) sophCount++;
    }
    if (sophCount >= 5) {
        aiScore += 20;
        signals.push(`Unusually high density of academic jargon (${sophCount} terms)`);
    } else if (sophCount >= 3) {
        aiScore += 10;
        signals.push('Elevated academic jargon density');
    }

    // 5. Unusually long response
    const wordCount = lower.split(/\s+/).length;
    if (wordCount > 150) {
        aiScore += 15;
        signals.push(`Unusually long response (${wordCount} words)`);
    }

    // 6. No contractions or informal language
    const hasContractions = /\b(i'm|i'll|i'd|can't|won't|don't|isn't|aren't|doesn't|didn't|shouldn't|couldn't|wouldn't|we're|they're|it's|that's|there's|here's|let's|who's|what's|how's)\b/i.test(text);
    const hasInformal = /\b(gonna|wanna|kinda|sorta|gotta|dunno|ok|okay|yeah|yep|nope|hmm|well,|so,|like,|basically|actually|honestly)\b/i.test(text);
    if (!hasContractions && !hasInformal && wordCount > 40) {
        aiScore += 10;
        signals.push('No contractions or informal language — unusually formal');
    }

    const confidence = Math.min(aiScore, 100);
    return { isAI: confidence >= 50, confidence, signals };
}


// ─── Answer Evaluation Engine ───────────────────────────────────────

function evaluateAnswer(question, answerText) {
    const answer = (answerText || '').trim();
    if (!answer) {
        return {
            score: 0,
            maxScore: question.weight,
            breakdown: { relevance: 0, specificity: 0, depth: 0, clarity: 0 },
            feedback: `❌ "${question.category}" was not answered.`,
            grade: 'NOT_ANSWERED'
        };
    }

    const words = answer.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const lower = answer.toLowerCase();
    const sentences = answer.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 5);

    // ── Dimension 1: Relevance (does it address the question?) ──
    let relevanceScore = 0;
    const keywords = question.relevanceKeywords || [];
    let keywordHits = 0;
    for (const kw of keywords) {
        if (lower.includes(kw.toLowerCase())) keywordHits++;
    }
    const keywordCoverage = keywords.length > 0 ? keywordHits / keywords.length : 0;

    if (keywordCoverage >= 0.3) relevanceScore = 25;
    else if (keywordCoverage >= 0.15) relevanceScore = 18;
    else if (keywordCoverage > 0) relevanceScore = 10;
    else relevanceScore = 3; // Minimal relevance

    // ── Dimension 2: Specificity (concrete details, examples, numbers) ──
    let specificityScore = 0;
    const hasNumbers = /\d/.test(answer);
    const hasExamples = /\b(for example|for instance|such as|e\.g\.|like when|specifically|in particular)\b/i.test(answer);
    const hasConcreteActions = /\b(i will|i'll|i would|i can|i plan to|my approach|my strategy|first i|then i|next i|after that)\b/i.test(answer);
    const hasQuotesOrNames = /["']|worksheet|handout|textbook|page \d|chapter|slide|video|app|website|\bwhiteboard\b|\bprojector\b/i.test(answer);

    if (hasConcreteActions) specificityScore += 8;
    if (hasExamples) specificityScore += 7;
    if (hasNumbers) specificityScore += 5;
    if (hasQuotesOrNames) specificityScore += 5;
    specificityScore = Math.min(specificityScore, 25);

    // If the answer is very generic (no concrete actions or examples), cap it
    if (!hasConcreteActions && !hasExamples && !hasNumbers) {
        specificityScore = Math.min(specificityScore, 5);
    }

    // ── Dimension 3: Depth (enough substance?) ──
    let depthScore = 0;
    if (wordCount >= 60) depthScore = 25;
    else if (wordCount >= 40) depthScore = 20;
    else if (wordCount >= 25) depthScore = 15;
    else if (wordCount >= 15) depthScore = 8;
    else depthScore = 3;

    // Multiple sentences show more thought
    if (sentences.length >= 3) depthScore = Math.min(25, depthScore + 3);

    // ── Dimension 4: Clarity (well-structured, readable) ──
    let clarityScore = 0;
    const avgSentenceLength = sentences.length > 0
        ? sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length
        : wordCount;

    // Ideal average sentence length is 10-25 words
    if (avgSentenceLength >= 8 && avgSentenceLength <= 30) {
        clarityScore = 25;
    } else if (avgSentenceLength >= 5 && avgSentenceLength <= 40) {
        clarityScore = 18;
    } else {
        clarityScore = 10; // Very short or very long sentences
    }

    // If it's a single run-on sentence, penalize clarity
    if (sentences.length <= 1 && wordCount > 30) {
        clarityScore = Math.max(5, clarityScore - 10);
    }

    // ── Calculate weighted total ──
    // Each dimension is out of 25, total is out of 100
    const rawPercent = (relevanceScore + specificityScore + depthScore + clarityScore) / 100;
    const score = Math.round(question.weight * rawPercent);

    // ── Generate feedback ──
    let feedback = '';
    let grade = '';

    if (rawPercent >= 0.8) {
        grade = 'EXCELLENT';
        feedback = `✅ Excellent response for "${question.category}" — specific, relevant, and well-developed.`;
    } else if (rawPercent >= 0.6) {
        grade = 'GOOD';
        const weak = [];
        if (relevanceScore < 18) weak.push('address the question more directly');
        if (specificityScore < 12) weak.push('include concrete examples or specific actions');
        if (depthScore < 15) weak.push('provide more detail');
        feedback = `⚠️ Good response for "${question.category}"${weak.length > 0 ? `, but try to ${weak.join(' and ')}` : ''}.`;
    } else if (rawPercent >= 0.35) {
        grade = 'NEEDS_WORK';
        const issues = [];
        if (relevanceScore < 15) issues.push("doesn't fully address the question asked");
        if (specificityScore < 10) issues.push('lacks concrete examples or actionable steps');
        if (depthScore < 12) issues.push('needs more substance and detail');
        if (clarityScore < 15) issues.push('could be clearer or better organized');
        feedback = `❗ Needs improvement for "${question.category}": ${issues.join('; ')}.`;
    } else {
        grade = 'INSUFFICIENT';
        feedback = `❌ Insufficient response for "${question.category}" — please provide a detailed, specific answer that directly addresses the question.`;
    }

    return {
        score,
        maxScore: question.weight,
        breakdown: {
            relevance: relevanceScore,
            specificity: specificityScore,
            depth: depthScore,
            clarity: clarityScore
        },
        feedback,
        grade,
        wordCount
    };
}


function evaluateAllAnswers(questions, answers) {
    let totalScore = 0;
    const feedback = [];
    const perQuestion = [];
    let anyAIDetected = false;
    const aiFlags = [];

    for (const q of questions) {
        const answerText = answers[q.id] || '';

        // AI detection on each answer
        const aiResult = detectAIGenerated(answerText);
        if (aiResult.isAI) {
            anyAIDetected = true;
            aiFlags.push({
                questionId: q.id,
                category: q.category,
                confidence: aiResult.confidence,
                signals: aiResult.signals
            });
        }

        // Evaluate the answer
        const evaluation = evaluateAnswer(q, answerText);

        // Apply AI penalty
        if (aiResult.isAI) {
            const penalty = Math.round(evaluation.score * 0.7);
            evaluation.score = Math.max(0, evaluation.score - penalty);
            evaluation.feedback = `🤖 AI-DETECTED in "${q.category}" (${aiResult.confidence}% confidence). Score heavily penalized. Signals: ${aiResult.signals.join('; ')}`;
            evaluation.grade = 'AI_DETECTED';
        }

        totalScore += evaluation.score;
        feedback.push(evaluation.feedback);
        perQuestion.push({
            questionId: q.id,
            category: q.category,
            ...evaluation
        });
    }

    // Add AI warning
    if (anyAIDetected) {
        feedback.push('');
        feedback.push('🚨 AI-GENERATED CONTENT DETECTED: One or more answers appear to be AI-generated. Only original, authentic responses are accepted. Please retake using your own words.');
    }

    // Overall feedback
    const overallFeedback = anyAIDetected
        ? '🔴 Assessment FAILED due to AI-generated content. Please write original answers.'
        : totalScore >= 80
            ? '🟢 Excellent preparation! You are well-ready to deliver this lesson.'
            : totalScore >= 60
                ? '🟡 Good groundwork. Address the flagged areas before class.'
                : '🔴 Additional preparation is strongly recommended before teaching this lesson.';

    feedback.push(overallFeedback);

    return {
        score: anyAIDetected ? Math.min(totalScore, 30) : totalScore,
        feedback,
        perQuestion,
        anyAIDetected,
        aiFlags
    };
}


// ─── Routes ─────────────────────────────────────────────────────────

// POST /readiness/:lessonPlanId/start — Generate questions
router.post('/:lessonPlanId/start', authenticate, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
    try {
        const { lessonPlanId } = req.params;

        const plan = await prisma.lessonPlan.findUnique({ where: { id: lessonPlanId } });
        if (!plan) return res.status(404).json({ error: 'Lesson plan not found.' });
        if (plan.teacherId !== req.user.id && req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'You can only assess your own lesson plans.' });
        }

        // Try Gemini agent first, fall back to rule-based
        let questions;
        let aiEngine = 'rule-based';
        if (geminiAgent.isAvailable()) {
            try {
                questions = await geminiAgent.generateQuestions(plan);
                aiEngine = 'gemini';
                console.log('✨ Questions generated by Gemini AI');
            } catch (geminiErr) {
                console.warn('⚠️ Gemini failed, falling back to rule-based:', geminiErr.message);
                questions = generateQuestions(plan);
            }
        } else {
            questions = generateQuestions(plan);
        }

        const assessment = await prisma.readinessAssessment.upsert({
            where: { lessonPlanId },
            create: { lessonPlanId, questions, status: 'PENDING' },
            update: { questions, answers: null, score: null, feedback: null, status: 'PENDING' }
        });

        res.json({ assessment, questions, aiEngine });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to start readiness assessment.' });
    }
});

// POST /readiness/:lessonPlanId/submit — Submit answers and get score
router.post('/:lessonPlanId/submit', authenticate, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
    try {
        const { lessonPlanId } = req.params;
        const { answers } = req.body;

        const existing = await prisma.readinessAssessment.findUnique({ where: { lessonPlanId } });
        if (!existing) return res.status(404).json({ error: 'Assessment not started. Call /start first.' });

        const questions = existing.questions;

        // Try Gemini agent first, fall back to rule-based
        let evalResult;
        let aiEngine = 'rule-based';

        if (geminiAgent.isAvailable()) {
            try {
                // Fetch the lesson plan for Gemini context
                const plan = await prisma.lessonPlan.findUnique({ where: { id: lessonPlanId } });
                evalResult = await geminiAgent.evaluateAnswers(questions, answers, plan);
                aiEngine = 'gemini';
                console.log('✨ Answers evaluated by Gemini AI, score:', evalResult.score);
            } catch (geminiErr) {
                console.warn('⚠️ Gemini evaluation failed, falling back:', geminiErr.message);
                evalResult = evaluateAllAnswers(questions, answers);
            }
        } else {
            evalResult = evaluateAllAnswers(questions, answers);
        }

        const { score, feedback, perQuestion, anyAIDetected, aiFlags } = evalResult;

        const assessment = await prisma.readinessAssessment.update({
            where: { lessonPlanId },
            data: {
                answers,
                score,
                feedback: Array.isArray(feedback) ? feedback.join('\n') : feedback,
                status: 'COMPLETED'
            }
        });

        res.json({
            assessment,
            score,
            feedback,
            perQuestion,
            cleared: score >= 70 && !anyAIDetected,
            anyAIDetected,
            aiFlags,
            aiEngine
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to submit assessment.' });
    }
});

// GET /readiness/:lessonPlanId — Get existing assessment
router.get('/:lessonPlanId', authenticate, async (req, res) => {
    try {
        const assessment = await prisma.readinessAssessment.findUnique({
            where: { lessonPlanId: req.params.lessonPlanId }
        });
        if (!assessment) return res.status(404).json({ error: 'No assessment found.' });
        res.json(assessment);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch assessment.' });
    }
});

module.exports = router;
