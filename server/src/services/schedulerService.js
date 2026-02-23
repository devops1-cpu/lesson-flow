const prisma = require('../config/prisma.js');
const { v4: uuidv4 } = require('uuid');

/**
 * schedulerService.js
 * Constraint-based auto-scheduling engine using TimetableLesson entities.
 * 
 * Supports:
 * - Count per week (how many times a lesson appears)
 * - Length (single/double/triple periods)
 * - Teacher combinations (all teachers must be free)
 * - Room type matching (PE→PE ground, Science→Lab)
 * - Teacher availability (time-off preferences)
 * - Distribution (spread across different days)
 * - Progress tracking
 */

// We will receive `activeDays` from the caller instead of hardcoding.
// Example: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']

// Subject → Room type fallback mapping
const SUBJECT_ROOM_MAP = {
    'physical education': 'PE', 'pe': 'PE', 'sports': 'PE',
    'science': 'LAB', 'physics': 'LAB', 'chemistry': 'LAB', 'biology': 'LAB',
    'computer science': 'COMPUTER_LAB', 'computer': 'COMPUTER_LAB', 'ict': 'COMPUTER_LAB',
    'library': 'LIBRARY',
};

function getRequiredRoomType(subjectName, explicitType) {
    if (explicitType) return explicitType;
    const lower = (subjectName || '').toLowerCase();
    for (const [keyword, roomType] of Object.entries(SUBJECT_ROOM_MAP)) {
        if (lower.includes(keyword)) return roomType;
    }
    return 'REGULAR';
}

/**
 * Auto-generate timetable from TimetableLesson entities
 * @param {Object} options
 * @param {boolean} options.clearExisting - Clear existing slots before generating
 * @param {Array} options.activeDays - List of days to schedule on (default: Mon-Fri)
 * @param {function} options.onProgress - Progress callback (step, total, message)
 */
async function autoGenerate({ clearExisting = false, activeDays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'], onProgress } = {}) {
    const progress = onProgress || (() => { });
    const steps = [];
    let stepIdx = 0;
    const addStep = (msg) => { stepIdx++; steps.push({ step: stepIdx, message: msg, time: Date.now() }); progress(stepIdx, 10, msg); };

    // 1. Clear existing
    if (clearExisting) {
        addStep('Clearing existing timetable...');
        await prisma.timetableSlot.deleteMany({});
    }

    // 2. Fetch data
    addStep('Loading periods and rooms...');
    const periods = await prisma.period.findMany({
        where: { isBreak: false },
        orderBy: { number: 'asc' }
    });
    if (periods.length === 0) throw new Error('No periods configured. Set up school periods first.');

    const rooms = await prisma.room.findMany();
    const roomsByType = {};
    for (const room of rooms) {
        if (!roomsByType[room.type]) roomsByType[room.type] = [];
        roomsByType[room.type].push(room);
    }

    // 3. Load TimetableLessons with teachers and classes
    addStep('Loading lesson configurations...');
    const lessons = await prisma.timetableLesson.findMany({
        include: {
            subject: { select: { id: true, name: true, code: true } },
            classes: { include: { class: { select: { id: true, name: true, section: true } } } },
            teachers: { include: { teacher: { select: { id: true, name: true } } } }
        }
    });
    if (lessons.length === 0) throw new Error('No timetable lessons configured. Create lessons first.');

    // 4. Load unavailability constraints
    addStep('Checking time off constraints...');
    const [tAvail, cAvail, sAvail] = await Promise.all([
        prisma.teacherAvailability.findMany({ where: { state: 'UNAVAILABLE' } }),
        prisma.classAvailability.findMany({ where: { state: 'UNAVAILABLE' } }),
        prisma.subjectAvailability.findMany({ where: { state: 'UNAVAILABLE' } })
    ]);

    const unavailableTeacher = new Set();
    for (const a of tAvail) unavailableTeacher.add(`${a.teacherId}-${a.dayOfWeek}-${a.periodId}`);

    const unavailableClass = new Set();
    for (const a of cAvail) unavailableClass.add(`${a.classId}-${a.dayOfWeek}-${a.periodId}`);

    const unavailableSubject = new Set();
    for (const a of sAvail) unavailableSubject.add(`${a.subjectId}-${a.dayOfWeek}-${a.periodId}`);

    // 5. Schedule
    addStep('Scheduling lessons...');

    const placedSlots = [];
    const placedClasses = [];
    const placedTeachers = [];
    const conflicts = [];

    // Occupancy trackers
    const teacherOccupied = new Set();  // "teacherId-DAY-periodId"
    const classOccupied = new Set();    // "classId-DAY-periodId"
    const roomOccupied = new Set();     // "roomId-DAY-periodId"
    const subjectDayTracker = new Map(); // "classId-subjectId-DAY" -> count

    // Sort lessons: harder to place first (longer lessons, more teachers, specific room needs)
    const sortedLessons = [...lessons].sort((a, b) => {
        const scoreA = a.length * 3 + a.teachers.length * 2 + a.classes.length * 1 + (a.roomType ? 1 : 0);
        const scoreB = b.length * 3 + b.teachers.length * 2 + b.classes.length * 1 + (b.roomType ? 1 : 0);
        return scoreB - scoreA; // Hardest first
    });

    let totalToPlace = 0;
    for (const lesson of sortedLessons) totalToPlace += lesson.count;

    for (const lesson of sortedLessons) {
        const teacherIds = lesson.teachers.map(lt => lt.teacherId);
        const classIds = lesson.classes.map(lc => lc.classId);

        const subjectName = lesson.subject?.name || '';
        const requiredRoomType = getRequiredRoomType(subjectName, lesson.roomType);

        const lessonIdentifier = subjectName || lesson.title || 'Meeting';
        const classNames = lesson.classes.map(c => c.class.name).join(', ') || 'No Classes';

        let slotsPlaced = 0;

        for (let attempt = 0; attempt < lesson.count; attempt++) {
            let found = false;

            // Try each day, distributing across days
            for (const day of activeDays) {
                if (found) break;

                // Avoid same subject twice on same day for this class IF count <= activeDays
                const dayKeys = classIds.map(cid => `${cid}-${lesson.subjectId || lesson.title}-${day}`);

                const maxPerDay = Math.max(1, Math.ceil(lesson.count / activeDays.length));
                let tooManyForSomeClass = false;
                for (const dk of dayKeys) {
                    if ((subjectDayTracker.get(dk) || 0) >= maxPerDay) {
                        tooManyForSomeClass = true; break;
                    }
                }
                if (tooManyForSomeClass) continue;

                // Find a sequence of consecutive periods of the right length
                for (let pi = 0; pi <= periods.length - lesson.length; pi++) {
                    if (found) break;

                    const periodSlice = periods.slice(pi, pi + lesson.length);
                    let canPlace = true;

                    // Check all periods in the sequence
                    for (const p of periodSlice) {
                        // Classes free?
                        for (const cid of classIds) {
                            if (classOccupied.has(`${cid}-${day}-${p.id}`)) { canPlace = false; break; }
                            if (unavailableClass.has(`${cid}-${day}-${p.id}`)) { canPlace = false; break; }
                        }
                        if (!canPlace) break;

                        // Subject free? (Time off constraint)
                        if (lesson.subjectId && unavailableSubject.has(`${lesson.subjectId}-${day}-${p.id}`)) { canPlace = false; break; }

                        // All teachers free?
                        for (const tid of teacherIds) {
                            if (teacherOccupied.has(`${tid}-${day}-${p.id}`)) { canPlace = false; break; }
                            if (unavailableTeacher.has(`${tid}-${day}-${p.id}`)) { canPlace = false; break; }
                        }
                        if (!canPlace) break;
                    }
                    if (!canPlace) continue;

                    // Find room for ALL periods in the sequence
                    let selectedRoom = null;
                    const candidateRooms = roomsByType[requiredRoomType] || roomsByType['REGULAR'] || [];
                    for (const room of candidateRooms) {
                        let roomFree = true;
                        for (const p of periodSlice) {
                            if (roomOccupied.has(`${room.id}-${day}-${p.id}`)) { roomFree = false; break; }
                        }
                        if (roomFree) { selectedRoom = room; break; }
                    }
                    // Fallback to regular rooms if specialty unavailable
                    if (!selectedRoom && requiredRoomType !== 'REGULAR') {
                        for (const room of (roomsByType['REGULAR'] || [])) {
                            let roomFree = true;
                            for (const p of periodSlice) {
                                if (roomOccupied.has(`${room.id}-${day}-${p.id}`)) { roomFree = false; break; }
                            }
                            if (roomFree) { selectedRoom = room; break; }
                        }
                    }

                    // Place all periods in the sequence
                    for (const p of periodSlice) {
                        const slotId = uuidv4();

                        for (const cid of classIds) {
                            classOccupied.add(`${cid}-${day}-${p.id}`);
                            placedClasses.push({ id: uuidv4(), slotId, classId: cid });
                        }

                        for (const tid of teacherIds) {
                            teacherOccupied.add(`${tid}-${day}-${p.id}`);
                            placedTeachers.push({ id: uuidv4(), slotId, teacherId: tid });
                        }

                        if (selectedRoom) roomOccupied.add(`${selectedRoom.id}-${day}-${p.id}`);

                        placedSlots.push({
                            id: slotId,
                            dayOfWeek: day,
                            periodId: p.id,
                            subjectId: lesson.subjectId || null,
                            title: lesson.title || null,
                            roomId: selectedRoom?.id || null
                        });
                    }

                    for (const dk of dayKeys) {
                        subjectDayTracker.set(dk, (subjectDayTracker.get(dk) || 0) + 1);
                    }

                    slotsPlaced++;
                    found = true;
                }
            }
        }

        if (slotsPlaced < lesson.count) {
            conflicts.push({
                type: 'insufficient_slots',
                lesson: {
                    subject: lessonIdentifier,
                    class: classNames,
                    teachers: lesson.teachers.map(t => t.teacher.name).join(', ')
                },
                needed: lesson.count,
                placed: slotsPlaced
            });
        }

        addStep(`Placed ${lessonIdentifier} for ${classNames} (${slotsPlaced}/${lesson.count})`);
    }

    // 6. Batch insert
    addStep('Saving timetable to database...');
    if (placedSlots.length > 0) {
        await prisma.timetableSlot.createMany({ data: placedSlots, skipDuplicates: true });
        if (placedClasses.length > 0) {
            await prisma.slotClass.createMany({ data: placedClasses, skipDuplicates: true });
        }
        if (placedTeachers.length > 0) {
            await prisma.slotTeacher.createMany({ data: placedTeachers, skipDuplicates: true });
        }
    }

    addStep('Timetable generation complete!');

    return {
        success: true,
        totalPlaced: placedSlots.length,
        totalConflicts: conflicts.length,
        conflicts,
        steps,
        summary: {
            lessons: lessons.length,
            periodsPerDay: periods.length,
            daysPerWeek: activeDays.length,
            roomsAvailable: rooms.length,
            totalSlotsCreated: placedSlots.length
        }
    };
}

module.exports = { autoGenerate };

