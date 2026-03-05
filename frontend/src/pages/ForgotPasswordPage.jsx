import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../services/api';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await authApi.forgotPassword(email);
            setSubmitted(true);
        } catch (err) {
            setError(err.response?.data?.message || 'Something went wrong. Please try again.');
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
                        Admin Password Recovery
                    </h2>
                    <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                        Enter your admin email address to receive a password reset link.
                        This is only available for Admin accounts.
                    </p>

                    {submitted ? (
                        <div>
                            <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
                                If that email is associated with an Admin account, a reset link has been sent.
                                Please check your inbox (and spam folder).
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
                                ← Back to Login
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
                                <label htmlFor="email" className="form-label">
                                    Admin Email
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    className="form-input"
                                    placeholder="Enter your admin email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    autoComplete="email"
                                />
                            </div>

                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={loading}
                                style={{ width: '100%', marginTop: '0.5rem', padding: '0.75rem' }}
                            >
                                {loading ? 'Sending...' : 'Send Reset Link'}
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
