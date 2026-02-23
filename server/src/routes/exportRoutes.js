const express = require('express');
const PDFDocument = require('pdfkit');
const { authenticate } = require('../middleware/auth');
const prisma = require('../config/prisma.js');

const router = express.Router();
const statusLabels = {
    DRAFT: 'Draft',
    SUBMITTED: 'Submitted for Approval',
    CHANGES_REQUESTED: 'Changes Requested',
    APPROVED: 'Approved',
    PUBLISHED: 'Published',
    ARCHIVED: 'Archived'
};

// GET /export/:id/pdf
router.get('/:id/pdf', authenticate, async (req, res) => {
    try {
        const plan = await prisma.lessonPlan.findUnique({
            where: { id: req.params.id },
            include: {
                teacher: { select: { name: true, email: true } },
                class: { select: { name: true, grade: true, section: true } },
                approver: { select: { name: true } },
                readinessAssessment: { select: { score: true, status: true } }
            }
        });

        if (!plan) return res.status(404).json({ error: 'Lesson plan not found.' });

        const doc = new PDFDocument({ margin: 50, size: 'A4' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="lesson-plan-${plan.title.replace(/\s+/g, '-').toLowerCase()}.pdf"`);
        doc.pipe(res);

        // ===== HEADER =====
        doc.rect(0, 0, doc.page.width, 100).fill('#1a73e8');
        doc.fontSize(22).fillColor('#ffffff').font('Helvetica-Bold')
            .text(plan.title, 50, 30, { width: doc.page.width - 100 });
        doc.fontSize(11).fillColor('rgba(255,255,255,0.9)').font('Helvetica')
            .text(`${plan.subject} | Grade ${plan.grade} | ${statusLabels[plan.status] || plan.status}`, 50, 65);

        doc.moveDown(3);
        doc.fillColor('#333333');

        // ===== META INFO =====
        const y = 120;
        doc.fontSize(10).fillColor('#666666');
        doc.text(`Teacher: ${plan.teacher?.name || 'N/A'}`, 50, y);
        doc.text(`Class: ${plan.class?.name || 'N/A'} ${plan.class?.section ? `(${plan.class.section})` : ''}`, 300, y);

        if (plan.status === 'APPROVED' && plan.approver) {
            doc.text(`Approved by: ${plan.approver.name} on ${new Date(plan.approvalDate).toLocaleDateString('en-IN')}`, 50, y + 32);
        }

        if (plan.readinessAssessment?.status === 'COMPLETED') {
            doc.text(`AI Readiness Score: ${plan.readinessAssessment.score}/100`, 300, y + 32);
        }

        // Divider
        doc.moveTo(50, y + 55).lineTo(doc.page.width - 50, y + 55).stroke('#e5e7eb');
        doc.y = y + 70;

        // ===== HELPER FUNCTIONS =====
        const addSection = (title, content, type = 'text') => {
            if (!content || (Array.isArray(content) && content.length === 0)) return;

            // Check if we need a new page
            if (doc.y > doc.page.height - 120) doc.addPage();

            doc.fontSize(13).fillColor('#1a73e8').font('Helvetica-Bold').text(title, 50);
            doc.moveDown(0.3);

            doc.fontSize(10).fillColor('#333333').font('Helvetica');
            if (type === 'list' && Array.isArray(content)) {
                content.forEach((item, i) => {
                    if (doc.y > doc.page.height - 80) doc.addPage();
                    doc.text(`  •  ${item}`, 60, doc.y, { width: doc.page.width - 120 });
                });
            } else {
                doc.text(content, 50, doc.y, { width: doc.page.width - 100 });
            }
            doc.moveDown(1);
        };

        // ===== CONTENT SECTIONS =====
        addSection('Learning Objectives', plan.objectives, 'list');
        addSection('Materials & Resources', plan.materials, 'list');
        addSection('Warm-Up / Bell Ringer', plan.warmUp);
        addSection('Direct Instruction', plan.instruction);
        addSection('Guided Practice', plan.guidedPractice);
        addSection('Independent Practice', plan.independentPractice);
        addSection('Closure', plan.closure);
        addSection('Assessment Strategy', plan.assessment);
        addSection('Differentiation', plan.differentiation);
        addSection('Homework', plan.homework);
        addSection('Additional Notes', plan.notes);

        // ===== APPROVAL INFO =====
        if (plan.approvalComment) {
            if (doc.y > doc.page.height - 120) doc.addPage();
            doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke('#e5e7eb');
            doc.moveDown(0.5);
            addSection('HOD Comment', plan.approvalComment);
        }

        // ===== FOOTER =====
        const pages = doc.bufferedPageRange();
        for (let i = pages.start; i < pages.start + pages.count; i++) {
            doc.switchToPage(i);
            doc.fontSize(8).fillColor('#999999').font('Helvetica')
                .text(
                    `Lesson Planner — Generated on ${new Date().toLocaleDateString('en-IN')} — Page ${i + 1} of ${pages.count}`,
                    50, doc.page.height - 30,
                    { align: 'center', width: doc.page.width - 100 }
                );
        }

        doc.end();
    } catch (error) {
        console.error('PDF export error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to generate PDF.' });
        }
    }
});

module.exports = router;
