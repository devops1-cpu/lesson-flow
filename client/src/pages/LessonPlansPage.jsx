import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import api from '../services/api';

const gradeColors = {
    '1': '#e91e63', '2': '#9c27b0', '3': '#673ab7', '4': '#3f51b5', '5': '#2196f3', '6': '#00bcd4',
    '7': '#009688', '8': '#4caf50', '9': '#8bc34a', '10': '#ff9800', '11': '#ff5722', '12': '#795548',
};
const sectionColors = ['#1a73e8', '#01796f', '#137333', '#e37400', '#8430ce', '#d93025', '#007b83', '#3f51b5', '#e91e63', '#009688'];
const subjectColors = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0d9488', '#2563eb', '#c026d3', '#ea580c'];

const LessonPlansPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [classes, setClasses] = useState([]);
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('all');
    const [search, setSearch] = useState('');

    // Breadcrumb state
    const [selectedGrade, setSelectedGrade] = useState(null);
    const [selectedSection, setSelectedSection] = useState(null);
    const [selectedSubject, setSelectedSubject] = useState(null); // { classId, subject }

    const canCreate = user?.role === 'TEACHER' || user?.role === 'ADMIN' || user?.role === 'HOD';

    const fetchData = useCallback(async () => {
        try {
            const [classRes, planRes] = await Promise.all([
                api.get('/classes'),
                api.get('/lesson-plans')
            ]);
            setClasses(classRes.data);
            setPlans(planRes.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ── Build hierarchy from classes ──
    const hierarchy = useMemo(() => {
        const gradeMap = {};
        classes.forEach(cls => {
            const grade = cls.grade || 'Ungraded';
            if (!gradeMap[grade]) gradeMap[grade] = {};
            const section = cls.section || 'Default';
            if (!gradeMap[grade][section]) gradeMap[grade][section] = [];
            // Only include classes that have subjects (not placeholders)
            if (cls.subject && cls.subject.trim()) {
                gradeMap[grade][section].push(cls);
            } else if (!gradeMap[grade][section].length) {
                // Ensure the section exists even with only placeholders
                gradeMap[grade][section] = gradeMap[grade][section];
            }
        });

        const sortedGrades = Object.keys(gradeMap).sort((a, b) => {
            const numA = parseInt(a), numB = parseInt(b);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return a.localeCompare(b);
        });

        return sortedGrades.map(grade => ({
            grade,
            sections: Object.entries(gradeMap[grade]).map(([section, clsList]) => ({
                section,
                subjects: clsList, // classes with subjects
            })).sort((a, b) => a.section.localeCompare(b.section)),
        }));
    }, [classes]);

    // ── Get plans for a specific class OR global search ──
    const getPlansForClass = useCallback((classId) => {
        // If classId is null, we are doing a global search and returning all matching plans
        let filtered = classId ? plans.filter(p => p.classId === classId) : plans;
        if (statusFilter !== 'all') filtered = filtered.filter(p => p.status === statusFilter.toUpperCase());
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            filtered = filtered.filter(p =>
                p.title?.toLowerCase().includes(q) ||
                p.subject?.toLowerCase().includes(q) ||
                p.teacher?.name?.toLowerCase().includes(q)
            );
        }
        return filtered;
    }, [plans, statusFilter, search]);

    // ── Count plans for a grade ──
    const countPlansForGrade = useCallback((grade) => {
        return plans.filter(p => (p.grade === grade || p.class?.grade === grade)).length;
    }, [plans]);

    // ── Count plans for a section ──
    const countPlansForSection = useCallback((grade, section) => {
        return plans.filter(p => {
            const pg = p.grade || p.class?.grade;
            const ps = p.class?.section;
            return pg === grade && ps === section;
        }).length;
    }, [plans]);

    // ── Current view data ──
    const currentGradeData = hierarchy.find(h => h.grade === selectedGrade);
    const currentSectionData = currentGradeData?.sections.find(s => s.section === selectedSection);
    const currentSubjectCls = currentSectionData?.subjects.find(c => c.id === selectedSubject?.classId);
    const currentPlans = selectedSubject ? getPlansForClass(selectedSubject.classId) : [];

    // ── Navigation handlers ──
    const goToGrades = () => { setSelectedGrade(null); setSelectedSection(null); setSelectedSubject(null); };
    const goToGrade = (grade) => { setSelectedGrade(grade); setSelectedSection(null); setSelectedSubject(null); };
    const goToSection = (section) => { setSelectedSection(section); setSelectedSubject(null); };
    const goToSubject = (cls) => { setSelectedSubject({ classId: cls.id, subject: cls.subject }); };

    const handleDelete = async (e, planId) => {
        e.stopPropagation();
        if (!confirm('Delete this lesson plan?')) return;
        try {
            await api.delete(`/lesson-plans/${planId}`);
            setPlans(prev => prev.filter(p => p.id !== planId));
        } catch (err) { console.error('Delete failed:', err); }
    };

    const statusFilters = ['all', 'draft', 'submitted', 'approved', 'published'];

    // ── Breadcrumb ──
    const Breadcrumb = () => (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6b7280',
            marginBottom: 16, flexWrap: 'wrap'
        }}>
            <button onClick={goToGrades} style={{
                background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
                color: selectedGrade ? '#4f46e5' : '#1f2937', fontWeight: selectedGrade ? 500 : 700,
                padding: 0, textDecoration: selectedGrade ? 'underline' : 'none'
            }}>
                All Grades
            </button>
            {selectedGrade && (
                <>
                    <span className="material-icons-outlined" style={{ fontSize: 16, color: '#d1d5db' }}>chevron_right</span>
                    <button onClick={() => goToGrade(selectedGrade)} style={{
                        background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
                        color: selectedSection ? '#4f46e5' : '#1f2937', fontWeight: selectedSection ? 500 : 700,
                        padding: 0, textDecoration: selectedSection ? 'underline' : 'none'
                    }}>
                        Grade {selectedGrade}
                    </button>
                </>
            )}
            {selectedSection && (
                <>
                    <span className="material-icons-outlined" style={{ fontSize: 16, color: '#d1d5db' }}>chevron_right</span>
                    <button onClick={() => goToSection(selectedSection)} style={{
                        background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
                        color: selectedSubject ? '#4f46e5' : '#1f2937', fontWeight: selectedSubject ? 500 : 700,
                        padding: 0, textDecoration: selectedSubject ? 'underline' : 'none'
                    }}>
                        Section {selectedSection}
                    </button>
                </>
            )}
            {selectedSubject && (
                <>
                    <span className="material-icons-outlined" style={{ fontSize: 16, color: '#d1d5db' }}>chevron_right</span>
                    <span style={{ fontWeight: 700, color: '#1f2937' }}>{selectedSubject.subject}</span>
                </>
            )}
        </div>
    );

    return (
        <>
            <Header title="Lesson Plans">
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Search — available everywhere now */}
                    <div style={{ position: 'relative' }}>
                        <span className="material-icons-outlined" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: '#9ca3af' }}>search</span>
                        <input type="text" className="form-input" placeholder="Search plans by title or subject..." value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ paddingLeft: 36, width: 220, height: 36, fontSize: 13 }} id="search-plans" />
                    </div>

                    {/* Status filters — also available everywhere */}
                    {statusFilters.map(f => (
                        <button key={f} className={`btn ${statusFilter === f ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setStatusFilter(f)}
                            style={{ textTransform: 'capitalize', padding: '6px 12px', fontSize: 12 }}>
                            {f}
                        </button>
                    ))}
                    {canCreate && (
                        <button className="btn btn-primary" onClick={() => navigate('/create-lesson')}
                            style={{ marginLeft: 'auto' }}>
                            <span className="material-icons-outlined" style={{ fontSize: 16 }}>add</span>
                            New Plan
                        </button>
                    )}
                </div>
            </Header>
            <div className="app-content">
                {loading ? (
                    <div className="loading"><div className="spinner"></div></div>
                ) : (
                    <>
                        <Breadcrumb />

                        {/* ═══ LEVEL 0: Global Search Results ═══ */}
                        {search.trim().length > 0 ? (
                            <div>
                                <h3 style={{ marginBottom: 16, fontSize: 15, color: '#4b5563' }}>Search Results for &quot;{search}&quot;</h3>
                                {getPlansForClass(null).length > 0 ? (
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                                        gap: 12
                                    }}>
                                        {getPlansForClass(null).map((plan, i) => (
                                            <PlanCard key={plan.id} plan={plan} i={i}
                                                navigate={navigate} user={user}
                                                handleDelete={handleDelete} showHierarchyBadge={true} />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="empty-state">
                                        <span className="material-icons-outlined">search_off</span>
                                        <h3>No matches found</h3>
                                        <p>No lesson plans matching &quot;{search}&quot;.</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                                {/* ═══ LEVEL 1: All Grades ═══ */}
                                {!selectedGrade && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {hierarchy.length > 0 ? hierarchy.map(({ grade, sections }) => {
                                            const color = gradeColors[grade] || '#607d8b';
                                            const planCount = countPlansForGrade(grade);
                                            return (
                                                <div key={grade} className="card animate-in"
                                                    onClick={() => goToGrade(grade)}
                                                    style={{ cursor: 'pointer', transition: 'all 0.15s', overflow: 'hidden' }}
                                                    onMouseOver={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'}
                                                    onMouseOut={e => e.currentTarget.style.boxShadow = ''}
                                                >
                                                    <div style={{
                                                        padding: '14px 20px',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                            <div style={{
                                                                width: 44, height: 44, borderRadius: 12,
                                                                background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                color: '#fff', fontWeight: 800, fontSize: 16
                                                            }}>{grade}</div>
                                                            <div>
                                                                <div style={{ fontWeight: 700, fontSize: 16, color: '#1f2937' }}>Grade {grade}</div>
                                                                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                                                                    {sections.length} section{sections.length !== 1 ? 's' : ''}
                                                                    {' · '}
                                                                    {planCount} plan{planCount !== 1 ? 's' : ''}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            {sections.slice(0, 6).map((s, i) => (
                                                                <span key={s.section} style={{
                                                                    padding: '3px 10px', borderRadius: 16, fontSize: 11, fontWeight: 600,
                                                                    background: `${sectionColors[i % sectionColors.length]}14`,
                                                                    color: sectionColors[i % sectionColors.length]
                                                                }}>{s.section}</span>
                                                            ))}
                                                            {sections.length > 6 && <span style={{ fontSize: 11, color: '#94a3b8' }}>+{sections.length - 6}</span>}
                                                            <span className="material-icons-outlined" style={{ color: '#9ca3af', fontSize: 20, marginLeft: 4 }}>chevron_right</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }) : (
                                            <div className="empty-state">
                                                <span className="material-icons-outlined">school</span>
                                                <h3>No classes found</h3>
                                                <p>Create classes first to organize your lesson plans.</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ═══ LEVEL 2: Sections within a Grade ═══ */}
                                {selectedGrade && !selectedSection && currentGradeData && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {currentGradeData.sections.map((sec, si) => {
                                            const secColor = sectionColors[si % sectionColors.length];
                                            const planCount = countPlansForSection(selectedGrade, sec.section);
                                            return (
                                                <div key={sec.section} className="card animate-in"
                                                    onClick={() => goToSection(sec.section)}
                                                    style={{ cursor: 'pointer', transition: 'all 0.15s', overflow: 'hidden' }}
                                                    onMouseOver={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'}
                                                    onMouseOut={e => e.currentTarget.style.boxShadow = ''}
                                                >
                                                    <div style={{
                                                        padding: '12px 20px',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                            <div style={{
                                                                width: 38, height: 38, borderRadius: 10,
                                                                background: `linear-gradient(135deg, ${secColor}, ${secColor}bb)`,
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                color: '#fff', fontWeight: 800, fontSize: 14
                                                            }}>{sec.section}</div>
                                                            <div>
                                                                <div style={{ fontWeight: 700, fontSize: 15, color: '#1f2937' }}>Section {sec.section}</div>
                                                                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>
                                                                    {sec.subjects.length} subject{sec.subjects.length !== 1 ? 's' : ''}
                                                                    {' · '}
                                                                    {planCount} plan{planCount !== 1 ? 's' : ''}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            {sec.subjects.slice(0, 4).map((cls, j) => (
                                                                <span key={cls.id} style={{
                                                                    padding: '3px 10px', borderRadius: 16, fontSize: 11, fontWeight: 600,
                                                                    background: `${subjectColors[j % subjectColors.length]}14`,
                                                                    color: subjectColors[j % subjectColors.length]
                                                                }}>{cls.subject}</span>
                                                            ))}
                                                            {sec.subjects.length > 4 && <span style={{ fontSize: 11, color: '#94a3b8' }}>+{sec.subjects.length - 4}</span>}
                                                            <span className="material-icons-outlined" style={{ color: '#9ca3af', fontSize: 20, marginLeft: 4 }}>chevron_right</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {currentGradeData.sections.length === 0 && (
                                            <div className="empty-state">
                                                <span className="material-icons-outlined">class</span>
                                                <h3>No sections in Grade {selectedGrade}</h3>
                                                <p>Add sections from the Classes page first.</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ═══ LEVEL 3: Subjects within a Section ═══ */}
                                {selectedSection && !selectedSubject && currentSectionData && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {currentSectionData.subjects.length > 0 ? currentSectionData.subjects.map((cls, j) => {
                                            const subColor = subjectColors[j % subjectColors.length];
                                            const clsPlans = getPlansForClass(cls.id);
                                            return (
                                                <div key={cls.id} className="card animate-in"
                                                    onClick={() => goToSubject(cls)}
                                                    style={{ cursor: 'pointer', transition: 'all 0.15s', overflow: 'hidden' }}
                                                    onMouseOver={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'}
                                                    onMouseOut={e => e.currentTarget.style.boxShadow = ''}
                                                >
                                                    <div style={{
                                                        padding: '12px 20px',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                            <div style={{
                                                                width: 38, height: 38, borderRadius: 10,
                                                                background: `linear-gradient(135deg, ${subColor}, ${subColor}bb)`,
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                color: '#fff', fontSize: 16
                                                            }}>
                                                                <span className="material-icons-outlined" style={{ fontSize: 20 }}>menu_book</span>
                                                            </div>
                                                            <div>
                                                                <div style={{ fontWeight: 700, fontSize: 15, color: '#1f2937' }}>{cls.subject}</div>
                                                                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>
                                                                    {cls.owner?.name || 'No teacher'}
                                                                    {' · '}
                                                                    {clsPlans.length} plan{clsPlans.length !== 1 ? 's' : ''}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            {clsPlans.length > 0 && (
                                                                <span style={{
                                                                    padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                                                                    background: `${subColor}14`, color: subColor
                                                                }}>{clsPlans.length}</span>
                                                            )}
                                                            <span className="material-icons-outlined" style={{ color: '#9ca3af', fontSize: 20 }}>chevron_right</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }) : (
                                            <div className="empty-state">
                                                <span className="material-icons-outlined">menu_book</span>
                                                <h3>No subjects in Section {selectedSection}</h3>
                                                <p>Add subjects from the Classes page first.</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ═══ LEVEL 4: Plans within a Subject ═══ */}
                                {selectedSubject && (
                                    <div>
                                        {/* Subject info header */}
                                        {currentSubjectCls && (
                                            <div style={{
                                                display: 'flex', alignItems: 'center', gap: 12,
                                                padding: '12px 16px', borderRadius: 12,
                                                background: '#f8fafc', border: '1px solid #e5e7eb',
                                                marginBottom: 16
                                            }}>
                                                <span className="material-icons-outlined" style={{ fontSize: 20, color: '#4f46e5' }}>menu_book</span>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 700, fontSize: 15 }}>{currentSubjectCls.subject}</div>
                                                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                                                        Grade {selectedGrade} · Section {selectedSection}
                                                        {currentSubjectCls.owner && ` · ${currentSubjectCls.owner.name}`}
                                                    </div>
                                                </div>
                                                <span style={{
                                                    padding: '4px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700,
                                                    background: '#eef2ff', color: '#4f46e5'
                                                }}>{currentPlans.length} plan{currentPlans.length !== 1 ? 's' : ''}</span>
                                            </div>
                                        )}

                                        {currentPlans.length > 0 ? (
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                                                gap: 12
                                            }}>
                                                {currentPlans.map((plan, i) => (
                                                    <PlanCard key={plan.id} plan={plan} i={i}
                                                        navigate={navigate} user={user}
                                                        handleDelete={handleDelete} />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="empty-state">
                                                <span className="material-icons-outlined">auto_stories</span>
                                                <h3>No lesson plans yet</h3>
                                                <p>
                                                    {search ? `No plans matching "${search}".` :
                                                        statusFilter !== 'all' ? `No ${statusFilter} plans.` :
                                                            canCreate ? 'Create the first lesson plan for this class!' :
                                                                'No plans available yet.'}
                                                </p>
                                                {canCreate && (
                                                    <button className="btn btn-primary mt-lg" onClick={() => navigate('/create-lesson')}>
                                                        <span className="material-icons-outlined">add</span> New Plan
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>
        </>
    );
};

// ── Plan Card Component ──
const PlanCard = ({ plan, i, navigate, user, handleDelete, showHierarchyBadge }) => {
    const canEdit = user?.role === 'TEACHER' || user?.role === 'ADMIN' || user?.role === 'HOD';
    const statusColors = {
        DRAFT: { bg: '#fef3c7', color: '#92400e' },
        SUBMITTED: { bg: '#dbeafe', color: '#1e40af' },
        APPROVED: { bg: '#d1fae5', color: '#065f46' },
        PUBLISHED: { bg: '#ede9fe', color: '#5b21b6' },
        ARCHIVED: { bg: '#f3f4f6', color: '#4b5563' },
    };
    const sc = statusColors[plan.status] || statusColors.DRAFT;

    return (
        <div className="card animate-in" onClick={() => navigate(`/lesson-plans/${plan.id}`)}
            style={{
                cursor: 'pointer', transition: 'all 0.15s', overflow: 'hidden',
                animationDelay: `${i * 40}ms`
            }}
            onMouseOver={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'}
            onMouseOut={e => e.currentTarget.style.boxShadow = ''}
        >
            <div style={{ height: 4, background: sc.color }} />
            <div style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: '#1f2937' }}>
                            {plan.title}
                        </div>
                        {showHierarchyBadge && (
                            <div style={{ fontSize: 11, color: '#4f46e5', fontWeight: 600, marginTop: 4 }}>
                                {plan.subject} • Grade {plan.grade || plan.class?.grade} {plan.class?.section && `• Sec ${plan.class.section}`}
                            </div>
                        )}
                    </div>
                    <span style={{
                        padding: '2px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                        background: sc.bg, color: sc.color, whiteSpace: 'nowrap'
                    }}>{plan.status}</span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 10, fontSize: 12, color: '#6b7280' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span className="material-icons-outlined" style={{ fontSize: 15 }}>person</span>
                        {plan.teacher?.name || 'Unknown'}
                    </span>

                </div>

                {plan.readinessAssessment?.status === 'COMPLETED' && (
                    <div style={{ marginTop: 8 }}>
                        <span style={{
                            padding: '2px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                            background: plan.readinessAssessment.score >= 70 ? '#ecfdf5' : '#fef2f2',
                            color: plan.readinessAssessment.score >= 70 ? '#059669' : '#dc2626'
                        }}>AI Score: {plan.readinessAssessment.score}/100</span>
                    </div>
                )}

                {canEdit && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginTop: 10, borderTop: '1px solid #f3f4f6', paddingTop: 8 }}>
                        <button className="btn-icon" onClick={(e) => { e.stopPropagation(); navigate(`/lesson-plans/${plan.id}/edit`); }} title="Edit">
                            <span className="material-icons-outlined" style={{ fontSize: 16 }}>edit</span>
                        </button>
                        <button className="btn-icon" onClick={(e) => handleDelete(e, plan.id)} title="Delete">
                            <span className="material-icons-outlined" style={{ fontSize: 16, color: 'var(--error)' }}>delete</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LessonPlansPage;
