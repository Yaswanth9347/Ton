import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';

export default function ResetPasswordPage() {
    const { token } = useParams();
    const navigate = useNavigate();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (newPassword.length < 6) {
            setError('Password must be at least 6 characters long.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);

        try {
            await authApi.resetPassword(token, newPassword);
            setSuccess(true);
            setTimeout(() => navigate('/login'), 3000);
        } catch (err) {
            setError(err.response?.data?.message || 'Reset failed. Token may be invalid or expired.');
        } finally {
            setLoading(false);
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

                    <h2 style={{ textAlign: 'center', marginBottom: '0.5rem', fontSize: '1.25rem' }}>
                        Reset Your Password
                    </h2>
                    <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                        Enter your new password below.
                    </p>

                    {success ? (
                        <div>
                            <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
                                Password reset successfully! Redirecting to login...
                            </div>
                            <Link
                                to="/login"
                                style={{
                                    display: 'block',
                                    textAlign: 'center',
                                    color: 'var(--primary)',
                                    textDecoration: 'none',
                                    fontWeight: 500,
                                }}
                            >
                                Go to Login
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            {error && (
                                <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                                    {error}
                                </div>
                            )}

                            <div className="form-group">
                                <label htmlFor="newPassword" className="form-label">
                                    New Password
                                </label>
                                <input
                                    id="newPassword"
                                    type="password"
                                    className="form-input"
                                    placeholder="Enter new password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    autoComplete="new-password"
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="confirmPassword" className="form-label">
                                    Confirm Password
                                </label>
                                <input
                                    id="confirmPassword"
                                    type="password"
                                    className="form-input"
                                    placeholder="Confirm new password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    autoComplete="new-password"
                                />
                            </div>

                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={loading}
                                style={{ width: '100%', marginTop: '0.5rem', padding: '0.75rem' }}
                            >
                                {loading ? 'Resetting...' : 'Reset Password'}
                            </button>

                            <Link
                                to="/login"
                                style={{
                                    display: 'block',
                                    textAlign: 'center',
                                    marginTop: '1rem',
                                    color: 'var(--text-secondary)',
                                    textDecoration: 'none',
                                    fontSize: '0.875rem',
                                }}
                            >
                                ← Back to Login
                            </Link>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
