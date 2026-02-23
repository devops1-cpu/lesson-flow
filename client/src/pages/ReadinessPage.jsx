import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import api from '../services/api';

const ReadinessPage = () => {
    const { id: lessonPlanId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [plan, setPlan] = useState(null);
    const [assessment, setAssessment] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({});
    const [phase, setPhase] = useState('intro'); // intro | questions | result
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);
    const [activeQ, setActiveQ] = useState(0);
    const [aiEngine, setAiEngine] = useState(null);

    useEffect(() => { fetchData(); }, [lessonPlanId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const planRes = await api.get(`/lesson-plans/${lessonPlanId}`);
            setPlan(planRes.data);

            try {
                const assRes = await api.get(`/readiness/${lessonPlanId}`);
                setAssessment(assRes.data);
                if (assRes.data.status === 'COMPLETED') {
                    setResult({
                        score: assRes.data.score,
                        feedback: assRes.data.feedback?.split('\n') || [],
                        cleared: assRes.data.score >= 70
                    });
                    setPhase('result');
                }
            } catch { /* No existing assessment */ }
        } catch { /* plan not found */ }
        finally { setLoading(false); }
    };

    const handleStart = async () => {
        setSubmitting(true);
        try {
            const res = await api.post(`/readiness/${lessonPlanId}/start`);
            setQuestions(res.data.questions);
            setAnswers({});
            setActiveQ(0);
            setAiEngine(res.data.aiEngine || 'rule-based');
            setPhase('questions');
        } catch {
            alert('Failed to start assessment. Try again.');
        } finally { setSubmitting(false); }
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            const res = await api.post(`/readiness/${lessonPlanId}/submit`, { answers });
            setResult(res.data);
            setAiEngine(res.data.aiEngine || aiEngine || 'rule-based');
            setPhase('result');
        } catch {
            alert('Failed to submit assessment.');
        } finally { setSubmitting(false); }
    };

    const getScoreColor = (s) => s >= 80 ? '#059669' : s >= 60 ? '#d97706' : '#dc2626';
    const getScoreBg = (s) => s >= 80 ? '#ecfdf5' : s >= 60 ? '#fffbeb' : '#fef2f2';

    const gradeConfig = {
        EXCELLENT: { icon: 'check_circle', color: '#059669', bg: '#ecfdf5', label: 'Excellent' },
        GOOD: { icon: 'thumb_up', color: '#d97706', bg: '#fffbeb', label: 'Good' },
        NEEDS_WORK: { icon: 'warning', color: '#ea580c', bg: '#fff7ed', label: 'Needs Work' },
        INSUFFICIENT: { icon: 'cancel', color: '#dc2626', bg: '#fef2f2', label: 'Insufficient' },
        NOT_ANSWERED: { icon: 'block', color: '#6b7280', bg: '#f3f4f6', label: 'Not Answered' },
        AI_DETECTED: { icon: 'gpp_bad', color: '#dc2626', bg: '#fef2f2', label: 'AI Detected' },
    };

    const answered = Object.values(answers).filter(a => a?.trim()).length;
    const allAnswered = questions.length > 0 && answered === questions.length;

    // Get question text from question object (handles both raw string and object format)
    const getQText = (q) => typeof q === 'string' ? q : (q?.question || JSON.stringify(q));

    if (loading) {
        return (
            <>
                <Header title="AI Readiness Check" />
                <div className="app-content"><div className="loading"><div className="spinner" /></div></div>
            </>
        );
    }

    return (
        <>
            <Header title="AI Readiness Check">
                <button className="btn btn-ghost" onClick={() => navigate(`/lesson-plans/${lessonPlanId}`)}>
                    <span className="material-icons-outlined">arrow_back</span>
                    Back to Plan
                </button>
            </Header>

            <div className="app-content">
                <div style={{ maxWidth: 760, margin: '0 auto' }}>

                    {/* Plan Info Card */}
                    {plan && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 14,
                            padding: '14px 20px', background: 'var(--surface)',
                            borderRadius: 12, marginBottom: 24, border: '1px solid var(--border)'
                        }}>
                            <div style={{
                                width: 40, height: 40, borderRadius: 10,
                                background: 'linear-gradient(135deg, #1a73e8, #6c63ff)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <span className="material-icons-outlined" style={{ color: '#fff', fontSize: 20 }}>auto_stories</span>
                            </div>
                            <div>
                                <div style={{ fontWeight: 600 }}>{plan.title}</div>
                                <div style={{ fontSize: 13, color: '#6b7280' }}>{plan.subject} · Grade {plan.grade}</div>
                            </div>
                        </div>
                    )}

                    {/* ═══ INTRO PHASE ═══ */}
                    {phase === 'intro' && (
                        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
                            <div style={{
                                width: 80, height: 80, borderRadius: 20,
                                background: 'linear-gradient(135deg, #1a73e8, #6c63ff)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 20px'
                            }}>
                                <span className="material-icons-outlined" style={{ fontSize: 40, color: '#fff' }}>psychology</span>
                            </div>
                            <h2 style={{ marginBottom: 10 }}>AI Readiness Assessment</h2>
                            <p style={{ color: '#6b7280', marginBottom: 8, lineHeight: 1.6, maxWidth: 520, margin: '0 auto 8px' }}>
                                You'll answer <strong>5 probing questions</strong> about your lesson plan. Each answer is evaluated across
                                <strong> 4 quality dimensions</strong>: Relevance, Specificity, Depth, and Clarity.
                            </p>
                            <p style={{ color: '#6b7280', marginBottom: 24, lineHeight: 1.6, maxWidth: 520, margin: '0 auto 24px' }}>
                                A score of <strong>70+</strong> unlocks submission for HOD approval. Generic or vague answers will score poorly.
                            </p>

                            {/* How scoring works */}
                            <div style={{
                                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
                                marginBottom: 24, maxWidth: 480, margin: '0 auto 24px'
                            }}>
                                {[
                                    { label: 'Relevance', icon: 'gps_fixed', desc: 'Does it address the question?' },
                                    { label: 'Specificity', icon: 'format_list_numbered', desc: 'Concrete examples & actions' },
                                    { label: 'Depth', icon: 'layers', desc: 'Enough substance & detail' },
                                    { label: 'Clarity', icon: 'edit_note', desc: 'Well-organized & readable' },
                                ].map(d => (
                                    <div key={d.label} style={{
                                        padding: '10px 6px', borderRadius: 8, background: '#f0f5ff',
                                        textAlign: 'center'
                                    }}>
                                        <span className="material-icons-outlined" style={{ fontSize: 20, color: '#1a73e8', display: 'block', marginBottom: 4 }}>{d.icon}</span>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: '#1a73e8' }}>{d.label}</div>
                                        <div style={{ fontSize: 9, color: '#6b7280', marginTop: 2 }}>{d.desc}</div>
                                    </div>
                                ))}
                            </div>

                            <div style={{
                                padding: '10px 16px', borderRadius: 8, marginBottom: 28,
                                background: '#fef2f2', border: '1px solid #fecaca',
                                fontSize: 13, color: '#991b1b', display: 'flex', gap: 8,
                                alignItems: 'center', textAlign: 'left',
                                maxWidth: 520, margin: '0 auto 28px'
                            }}>
                                <span className="material-icons-outlined" style={{ fontSize: 18, flexShrink: 0 }}>gpp_bad</span>
                                <span>
                                    <strong>AI Detection Active:</strong> Answers are scanned for AI-generated content.
                                    Only original, hand-written responses are accepted.
                                </span>
                            </div>

                            {assessment?.status === 'COMPLETED' && (
                                <div style={{
                                    padding: '12px 20px', borderRadius: 10, marginBottom: 20,
                                    background: getScoreBg(assessment.score),
                                    color: getScoreColor(assessment.score),
                                    fontWeight: 600, fontSize: 15
                                }}>
                                    Previous score: {assessment.score}/100 — {assessment.score >= 70 ? '✅ Cleared' : '⚠️ Not Cleared'}
                                </div>
                            )}

                            <button className="btn btn-primary" style={{ padding: '12px 32px', fontSize: 15 }}
                                onClick={handleStart} disabled={submitting} id="start-assessment-btn">
                                {submitting ? 'Preparing...' : assessment ? 'Re-take Assessment' : 'Start Assessment'}
                            </button>
                        </div>
                    )}

                    {/* ═══ QUESTIONS PHASE ═══ */}
                    {phase === 'questions' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                <h3 style={{ margin: 0 }}>Answer the questions below</h3>
                                <span style={{ fontSize: 13, color: '#6b7280' }}>{answered} / {questions.length} answered</span>
                            </div>

                            {/* Progress bar */}
                            <div style={{ height: 4, background: '#e5e7eb', borderRadius: 4, marginBottom: 28 }}>
                                <div style={{
                                    height: '100%', borderRadius: 4, background: '#1a73e8',
                                    width: `${(answered / questions.length) * 100}%`,
                                    transition: 'width 0.3s'
                                }} />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                {questions.map((q, i) => {
                                    const wordCount = (answers[q.id] || '').trim().split(/\s+/).filter(Boolean).length;
                                    const isActive = activeQ === i;
                                    return (
                                        <div key={q.id} className="card" style={{
                                            padding: 24, transition: 'all 0.2s',
                                            border: isActive ? '2px solid #1a73e8' : '1px solid var(--border-light)'
                                        }} onClick={() => setActiveQ(i)}>
                                            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                                                <div style={{
                                                    width: 32, height: 32, borderRadius: 8,
                                                    background: answers[q.id]?.trim() ? '#ecfdf5' : '#f3f4f6',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    flexShrink: 0, fontWeight: 700, fontSize: 14,
                                                    color: answers[q.id]?.trim() ? '#059669' : '#9ca3af'
                                                }}>
                                                    {answers[q.id]?.trim() ? '✓' : i + 1}
                                                </div>
                                                <div>
                                                    <div style={{
                                                        fontSize: 11, fontWeight: 600, color: '#1a73e8',
                                                        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4
                                                    }}>
                                                        {q.category}
                                                        <span style={{ marginLeft: 8, color: '#9ca3af', fontWeight: 500, textTransform: 'none' }}>
                                                            (Weight: {q.weight} pts)
                                                        </span>
                                                    </div>
                                                    <div style={{ fontWeight: 500, lineHeight: 1.5, color: '#1f2937' }}>{getQText(q)}</div>
                                                </div>
                                            </div>
                                            <textarea
                                                className="form-textarea"
                                                placeholder="Type your answer here. Be specific — mention concrete examples, exact steps you'll take, and specific student actions you expect..."
                                                rows={isActive ? 5 : 3}
                                                value={answers[q.id] || ''}
                                                onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                                                onFocus={() => setActiveQ(i)}
                                                id={`answer-${q.id}`}
                                                style={{ transition: 'all 0.2s' }}
                                            />
                                            <div style={{
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                fontSize: 12, marginTop: 4
                                            }}>
                                                <span style={{
                                                    color: wordCount >= 40 ? '#059669' : wordCount >= 20 ? '#d97706' : '#9ca3af'
                                                }}>
                                                    {wordCount} words
                                                    {wordCount < 20 && ' — aim for 40+ words for full marks'}
                                                    {wordCount >= 20 && wordCount < 40 && ' — good, add more detail for full marks'}
                                                    {wordCount >= 40 && ' ✓'}
                                                </span>
                                                <span style={{ color: '#9ca3af' }}>
                                                    Evaluates: Relevance · Specificity · Depth · Clarity
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                                <button className="btn btn-ghost" onClick={() => setPhase('intro')}>Cancel</button>
                                <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}
                                    onClick={handleSubmit} disabled={!allAnswered || submitting} id="submit-assessment-btn">
                                    {submitting ? 'Evaluating across 4 dimensions...' : 'Submit for Evaluation'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ═══ RESULT PHASE ═══ */}
                    {phase === 'result' && result && (
                        <div>
                            {/* AI Detection Alert */}
                            {result.anyAIDetected && (
                                <div style={{
                                    display: 'flex', alignItems: 'flex-start', gap: 14,
                                    padding: '16px 20px', borderRadius: 12, marginBottom: 20,
                                    background: '#fef2f2', border: '2px solid #dc2626'
                                }}>
                                    <span className="material-icons-outlined" style={{ color: '#dc2626', fontSize: 28, marginTop: 2 }}>gpp_bad</span>
                                    <div>
                                        <div style={{ fontWeight: 700, color: '#dc2626', fontSize: 16, marginBottom: 4 }}>
                                            🚨 AI-Generated Content Detected
                                        </div>
                                        <p style={{ margin: '0 0 10px', color: '#7f1d1d', fontSize: 14, lineHeight: 1.5 }}>
                                            One or more of your answers appear to be generated by AI.
                                            Only <strong>original, authentic responses</strong> are accepted.
                                        </p>
                                        {result.aiFlags?.map((flag, i) => (
                                            <div key={i} style={{
                                                padding: '8px 12px', borderRadius: 8,
                                                background: '#fee2e2', marginBottom: 6, fontSize: 13
                                            }}>
                                                <strong>{flag.category}:</strong> {flag.confidence}% AI confidence
                                                <div style={{ color: '#991b1b', marginTop: 2 }}>
                                                    Signals: {flag.signals.join(' · ')}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Score Card */}
                            <div className="card" style={{ padding: 40, textAlign: 'center', marginBottom: 20 }}>
                                <div style={{
                                    width: 120, height: 120, borderRadius: '50%', margin: '0 auto 12px',
                                    background: getScoreBg(result.score),
                                    border: `4px solid ${getScoreColor(result.score)}`,
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <div style={{ fontSize: 36, fontWeight: 800, color: getScoreColor(result.score) }}>{result.score}</div>
                                    <div style={{ fontSize: 12, color: '#6b7280' }}>/ 100</div>
                                </div>

                                {/* AI Engine Badge */}
                                <div style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                    padding: '4px 12px', borderRadius: 20, marginBottom: 16,
                                    background: aiEngine === 'gemini' ? '#e8f0fe' : '#f3f4f6',
                                    fontSize: 11, fontWeight: 600,
                                    color: aiEngine === 'gemini' ? '#1a73e8' : '#6b7280'
                                }}>
                                    <span className="material-icons-outlined" style={{ fontSize: 14 }}>
                                        {aiEngine === 'gemini' ? 'auto_awesome' : 'rule'}
                                    </span>
                                    {aiEngine === 'gemini' ? 'Evaluated by Gemini AI' : 'Rule-based evaluation'}
                                </div>

                                <h2 style={{ marginBottom: 8 }}>
                                    {result.anyAIDetected
                                        ? '🚫 Assessment Failed — AI Content'
                                        : result.cleared || result.score >= 70
                                            ? '🎉 Lesson Cleared!'
                                            : '⚠️ More Preparation Needed'}
                                </h2>
                                <p style={{ color: '#6b7280', marginBottom: 0, maxWidth: 420, margin: '0 auto' }}>
                                    {result.anyAIDetected
                                        ? 'AI-generated answers detected. Please retake using your own authentic responses.'
                                        : result.cleared || result.score >= 70
                                            ? 'You have demonstrated strong readiness. You may submit for HOD approval.'
                                            : 'Review the per-question feedback below and retake after further preparation.'}
                                </p>

                                {(result.cleared || result.score >= 70) && !result.anyAIDetected && (
                                    <div style={{
                                        marginTop: 16, padding: '10px 16px', borderRadius: 10,
                                        background: '#ecfdf5', color: '#059669',
                                        fontWeight: 600, fontSize: 14,
                                        display: 'inline-flex', alignItems: 'center', gap: 6
                                    }}>
                                        <span className="material-icons-outlined" style={{ fontSize: 18 }}>verified</span>
                                        Submission unlocked
                                    </div>
                                )}
                            </div>

                            {/* Per-Question Breakdown */}
                            {result.perQuestion && (
                                <div className="card" style={{ padding: 24, marginBottom: 20 }}>
                                    <h3 style={{ marginBottom: 16 }}>Per-Question Analysis</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                        {result.perQuestion.map((pq, i) => {
                                            const gc = gradeConfig[pq.grade] || gradeConfig.INSUFFICIENT;
                                            return (
                                                <div key={pq.questionId} style={{
                                                    borderRadius: 10, border: `1px solid ${gc.color}30`,
                                                    overflow: 'hidden'
                                                }}>
                                                    {/* Question header */}
                                                    <div style={{
                                                        padding: '12px 16px', background: gc.bg,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                            <span className="material-icons-outlined" style={{ color: gc.color, fontSize: 20 }}>{gc.icon}</span>
                                                            <div>
                                                                <div style={{ fontWeight: 600, fontSize: 13 }}>Q{i + 1}: {pq.category}</div>
                                                                <div style={{ fontSize: 11, color: '#6b7280' }}>{gc.label} · {pq.wordCount || 0} words</div>
                                                            </div>
                                                        </div>
                                                        <div style={{
                                                            fontWeight: 800, fontSize: 18, color: gc.color
                                                        }}>
                                                            {pq.score}/{pq.maxScore}
                                                        </div>
                                                    </div>

                                                    {/* Score breakdown bars */}
                                                    {pq.breakdown && (
                                                        <div style={{ padding: '12px 16px' }}>
                                                            {[
                                                                { label: 'Relevance', value: pq.breakdown.relevance },
                                                                { label: 'Specificity', value: pq.breakdown.specificity },
                                                                { label: 'Depth', value: pq.breakdown.depth },
                                                                { label: 'Clarity', value: pq.breakdown.clarity },
                                                            ].map(dim => (
                                                                <div key={dim.label} style={{
                                                                    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6
                                                                }}>
                                                                    <span style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', width: 72, flexShrink: 0 }}>{dim.label}</span>
                                                                    <div style={{
                                                                        flex: 1, height: 6, background: '#e5e7eb',
                                                                        borderRadius: 3, overflow: 'hidden'
                                                                    }}>
                                                                        <div style={{
                                                                            height: '100%', borderRadius: 3,
                                                                            width: `${(dim.value / 25) * 100}%`,
                                                                            background: dim.value >= 20 ? '#059669' : dim.value >= 12 ? '#d97706' : '#dc2626',
                                                                            transition: 'width 0.5s'
                                                                        }} />
                                                                    </div>
                                                                    <span style={{ fontSize: 11, fontWeight: 600, width: 32, textAlign: 'right', color: '#374151' }}>
                                                                        {dim.value}/25
                                                                    </span>
                                                                </div>
                                                            ))}

                                                            {/* Feedback */}
                                                            <div style={{
                                                                marginTop: 8, padding: '8px 12px', borderRadius: 6,
                                                                background: '#f9fafb', fontSize: 13, color: '#4b5563', lineHeight: 1.5
                                                            }}>
                                                                {pq.feedback}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Overall Feedback (if no per-question data) */}
                            {!result.perQuestion && (
                                <div className="card" style={{ padding: 24, marginBottom: 20 }}>
                                    <h3 style={{ marginBottom: 14 }}>Feedback</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {(Array.isArray(result.feedback) ? result.feedback : result.feedback?.split('\n') || []).map((fb, i) => {
                                            if (!fb) return null;
                                            const isAIFlag = fb.includes('🤖') || fb.includes('🚨');
                                            return (
                                                <div key={i} style={{
                                                    fontSize: 14, padding: '10px 14px', borderRadius: 8, lineHeight: 1.5,
                                                    background: isAIFlag ? '#fef2f2' : 'var(--bg)',
                                                    border: isAIFlag ? '1px solid #fecaca' : undefined,
                                                    color: isAIFlag ? '#991b1b' : undefined
                                                }}>
                                                    {fb}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: 12 }}>
                                <button className="btn btn-ghost" onClick={handleStart}>
                                    <span className="material-icons-outlined">refresh</span>
                                    Retake
                                </button>
                                {(result.cleared || result.score >= 70) && !result.anyAIDetected && (
                                    <button className="btn btn-primary"
                                        style={{ flex: 1, justifyContent: 'center', background: '#059669' }}
                                        onClick={() => navigate(`/lesson-plans/${lessonPlanId}`)}
                                        id="go-to-plan-btn">
                                        <span className="material-icons-outlined">send</span>
                                        Go to Lesson Plan — Submit for Approval
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default ReadinessPage;
