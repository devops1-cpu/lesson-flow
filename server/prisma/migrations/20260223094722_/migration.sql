/*
  Warnings:

  - You are about to drop the column `classId` on the `TimetableLesson` table. All the data in the column will be lost.
  - You are about to drop the column `classId` on the `TimetableSlot` table. All the data in the column will be lost.
  - You are about to drop the column `teacherId` on the `TimetableSlot` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "TimetableLesson" DROP CONSTRAINT "TimetableLesson_classId_fkey";

-- DropForeignKey
ALTER TABLE "TimetableSlot" DROP CONSTRAINT "TimetableSlot_classId_fkey";

-- DropForeignKey
ALTER TABLE "TimetableSlot" DROP CONSTRAINT "TimetableSlot_teacherId_fkey";

-- DropIndex
DROP INDEX "TimetableSlot_dayOfWeek_periodId_classId_key";

-- DropIndex
DROP INDEX "TimetableSlot_dayOfWeek_periodId_roomId_key";

-- DropIndex
DROP INDEX "TimetableSlot_dayOfWeek_periodId_teacherId_key";

-- AlterTable
ALTER TABLE "TimetableLesson" DROP COLUMN "classId",
ADD COLUMN     "title" TEXT,
ALTER COLUMN "subjectId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "TimetableSlot" DROP COLUMN "classId",
DROP COLUMN "teacherId",
ADD COLUMN     "title" TEXT,
ALTER COLUMN "subjectId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "LessonClass" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,

    CONSTRAINT "LessonClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlotClass" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,

    CONSTRAINT "SlotClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlotTeacher" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,

    CONSTRAINT "SlotTeacher_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LessonClass_lessonId_classId_key" ON "LessonClass"("lessonId", "classId");

-- CreateIndex
CREATE UNIQUE INDEX "SlotClass_slotId_classId_key" ON "SlotClass"("slotId", "classId");

-- CreateIndex
CREATE UNIQUE INDEX "SlotTeacher_slotId_teacherId_key" ON "SlotTeacher"("slotId", "teacherId");

-- AddForeignKey
ALTER TABLE "LessonClass" ADD CONSTRAINT "LessonClass_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "TimetableLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonClass" ADD CONSTRAINT "LessonClass_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlotClass" ADD CONSTRAINT "SlotClass_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "TimetableSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlotClass" ADD CONSTRAINT "SlotClass_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlotTeacher" ADD CONSTRAINT "SlotTeacher_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "TimetableSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlotTeacher" ADD CONSTRAINT "SlotTeacher_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
