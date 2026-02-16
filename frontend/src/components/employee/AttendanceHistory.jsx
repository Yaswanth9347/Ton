import { Card } from '../common/Card';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../common/Table';
import { formatDate, formatTime, formatHours, getStatusText, getStatusBadgeClass } from '../../utils/formatters';

export function AttendanceHistory({ history, loading = false }) {
    if (loading) {
        return (
            <Card>
                <h3 className="card-title mb-4">Attendance History</h3>
                <div className="loading">
                    <div className="spinner"></div>
                </div>
            </Card>
        );
    }

    return (
        <Card>
            <h3 className="card-title mb-4">Attendance History</h3>

            {history.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📅</div>
                    <div className="empty-state-title">No attendance records</div>
                    <p>Your attendance history will appear here once you start checking in.</p>
                </div>
            ) : (
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableHeader>Date</TableHeader>
                            <TableHeader>Check In</TableHeader>
                            <TableHeader>Check Out</TableHeader>
                            <TableHeader>Total Hours</TableHeader>
                            <TableHeader>Status</TableHeader>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {history.map((record) => (
                            <TableRow key={record.id}>
                                <TableCell>{formatDate(record.date)}</TableCell>
                                <TableCell>{formatTime(record.checkIn)}</TableCell>
                                <TableCell>{formatTime(record.checkOut)}</TableCell>
                                <TableCell>{formatHours(record.totalHours)}</TableCell>
                                <TableCell>
                                    <span className={`badge ${getStatusBadgeClass(record.status, record.isComplete)}`}>
                                        {getStatusText(record.status, record.isComplete)}
                                    </span>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </Card>
    );
}
