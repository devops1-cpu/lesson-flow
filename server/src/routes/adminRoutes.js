const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const prisma = require('../config/prisma.js');
const bcrypt = require('bcryptjs');

const router = express.Router();
// ==================== SUBJECTS ====================

// GET /admin/subjects
router.get('/subjects', authenticate, async (req, res) => {
    try {
        const subjects = await prisma.subject.findMany({
            include: { department: { select: { id: true, name: true } } },
            orderBy: { name: 'asc' }
        });
        res.json(subjects);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch subjects.' });
    }
});

// POST /admin/subjects
router.post('/subjects', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        const { name, code, abbreviation, color, departmentId } = req.body;
        if (!name) return res.status(400).json({ error: 'Subject name is required.' });
        const subject = await prisma.subject.create({
            data: { name, code, abbreviation: abbreviation || null, color: color || null, departmentId: departmentId || null },
            include: { department: { select: { id: true, name: true } } }
        });
        res.status(201).json(subject);
    } catch (error) {
        if (error.code === 'P2002') return res.status(400).json({ error: 'Subject already exists in this department.' });
        res.status(500).json({ error: 'Failed to create subject.' });
    }
});

// PUT /admin/subjects/:id
router.put('/subjects/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        const { name, code, abbreviation, color, departmentId } = req.body;
        const subject = await prisma.subject.update({
            where: { id: req.params.id },
            data: {
                ...(name !== undefined && { name }),
                ...(code !== undefined && { code }),
                ...(abbreviation !== undefined && { abbreviation: abbreviation || null }),
                ...(color !== undefined && { color: color || null }),
                ...(departmentId !== undefined && { departmentId: departmentId || null })
            },
            include: { department: { select: { id: true, name: true } } }
        });
        res.json(subject);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update subject.' });
    }
});

// DELETE /admin/subjects/:id
router.delete('/subjects/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        await prisma.subject.delete({ where: { id: req.params.id } });
        res.json({ message: 'Subject deleted.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete subject.' });
    }
});

// ==================== CLASSES (Admin CRUD) ====================

// GET /admin/classes
router.get('/classes', authenticate, async (req, res) => {
    try {
        const classes = await prisma.class.findMany({
            include: {
                owner: { select: { id: true, name: true } },
                course: { select: { id: true, name: true } },
                teacherAssignments: {
                    include: {
                        teacher: { select: { id: true, name: true, email: true } },
                        subject: { select: { id: true, name: true } }
                    }
                }
            },
            orderBy: [{ grade: 'asc' }, { name: 'asc' }]
        });
        res.json(classes);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch classes.' });
    }
});

// POST /admin/classes
router.post('/classes', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        const { name, section, subject, grade, coverColor, capacity, ownerId, courseId } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required.' });
        const cls = await prisma.class.create({
            data: {
                name, section, subject, grade: grade || null,
                capacity: capacity || 45,
                coverColor: coverColor || '#1a73e8',
                ownerId: ownerId || req.user.id,
                courseId: courseId || null
            },
            include: { owner: { select: { id: true, name: true } } }
        });
        res.status(201).json(cls);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create class.' });
    }
});

// PUT /admin/classes/:id
router.put('/classes/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        const { name, section, subject, grade, coverColor, capacity, ownerId, courseId } = req.body;
        const cls = await prisma.class.update({
            where: { id: req.params.id },
            data: {
                ...(name !== undefined && { name }),
                ...(section !== undefined && { section }),
                ...(subject !== undefined && { subject }),
                ...(grade !== undefined && { grade }),
                ...(coverColor !== undefined && { coverColor }),
                ...(capacity !== undefined && { capacity }),
                ...(ownerId !== undefined && { ownerId }),
                ...(courseId !== undefined && { courseId })
            },
            include: { owner: { select: { id: true, name: true } } }
        });
        res.json(cls);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update class.' });
    }
});

// DELETE /admin/classes/:id
router.delete('/classes/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        await prisma.class.delete({ where: { id: req.params.id } });
        res.json({ message: 'Class deleted.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete class. Remove assignments first.' });
    }
});

// ==================== TEACHER ASSIGNMENTS ====================

// GET /admin/assignments
router.get('/assignments', authenticate, async (req, res) => {
    try {
        const assignments = await prisma.teacherAssignment.findMany({
            include: {
                teacher: { select: { id: true, name: true, email: true, role: true } },
                class: { select: { id: true, name: true, section: true, grade: true } },
                subject: { select: { id: true, name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(assignments);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch assignments.' });
    }
});

// POST /admin/assignments — Assign teacher to class+subject
router.post('/assignments', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        const { teacherId, classId, subjectId } = req.body;
        if (!teacherId || !classId || !subjectId) {
            return res.status(400).json({ error: 'teacherId, classId, and subjectId are all required.' });
        }
        const assignment = await prisma.teacherAssignment.create({
            data: { teacherId, classId, subjectId },
            include: {
                teacher: { select: { id: true, name: true, email: true } },
                class: { select: { id: true, name: true, section: true, grade: true } },
                subject: { select: { id: true, name: true } }
            }
        });
        res.status(201).json(assignment);
    } catch (error) {
        if (error.code === 'P2002') return res.status(400).json({ error: 'This teacher is already assigned to this class for this subject.' });
        res.status(500).json({ error: 'Failed to create assignment.' });
    }
});

// DELETE /admin/assignments/:id
router.delete('/assignments/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        await prisma.teacherAssignment.delete({ where: { id: req.params.id } });
        res.json({ message: 'Assignment removed.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to remove assignment.' });
    }
});

// ==================== TEACHERS LIST (for dropdowns) ====================

// GET /admin/teachers
router.get('/teachers', authenticate, async (req, res) => {
    try {
        const teachers = await prisma.user.findMany({
            where: { role: { in: ['TEACHER', 'HOD'] } },
            select: {
                id: true, name: true, email: true, role: true, departmentId: true,
                department: { select: { id: true, name: true } }
            },
            orderBy: { name: 'asc' }
        });
        res.json(teachers);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch teachers.' });
    }
});

// GET /admin/hods
router.get('/hods', authenticate, async (req, res) => {
    try {
        const hods = await prisma.user.findMany({
            where: { role: 'HOD' },
            select: {
                id: true, name: true, email: true,
                headedDepartment: { select: { id: true, name: true } }
            },
            orderBy: { name: 'asc' }
        });
        res.json(hods);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch HODs.' });
    }
});

// ==================== USERS (Admin creation) ====================

// POST /admin/users
router.post('/users', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        const { name, email, password, role, departmentId } = req.body;
        if (!name || !email || !password || !role) {
            return res.status(400).json({ error: 'Name, email, password, and role are required.' });
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // ... (User creation omitted from chunk focus, actually need to append below teachers section)
        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role,
                departmentId: departmentId || null
            },
            select: { id: true, name: true, email: true, role: true, createdAt: true, departmentId: true }
        });

        res.status(201).json(user);
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Failed to create user.' });
    }
});

// ==================== SCHOOL TIME CONFIGURATION (PERIODS) ====================

// GET /admin/periods
router.get('/periods', authenticate, async (req, res) => {
    try {
        const periods = await prisma.period.findMany({ orderBy: { number: 'asc' } });
        res.json(periods);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch periods.' });
    }
});

// POST /admin/periods
router.post('/periods', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        const { number, startTime, endTime, isBreak, label } = req.body;
        if (!number || !startTime || !endTime) {
            return res.status(400).json({ error: 'Number, Formatted Start Time, and End Time are required.' });
        }
        const period = await prisma.period.create({
            data: { number: Number(number), startTime, endTime, isBreak: Boolean(isBreak), label }
        });
        res.status(201).json(period);
    } catch (error) {
        if (error.code === 'P2002') return res.status(400).json({ error: 'A period with this number already exists.' });
        res.status(500).json({ error: 'Failed to create period.' });
    }
});

// PUT /admin/periods/:id
router.put('/periods/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        const { number, startTime, endTime, isBreak, label } = req.body;
        if (!number || !startTime || !endTime) {
            return res.status(400).json({ error: 'Number, Start Time, and End Time are required.' });
        }
        const period = await prisma.period.update({
            where: { id: req.params.id },
            data: { number: Number(number), startTime, endTime, isBreak: Boolean(isBreak), label }
        });
        res.json(period);
    } catch (error) {
        if (error.code === 'P2002') return res.status(400).json({ error: 'A period with this number already exists.' });
        res.status(500).json({ error: 'Failed to update period.' });
    }
});

// DELETE /admin/periods/:id
router.delete('/periods/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        await prisma.period.delete({ where: { id: req.params.id } });
        res.json({ message: 'Period deleted successfully.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete period.' });
    }
});

module.exports = router;
