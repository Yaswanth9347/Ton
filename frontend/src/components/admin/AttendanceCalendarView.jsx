import { useState, useEffect } from 'react';
import { adminApi } from '../../services/api';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { formatTime } from '../../utils/formatters';
import { getCurrentISTDay, getCurrentISTMonthYear, getMonthName, getWeekdayIndexInIST } from '../../utils/dateTime';
import { X, CalendarDays } from 'lucide-react';

export function AttendanceCalendarView({ userId, employeeName }) {
    const currentIST = getCurrentISTMonthYear();
    const [calendarData, setCalendarData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(currentIST.month);
    const [selectedYear, setSelectedYear] = useState(currentIST.year);
    const [selectedDay, setSelectedDay] = useState(null);

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const fetchCalendar = async () => {
        if (!userId) return;
        try {
            setLoading(true);
            const response = await adminApi.getEmployeeCalendar(userId, selectedMonth, selectedYear);
            setCalendarData(response.data.data);
        } catch (err) {
            console.error('Failed to fetch calendar data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCalendar();
        setSelectedDay(null); // Reset selected day when month changes
    }, [userId, selectedMonth, selectedYear]);

    const handlePrevMonth = () => {
        if (selectedMonth === 1) {
            setSelectedMonth(12);
            setSelectedYear(selectedYear - 1);
        } else {
            setSelectedMonth(selectedMonth - 1);
        }
    };

    const handleNextMonth = () => {
        if (selectedMonth === 12) {
            setSelectedMonth(1);
            setSelectedYear(selectedYear + 1);
        } else {
            setSelectedMonth(selectedMonth + 1);
        }
    };

    const getStatusClass = (status) => {
        const classes = {
            present: 'calendar-day-present',
            absent: 'calendar-day-absent',
            holiday: 'calendar-day-holiday',
            none: ''
        };
        return classes[status] || '';
    };

    const renderCalendarGrid = () => {
        if (!calendarData) return null;

        const firstDayOfMonth = getWeekdayIndexInIST(`${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`);

        const cells = [];

        // Empty cells for days before the first day
        for (let i = 0; i < firstDayOfMonth; i++) {
            cells.push(<div key={`empty-${i}`} className="calendar-day calendar-day-empty"></div>);
        }

        // Calendar days
        for (const dayData of calendarData.days) {
            const current = getCurrentISTMonthYear();
            const isToday = dayData.day === getCurrentISTDay() && selectedMonth === current.month && selectedYear === current.year;

            cells.push(
                <div
                    key={dayData.date}
                    className={`calendar-day ${getStatusClass(dayData.status)} ${isToday ? 'calendar-day-today' : ''} ${selectedDay?.date === dayData.date ? 'calendar-day-selected' : ''}`}
                    onClick={() => setSelectedDay(dayData)}
                >
                    <div className="calendar-day-number">{dayData.day}</div>
                    {dayData.status && dayData.status !== 'none' && (
                        <div className="calendar-day-indicator"></div>
                    )}
                </div>
            );
        }

        return cells;
    };

    if (!userId) {
        return (
            <Card>
                <div className="empty-state">
                    <div className="empty-state-icon">
                        <CalendarDays size={48} className="text-icon-blue" fill="currentColor" />
                    </div>
                    <div className="empty-state-title">Select an employee to view calendar</div>
                </div>
            </Card>
        );
    }

    return (
        <Card className="attendance-calendar">
            {/* Calendar Header */}
            <div className="calendar-header">
                <Button variant="secondary" size="sm" onClick={handlePrevMonth} title="Previous month">
                    <span style={{ fontSize: '18px', fontWeight: 'bold' }}>←</span>
                </Button>
                <div className="calendar-title-container">
                    <h3 className="calendar-title">
                        {getMonthName(selectedMonth)} {selectedYear}
                    </h3>
                    {employeeName && (
                        <span className="calendar-subtitle">{employeeName}</span>
                    )}
                </div>
                <Button variant="secondary" size="sm" onClick={handleNextMonth} title="Next month">
                    <span style={{ fontSize: '18px', fontWeight: 'bold' }}>→</span>
                </Button>
            </div>

            {loading ? (
                <div className="loading"><div className="spinner"></div></div>
            ) : (
                <>
                    {/* Day names header */}
                    <div className="calendar-weekdays">
                        {dayNames.map(day => (
                            <div key={day} className="calendar-weekday">{day}</div>
                        ))}
                    </div>

                    {/* Calendar grid */}
                    <div className="calendar-grid calendar-grid-animated">
                        {renderCalendarGrid()}
                    </div>

                    {/* Legend */}
                    <div className="calendar-legend">
                        <div className="legend-item"><span className="legend-emoji"></span> Present</div>
                        <div className="legend-item"><span className="legend-emoji"></span> Absent</div>
                        <div className="legend-item"><span className="legend-emoji"></span> Holiday</div>
                    </div>

                    {/* Summary */}
                    {calendarData?.summary && (
                        <div className="calendar-summary">
                            <div className="summary-item">
                                <span className="summary-value">{calendarData.summary.presentDays}</span>
                                <span className="summary-label">Present</span>
                            </div>
                            <div className="summary-item">
                                <span className="summary-value">{calendarData.summary.absentDays}</span>
                                <span className="summary-label">Absent</span>
                            </div>
                            <div className="summary-item">
                                <span className="summary-value">{calendarData.summary.holidays}</span>
                                <span className="summary-label">Holidays</span>
                            </div>
                        </div>
                    )}

                    {/* Selected day details */}
                    {selectedDay && (
                        <div className="calendar-day-details-compact">
                            <div className="details-info">
                                <strong>{getMonthName(selectedMonth)} {selectedDay.day}{selectedDay.holidayName ? ` (${selectedDay.holidayName})` : ''}:</strong> {selectedDay.displayStatus}
                                {selectedDay.attendance && (
                                    <span> • {formatTime(selectedDay.attendance.checkIn)} - {formatTime(selectedDay.attendance.checkOut)} ({(selectedDay.attendance.regularHours + selectedDay.attendance.overtimeHours).toFixed(1)}h)</span>
                                )}
                            </div>
                            <button className="close-icon-btn" onClick={() => setSelectedDay(null)} title="Close">
                                <X size={16} />
                            </button>
                        </div>
                    )}
                </>
            )}
        </Card>
    );
}
