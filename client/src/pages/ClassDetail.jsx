import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import api from '../services/api';

const ClassDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [classData, setClassData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showAddMember, setShowAddMember] = useState(false);
    const [searchEmail, setSearchEmail] = useState('');
    const [searchResults, setSearchResults] = useState([]);

    useEffect(() => { fetchClass(); }, [id]);

    const fetchClass = async () => {
        try {
            const res = await api.get(`/classes/${id}`);
            setClassData(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const searchUsers = async () => {
        if (!searchEmail.trim()) return;
        try {
            const res = await api.get(`/users?search=${searchEmail}`);
            setSearchResults(res.data);
        } catch (err) { console.error(err); }
    };

    const addMember = async (userId) => {
        try {
            await api.post(`/classes/${id}/members`, { userIds: [userId] });
            fetchClass();
            setShowAddMember(false);
            setSearchEmail('');
            setSearchResults([]);
        } catch (err) { console.error(err); }
    };

    const removeMember = async (userId) => {
        if (!confirm('Remove this member?')) return;
        try {
            await api.delete(`/classes/${id}/members/${userId}`);
            fetchClass();
        } catch (err) { console.error(err); }
    };

    const canManage = user?.role === 'ADMIN' || (user?.role === 'TEACHER' && classData?.ownerId === user?.id);
    const classColors = ['#1a73e8', '#01796f', '#137333', '#e37400', '#8430ce'];

    if (loading) {
        return (<><Header title="Class" /><div className="app-content"><div className="loading"><div className="spinner"></div></div></div></>);
    }

    if (!classData) {
        return (<><Header title="Class" /><div className="app-content"><div className="empty-state"><span className="material-icons-outlined">error_outline</span><h3>Class not found</h3></div></div></>);
    }

    return (
        <>
            <Header title={classData.name}>
                <button className="btn btn-ghost" onClick={() => navigate('/classes')}>
                    <span className="material-icons-outlined">arrow_back</span> Back
                </button>
            </Header>
            <div className="app-content">
                {/* Class Header */}
                <div className="detail-header animate-in" style={{ background: classData.coverColor || 'var(--primary)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-xl)' }}>
                    <h1>{classData.name}</h1>
                    <div className="lesson-meta" style={{ marginTop: '12px' }}>
                        {classData.subject && <span className="lesson-meta-item" style={{ color: 'rgba(255,255,255,0.9)' }}><span className="material-icons-outlined">subject</span>{classData.subject}</span>}
                        {classData.grade && <span className="lesson-meta-item" style={{ color: 'rgba(255,255,255,0.9)' }}><span className="material-icons-outlined">school</span>Grade {classData.grade}</span>}
                        {classData.section && <span className="lesson-meta-item" style={{ color: 'rgba(255,255,255,0.9)' }}><span className="material-icons-outlined">class</span>Section {classData.section}</span>}
                        <span className="lesson-meta-item" style={{ color: 'rgba(255,255,255,0.9)' }}><span className="material-icons-outlined">person</span>{classData.owner?.name}</span>
                    </div>
                    {classData.description && <p style={{ marginTop: '12px', fontSize: '14px', opacity: 0.85 }}>{classData.description}</p>}
                </div>

                {/* Members */}
                <div className="section-header">
                    <h2>Members ({classData.members?.length || 0})</h2>
                    {canManage && (
                        <button className="btn btn-primary" onClick={() => setShowAddMember(true)} id="add-member-btn">
                            <span className="material-icons-outlined">person_add</span> Add Member
                        </button>
                    )}
                </div>

                {/* Add Member Modal */}
                {showAddMember && (
                    <div className="modal-overlay" onClick={() => setShowAddMember(false)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>Add Members</h2>
                                <button className="btn-icon" onClick={() => setShowAddMember(false)}><span className="material-icons-outlined">close</span></button>
                            </div>
                            <div className="modal-body">
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                                    <input type="text" className="form-input" placeholder="Search by name or email..." value={searchEmail} onChange={(e) => setSearchEmail(e.target.value)} id="search-member" />
                                    <button className="btn btn-primary" onClick={searchUsers}>Search</button>
                                </div>
                                {searchResults.map(u => (
                                    <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', borderBottom: '1px solid var(--border-light)' }}>
                                        <div>
                                            <div style={{ fontWeight: 500 }}>{u.name}</div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{u.email} • <span className={`badge badge-${u.role.toLowerCase()} badge-role`}>{u.role}</span></div>
                                        </div>
                                        <button className="btn btn-secondary" onClick={() => addMember(u.id)} style={{ padding: '6px 16px', fontSize: '13px' }}>Add</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {classData.members?.length > 0 ? (
                    <div className="table-container mb-lg">
                        <table className="table">
                            <thead>
                                <tr><th>Name</th><th>Email</th><th>Role</th>{canManage && <th>Actions</th>}</tr>
                            </thead>
                            <tbody>
                                {classData.members.map(m => (
                                    <tr key={m.id}>
                                        <td style={{ fontWeight: 500 }}>{m.user.name}</td>
                                        <td>{m.user.email}</td>
                                        <td><span className={`badge badge-${m.user.role.toLowerCase()} badge-role`}>{m.user.role}</span></td>
                                        {canManage && <td><button className="btn-icon" onClick={() => removeMember(m.user.id)} title="Remove"><span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--error)' }}>person_remove</span></button></td>}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="empty-state mb-lg"><span className="material-icons-outlined">people</span><h3>No members yet</h3><p>Add students and parents to this class.</p></div>
                )}

                {/* Lesson Plans */}
                <div className="section-header">
                    <h2>Lesson Plans ({classData.lessonPlans?.length || 0})</h2>
                    {canManage && <button className="btn btn-secondary" onClick={() => navigate('/create-lesson')}>Create Plan</button>}
                </div>

                {classData.lessonPlans?.length > 0 ? (
                    <div className="grid-cards">
                        {classData.lessonPlans.map((plan, i) => (
                            <div key={plan.id} className="card lesson-card animate-in" onClick={() => navigate(`/lesson-plans/${plan.id}`)} style={{ animationDelay: `${i * 100}ms` }}>
                                <div className="card-header" style={{ background: classColors[i % classColors.length] }}>
                                    <h3>{plan.title}</h3>
                                    <span className="card-subtitle">{plan.subject} • Grade {plan.grade}</span>
                                </div>
                                <div className="card-body">
                                    <div className="lesson-meta">
                                        <span className={`badge badge-${plan.status.toLowerCase()}`}>{plan.status}</span>
                                        <span className="lesson-meta-item"><span className="material-icons-outlined">person</span>{plan.teacher?.name}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="empty-state"><span className="material-icons-outlined">auto_stories</span><h3>No lesson plans</h3></div>
                )}
            </div>
        </>
    );
};

export default ClassDetail;
