import { NavLink, useLocation, useNavigate } from 'react-router-dom';
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
    X,
    Droplets,
    Wallet,
    Landmark,
    Briefcase,
    Package
} from 'lucide-react';
import { useState, useEffect } from 'react';

export function Sidebar({ mobileOpen = false, onMobileClose }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [collapsed, setCollapsed] = useState(false);
    const [imgError, setImgError] = useState(false);
    const effectiveCollapsed = collapsed && !mobileOpen;

    useEffect(() => {
        setImgError(false);
    }, [user?.profilePhotoUrl]);

    useEffect(() => {
        if (mobileOpen) {
            onMobileClose?.();
        }
    }, [location.pathname]);

    const handleLogout = async () => {
        onMobileClose?.();
        await logout();
        navigate('/login');
    };

    const handleNavLinkClick = () => {
        if (mobileOpen) {
            onMobileClose?.();
        }
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
        { path: '/admin/govt-bores', label: 'Govt Bores', icon: <Landmark size={20} /> },
        { path: '/admin/bores', label: 'Private Bores', icon: <Briefcase size={20} /> },
        { path: '/admin/inventory', label: 'Inventory', icon: <Package size={20} /> },
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
        <aside className={`sidebar ${effectiveCollapsed ? 'sidebar--collapsed' : ''} ${mobileOpen ? 'sidebar--mobile-open' : ''}`}>
            {/* Brand */}
            {/* ... (keep existing brand code) ... */}
            <div
                className="sidebar__brand"
                onClick={() => effectiveCollapsed && setCollapsed(false)}
                style={{ cursor: effectiveCollapsed ? 'pointer' : 'default' }}
            >
                <div className="sidebar__brand-link">
                    <span className="sidebar__logo">
                        <img src="/logo.png" alt="JMJ Logo" className="sidebar__logo-img" />
                    </span>
                    {!effectiveCollapsed && (
                        <span className="sidebar__brand-text">Management</span>
                    )}
                </div>
                <button
                    type="button"
                    className="sidebar__mobile-close"
                    onClick={(e) => {
                        e.stopPropagation();
                        onMobileClose?.();
                    }}
                    aria-label="Close navigation menu"
                >
                    <X size={18} />
                </button>
                {!effectiveCollapsed && !mobileOpen && (
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
                        onClick={handleNavLinkClick}
                        className={({ isActive }) =>
                            `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
                        }
                        title={effectiveCollapsed ? link.label : undefined}
                    >
                        <span className="sidebar__link-icon">{link.icon}</span>
                        {!effectiveCollapsed && <span className="sidebar__link-text">{link.label}</span>}
                    </NavLink>
                ))}
            </nav>

            {/* User Section */}
            <div className="sidebar__footer">
                <NavLink
                    to="/profile"
                    onClick={handleNavLinkClick}
                    className={({ isActive }) =>
                        `sidebar__user ${isActive ? 'sidebar__user--active' : ''}`
                    }
                    title="Edit Profile"
                >
                    <div className="sidebar__avatar">
                        {getPhotoUrl() && !imgError ? (
                            <img
                                src={getPhotoUrl()}
                                alt="Profile"
                                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                                onError={() => setImgError(true)}
                            />
                        ) : (
                            <>{user?.firstName?.[0]}{user?.lastName?.[0]}</>
                        )}
                    </div>
                    {!effectiveCollapsed && (
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
                    {!effectiveCollapsed && <span className="sidebar__link-text">Logout</span>}
                </button>
            </div>
        </aside>
    );
}
