import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import { EmployeeDashboard } from './pages/EmployeeDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import ProfilePage from './pages/ProfilePage';
import GovtBoresPage from './pages/GovtBoresPage';
import BoresPage from './pages/BoresPage';
import { ThemeProvider } from './context/ThemeContext';
import { Toaster } from 'react-hot-toast';
import { Layout } from './components/layout/Layout';
import { EmployeePayrollPage } from './pages/EmployeePayrollPage';
import { InventoryPage } from './pages/admin/inventory/InventoryPage';

// Helper: strict admin check
const isAdminRole = (role) => role === 'ADMIN';

// Operational paths that SUPERVISOR can access at admin level
const SUPERVISOR_ALLOWED_PATHS = ['/admin/govt-bores', '/admin/bores', '/admin/inventory'];

// Protected route component
function ProtectedRoute({ children, requiredRole }) {
    const { user, loading, isAuthenticated } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="loading" style={{ minHeight: '100vh' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (requiredRole && user.role !== requiredRole) {
        // SUPERVISOR inherits Employee access — allow Employee routes
        if (requiredRole === 'EMPLOYEE' && user.role === 'SUPERVISOR') {
            return children;
        }
        // SUPERVISOR can access specific operational admin routes
        if (requiredRole === 'ADMIN' && user.role === 'SUPERVISOR') {
            const currentPath = location.pathname;
            if (SUPERVISOR_ALLOWED_PATHS.some(p => currentPath.startsWith(p))) {
                return children;
            }
            // Supervisor trying to access restricted admin routes → redirect to employee dashboard
            return <Navigate to="/dashboard" replace />;
        }
        if (isAdminRole(user.role)) {
            return <Navigate to="/admin" replace />;
        }
        return <Navigate to="/dashboard" replace />;
    }

    return children;
}

// Redirect authenticated users away from login
function PublicRoute({ children }) {
    const { user, loading, isAuthenticated } = useAuth();

    if (loading) {
        return (
            <div className="loading" style={{ minHeight: '100vh' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    if (isAuthenticated) {
        if (isAdminRole(user.role)) {
            return <Navigate to="/admin" replace />;
        }
        // SUPERVISOR and EMPLOYEE -> employee dashboard
        return <Navigate to="/dashboard" replace />;
    }

    return children;
}

function AppRoutes() {
    return (
        <Routes>
            {/* Public routes */}
            <Route
                path="/login"
                element={
                    <PublicRoute>
                        <LoginPage />
                    </PublicRoute>
                }
            />
            <Route
                path="/forgot-password"
                element={
                    <PublicRoute>
                        <ForgotPasswordPage />
                    </PublicRoute>
                }
            />
            <Route
                path="/reset-password/:token"
                element={<ResetPasswordPage />}
            />

            {/* Employee routes — wrapped in Layout */}
            <Route
                path="/dashboard"
                element={
                    <ProtectedRoute requiredRole="EMPLOYEE">
                        <Layout><EmployeeDashboard /></Layout>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/profile"
                element={
                    <ProtectedRoute>
                        <Layout><ProfilePage /></Layout>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/payroll"
                element={
                    <ProtectedRoute requiredRole="EMPLOYEE">
                        <Layout><EmployeePayrollPage /></Layout>
                    </ProtectedRoute>
                }
            />

            {/* Admin routes — each tab is a separate route */}
            <Route
                path="/admin"
                element={
                    <ProtectedRoute requiredRole="ADMIN">
                        <Layout><AdminDashboard tab="dashboard" /></Layout>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/employees"
                element={
                    <ProtectedRoute requiredRole="ADMIN">
                        <Layout><AdminDashboard tab="employees" /></Layout>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/attendance"
                element={
                    <ProtectedRoute requiredRole="ADMIN">
                        <Layout><AdminDashboard tab="attendance" /></Layout>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/govt-bores"
                element={
                    <ProtectedRoute requiredRole="ADMIN">
                        <Layout><GovtBoresPage /></Layout>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/bores"
                element={
                    <ProtectedRoute requiredRole="ADMIN">
                        <Layout><BoresPage /></Layout>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/analytics"
                element={
                    <ProtectedRoute requiredRole="ADMIN">
                        <Layout><AdminDashboard tab="analytics" /></Layout>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/settings"
                element={
                    <ProtectedRoute requiredRole="ADMIN">
                        <Layout><AdminDashboard tab="settings" /></Layout>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/inventory"
                element={
                    <ProtectedRoute requiredRole="ADMIN">
                        <Layout><InventoryPage /></Layout>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/payroll"
                element={
                    <ProtectedRoute requiredRole="ADMIN">
                        <Layout><AdminDashboard tab="payroll" /></Layout>
                    </ProtectedRoute>
                }
            />

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* 404 */}
            <Route
                path="*"
                element={
                    <div className="container page text-center">
                        <h1>404</h1>
                        <p>Page not found</p>
                        <a href="/login">Go to Login</a>
                    </div>
                }
            />
        </Routes>
    );
}

export default function App() {
    return (
        <BrowserRouter
            future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true,
            }}
        >
            <ThemeProvider>
                <AuthProvider>
                    <Toaster position="top-right" />
                    <AppRoutes />
                </AuthProvider>
            </ThemeProvider>
        </BrowserRouter>
    );
}
