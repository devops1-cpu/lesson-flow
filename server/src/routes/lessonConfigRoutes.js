const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const prisma = require('../config/prisma.js');

const router = express.Router();
const lessonIncludes = {
    subject: { select: { id: true, name: true, code: true, abbreviation: true, color: true } },
    classes: {
        include: {
            class: { select: { id: true, name: true, section: true, grade: true, capacity: true } }
        }
    },
    teachers: {
        include: {
            teacher: { select: { id: true, name: true, email: true } }
        }
    }
};

// ─── Get all lessons ───
router.get('/', authenticate, async (req, res) => {
    try {
        const { classId, subjectId } = req.query;
        const where = {};
        if (classId) where.classes = { some: { classId } };
        if (subjectId) where.subjectId = subjectId;

        const lessons = await prisma.timetableLesson.findMany({
            where,
            include: lessonIncludes,
            orderBy: [{ subject: { name: 'asc' } }]
        });
        res.json(lessons);
    } catch (error) {
        console.error('Get lessons error:', error);
        res.status(500).json({ error: 'Failed to fetch lessons.' });
    }
});

// ─── Get lessons for a specific class ───
router.get('/class/:classId', authenticate, async (req, res) => {
    try {
        const lessons = await prisma.timetableLesson.findMany({
            where: { classes: { some: { classId: req.params.classId } } },
            include: lessonIncludes,
            orderBy: { subject: { name: 'asc' } }
        });
        res.json(lessons);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch class lessons.' });
    }
});

// ─── Get summary counts ───
router.get('/summary', authenticate, async (req, res) => {
    try {
        const lessons = await prisma.timetableLesson.findMany({
            include: {
                subject: { select: { id: true, name: true } },
                classes: { include: { class: { select: { id: true, name: true } } } },
                teachers: { include: { teacher: { select: { id: true, name: true } } } }
            }
        });

        // Count by class
        const byClass = {};
        for (const l of lessons) {
            for (const lc of l.classes) {
                const key = lc.classId;
                if (!byClass[key]) byClass[key] = { classId: key, className: lc.class.name, totalLessons: 0, totalPeriods: 0 };
                byClass[key].totalLessons += 1;
                byClass[key].totalPeriods += l.count * l.length;
            }
        }

        // Count by subject
        const bySubject = {};
        for (const l of lessons) {
            if (l.subject) {
                const key = l.subjectId;
                if (!bySubject[key]) bySubject[key] = { subjectId: key, subjectName: l.subject.name, totalLessons: 0 };
                bySubject[key].totalLessons += l.count;
            }
        }

        // Count by teacher
        const byTeacher = {};
        for (const l of lessons) {
            for (const lt of l.teachers) {
                const key = lt.teacherId;
                if (!byTeacher[key]) byTeacher[key] = { teacherId: key, teacherName: lt.teacher.name, totalPeriods: 0 };
                byTeacher[key].totalPeriods += l.count * l.length;
            }
        }

        res.json({
            totalLessons: lessons.length,
            byClass: Object.values(byClass),
            bySubject: Object.values(bySubject),
            byTeacher: Object.values(byTeacher)
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to compute summary.' });
    }
});

// ─── Create lesson ───
router.post('/', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        const { subjectId, classIds, teacherIds, count, length, roomType, title, isMeeting } = req.body;

        if (!isMeeting && (!subjectId || !classIds || classIds.length === 0)) {
            return res.status(400).json({ error: 'Subject and at least one class are required.' });
        }
        if (isMeeting && !title) {
            return res.status(400).json({ error: 'Title is required for meetings.' });
        }
        if (!teacherIds || !Array.isArray(teacherIds) || teacherIds.length === 0) {
            return res.status(400).json({ error: 'At least one teacher is required.' });
        }

        const lesson = await prisma.timetableLesson.create({
            data: {
                subjectId: isMeeting ? null : subjectId,
                title: isMeeting ? title : null,
                count: count || 1,
                length: length || 1,
                roomType: roomType || null,
                classes: isMeeting ? undefined : {
                    create: classIds.map(cid => ({ classId: cid }))
                },
                teachers: {
                    create: teacherIds.map(tid => ({ teacherId: tid }))
                }
            },
            include: lessonIncludes
        });
        res.status(201).json(lesson);
    } catch (error) {
        console.error('Create lesson error:', error);
        res.status(500).json({ error: 'Failed to create lesson.' });
    }
});

// ─── Update lesson ───
router.put('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        const { subjectId, classIds, teacherIds, count, length, roomType, title, isMeeting } = req.body;

        // Update main lesson fields
        const lesson = await prisma.timetableLesson.update({
            where: { id: req.params.id },
            data: {
                subjectId: isMeeting ? null : (subjectId || null),
                title: isMeeting ? title : null,
                ...(count !== undefined && { count }),
                ...(length !== undefined && { length }),
                ...(roomType !== undefined && { roomType: roomType || null })
            }
        });

        // Update classes if provided and not a meeting
        if (!isMeeting && classIds && Array.isArray(classIds)) {
            await prisma.lessonClass.deleteMany({ where: { lessonId: req.params.id } });
            await prisma.lessonClass.createMany({
                data: classIds.map(cid => ({ lessonId: req.params.id, classId: cid }))
            });
        } else if (isMeeting) {
            await prisma.lessonClass.deleteMany({ where: { lessonId: req.params.id } });
        }

        // Update teachers if provided
        if (teacherIds && Array.isArray(teacherIds)) {
            await prisma.lessonTeacher.deleteMany({ where: { lessonId: req.params.id } });
            await prisma.lessonTeacher.createMany({
                data: teacherIds.map(tid => ({ lessonId: req.params.id, teacherId: tid }))
            });
        }

        // Fetch updated with includes
        const updated = await prisma.timetableLesson.findUnique({
            where: { id: req.params.id },
            include: lessonIncludes
        });
        res.json(updated);
    } catch (error) {
        console.error('Update lesson error:', error);
        res.status(500).json({ error: 'Failed to update lesson.' });
    }
});

// ─── Delete lesson ───
router.delete('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        await prisma.timetableLesson.delete({ where: { id: req.params.id } });
        res.json({ message: 'Lesson deleted.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete lesson.' });
    }
});

// ─── Bulk create from teacher assignments ───
router.post('/from-assignments', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        const assignments = await prisma.teacherAssignment.findMany({
            include: {
                subject: { select: { id: true, name: true } }
            }
        });

        let created = 0;
        for (const a of assignments) {
            // Check if lesson already exists for this subject+class
            const existing = await prisma.timetableLesson.findFirst({
                where: { subjectId: a.subjectId, classes: { some: { classId: a.classId } } },
                include: { teachers: true }
            });

            if (!existing) {
                await prisma.timetableLesson.create({
                    data: {
                        subjectId: a.subjectId,
                        count: 1,
                        length: 1,
                        classes: { create: [{ classId: a.classId }] },
                        teachers: { create: [{ teacherId: a.teacherId }] }
                    }
                });
                created++;
            } else {
                // Add teacher if not already assigned
                const hasTeacher = existing.teachers.some(t => t.teacherId === a.teacherId);
                if (!hasTeacher) {
                    await prisma.lessonTeacher.create({
                        data: { lessonId: existing.id, teacherId: a.teacherId }
                    });
                }
            }
        }

        const allLessons = await prisma.timetableLesson.findMany({
            include: lessonIncludes,
            orderBy: [{ subject: { name: 'asc' } }]
        });
        res.json({ created, total: allLessons.length, lessons: allLessons });
    } catch (error) {
        console.error('Bulk create error:', error);
        res.status(500).json({ error: 'Failed to create from assignments.' });
    }
});

module.exports = router;
