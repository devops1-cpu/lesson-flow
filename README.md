# LessonFlow — Teaching & Learning Platform

A modern, full-stack teaching and learning platform for digitalized lesson planning, inspired by Google Classroom.

## Tech Stack

- **Frontend**: React 18, Vite, React Router, Axios
- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL, Prisma ORM
- **Auth**: JWT (jsonwebtoken + bcryptjs)

## Prerequisites

- Node.js 18+
- PostgreSQL (running locally on port 5432)

## Setup Instructions

### 1. Start PostgreSQL

Make sure PostgreSQL is running. Create the database:

```bash
createdb lesson_planner
```

Or via `psql`:

```sql
CREATE DATABASE lesson_planner;
```

### 2. Configure Environment

Edit `server/.env` if your PostgreSQL credentials differ from defaults:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/lesson_planner?schema=public"
```

### 3. Setup Backend

```bash
cd server
npm install
npx prisma db push      # Creates tables
node prisma/seed.js      # Seeds demo data
npm run dev              # Starts API on http://localhost:3001
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
