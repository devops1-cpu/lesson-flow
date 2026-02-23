const express = require('express');
const cors = require('cors');
require('dotenv').config();

const express = require('express');
const { Pool } = require('pg');



const authRoutes = require('./routes/authRoutes');
const lessonPlanRoutes = require('./routes/lessonPlanRoutes');
const classRoutes = require('./routes/classRoutes');
const userRoutes = require('./routes/userRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const readinessRoutes = require('./routes/readinessRoutes');
const ocrRoutes = require('./routes/ocrRoutes');
const adminRoutes = require('./routes/adminRoutes');
const processRoutes = require('./routes/processRoutes');
const exportRoutes = require('./routes/exportRoutes');
const tutorRoutes = require('./routes/tutorRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const commentRoutes = require('./routes/commentRoutes');
const roomRoutes = require('./routes/roomRoutes');
const periodRoutes = require('./routes/periodRoutes');
const timetableRoutes = require('./routes/timetableRoutes');
const lessonConfigRoutes = require('./routes/lessonConfigRoutes');
const timeoffRoutes = require('./routes/timeoffRoutes');

const app = express();
const PORT = process.env.PORT || 3001;




// Middleware
const corsOptions = { origin: process.env.FRONTEND_URL || true };
app.use(cors(corsOptions));
app.use(express.json());

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

// Vercel: export app
module.exports = app;

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/lesson-plans', lessonPlanRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/users', userRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/readiness', readinessRoutes);
app.use('/api/ocr', ocrRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/process', processRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/tutor', tutorRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/periods', periodRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/lesson-config', lessonConfigRoutes);
app.use('/api/timeoff', timeoffRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Lesson Planner API is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!', message: err.message });
});

if (require.main === module) {
  app.listen(PORT, () => {
    const host = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:${PORT}`;
    console.log(`🚀 Server running on ${host}`);
  });
}

module.exports = app;
