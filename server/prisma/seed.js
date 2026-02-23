const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // 1. Create Users (Admin, HODs, Teachers, Student, Parent)
    const password = await bcrypt.hash('password123', 10);

    const admin = await prisma.user.upsert({
        where: { email: 'admin@lessonflow.com' },
        update: { password },
        create: {
            name: 'Admin User',
            email: 'admin@lessonflow.com',
            password,
            role: 'ADMIN'
        }
    });

    const mathHOD = await prisma.user.upsert({
        where: { email: 'hod.math@lessonflow.com' },
        update: { password },
        create: {
            name: 'Dr. Alan Turing',
            email: 'hod.math@lessonflow.com',
            password,
            role: 'HOD'
        }
    });

    const scienceHOD = await prisma.user.upsert({
        where: { email: 'hod.science@lessonflow.com' },
        update: { password },
        create: {
            name: 'Marie Curie',
            email: 'hod.science@lessonflow.com',
            password,
            role: 'HOD'
        }
    });

    const teacher1 = await prisma.user.upsert({
        where: { email: 'teacher.math@lessonflow.com' },
        update: { password },
        create: {
            name: 'Sarah Williams',
            email: 'teacher.math@lessonflow.com',
            password,
            role: 'TEACHER'
        }
    });

    const teacher2 = await prisma.user.upsert({
        where: { email: 'teacher.science@lessonflow.com' },
        update: { password },
        create: {
            name: 'James Anderson',
            email: 'teacher.science@lessonflow.com',
            password,
            role: 'TEACHER'
        }
    });

    const student = await prisma.user.upsert({
        where: { email: 'student@lessonflow.com' },
        update: { password },
        create: {
            name: 'Alex Johnson',
            email: 'student@lessonflow.com',
            password,
            role: 'STUDENT'
        }
    });

    const parent = await prisma.user.upsert({
        where: { email: 'parent@lessonflow.com' },
        update: { password },
        create: {
            name: 'Robert Johnson',
            email: 'parent@lessonflow.com',
            password,
            role: 'PARENT'
        }
    });

    const processDept = await prisma.user.upsert({
        where: { email: 'process@lessonflow.com' },
        update: { password },
        create: {
            name: 'Process Manager',
            email: 'process@lessonflow.com',
            password,
            role: 'PROCESS_DEPT'
        }
    });

    console.log('✅ Users created');

    // 2. Create Departments and Assign HODs
    const mathDept = await prisma.department.upsert({
        where: { name: 'Mathematics' },
        update: { headId: mathHOD.id },
        create: {
            name: 'Mathematics',
            description: 'Department of Mathematics',
            headId: mathHOD.id
        }
    });

    const scienceDept = await prisma.department.upsert({
        where: { name: 'Science' },
        update: { headId: scienceHOD.id },
        create: {
            name: 'Science',
            description: 'Department of Natural Sciences',
            headId: scienceHOD.id
        }
    });

    // Assign Teachers to Departments
    await prisma.user.update({ where: { id: teacher1.id }, data: { departmentId: mathDept.id } });
    await prisma.user.update({ where: { id: teacher2.id }, data: { departmentId: scienceDept.id } });

    console.log('✅ Departments & HODs assigned');

    // 2.5 Create Subjects
    const mathSubject = await prisma.subject.upsert({
        where: { name_departmentId: { name: 'Mathematics', departmentId: mathDept.id } },
        update: {},
        create: { name: 'Mathematics', code: 'MATH', departmentId: mathDept.id }
    });

    const scienceSubject = await prisma.subject.upsert({
        where: { name_departmentId: { name: 'Science', departmentId: scienceDept.id } },
        update: {},
        create: { name: 'Science', code: 'SCI', departmentId: scienceDept.id }
    });

    console.log('✅ Subjects created');

    // 3. Create Courses
    const algebraCourse = await prisma.course.create({
        data: {
            name: 'Algebra I',
            code: 'MATH101',
            departmentId: mathDept.id
        }
    });

    const biologyCourse = await prisma.course.create({
        data: {
            name: 'Biology',
            code: 'SCI101',
            departmentId: scienceDept.id
        }
    });

    console.log('✅ Courses created');

    // 4. Create Classes Linked to Courses
    const mathClass = await prisma.class.create({
        data: {
            name: 'Class 9A',
            section: 'A',
            subject: 'Mathematics',
            grade: '9',
            coverColor: '#1a73e8',
            ownerId: teacher1.id,
            courseId: algebraCourse.id
        }
    });

    const scienceClass = await prisma.class.create({
        data: {
            name: 'Class 10B',
            section: 'B',
            subject: 'Science',
            grade: '10',
            coverColor: '#0f9d58',
            ownerId: teacher2.id,
            courseId: biologyCourse.id
        }
    });

    // 4.5 Teacher Assignments (teacher → class → subject mapping)
    await prisma.teacherAssignment.createMany({
        data: [
            { teacherId: teacher1.id, classId: mathClass.id, subjectId: mathSubject.id },
            { teacherId: teacher2.id, classId: scienceClass.id, subjectId: scienceSubject.id }
        ],
        skipDuplicates: true
    });

    console.log('✅ Teacher assignments created');

    // 5. Create Lesson Plans with States
    // Submitted Plan (Pending Approval)
    await prisma.lessonPlan.create({
        data: {
            title: 'Introduction to Functions',
            subject: 'Mathematics',
            grade: '9',
            status: 'SUBMITTED',
            teacherId: teacher1.id,
            classId: mathClass.id,
            submissionDate: new Date(),
            objectives: ['Define a function', 'Identify domain and range'],
            instruction: 'Explain function notation f(x)...'
        }
    });

    // Approved Plan
    await prisma.lessonPlan.create({
        data: {
            title: 'Solving Quadratic Equations',
            subject: 'Mathematics',
            grade: '9',
            status: 'APPROVED',
            teacherId: teacher1.id,
            classId: mathClass.id,
            submissionDate: new Date(),
            approvalDate: new Date(),
            approverId: mathHOD.id,
            approvalComment: 'Great plan, clear objectives.',
            objectives: ['Solve by factoring', 'Use quadratic formula']
        }
    });

    // Readiness Assessment Example
    const lessonWithAI = await prisma.lessonPlan.create({
        data: {
            title: 'Cell Division: Mitosis',
            subject: 'Science',
            grade: '10',
            status: 'DRAFT',
            teacherId: teacher2.id,
            classId: scienceClass.id,
            objectives: ['Phases of mitosis', 'Cytokinesis'],
            instruction: 'Use microscope slides...'
        }
    });

    await prisma.readinessAssessment.create({
        data: {
            lessonPlanId: lessonWithAI.id,
            status: 'COMPLETED',
            score: 85,
            questions: {
                q1: "How will you clarify the difference between Anaphase and Telophase?",
                q2: "What safety precautions are needed for the microscope lab?"
            },
            answers: {
                a1: "I will use a side-by-side diagram comparison.",
                a2: "Students must wear goggles and handle slides with care."
            },
            feedback: "Good safety awareness. Ensure the diagram comparison is visible to the back of the class."
        }
    });

    console.log('✅ Lesson plans & AI assessments created');

    // ─── Timetabling Seed Data ───

    // Rooms
    const roomData = [
        { name: 'Room 101', type: 'REGULAR', capacity: 40 },
        { name: 'Room 102', type: 'REGULAR', capacity: 40 },
        { name: 'Room 103', type: 'REGULAR', capacity: 40 },
        { name: 'Room 104', type: 'REGULAR', capacity: 35 },
        { name: 'Room 105', type: 'REGULAR', capacity: 35 },
        { name: 'Science Lab', type: 'LAB', capacity: 30 },
        { name: 'Physics Lab', type: 'LAB', capacity: 30 },
        { name: 'Computer Lab', type: 'COMPUTER_LAB', capacity: 25 },
        { name: 'PE Ground', type: 'PE', capacity: 100 },
        { name: 'Library', type: 'LIBRARY', capacity: 50 },
        { name: 'Art Room', type: 'SPECIALTY', capacity: 30 },
    ];

    for (const r of roomData) {
        await prisma.room.upsert({
            where: { name: r.name },
            update: {},
            create: r
        });
    }
    console.log('✅ Rooms created');

    // Periods (8 periods + lunch break)
    const periodData = [
        { number: 1, startTime: '08:00', endTime: '08:40', label: 'Period 1' },
        { number: 2, startTime: '08:45', endTime: '09:25', label: 'Period 2' },
        { number: 3, startTime: '09:30', endTime: '10:10', label: 'Period 3' },
        { number: 4, startTime: '10:15', endTime: '10:55', label: 'Period 4' },
        { number: 5, startTime: '11:00', endTime: '11:30', label: 'Lunch Break', isBreak: true },
        { number: 6, startTime: '11:35', endTime: '12:15', label: 'Period 5' },
        { number: 7, startTime: '12:20', endTime: '13:00', label: 'Period 6' },
        { number: 8, startTime: '13:05', endTime: '13:45', label: 'Period 7' },
        { number: 9, startTime: '13:50', endTime: '14:30', label: 'Period 8' },
    ];

    for (const p of periodData) {
        await prisma.period.upsert({
            where: { number: p.number },
            update: {},
            create: p
        });
    }
    console.log('✅ Periods created');

    console.log('\n🎉 Seeding complete! Login Credentials:');
    console.log('  Admin:      admin@lessonflow.com / password123');
    console.log('  HOD (Math): hod.math@lessonflow.com / password123');
    console.log('  HOD (Sci):  hod.science@lessonflow.com / password123');
    console.log('  Teacher:    teacher.math@lessonflow.com / password123');
    console.log('  Teacher:    teacher.science@lessonflow.com / password123');
    console.log('  Process:    process@lessonflow.com / password123');
    console.log('  Student:    student@lessonflow.com / password123');
    console.log('  Parent:     parent@lessonflow.com / password123');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
