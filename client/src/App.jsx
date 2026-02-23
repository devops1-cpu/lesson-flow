import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import LessonPlansPage from './pages/LessonPlansPage';
import LessonPlanDetail from './pages/LessonPlanDetail';
import CreateLessonPlan from './pages/CreateLessonPlan';
import ClassesPage from './pages/ClassesPage';
import ClassDetail from './pages/ClassDetail';
import UsersPage from './pages/UsersPage';
import HodDashboard from './pages/HodDashboard';
import OcrCapturePage from './pages/OcrCapturePage';
import ReadinessPage from './pages/ReadinessPage';
import AdminManagement from './pages/AdminManagement';
import ProcessDashboard from './pages/ProcessDashboard';
import TimetablePage from './pages/TimetablePage';
import PublicTimetablePage from './pages/PublicTimetablePage';
import AssignLessonPlans from './pages/AssignLessonPlans';
import SettingsPage from './pages/SettingsPage';

function App() {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    // If not logged in, show auth pages
    if (!user) {
        return (
            <Routes>
                <Route path="/public-timetable" element={<PublicTimetablePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        );
    }

    return (
        <div className="app-layout">
            <Sidebar />
            <main className="app-main">
                <Routes>
                    <Route path="/public-timetable" element={<PublicTimetablePage />} />
                    <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                    <Route path="/lesson-plans" element={<ProtectedRoute><LessonPlansPage /></ProtectedRoute>} />
                    <Route path="/lesson-plans/:id" element={<ProtectedRoute><LessonPlanDetail /></ProtectedRoute>} />
                    <Route path="/lesson-plans/assign" element={<ProtectedRoute><AssignLessonPlans /></ProtectedRoute>} />
                    <Route path="/lesson-plans/create" element={<ProtectedRoute><CreateLessonPlan /></ProtectedRoute>} />
                    <Route path="/lesson-plans/:id/edit" element={
                        <ProtectedRoute roles={['ADMIN', 'TEACHER']}>
                            <CreateLessonPlan />
                        </ProtectedRoute>
                    } />
                    <Route path="/create-lesson" element={
                        <ProtectedRoute roles={['ADMIN', 'TEACHER']}>
                            <CreateLessonPlan />
                        </ProtectedRoute>
                    } />
                    <Route path="/classes" element={<ProtectedRoute><ClassesPage /></ProtectedRoute>} />
                    <Route path="/classes/:id" element={<ProtectedRoute><ClassDetail /></ProtectedRoute>} />
                    <Route path="/users" element={
                        <ProtectedRoute roles={['ADMIN']}>
                            <UsersPage />
                        </ProtectedRoute>
                    } />
                    <Route path="/hod-review" element={
                        <ProtectedRoute roles={['HOD', 'ADMIN']}>
                            <HodDashboard />
                        </ProtectedRoute>
                    } />
                    <Route path="/ocr-scan" element={
                        <ProtectedRoute roles={['ADMIN', 'TEACHER']}>
                            <OcrCapturePage />
                        </ProtectedRoute>
                    } />
                    <Route path="/lesson-plans/:id/readiness" element={
                        <ProtectedRoute roles={['ADMIN', 'TEACHER']}>
                            <ReadinessPage />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin-manage" element={
                        <ProtectedRoute roles={['ADMIN']}>
                            <AdminManagement />
                        </ProtectedRoute>
                    } />
                    <Route path="/settings" element={
                        <ProtectedRoute roles={['ADMIN']}>
                            <SettingsPage />
                        </ProtectedRoute>
                    } />
                    <Route path="/process-dashboard" element={
                        <ProtectedRoute roles={['PROCESS_DEPT', 'ADMIN']}>
                            <ProcessDashboard />
                        </ProtectedRoute>
                    } />
                    <Route path="/timetable" element={
                        <ProtectedRoute roles={['ADMIN', 'HOD', 'TEACHER', 'STUDENT']}>
                            <TimetablePage />
                        </ProtectedRoute>
                    } />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </main>
        </div>
    );
}

export default App;
