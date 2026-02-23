import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';

// --- Draggable Lesson Plan Item ---
function DraggableLesson({ plan }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `plan-${plan.id}`,
        data: { plan }
    });

    const style = {
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        opacity: isDragging ? 0.5 : 1,
        padding: '12px 14px',
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        marginBottom: '8px',
        cursor: 'grab',
        boxShadow: isDragging ? '0 10px 25px rgba(0,0,0,0.1)' : '0 1px 3px rgba(0,0,0,0.05)',
        zIndex: isDragging ? 999 : 1
    };

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
            <div style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                {plan.title.substring(0, 40)}{plan.title.length > 40 ? '...' : ''}
            </div>
            <div style={{ display: 'flex', gap: '6px', fontSize: '11px', color: '#64748b' }}>
                <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                    {plan.subject}
                </span>
                <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                    Grade {plan.grade}
                </span>
                <span style={{
                    background: plan.status === 'DRAFT' ? '#fef3c7' : '#dcfce7',
                    color: plan.status === 'DRAFT' ? '#d97706' : '#15803d',
                    padding: '2px 6px', borderRadius: '4px', fontWeight: 600
                }}>
                    {plan.status}
                </span>
            </div>
        </div>
    );
}

// --- Droppable Timetable Slot ---
function DroppableSlot({ slot, date, assignment, onAssign }) {
    const { isOver, setNodeRef } = useDroppable({
        id: `slot-${slot.id}-${date}`,
        data: { slot, date }
    });

    const hasPlan = Boolean(assignment);

    const labelStyle = {
        padding: '8px',
        background: isOver ? '#eef2ff' : '#f8fafc',
        border: `2px dashed ${isOver ? '#4f46e5' : '#e2e8f0'}`,
        borderRadius: '8px',
        minHeight: '80px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        cursor: hasPlan ? 'default' : 'pointer',
        transition: 'all 0.2s',
        marginBottom: '4px'
    };

    return (
        <div ref={setNodeRef} style={labelStyle}>
            {hasPlan ? (
                <div style={{ textAlign: 'center', width: '100%' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#059669', marginBottom: '2px' }}>
                        {slot.subject?.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#1e293b', background: '#ecfdf5', padding: '4px 8px', borderRadius: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {assignment.lessonPlan.title}
                    </div>
                </div>
            ) : (
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>
                        {slot.subject?.name}
                    </div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                        {slot.class?.name}
                    </div>
                    <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>
                        Drop to assign
                    </div>
                </div>
            )}
        </div>
    );
}

export default function AssignLessonPlans() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [lessonPlans, setLessonPlans] = useState([]);
    const [timetable, setTimetable] = useState({ slots: [], days: [], periods: [], assignments: [] });
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);

    // Generate next 14 days
    const next14Days = useMemo(() => {
        const dates = [];
        const today = new Date();
        // Set to midnight to avoid timezone issues when comparing
        today.setHours(0, 0, 0, 0);

        for (let i = 0; i < 14; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() + i);
            dates.push(d);
        }
        return dates;
    }, []);

    const startDate = next14Days[0].toISOString().split('T')[0];
    const endDate = next14Days[13].toISOString().split('T')[0];

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    useEffect(() => {
        const fetchAll = async () => {
            setLoading(true);
            try {
                const ttRes = await api.get(`/timetable/my?startDate=${startDate}&endDate=${endDate}`);
                setTimetable({
                    slots: ttRes.data.slots || [],
                    days: ttRes.data.days || [],
                    periods: ttRes.data.periods || [],
                    assignments: ttRes.data.assignments || []
                });

                // Fetch lesson plans for sidebar
                const plansRes = await api.get('/lesson-plans');
                // We show all plans the teacher created so they can drag them onto dates.
                // Could filter out "Drafts" if required, but showing all for flexibility.
                setLessonPlans(plansRes.data);

            } catch (err) {
                console.error(err);
                showToast('Failed to load data', 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, [startDate, endDate]);

    const handleDragEnd = async (event) => {
        const { active, over } = event;
        if (!over) return;

        const plan = active.data.current.plan;
        const slot = over.data.current.slot;
        const targetDateStr = over.data.current.date; // The ISO string of the date

        const existingAssignment = timetable.assignments.find(a => a.slotId === slot.id && new Date(a.date).toISOString() === targetDateStr);
        if (existingAssignment && existingAssignment.lessonPlanId !== plan.id) {
            if (!window.confirm('This slot already has a lesson plan on this date. Overwrite it?')) {
                return;
            }
        }

        try {
            const res = await api.patch(`/timetable/slots/${slot.id}/link`, {
                lessonPlanId: plan.id,
                date: targetDateStr
            });

            showToast('Lesson plan assigned successfully!');

            const newAssignment = res.data;
            setTimetable(prev => {
                // Remove old assignment for this date/slot if exists, add new
                const filtered = prev.assignments.filter(a => !(a.slotId === slot.id && new Date(a.date).toISOString() === targetDateStr));
                return {
                    ...prev,
                    assignments: [...filtered, newAssignment]
                };
            });

        } catch (err) {
            console.error(err);
            showToast('Failed to assign lesson plan.', 'error');
        }
    };

    const activeDays = timetable.days;
    const periods = useMemo(() => timetable.periods.filter(p => !p.isBreak).sort((a, b) => a.number - b.number), [timetable.periods]);

    const getDayOfWeekString = (date) => {
        const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
        return days[date.getDay()];
    };

    return (
        <DndContext onDragEnd={handleDragEnd}>
            <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f8fafc' }}>
                {toast && (
                    <div style={{
                        position: 'fixed', top: 24, right: 24, zIndex: 9999,
                        background: toast.type === 'error' ? '#dc2626' : '#059669',
                        color: '#fff', padding: '12px 20px', borderRadius: '10px',
                        boxShadow: '0 4px 24px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '8px',
                        fontWeight: 500
                    }}>
                        <span className="material-icons-outlined" style={{ fontSize: '18px' }}>
                            {toast.type === 'error' ? 'error' : 'check_circle'}
                        </span>
                        {toast.message}
                    </div>
                )}

                <Header title="Assign Lesson Plans">
                    <button className="btn btn-primary" onClick={() => navigate('/lesson-plans/create')}>
                        <span className="material-icons-outlined">add_circle</span>
                        New Plan
                    </button>
                </Header>

                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    {/* Sidebar: Unassigned Plans */}
                    <div style={{ width: '320px', borderRight: '1px solid #e2e8f0', background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', background: '#f1f5f9' }}>
                            <h3 style={{ margin: 0, fontSize: '14px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span className="material-icons-outlined" style={{ fontSize: '18px', color: '#4f46e5' }}>inventory_2</span>
                                Unassigned Lesson Plans
                            </h3>
                            <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748b' }}>
                                Drag and drop onto timetable slots
                            </p>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                            {loading ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><div className="spinner" /></div>
                            ) : lessonPlans.length === 0 ? (
                                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}>
                                    <span className="material-icons-outlined" style={{ fontSize: '48px', color: '#cbd5e1', marginBottom: '8px' }}>check_circle</span>
                                    <p style={{ margin: 0, fontSize: '13px' }}>All caught up!</p>
                                    <p style={{ margin: 0, fontSize: '11px' }}>No unassigned plans found.</p>
                                </div>
                            ) : (
                                lessonPlans.map(plan => <DraggableLesson key={plan.id} plan={plan} />)
                            )}
                        </div>
                    </div>

                    {/* Main: Timetable Grid */}
                    <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
                        {loading ? (
                            <div style={{ display: 'flex', justifyContent: 'center', height: '100%', alignItems: 'center' }}><div className="spinner" /></div>
                        ) : activeDays.length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '100px' }}>
                                <span className="material-icons-outlined" style={{ fontSize: '64px', color: '#cbd5e1', marginBottom: '16px' }}>event_busy</span>
                                <h2>No Timetable Configured</h2>
                                <p>Please generate a timetable pattern first.</p>
                            </div>
                        ) : (
                            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ width: '80px', background: '#f8fafc', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}></th>
                                            {next14Days.map((date, idx) => {
                                                const isToday = idx === 0;
                                                return (
                                                    <th key={date.toISOString()} style={{ padding: '12px 8px', background: isToday ? '#e0e7ff' : '#f8fafc', borderBottom: '2px solid #e2e8f0', borderRight: '1px solid #e2e8f0', textAlign: 'center', minWidth: '150px' }}>
                                                        <div style={{ fontWeight: 800, fontSize: '13px', color: isToday ? '#4338ca' : '#1e293b' }}>
                                                            {date.toLocaleDateString('en-US', { weekday: 'short' })}
                                                        </div>
                                                        <div style={{ fontSize: '11px', color: isToday ? '#4f46e5' : '#64748b', marginTop: '2px' }}>
                                                            {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                        </div>
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {periods.map(period => (
                                            <tr key={period.id}>
                                                <td style={{ padding: '12px 8px', background: '#f8fafc', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', textAlign: 'center', fontSize: '11px', fontWeight: 600, color: '#64748b' }}>
                                                    <div>Period {period.number}</div>
                                                    <div style={{ fontSize: '9px', marginTop: '2px', opacity: 0.8 }}>{period.startTime} - {period.endTime}</div>
                                                </td>
                                                {next14Days.map(date => {
                                                    const dayOfWeekStr = getDayOfWeekString(date);
                                                    const slot = timetable.slots.find(s => s.dayOfWeek === dayOfWeekStr && s.periodId === period.id);

                                                    let assignment = null;
                                                    if (slot) {
                                                        const targetDateIso = date.toISOString();
                                                        assignment = timetable.assignments.find(a => a.slotId === slot.id && new Date(a.date).toISOString() === targetDateIso);
                                                    }

                                                    return (
                                                        <td key={`${date.toISOString()}-${period.id}`} style={{ padding: '8px', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', verticalAlign: 'top', background: slot ? '#fff' : '#fafafa' }}>
                                                            {slot ? (
                                                                <DroppableSlot slot={slot} date={date.toISOString()} assignment={assignment} onAssign={() => { }} />
                                                            ) : (
                                                                <div style={{ height: '80px', borderRadius: '8px', border: '1px dashed #e2e8f0', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', fontSize: '11px' }}>
                                                                    No Class
                                                                </div>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </DndContext>
    );
}
