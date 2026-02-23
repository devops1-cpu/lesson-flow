const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const prisma = require('../config/prisma');

const router = express.Router();
const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

const slotIncludes = {
    period: true,
    class: { select: { id: true, name: true, section: true, grade: true } },
    teacher: { select: { id: true, name: true, avatar: true } },
    subject: { select: { id: true, name: true, code: true } },
    room: { select: { id: true, name: true, type: true } }
};

// ─── Get timetable for a class ───
router.get('/class/:classId', authenticate, async (req, res) => {
    try {
        const slots = await prisma.timetableSlot.findMany({
            where: { classId: req.params.classId },
            include: slotIncludes,
            orderBy: [{ dayOfWeek: 'asc' }, { period: { number: 'asc' } }]
        });
        const periods = await prisma.period.findMany({ orderBy: { number: 'asc' } });
        res.json({ slots, periods, days: DAYS });
    } catch (error) {
        console.error('Get class timetable error:', error);
        res.status(500).json({ error: 'Failed to fetch class timetable.' });
    }
});

// ─── Get timetable for a teacher ───
router.get('/teacher/:teacherId', authenticate, async (req, res) => {
    try {
        const slots = await prisma.timetableSlot.findMany({
            where: { teacherId: req.params.teacherId },
            include: slotIncludes,
            orderBy: [{ dayOfWeek: 'asc' }, { period: { number: 'asc' } }]
        });
        const periods = await prisma.period.findMany({ orderBy: { number: 'asc' } });
        res.json({ slots, periods, days: DAYS });
    } catch (error) {
        console.error('Get teacher timetable error:', error);
        res.status(500).json({ error: 'Failed to fetch teacher timetable.' });
    }
});

// ─── Get timetable for logged-in student (from class memberships) ───
router.get('/my', authenticate, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let classIds = [];
        let teacherId = null;

        if (req.user.role === 'STUDENT') {
            const memberships = await prisma.classMember.findMany({
                where: { userId: req.user.id },
                select: { classId: true }
            });
            classIds = memberships.map(m => m.classId);
        } else if (req.user.role === 'TEACHER') {
            teacherId = req.user.id;
        }

        const whereClause = teacherId ? { teacherId } : { classId: { in: classIds } };

        const slots = await prisma.timetableSlot.findMany({
            where: whereClause,
            include: slotIncludes,
            orderBy: [{ dayOfWeek: 'asc' }, { period: { number: 'asc' } }]
        });
        const periods = await prisma.period.findMany({ orderBy: { number: 'asc' } });

        let assignments = [];
        if (startDate && endDate) {
            assignments = await prisma.timetableAssignment.findMany({
                where: {
                    slotId: { in: slots.map(s => s.id) },
                    date: {
                        gte: new Date(startDate),
                        lte: new Date(endDate)
                    }
                },
                include: {
                    lessonPlan: { select: { id: true, title: true, status: true, subject: true, grade: true } }
                }
            });
        }

        res.json({ slots, periods, assignments, days: DAYS });
    } catch (error) {
        console.error('Get my timetable error:', error);
        res.status(500).json({ error: 'Failed to fetch your timetable.' });
    }
});

// ─── Get timetable for a room ───
router.get('/room/:roomId', authenticate, async (req, res) => {
    try {
        const slots = await prisma.timetableSlot.findMany({
            where: { roomId: req.params.roomId },
            include: slotIncludes,
            orderBy: [{ dayOfWeek: 'asc' }, { period: { number: 'asc' } }]
        });
        const periods = await prisma.period.findMany({ orderBy: { number: 'asc' } });
        res.json({ slots, periods, days: DAYS });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch room schedule.' });
    }
});

// ─── Get Public timetable data (Unauthenticated) ───
router.get('/public', async (req, res) => {
    try {
        const slots = await prisma.timetableSlot.findMany({
            include: {
                period: true,
                class: { select: { id: true, name: true, section: true, grade: true } },
                teacher: { select: { id: true, name: true } },
                subject: { select: { id: true, name: true, code: true, color: true } },
                room: { select: { id: true, name: true } }
            },
            orderBy: [{ dayOfWeek: 'asc' }, { period: { number: 'asc' } }]
        });
        const periods = await prisma.period.findMany({ orderBy: { number: 'asc' } });
        const classes = await prisma.class.findMany({
            select: { id: true, name: true, section: true, grade: true },
            orderBy: [{ grade: 'asc' }, { section: 'asc' }]
        });
        const teachers = await prisma.user.findMany({
            where: { role: 'TEACHER' },
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
        });
        res.json({ slots, periods, days: Object.values(DAYS).length ? DAYS : ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'], classes, teachers });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch public timetable.' });
    }
});

// ─── Get ALL timetable data (Admin/HOD — for the full grid view) ───
router.get('/all', authenticate, requireRole('ADMIN', 'HOD'), async (req, res) => {
    try {
        const { view } = req.query; // 'classes', 'teachers', 'rooms'

        const slots = await prisma.timetableSlot.findMany({
            include: slotIncludes,
            orderBy: [{ dayOfWeek: 'asc' }, { period: { number: 'asc' } }]
        });
        const periods = await prisma.period.findMany({ orderBy: { number: 'asc' } });
        const classes = await prisma.class.findMany({
            select: { id: true, name: true, section: true, grade: true },
            orderBy: [{ grade: 'asc' }, { section: 'asc' }]
        });
        const teachers = await prisma.user.findMany({
            where: { role: 'TEACHER' },
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
        });
        const rooms = await prisma.room.findMany({
            select: { id: true, name: true, type: true },
            orderBy: { name: 'asc' }
        });

        res.json({ slots, periods, days: DAYS, classes, teachers, rooms });
    } catch (error) {
        console.error('Get all timetable error:', error);
        res.status(500).json({ error: 'Failed to fetch timetable data.' });
    }
});

// ─── Create or update a slot (Admin only) ───
router.post('/slots', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        const { dayOfWeek, periodId, classId, teacherId, subjectId, roomId, lessonPlanId } = req.body;

        if (!dayOfWeek || !periodId || !classId || !teacherId || !subjectId) {
            return res.status(400).json({ error: 'dayOfWeek, periodId, classId, teacherId, and subjectId are required.' });
        }

        // Check period is not a break
        const period = await prisma.period.findUnique({ where: { id: periodId } });
        if (period?.isBreak) {
            return res.status(400).json({ error: 'Cannot schedule a lesson during a break period.' });
        }

        const slot = await prisma.timetableSlot.create({
            data: { dayOfWeek, periodId, classId, teacherId, subjectId, roomId: roomId || null },
            include: slotIncludes
        });
        res.status(201).json(slot);
    } catch (error) {
        if (error.code === 'P2002') {
            const field = error.meta?.target;
            let msg = 'Scheduling conflict detected.';
            if (field?.includes('classId')) msg = 'This class already has a lesson at this time.';
            if (field?.includes('teacherId')) msg = 'This teacher is already assigned at this time.';
            if (field?.includes('roomId')) msg = 'This room is already booked at this time.';
            return res.status(409).json({ error: msg });
        }
        console.error('Create slot error:', error);
        res.status(500).json({ error: 'Failed to create timetable slot.' });
    }
});

// ─── Delete a slot (Admin only) ───
router.delete('/slots/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        await prisma.timetableSlot.delete({ where: { id: req.params.id } });
        res.json({ message: 'Slot deleted.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete slot.' });
    }
});

// ─── Link a lesson plan to a slot on a specific date ───
router.patch('/slots/:id/link', authenticate, requireRole('ADMIN', 'TEACHER'), async (req, res) => {
    try {
        const { lessonPlanId, date } = req.body;
        if (!date) return res.status(400).json({ error: 'Date is required for assignment.' });

        const slot = await prisma.timetableSlot.findUnique({ where: { id: req.params.id } });
        if (!slot) return res.status(404).json({ error: 'Slot not found.' });

        const assignment = await prisma.timetableAssignment.upsert({
            where: {
                date_slotId: {
                    date: new Date(date),
                    slotId: slot.id
                }
            },
            update: { lessonPlanId },
            create: {
                date: new Date(date),
                slotId: slot.id,
                classId: slot.classId,
                lessonPlanId
            },
            include: { lessonPlan: { select: { id: true, title: true, status: true, subject: true, grade: true } } }
        });

        res.json(assignment);
    } catch (error) {
        console.error('Link lesson plan error:', error);
        res.status(500).json({ error: 'Failed to link lesson plan.' });
    }
});

// ─── Check for conflicts ───
router.get('/conflicts', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        // Find teacher overlaps (shouldn't exist due to DB constraints, but check anyway)
        const allSlots = await prisma.timetableSlot.findMany({
            include: slotIncludes
        });

        const conflicts = [];
        const seen = {};

        for (const slot of allSlots) {
            const teacherKey = `teacher-${slot.teacherId}-${slot.dayOfWeek}-${slot.periodId}`;
            const classKey = `class-${slot.classId}-${slot.dayOfWeek}-${slot.periodId}`;
            const roomKey = slot.roomId ? `room-${slot.roomId}-${slot.dayOfWeek}-${slot.periodId}` : null;

            if (seen[teacherKey]) {
                conflicts.push({ type: 'teacher_overlap', slotA: seen[teacherKey], slotB: slot });
            } else { seen[teacherKey] = slot; }

            if (seen[classKey]) {
                conflicts.push({ type: 'class_overlap', slotA: seen[classKey], slotB: slot });
            } else { seen[classKey] = slot; }

            if (roomKey && seen[roomKey]) {
                conflicts.push({ type: 'room_overlap', slotA: seen[roomKey], slotB: slot });
            } else if (roomKey) { seen[roomKey] = slot; }
        }

        res.json({ conflicts, count: conflicts.length });
    } catch (error) {
        console.error('Conflict check error:', error);
        res.status(500).json({ error: 'Failed to check conflicts.' });
    }
});

// ─── Auto-generate timetable ───
router.post('/auto-generate', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        const { clearExisting, activeDays } = req.body;
        const scheduler = require('../services/schedulerService');
        const result = await scheduler.autoGenerate({ clearExisting, activeDays });
        res.json(result);
    } catch (error) {
        console.error('Auto-generate error:', error);
        res.status(500).json({ error: 'Auto-generation failed: ' + error.message });
    }
});// ─── Timetable Lesson Configurations (Budget/Budgeting) ───

// Get all lesson configurations
router.get('/lessons', authenticate, requireRole('ADMIN', 'HOD'), async (req, res) => {
    try {
        const lessons = await prisma.timetableLesson.findMany({
            include: {
                subject: { select: { id: true, name: true, code: true, color: true } },
                class: { select: { id: true, name: true, grade: true, section: true } },
                teachers: { include: { teacher: { select: { id: true, name: true, email: true } } } }
            },
            orderBy: [{ class: { grade: 'asc' } }, { class: { section: 'asc' } }]
        });
        res.json(lessons);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch lesson configurations.' });
    }
});

// Create/Update lesson configuration
router.post('/lessons', authenticate, requireRole('ADMIN', 'HOD'), async (req, res) => {
    try {
        const { id, subjectId, classId, count, length, roomType, teacherIds } = req.body;

        if (!subjectId || !classId) {
            return res.status(400).json({ error: 'Subject and Class are required.' });
        }

        const data = {
            subjectId,
            classId,
            count: parseInt(count) || 1,
            length: parseInt(length) || 1,
            roomType: roomType || null,
        };

        let lesson;
        if (id) {
            // Update existing
            lesson = await prisma.timetableLesson.update({
                where: { id },
                data: {
                    ...data,
                    teachers: {
                        deleteMany: {},
                        create: (teacherIds || []).map(tid => ({ teacherId: tid }))
                    }
                },
                include: { teachers: true }
            });
        } else {
            // Create New
            lesson = await prisma.timetableLesson.create({
                data: {
                    ...data,
                    teachers: {
                        create: (teacherIds || []).map(tid => ({ teacherId: tid }))
                    }
                },
                include: { teachers: true }
            });
        }
        res.json(lesson);
    } catch (error) {
        console.error('Lesson config error:', error);
        res.status(500).json({ error: 'Failed to save lesson configuration.' });
    }
});

// Delete lesson configuration
router.delete('/lessons/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        await prisma.timetableLesson.delete({ where: { id: req.params.id } });
        res.json({ message: 'Lesson configuration deleted.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete lesson configuration.' });
    }
});

module.exports = router;
