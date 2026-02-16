import { Card } from '../common/Card';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../common/Table';
import { Button } from '../common/Button';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { Edit2, CalendarDays, UserX, UserCheck, Users } from 'lucide-react';

export function EmployeeTable({
    employees,
    loading = false,
    onEdit,
    onToggleActive,
    onViewCalendar,
    onViewPayroll
}) {
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
            <div className="flex justify-between items-center mb-4">
                <h3 className="card-title">Employees</h3>
            </div>

            {employees.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">
                        <Users size={48} className="text-icon-blue" />
                    </div>
                    <div className="empty-state-title">No employees found</div>
                    <p>Add your first employee to get started.</p>
                </div>
            ) : (
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableHeader>Username</TableHeader>
                            <TableHeader>Name</TableHeader>
                            <TableHeader>Role</TableHeader>
                            <TableHeader>Salary</TableHeader>
                            <TableHeader>Status</TableHeader>
                            <TableHeader>Joined</TableHeader>
                            <TableHeader>Actions</TableHeader>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {employees.map((employee) => (
                            <TableRow key={employee.id}>
                                <TableCell>
                                    <strong>{employee.username}</strong>
                                </TableCell>
                                <TableCell>{employee.firstName} {employee.lastName}</TableCell>
                                <TableCell>
                                    <span className={`badge ${employee.role === 'SUPERVISOR' ? 'badge-warning' : 'badge-info'}`}
                                        style={{ fontSize: '0.7rem' }}>
                                        {employee.role === 'SUPERVISOR' ? 'Supervisor' : 'Employee'}
                                    </span>
                                </TableCell>
                                <TableCell>{formatCurrency(employee.baseSalary)}</TableCell>
                                <TableCell>
                                    <span className={`badge ${employee.isActive ? 'badge-success' : 'badge-danger'}`}>
                                        {employee.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </TableCell>
                                <TableCell>{formatDate(employee.createdAt)}</TableCell>
                                <TableCell>
                                    <div className="flex gap-4">
                                        <button
                                            className="btn-icon-blue"
                                            onClick={() => onEdit(employee)}
                                            title="Edit employee"
                                        >
                                            <Edit2 size={18} className="icon-action-blue" />
                                        </button>
                                        {onViewCalendar && (
                                            <button
                                                className="btn-icon-blue"
                                                onClick={() => onViewCalendar(employee)}
                                                title="View attendance calendar"
                                            >
                                                <CalendarDays size={18} className="icon-action-blue" />
                                            </button>
                                        )}
                                        <button
                                            className={`${employee.isActive ? 'text-danger' : 'text-success'} transition-colors hover:scale-110`}
                                            onClick={() => onToggleActive(employee)}
                                            title={employee.isActive ? 'Deactivate' : 'Activate'}
                                            style={{ background: 'transparent', border: 'none', padding: 0 }}
                                        >
                                            {employee.isActive ? <UserX size={18} fill="currentColor" /> : <UserCheck size={18} fill="currentColor" />}
                                        </button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </Card>
    );
}
