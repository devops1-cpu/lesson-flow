const express = require('express');
const cors = require('cors');
require('dotenv').config();

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
app.use(cors());
app.use(express.json());

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

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
