import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import AiTutor from '../components/AiTutor';
import api from '../services/api';

const statusConfig = {
    DRAFT: { label: 'Draft', color: '#6b7280', bg: '#f3f4f6', icon: 'edit_note' },
    SUBMITTED: { label: 'Pending Approval', color: '#d97706', bg: '#fffbeb', icon: 'pending' },
    CHANGES_REQUESTED: { label: 'Changes Requested', color: '#dc2626', bg: '#fef2f2', icon: 'warning' },
    APPROVED: { label: 'Approved', color: '#059669', bg: '#ecfdf5', icon: 'check_circle' },
    PUBLISHED: { label: 'Published', color: '#1a73e8', bg: '#eff6ff', icon: 'public' },
    ARCHIVED: { label: 'Archived', color: '#9ca3af', bg: '#f9fafb', icon: 'archive' },
};

const LessonPlanDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [plan, setPlan] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState(null);
    const [showCopyModal, setShowCopyModal] = useState(false);
    const [teacherClasses, setTeacherClasses] = useState([]);
    const [copying, setCopying] = useState(false);
    const [showReadinessDetails, setShowReadinessDetails] = useState(false);
    const [readiness, setReadiness] = useState({}); // Added readiness state

    // HOD Feedback & AI Analysis State
    const [comments, setComments] = useState([]);
    const [sectionAnalysis, setSectionAnalysis] = useState({});
    const [activeCommentSection, setActiveCommentSection] = useState(null);
    const [newComment, setNewComment] = useState('');
    const [analyzingSection, setAnalyzingSection] = useState(false);

    const [showAssignModal, setShowAssignModal] = useState(false);
    const [timetableSlots, setTimetableSlots] = useState([]);
    const [assigningSlot, setAssigningSlot] = useState(null);

    useEffect(() => {
        fetchPlan();
    }, [id]);

    const fetchPlan = async () => {
        try {
            const res = await api.get(`/lesson-plans/${id}`);
            setPlan(res.data);
            setReadiness(res.data.readinessAssessment || {});

            // Parse section analysis if present
            if (res.data.readinessAssessment?.sectionAnalysis) {
                try {
                    const analysis = typeof res.data.readinessAssessment.sectionAnalysis === 'string'
                        ? JSON.parse(res.data.readinessAssessment.sectionAnalysis)
                        : res.data.readinessAssessment.sectionAnalysis;
                    setSectionAnalysis(analysis || {});
                } catch (e) { console.error('Error parsing section analysis', e); }
            }

            // Fetch comments
            api.get(`/comments/plan/${id}`).then(c => setComments(c.data)).catch(console.error);

            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleSubmitForApproval = async () => {
        setSubmitting(true);
        try {
            await api.patch(`/lesson-plans/${id}/submit`);
            showToast('Plan submitted for HOD approval!');
            fetchPlan();
        } catch (err) {
            const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to submit plan.';
            showToast(msg, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCopyPlan = async (targetClassId) => {
        setCopying(true);
        try {
            const res = await api.post(`/lesson-plans/${id}/copy`, { classId: targetClassId });
            showToast('Plan copied! Redirecting...');
            setShowCopyModal(false);
            setTimeout(() => navigate(`/lesson-plans/${res.data.id}`), 1000);
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to copy plan.', 'error');
        } finally { setCopying(false); }
    };

    const openCopyModal = () => {
        // Fetch valid classes to copy to
        api.get('/classes').then(res => {
            // Filter classes where teacher is owner
            const owned = res.data.filter(c => c.ownerId === user.id && c.id !== plan.classId);
            setTeacherClasses(owned);
            setShowCopyModal(true);
        }).catch(() => showToast('Failed to load classes.', 'error'));
    };

    const openAssignModal = async () => {
        setShowAssignModal(true);
        try {
            const res = await api.get('/timetable/my');
            const validSlots = (res.data.slots || []).filter(s => s.classId === plan.classId);
            setTimetableSlots(validSlots);
        } catch (err) {
            showToast('Failed to load timetable.', 'error');
        }
    };

    const handleAssignSlot = async (slotId) => {
        setAssigningSlot(slotId);
        try {
            await api.patch(`/timetable/slots/${slotId}/link`, { lessonPlanId: plan.id });
            showToast('Assigned to timetable successfully!');
            setShowAssignModal(false);
        } catch (err) {
            showToast('Failed to assign.', 'error');
        } finally {
            setAssigningSlot(null);
        }
    };

    // --- HOD Feedback Handlers ---

    const handleAnalyzePlan = async () => {
        try {
            setAnalyzingSection(true);
            const res = await api.post('/readiness/analyze', { planId: id });
            setSectionAnalysis(res.data || {});
            showToast('AI analysis complete!', 'success');
        } catch (e) {
            showToast('Analysis failed. Try again.', 'error');
        } finally {
            setAnalyzingSection(false);
        }
    };

    const handlePostComment = async (sectionKey) => {
        if (!newComment.trim()) return;
        try {
            const res = await api.post('/comments', {
                planId: id,
                section: sectionKey,
                content: newComment
            });
            setComments([res.data, ...comments]);
            setNewComment('');
            setActiveCommentSection(null);
            showToast('Comment added');
        } catch (e) {
            showToast('Failed to post comment', 'error');
        }
    };

    const handleDeleteComment = async (commentId) => {
        if (!window.confirm('Delete this comment?')) return;
        try {
            await api.delete(`/comments/${commentId}`);
            setComments(comments.filter(c => c.id !== commentId));
            showToast('Comment deleted');
        } catch (e) {
            showToast('Failed to delete comment', 'error');
        }
    };

    if (loading) {
        return (
            <>
                <Header title="Lesson Plan" />
                <div className="app-content"><div className="loading"><div className="spinner"></div></div></div>
            </>
        );
    }

    if (!plan) {
        return (
            <>
                <Header title="Lesson Plan" />
                <div className="app-content">
                    <div className="empty-state">
                        <span className="material-icons-outlined">error_outline</span>
                        <h3>Lesson plan not found</h3>
                        <button className="btn btn-primary mt-lg" onClick={() => navigate('/lesson-plans')}>Back to Lesson Plans</button>
                    </div>
                </div>
            </>
        );
    }

    const sections = [
        { key: 'objectives', title: 'Learning Objectives', content: plan.objectives, type: 'list' },
        { key: 'materials', title: 'Materials & Resources', content: plan.materials, type: 'list' },
        { key: 'warmUp', title: 'Warm-Up / Bell Ringer', content: plan.warmUp, type: 'text' },
        { key: 'instruction', title: 'Direct Instruction', content: plan.instruction, type: 'text' },
        { key: 'guidedPractice', title: 'Guided Practice', content: plan.guidedPractice, type: 'text' },
        { key: 'independentPractice', title: 'Independent Practice', content: plan.independentPractice, type: 'text' },
        { key: 'closure', title: 'Closure', content: plan.closure, type: 'text' },
        { key: 'assessment', title: 'Assessment', content: plan.assessment, type: 'text' },
        { key: 'differentiation', title: 'Differentiation', content: plan.differentiation, type: 'text' },
        { key: 'homework', title: 'Homework', content: plan.homework, type: 'text' },
        { key: 'notes', title: 'Notes', content: plan.notes, type: 'text' },
    ];

    const canEdit = user?.role === 'ADMIN' || (user?.role === 'TEACHER' && plan.teacherId === user?.id);
    const isOwnPlan = user?.role === 'TEACHER' && plan.teacherId === user?.id;
    const isOwnDraft = isOwnPlan && plan.status === 'DRAFT';
    const isSubmitted = plan.status === 'SUBMITTED';
    const isHod = user?.role === 'HOD';
    const isAdmin = user?.role === 'ADMIN';
    const sc = statusConfig[plan.status] || statusConfig.DRAFT;

    // Readiness assessment data
    // readiness is already defined as state
    const hasReadiness = readiness && readiness.status === 'COMPLETED';
    const readinessScore = hasReadiness ? readiness.score : null;
    const readinessCleared = readinessScore !== null && readinessScore >= 70;

    const getScoreColor = (s) => s >= 80 ? '#059669' : s >= 70 ? '#d97706' : '#dc2626';
    const getScoreBg = (s) => s >= 80 ? '#ecfdf5' : s >= 70 ? '#fffbeb' : '#fef2f2';

    return (
        <>
            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'fixed', top: 24, right: 24, zIndex: 9999,
                    background: toast.type === 'error' ? '#dc2626' : '#059669',
                    color: '#fff', padding: '12px 20px', borderRadius: 10,
                    boxShadow: '0 4px 24px rgba(0,0,0,0.15)', display: 'flex',
                    alignItems: 'center', gap: 8, fontWeight: 500, maxWidth: 400
                }}>
                    <span className="material-icons-outlined" style={{ fontSize: 18 }}>
                        {toast.type === 'error' ? 'error' : 'check_circle'}
                    </span>
                    {toast.msg}
                </div>
            )}

            <Header title="Lesson Plan">
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button className="btn btn-ghost" onClick={() => navigate('/lesson-plans')}>
                        <span className="material-icons-outlined">arrow_back</span>
                        Back
                    </button>
                    {isOwnDraft && readinessCleared && (
                        <button
                            className="btn btn-secondary"
                            onClick={handleSubmitForApproval}
                            disabled={submitting}
                            id="submit-for-approval"
                        >
                            <span className="material-icons-outlined">send</span>
                            {submitting ? 'Submitting...' : 'Submit for Approval'}
                        </button>
                    )}
                    {isOwnDraft && !readinessCleared && (
                        <button
                            className="btn btn-ghost"
                            style={{ opacity: 0.6, cursor: 'not-allowed', borderColor: '#9ca3af' }}
                            onClick={() => showToast(
                                hasReadiness
                                    ? `Readiness score is ${readinessScore}/100. Minimum 70 required. Please retake the AI Readiness check.`
                                    : 'Complete the AI Readiness Assessment first (score ≥ 70 required).',
                                'error'
                            )}
                            id="submit-blocked"
                        >
                            <span className="material-icons-outlined">lock</span>
                            Submit Locked
                        </button>
                    )}
                    {isOwnPlan && (
                        <button
                            className="btn btn-ghost"
                            style={{ borderColor: '#6c63ff', color: '#6c63ff' }}
                            onClick={() => navigate(`/lesson-plans/${id}/readiness`)}
                            id="ai-readiness-btn"
                        >
                            <span className="material-icons-outlined">psychology</span>
                            AI Readiness
                        </button>
                    )}
                    {(isHod || isAdmin) && (
                        <button
                            className="btn btn-ghost"
                            style={{ borderColor: '#f59e0b', color: '#b45309', background: '#fffbeb' }}
                            onClick={handleAnalyzePlan}
                            disabled={analyzingSection}
                            id="ai-analyze-btn"
                        >
                            <span className="material-icons-outlined">analytics</span>
                            {analyzingSection ? 'Analyzing...' : 'Generate HOD Insights'}
                        </button>
                    )}
                    {canEdit && !isSubmitted && (
                        <button className="btn btn-primary" onClick={() => navigate(`/lesson-plans/${id}/edit`)} id="edit-plan">
                            <span className="material-icons-outlined">edit</span>
                            Edit
                        </button>
                    )}
                    <button
                        className="btn btn-ghost"
                        style={{ borderColor: '#e5e7eb' }}
                        onClick={async () => {
                            try {
                                const token = localStorage.getItem('token');
                                const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/export/${id}/pdf`, {
                                    headers: { Authorization: `Bearer ${token}` }
                                });
                                const blob = await response.blob();
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `lesson-plan-${plan.title.replace(/\s+/g, '-').toLowerCase()}.pdf`;
                                a.click();
                                window.URL.revokeObjectURL(url);
                                showToast('PDF downloaded!');
                            } catch { showToast('Failed to export PDF.', 'error'); }
                        }}
                        id="export-pdf-btn"
                    >
                        <span className="material-icons-outlined">picture_as_pdf</span>
                        Export PDF
                    </button>
                    {/* Copy to Section */}
                    {isOwnPlan && (
                        <button className="btn btn-ghost" style={{ borderColor: '#8430ce', color: '#8430ce' }}
                            onClick={openCopyModal} id="copy-to-section-btn">
                            <span className="material-icons-outlined">content_copy</span>
                            Copy to Section
                        </button>
                    )}
                    {isOwnPlan && plan.classId && (
                        <button className="btn btn-primary" onClick={openAssignModal} id="assign-timetable-btn">
                            <span className="material-icons-outlined">calendar_today</span>
                            Assign to Timetable
                        </button>
                    )}
                </div>
            </Header>

            {/* Copy to Section Modal */}
            {showCopyModal && (
                <div className="modal-overlay" onClick={() => setShowCopyModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
                        <div className="modal-header">
                            <h2>Copy Plan to Another Section</h2>
                            <button className="btn-icon" onClick={() => setShowCopyModal(false)}>
                                <span className="material-icons-outlined">close</span>
                            </button>
                        </div>
                        <div className="modal-body">
                            {teacherClasses.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 20, color: '#6b7280' }}>
                                    <span className="material-icons-outlined" style={{ fontSize: 40, display: 'block', marginBottom: 8, color: '#d1d5db' }}>info</span>
                                    No other sections/classes available to copy to.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 8px' }}>Select a target class/section. The plan will be copied as a new Draft.</p>
                                    {teacherClasses.map(cls => (
                                        <button key={cls.id} onClick={() => handleCopyPlan(cls.id)} disabled={copying}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                                                borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff',
                                                cursor: copying ? 'wait' : 'pointer', transition: 'all 0.2s', textAlign: 'left', width: '100%'
                                            }}>
                                            <div style={{ width: 40, height: 40, borderRadius: 10, background: cls.coverColor || '#1a73e8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14 }}>
                                                {cls.section || cls.name?.[0] || '?'}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{cls.name}</div>
                                                <div style={{ fontSize: 12, color: '#6b7280' }}>
                                                    {cls.subject && `${cls.subject} · `}Grade {cls.grade}{cls.section && ` · Section ${cls.section}`}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Assign to Timetable Modal */}
            {showAssignModal && (
                <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
                        <div className="modal-header">
                            <h2>Assign to Timetable ({plan.class?.name || 'Class'})</h2>
                            <button className="btn-icon" onClick={() => setShowAssignModal(false)}>
                                <span className="material-icons-outlined">close</span>
                            </button>
                        </div>
                        <div className="modal-body">
                            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 12px' }}>
                                Select a timetable slot to assign this lesson plan.
                            </p>
                            {timetableSlots.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 30, color: '#6b7280' }}>
                                    <span className="material-icons-outlined" style={{ fontSize: 40, display: 'block', marginBottom: 8, color: '#d1d5db' }}>event_busy</span>
                                    No timetable slots found for this class.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflow: 'auto' }}>
                                    {timetableSlots.map(slot => (
                                        <button
                                            key={slot.id}
                                            onClick={() => handleAssignSlot(slot.id)}
                                            disabled={assigningSlot === slot.id}
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                padding: '12px 16px', borderRadius: 10, border: '1px solid #e5e7eb',
                                                background: '#fff', cursor: 'pointer', textAlign: 'left',
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontWeight: 600, color: '#1e293b' }}>{slot.dayOfWeek}</div>
                                                <div style={{ fontSize: 12, color: '#64748b' }}>
                                                    {slot.period?.label || `Period ${slot.period?.number}`} ({slot.period?.startTime} - {slot.period?.endTime})
                                                </div>
                                                <div style={{ fontSize: 11, color: '#4f46e5', fontWeight: 600, marginTop: 4 }}>
                                                    {slot.subject?.name}
                                                </div>
                                            </div>
                                            {assigningSlot === slot.id ? (
                                                <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                                            ) : slot.lessonPlanId === plan.id ? (
                                                <span className="material-icons-outlined" style={{ color: '#10b981' }}>check_circle</span>
                                            ) : slot.lessonPlanId ? (
                                                <span style={{ fontSize: 11, color: '#dc2626', background: '#fef2f2', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>Overwrites</span>
                                            ) : (
                                                <span className="material-icons-outlined" style={{ color: '#cbd5e1' }}>chevron_right</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="app-content">
                <div className="detail-page animate-in">

                    {/* AI Readiness Score Card */}
                    {isOwnPlan && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 16,
                            padding: '16px 20px', borderRadius: 12, marginBottom: 16,
                            background: hasReadiness ? getScoreBg(readinessScore) : '#f9fafb',
                            border: `1px solid ${hasReadiness ? getScoreColor(readinessScore) + '40' : '#e5e7eb'}`
                        }}>
                            <div style={{
                                width: 52, height: 52, borderRadius: '50%',
                                border: `3px solid ${hasReadiness ? getScoreColor(readinessScore) : '#d1d5db'}`,
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                background: '#fff', flexShrink: 0
                            }}>
                                {hasReadiness ? (
                                    <>
                                        <div style={{ fontSize: 18, fontWeight: 800, color: getScoreColor(readinessScore), lineHeight: 1 }}>{readinessScore}</div>
                                        <div style={{ fontSize: 9, color: '#6b7280' }}>/100</div>
                                    </>
                                ) : (
                                    <span className="material-icons-outlined" style={{ color: '#9ca3af', fontSize: 22 }}>help_outline</span>
                                )}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
                                    {hasReadiness
                                        ? readinessCleared
                                            ? '✅ AI Readiness: Cleared'
                                            : '❌ AI Readiness: Not Cleared'
                                        : '⏳ AI Readiness: Not Assessed'}
                                </div>
                                <div style={{ fontSize: 13, color: '#6b7280' }}>
                                    {hasReadiness
                                        ? readinessCleared
                                            ? 'You may submit this lesson plan for HOD approval.'
                                            : `Score ${readinessScore}/100 — minimum 70 required. Retake the assessment.`
                                        : 'Complete the AI Readiness Assessment to unlock submission.'}
                                </div>
                            </div>
                            {!readinessCleared && (
                                <button
                                    className="btn btn-ghost"
                                    style={{ borderColor: '#6c63ff', color: '#6c63ff', flexShrink: 0 }}
                                    onClick={() => navigate(`/lesson-plans/${id}/readiness`)}
                                >
                                    <span className="material-icons-outlined" style={{ fontSize: 16 }}>psychology</span>
                                    {hasReadiness ? 'Retake' : 'Start Assessment'}
                                </button>
                            )}
                        </div>
                    )}

                    {/* HOD/Admin: AI Readiness Assessment Details */}
                    {(isHod || isAdmin) && hasReadiness && (
                        <div style={{
                            borderRadius: 12, marginBottom: 16, overflow: 'hidden',
                            border: `1px solid ${getScoreColor(readinessScore)}40`,
                            background: '#fff'
                        }}>
                            <div onClick={() => setShowReadinessDetails(!showReadinessDetails)}
                                style={{
                                    padding: '14px 20px', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    background: getScoreBg(readinessScore)
                                }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <span className="material-icons-outlined" style={{ color: getScoreColor(readinessScore) }}>psychology</span>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 14 }}>AI Readiness Assessment</div>
                                        <div style={{ fontSize: 12, color: '#6b7280' }}>Score: {readinessScore}/100 — {readinessCleared ? 'Passed' : 'Failed'}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{
                                        padding: '3px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                                        background: readinessCleared ? '#ecfdf5' : '#fef2f2',
                                        color: readinessCleared ? '#059669' : '#dc2626'
                                    }}>{readinessScore}/100</span>
                                    <span className="material-icons-outlined" style={{
                                        fontSize: 20, color: '#9ca3af',
                                        transform: showReadinessDetails ? 'rotate(180deg)' : 'rotate(0deg)',
                                        transition: 'transform 0.2s'
                                    }}>expand_more</span>
                                </div>
                            </div>
                            {showReadinessDetails && (
                                <div style={{ padding: '16px 20px' }}>
                                    {/* Feedback lines */}
                                    {readiness.feedback && (
                                        <div style={{ marginBottom: 16 }}>
                                            {readiness.feedback.split('\n').filter(Boolean).map((line, i) => {
                                                const isAIFlag = line.includes('🤖') || line.includes('🚨');
                                                const isGood = line.includes('✅') || line.includes('🟢');
                                                return (
                                                    <div key={i} style={{
                                                        padding: '8px 12px', borderRadius: 6, marginBottom: 4,
                                                        fontSize: 13, lineHeight: 1.5,
                                                        background: isAIFlag ? '#fef2f2' : isGood ? '#ecfdf5' : '#f9fafb',
                                                        color: isAIFlag ? '#991b1b' : isGood ? '#065f46' : '#4b5563',
                                                        border: isAIFlag ? '1px solid #fecaca' : 'none'
                                                    }}>
                                                        {line}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {/* Questions & Answers */}
                                    {readiness.questions && (() => {
                                        const qList = typeof readiness.questions === 'string' ? JSON.parse(readiness.questions) : readiness.questions;
                                        const aMap = readiness.answers
                                            ? (typeof readiness.answers === 'string' ? JSON.parse(readiness.answers) : readiness.answers)
                                            : {};
                                        // qList is an ARRAY of {id, question, category, weight}
                                        const questionsArray = Array.isArray(qList) ? qList : Object.values(qList);
                                        return (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                                <h4 style={{ margin: 0, fontSize: 13, color: '#374151' }}>Questions & Teacher's Answers</h4>
                                                {questionsArray.map((q, i) => {
                                                    const qText = typeof q === 'string' ? q : (q?.question || JSON.stringify(q));
                                                    const qId = q?.id || `q${i + 1}`;
                                                    const category = q?.category || `Question ${i + 1}`;
                                                    const weight = q?.weight;
                                                    const answer = aMap[qId];
                                                    const wordCount = answer ? answer.trim().split(/\s+/).filter(Boolean).length : 0;
                                                    return (
                                                        <div key={qId} style={{ padding: '14px 16px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fafafa' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                                <span style={{
                                                                    fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                                                                    color: '#1a73e8', letterSpacing: '0.05em'
                                                                }}>
                                                                    {category}
                                                                    {weight && <span style={{ color: '#9ca3af', fontWeight: 500, textTransform: 'none', marginLeft: 6 }}>({weight} pts)</span>}
                                                                </span>
                                                                <span style={{ fontSize: 10, color: '#9ca3af' }}>Q{i + 1}</span>
                                                            </div>
                                                            <div style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 10, lineHeight: 1.5 }}>
                                                                {qText}
                                                            </div>
                                                            <div style={{
                                                                fontSize: 13, color: answer ? '#4b5563' : '#9ca3af',
                                                                paddingLeft: 12, borderLeft: `3px solid ${answer ? '#1a73e8' : '#d1d5db'}`,
                                                                lineHeight: 1.6, fontStyle: answer ? 'normal' : 'italic',
                                                                whiteSpace: 'pre-wrap'
                                                            }}>
                                                                {answer || 'No answer provided'}
                                                            </div>
                                                            {answer && (
                                                                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 6 }}>
                                                                    {wordCount} words
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Approval Status Banner */}
                    {['SUBMITTED', 'CHANGES_REQUESTED', 'APPROVED'].includes(plan.status) && (
                        <div style={{
                            display: 'flex', alignItems: 'flex-start', gap: 14,
                            padding: '16px 20px', borderRadius: 12,
                            background: sc.bg, border: `1px solid ${sc.color}30`,
                            marginBottom: 20
                        }}>
                            <span className="material-icons-outlined" style={{ color: sc.color, fontSize: 24, marginTop: 1 }}>{sc.icon}</span>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, color: sc.color, marginBottom: 2 }}>{sc.label}</div>
                                {plan.status === 'SUBMITTED' && (
                                    <div style={{ fontSize: 13, color: '#6b7280' }}>
                                        Submitted {plan.submissionDate ? new Date(plan.submissionDate).toLocaleDateString() : ''} — Waiting for HOD review.
                                    </div>
                                )}
                                {plan.status === 'APPROVED' && plan.approvalComment && (
                                    <div style={{ fontSize: 13, color: '#4b5563' }}>
                                        <strong>HOD Comment:</strong> {plan.approvalComment}
                                    </div>
                                )}
                                {plan.status === 'CHANGES_REQUESTED' && plan.approvalComment && (
                                    <div style={{ fontSize: 13, color: '#4b5563' }}>
                                        <strong>HOD Feedback:</strong> {plan.approvalComment}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="detail-header" style={{ background: 'linear-gradient(135deg, #1a73e8, #6c63ff)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                padding: '3px 12px', borderRadius: 12, fontSize: 11,
                                fontWeight: 600, background: 'rgba(255,255,255,0.2)', color: '#fff'
                            }}>
                                <span className="material-icons-outlined" style={{ fontSize: 13 }}>{sc.icon}</span>
                                {sc.label}
                            </span>
                        </div>
                        <h1>{plan.title}</h1>
                        <div className="lesson-meta" style={{ marginTop: '12px' }}>
                            <span className="lesson-meta-item" style={{ color: 'rgba(255,255,255,0.9)' }}>
                                <span className="material-icons-outlined">person</span>
                                {plan.teacher?.name}
                            </span>
                            <span className="lesson-meta-item" style={{ color: 'rgba(255,255,255,0.9)' }}>
                                <span className="material-icons-outlined">subject</span>
                                {plan.subject}
                            </span>
                            <span className="lesson-meta-item" style={{ color: 'rgba(255,255,255,0.9)' }}>
                                <span className="material-icons-outlined">school</span>
                                Grade {plan.grade}
                            </span>

                            {plan.class && (
                                <span className="lesson-meta-item" style={{ color: 'rgba(255,255,255,0.9)' }}>
                                    <span className="material-icons-outlined">class</span>
                                    {plan.class.name}{plan.class.section && ` · Section ${plan.class.section}`}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="detail-content">
                        {sections.map(section => {
                            if (!section.content || (Array.isArray(section.content) && section.content.length === 0)) return null;
                            return (
                                <div key={section.title} className="detail-section">
                                    <h3>{section.title}</h3>
                                    {section.type === 'list' ? (
                                        <ul>
                                            {section.content.map((item, i) => (
                                                <li key={i}>{item}</li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p style={{ whiteSpace: 'pre-wrap' }}>{section.content}</p>
                                    )}

                                    {/* AI Critique Section */}
                                    {sectionAnalysis[section.key] && (
                                        <div style={{ marginTop: 12, padding: '12px 16px', background: '#fffbeb', borderRadius: 8, borderLeft: '4px solid #f59e0b', fontSize: 13 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#b45309', marginBottom: 4, textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.05em' }}>
                                                <span className="material-icons-outlined" style={{ fontSize: 16 }}>analytics</span>
                                                AI Analysis
                                            </div>
                                            <div style={{ color: '#92400e', lineHeight: 1.5 }}>
                                                {sectionAnalysis[section.key]}
                                            </div>
                                        </div>
                                    )}

                                    {/* HOD/Teacher Comments Section */}
                                    <div style={{ marginTop: 16, borderTop: '1px solid #f3f4f6', paddingTop: 16 }}>
                                        {comments.filter(c => c.section === section.key).map(c => (
                                            <div key={c.id} style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                                                <img src={c.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.user.name)}&background=random`}
                                                    alt={c.user.name} style={{ width: 28, height: 28, borderRadius: '50%' }} />
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>
                                                            {c.user.name}
                                                            <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: 8, fontSize: 12 }}>
                                                                {new Date(c.createdAt).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                        {(user.id === c.userId || isAdmin || isHod) && (
                                                            <button onClick={() => handleDeleteComment(c.id)} style={{ border: 'none', background: 'none', color: '#d1d5db', cursor: 'pointer', padding: 0 }}>
                                                                <span className="material-icons-outlined" style={{ fontSize: 16 }}>delete</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: 13, color: '#4b5563', marginTop: 2, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                                                        {c.content}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        {/* Add Comment Input */}
                                        {activeCommentSection === section.key ? (
                                            <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'flex-start' }}>
                                                <img src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name)}&background=random`}
                                                    style={{ width: 28, height: 28, borderRadius: '50%' }} />
                                                <div style={{ flex: 1 }}>
                                                    <textarea
                                                        value={newComment} onChange={e => setNewComment(e.target.value)}
                                                        placeholder="Add your feedback..."
                                                        autoFocus
                                                        style={{
                                                            width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8,
                                                            border: '1px solid #d1d5db', minHeight: 60, fontFamily: 'inherit', resize: 'vertical'
                                                        }}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                                e.preventDefault();
                                                                handlePostComment(section.key);
                                                            }
                                                        }}
                                                    />
                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                                                        <button onClick={() => { setActiveCommentSection(null); setNewComment(''); }}
                                                            style={{ padding: '6px 12px', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
                                                            Cancel
                                                        </button>
                                                        <button onClick={() => handlePostComment(section.key)}
                                                            style={{ padding: '6px 16px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
                                                            Post
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <button onClick={() => setActiveCommentSection(section.key)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 6,
                                                    background: 'none', border: 'none', cursor: 'pointer',
                                                    color: '#6b7280', fontSize: 12, fontWeight: 500,
                                                    padding: '6px 0'
                                                }}>
                                                <span className="material-icons-outlined" style={{ fontSize: 16 }}>add_comment</span>
                                                Add Comment
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {plan.resources?.length > 0 && (
                            <div className="detail-section">
                                <h3>Attached Resources</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {plan.resources.map(r => (
                                        <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'var(--bg)', borderRadius: '8px', color: 'var(--text-primary)', transition: 'all 200ms' }}>
                                            <span className="material-icons-outlined" style={{ color: 'var(--primary)' }}>
                                                {r.type === 'link' ? 'link' : r.type === 'video' ? 'videocam' : 'description'}
                                            </span>
                                            <span>{r.name}</span>
                                            <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>{r.type}</span>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {plan && <AiTutor formData={plan} />}
        </>
    );
};

export default LessonPlanDetail;
