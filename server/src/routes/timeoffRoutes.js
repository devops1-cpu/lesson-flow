const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const prisma = require('../config/prisma');

const router = express.Router();

// ─── TEACHER TIME OFF ───
router.get('/teacher/:id', authenticate, requireRole('ADMIN', 'HOD'), async (req, res) => {
    try {
        const data = await prisma.teacherAvailability.findMany({
            where: { teacherId: req.params.id }
        });
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch teacher time off' });
    }
});

router.post('/teacher/:id', authenticate, requireRole('ADMIN', 'HOD'), async (req, res) => {
    try {
        const { matrix } = req.body; // Array of { dayOfWeek, periodId, state }

        // 1. Delete all existing for this teacher
        await prisma.teacherAvailability.deleteMany({
            where: { teacherId: req.params.id }
        });

        // 2. Insert new ones
        if (matrix && matrix.length > 0) {
            await prisma.teacherAvailability.createMany({
                data: matrix.map(m => ({
                    teacherId: req.params.id,
                    dayOfWeek: m.dayOfWeek,
                    periodId: m.periodId,
                    state: m.state
                }))
            });
        }
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update teacher time off' });
    }
});

// ─── CLASS TIME OFF ───
router.get('/class/:id', authenticate, requireRole('ADMIN', 'HOD'), async (req, res) => {
    try {
        const data = await prisma.classAvailability.findMany({
            where: { classId: req.params.id }
        });
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch class time off' });
    }
});

router.post('/class/:id', authenticate, requireRole('ADMIN', 'HOD'), async (req, res) => {
    try {
        const { matrix } = req.body;

        await prisma.classAvailability.deleteMany({
            where: { classId: req.params.id }
        });

        if (matrix && matrix.length > 0) {
            await prisma.classAvailability.createMany({
                data: matrix.map(m => ({
                    classId: req.params.id,
                    dayOfWeek: m.dayOfWeek,
                    periodId: m.periodId,
                    state: m.state
                }))
            });
        }
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update class time off' });
    }
});

// ─── SUBJECT TIME OFF ───
router.get('/subject/:id', authenticate, requireRole('ADMIN', 'HOD'), async (req, res) => {
    try {
        const data = await prisma.subjectAvailability.findMany({
            where: { subjectId: req.params.id }
        });
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch subject time off' });
    }
});

router.post('/subject/:id', authenticate, requireRole('ADMIN', 'HOD'), async (req, res) => {
    try {
        const { matrix } = req.body;

        await prisma.subjectAvailability.deleteMany({
            where: { subjectId: req.params.id }
        });

        if (matrix && matrix.length > 0) {
            await prisma.subjectAvailability.createMany({
                data: matrix.map(m => ({
                    subjectId: req.params.id,
                    dayOfWeek: m.dayOfWeek,
                    periodId: m.periodId,
                    state: m.state
                }))
            });
        }
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update subject time off' });
    }
});

module.exports = router;
