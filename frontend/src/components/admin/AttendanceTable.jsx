
import { useState, useMemo } from 'react';
import { Card } from '../common/Card';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../common/Table';
import { Button } from '../common/Button';
import { ClipboardList, MoreHorizontal, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { AttendanceDetailsModal } from './AttendanceDetailsModal';

export function AttendanceTable({
    attendance,
    employees = [],
    loading = false,
    onCorrect,
    onFilter
}) {
    const [filters, setFilters] = useState({
        userId: '',
        startDate: '',
        endDate: '',
    });

    const [selectedEmployeeForDetails, setSelectedEmployeeForDetails] = useState(null);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleApplyFilters = () => {
        onFilter(filters);
    };

    const handleClearFilters = () => {
        const cleared = { userId: '', startDate: '', endDate: '' };
        setFilters(cleared);
        onFilter(cleared);
    };

    // Group attendance by employee
    const summaryData = useMemo(() => {
        if (!attendance || attendance.length === 0) return [];

        // Map userId to employee details and records
        const grouped = {};

        attendance.forEach(record => {
            if (!grouped[record.userId]) {
                const emp = employees.find(e => e.id === record.userId);
                grouped[record.userId] = {
                    id: record.userId,
                    name: record.employeeName || (emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown'),
                    email: record.employeeEmail || emp?.email || '',
                    records: [],
                    totalHours: 0,
                    presentDays: 0,
                };
            }
            grouped[record.userId].records.push(record);
            grouped[record.userId].totalHours += parseFloat(record.totalHours || 0);
            if (record.status === 'present' || record.status === 'late') {
                grouped[record.userId].presentDays += 1;
            }
        });

        // Determine total days in period - simplified logic:
        // Use the filter date range if available, otherwise estimate from records
        let totalDays = 30; // Default view often assumes a month
        if (filters.startDate && filters.endDate) {
            const start = new Date(filters.startDate);
            const end = new Date(filters.endDate);
            const diffTime = Math.abs(end - start);
            totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        }

        return Object.values(grouped).map(emp => {
            const percentage = Math.round((emp.presentDays / totalDays) * 100);
            let status = 'Good';
            if (percentage < 70) status = 'Critical';
            else if (percentage < 90) status = 'Attention';

            return {
                ...emp,
                percentage: Math.min(percentage, 100), // Cap at 100
                status,
                period: filters.startDate ? `${filters.startDate} - ${filters.endDate}` : 'All Time'
            };
        });
    }, [attendance, employees, filters.startDate, filters.endDate]);


    if (loading) {
        return (
            <Card>
                <div className="loading">
                    <div className="spinner"></div>
                </div>
            </Card>
        );
    }

    return (
        <Card>
            <div className="attendance-filter-bar">
                <select
                    name="userId"
                    value={filters.userId}
                    onChange={handleFilterChange}
                    className="attendance-filter-input"
                    style={{ flex: 1 }}
                >
                    <option value="">All Employees</option>
                    {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                            {emp.firstName} {emp.lastName}
                        </option>
                    ))}
                </select>

                <input
                    type="date"
                    name="startDate"
                    value={filters.startDate}
                    onChange={handleFilterChange}
                    className="attendance-filter-input"
                />
                <span style={{ color: 'var(--text-muted)' }}>to</span>
                <input
                    type="date"
                    name="endDate"
                    value={filters.endDate}
                    onChange={handleFilterChange}
                    className="attendance-filter-input"
                />

                <div className="flex gap-2 ml-auto">
                    <Button variant="primary" size="sm" onClick={handleApplyFilters}>
                        Apply
                    </Button>
                    <Button variant="secondary" size="sm" onClick={handleClearFilters}>
                        Clear
                    </Button>
                </div>
            </div>

            {summaryData.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">
                        <ClipboardList size={48} className="text-icon-blue" />
                    </div>
                    <div className="empty-state-title">No records found</div>
                    <p>Try adjusting your filters to see attendance data.</p>
                </div>
            ) : (
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableHeader>Employee</TableHeader>
                            <TableHeader>Period</TableHeader>
                            <TableHeader>Attendance %</TableHeader>
                            <TableHeader>Total Hours</TableHeader>
                            <TableHeader>Overall Status</TableHeader>
                            <TableHeader align="right">Actions</TableHeader>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {summaryData.map((emp) => (
                            <TableRow key={emp.id} className="attendance-summary-row">
                                <TableCell>
                                    <div className="font-semibold text-primary">{emp.name}</div>
                                    <div className="text-muted text-xs">{emp.email}</div>
                                </TableCell>
                                <TableCell>{emp.period}</TableCell>
                                <TableCell>
                                    <div className="flex items-center">
                                        <span className="attendance-progress-text">{emp.percentage}%</span>
                                        <div className="attendance-progress-bar">
                                            <div
                                                className="attendance-progress-value"
                                                style={{ width: `${emp.percentage}%`, backgroundColor: emp.status === 'Critical' ? 'var(--color-danger)' : emp.status === 'Attention' ? 'var(--color-warning)' : 'var(--color-success)' }}
                                            ></div>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="font-medium">{emp.totalHours.toFixed(1)} hrs</TableCell>
                                <TableCell>
                                    <div className={`flex items-center gap-1.5 font-medium ${emp.status === 'Good' ? 'attendance-status-good' : emp.status === 'Attention' ? 'attendance-status-avg' : 'attendance-status-poor'}`}>
                                        {emp.status === 'Good' && <CheckCircle2 size={16} />}
                                        {emp.status === 'Attention' && <AlertCircle size={16} />}
                                        {emp.status === 'Critical' && <XCircle size={16} />}
                                        {emp.status}
                                    </div>
                                </TableCell>
                                <TableCell align="right">
                                    <button
                                        className="more-actions-btn"
                                        onClick={() => setSelectedEmployeeForDetails(emp)}
                                        title="View Details"
                                    >
                                        <MoreHorizontal size={20} />
                                    </button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}

            {/* Detailed View Modal */}
            <AttendanceDetailsModal
                isOpen={!!selectedEmployeeForDetails}
                onClose={() => setSelectedEmployeeForDetails(null)}
                employeeId={selectedEmployeeForDetails?.id}
                employeeName={selectedEmployeeForDetails?.name}
                records={selectedEmployeeForDetails?.records || []}
                onEditRecord={(record) => {
                    onCorrect(record);
                    // Keep modal open, let parent handle update
                }}
            />
        </Card>
    );
}
