const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const prisma = require('../config/prisma.js');

const router = express.Router();
// POST /api/comments — Add a new comment
router.post('/', authenticate, async (req, res) => {
    try {
        const { planId, section, content } = req.body;

        if (!planId || !content) {
            return res.status(400).json({ error: 'Plan ID and content are required.' });
        }

        // Verify plan exists
        const plan = await prisma.lessonPlan.findUnique({ where: { id: planId } });
        if (!plan) return res.status(404).json({ error: 'Lesson plan not found.' });

        // Create comment
        const comment = await prisma.lessonComment.create({
            data: {
                planId,
                userId: req.user.id,
                section: section || null, // null = general comment
                content
            },
            include: {
                user: { select: { id: true, name: true, role: true, avatar: true } }
            }
        });

        res.json(comment);

    } catch (error) {
        console.error('Add comment error:', error);
        res.status(500).json({ error: 'Failed to add comment.' });
    }
});

// GET /api/comments/plan/:id — Get all comments for a plan
router.get('/plan/:id', authenticate, async (req, res) => {
    try {
        const comments = await prisma.lessonComment.findMany({
            where: { planId: req.params.id },
            include: {
                user: { select: { id: true, name: true, role: true, avatar: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(comments);

    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch comments.' });
    }
});

// DELETE /api/comments/:id — Delete a comment (Author or HOD/Admin)
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const comment = await prisma.lessonComment.findUnique({
            where: { id: req.params.id }
        });

        if (!comment) return res.status(404).json({ error: 'Comment not found.' });

        // Only author or HOD/Admin can delete
        const isAuthor = comment.userId === req.user.id;
        const isAdminOrHod = ['ADMIN', 'HOD', 'PROCESS_DEPT'].includes(req.user.role);

        if (!isAuthor && !isAdminOrHod) {
            return res.status(403).json({ error: 'Unauthorized to delete this comment.' });
        }

        await prisma.lessonComment.delete({ where: { id: req.params.id } });
        res.json({ message: 'Comment deleted.' });

    } catch (error) {
        res.status(500).json({ error: 'Failed to delete comment.' });
    }
});

module.exports = router;
