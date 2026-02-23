import { useState, useEffect } from 'react';
import Header from '../components/Header';
import api from '../services/api';

const AdminManagement = () => {
    const [tab, setTab] = useState('mapping');
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);

    // Breadcrumb state for drill-down
    const [drillGrade, setDrillGrade] = useState(null);
    const [drillSection, setDrillSection] = useState(null);

    // Data
    const [classes, setClasses] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [hods, setHods] = useState([]);
    const [assignments, setAssignments] = useState([]);

    // Forms
    const [subjectForm, setSubjectForm] = useState({ name: '', code: '' });
    const [classForm, setClassForm] = useState({ name: '', section: '', grade: '', subject: '', coverColor: '#1a73e8' });
    const [assignForm, setAssignForm] = useState({ teacherId: '', classId: '', subjectId: '' });

    const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

    useEffect(() => { loadAll(); }, []);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [c, s, t, h, a] = await Promise.all([
                api.get('/classes'),
                api.get('/admin/subjects'),
                api.get('/admin/teachers'),
                api.get('/admin/hods'),
                api.get('/admin/assignments')
            ]);
            setClasses(c.data);
            setSubjects(s.data);
            setTeachers(t.data);
            setHods(h.data);
            setAssignments(a.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    // Group classes by grade
    const gradeGroups = {};
    classes.forEach(cls => {
        const g = cls.grade || 'Other';
        if (!gradeGroups[g]) gradeGroups[g] = [];
        gradeGroups[g].push(cls);
    });
    const sortedGrades = Object.keys(gradeGroups).sort((a, b) => {
        const na = parseInt(a), nb = parseInt(b);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return a.localeCompare(b);
    });

    // Get assignments for a specific class
    const getClassAssignments = (classId) => assignments.filter(a => a.classId === classId);

    // Handlers
    const handleCreateSubject = async (e) => {
        e.preventDefault();
        try {
            await api.post('/admin/subjects', subjectForm);
            setSubjectForm({ name: '', code: '' });
            showToast('Subject created!');
            loadAll();
        } catch (err) { showToast(err.response?.data?.error || 'Failed', 'error'); }
    };

    const handleDeleteSubject = async (id) => {
        if (!confirm('Delete this subject?')) return;
        try { await api.delete(`/admin/subjects/${id}`); showToast('Deleted!'); loadAll(); }
        catch { showToast('Failed to delete.', 'error'); }
    };

    const handleCreateClass = async (e) => {
        e.preventDefault();
        try {
            await api.post('/classes', classForm);
            setClassForm({ name: '', section: '', grade: '', subject: '', coverColor: '#1a73e8' });
            showToast('Class created!');
            loadAll();
        } catch (err) { showToast(err.response?.data?.error || 'Failed', 'error'); }
    };

    const handleAssignTeacher = async (e) => {
        e.preventDefault();
        try {
            await api.post('/admin/assignments', assignForm);
            setAssignForm({ teacherId: '', classId: '', subjectId: '' });
            showToast('Teacher assigned!');
            loadAll();
        } catch (err) { showToast(err.response?.data?.error || 'Failed', 'error'); }
    };

    const handleDeleteAssignment = async (id) => {
        try { await api.delete(`/admin/assignments/${id}`); showToast('Removed!'); loadAll(); }
        catch { showToast('Failed', 'error'); }
    };

    const gradeColors = {
        '1': '#e91e63', '2': '#9c27b0', '3': '#673ab7', '4': '#3f51b5',
        '5': '#2196f3', '6': '#00bcd4', '7': '#009688', '8': '#4caf50',
        '9': '#8bc34a', '10': '#ff9800', '11': '#ff5722', '12': '#795548'
    };

    const tabs = [
        { key: 'mapping', label: 'Teacher Mapping', icon: 'link' },
        { key: 'subjects', label: 'Subjects', icon: 'menu_book' },
        { key: 'classes', label: 'Classes & Sections', icon: 'class' },
        { key: 'grades', label: 'Grades', icon: 'grade' },
    ];

    if (loading) return (
        <><Header title="Admin Management" /><div className="app-content"><div className="loading"><div className="spinner" /></div></div></>
    );

    return (
        <>
            {toast && (
                <div style={{
                    position: 'fixed', top: 24, right: 24, zIndex: 9999,
                    background: toast.type === 'error' ? '#dc2626' : '#059669',
                    color: '#fff', padding: '12px 20px', borderRadius: 10,
                    boxShadow: '0 4px 24px rgba(0,0,0,0.15)', display: 'flex',
                    alignItems: 'center', gap: 8, fontWeight: 500
                }}>
                    <span className="material-icons-outlined" style={{ fontSize: 18 }}>
                        {toast.type === 'error' ? 'error' : 'check_circle'}
                    </span>
                    {toast.msg}
                </div>
            )}

            <Header title="Admin Management" />
            <div className="app-content">
                {/* Tabs */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#f3f4f6', borderRadius: 12, padding: 4 }}>
                    {tabs.map(t => (
                        <button key={t.key} onClick={() => { setTab(t.key); setDrillGrade(null); setDrillSection(null); }}
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

                {/* ===== TEACHER MAPPING — BREADCRUMB DRILL-DOWN ===== */}
                {tab === 'mapping' && (
                    <div>
                        {/* Breadcrumb */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 20, fontSize: 14 }}>
                            <button onClick={() => { setDrillGrade(null); setDrillSection(null); }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: !drillGrade ? 700 : 400, color: '#1a73e8', fontSize: 14 }}>
                                All Grades
                            </button>
                            {drillGrade && (
                                <>
                                    <span className="material-icons-outlined" style={{ fontSize: 16, color: '#9ca3af' }}>chevron_right</span>
                                    <button onClick={() => setDrillSection(null)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: !drillSection ? 700 : 400, color: '#1a73e8', fontSize: 14 }}>
                                        Grade {drillGrade}
                                    </button>
                                </>
                            )}
                            {drillSection && (
                                <>
                                    <span className="material-icons-outlined" style={{ fontSize: 16, color: '#9ca3af' }}>chevron_right</span>
                                    <span style={{ fontWeight: 700, color: '#374151' }}>Section {drillSection.section || drillSection.name}</span>
                                </>
                            )}
                        </div>

                        {/* Level 1: All Grades */}
                        {!drillGrade && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
                                {sortedGrades.map(grade => {
                                    const sections = gradeGroups[grade];
                                    const color = gradeColors[grade] || '#1a73e8';
                                    return (
                                        <div key={grade} className="card" onClick={() => setDrillGrade(grade)}
                                            style={{ cursor: 'pointer', transition: 'all 0.2s', overflow: 'hidden' }}>
                                            <div style={{
                                                padding: '20px', background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                                                color: '#fff', textAlign: 'center'
                                            }}>
                                                <div style={{ fontSize: 32, fontWeight: 800 }}>{grade}</div>
                                                <div style={{ fontSize: 13, opacity: 0.9 }}>Grade {grade}</div>
                                            </div>
                                            <div style={{ padding: '12px 16px' }}>
                                                <div style={{ fontSize: 12, color: '#6b7280' }}>
                                                    {sections.length} section{sections.length !== 1 ? 's' : ''}
                                                    {' · '}
                                                    {sections.reduce((sum, s) => sum + getClassAssignments(s.id).length, 0)} teacher{sections.reduce((sum, s) => sum + getClassAssignments(s.id).length, 0) !== 1 ? 's' : ''} assigned
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Level 2: Sections within a grade */}
                        {drillGrade && !drillSection && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                                {(gradeGroups[drillGrade] || []).map(cls => {
                                    const classAssign = getClassAssignments(cls.id);
                                    return (
                                        <div key={cls.id} className="card" onClick={() => setDrillSection(cls)}
                                            style={{ cursor: 'pointer', transition: 'all 0.2s', overflow: 'hidden' }}>
                                            <div style={{
                                                padding: '16px 20px',
                                                background: `linear-gradient(135deg, ${cls.coverColor || '#1a73e8'}, ${cls.coverColor || '#1a73e8'}cc)`,
                                                color: '#fff'
                                            }}>
                                                <div style={{ fontWeight: 700, fontSize: 18 }}>Section {cls.section || '—'}</div>
                                                <div style={{ fontSize: 12, opacity: 0.85 }}>{cls.subject || cls.name}</div>
                                            </div>
                                            <div style={{ padding: '12px 16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#4b5563', marginBottom: 4 }}>
                                                    <span className="material-icons-outlined" style={{ fontSize: 16 }}>person</span>
                                                    Owner: {cls.owner?.name || '—'}
                                                </div>
                                                <div style={{ fontSize: 12, color: '#6b7280' }}>
                                                    {classAssign.length} teacher(s) mapped
                                                </div>
                                                {classAssign.length > 0 && (
                                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                                                        {classAssign.map(a => (
                                                            <span key={a.id} style={{
                                                                padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 600,
                                                                background: '#eff6ff', color: '#1a73e8'
                                                            }}>{a.teacher?.name?.split(' ')[0]} · {a.subject?.name}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Level 3: Teachers & subjects for a specific section */}
                        {drillSection && (
                            <div>
                                <div className="card" style={{ overflow: 'hidden' }}>
                                    <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                                        <h3 style={{ margin: 0, fontSize: 15 }}>
                                            Teacher-Subject Mappings for {drillSection.name} (Section {drillSection.section})
                                        </h3>
                                    </div>

                                    {/* Existing assignments */}
                                    <div style={{ padding: '16px 20px' }}>
                                        {getClassAssignments(drillSection.id).length === 0 ? (
                                            <div style={{ textAlign: 'center', padding: 20, color: '#9ca3af' }}>No teachers assigned yet.</div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                                                {getClassAssignments(drillSection.id).map(a => (
                                                    <div key={a.id} style={{
                                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                        padding: '10px 14px', borderRadius: 8, border: '1px solid #e5e7eb'
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                            <div style={{
                                                                width: 36, height: 36, borderRadius: 10, background: '#1a73e815',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                            }}>
                                                                <span className="material-icons-outlined" style={{ fontSize: 18, color: '#1a73e8' }}>person</span>
                                                            </div>
                                                            <div>
                                                                <div style={{ fontWeight: 600, fontSize: 13 }}>{a.teacher?.name}</div>
                                                                <div style={{ fontSize: 11, color: '#6b7280' }}>{a.subject?.name || 'No subject'}</div>
                                                            </div>
                                                        </div>
                                                        <button className="btn-icon" onClick={() => handleDeleteAssignment(a.id)} title="Remove">
                                                            <span className="material-icons-outlined" style={{ fontSize: 18, color: '#dc2626' }}>delete</span>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Add new assignment */}
                                        <form onSubmit={(e) => {
                                            e.preventDefault();
                                            assignForm.classId = drillSection.id;
                                            handleAssignTeacher(e);
                                        }} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                            <div className="form-group" style={{ flex: 1, minWidth: 150, marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: 11 }}>Teacher</label>
                                                <select className="form-select" value={assignForm.teacherId}
                                                    onChange={e => setAssignForm({ ...assignForm, teacherId: e.target.value })} required>
                                                    <option value="">Select teacher</option>
                                                    {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="form-group" style={{ flex: 1, minWidth: 150, marginBottom: 0 }}>
                                                <label className="form-label" style={{ fontSize: 11 }}>Subject</label>
                                                <select className="form-select" value={assignForm.subjectId}
                                                    onChange={e => setAssignForm({ ...assignForm, subjectId: e.target.value })} required>
                                                    <option value="">Select subject</option>
                                                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                </select>
                                            </div>
                                            <button type="submit" className="btn btn-primary" style={{ height: 38 }}>
                                                <span className="material-icons-outlined" style={{ fontSize: 16 }}>add</span> Assign
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ===== SUBJECTS TAB ===== */}
                {tab === 'subjects' && (
                    <div>
                        <form onSubmit={handleCreateSubject} className="card" style={{ padding: 20, marginBottom: 16, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <div className="form-group" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
                                <label className="form-label">Subject Name *</label>
                                <input type="text" className="form-input" value={subjectForm.name} placeholder="e.g., Mathematics"
                                    onChange={e => setSubjectForm({ ...subjectForm, name: e.target.value })} required />
                            </div>
                            <div className="form-group" style={{ width: 120, marginBottom: 0 }}>
                                <label className="form-label">Code</label>
                                <input type="text" className="form-input" value={subjectForm.code} placeholder="e.g., MATH"
                                    onChange={e => setSubjectForm({ ...subjectForm, code: e.target.value })} />
                            </div>
                            <button type="submit" className="btn btn-primary" style={{ height: 38 }}>
                                <span className="material-icons-outlined" style={{ fontSize: 16 }}>add</span> Add Subject
                            </button>
                        </form>

                        <div className="card" style={{ overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                                        <th style={th}>Subject</th>
                                        <th style={th}>Code</th>
                                        <th style={th}>Department</th>
                                        <th style={{ ...th, width: 60 }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {subjects.map(s => (
                                        <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                            <td style={td}><strong>{s.name}</strong></td>
                                            <td style={td}>{s.code || '—'}</td>
                                            <td style={td}>{s.department?.name || '—'}</td>
                                            <td style={td}>
                                                <button className="btn-icon" onClick={() => handleDeleteSubject(s.id)}>
                                                    <span className="material-icons-outlined" style={{ fontSize: 16, color: '#dc2626' }}>delete</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {subjects.length === 0 && <div style={{ textAlign: 'center', padding: 30, color: '#9ca3af' }}>No subjects yet.</div>}
                        </div>
                    </div>
                )}

                {/* ===== CLASSES & SECTIONS TAB ===== */}
                {tab === 'classes' && (
                    <div>
                        <form onSubmit={handleCreateClass} className="card" style={{ padding: 20, marginBottom: 16 }}>
                            <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>Create New Class</h3>
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                <div className="form-group" style={{ flex: 1, minWidth: 160, marginBottom: 0 }}>
                                    <label className="form-label">Name *</label>
                                    <input type="text" className="form-input" value={classForm.name} placeholder="e.g., Class 9A"
                                        onChange={e => setClassForm({ ...classForm, name: e.target.value })} required />
                                </div>
                                <div className="form-group" style={{ width: 100, marginBottom: 0 }}>
                                    <label className="form-label">Grade *</label>
                                    <select className="form-select" value={classForm.grade}
                                        onChange={e => setClassForm({ ...classForm, grade: e.target.value })} required>
                                        <option value="">-</option>
                                        {[...Array(12)].map((_, i) => <option key={i + 1} value={String(i + 1)}>{i + 1}</option>)}
                                    </select>
                                </div>
                                <div className="form-group" style={{ width: 100, marginBottom: 0 }}>
                                    <label className="form-label">Section *</label>
                                    <input type="text" className="form-input" value={classForm.section} placeholder="A"
                                        onChange={e => setClassForm({ ...classForm, section: e.target.value })} required />
                                </div>
                                <div className="form-group" style={{ flex: 1, minWidth: 130, marginBottom: 0 }}>
                                    <label className="form-label">Subject</label>
                                    <input type="text" className="form-input" value={classForm.subject} placeholder="Mathematics"
                                        onChange={e => setClassForm({ ...classForm, subject: e.target.value })} />
                                </div>
                                <button type="submit" className="btn btn-primary" style={{ height: 38 }}>
                                    <span className="material-icons-outlined" style={{ fontSize: 16 }}>add</span> Create
                                </button>
                            </div>
                        </form>

                        {/* Existing classes grouped by grade */}
                        {sortedGrades.map(grade => (
                            <div key={grade} style={{ marginBottom: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingBottom: 6, borderBottom: '2px solid #e5e7eb' }}>
                                    <div style={{
                                        width: 28, height: 28, borderRadius: 8,
                                        background: gradeColors[grade] || '#1a73e8',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: '#fff', fontWeight: 700, fontSize: 13
                                    }}>{grade}</div>
                                    <h3 style={{ margin: 0, fontSize: 14 }}>Grade {grade}</h3>
                                    <span style={{ fontSize: 11, color: '#6b7280' }}>{gradeGroups[grade].length} sections</span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 10 }}>
                                    {gradeGroups[grade].map(cls => (
                                        <div key={cls.id} className="card" style={{ padding: '14px 18px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: 14 }}>{cls.name}</div>
                                                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                                                        Section {cls.section || '—'} · {cls.subject || 'No subject'}
                                                    </div>
                                                </div>
                                                <div style={{
                                                    width: 32, height: 32, borderRadius: 8, background: cls.coverColor || '#1a73e8'
                                                }} />
                                            </div>
                                            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
                                                Owner: {cls.owner?.name || '—'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ===== GRADES TAB ===== */}
                {tab === 'grades' && (
                    <div>
                        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
                            <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>Available Grades</h3>
                            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px' }}>
                                Grades are derived from your existing classes. Create classes with the desired grade to add new grades.
                            </p>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
                            {sortedGrades.map(grade => {
                                const sections = gradeGroups[grade];
                                const color = gradeColors[grade] || '#1a73e8';
                                const totalTeachers = sections.reduce((sum, s) => sum + getClassAssignments(s.id).length, 0);
                                const totalPlans = sections.reduce((sum, s) => sum + (s._count?.lessonPlans || 0), 0);
                                return (
                                    <div key={grade} className="card" style={{ textAlign: 'center', overflow: 'hidden' }}>
                                        <div style={{
                                            padding: '20px', background: `linear-gradient(135deg, ${color}, ${color}cc)`, color: '#fff'
                                        }}>
                                            <div style={{ fontSize: 36, fontWeight: 800 }}>{grade}</div>
                                        </div>
                                        <div style={{ padding: '12px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: 11, color: '#6b7280' }}>
                                                <div><div style={{ fontWeight: 700, fontSize: 16, color: '#374151' }}>{sections.length}</div>Sections</div>
                                                <div><div style={{ fontWeight: 700, fontSize: 16, color: '#374151' }}>{totalTeachers}</div>Teachers</div>
                                                <div><div style={{ fontWeight: 700, fontSize: 16, color: '#374151' }}>{totalPlans}</div>Plans</div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {sortedGrades.length === 0 && (
                            <div className="empty-state">
                                <span className="material-icons-outlined">school</span>
                                <h3>No grades yet</h3>
                                <p>Create classes with grade numbers to see them here.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
};

const th = { textAlign: 'left', padding: '10px 14px', fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' };
const td = { padding: '10px 14px', fontSize: 13 };

export default AdminManagement;
