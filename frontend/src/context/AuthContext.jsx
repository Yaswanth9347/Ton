import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { authApi } from '../services/api';

const AuthContext = createContext(null);

// Refresh token 1 hour before expiry (token is 24h, so refresh at 23h)
const TOKEN_REFRESH_INTERVAL = 23 * 60 * 60 * 1000; // 23 hours in ms

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const refreshTimerRef = useRef(null);

    // Schedule silent token refresh
    const scheduleTokenRefresh = () => {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = setTimeout(async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) return;
                const res = await authApi.refreshToken();
                const newToken = res.data.data.token;
                localStorage.setItem('token', newToken);
                // Schedule next refresh
                scheduleTokenRefresh();
            } catch (err) {
                console.error('Token refresh failed:', err);
                // Token is likely expired — will be caught by 401 interceptor
            }
        }, TOKEN_REFRESH_INTERVAL);
    };

    useEffect(() => {
        // Check if user is logged in on mount
        let isMounted = true;
        const storedUser = localStorage.getItem('user');
        const token = localStorage.getItem('token');

        if (storedUser && token) {
            setUser(JSON.parse(storedUser));
            // Verify token is still valid
            authApi.getCurrentUser()
                .then(response => {
                    if (isMounted) {
                        setUser(response.data.data);
                        localStorage.setItem('user', JSON.stringify(response.data.data));
                        scheduleTokenRefresh();
                    }
                })
                .catch(() => {
                    if (isMounted) {
                        logout();
                    }
                })
                .finally(() => {
                    if (isMounted) {
                        setLoading(false);
                    }
                });
        } else {
            setLoading(false);
        }

        return () => {
            isMounted = false;
            clearTimeout(refreshTimerRef.current);
        };
    }, []);

    const login = async (email, password) => {
        const response = await authApi.login(email, password);
        const { user, token } = response.data.data;

        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        setUser(user);
        scheduleTokenRefresh();

        return user;
    };

    const logout = async () => {
        try {
            await authApi.logout();
        } catch (error) {
            // Ignore logout errors
        }

        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        clearTimeout(refreshTimerRef.current);
    };

    const refreshUser = async () => {
        try {
            const response = await authApi.getCurrentUser();
            setUser(response.data.data);
            localStorage.setItem('user', JSON.stringify(response.data.data));
        } catch (error) {
            console.error('Failed to refresh user:', error);
        }
    };

    const value = {
        user,
        loading,
        login,
        logout,
        refreshUser,
        isAuthenticated: !!user,
        // isAdmin is ONLY true for the ADMIN role
        isAdmin: user?.role === 'ADMIN',
        // isOperationalAdmin: ADMIN or SUPERVISOR — for Bores, Inventory access
        isOperationalAdmin: user?.role === 'ADMIN' || user?.role === 'SUPERVISOR',
        // isStrictAdmin is ONLY true for the ADMIN role (kept for backward compat)
        isStrictAdmin: user?.role === 'ADMIN',
        isSupervisor: user?.role === 'SUPERVISOR',
        isEmployee: user?.role === 'EMPLOYEE',
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
