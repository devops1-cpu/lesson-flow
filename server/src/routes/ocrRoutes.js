const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { authenticate, requireRole } = require('../middleware/auth');

// Try to use multer if available, otherwise stub it
let multer;
let Tesseract;
try {
    multer = require('multer');
    Tesseract = require('tesseract.js');
} catch (e) {
    console.warn('[OCR] tesseract.js or multer not installed. Run: npm install multer tesseract.js');
}

const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer
    ? multer.diskStorage({
        destination: uploadsDir,
        filename: (req, file, cb) => cb(null, `ocr_${Date.now()}${path.extname(file.originalname)}`)
    })
    : null;

const upload = multer ? multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }) : null;

// POST /ocr/scan — Upload image and extract text
router.post('/scan', authenticate, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
    if (!upload || !Tesseract) {
        return res.status(503).json({
            error: 'OCR service not installed.',
            instructions: 'Run: npm install multer tesseract.js in the server directory'
        });
    }

    upload.single('image')(req, res, async (err) => {
        if (err) return res.status(400).json({ error: 'File upload failed.' });
        if (!req.file) return res.status(400).json({ error: 'No image file uploaded.' });

        try {
            const imagePath = req.file.path;
            console.log('[OCR] Processing image:', imagePath);

            const { data: { text } } = await Tesseract.recognize(imagePath, 'eng', {
                logger: m => process.stdout.write('.')
            });

            // Clean up uploaded file after processing
            fs.unlinkSync(imagePath);

            // Parse the raw OCR text into lesson plan fields using simple heuristics
            const parsed = parseLessonText(text);

            res.json({
                rawText: text,
                parsed,
                message: 'OCR complete. Review and edit the extracted data before saving.'
            });
        } catch (ocrError) {
            console.error('[OCR] Error:', ocrError);
            res.status(500).json({ error: 'OCR processing failed.' });
        }
    });
});

/**
 * Simple heuristic parser: looks for common lesson plan section headings
 * and extracts the content following them.
 */
function parseLessonText(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const result = {
        title: '',
        subject: '',
        grade: '',
        objectives: [],
        materials: [],
        warmUp: '',
        instruction: '',
        guidedPractice: '',
        independentPractice: '',
        closure: '',
        assessment: '',
        homework: '',
        notes: ''
    };

    let currentSection = null;
    let buffer = [];

    const sectionMap = {
        'title': 'title',
        'subject': 'subject',
        'grade': 'grade',
        'objective': 'objectives',
        'objectives': 'objectives',
        'learning objective': 'objectives',
        'material': 'materials',
        'materials': 'materials',
        'resource': 'materials',
        'warm up': 'warmUp',
        'warm-up': 'warmUp',
        'bell ringer': 'warmUp',
        'instruction': 'instruction',
        'direct instruction': 'instruction',
        'guided practice': 'guidedPractice',
        'independent practice': 'independentPractice',
        'closure': 'closure',
        'assessment': 'assessment',
        'homework': 'homework',
        'notes': 'notes',
    };

    const flush = (section, buf) => {
        if (!section || buf.length === 0) return;
        const content = buf.join(' ').trim();
        if (['objectives', 'materials'].includes(section)) {
            // Split on common bullet indicators
            const items = content.split(/[•\-\*\n]/).map(i => i.trim()).filter(Boolean);
            result[section] = [...(result[section] || []), ...items];
        } else {
            result[section] = (result[section] || '') + (result[section] ? ' ' : '') + content;
        }
    };

    for (const line of lines) {
        const lower = line.toLowerCase().replace(/[:\-]/g, '').trim();
        const matched = Object.keys(sectionMap).find(k => lower === k || lower.startsWith(k));
        if (matched) {
            flush(currentSection, buffer);
            currentSection = sectionMap[matched];
            buffer = [];
            // Inline value (e.g. "Subject: Mathematics")
            const colonIdx = line.indexOf(':');
            if (colonIdx !== -1 && colonIdx < line.length - 1) {
                buffer.push(line.slice(colonIdx + 1).trim());
            }
        } else if (currentSection) {
            buffer.push(line);
        } else {
            // If no section matched yet, the first content line is likely the title
            if (!result.title) result.title = line;
        }
    }
    flush(currentSection, buffer);

    return result;
}

module.exports = router;
