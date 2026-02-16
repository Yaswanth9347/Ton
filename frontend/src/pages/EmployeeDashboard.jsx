import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAttendance } from '../hooks/useAttendance';
import { AttendanceStatus } from '../components/employee/AttendanceStatus';
import { CheckInOutButtons } from '../components/employee/CheckInOutButtons';
import { AttendanceHistory } from '../components/employee/AttendanceHistory';
import { AttendanceCalendar } from '../components/employee/AttendanceCalendar';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { attendanceApi } from '../services/api';

export function EmployeeDashboard() {
    const { user, logout } = useAuth();
    const {
        todayStatus,
        history,
        loading,
        error,
        checkIn,
        checkOut
    } = useAttendance();
    const [actionLoading, setActionLoading] = useState(false);
    const [actionError, setActionError] = useState(null);
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'calendar'
    const [overtimeSummary, setOvertimeSummary] = useState(null);

    const handleCheckIn = async () => {
        setActionLoading(true);
        setActionError(null);
        try {
            await checkIn();
        } catch (err) {
            setActionError(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleCheckOut = async () => {
        setActionLoading(true);
        setActionError(null);
        try {
            await checkOut();
        } catch (err) {
            setActionError(err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleLogout = async () => {
        await logout();
    };

    const getWeeklyStats = () => {
        const last7Days = history.slice(0, 7);
        const presentCount = last7Days.filter(h => h.status === 'present').length;
        const totalHours = last7Days.reduce((acc, h) => acc + (parseFloat(h.totalHours) || 0), 0);
        return { presentCount, totalHours };
    };

    const stats = getWeeklyStats();

    // Fetch overtime summary
    useEffect(() => {
        const fetchOvertimeSummary = async () => {
            try {
                const response = await attendanceApi.getOvertimeSummary();
                setOvertimeSummary(response.data.data);
            } catch (err) {
                console.error('Failed to fetch overtime summary:', err);
            }
        };
        fetchOvertimeSummary();
    }, []);

    if (loading) {
        return (
            <div className="loading" style={{ minHeight: '100vh' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div>
            <main>
                <h1 className="mb-6">Welcome, {user?.firstName}!</h1>

                <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
                    <AttendanceStatus status={todayStatus} />
                    <CheckInOutButtons
                        status={todayStatus}
                        onCheckIn={handleCheckIn}
                        onCheckOut={handleCheckOut}
                        loading={actionLoading}
                        error={actionError}
                    />
                </div>

                <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginTop: '1.5rem' }}>
                    <Card className="text-center p-4">
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Days Present (Last 7)</div>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{stats.presentCount} / 7</div>
                    </Card>
                    <Card className="text-center p-4">
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Total Hours (Last 7)</div>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{stats.totalHours.toFixed(1)} hrs</div>
                    </Card>
                    {overtimeSummary && overtimeSummary.totalOvertimeHours > 0 && (
                        <Card className="text-center p-4">
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Overtime This Month</div>
                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-warning)' }}>{overtimeSummary.totalOvertimeHours.toFixed(1)} hrs</div>
                        </Card>
                    )}
                    {todayStatus?.checkInLocation && (
                        <Card className="text-center p-4">
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Check-in Location</div>
                            <div style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>📍 {todayStatus.checkInLocation.address}</div>
                        </Card>
                    )}
                </div>

                <div className="mt-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2>Attendance {viewMode === 'calendar' ? 'Calendar' : 'History'}</h2>
                        <div className="flex gap-2">
                            <Button
                                variant={viewMode === 'list' ? 'primary' : 'secondary'}
                                size="sm"
                                onClick={() => setViewMode('list')}
                            >
                                📋 List
                            </Button>
                            <Button
                                variant={viewMode === 'calendar' ? 'primary' : 'secondary'}
                                size="sm"
                                onClick={() => setViewMode('calendar')}
                            >
                                📅 Calendar
                            </Button>
                        </div>
                    </div>

                    {viewMode === 'list' ? (
                        <AttendanceHistory history={history} loading={loading} />
                    ) : (
                        <AttendanceCalendar />
                    )}
                </div>
            </main>
        </div>
    );
}
