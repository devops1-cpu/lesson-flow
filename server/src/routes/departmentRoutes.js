const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const prisma = require('../config/prisma.js');

const router = express.Router();
// GET /departments
router.get('/', authenticate, async (req, res) => {
    try {
        const departments = await prisma.department.findMany({
            include: {
                head: { select: { id: true, name: true, email: true } },
                courses: true,
                members: { select: { id: true, name: true, email: true, role: true } }
            },
            orderBy: { name: 'asc' }
        });
        res.json(departments);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch departments.' });
    }
});

// POST /departments (Admin only)
router.post('/', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        const { name, description, headId } = req.body;
        if (!name) return res.status(400).json({ error: 'Department name is required.' });

        const dept = await prisma.department.create({
            data: { name, description, headId: headId || null },
            include: { head: { select: { id: true, name: true, email: true } } }
        });
        res.status(201).json(dept);
    } catch (error) {
        if (error.code === 'P2002') return res.status(400).json({ error: 'Department name already exists.' });
        res.status(500).json({ error: 'Failed to create department.' });
    }
});

// PUT /departments/:id (Admin only)
router.put('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        const { name, description, headId } = req.body;
        const dept = await prisma.department.update({
            where: { id: req.params.id },
            data: {
                ...(name && { name }),
                ...(description !== undefined && { description }),
                ...(headId !== undefined && { headId: headId || null })
            },
            include: { head: { select: { id: true, name: true, email: true } }, courses: true, members: { select: { id: true, name: true, role: true } } }
        });
        res.json(dept);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update department.' });
    }
});

// DELETE /departments/:id (Admin only)
router.delete('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        await prisma.department.delete({ where: { id: req.params.id } });
        res.json({ message: 'Department deleted.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete department.' });
    }
});

// GET /departments/:id/courses
router.get('/:id/courses', authenticate, async (req, res) => {
    try {
        const courses = await prisma.course.findMany({
            where: { departmentId: req.params.id },
            include: { classes: true }
        });
        res.json(courses);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch courses.' });
    }
});

// POST /departments/:id/courses (Admin/HOD)
router.post('/:id/courses', authenticate, requireRole('ADMIN', 'HOD'), async (req, res) => {
    try {
        const { name, code } = req.body;
        if (!name) return res.status(400).json({ error: 'Course name is required.' });
        const course = await prisma.course.create({
            data: { name, code, departmentId: req.params.id }
        });
        res.status(201).json(course);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create course.' });
    }
});

// POST /departments/:id/assign-teacher (Admin)
// Assign a teacher to a department
router.post('/:id/assign-teacher', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        const { teacherId } = req.body;
        await prisma.user.update({
            where: { id: teacherId },
            data: { departmentId: req.params.id }
        });
        res.json({ message: 'Teacher assigned to department.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to assign teacher.' });
    }
});

module.exports = router;
