
import { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../common/Table';
import { formatDate, formatTime, formatHours, getStatusBadgeClass, getStatusText } from '../../utils/formatters';
import { Edit2 } from 'lucide-react';

export function AttendanceDetailsModal({
    isOpen,
    onClose,
    employeeId,
    employeeName,
    records,
    onEditRecord
}) {
    if (!isOpen) return null;

    // Sort records by date descending
    const sortedRecords = [...records].sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Attendance History - ${employeeName}`}
            size="lg"
            footer={
                <Button variant="secondary" onClick={onClose}>
                    Close
                </Button>
            }
        >
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                {records.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-title">No records found</div>
                        <p>No attendance records available for this period.</p>
                    </div>
                ) : (
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableHeader>Date</TableHeader>
                                <TableHeader>Check In</TableHeader>
                                <TableHeader>Check Out</TableHeader>
                                <TableHeader>Hours</TableHeader>
                                <TableHeader>Status</TableHeader>
                                <TableHeader>Actions</TableHeader>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {sortedRecords.map((record) => (
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
                                    <TableCell>
                                        <button
                                            className="btn-icon-blue"
                                            onClick={() => onEditRecord(record)}
                                            title="Edit Record"
                                        >
                                            <Edit2 size={16} className="icon-action-blue" />
                                        </button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </div>
        </Modal>
    );
}
