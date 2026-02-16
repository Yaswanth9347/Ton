import { formatTime, getStatusText, getStatusBadgeClass } from '../../utils/formatters';
import { Card } from '../common/Card';

export function AttendanceStatus({ status }) {
    const isCheckedIn = status && status.status !== 'not_checked_in';
    const isCheckedOut = status && status.checkOut;

    return (
        <Card>
            <h3 className="card-title mb-4">Today's Attendance</h3>

            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <div className="stat-card">
                    <div className="stat-label">Status</div>
                    <div className="stat-value">
                        <span className={`badge ${getStatusBadgeClass(status?.status, status?.isComplete)}`}>
                            {getStatusText(status?.status, status?.isComplete)}
                        </span>
                    </div>
                </div>

                <div className="stat-card success">
                    <div className="stat-label">Check In</div>
                    <div className="stat-value" style={{ fontSize: '1.25rem' }}>
                        {isCheckedIn ? formatTime(status.checkIn) : '-'}
                    </div>
                </div>

                <div className="stat-card info">
                    <div className="stat-label">Check Out</div>
                    <div className="stat-value" style={{ fontSize: '1.25rem' }}>
                        {isCheckedOut ? formatTime(status.checkOut) : '-'}
                    </div>
                </div>
            </div>
        </Card>
    );
}
