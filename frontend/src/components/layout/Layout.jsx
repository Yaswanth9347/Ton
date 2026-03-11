import { Sidebar } from './Sidebar';
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Menu } from 'lucide-react';

export function Layout({ children }) {
    const { refreshUser } = useAuth();
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    useEffect(() => {
        const handleUserUpdate = () => {
            refreshUser();
        };

        window.addEventListener('userUpdated', handleUserUpdate);
        return () => {
            window.removeEventListener('userUpdated', handleUserUpdate);
        };
    }, [refreshUser]);

    useEffect(() => {
        document.body.classList.toggle('sidebar-mobile-open', mobileSidebarOpen);

        return () => {
            document.body.classList.remove('sidebar-mobile-open');
        };
    }, [mobileSidebarOpen]);

    return (
        <div className="app-layout">
            <Sidebar
                mobileOpen={mobileSidebarOpen}
                onMobileClose={() => setMobileSidebarOpen(false)}
            />
            <button
                type="button"
                className={`app-layout__overlay ${mobileSidebarOpen ? 'app-layout__overlay--visible' : ''}`}
                aria-label="Close navigation menu"
                onClick={() => setMobileSidebarOpen(false)}
            />
            <div className="app-layout__main">
                <div className="app-mobile-header">
                    <button
                        type="button"
                        className="app-mobile-header__menu"
                        aria-label="Open navigation menu"
                        aria-expanded={mobileSidebarOpen}
                        onClick={() => setMobileSidebarOpen(true)}
                    >
                        <Menu size={20} />
                        <span>Menu</span>
                    </button>

                    <div className="app-mobile-header__brand">
                        <img src="/logo.png" alt="JMJ Logo" className="app-mobile-header__logo" />
                        <span>JMJ Management</span>
                    </div>
                </div>
                <main className="app-content">
                    {children}
                </main>
            </div>
        </div>
    );
}
