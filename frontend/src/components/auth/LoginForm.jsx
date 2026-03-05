import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../common/Button';

export function LoginForm({ onSubmit, error, showForgotPassword = false }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSubmit(username, password);
        } finally {
            setLoading(false);
        }
    };

    // Detect lockout error to show contextual messaging
    const isLockout = error && (error.toLowerCase().includes('locked') || error.toLowerCase().includes('failed attempts'));
    const isContactAdmin = isLockout && error.toLowerCase().includes('contact the admin');

    return (
        <form onSubmit={handleSubmit}>
            {error && (
                <div className={`alert ${isLockout ? 'alert-warning' : 'alert-error'}`}>
                    {error}
                    {isLockout && showForgotPassword && !isContactAdmin && (
                        <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                            <Link to="/forgot-password" style={{ color: 'inherit', fontWeight: 600 }}>
                                Reset your password via email →
                            </Link>
                        </div>
                    )}
                </div>
            )}

            <div className="form-group">
                <label htmlFor="username" className="form-label">
                    Username
                </label>
                <input
                    id="username"
                    type="text"
                    className="form-input"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoComplete="username"
                />
            </div>

            <div className="form-group">
                <label htmlFor="password" className="form-label">
                    Password
                </label>
                <input
                    id="password"
                    type="password"
                    className="form-input"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                />
            </div>

            <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
                style={{ width: '100%', marginTop: '0.5rem' }}
            >
                Sign In
            </Button>

            {showForgotPassword && (
                <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                    <Link
                        to="/forgot-password"
                        style={{
                            color: 'var(--text-secondary)',
                            textDecoration: 'none',
                            fontSize: '0.85rem',
                        }}
                    >
                        Admin: Forgot Password?
                    </Link>
                </div>
            )}
        </form>
    );
}
