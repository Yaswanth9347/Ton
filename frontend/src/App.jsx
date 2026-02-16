import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { EmployeeDashboard } from './pages/EmployeeDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import ProfilePage from './pages/ProfilePage';
import GovtBoresPage from './pages/GovtBoresPage';
import BoresPage from './pages/BoresPage';
import { ThemeProvider } from './context/ThemeContext';
import { Toaster } from 'react-hot-toast';
import { Layout } from './components/layout/Layout';
import { EmployeePayrollPage } from './pages/EmployeePayrollPage';

// Helper: SUPERVISOR has the same privileges as ADMIN
const isAdminRole = (role) => role === 'ADMIN' || role === 'SUPERVISOR';

// Protected route component
function ProtectedRoute({ children, requiredRole }) {
    const { user, loading, isAuthenticated } = useAuth();

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
        // SUPERVISOR can access ADMIN routes for Dashboard
        if (requiredRole === 'ADMIN' && (user.role === 'ADMIN' || user.role === 'SUPERVISOR')) {
            return children;
        }
        // EMPLOYEE can access Bores pages even though they are under /admin route prefix
        if (requiredRole === 'ADMIN' && user.role === 'EMPLOYEE') {
            // Exception: Employees cannot access Dashboard
            if (window.location.pathname === '/admin' || window.location.pathname === '/admin/employees') {
                return <Navigate to="/admin/bores" replace />;
            }
            return children;
        }

        if (user.role === 'ADMIN' || user.role === 'SUPERVISOR') {
            return <Navigate to="/admin" replace />;
        }
        return <Navigate to="/admin/bores" replace />;
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
        if (user.role === 'ADMIN' || user.role === 'SUPERVISOR') {
            return <Navigate to="/admin" replace />;
        }
        return <Navigate to="/admin/bores" replace />;
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
