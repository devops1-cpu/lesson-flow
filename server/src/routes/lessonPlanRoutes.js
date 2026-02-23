const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const prisma = require('../config/prisma.js');

const router = express.Router();
// ======================= REMINDERS API =======================

// Get 14-day upcoming missing lesson plans for teacher
router.get('/reminders/teacher', authenticate, requireRole('TEACHER', 'ADMIN', 'HOD'), async (req, res) => {
    try {
        const teacherId = req.query.teacherId || req.user.id;

        // 1. Get Teacher's Weekly Timetable
        const schedule = await prisma.timetableSlot.findMany({
            where: { teacherId },
            include: {
                class: { select: { id: true, name: true, grade: true, section: true } },
                subject: { select: { id: true, name: true } },
                period: { select: { id: true, number: true, startTime: true, endTime: true } }
            }
        });

        if (!schedule.length) return res.json([]);

        // 2. Map dayOfWeek string directly from JS Date to Prisma Enum
        const jsDayMap = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

        // Generate 14-day upcoming missing lesson plans based on slots
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let missing = [];

        for (let i = 0; i < 14; i++) {
            const currentObj = new Date(today);
            currentObj.setDate(currentObj.getDate() + i);
            const dayOfWeekStr = jsDayMap[currentObj.getDay()];

            const daySlots = schedule.filter(s => s.dayOfWeek === dayOfWeekStr);
            daySlots.forEach(slot => {
                if (!slot.lessonPlan || slot.lessonPlan.status === 'DRAFT') {
                    const dateStr = currentObj.toISOString().split('T')[0];
                    let existing = missing.find(m => m[dateStr]);
                    if (!existing) {
                        existing = { [dateStr]: { date: currentObj, dayName: dayOfWeekStr, missing: [] } };
                        missing.push(existing);
                    }
                    existing[dateStr].missing.push({
                        classId: slot.class?.id,
                        className: slot.class?.name,
                        grade: slot.class?.grade,
                        section: slot.class?.section,
                        subjectName: slot.subject?.name,
                        periodNumber: slot.period?.number,
                        time: slot.period ? `${slot.period.startTime} - ${slot.period.endTime}` : ''
                    });
                }
            });
        }

        const flatMissing = missing.map(m => Object.values(m)[0]);
        res.json(flatMissing.sort((a, b) => new Date(a.date) - new Date(b.date)));
    } catch (error) {
        console.error('Teacher Reminders Error:', error);
        res.status(500).json({ error: 'Failed to fetch reminders.' });
    }
});

// ======================= LESSON PLANS API =======================

// Get all lesson plans (filtered by role)
router.get('/', authenticate, async (req, res) => {
    try {
        const { status, classId, subject, grade, search } = req.query;
        let where = {};

        // Text search across title, subject, and notes
        if (search && search.trim()) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { subject: { contains: search, mode: 'insensitive' } },
                { notes: { contains: search, mode: 'insensitive' } },
                { instruction: { contains: search, mode: 'insensitive' } }
            ];
        }

        // Role-based filtering
        if (req.user.role === 'TEACHER') {
            where.teacherId = req.user.id;
        } else if (req.user.role === 'HOD') {
            // HOD sees all plans from their department
            if (req.user.headedDepartment) {
                const teachers = await prisma.user.findMany({
                    where: { departmentId: req.user.headedDepartment.id },
                    select: { id: true }
                });
                const teacherIds = teachers.map(t => t.id);
                where.teacherId = { in: teacherIds };
            } else {
                // If HOD has no dept assigned, seeing nothing or just own
                where.teacherId = req.user.id;
            }
        } else if (req.user.role === 'STUDENT') {
            const memberships = await prisma.classMember.findMany({
                where: { userId: req.user.id },
                select: { classId: true }
            });
            const classIds = memberships.map(m => m.classId);
            where.classId = { in: classIds };
            where.status = 'PUBLISHED';
        } else if (req.user.role === 'PARENT') {
            const children = await prisma.parentStudent.findMany({
                where: { parentId: req.user.id },
                select: { studentId: true }
            });
            const studentIds = children.map(c => c.studentId);
            const memberships = await prisma.classMember.findMany({
                where: { userId: { in: studentIds } },
                select: { classId: true }
            });
            const classIds = memberships.map(m => m.classId);
            where.classId = { in: classIds };
            where.status = 'PUBLISHED';
        }
        // PROCESS_DEPT and ADMIN see all plans (no additional filtering)

        if (status) where.status = status;
        if (classId) where.classId = classId;
        if (subject) where.subject = { contains: subject, mode: 'insensitive' };
        if (grade) where.grade = grade;

        const lessonPlans = await prisma.lessonPlan.findMany({
            where,
            include: {
                teacher: { select: { id: true, name: true, email: true, avatar: true } },
                class: { select: { id: true, name: true, subject: true, grade: true } },
                resources: true,
                readinessAssessment: { select: { id: true, score: true, status: true, feedback: true } }
            },
            orderBy: { updatedAt: 'desc' }
        });

        res.json(lessonPlans);
    } catch (error) {
        console.error('Get lesson plans error:', error);
        res.status(500).json({ error: 'Failed to fetch lesson plans.' });
    }
});

// Approve Lesson Plan (HOD/Admin)
router.patch('/:id/approve', authenticate, requireRole('HOD', 'ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;
        const { comment } = req.body;

        const plan = await prisma.lessonPlan.update({
            where: { id },
            data: {
                status: 'APPROVED',
                approverId: req.user.id,
                approvalDate: new Date(),
                approvalComment: comment
            }
        });
        res.json(plan);
    } catch (error) {
        res.status(500).json({ error: 'Failed to approve lesson plan.' });
    }
});

// Reject Lesson Plan (HOD/Admin)
router.patch('/:id/reject', authenticate, requireRole('HOD', 'ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;
        const { comment } = req.body; // Reason for rejection

        const plan = await prisma.lessonPlan.update({
            where: { id },
            data: {
                status: 'CHANGES_REQUESTED',
                approverId: req.user.id,
                approvalComment: comment
            }
        });
        res.json(plan);
    } catch (error) {
        res.status(500).json({ error: 'Failed to reject lesson plan.' });
    }
});

// Submit Lesson Plan (Teacher) — requires readiness score >= 70
router.patch('/:id/submit', authenticate, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;

        // Check readiness assessment
        const assessment = await prisma.readinessAssessment.findUnique({
            where: { lessonPlanId: id }
        });

        if (!assessment || assessment.status !== 'COMPLETED') {
            return res.status(400).json({
                error: 'AI Readiness Assessment required.',
                message: 'Please complete the AI Readiness Assessment before submitting. You need a score of 70 or above.'
            });
        }

        if (assessment.score < 70) {
            return res.status(400).json({
                error: 'Readiness score too low.',
                message: `Your readiness score is ${assessment.score}/100. A minimum of 70 is required to submit for HOD approval. Please retake the assessment.`,
                score: assessment.score
            });
        }

        const plan = await prisma.lessonPlan.update({
            where: { id },
            data: {
                status: 'SUBMITTED',
                submissionDate: new Date()
            }
        });
        res.json(plan);
    } catch (error) {
        res.status(500).json({ error: 'Failed to submit lesson plan.' });
    }
});

// Get single lesson plan
router.get('/:id', authenticate, async (req, res) => {
    try {
        // HOD and ADMIN get full readiness data (questions + answers) for review
        const isReviewer = ['HOD', 'ADMIN'].includes(req.user.role);
        const readinessSelect = isReviewer
            ? { select: { id: true, score: true, status: true, feedback: true, questions: true, answers: true, sectionAnalysis: true } }
            : { select: { id: true, score: true, status: true, feedback: true, sectionAnalysis: true } };

        const lessonPlan = await prisma.lessonPlan.findUnique({
            where: { id: req.params.id },
            include: {
                teacher: { select: { id: true, name: true, email: true, avatar: true } },
                class: { select: { id: true, name: true, subject: true, grade: true, section: true } },
                resources: true,
                readinessAssessment: readinessSelect
            }
        });

        if (!lessonPlan) {
            return res.status(404).json({ error: 'Lesson plan not found.' });
        }

        res.json(lessonPlan);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch lesson plan.' });
    }
});

// Create lesson plan (Teacher/Admin only)
router.post('/', authenticate, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
    try {
        const {
            title, subject, grade, objectives, materials,
            warmUp, instruction, guidedPractice, independentPractice,
            closure, assessment, differentiation, homework, notes,
            status, classId, resources
        } = req.body;

        if (!title || !subject || !grade) {
            return res.status(400).json({ error: 'Title, subject, and grade are required.' });
        }

        const lessonPlan = await prisma.lessonPlan.create({
            data: {
                title, subject, grade,
                objectives: objectives || [],
                materials: materials || [],
                warmUp, instruction, guidedPractice, independentPractice,
                closure, assessment, differentiation, homework, notes,
                status: status || 'DRAFT',
                teacherId: req.user.id,
                classId: classId || null,
                resources: resources ? {
                    create: resources.map(r => ({ name: r.name, type: r.type, url: r.url }))
                } : undefined
            },
            include: {
                teacher: { select: { id: true, name: true, email: true } },
                class: true,
                resources: true
            }
        });

        res.status(201).json(lessonPlan);
    } catch (error) {
        console.error('Create lesson plan error:', error);
        res.status(500).json({ error: 'Failed to create lesson plan.' });
    }
});

// Update lesson plan
router.put('/:id', authenticate, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
    try {
        const existing = await prisma.lessonPlan.findUnique({ where: { id: req.params.id } });
        if (!existing) {
            return res.status(404).json({ error: 'Lesson plan not found.' });
        }

        // Only owner or admin can update
        if (req.user.role !== 'ADMIN' && existing.teacherId !== req.user.id) {
            return res.status(403).json({ error: 'You can only edit your own lesson plans.' });
        }

        const {
            title, subject, grade, objectives, materials,
            warmUp, instruction, guidedPractice, independentPractice,
            closure, assessment, differentiation, homework, notes,
            status, classId
        } = req.body;

        const lessonPlan = await prisma.lessonPlan.update({
            where: { id: req.params.id },
            data: {
                ...(title && { title }),
                ...(subject && { subject }),
                ...(grade && { grade }),
                ...(objectives && { objectives }),
                ...(materials && { materials }),
                ...(warmUp !== undefined && { warmUp }),
                ...(instruction !== undefined && { instruction }),
                ...(guidedPractice !== undefined && { guidedPractice }),
                ...(independentPractice !== undefined && { independentPractice }),
                ...(closure !== undefined && { closure }),
                ...(assessment !== undefined && { assessment }),
                ...(differentiation !== undefined && { differentiation }),
                ...(homework !== undefined && { homework }),
                ...(notes !== undefined && { notes }),
                ...(status && { status }),
                ...(classId !== undefined && { classId })
            },
            include: {
                teacher: { select: { id: true, name: true, email: true } },
                class: true,
                resources: true
            }
        });

        res.json(lessonPlan);
    } catch (error) {
        console.error('Update lesson plan error:', error);
        res.status(500).json({ error: 'Failed to update lesson plan.' });
    }
});

// Delete lesson plan
router.delete('/:id', authenticate, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
    try {
        const existing = await prisma.lessonPlan.findUnique({ where: { id: req.params.id } });
        if (!existing) {
            return res.status(404).json({ error: 'Lesson plan not found.' });
        }

        if (req.user.role !== 'ADMIN' && existing.teacherId !== req.user.id) {
            return res.status(403).json({ error: 'You can only delete your own lesson plans.' });
        }

        await prisma.lessonPlan.delete({ where: { id: req.params.id } });
        res.json({ message: 'Lesson plan deleted successfully.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete lesson plan.' });
    }
});

// Copy lesson plan to another section/class
router.post('/:id/copy', authenticate, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
    try {
        const { classId } = req.body;
        if (!classId) return res.status(400).json({ error: 'Target classId is required.' });

        const original = await prisma.lessonPlan.findUnique({ where: { id: req.params.id } });
        if (!original) return res.status(404).json({ error: 'Original plan not found.' });

        if (req.user.role !== 'ADMIN' && original.teacherId !== req.user.id) {
            return res.status(403).json({ error: 'You can only copy your own plans.' });
        }

        const targetClass = await prisma.class.findUnique({
            where: { id: classId },
            select: { name: true, section: true, grade: true }
        });

        const copy = await prisma.lessonPlan.create({
            data: {
                title: `${original.title} (${targetClass?.section || targetClass?.name || 'Copy'})`,
                subject: original.subject,
                grade: targetClass?.grade || original.grade,
                duration: original.duration,
                objectives: original.objectives,
                materials: original.materials,
                warmUp: original.warmUp,
                instruction: original.instruction,
                guidedPractice: original.guidedPractice,
                independentPractice: original.independentPractice,
                closure: original.closure,
                assessment: original.assessment,
                differentiation: original.differentiation,
                homework: original.homework,
                notes: original.notes,
                status: 'DRAFT',
                scheduledDate: original.scheduledDate,
                teacherId: req.user.id,
                classId
            },
            include: {
                teacher: { select: { id: true, name: true } },
                class: { select: { id: true, name: true, section: true, grade: true } }
            }
        });

        res.status(201).json(copy);
    } catch (error) {
        console.error('Copy plan error:', error);
        res.status(500).json({ error: 'Failed to copy lesson plan.' });
    }
});

module.exports = router;
