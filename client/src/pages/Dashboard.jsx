import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import api from '../services/api';

const Dashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [plans, setPlans] = useState([]);
    const [classes, setClasses] = useState([]);
    const [timetableSlots, setTimetableSlots] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchDashboardData(); }, []);

    const fetchDashboardData = async () => {
        try {
            const [plansRes, classesRes, timetableRes] = await Promise.all([
                api.get('/lesson-plans'),
                api.get('/classes'),
                api.get('/timetable/my').catch(() => ({ data: { slots: [] } }))
            ]);
            setPlans(plansRes.data);
            setClasses(classesRes.data);
            setTimetableSlots(timetableRes.data?.slots || []);
        } catch (err) { console.error('Dashboard error:', err); }
        finally { setLoading(false); }
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        return 'Good evening';
    };

    // Calendar: generate next 14 days
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const calendarDays = [];
    for (let i = 0; i < 14; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        calendarDays.push(d);
    }

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const dayNameMap = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

    // Map plans to calendar dates based on timetable slot assignment
    const getPlansByDate = (date) => {
        const dayOfWeek = dayNameMap[date.getDay()];
        const daySlots = timetableSlots.filter(s => s.dayOfWeek === dayOfWeek && s.lessonPlanId);
        const uniquePlanIds = [...new Set(daySlots.map(s => s.lessonPlanId))];
        return uniquePlanIds.map(id => plans.find(p => p.id === id)).filter(Boolean);
    };

    const isToday = (date) => {
        const t = new Date(); t.setHours(0, 0, 0, 0);
        return date.getTime() === t.getTime();
    };

    const statusDotColor = (status) => {
        const m = { DRAFT: '#9ca3af', SUBMITTED: '#d97706', APPROVED: '#059669', PUBLISHED: '#1a73e8', CHANGES_REQUESTED: '#dc2626' };
        return m[status] || '#9ca3af';
    };

    const stats = {
        total: plans.length,
        drafts: plans.filter(p => p.status === 'DRAFT').length,
        submitted: plans.filter(p => p.status === 'SUBMITTED').length,
        approved: plans.filter(p => ['APPROVED', 'PUBLISHED'].includes(p.status)).length,
    };

    if (loading) return (
        <><Header title="Dashboard" /><div className="app-content"><div className="loading"><div className="spinner" /></div></div></>
    );

    return (
        <>
            <Header title="Dashboard" />
            <div className="app-content">
                {/* Welcome */}
                <div className="dashboard-welcome animate-in">
                    <h2>{getGreeting()}, {user?.name?.split(' ')[0]}! 👋</h2>
                    <p>
                        {user?.role === 'TEACHER' && 'Ready to create engaging lesson plans for your students?'}
                        {user?.role === 'ADMIN' && 'Manage your platform, teachers, students and classes.'}
                        {user?.role === 'STUDENT' && 'Check out your latest lesson plans and class materials.'}
                        {user?.role === 'PARENT' && "Stay updated with your child's learning progress."}
                        {user?.role === 'HOD' && 'Review and approve lesson plans from your department.'}
                        {user?.role === 'PROCESS_DEPT' && 'Monitor lesson plan compliance across all teachers.'}
                    </p>
                </div>

                {/* Stats */}
                <div className="dashboard-stats">
                    {[
                        { label: 'Total Plans', value: stats.total, icon: 'auto_stories', cls: 'blue' },
                        { label: 'Classes', value: classes.length, icon: 'school', cls: 'green' },
                        { label: 'Drafts', value: stats.drafts, icon: 'edit_note', cls: 'orange', roles: ['TEACHER', 'ADMIN'] },
                        { label: 'Submitted', value: stats.submitted, icon: 'send', cls: 'purple', roles: ['TEACHER', 'ADMIN', 'HOD'] },
                        { label: 'Approved', value: stats.approved, icon: 'check_circle', cls: 'green', roles: ['TEACHER', 'ADMIN', 'HOD'] },
                    ].filter(s => !s.roles || s.roles.includes(user?.role)).map((stat, i) => (
                        <div key={i} className="stat-card animate-in" style={{ animationDelay: `${i * 80}ms` }}>
                            <div className={`stat-icon ${stat.cls}`}>
                                <span className="material-icons-outlined">{stat.icon}</span>
                            </div>
                            <div>
                                <div className="stat-value">{stat.value}</div>
                                <div className="stat-label">{stat.label}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Calendar — Next 2 Weeks */}
                <div className="card animate-in" style={{ marginBottom: 24, overflow: 'hidden' }}>
                    <div style={{
                        padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        borderBottom: '1px solid #e5e7eb'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span className="material-icons-outlined" style={{ color: '#1a73e8', fontSize: 22 }}>calendar_today</span>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Next 2 Weeks</h3>
                        </div>
                        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#6b7280' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669', display: 'inline-block' }} /> Approved</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706', display: 'inline-block' }} /> Submitted</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#9ca3af', display: 'inline-block' }} /> Draft</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fef2f2', border: '1px dashed #fca5a5', display: 'inline-block' }} /> No Plan</span>
                        </div>
                    </div>
                    <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0
                    }}>
                        {/* Day headers */}
                        {dayNames.map(d => (
                            <div key={d} style={{
                                padding: '8px 0', textAlign: 'center', fontSize: 11, fontWeight: 600,
                                color: '#6b7280', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb',
                                background: '#f9fafb'
                            }}>{d}</div>
                        ))}
                        {/* Empty cells for offset (align to correct day-of-week) */}
                        {[...Array(calendarDays[0].getDay())].map((_, i) => (
                            <div key={`empty-${i}`} style={{ borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6' }} />
                        ))}
                        {/* Calendar days */}
                        {calendarDays.map(date => {
                            const dayPlans = getPlansByDate(date);
                            const hasPlans = dayPlans.length > 0;
                            const isTodayDay = isToday(date);
                            const isSunday = date.getDay() === 0;

                            return (
                                <div
                                    key={date.toISOString()}
                                    onClick={() => {
                                        if (hasPlans) navigate(`/lesson-plans/${dayPlans[0].id}`);
                                        else if (['TEACHER', 'ADMIN'].includes(user?.role)) navigate('/create-lesson');
                                    }}
                                    style={{
                                        minHeight: 80, padding: '8px 10px',
                                        borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6',
                                        cursor: 'pointer', transition: 'background 0.15s',
                                        background: isTodayDay ? '#eff6ff' : isSunday ? '#fafafa' : !hasPlans && !isSunday ? '#fffbeb05' : '#fff'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f0f5ff'}
                                    onMouseLeave={e => e.currentTarget.style.background = isTodayDay ? '#eff6ff' : '#fff'}
                                >
                                    <div style={{
                                        fontSize: 12, fontWeight: isTodayDay ? 800 : 500, marginBottom: 6,
                                        color: isTodayDay ? '#1a73e8' : '#374151',
                                        display: 'flex', alignItems: 'center', gap: 4
                                    }}>
                                        {isTodayDay && <span style={{
                                            width: 6, height: 6, borderRadius: '50%', background: '#1a73e8', display: 'inline-block'
                                        }} />}
                                        {isTodayDay ? 'Today' : date.getDate()}
                                    </div>
                                    {hasPlans ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                            {dayPlans.slice(0, 2).map(p => (
                                                <div key={p.id} style={{
                                                    fontSize: 10, padding: '3px 6px', borderRadius: 4,
                                                    background: `${statusDotColor(p.status)}15`,
                                                    color: statusDotColor(p.status),
                                                    fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                                }}>
                                                    {p.title}
                                                </div>
                                            ))}
                                            {dayPlans.length > 2 && (
                                                <span style={{ fontSize: 10, color: '#6b7280' }}>+{dayPlans.length - 2} more</span>
                                            )}
                                        </div>
                                    ) : !isSunday ? (
                                        <div style={{
                                            fontSize: 9, padding: '3px 6px', borderRadius: 4,
                                            border: '1px dashed #fca5a5', color: '#f87171',
                                            textAlign: 'center', marginTop: 4
                                        }}>
                                            No plan
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Recent Plans */}
                <div className="section-header">
                    <h2>Recent Lesson Plans</h2>
                    <button className="btn btn-secondary" onClick={() => navigate('/lesson-plans')} id="view-all-plans">
                        View All
                    </button>
                </div>

                {plans.length > 0 ? (
                    <div className="grid-cards">
                        {plans.slice(0, 6).map((plan, i) => (
                            <div key={plan.id} className="card lesson-card animate-in" onClick={() => navigate(`/lesson-plans/${plan.id}`)} style={{ animationDelay: `${i * 80}ms` }}>
                                <div className="card-header" style={{ background: ['#1a73e8', '#01796f', '#137333', '#e37400', '#8430ce', '#d93025'][i % 6] }}>
                                    <h3>{plan.title}</h3>
                                    <span className="card-subtitle">{plan.subject} • Grade {plan.grade}</span>
                                </div>
                                <div className="card-body">
                                    <div className="lesson-meta">
                                        <span className={`badge badge-${plan.status.toLowerCase()}`}>{plan.status}</span>
                                        <span className="lesson-meta-item">
                                            <span className="material-icons-outlined">person</span>
                                            {plan.teacher?.name}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="empty-state">
                        <span className="material-icons-outlined">auto_stories</span>
                        <h3>No lesson plans yet</h3>
                        <p>{(user?.role === 'TEACHER' || user?.role === 'ADMIN') ? 'Create your first lesson plan!' : 'No lesson plans available.'}</p>
                    </div>
                )}
            </div>
        </>
    );
};

export default Dashboard;
