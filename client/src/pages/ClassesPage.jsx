import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import apiService from '../services/api';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
function api(p, o = {}) { const t = localStorage.getItem('token'); return fetch(`${API}${p}`, { ...o, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, ...o.headers } }).then(r => r.json()) }

const sectionColors = ['#1a73e8', '#01796f', '#137333', '#e37400', '#8430ce', '#d93025', '#007b83', '#3f51b5', '#e91e63', '#009688'];
const gradeColors = {
    '1': '#e91e63', '2': '#9c27b0', '3': '#673ab7', '4': '#3f51b5', '5': '#2196f3', '6': '#00bcd4',
    '7': '#009688', '8': '#4caf50', '9': '#8bc34a', '10': '#ff9800', '11': '#ff5722', '12': '#795548', 'Ungraded': '#607d8b'
};

const ClassesPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [subjects, setSubjects] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [expandedGrade, setExpandedGrade] = useState(null);
    const [expandedSection, setExpandedSection] = useState(null);

    // Modals
    const [showCreateClass, setShowCreateClass] = useState(false);
    const [showAddSection, setShowAddSection] = useState(null); // grade string
    const [showAddSubject, setShowAddSubject] = useState(null); // { grade, section }
    const [showAssignTeacher, setShowAssignTeacher] = useState(null); // class id
    const [form, setForm] = useState({});
    const [error, setError] = useState('');

    const isAdmin = user?.role === 'ADMIN';
    const isTeacher = user?.role === 'TEACHER';
    const isHod = user?.role === 'HOD';
    const canManage = isAdmin || isTeacher || isHod;

    const fetchClasses = useCallback(async () => {
        try {
            const res = await apiService.get('/classes');
            setClasses(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }, []);

    const fetchMasters = useCallback(async () => {
        try {
            const [subs, tcrs] = await Promise.all([
                api('/admin/subjects'),
                api('/users?role=TEACHER')
            ]);
            setSubjects(Array.isArray(subs) ? subs : []);
            setTeachers(Array.isArray(tcrs) ? tcrs : tcrs.users || []);
        } catch { }
    }, []);

    useEffect(() => { fetchClasses(); fetchMasters(); }, [fetchClasses, fetchMasters]);

    // ── Hierarchy: Grade → Section → Subject cards ──
    const hierarchy = useMemo(() => {
        const gradeMap = {};
        classes.forEach(cls => {
            const grade = cls.grade || 'Ungraded';
            if (!gradeMap[grade]) gradeMap[grade] = {};
            const section = cls.section || 'Default';
            if (!gradeMap[grade][section]) gradeMap[grade][section] = [];
            gradeMap[grade][section].push(cls);
        });

        const sortedGrades = Object.keys(gradeMap).sort((a, b) => {
            const numA = parseInt(a); const numB = parseInt(b);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return a.localeCompare(b);
        });

        return sortedGrades.map(grade => ({
            grade,
            sections: Object.entries(gradeMap[grade]).map(([section, clsList]) => {
                // Separate: classes WITH a subject are real subject-cards;
                // classes WITHOUT a subject are just section placeholders
                const subjectClasses = clsList.filter(c => c.subject && c.subject.trim() !== '');
                return {
                    section,
                    classes: subjectClasses,           // only show real subjects as cards
                    allRecords: clsList,                // keep all for reference
                    totalPlans: subjectClasses.reduce((sum, c) => sum + (c._count?.lessonPlans || 0), 0),
                    totalMembers: clsList.reduce((sum, c) => sum + (c._count?.members || 0), 0),
                };
            }).sort((a, b) => a.section.localeCompare(b.section)),
            totalClasses: Object.values(gradeMap[grade]).reduce((s, arr) =>
                s + arr.filter(c => c.subject && c.subject.trim() !== '').length, 0),
        }));
    }, [classes]);

    // Auto-expand first grade
    useEffect(() => {
        if (hierarchy.length > 0 && expandedGrade === null) {
            setExpandedGrade(hierarchy[0].grade);
            if (hierarchy[0].sections.length > 0) {
                setExpandedSection(`${hierarchy[0].grade}-${hierarchy[0].sections[0].section}`);
            }
        }
    }, [hierarchy]);

    // ── Actions ──
    const handleCreateClass = async (e) => {
        e.preventDefault();
        setError('');
        if (!form.grade || !form.section) { setError('Grade and section are required.'); return; }
        try {
            const name = `${form.grade}${form.section}`;
            await apiService.post('/classes', { name, grade: form.grade, section: form.section });
            setShowCreateClass(false);
            setForm({});
            fetchClasses();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create class.');
        }
    };

    const handleAddSection = async (e) => {
        e.preventDefault();
        setError('');
        if (!form.section) { setError('Section name is required.'); return; }
        try {
            const name = `${showAddSection}${form.section}`;
            await apiService.post('/classes', { name, grade: showAddSection, section: form.section });
            setShowAddSection(null);
            setForm({});
            fetchClasses();
            setExpandedGrade(showAddSection);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to add section.');
        }
    };

    const handleAddSubject = async (e) => {
        e.preventDefault();
        setError('');
        if (!form.subjectId) { setError('Please select a subject.'); return; }
        const subjectObj = subjects.find(s => s.id === form.subjectId);
        const { grade, section } = showAddSubject;
        try {
            const name = `${grade}${section} - ${subjectObj?.name || 'Subject'}`;
            const body = {
                name,
                grade,
                section,
                subject: subjectObj?.name || '',
                coverColor: subjectObj?.color || '#1a73e8',
            };
            if (form.teacherId) body.ownerId = form.teacherId;
            await apiService.post('/classes', body);
            setShowAddSubject(null);
            setForm({});
            fetchClasses();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to add subject.');
        }
    };

    const handleAssignTeacher = async (e) => {
        e.preventDefault();
        setError('');
        if (!form.teacherId) { setError('Please select a teacher.'); return; }
        try {
            await api(`/admin/classes/${showAssignTeacher}`, {
                method: 'PUT',
                body: JSON.stringify({ ownerId: form.teacherId })
            });
            setShowAssignTeacher(null);
            setForm({});
            fetchClasses();
        } catch (err) {
            setError('Failed to assign teacher.');
        }
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Delete "${name}"? This will remove all members, lesson plans, and timetable data.`)) return;
        try {
            await apiService.delete(`/classes/${id}`);
            setClasses(prev => prev.filter(c => c.id !== id));
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to delete class.');
        }
    };

    // ── Modal Component ──
    const ModalOverlay = ({ show, onClose, title, onSubmit, children }) => {
        if (!show) return null;
        return (
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
                    <div className="modal-header">
                        <h2 style={{ fontSize: 18 }}>{title}</h2>
                        <button className="btn-icon" onClick={onClose}>
                            <span className="material-icons-outlined">close</span>
                        </button>
                    </div>
                    <form onSubmit={onSubmit}>
                        <div className="modal-body">
                            {error && <div className="auth-error">{error}</div>}
                            {children}
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                            <button type="submit" className="btn btn-primary">Save</button>
                        </div>
                    </form>
                </div>
            </div>
        );
    };

    return (
        <>
            <Header title="Classes">
                {canManage && (
                    <button className="btn btn-primary" onClick={() => { setShowCreateClass(true); setForm({}); setError(''); }} id="create-class-btn">
                        <span className="material-icons-outlined">add</span>
                        New Grade / Section
                    </button>
                )}
            </Header>
            <div className="app-content">

                {/* ═══ CREATE CLASS MODAL (Grade + Section) ═══ */}
                <ModalOverlay show={showCreateClass} onClose={() => setShowCreateClass(false)} title="New Grade & Section" onSubmit={handleCreateClass}>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Grade *</label>
                            <select className="form-select" value={form.grade || ''} onChange={e => setForm({ ...form, grade: e.target.value })} required>
                                <option value="">Select grade</option>
                                {[...Array(12)].map((_, i) => <option key={i + 1} value={String(i + 1)}>{i + 1}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Section *</label>
                            <input type="text" className="form-input" placeholder="e.g., A, B, C" value={form.section || ''}
                                onChange={e => setForm({ ...form, section: e.target.value })} required />
                        </div>
                    </div>
                    <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
                        This creates a class section. You can then add subjects inside it.
                    </p>
                </ModalOverlay>

                {/* ═══ ADD SECTION MODAL ═══ */}
                <ModalOverlay show={!!showAddSection} onClose={() => setShowAddSection(null)} title={`Add Section to Grade ${showAddSection}`} onSubmit={handleAddSection}>
                    <div className="form-group">
                        <label className="form-label">Section Name *</label>
                        <input type="text" className="form-input" placeholder="e.g., A, B, C, D" value={form.section || ''}
                            onChange={e => setForm({ ...form, section: e.target.value })} required />
                    </div>
                </ModalOverlay>

                {/* ═══ ADD SUBJECT MODAL ═══ */}
                <ModalOverlay show={!!showAddSubject} onClose={() => setShowAddSubject(null)}
                    title={`Add Subject to ${showAddSubject?.grade || ''}${showAddSubject?.section || ''}`}
                    onSubmit={handleAddSubject}>
                    <div className="form-group">
                        <label className="form-label">Subject *</label>
                        <select className="form-select" value={form.subjectId || ''} onChange={e => setForm({ ...form, subjectId: e.target.value })} required>
                            <option value="">Select subject</option>
                            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Assign Teacher (optional)</label>
                        <select className="form-select" value={form.teacherId || ''} onChange={e => setForm({ ...form, teacherId: e.target.value })}>
                            <option value="">Select teacher</option>
                            {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                </ModalOverlay>

                {/* ═══ ASSIGN TEACHER MODAL ═══ */}
                <ModalOverlay show={!!showAssignTeacher} onClose={() => setShowAssignTeacher(null)} title="Assign Teacher" onSubmit={handleAssignTeacher}>
                    <div className="form-group">
                        <label className="form-label">Teacher *</label>
                        <select className="form-select" value={form.teacherId || ''} onChange={e => setForm({ ...form, teacherId: e.target.value })} required>
                            <option value="">Select teacher</option>
                            {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                </ModalOverlay>

                {/* ═══ GRADES LIST ═══ */}
                {loading ? (
                    <div className="loading"><div className="spinner"></div></div>
                ) : hierarchy.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {hierarchy.map(({ grade, sections, totalClasses }) => {
                            const isExpanded = expandedGrade === grade;
                            const color = gradeColors[grade] || '#607d8b';

                            return (
                                <div key={grade} className="card animate-in" style={{ overflow: 'hidden' }}>
                                    {/* ─── Grade Header ─── */}
                                    <div
                                        onClick={() => setExpandedGrade(isExpanded ? null : grade)}
                                        style={{
                                            padding: '14px 20px', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            background: isExpanded ? `${color}08` : 'transparent',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div style={{
                                                width: 44, height: 44, borderRadius: 12,
                                                background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: '#fff', fontWeight: 800, fontSize: 16
                                            }}>
                                                {grade}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: 16, color: '#1f2937' }}>Grade {grade}</div>
                                                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                                                    {sections.length} section{sections.length !== 1 ? 's' : ''}
                                                    {' · '}
                                                    {totalClasses} subject{totalClasses !== 1 ? 's' : ''}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            {!isExpanded && (
                                                <div style={{ display: 'flex', gap: 5 }}>
                                                    {sections.slice(0, 5).map((s, i) => (
                                                        <span key={s.section} style={{
                                                            padding: '3px 10px', borderRadius: 16, fontSize: 11, fontWeight: 600,
                                                            background: `${sectionColors[i % sectionColors.length]}14`,
                                                            color: sectionColors[i % sectionColors.length]
                                                        }}>
                                                            {s.section}
                                                        </span>
                                                    ))}
                                                    {sections.length > 5 && <span style={{ fontSize: 11, color: '#94a3b8' }}>+{sections.length - 5}</span>}
                                                </div>
                                            )}
                                            <span className="material-icons-outlined" style={{
                                                color: '#9ca3af', fontSize: 22,
                                                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                                transition: 'transform 0.2s'
                                            }}>expand_more</span>
                                        </div>
                                    </div>

                                    {/* ─── Sections (expanded grade) ─── */}
                                    {isExpanded && (
                                        <div style={{ padding: '0 16px 16px' }}>
                                            {sections.map((sec, si) => {
                                                const secKey = `${grade}-${sec.section}`;
                                                const secExpanded = expandedSection === secKey;
                                                const secColor = sectionColors[si % sectionColors.length];

                                                return (
                                                    <div key={secKey} style={{
                                                        border: '1px solid #e5e7eb', borderRadius: 12,
                                                        marginBottom: 10, overflow: 'hidden'
                                                    }}>
                                                        {/* Section Header */}
                                                        <div
                                                            onClick={() => setExpandedSection(secExpanded ? null : secKey)}
                                                            style={{
                                                                padding: '10px 16px', cursor: 'pointer',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                                background: secExpanded ? `${secColor}08` : '#fafbfc',
                                                                transition: 'all 0.15s'
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                                <div style={{
                                                                    width: 34, height: 34, borderRadius: 8,
                                                                    background: `linear-gradient(135deg, ${secColor}, ${secColor}bb)`,
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    color: '#fff', fontWeight: 800, fontSize: 13
                                                                }}>
                                                                    {sec.section}
                                                                </div>
                                                                <div>
                                                                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1f2937' }}>
                                                                        Section {sec.section}
                                                                    </div>
                                                                    <div style={{ fontSize: 11, color: '#6b7280' }}>
                                                                        {sec.classes.length} subject{sec.classes.length !== 1 ? 's' : ''}
                                                                        {' · '}
                                                                        {sec.totalPlans} plan{sec.totalPlans !== 1 ? 's' : ''}
                                                                        {' · '}
                                                                        {sec.totalMembers} student{sec.totalMembers !== 1 ? 's' : ''}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <span className="material-icons-outlined" style={{
                                                                color: '#9ca3af', fontSize: 18,
                                                                transform: secExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                                                transition: 'transform 0.2s'
                                                            }}>expand_more</span>
                                                        </div>

                                                        {/* Subject Cards inside section */}
                                                        {secExpanded && (
                                                            <div style={{ padding: '10px 14px', background: '#fafbfc' }}>
                                                                <div style={{
                                                                    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10,
                                                                }}>
                                                                    {sec.classes.map((cls) => (
                                                                        <div key={cls.id} className="animate-in" style={{
                                                                            border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden',
                                                                            background: '#fff', transition: 'all 0.15s'
                                                                        }}>
                                                                            <div style={{ height: 4, background: cls.coverColor || secColor }} />
                                                                            <div style={{ padding: '10px 14px' }}>
                                                                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                                                                                    <div style={{ cursor: 'pointer', flex: 1 }} onClick={() => navigate(`/classes/${cls.id}`)}>
                                                                                        <div style={{ fontWeight: 700, fontSize: 14, color: '#1f2937' }}>
                                                                                            {cls.subject || cls.name}
                                                                                        </div>
                                                                                    </div>
                                                                                    <div style={{ display: 'flex', gap: 2 }}>
                                                                                        {/* Assign Teacher */}
                                                                                        {canManage && (
                                                                                            <button
                                                                                                onClick={e => { e.stopPropagation(); setShowAssignTeacher(cls.id); setForm({ teacherId: cls.ownerId || '' }); setError(''); }}
                                                                                                title="Assign teacher"
                                                                                                style={S.iconBtn}
                                                                                                onMouseOver={e => e.currentTarget.style.color = '#4f46e5'}
                                                                                                onMouseOut={e => e.currentTarget.style.color = '#d1d5db'}
                                                                                            >
                                                                                                <span className="material-icons-outlined" style={{ fontSize: 16 }}>person_add</span>
                                                                                            </button>
                                                                                        )}
                                                                                        {/* Delete */}
                                                                                        {isAdmin && (
                                                                                            <button
                                                                                                onClick={e => { e.stopPropagation(); handleDelete(cls.id, cls.subject || cls.name); }}
                                                                                                title="Delete"
                                                                                                style={S.iconBtn}
                                                                                                onMouseOver={e => e.currentTarget.style.color = '#dc2626'}
                                                                                                onMouseOut={e => e.currentTarget.style.color = '#d1d5db'}
                                                                                            >
                                                                                                <span className="material-icons-outlined" style={{ fontSize: 16 }}>delete</span>
                                                                                            </button>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                                {/* Teacher */}
                                                                                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                                    <span className="material-icons-outlined" style={{ fontSize: 14 }}>person</span>
                                                                                    {cls.owner?.name || <em style={{ color: '#d1d5db' }}>No teacher assigned</em>}
                                                                                </div>
                                                                                {/* Stats */}
                                                                                <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: '#6b7280' }}>
                                                                                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                                                                        <span className="material-icons-outlined" style={{ fontSize: 13 }}>people</span>
                                                                                        {cls._count?.members || 0}
                                                                                    </span>
                                                                                    <span style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', color: '#4f46e5', fontWeight: 600 }}
                                                                                        onClick={() => navigate(`/classes/${cls.id}`)}>
                                                                                        <span className="material-icons-outlined" style={{ fontSize: 13 }}>auto_stories</span>
                                                                                        {cls._count?.lessonPlans || 0} plans →
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    ))}

                                                                    {/* ＋ Add Subject Card */}
                                                                    {canManage && (
                                                                        <div
                                                                            onClick={() => { setShowAddSubject({ grade, section: sec.section }); setForm({}); setError(''); }}
                                                                            style={{
                                                                                border: '2px dashed #d1d5db', borderRadius: 10,
                                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                                gap: 6, padding: 20, cursor: 'pointer', color: '#94a3b8',
                                                                                fontSize: 13, fontWeight: 600, minHeight: 80,
                                                                                transition: 'all 0.15s'
                                                                            }}
                                                                            onMouseOver={e => { e.currentTarget.style.borderColor = '#4f46e5'; e.currentTarget.style.color = '#4f46e5'; }}
                                                                            onMouseOut={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#94a3b8'; }}
                                                                        >
                                                                            <span className="material-icons-outlined" style={{ fontSize: 20 }}>add</span>
                                                                            Add Subject
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}

                                            {/* ＋ Add Section Button */}
                                            {canManage && (
                                                <button
                                                    onClick={e => { e.stopPropagation(); setShowAddSection(grade); setForm({}); setError(''); }}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
                                                        border: '2px dashed #d1d5db', borderRadius: 10, background: 'transparent',
                                                        cursor: 'pointer', color: '#94a3b8', fontSize: 13, fontWeight: 600,
                                                        width: '100%', justifyContent: 'center', transition: 'all 0.15s'
                                                    }}
                                                    onMouseOver={e => { e.currentTarget.style.borderColor = '#4f46e5'; e.currentTarget.style.color = '#4f46e5'; }}
                                                    onMouseOut={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#94a3b8'; }}
                                                >
                                                    <span className="material-icons-outlined" style={{ fontSize: 18 }}>add</span>
                                                    Add Section to Grade {grade}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="empty-state">
                        <span className="material-icons-outlined">school</span>
                        <h3>No classes yet</h3>
                        <p>{canManage ? 'Click "New Grade / Section" to get started.' : "You haven't been enrolled in any classes yet."}</p>
                    </div>
                )}
            </div>
        </>
    );
};

const S = {
    iconBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: 2, transition: 'color 0.15s' },
};

export default ClassesPage;
