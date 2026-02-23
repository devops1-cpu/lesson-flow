const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const prisma = require('../config/prisma.js');

const router = express.Router();
// Get all rooms
router.get('/', authenticate, async (req, res) => {
    try {
        const { type } = req.query;
        const where = type ? { type } : {};
        const rooms = await prisma.room.findMany({
            where,
            include: {
                _count: { select: { timetableSlots: true } }
            },
            orderBy: { name: 'asc' }
        });
        res.json(rooms);
    } catch (error) {
        console.error('Get rooms error:', error);
        res.status(500).json({ error: 'Failed to fetch rooms.' });
    }
});

// Get single room with schedule
router.get('/:id', authenticate, async (req, res) => {
    try {
        const room = await prisma.room.findUnique({
            where: { id: req.params.id },
            include: {
                timetableSlots: {
                    include: {
                        period: true,
                        class: { select: { id: true, name: true, section: true } },
                        teacher: { select: { id: true, name: true } },
                        subject: { select: { id: true, name: true } }
                    }
                }
            }
        });
        if (!room) return res.status(404).json({ error: 'Room not found.' });
        res.json(room);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch room.' });
    }
});

// Create room (Admin only)
router.post('/', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        const { name, type, capacity, description } = req.body;
        if (!name) return res.status(400).json({ error: 'Room name is required.' });

        const room = await prisma.room.create({
            data: { name, type: type || 'REGULAR', capacity: capacity || 40, description }
        });
        res.status(201).json(room);
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'A room with this name already exists.' });
        }
        console.error('Create room error:', error);
        res.status(500).json({ error: 'Failed to create room.' });
    }
});

// Update room (Admin only)
router.put('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        const { name, type, capacity, description } = req.body;
        const room = await prisma.room.update({
            where: { id: req.params.id },
            data: {
                ...(name && { name }),
                ...(type && { type }),
                ...(capacity !== undefined && { capacity }),
                ...(description !== undefined && { description })
            }
        });
        res.json(room);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update room.' });
    }
});

// Delete room (Admin only)
router.delete('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        await prisma.room.delete({ where: { id: req.params.id } });
        res.json({ message: 'Room deleted successfully.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete room.' });
    }
});

module.exports = router;
