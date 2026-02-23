const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.timetableLesson.findMany().then(lessons => {
  console.log("Lessons found:", lessons.length);
}).catch(console.error).finally(() => prisma.$disconnect());
