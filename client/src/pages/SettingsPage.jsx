import { useState, useEffect } from 'react';
import api from '../services/api';

const SettingsPage = () => {
    const [periods, setPeriods] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form state
    const [editingPeriod, setEditingPeriod] = useState(null);
    const [formData, setFormData] = useState({
        number: '',
        startTime: '',
        endTime: '',
        isBreak: false,
        label: ''
    });

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchPeriods = async () => {
        try {
            const res = await api.get('/admin/periods');
            setPeriods(res.data);
        } catch (error) {
            console.error(error);
            showToast('Failed to fetch period configurations.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPeriods();
    }, []);

    const handleOpenModal = (period = null) => {
        if (period) {
            setEditingPeriod(period);
            setFormData({
                number: period.number,
                startTime: period.startTime,
                endTime: period.endTime,
                isBreak: period.isBreak,
                label: period.label || ''
            });
        } else {
            setEditingPeriod(null);
            setFormData({
                number: periods.length > 0 ? periods[periods.length - 1].number + 1 : 1,
                startTime: '',
                endTime: '',
                isBreak: false,
                label: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingPeriod(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingPeriod) {
                await api.put(`/admin/periods/${editingPeriod.id}`, formData);
                showToast('Period updated successfully.');
            } else {
                await api.post('/admin/periods', formData);
                showToast('Period created successfully.');
            }
            fetchPeriods();
            handleCloseModal();
        } catch (error) {
            console.error(error);
            showToast(error.response?.data?.error || 'Operation failed.', 'error');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this period? This may disrupt timetable schedules.')) return;
        try {
            await api.delete(`/admin/periods/${id}`);
            showToast('Period deleted.');
            fetchPeriods();
        } catch (error) {
            console.error(error);
            showToast('Failed to delete period.', 'error');
        }
    };

    if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}><div className="spinner"></div></div>;

    return (
        <div className="page-container fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">School Time Configuration</h1>
                    <p className="page-subtitle">Manage class periods, breaks, and lunch hours.</p>
                </div>
                <button className="btn btn-primary" onClick={() => handleOpenModal()}>
                    <span className="material-icons-outlined">add</span>
                    Add Period
                </button>
            </div>

            {toast && (
                <div className="toast" style={{ backgroundColor: toast.type === 'error' ? 'var(--error)' : 'var(--success)' }}>
                    {toast.message}
                </div>
            )}

            <div className="card">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Number</th>
                            <th>Time</th>
                            <th>Type</th>
                            <th>Label</th>
                            <th align="right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {periods.length === 0 ? (
                            <tr><td colSpan="5" style={{ textAlign: 'center' }}>No periods configured.</td></tr>
                        ) : periods.map(p => (
                            <tr key={p.id} style={{ background: p.isBreak ? '#fffbeb' : 'inherit' }}>
                                <td>{p.number}</td>
                                <td>
                                    <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{p.startTime} - {p.endTime}</div>
                                </td>
                                <td>
                                    {p.isBreak ? (
                                        <span className="badge" style={{ background: '#fef3c7', color: '#b45309' }}>Break</span>
                                    ) : (
                                        <span className="badge" style={{ background: '#e0e7ff', color: '#3730a3' }}>Class</span>
                                    )}
                                </td>
                                <td>{p.label || '-'}</td>
                                <td align="right">
                                    <button className="btn-icon" onClick={() => handleOpenModal(p)}>
                                        <span className="material-icons-outlined">edit</span>
                                    </button>
                                    <button className="btn-icon" onClick={() => handleDelete(p.id)} style={{ color: 'var(--error)' }}>
                                        <span className="material-icons-outlined">delete</span>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ width: '400px' }}>
                        <div className="modal-header">
                            <h2>{editingPeriod ? 'Edit Period' : 'New Period'}</h2>
                            <button className="btn-icon" onClick={handleCloseModal}>
                                <span className="material-icons-outlined">close</span>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="modal-body form-group">
                            <label>Period Number</label>
                            <input
                                type="number"
                                className="input-field"
                                required
                                value={formData.number}
                                onChange={e => setFormData({ ...formData, number: e.target.value })}
                            />

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
                                <div>
                                    <label>Start Time (e.g. 08:00)</label>
                                    <input
                                        type="time"
                                        className="input-field"
                                        required
                                        value={formData.startTime}
                                        onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label>End Time (e.g. 08:40)</label>
                                    <input
                                        type="time"
                                        className="input-field"
                                        required
                                        value={formData.endTime}
                                        onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                                    />
                                </div>
                            </div>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={formData.isBreak}
                                    onChange={e => setFormData({ ...formData, isBreak: e.target.checked })}
                                />
                                Is this a Break/Lunch?
                            </label>

                            {formData.isBreak && (
                                <div style={{ marginTop: '16px' }}>
                                    <label>Break Label (e.g. Lunch)</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        value={formData.label}
                                        onChange={e => setFormData({ ...formData, label: e.target.value })}
                                    />
                                </div>
                            )}

                            <div className="modal-actions" style={{ marginTop: '24px' }}>
                                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Save Period</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SettingsPage;
