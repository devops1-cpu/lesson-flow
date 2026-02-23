import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AiAssistant from '../components/AiTutor';
import api from '../services/api';

const statusConfig = {
    DRAFT: { label: 'Draft', color: '#6b7280', bg: '#f3f4f6' },
    SUBMITTED: { label: 'Pending Approval', color: '#d97706', bg: '#fffbeb' },
    CHANGES_REQUESTED: { label: 'Changes Requested', color: '#dc2626', bg: '#fef2f2' },
    APPROVED: { label: 'Approved', color: '#059669', bg: '#ecfdf5' },
    PUBLISHED: { label: 'Published', color: '#1a73e8', bg: '#eff6ff' },
    ARCHIVED: { label: 'Archived', color: '#9ca3af', bg: '#f9fafb' },
};

const RejectModal = ({ plan, onClose, onReject }) => {
    const [comment, setComment] = useState('');
    const [loading, setLoading] = useState(false);

    const handleReject = async () => {
        setLoading(true);
        await onReject(plan.id, comment);
        setLoading(false);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
                <div className="modal-header">
                    <h3 className="modal-title">Request Changes</h3>
                    <button className="btn-icon" onClick={onClose}>
                        <span className="material-icons-outlined">close</span>
                    </button>
                </div>
                <div className="modal-body">
                    <p style={{ color: '#4b5563', marginBottom: 16 }}>
                        Requesting changes for: <strong>{plan.title}</strong>
                    </p>
                    <div className="form-group">
                        <label className="form-label">Feedback / Changes Required *</label>
                        <textarea
                            className="form-textarea"
                            placeholder="Explain what changes are needed..."
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                            rows={4}
                            autoFocus
                        />
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <button
                        className="btn btn-danger"
                        onClick={handleReject}
                        disabled={!comment.trim() || loading}
                    >
                        {loading ? 'Sending...' : 'Request Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const ApproveModal = ({ plan, onClose, onApprove }) => {
    const [comment, setComment] = useState('');
    const [loading, setLoading] = useState(false);

    const handleApprove = async () => {
        setLoading(true);
        await onApprove(plan.id, comment);
        setLoading(false);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
                <div className="modal-header">
                    <h3 className="modal-title">Approve Lesson Plan</h3>
                    <button className="btn-icon" onClick={onClose}>
                        <span className="material-icons-outlined">close</span>
                    </button>
                </div>
                <div className="modal-body">
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: 16,
                        background: '#ecfdf5', borderRadius: 12, marginBottom: 16
                    }}>
                        <span className="material-icons-outlined" style={{ color: '#059669', fontSize: 32 }}>check_circle</span>
                        <div>
                            <div style={{ fontWeight: 600 }}>{plan.title}</div>
                            <div style={{ fontSize: 13, color: '#6b7280' }}>by {plan.teacher?.name}</div>
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Approval Comment (Optional)</label>
                        <textarea
                            className="form-textarea"
                            placeholder="Add feedback or commendation..."
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                            rows={3}
                        />
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <button
                        className="btn btn-primary"
                        onClick={handleApprove}
                        disabled={loading}
                    >
                        {loading ? 'Approving...' : 'Approve Plan'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const HodDashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [plans, setPlans] = useState([]);
    const [filter, setFilter] = useState('SUBMITTED');
    const [loading, setLoading] = useState(true);
    const [rejectModal, setRejectModal] = useState(null);
    const [approveModal, setApproveModal] = useState(null);
    const [toast, setToast] = useState(null);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchPlans = async (status) => {
        setLoading(true);
        try {
            const params = {};
            if (status !== 'ALL') params.status = status;
            const res = await api.get('/lesson-plans', { params });
            setPlans(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPlans(filter);
    }, [filter]);

    const handleApprove = async (planId, comment) => {
        try {
            await api.patch(`/lesson-plans/${planId}/approve`, { comment });
            showToast('Lesson plan approved successfully!');
            setApproveModal(null);
            fetchPlans(filter);
        } catch {
            showToast('Failed to approve plan.', 'error');
        }
    };

    const handleReject = async (planId, comment) => {
        try {
            await api.patch(`/lesson-plans/${planId}/reject`, { comment });
            showToast('Changes requested from teacher.');
            setRejectModal(null);
            fetchPlans(filter);
        } catch {
            showToast('Failed to update plan.', 'error');
        }
    };

    const filters = [
        { key: 'SUBMITTED', label: 'Pending', icon: 'pending' },
        { key: 'APPROVED', label: 'Approved', icon: 'check_circle' },
        { key: 'CHANGES_REQUESTED', label: 'Changes Requested', icon: 'edit_note' },
        { key: 'ALL', label: 'All Plans', icon: 'list' },
    ];

    const pendingCount = plans.filter(p => p.status === 'SUBMITTED').length;

    return (
        <div className="page-container">
            {/* Toast */}
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

            {/* Header */}
            <div className="page-header">
                <div>
                    <h2 className="page-title">HOD Review Center</h2>
                    <p className="page-subtitle">
                        {user?.headedDepartment?.name || 'Your Department'} — Lesson Plan Approval Queue
                    </p>
                </div>
            </div>

            {/* Stats Banner */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
                {[
                    { label: 'Pending Review', value: plans.filter(p => p.status === 'SUBMITTED').length, icon: 'pending', color: '#d97706', bg: '#fffbeb' },
                    { label: 'Approved', value: plans.filter(p => p.status === 'APPROVED').length, icon: 'check_circle', color: '#059669', bg: '#ecfdf5' },
                    { label: 'Changes Requested', value: plans.filter(p => p.status === 'CHANGES_REQUESTED').length, icon: 'edit_note', color: '#dc2626', bg: '#fef2f2' },
                    { label: 'Total Plans', value: plans.length, icon: 'auto_stories', color: '#1a73e8', bg: '#eff6ff' },
                ].map(stat => (
                    <div key={stat.label} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px' }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span className="material-icons-outlined" style={{ color: stat.color, fontSize: 22 }}>{stat.icon}</span>
                        </div>
                        <div>
                            <div style={{ fontSize: 22, fontWeight: 700 }}>{stat.value}</div>
                            <div style={{ fontSize: 12, color: '#6b7280' }}>{stat.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
                {filters.map(f => (
                    <button
                        key={f.key}
                        onClick={() => setFilter(f.key)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '8px 16px', borderRadius: 20, border: 'none',
                            cursor: 'pointer', fontWeight: 500, fontSize: 14,
                            transition: 'all 0.2s',
                            background: filter === f.key ? '#1a73e8' : '#f3f4f6',
                            color: filter === f.key ? '#fff' : '#374151',
                        }}
                    >
                        <span className="material-icons-outlined" style={{ fontSize: 16 }}>{f.icon}</span>
                        {f.label}
                        {f.key === 'SUBMITTED' && pendingCount > 0 && (
                            <span style={{
                                background: '#dc2626', color: '#fff', borderRadius: '50%',
                                width: 18, height: 18, fontSize: 11, display: 'flex',
                                alignItems: 'center', justifyContent: 'center', fontWeight: 700
                            }}>{pendingCount}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Plans List */}
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
                    <div className="spinner" />
                </div>
            ) : plans.length === 0 ? (
                <div className="empty-state">
                    <span className="material-icons-outlined" style={{ fontSize: 64, color: '#d1d5db' }}>inbox</span>
                    <h3>No lesson plans here</h3>
                    <p>{filter === 'SUBMITTED' ? 'No plans pending approval from your teachers.' : 'No plans found for this filter.'}</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {plans.map(plan => {
                        const sc = statusConfig[plan.status] || statusConfig.DRAFT;
                        return (
                            <div key={plan.id} className="card" style={{ padding: '20px 24px', cursor: 'pointer' }}
                                onClick={() => navigate(`/lesson-plans/${plan.id}`)}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{plan.title}</h3>
                                            <span style={{
                                                padding: '2px 10px', borderRadius: 12, fontSize: 11,
                                                fontWeight: 600, background: sc.bg, color: sc.color
                                            }}>{sc.label}</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#6b7280', flexWrap: 'wrap' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <span className="material-icons-outlined" style={{ fontSize: 14 }}>person</span>
                                                {plan.teacher?.name}
                                            </span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <span className="material-icons-outlined" style={{ fontSize: 14 }}>book</span>
                                                {plan.subject} · Grade {plan.grade}
                                            </span>
                                            {plan.submissionDate && (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <span className="material-icons-outlined" style={{ fontSize: 14 }}>schedule</span>
                                                    Submitted {new Date(plan.submissionDate).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                        {plan.approvalComment && (
                                            <div style={{
                                                marginTop: 8, padding: '8px 12px', background: '#f9fafb',
                                                borderRadius: 8, fontSize: 13, color: '#4b5563', borderLeft: `3px solid ${sc.color}`
                                            }}>
                                                <strong>Comment:</strong> {plan.approvalComment}
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    {plan.status === 'SUBMITTED' && (
                                        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}
                                            onClick={e => e.stopPropagation()}>
                                            <button
                                                className="btn btn-ghost"
                                                style={{ color: '#dc2626', borderColor: '#dc2626' }}
                                                onClick={() => setRejectModal(plan)}
                                            >
                                                <span className="material-icons-outlined" style={{ fontSize: 16 }}>close</span>
                                                Request Changes
                                            </button>
                                            <button
                                                className="btn btn-primary"
                                                style={{ background: '#059669' }}
                                                onClick={() => setApproveModal(plan)}
                                            >
                                                <span className="material-icons-outlined" style={{ fontSize: 16 }}>check</span>
                                                Approve
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modals */}
            {approveModal && (
                <ApproveModal
                    plan={approveModal}
                    onClose={() => setApproveModal(null)}
                    onApprove={handleApprove}
                />
            )}
            {rejectModal && (
                <RejectModal
                    plan={rejectModal}
                    onClose={() => setRejectModal(null)}
                    onReject={handleReject}
                />
            )}
        </div>
    );
};

export default HodDashboard;
