import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import AiAssistant from '../components/AiTutor';
import api from '../services/api';

const ProcessDashboard = () => {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [daysAdvance, setDaysAdvance] = useState(3);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('overview');
    const [expandedTeacher, setExpandedTeacher] = useState(null);
    const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });

    useEffect(() => { fetchDashboard(); }, [daysAdvance]);

    const fetchDashboard = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/process/dashboard?daysAdvance=${daysAdvance}`);
            setData(res.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const getColor = (rate) => rate >= 80 ? '#059669' : rate >= 50 ? '#d97706' : '#dc2626';
    const getBg = (rate) => rate >= 80 ? '#ecfdf5' : rate >= 50 ? '#fffbeb' : '#fef2f2';

    if (loading || !data) return (
        <><Header title="Process Department" /><div className="app-content"><div className="loading"><div className="spinner" /></div></div></>
    );

    const { summary, teacherReports } = data;

    // Not submitted: teachers with drafts or late plans
    const notSubmitted = teacherReports
        .filter(r => r.stats.late > 0 || r.stats.drafts > 0)
        .sort((a, b) => b.stats.late - a.stats.late);

    // Pending approval: teachers with submitted but not approved
    const pendingApproval = teacherReports
        .filter(r => r.stats.submitted > r.stats.approved)
        .sort((a, b) => (b.stats.submitted - b.stats.approved) - (a.stats.submitted - a.stats.approved));

    // All upcoming plans for calendar
    const allUpcoming = teacherReports.flatMap(r => r.upcoming.map(p => ({ ...p, teacherName: r.teacher.name })));

    // Calendar helpers
    const calDays = [];
    const firstDay = new Date(calMonth.year, calMonth.month, 1);
    const lastDay = new Date(calMonth.year, calMonth.month + 1, 0);
    const startOffset = firstDay.getDay();
    for (let i = 0; i < startOffset; i++) calDays.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) calDays.push(d);

    const getPlansForDay = (day) => {
        if (!day) return [];
        const dateStr = `${calMonth.year}-${String(calMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return allUpcoming.filter(p => {
            if (!p.scheduledDate) return false;
            return new Date(p.scheduledDate).toISOString().split('T')[0] === dateStr;
        });
    };

    const todayDay = new Date().getDate();
    const isCurrentMonth = new Date().getMonth() === calMonth.month && new Date().getFullYear() === calMonth.year;
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const tabs = [
        { key: 'overview', label: 'Overview', icon: 'dashboard' },
        { key: 'not_submitted', label: `Not Submitted (${notSubmitted.length})`, icon: 'warning' },
        { key: 'pending', label: `Pending Approval (${summary.pendingApproval})`, icon: 'pending' },
        { key: 'calendar', label: 'Calendar', icon: 'calendar_month' },
    ];

    return (
        <>
            <Header title="Process Department">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <label style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>Min advance days:</label>
                    <select className="form-select" value={daysAdvance} onChange={e => setDaysAdvance(Number(e.target.value))}
                        style={{ width: 70, padding: '6px 10px' }}>
                        {[1, 2, 3, 5, 7, 10, 14].map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </div>
            </Header>
            <div className="app-content">
                {/* Tabs */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#f3f4f6', borderRadius: 12, padding: 4 }}>
                    {tabs.map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            style={{
                                flex: 1, padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                                background: tab === t.key ? '#fff' : 'transparent',
                                boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                fontWeight: tab === t.key ? 600 : 400, fontSize: 13,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                color: tab === t.key ? '#1a73e8' : '#6b7280', transition: 'all 0.2s'
                            }}>
                            <span className="material-icons-outlined" style={{ fontSize: 18 }}>{t.icon}</span>
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* ===== OVERVIEW TAB ===== */}
                {tab === 'overview' && (
                    <>
                        {/* Summary Stats */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
                            {[
                                { label: 'Total Teachers', value: summary.totalTeachers, icon: 'people', color: '#1a73e8' },
                                { label: 'Total Plans', value: summary.totalPlans, icon: 'description', color: '#6c63ff' },
                                { label: 'Submitted', value: summary.submittedPlans, icon: 'send', color: '#d97706' },
                                { label: 'Approved', value: summary.approvedPlans, icon: 'check_circle', color: '#059669' },
                                { label: 'Pending', value: summary.pendingApproval, icon: 'pending', color: '#f59e0b' },
                                { label: 'Drafts', value: summary.draftPlans, icon: 'edit_note', color: '#6b7280' },
                                { label: 'Overdue', value: summary.overduePlans, icon: 'warning', color: '#dc2626' },
                                { label: 'Compliance', value: `${summary.overallComplianceRate}%`, icon: 'speed', color: getColor(summary.overallComplianceRate) },
                            ].map((stat, i) => (
                                <div key={i} className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 40, height: 40, borderRadius: 10, background: `${stat.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <span className="material-icons-outlined" style={{ color: stat.color, fontSize: 20 }}>{stat.icon}</span>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 20, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                                        <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 500 }}>{stat.label}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Compliance Table */}
                        <div className="card" style={{ overflow: 'hidden' }}>
                            <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb' }}>
                                <h3 style={{ margin: 0, fontSize: 15 }}>Teacher Compliance — Plans must be submitted {daysAdvance} day(s) in advance</h3>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                                            {['Teacher', 'Dept', 'Plans', 'Submitted', 'Approved', 'Drafts', 'Overdue', 'Rate', 'Status'].map(h => (
                                                <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {teacherReports.map(r => (
                                            <tr key={r.teacher.id} style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                                                onClick={() => setExpandedTeacher(expandedTeacher === r.teacher.id ? null : r.teacher.id)}>
                                                <td style={td}><strong>{r.teacher.name}</strong><br /><span style={{ fontSize: 10, color: '#9ca3af' }}>{r.teacher.email}</span></td>
                                                <td style={td}>{r.teacher.department}</td>
                                                <td style={td}>{r.stats.totalPlans}</td>
                                                <td style={td}>{r.stats.submitted}</td>
                                                <td style={{ ...td, color: '#059669', fontWeight: 600 }}>{r.stats.approved}</td>
                                                <td style={td}>{r.stats.drafts}</td>
                                                <td style={td}>{r.stats.late > 0 ? <span style={{ color: '#dc2626', fontWeight: 700 }}>⚠ {r.stats.late}</span> : <span style={{ color: '#059669' }}>✓</span>}</td>
                                                <td style={td}><span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: getBg(r.complianceRate), color: getColor(r.complianceRate) }}>{r.complianceRate}%</span></td>
                                                <td style={td}>{r.stats.late > 0 ? <span style={{ padding: '2px 8px', borderRadius: 8, background: '#fef2f2', color: '#dc2626', fontSize: 10, fontWeight: 600 }}>At Risk</span> : <span style={{ padding: '2px 8px', borderRadius: 8, background: '#ecfdf5', color: '#059669', fontSize: 10, fontWeight: 600 }}>On Track</span>}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}

                {/* ===== NOT SUBMITTED TAB ===== */}
                {tab === 'not_submitted' && (
                    <div>
                        {notSubmitted.length === 0 ? (
                            <div className="empty-state">
                                <span className="material-icons-outlined" style={{ color: '#059669' }}>check_circle</span>
                                <h3>All Clear!</h3>
                                <p>All teachers have submitted their lesson plans on time.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {/* Overdue / Critical */}
                                {notSubmitted.filter(r => r.stats.late > 0).length > 0 && (
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                            <span className="material-icons-outlined" style={{ color: '#dc2626' }}>error</span>
                                            <h3 style={{ margin: 0, color: '#dc2626', fontSize: 15 }}>🚨 Overdue — Class within {daysAdvance} day(s), no plan submitted</h3>
                                        </div>
                                        {notSubmitted.filter(r => r.stats.late > 0).map(r => (
                                            <div key={r.teacher.id} className="card" style={{ padding: 16, marginBottom: 10, borderLeft: '4px solid #dc2626' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                                    <div>
                                                        <strong style={{ fontSize: 15 }}>{r.teacher.name}</strong>
                                                        <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>{r.teacher.email} · {r.teacher.department}</span>
                                                    </div>
                                                    <span style={{ padding: '4px 12px', borderRadius: 10, background: '#fef2f2', color: '#dc2626', fontSize: 12, fontWeight: 700 }}>
                                                        {r.stats.late} overdue
                                                    </span>
                                                </div>
                                                {r.upcoming.filter(p => p.isOverdue).map(p => (
                                                    <div key={p.id} style={{
                                                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                                                        borderRadius: 8, background: '#fef2f2', marginBottom: 6
                                                    }}>
                                                        <span className="material-icons-outlined" style={{ color: '#dc2626', fontSize: 18 }}>warning</span>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontWeight: 600, fontSize: 13 }}>{p.title}</div>
                                                            <div style={{ fontSize: 11, color: '#6b7280' }}>{p.subject} · {p.className}</div>
                                                        </div>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <div style={{ fontSize: 18, fontWeight: 800, color: '#dc2626' }}>{p.daysUntilClass}d</div>
                                                            <div style={{ fontSize: 10, color: '#dc2626' }}>until class</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Teachers with only drafts (not yet critical) */}
                                {notSubmitted.filter(r => r.stats.late === 0 && r.stats.drafts > 0).length > 0 && (
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                            <span className="material-icons-outlined" style={{ color: '#d97706' }}>edit_note</span>
                                            <h3 style={{ margin: 0, color: '#d97706', fontSize: 15 }}>⏳ Still in Draft — Not yet submitted</h3>
                                        </div>
                                        {notSubmitted.filter(r => r.stats.late === 0 && r.stats.drafts > 0).map(r => (
                                            <div key={r.teacher.id} className="card" style={{ padding: 16, marginBottom: 8, borderLeft: '4px solid #d97706' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <strong>{r.teacher.name}</strong>
                                                        <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>{r.teacher.department}</span>
                                                    </div>
                                                    <span style={{ padding: '3px 10px', borderRadius: 10, background: '#fffbeb', color: '#d97706', fontSize: 12, fontWeight: 600 }}>
                                                        {r.stats.drafts} draft{r.stats.drafts > 1 ? 's' : ''}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ===== PENDING APPROVAL TAB ===== */}
                {tab === 'pending' && (
                    <div>
                        {pendingApproval.length === 0 ? (
                            <div className="empty-state">
                                <span className="material-icons-outlined" style={{ color: '#059669' }}>verified</span>
                                <h3>All Reviewed!</h3>
                                <p>No lesson plans are waiting for HOD approval.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {pendingApproval.map(r => {
                                    const waitingPlans = r.upcoming.filter(p => p.status === 'SUBMITTED');
                                    return (
                                        <div key={r.teacher.id} className="card" style={{ padding: 16, borderLeft: '4px solid #f59e0b' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: waitingPlans.length > 0 ? 10 : 0 }}>
                                                <div>
                                                    <strong style={{ fontSize: 15 }}>{r.teacher.name}</strong>
                                                    <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>{r.teacher.department}</span>
                                                </div>
                                                <span style={{ padding: '3px 10px', borderRadius: 10, background: '#fffbeb', color: '#d97706', fontSize: 12, fontWeight: 600 }}>
                                                    {r.stats.submitted - r.stats.approved} awaiting
                                                </span>
                                            </div>
                                            {waitingPlans.map(p => (
                                                <div key={p.id} style={{
                                                    display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
                                                    borderRadius: 8, background: '#fffbeb', marginBottom: 4
                                                }}>
                                                    <span className="material-icons-outlined" style={{ color: '#d97706', fontSize: 16 }}>pending</span>
                                                    <div style={{ flex: 1 }}>
                                                        <span style={{ fontWeight: 500, fontSize: 13 }}>{p.title}</span>
                                                        <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 8 }}>{p.subject} · {p.className}</span>
                                                    </div>
                                                    <span style={{ fontSize: 12, color: '#d97706', fontWeight: 500 }}>{p.daysUntilClass}d away</span>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ===== CALENDAR TAB ===== */}
                {tab === 'calendar' && (
                    <div className="card" style={{ overflow: 'hidden' }}>
                        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <button className="btn-icon" onClick={() => setCalMonth(p => {
                                let m = p.month - 1, y = p.year;
                                if (m < 0) { m = 11; y--; }
                                return { year: y, month: m };
                            })}><span className="material-icons-outlined">chevron_left</span></button>
                            <h3 style={{ margin: 0, fontSize: 16 }}>{monthNames[calMonth.month]} {calMonth.year}</h3>
                            <button className="btn-icon" onClick={() => setCalMonth(p => {
                                let m = p.month + 1, y = p.year;
                                if (m > 11) { m = 0; y++; }
                                return { year: y, month: m };
                            })}><span className="material-icons-outlined">chevron_right</span></button>
                        </div>
                        <div style={{ display: 'flex', gap: 12, padding: '8px 20px', fontSize: 11, color: '#6b7280' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#059669', display: 'inline-block' }} /> Approved</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#d97706', display: 'inline-block' }} /> Submitted</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#9ca3af', display: 'inline-block' }} /> Draft</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#dc2626', display: 'inline-block' }} /> Missing</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                                <div key={d} style={{ padding: '6px 0', textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#6b7280', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>{d}</div>
                            ))}
                            {calDays.map((day, i) => {
                                const plans = day ? getPlansForDay(day) : [];
                                const isT = isCurrentMonth && day === todayDay;
                                const isDayOfWeek = day ? new Date(calMonth.year, calMonth.month, day).getDay() : null;
                                const isSunday = isDayOfWeek === 0;
                                return (
                                    <div key={i} style={{
                                        minHeight: 70, padding: '6px 8px',
                                        borderBottom: '1px solid #f3f4f6', borderRight: '1px solid #f3f4f6',
                                        background: isT ? '#eff6ff' : isSunday ? '#fafafa' : '#fff'
                                    }}>
                                        {day && (
                                            <>
                                                <div style={{ fontSize: 11, fontWeight: isT ? 800 : 400, color: isT ? '#1a73e8' : '#374151', marginBottom: 4 }}>{day}</div>
                                                {plans.map(p => {
                                                    const c = p.status === 'APPROVED' || p.status === 'PUBLISHED' ? '#059669' : p.status === 'SUBMITTED' ? '#d97706' : '#9ca3af';
                                                    return (
                                                        <div key={p.id} style={{ fontSize: 9, padding: '2px 4px', borderRadius: 3, background: `${c}18`, color: c, fontWeight: 600, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {p.teacherName?.split(' ')[0]}: {p.title}
                                                        </div>
                                                    );
                                                })}
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
            <AiAssistant mode="process" />
        </>
    );
};

const td = { padding: '10px 12px', fontSize: 12 };

export default ProcessDashboard;
