import { Sidebar } from './Sidebar';
import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

export function Layout({ children }) {
    const { refreshUser } = useAuth();

    useEffect(() => {
        const handleUserUpdate = () => {
            refreshUser();
        };

        window.addEventListener('userUpdated', handleUserUpdate);
        return () => {
            window.removeEventListener('userUpdated', handleUserUpdate);
        };
    }, [refreshUser]);

    return (
        <div className="app-layout">
            <Sidebar />
            <div className="app-layout__main">
                <main className="app-content">
                    {children}
                </main>
            </div>
        </div>
    );
}
