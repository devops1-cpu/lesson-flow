const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const prisma = require('../config/prisma.js');

const router = express.Router();
// Get all periods (ordered by number)
router.get('/', authenticate, async (req, res) => {
    try {
        const periods = await prisma.period.findMany({
            orderBy: { number: 'asc' }
        });
        res.json(periods);
    } catch (error) {
        console.error('Get periods error:', error);
        res.status(500).json({ error: 'Failed to fetch periods.' });
    }
});

// Create period (Admin only)
router.post('/', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        const { number, startTime, endTime, isBreak, label } = req.body;
        if (number === undefined || !startTime || !endTime) {
            return res.status(400).json({ error: 'Period number, startTime, and endTime are required.' });
        }

        const period = await prisma.period.create({
            data: { number, startTime, endTime, isBreak: isBreak || false, label }
        });
        res.status(201).json(period);
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: `Period number ${req.body.number} already exists.` });
        }
        console.error('Create period error:', error);
        res.status(500).json({ error: 'Failed to create period.' });
    }
});

// Bulk create/replace all periods (Admin only)
router.post('/bulk', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        const { periods } = req.body;
        if (!Array.isArray(periods) || periods.length === 0) {
            return res.status(400).json({ error: 'Periods array is required.' });
        }

        // Delete existing periods (cascade will clear timetable slots)
        await prisma.period.deleteMany({});

        // Create new periods
        const created = await prisma.period.createMany({
            data: periods.map(p => ({
                number: p.number,
                startTime: p.startTime,
                endTime: p.endTime,
                isBreak: p.isBreak || false,
                label: p.label || `Period ${p.number}`
            }))
        });

        const allPeriods = await prisma.period.findMany({ orderBy: { number: 'asc' } });
        res.json(allPeriods);
    } catch (error) {
        console.error('Bulk create periods error:', error);
        res.status(500).json({ error: 'Failed to create periods.' });
    }
});

// Update period (Admin only)
router.put('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        const { number, startTime, endTime, isBreak, label } = req.body;
        const period = await prisma.period.update({
            where: { id: req.params.id },
            data: {
                ...(number !== undefined && { number }),
                ...(startTime && { startTime }),
                ...(endTime && { endTime }),
                ...(isBreak !== undefined && { isBreak }),
                ...(label !== undefined && { label })
            }
        });
        res.json(period);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update period.' });
    }
});

// Delete period (Admin only)
router.delete('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
        await prisma.period.delete({ where: { id: req.params.id } });
        res.json({ message: 'Period deleted successfully.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete period.' });
    }
});

module.exports = router;
