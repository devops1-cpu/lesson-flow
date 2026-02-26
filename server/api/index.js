const { PrismaClient } = require('@prisma/client');
const express = require('express');
const cors = require('cors');
require('dotenv').config({path:"../.env.production"});

const prisma = new PrismaClient();

const authRoutes = require('../src/routes/authRoutes');
const lessonPlanRoutes = require('../src/routes/lessonPlanRoutes');
const classRoutes = require('../src/routes/classRoutes');
const userRoutes = require('../src/routes/userRoutes');
const departmentRoutes = require('../src/routes/departmentRoutes');
const readinessRoutes = require('../src/routes/readinessRoutes');
const ocrRoutes = require('../src/routes/ocrRoutes');
const adminRoutes = require('../src/routes/adminRoutes');
const processRoutes = require('../src/routes/processRoutes');
const exportRoutes = require('../src/routes/exportRoutes');
const tutorRoutes = require('../src/routes/tutorRoutes');
const analyticsRoutes = require('../src/routes/analyticsRoutes');
const commentRoutes = require('../src/routes/commentRoutes');
const roomRoutes = require('../src/routes/roomRoutes');
const periodRoutes = require('../src/routes/periodRoutes');
const timetableRoutes = require('../src/routes/timetableRoutes');
const lessonConfigRoutes = require('../src/routes/lessonConfigRoutes');
const timeoffRoutes = require('../src/routes/timeoffRoutes');

const app = express();
const PORT = process.env.PORT || 3001;




// Middleware
 app.use(cors({ origin: process.env.FRONTEND_URL || true }));
app.use(express.json({ limit: '50mb' }));

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});



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
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', rows: result.rows.length });
  } catch (error) {
    res.status(500).json({ status: 'error', db: 'failed' });
  }
});

// Also accept /health (some proxies may strip the /api prefix)
app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', rows: result.rows.length });
  } catch (error) {
    res.status(500).json({ status: 'error', db: 'failed' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!', message: err.message });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running `);
  });
}

// app.get('/api/health', (req, res) => {
//   console.log("Server Running");
//   res.json({ status: 'ok' })});

module.exports = app;

// const express = require('express');
// const cors = require('cors');
// require('dotenv').config();

// const app = express();
// app.use(cors({ origin: process.env.FRONTEND_URL || true }));
// app.use(express.json({ limit: '50mb' }));

// // ADD JUST ONE ROUTE
// const authRoutes = require('../src/routes/authRoutes');
// app.use('/api/auth', authRoutes);

// const PORT = process.env.PORT || 3001;

// // Health check
// app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// if (require.main === module) {
//   app.listen(PORT, () => {
//     console.log(`🚀 Server running `);
//   });
// }

// module.exports = app;