import { useState, useEffect, useCallback } from 'react';
import { payrollApi } from '../services/api';

import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { toast } from 'react-hot-toast';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../components/common/Table';
import { formatCurrency } from '../utils/formatters';

export function EmployeePayrollPage() {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [downloadingId, setDownloadingId] = useState(null);

    const fetchPayroll = useCallback(async () => {
        setLoading(true);
        try {
            const response = await payrollApi.getMyPayroll();
            setHistory(response.data.data);
        } catch (err) {
            console.error('Failed to fetch payroll:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPayroll();
    }, [fetchPayroll]);

    const handleDownloadPDF = async (item) => {
        setDownloadingId(item.id);
        try {
            const response = await payrollApi.downloadPayslip(item.month, item.year);
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `payslip_${item.year}_${String(item.month).padStart(2, '0')}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Failed to download payslip:', err);
            toast.error('Failed to download payslip. Please try again.');
        } finally {
            setDownloadingId(null);
        }
    };

    // Get the latest payslip for summary card
    const latest = history.length > 0 ? history[0] : null;
    const latestDetails = latest?.details || {};

    return (
        <div>
            <main>
                <h1 className="mb-6">My Payslips 💰</h1>

                {/* Current Month Summary */}
                {latest && (
                    <div className="flex gap-4 mb-6 flex-wrap">
                        <Card style={{ flex: 1, minWidth: '150px', textAlign: 'center' }}>
                            <div className="text-muted text-xs mb-1">Base Salary</div>
                            <div className="text-xl font-bold">{formatCurrency(latest.base_salary)}</div>
                        </Card>
                        <Card style={{ flex: 1, minWidth: '150px', textAlign: 'center' }}>
                            <div className="text-muted text-xs mb-1">Days Present</div>
                            <div className="text-xl font-bold" style={{ color: 'var(--color-success)' }}>
                                {latest.present_days} / {latestDetails.working_days || '—'}
                            </div>
                        </Card>
                        <Card style={{ flex: 1, minWidth: '150px', textAlign: 'center' }}>
                            <div className="text-muted text-xs mb-1">LOP Deduction</div>
                            <div className="text-xl font-bold" style={{ color: latest.total_attendance_deduction > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                                {latest.total_attendance_deduction > 0
                                    ? `−${formatCurrency(latest.total_attendance_deduction)}`
                                    : '₹0'}
                            </div>
                            {latestDetails.absent_days > 0 && (
                                <div className="text-muted text-xs">
                                    {latestDetails.absent_days} days × ₹{latestDetails.lop_rate}
                                </div>
                            )}
                        </Card>
                        <Card style={{ flex: 1, minWidth: '150px', textAlign: 'center' }}>
                            <div className="text-muted text-xs mb-1">Net Pay</div>
                            <div className="text-xl font-bold" style={{ color: 'var(--color-primary)' }}>
                                {formatCurrency(latest.net_salary)}
                            </div>
                        </Card>
                    </div>
                )}

                <Card>
                    {loading ? (
                        <div className="loading"><div className="spinner"></div></div>
                    ) : history.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">📄</div>
                            <div className="empty-state-title">No payslips available</div>
                            <div className="text-muted">Your payslips will appear here once payroll is generated by the admin.</div>
                        </div>
                    ) : (
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableHeader>Period</TableHeader>
                                    <TableHeader>Base Salary</TableHeader>
                                    <TableHeader>Present / Working</TableHeader>
                                    <TableHeader>Absent Days</TableHeader>
                                    <TableHeader>LOP Deduction</TableHeader>
                                    <TableHeader>Overtime</TableHeader>
                                    <TableHeader>Net Pay</TableHeader>
                                    <TableHeader>Actions</TableHeader>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {history.map((item) => {
                                    const details = item.details || {};
                                    return (
                                        <TableRow key={item.id}>
                                            <TableCell style={{ fontWeight: 600 }}>
                                                {new Date(item.year, item.month - 1).toLocaleString('default', { month: 'long' })} {item.year}
                                            </TableCell>
                                            <TableCell>{formatCurrency(item.base_salary)}</TableCell>
                                            <TableCell>
                                                {item.present_days} / {details.working_days || '—'}
                                            </TableCell>
                                            <TableCell>
                                                {(details.absent_days || 0) > 0 ? (
                                                    <span className="badge badge-warning">{details.absent_days}</span>
                                                ) : (
                                                    <span className="badge badge-success">0</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {item.total_attendance_deduction > 0 ? (
                                                    <span style={{ color: 'var(--color-danger)' }}>
                                                        −{formatCurrency(item.total_attendance_deduction)}
                                                    </span>
                                                ) : '—'}
                                            </TableCell>
                                            <TableCell>
                                                {item.overtime_hours > 0 ? (
                                                    <span className="badge badge-info">
                                                        {item.overtime_hours}h ({formatCurrency(item.overtime_amount)})
                                                    </span>
                                                ) : '—'}
                                            </TableCell>
                                            <TableCell style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>
                                                {formatCurrency(item.net_salary)}
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => handleDownloadPDF(item)}
                                                    disabled={downloadingId === item.id}
                                                >
                                                    {downloadingId === item.id ? '⏳' : '📄'} PDF
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </Card>
            </main>
        </div>
    );
}
