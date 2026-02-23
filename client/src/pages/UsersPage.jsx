import { useState, useEffect } from 'react';
import Header from '../components/Header';
import api from '../services/api';

const UsersPage = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [roleFilter, setRoleFilter] = useState('');
    const [search, setSearch] = useState('');

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newUserForm, setNewUserForm] = useState({ name: '', email: '', password: '', role: 'STUDENT' });
    const [createLoading, setCreateLoading] = useState(false);
    const [createError, setCreateError] = useState('');

    useEffect(() => { fetchUsers(); }, [roleFilter]);

    const fetchUsers = async () => {
        try {
            let url = '/users';
            const params = [];
            if (roleFilter) params.push(`role=${roleFilter}`);
            if (search) params.push(`search=${search}`);
            if (params.length) url += `?${params.join('&')}`;
            const res = await api.get(url);
            setUsers(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        fetchUsers();
    };

    const changeRole = async (userId, newRole) => {
        try {
            await api.put(`/users/${userId}/role`, { role: newRole });
            setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
        } catch (err) { console.error(err); }
    };

    const deleteUser = async (userId) => {
        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
        try {
            await api.delete(`/users/${userId}`);
            setUsers(users.filter(u => u.id !== userId));
        } catch (err) { console.error(err); }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setCreateError('');
        setCreateLoading(true);
        try {
            const res = await api.post('/admin/users', newUserForm);
            setUsers([res.data, ...users]);
            setShowCreateModal(false);
            setNewUserForm({ name: '', email: '', password: '', role: 'STUDENT' });
        } catch (err) {
            setCreateError(err.response?.data?.error || 'Failed to create user');
        } finally {
            setCreateLoading(false);
        }
    };

    return (
        <>
            <Header title="Manage Users">
                <form onSubmit={handleSearch} className="header-search">
                    <span className="material-icons-outlined">search</span>
                    <input type="text" placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} id="search-users" />
                </form>
                <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                    <span className="material-icons-outlined">add</span> Create User
                </button>
            </Header>
            <div className="app-content">
                {/* Filters */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
                    {['', 'ADMIN', 'HOD', 'TEACHER', 'STUDENT', 'PARENT'].map(role => (
                        <button key={role} className={`btn ${roleFilter === role ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setRoleFilter(role)} style={{ textTransform: 'capitalize', padding: '6px 16px', fontSize: '13px' }}>
                            {role || 'All'}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="loading"><div className="spinner"></div></div>
                ) : users.length > 0 ? (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr><th>Name</th><th>Email</th><th>Role</th><th>Classes</th><th>Plans</th><th>Actions</th></tr>
                            </thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u.id}>
                                        <td style={{ fontWeight: 500 }}>{u.name}</td>
                                        <td style={{ color: 'var(--text-secondary)' }}>{u.email}</td>
                                        <td>
                                            <select value={u.role} onChange={(e) => changeRole(u.id, e.target.value)} style={{ border: 'none', background: 'transparent', fontWeight: 500, fontSize: '13px', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', color: u.role === 'ADMIN' ? '#c62828' : u.role === 'TEACHER' ? '#2e7d32' : u.role === 'STUDENT' ? '#1565c0' : '#7b1fa2' }}>
                                                <option value="ADMIN">Admin</option>
                                                <option value="TEACHER">Teacher</option>
                                                <option value="STUDENT">Student</option>
                                                <option value="PARENT">Parent</option>
                                            </select>
                                        </td>
                                        <td>{u._count?.classMemberships || 0}</td>
                                        <td>{u._count?.lessonPlans || 0}</td>
                                        <td>
                                            <button className="btn-icon" onClick={() => deleteUser(u.id)} title="Delete user">
                                                <span className="material-icons-outlined" style={{ fontSize: '18px', color: 'var(--error)' }}>delete</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="empty-state"><span className="material-icons-outlined">people</span><h3>No users found</h3></div>
                )}
            </div>

            {/* Create User Modal */}
            {showCreateModal && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '450px' }}>
                        <div className="modal-header">
                            <h2>Create New User</h2>
                            <button className="btn-icon" onClick={() => setShowCreateModal(false)}>
                                <span className="material-icons-outlined">close</span>
                            </button>
                        </div>
                        <form onSubmit={handleCreateUser} className="modal-body">
                            {createError && <div className="alert alert-error" style={{ marginBottom: 15 }}>{createError}</div>}

                            <div className="form-group">
                                <label className="form-label">Full Name</label>
                                <input type="text" className="form-input" required value={newUserForm.name} onChange={e => setNewUserForm({ ...newUserForm, name: e.target.value })} />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Email Address</label>
                                <input type="email" className="form-input" required value={newUserForm.email} onChange={e => setNewUserForm({ ...newUserForm, email: e.target.value })} />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Initial Password</label>
                                <input type="text" className="form-input" required minLength={6} value={newUserForm.password} onChange={e => setNewUserForm({ ...newUserForm, password: e.target.value })} />
                                <small style={{ color: '#666', marginTop: 4, display: 'block' }}>User can change this after logging in.</small>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Role</label>
                                <select className="form-input" value={newUserForm.role} onChange={e => setNewUserForm({ ...newUserForm, role: e.target.value })}>
                                    <option value="TEACHER">Teacher</option>
                                    <option value="STUDENT">Student</option>
                                    <option value="PARENT">Parent</option>
                                    <option value="HOD">HOD</option>
                                    <option value="ADMIN">Admin</option>
                                </select>
                            </div>

                            <div className="form-actions" style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                                <button type="button" className="btn btn-ghost" onClick={() => setShowCreateModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={createLoading}>
                                    {createLoading ? 'Creating...' : 'Create User'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};

export default UsersPage;
