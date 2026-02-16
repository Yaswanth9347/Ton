import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ThemeToggle } from '../common/ThemeToggle';
import { Button } from '../common/Button';

export function Navbar({ activeTab, onTabChange }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';

    // Employee navigation links
    const employeeLinks = [
        { path: '/dashboard', label: 'Home' },
        { path: '/leaves', label: 'Leaves' },
        { path: '/holidays', label: 'Holidays' },
        { path: '/expenses', label: 'Expenses' },
        { path: '/payslips', label: 'Payslips' },
    ];

    // Admin tabs
    const adminTabs = [
        { key: 'dashboard', label: 'Dashboard' },
        { key: 'employees', label: 'Employees' },
        { key: 'attendance', label: 'Attendance' },
        { key: 'analytics', label: 'Analytics' },
        { key: 'leaves', label: 'Leaves' },
        { key: 'holidays', label: 'Holidays' },
        { key: 'expenses', label: 'Expenses Claims' },
        { key: 'payroll', label: 'Payroll' },
        { key: 'settings', label: 'Settings' },
    ];

    return (
        <nav className="navbar">
            <div className="container navbar-content">
                <div className="navbar-left">
                    <Link to={isAdmin ? "/admin" : "/dashboard"} className="navbar-brand">
                        <span className="navbar-logo">JMJ</span>
                        {isAdmin && <span className="navbar-admin-badge">Admin</span>}
                    </Link>

                    <div className="navbar-nav">
                        {!isAdmin ? (
                            // Employee navigation
                            employeeLinks.map(link => (
                                <Link
                                    key={link.path}
                                    to={link.path}
                                    className={`navbar-link ${location.pathname === link.path ? 'active' : ''}`}
                                >
                                    <span className="navbar-link-icon">{link.icon}</span>
                                    <span className="navbar-link-text">{link.label}</span>
                                </Link>
                            ))
                        ) : (
                            // Admin tabs
                            adminTabs.map(tab => (
                                <button
                                    key={tab.key}
                                    className={`navbar-link ${activeTab === tab.key ? 'active' : ''}`}
                                    onClick={() => onTabChange?.(tab.key)}
                                >
                                    <span className="navbar-link-icon">{tab.icon}</span>
                                    <span className="navbar-link-text">{tab.label}</span>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                <div className="navbar-right">
                    <ThemeToggle />

                    <Link to="/profile" className="navbar-profile" title="Edit Profile">
                        <div className="navbar-avatar">
                            {user?.firstName?.[0]}{user?.lastName?.[0]}
                        </div>
                        <div className="navbar-user-info">
                            <div className="navbar-user-name">{user?.firstName} {user?.lastName}</div>
                            <div className="navbar-user-role">{isAdmin ? 'Administrator' : 'Employee'}</div>
                        </div>
                    </Link>

                    <Button variant="secondary" size="sm" onClick={handleLogout}>
                        Logout
                    </Button>
                </div>
            </div>
        </nav>
    );
}
