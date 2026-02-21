import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    LayoutDashboard,
    Users,
    CalendarCheck,
    BarChart3,
    Settings,
    LogOut,
    ChevronLeft,
    ChevronRight,
    Droplets,
    Wallet,
} from 'lucide-react';
import { useState } from 'react';

export function Sidebar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [collapsed, setCollapsed] = useState(false);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';

    const employeeLinks = [
        { path: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
        { path: '/payroll', label: 'Payroll', icon: <Wallet size={20} /> },
    ];

    const adminLinks = [
        { path: '/admin', label: 'Dashboard', icon: <LayoutDashboard size={20} />, end: true },
        { path: '/admin/employees', label: 'Employees', icon: <Users size={20} /> },
        { path: '/admin/attendance', label: 'Attendance', icon: <CalendarCheck size={20} /> },
        { path: '/admin/govt-bores', label: 'Govt Bores', icon: <Droplets size={20} /> },
        { path: '/admin/bores', label: 'Private Bores', icon: <Droplets size={20} /> },
        { path: '/admin/analytics', label: 'Analytics', icon: <BarChart3 size={20} /> },
        { path: '/admin/payroll', label: 'Payroll', icon: <Wallet size={20} /> },
        { path: '/admin/settings', label: 'Settings', icon: <Settings size={20} /> },
    ];

    const links = isAdmin ? adminLinks : employeeLinks;

    const getPhotoUrl = () => {
        if (user?.profilePhotoUrl) {
            if (user.profilePhotoUrl.startsWith('http')) return user.profilePhotoUrl;
            const apiUrl = import.meta.env.VITE_API_URL || '/api';
            const baseUrl = apiUrl.replace('/api', '');
            const photoPath = user.profilePhotoUrl.startsWith('/') ? user.profilePhotoUrl : `/${user.profilePhotoUrl}`;
            if (!baseUrl) return photoPath;
            const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
            return `${cleanBase}${photoPath}`;
        }
        return null;
    };

    return (
        <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
            {/* Brand */}
            {/* ... (keep existing brand code) ... */}
            <div
                className="sidebar__brand"
                onClick={() => collapsed && setCollapsed(false)}
                style={{ cursor: collapsed ? 'pointer' : 'default' }}
            >
                <div className="sidebar__brand-link">
                    <span className="sidebar__logo">
                        <img src="/logo.png" alt="JMJ Logo" className="sidebar__logo-img" />
                    </span>
                    {!collapsed && (
                        <span className="sidebar__brand-text">Management</span>
                    )}
                </div>
                {!collapsed && (
                    <button
                        className="sidebar__toggle"
                        onClick={(e) => {
                            e.stopPropagation();
                            setCollapsed(!collapsed);
                        }}
                        title="Collapse sidebar"
                    >
                        <ChevronLeft size={16} />
                    </button>
                )}
            </div>

            {/* Navigation */}
            <nav className="sidebar__nav">
                {links.map((link) => (
                    <NavLink
                        key={link.path}
                        to={link.path}
                        end={link.end || false}
                        className={({ isActive }) =>
                            `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
                        }
                        title={collapsed ? link.label : undefined}
                    >
                        <span className="sidebar__link-icon">{link.icon}</span>
                        {!collapsed && <span className="sidebar__link-text">{link.label}</span>}
                    </NavLink>
                ))}
            </nav>

            {/* User Section */}
            <div className="sidebar__footer">
                <NavLink
                    to="/profile"
                    className={({ isActive }) =>
                        `sidebar__user ${isActive ? 'sidebar__user--active' : ''}`
                    }
                    title="Edit Profile"
                >
                    <div className="sidebar__avatar">
                        {getPhotoUrl() ? (
                            <img
                                src={getPhotoUrl()}
                                alt="Profile"
                                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                            />
                        ) : (
                            <>{user?.firstName?.[0]}{user?.lastName?.[0]}</>
                        )}
                    </div>
                    {!collapsed && (
                        <div className="sidebar__user-info">
                            <div className="sidebar__user-name">
                                {user?.firstName} {user?.lastName}
                            </div>
                        </div>
                    )}
                </NavLink>
                <button
                    className="sidebar__logout"
                    onClick={handleLogout}
                    title="Logout"
                >
                    <span className="sidebar__link-icon">
                        <LogOut size={20} />
                    </span>
                    {!collapsed && <span className="sidebar__link-text">Logout</span>}
                </button>
            </div>
        </aside>
    );
}
