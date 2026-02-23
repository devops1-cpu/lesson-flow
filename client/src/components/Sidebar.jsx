import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ChangePasswordModal from './ChangePasswordModal';

const Sidebar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [showPasswordModal, setShowPasswordModal] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const getInitials = (name) => {
        return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
    };

    const navItems = [
        { path: '/', icon: 'dashboard', label: 'Dashboard', roles: ['ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'PROCESS_DEPT'] },
        { path: '/hod-review', icon: 'verified', label: 'Review Center', roles: ['HOD'] },
        { path: '/lesson-plans', icon: 'auto_stories', label: 'Lesson Plans', roles: ['ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'HOD', 'PROCESS_DEPT'] },
        { path: '/classes', icon: 'school', label: 'Classes', roles: ['ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'HOD'] },
        { path: '/timetable', icon: 'calendar_month', label: 'Timetable', roles: ['ADMIN', 'HOD', 'TEACHER', 'STUDENT'] },
        { path: '/ocr-scan', icon: 'document_scanner', label: 'Scan Physical Plan', roles: ['ADMIN', 'TEACHER'] },
        { path: '/admin-manage', icon: 'admin_panel_settings', label: 'Admin Panel', roles: ['ADMIN'] },
        { path: '/settings', icon: 'settings', label: 'School Settings', roles: ['ADMIN'] },
        { path: '/process-dashboard', icon: 'monitoring', label: 'Process Department', roles: ['PROCESS_DEPT', 'ADMIN'] },
        { path: '/users', icon: 'people', label: 'Manage Users', roles: ['ADMIN'] },
    ];

    const filteredItems = navItems.filter(item => item.roles.includes(user?.role));

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <div className="sidebar-logo-icon">LF</div>
                <h1>LessonFlow</h1>
            </div>

            <nav className="sidebar-nav">
                <div className="sidebar-section-title">Main Menu</div>
                {filteredItems.map(item => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        end={item.path === '/'}
                        className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
                    >
                        <span className="material-icons-outlined">{item.icon}</span>
                        {item.label}
                    </NavLink>
                ))}
            </nav>

            <div className="sidebar-user">
                <div className="sidebar-user-avatar">{getInitials(user?.name)}</div>
                <div className="sidebar-user-info">
                    <div className="sidebar-user-name">{user?.name}</div>
                    <div className="sidebar-user-role">{user?.role?.toLowerCase()}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <button className="btn-icon" onClick={() => setShowPasswordModal(true)} title="Change Password" style={{ marginBottom: 4 }}>
                        <span className="material-icons-outlined" style={{ fontSize: 20 }}>vpn_key</span>
                    </button>
                    <button className="btn-icon" onClick={handleLogout} title="Logout">
                        <span className="material-icons-outlined" style={{ fontSize: 20, color: 'var(--error)' }}>logout</span>
                    </button>
                </div>
            </div>

            {showPasswordModal && (
                <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
            )}
        </aside>
    );
};

export default Sidebar;
