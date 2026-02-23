const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const prisma = require('../config/prisma.js');
const bcrypt = require('bcryptjs');

const router = express.Router();
// Get all users (Admin only, or Teachers can see students for adding to class)
router.get('/', authenticate, async (req, res) => {
    try {
        const { role, search } = req.query;
        let where = {};

        if (req.user.role !== 'ADMIN' && req.user.role !== 'TEACHER') {
            return res.status(403).json({ error: 'Insufficient permissions.' });
        }

        if (role) where.role = role;
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } }
            ];
        }

        const users = await prisma.user.findMany({
            where,
            select: {
                id: true, name: true, email: true, role: true, avatar: true, createdAt: true,
                _count: { select: { classMemberships: true, lessonPlans: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(users);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users.' });
    }
});

// Update user role (Admin only)
router.put('/:id/role', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        const { role } = req.body;
        if (!['ADMIN', 'TEACHER', 'STUDENT', 'PARENT'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role.' });
        }

        const user = await prisma.user.update({
            where: { id: req.params.id },
            data: { role },
            select: { id: true, name: true, email: true, role: true }
        });

        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update user role.' });
    }
});

// Delete user (Admin only)
router.delete('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        if (req.params.id === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete your own account.' });
        }

        await prisma.user.delete({ where: { id: req.params.id } });
        res.json({ message: 'User deleted successfully.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete user.' });
    }
});

// Change password (Authenticated user)
router.put('/me/password', authenticate, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new passwords are required.' });
        }

        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user) return res.status(404).json({ error: 'User not found.' });

        const validPassword = await bcrypt.compare(currentPassword, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Incorrect current password.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: req.user.id },
            data: { password: hashedPassword }
        });

        res.json({ message: 'Password updated successfully.' });
    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({ error: 'Failed to update password.' });
    }
});

module.exports = router;
