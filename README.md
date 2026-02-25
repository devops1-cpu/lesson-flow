# Lesson Flow - PERN Stack Application

A comprehensive lesson planning and class management application built with PostgreSQL, Express, React, and Node.js.

## 🚀 Quick Start - Deployment

**[👉 See DEPLOYMENT.md for complete AWS deployment guide](DEPLOYMENT.md)**

All deployment instructions in one file:
- Create RDS database
- Setup EC2 instance  
- Deploy application
- Troubleshooting

## 🛠 Local Development

```bash
# Backend
cd server
npm install
npx prisma migrate dev
npm run dev

# Frontend (new terminal)
cd client
npm install
npm run dev
```

Visit http://localhost:5173

## 📚 Features

- Lesson plan management
- User & class management
- Analytics & reporting
- Timetable scheduling
- OCR document processing
- AI-powered tutoring
- Readiness assessments

## Tech Stack

- Frontend: React 18 + Vite
- Backend: Node.js + Express
- Database: PostgreSQL + Prisma
- Deployment: AWS EC2 + RDS + Nginx + PM2

## License

ISC

### 3. Setup Backend

```bash
cd server
npm install
npx prisma migrate dev --name init
node prisma/seed.js
npm run dev         

npx prisma migrate dev
npx prisma generate
```
### 4. Setup Frontend

```bash
cd client
npm install
npm run dev              # Starts UI on http://localhost:5173
```

### 5. Open the App

Visit **http://localhost:5173** in your browser.

## Demo Credentials

| Role | Email | Password |
|------|-------|----------| 
| Admin | admin@lessonflow.com | admin123 |
| Teacher | teacher@lessonflow.com | teacher123 |
| Teacher | teacher2@lessonflow.com | teacher123 |
| Student | student@lessonflow.com | student123 |
| Parent | parent@lessonflow.com | parent123 |

## Features

- ✅ **Role-Based Access Control** — Admin, Teacher, Student, Parent
- ✅ **Digital Lesson Plans** — Structured creation with objectives, materials, lesson flow, assessment
- ✅ **Class Management** — Create classes, add members, assign lesson plans
- ✅ **Dashboard** — Role-specific views with stats and recent activity
- ✅ **Google Classroom-inspired UI** — Clean, modern design with Material Icons
- ✅ **Search & Filter** — Filter lesson plans by status, search users
- ✅ **User Management** — Admin can manage roles and delete users
