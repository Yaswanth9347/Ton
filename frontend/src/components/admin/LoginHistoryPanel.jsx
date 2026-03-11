import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../services/api';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import {
    Shield, LogIn, LogOut, XCircle, Lock,
    KeyRound, ChevronLeft, ChevronRight, Search
} from 'lucide-react';

const ACTION_CONFIG = {
    LOGIN_SUCCESS: { label: 'Login', color: '#22c55e', icon: LogIn },
    LOGIN_FAILED: { label: 'Failed', color: '#ef4444', icon: XCircle },
    LOGOUT: { label: 'Logout', color: '#6b7280', icon: LogOut },
    ACCOUNT_LOCKED: { label: 'Locked', color: '#f59e0b', icon: Lock },
    PASSWORD_CHANGED: { label: 'Pwd Changed', color: '#3b82f6', icon: KeyRound },
    PASSWORD_RESET: { label: 'Pwd Reset', color: '#8b5cf6', icon: KeyRound },
};

const PAGE_SIZE = 15;

export function LoginHistoryPanel() {
    const [records, setRecords] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState({ username: '', action: '' });

    const fetchHistory = useCallback(async (pageNum = 0) => {
        setLoading(true);
        try {
            const params = {
                limit: PAGE_SIZE,
                offset: pageNum * PAGE_SIZE,
            };
            if (filter.username) params.username = filter.username;
            if (filter.action) params.action = filter.action;

            const res = await adminApi.getLoginHistory(params);
            const data = res.data.data;
            setRecords(data.records || []);
            setTotal(data.total || 0);
        } catch (err) {
            console.error('Failed to fetch login history:', err);
            setRecords([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => {
        fetchHistory(page);
    }, [page, fetchHistory]);

    const handleFilterSubmit = (e) => {
        e.preventDefault();
        setPage(0);
        fetchHistory(0);
    };

    const totalPages = Math.ceil(total / PAGE_SIZE);

    const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });
    };

    const shortenUA = (ua) => {
        if (!ua) return '—';
        // Extract browser name from user agent
        const match = ua.match(/(Chrome|Firefox|Safari|Edge|Opera|OPR)[\/\s](\d+)/i);
        if (match) return `${match[1]} ${match[2]}`;
        if (ua.includes('Mobile')) return 'Mobile';
        return ua.substring(0, 30) + '…';
    };

    return (
        <Card>
            <div className="card-header" style={{ borderBottom: 'none', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Shield size={20} />
                    <h3 className="card-title" style={{ margin: 0 }}>Login History</h3>
                </div>
                <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                    {total} total events
                </span>
            </div>

            {/* Filters */}
            <form onSubmit={handleFilterSubmit} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                <input
                    type="text"
                    className="form-input"
                    placeholder="Filter by username"
                    value={filter.username}
                    onChange={(e) => setFilter((f) => ({ ...f, username: e.target.value }))}
                    style={{ flex: '1 1 140px', minWidth: '120px', padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                />
                <select
                    className="form-input"
                    value={filter.action}
                    onChange={(e) => setFilter((f) => ({ ...f, action: e.target.value }))}
                    style={{ flex: '0 0 140px', padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                >
                    <option value="">All Actions</option>
                    <option value="LOGIN_SUCCESS">Login Success</option>
                    <option value="LOGIN_FAILED">Login Failed</option>
                    <option value="LOGOUT">Logout</option>
                    <option value="ACCOUNT_LOCKED">Account Locked</option>
                    <option value="PASSWORD_CHANGED">Password Changed</option>
                    <option value="PASSWORD_RESET">Password Reset</option>
                </select>
                <Button type="submit" variant="secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>
                    <Search size={14} /> Filter
                </Button>
            </form>

            {/* Table */}
            <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table className="table" style={{ fontSize: '0.8rem' }}>
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>User</th>
                            <th>Action</th>
                            <th>IP Address</th>
                            <th>Browser</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                    Loading...
                                </td>
                            </tr>
                        ) : records.length === 0 ? (
                            <tr>
                                <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                    No login events found
                                </td>
                            </tr>
                        ) : (
                            records.map((r) => {
                                const cfg = ACTION_CONFIG[r.action] || { label: r.action, color: '#6b7280', icon: Shield };
                                const Icon = cfg.icon;
                                return (
                                    <tr key={r.id}>
                                        <td style={{ whiteSpace: 'nowrap' }}>{formatDate(r.createdAt)}</td>
                                        <td>{r.username || '—'}</td>
                                        <td>
                                            <span
                                                className="badge"
                                                style={{
                                                    backgroundColor: cfg.color + '18',
                                                    color: cfg.color,
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.25rem',
                                                    fontSize: '0.72rem',
                                                    padding: '0.15rem 0.5rem',
                                                    borderRadius: '0.75rem',
                                                }}
                                            >
                                                <Icon size={12} /> {cfg.label}
                                            </span>
                                        </td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{r.ipAddress || '—'}</td>
                                        <td style={{ fontSize: '0.75rem' }}>{shortenUA(r.userAgent)}</td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', fontSize: '0.8rem' }}>
                    <span className="text-muted">
                        Page {page + 1} of {totalPages}
                    </span>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <Button
                            variant="secondary"
                            disabled={page === 0}
                            onClick={() => setPage((p) => p - 1)}
                            style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                        >
                            <ChevronLeft size={14} />
                        </Button>
                        <Button
                            variant="secondary"
                            disabled={page >= totalPages - 1}
                            onClick={() => setPage((p) => p + 1)}
                            style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                        >
                            <ChevronRight size={14} />
                        </Button>
                    </div>
                </div>
            )}
        </Card>
    );
}
