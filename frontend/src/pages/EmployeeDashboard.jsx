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
import toast from 'react-hot-toast';
import { getCurrentISTMonthYear, toISTDate } from '../utils/dateTime';

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

        // Calculate how long the employee has worked
        let workedHours = 0;
        if (todayStatus?.checkIn) {
            const checkInTime = toISTDate(todayStatus.checkIn)?.getTime();
            if (checkInTime) {
                workedHours = (Date.now() - checkInTime) / (1000 * 60 * 60);
            }
        }

        try {
            await checkOut();

            // Show warning notifications AFTER successful checkout (non-blocking)
            const FULL_DAY_HOURS = 8;
            const HALF_DAY_HOURS = 3.5;

            if (workedHours < HALF_DAY_HOURS) {
                toast(
                    `⚠️ You worked only ${workedHours.toFixed(1)} hrs. Minimum 3.5 hours required for half-day.`,
                    { duration: 5000, icon: '⏰', style: { background: '#fef3c7', color: '#92400e', border: '1px solid #f59e0b', fontWeight: '500' } }
                );
            } else if (workedHours < FULL_DAY_HOURS) {
                toast(
                    `⚠️ You have not completed the required 8 hours of working time. (Worked: ${workedHours.toFixed(1)} hrs)`,
                    { duration: 5000, icon: '⏰', style: { background: '#fef3c7', color: '#92400e', border: '1px solid #f59e0b', fontWeight: '500' } }
                );
            } else {
                toast.success(`Great job! You completed ${workedHours.toFixed(1)} hours today.`, { duration: 4000 });
            }
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
                const current = getCurrentISTMonthYear();
                const response = await attendanceApi.getOvertimeSummary({ month: current.month, year: current.year });
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
                            <div style={{ fontSize: '0.875rem', fontWeight: '600', marginTop: '0.5rem' }}>
                                📍 {todayStatus.checkInLocation.address || `${todayStatus.checkInLocation.latitude?.toFixed(4)}, ${todayStatus.checkInLocation.longitude?.toFixed(4)}`}
                            </div>
                            {todayStatus.checkInLocation.latitude && todayStatus.checkInLocation.address && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                    {Number(todayStatus.checkInLocation.latitude).toFixed(4)}°N, {Number(todayStatus.checkInLocation.longitude).toFixed(4)}°E
                                </div>
                            )}
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
