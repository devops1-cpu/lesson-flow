const express = require('express');
const { GoogleGenAI } = require('@google/genai');
const { authenticate, requireRole } = require('../middleware/auth');
const prisma = require('../config/prisma.js');

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
                    config: { temperature: 0.4, ...config } // Lower temp for analytics
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

// Helper to get Department Stats (HOD)
async function getDepartmentStats(hodId) {
    // Find department for this HOD
    const hod = await prisma.user.findUnique({
        where: { id: hodId },
        select: { departmentId: true, department: { select: { name: true } } }
    });

    if (!hod?.departmentId) return null;

    // Get teachers in dept
    const teachers = await prisma.user.findMany({
        where: { departmentId: hod.departmentId, role: 'TEACHER' },
        select: { id: true, name: true, email: true }
    });

    const teacherIds = teachers.map(t => t.id);

    // Get plans for these teachers
    const plans = await prisma.lessonPlan.findMany({
        where: { teacherId: { in: teacherIds } },
        include: {
            readinessAssessment: { select: { score: true, status: true } }
        },
        orderBy: { createdAt: 'desc' }
    });

    return {
        departmentName: hod.department.name,
        totalTeachers: teachers.length,
        totalPlans: plans.length,
        teachers: teachers.map(t => ({
            name: t.name,
            totalPlans: plans.filter(p => p.teacherId === t.id).length,
            avgReadiness: Math.round(plans.filter(p => p.teacherId === t.id && p.readinessAssessment?.score)
                .reduce((acc, curr) => acc + curr.readinessAssessment.score, 0) /
                (plans.filter(p => p.teacherId === t.id && p.readinessAssessment?.score).length || 1)) || 0,
            latePlans: plans.filter(p => p.teacherId === t.id && p.status === 'DRAFT').length
        })),
        recentActivity: plans.slice(0, 5).map(p => ({
            title: p.title,
            status: p.status,
            date: p.createdAt ? p.createdAt.toISOString().split('T')[0] : 'Unscheduled'
        }))
    };
}

// Helper to get Process Stats (School-wide)
async function getProcessStats() {
    const totalTeachers = await prisma.user.count({ where: { role: 'TEACHER' } });
    const totalPlans = await prisma.lessonPlan.count();
    const submitted = await prisma.lessonPlan.count({ where: { status: { in: ['SUBMITTED', 'APPROVED', 'PUBLISHED'] } } });

    // Find top overdue teachers
    const now = new Date();
    const overduePlans = await prisma.lessonPlan.findMany({
        where: {
            status: 'DRAFT'
        },
        include: { teacher: { select: { name: true, department: { select: { name: true } } } } }
    });

    const overdueByTeacher = {};
    overduePlans.forEach(p => {
        const name = p.teacher.name;
        if (!overdueByTeacher[name]) overdueByTeacher[name] = { count: 0, dept: p.teacher.department?.name || 'Unassigned' };
        overdueByTeacher[name].count++;
    });

    const topOverdue = Object.entries(overdueByTeacher)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([name, data]) => `${name} (${data.dept}): ${data.count} overdue`);

    return {
        totalTeachers,
        totalPlans,
        submissionRate: Math.round((submitted / totalPlans) * 100) || 0,
        topOverdueTeachers: topOverdue
    };
}

const SYSTEM_PROMPTS = {
    process: `You are the AI Operations Analyst for LessonFlow.
Your goal is to help the Process Department monitor compliance, track deadlines, and improve school-wide efficiency.
You have access to aggregated stats about lesson plan submissions.
When asked, analyze the data to find bottlenecks (e.g., which department is late).
Draft professional reminders or reports when requested.
Keep answers data-driven, professional, and concise.`,

    department: `You are the AI Assistant to a Department Head (HOD).
Your goal is to help the HOD manage their team of teachers.
You have access to stats about the teachers in this department.
Help identify teachers who are falling behind (late plans) or struggling (low readiness scores).
Draft constructive feedback or coaching emails.
Be supportive, focusing on teacher growth and curriculum quality.`
};

// POST /api/analytics/chat
router.post('/chat', authenticate, async (req, res) => {
    try {
        const { message, mode, history } = req.body;

        if (!message) return res.status(400).json({ error: 'Message required.' });
        if (!GEMINI_API_KEY) return res.status(503).json({ error: 'AI available.' });

        let contextData = {};
        let systemPrompt = '';

        if (mode === 'department') {
            // HOD Mode
            if (!['HOD', 'ADMIN'].includes(req.user.role)) return res.status(403).json({ error: 'Unauthorized.' });
            contextData = await getDepartmentStats(req.user.id);
            systemPrompt = SYSTEM_PROMPTS.department;
            if (!contextData) return res.status(404).json({ error: 'No department assigned.' });
        } else if (mode === 'process') {
            // Process Mode
            if (!['PROCESS_DEPT', 'ADMIN'].includes(req.user.role)) return res.status(403).json({ error: 'Unauthorized.' });
            contextData = await getProcessStats();
            systemPrompt = SYSTEM_PROMPTS.process;
        } else {
            return res.status(400).json({ error: 'Invalid mode.' });
        }

        const dataSummary = JSON.stringify(contextData, null, 2);

        // Build conversation history
        const conversationHistory = (history || []).slice(-6).map(m =>
            `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`
        ).join('\n');

        const prompt = `${systemPrompt}

=== CURRENT DATA ===
${dataSummary}
=== END DATA ===

${conversationHistory ? `=== CONVERSATION HISTORY ===\n${conversationHistory}\n=== END HISTORY ===\n` : ''}
User: ${message}

Assistant:`;

        const response = await callGemini(prompt);

        res.json({
            reply: response.trim(),
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Analytics chat error:', error);
        res.status(500).json({ error: 'Failed to generate insight.' });
    }
});

module.exports = router;
