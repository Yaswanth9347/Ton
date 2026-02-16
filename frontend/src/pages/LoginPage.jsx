import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoginForm } from '../components/auth/LoginForm';

export function LoginPage() {
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleLogin = async (email, password) => {
        setError('');
        try {
            const user = await login(email, password);
            if (user.role === 'ADMIN' || user.role === 'SUPERVISOR') {
                navigate('/admin');
            } else {
                navigate('/dashboard');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed. Please try again.');
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
                    <LoginForm onSubmit={handleLogin} error={error} />
                </div>
            </div>
        </div>
    );
}