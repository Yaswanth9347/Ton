import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const MiniCalendar = ({ value, onChange, onClose }) => {
    // value is YYYY-MM-DD string or null
    // Internal state for view (year, month)
    const today = new Date();
    const [viewDate, setViewDate] = useState(() => {
        if (value) {
            const d = new Date(value);
            return isNaN(d.getTime()) ? today : d;
        }
        return today;
    });

    const wrapperRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const getDaysInMonth = (year, month) => {
        return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (year, month) => {
        // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        return new Date(year, month, 1).getDay();
    };

    const handlePrevMonth = () => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
    };

    const handleDateClick = (day) => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        // Construct YYYY-MM-DD with padding
        const m = (month + 1).toString().padStart(2, '0');
        const d = day.toString().padStart(2, '0');
        const dateStr = `${year}-${m}-${d}`;
        onChange(dateStr);
        onClose();
    };

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    // Array of empty slots for alignment
    const emptySlots = Array(firstDay).fill(null);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    return (
        <div
            ref={wrapperRef}
            className="mini-calendar"
            style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '5px',
                width: '280px',
                backgroundColor: 'var(--bg-secondary)', // Theme aware
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                zIndex: 50,
                padding: '10px',
                color: 'var(--text-primary)'
            }}
        >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <button
                    type="button"
                    onClick={handlePrevMonth}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '5px' }}
                >
                    <ChevronLeft size={16} />
                </button>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>
                    {monthNames[month]} {year}
                </div>
                <button
                    type="button"
                    onClick={handleNextMonth}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '5px' }}
                >
                    <ChevronRight size={16} />
                </button>
            </div>

            {/* Weekdays */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '5px', textAlign: 'center' }}>
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                    <div key={d} style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>{d}</div>
                ))}
            </div>

            {/* Days */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                {emptySlots.map((_, i) => (
                    <div key={`empty-${i}`} />
                ))}
                {days.map(day => {
                    const isSelected = value === `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                    const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

                    return (
                        <button
                            key={day}
                            type="button"
                            onClick={() => handleDateClick(day)}
                            style={{
                                width: '100%',
                                aspectRatio: '1/1',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '4px',
                                background: isSelected ? 'var(--color-primary)' : 'transparent',
                                color: isSelected ? '#fff' : 'var(--text-primary)',
                                fontSize: '13px',
                                cursor: 'pointer',
                                fontWeight: isToday ? 'bold' : 'normal',
                                border: isToday && !isSelected ? '1px solid var(--color-primary)' : 'none',
                            }}
                            className="calendar-day-btn"
                            onMouseEnter={(e) => {
                                if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                            }}
                            onMouseLeave={(e) => {
                                if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                        >
                            {day}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default MiniCalendar;
