import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoginForm } from '../components/auth/LoginForm';

export function LoginPage() {
    const [error, setError] = useState('');
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const adminFailCount = useRef(0);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleLogin = async (username, password) => {
        setError('');
        try {
            const user = await login(username, password);
            // Reset on successful login
            adminFailCount.current = 0;
            setShowForgotPassword(false);
            if (user.role === 'ADMIN') {
                navigate('/admin');
            } else {
                navigate('/dashboard');
            }
        } catch (err) {
            const data = err.response?.data;
            const errMsg = data?.message || data?.error || 'Login failed. Please try again.';
            setError(errMsg);

            const isAdmin = username.trim().toLowerCase() === 'admin';
            const isLockout = errMsg.toLowerCase().includes('locked') || errMsg.toLowerCase().includes('failed attempts');

            if (isAdmin) {
                adminFailCount.current += 1;
            }

            // Show forgot password ONLY for Admin after 3 failures or if already locked
            if (isAdmin && (adminFailCount.current >= 3 || isLockout)) {
                setShowForgotPassword(true);
            } else {
                setShowForgotPassword(false);
            }
        }
    };

    return (
        <div className="modern-login-bg">
            <div className="modern-login-center">
                <div className="modern-login-card">
                    <img
                        src="/logo.png"
                        alt="Logo"
                        className="modern-login-logo"
                    />
                    <LoginForm onSubmit={handleLogin} error={error} showForgotPassword={showForgotPassword} />
                </div>
            </div>
        </div>
    );
}