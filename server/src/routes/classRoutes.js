const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const prisma = require('../config/prisma.js');

const router = express.Router();
// Get all classes (filtered by role)
router.get('/', authenticate, async (req, res) => {
    try {
        let classes;

        if (req.user.role === 'ADMIN' || req.user.role === 'HOD') {
            classes = await prisma.class.findMany({
                include: {
                    owner: { select: { id: true, name: true, email: true } },
                    _count: { select: { members: true, lessonPlans: true } }
                },
                orderBy: { createdAt: 'desc' }
            });
        } else if (req.user.role === 'TEACHER') {
            classes = await prisma.class.findMany({
                where: { ownerId: req.user.id },
                include: {
                    owner: { select: { id: true, name: true, email: true } },
                    _count: { select: { members: true, lessonPlans: true } }
                },
                orderBy: { createdAt: 'desc' }
            });
        } else {
            // Students & Parents see classes they're members of
            classes = await prisma.class.findMany({
                where: {
                    members: { some: { userId: req.user.id } }
                },
                include: {
                    owner: { select: { id: true, name: true, email: true } },
                    _count: { select: { members: true, lessonPlans: true } }
                },
                orderBy: { createdAt: 'desc' }
            });
        }

        res.json(classes);
    } catch (error) {
        console.error('Get classes error:', error);
        res.status(500).json({ error: 'Failed to fetch classes.' });
    }
});

// Get single class with members
router.get('/:id', authenticate, async (req, res) => {
    try {
        const classData = await prisma.class.findUnique({
            where: { id: req.params.id },
            include: {
                owner: { select: { id: true, name: true, email: true } },
                members: {
                    include: {
                        user: { select: { id: true, name: true, email: true, role: true, avatar: true } }
                    }
                },
                lessonPlans: {
                    include: {
                        teacher: { select: { id: true, name: true } }
                    },
                    orderBy: { updatedAt: 'desc' }
                }
            }
        });

        if (!classData) {
            return res.status(404).json({ error: 'Class not found.' });
        }

        res.json(classData);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch class.' });
    }
});

// Create class (Teacher/Admin)
router.post('/', authenticate, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
    try {
        const { name, section, subject, grade, description, coverColor } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Class name is required.' });
        }

        const newClass = await prisma.class.create({
            data: {
                name,
                section,
                subject,
                grade,
                description,
                coverColor: coverColor || '#1a73e8',
                ownerId: req.user.id
            },
            include: {
                owner: { select: { id: true, name: true, email: true } },
                _count: { select: { members: true, lessonPlans: true } }
            }
        });

        res.status(201).json(newClass);
    } catch (error) {
        console.error('Create class error:', error);
        res.status(500).json({ error: 'Failed to create class.' });
    }
});

// Add members to class
router.post('/:id/members', authenticate, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
    try {
        const { userIds } = req.body; // Array of user IDs

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ error: 'User IDs array is required.' });
        }

        const classData = await prisma.class.findUnique({ where: { id: req.params.id } });
        if (!classData) {
            return res.status(404).json({ error: 'Class not found.' });
        }

        // Create memberships (skip duplicates)
        const memberships = await Promise.all(
            userIds.map(async (userId) => {
                try {
                    return await prisma.classMember.create({
                        data: { userId, classId: req.params.id },
                        include: { user: { select: { id: true, name: true, email: true, role: true } } }
                    });
                } catch (e) {
                    // Skip duplicate entries
                    return null;
                }
            })
        );

        res.json({ added: memberships.filter(m => m !== null) });
    } catch (error) {
        console.error('Add members error:', error);
        res.status(500).json({ error: 'Failed to add members.' });
    }
});

// Remove member from class
router.delete('/:id/members/:userId', authenticate, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
    try {
        await prisma.classMember.deleteMany({
            where: { classId: req.params.id, userId: req.params.userId }
        });
        res.json({ message: 'Member removed successfully.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to remove member.' });
    }
});

// Delete class (Admin only)
router.delete('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        // Delete related records first
        await prisma.classMember.deleteMany({ where: { classId: req.params.id } });
        await prisma.teacherAssignment.deleteMany({ where: { classId: req.params.id } });
        await prisma.timetableSlot.deleteMany({ where: { classId: req.params.id } });
        await prisma.timetableLesson.deleteMany({ where: { classId: req.params.id } });
        await prisma.class.delete({ where: { id: req.params.id } });
        res.json({ message: 'Class deleted successfully.' });
    } catch (error) {
        console.error('Delete class error:', error);
        res.status(500).json({ error: 'Failed to delete class.' });
    }
});

module.exports = router;
