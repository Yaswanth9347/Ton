import { useState } from 'react';
import { payrollApi, adminApi } from '../../services/api';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { toast } from 'react-hot-toast';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../common/Table';
import { formatCurrency } from '../../utils/formatters';
import { FileText, AlertTriangle, History, X, UserX, Calendar, Download, RefreshCw, CheckCircle, Lock, Trash2, Unlock, UserCheck, IndianRupee } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './AdminPayrollTab.css';

export function AdminPayrollTab() {
    const { user } = useAuth();
    const isSupervisor = user?.role === 'SUPERVISOR';
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [generateLoading, setGenerateLoading] = useState(false);
    const [downloadingId, setDownloadingId] = useState(null);

    // Payroll history modal state
    const [historyModal, setHistoryModal] = useState(null);
    const [historyLoading, setHistoryLoading] = useState(false);

    const handlePreview = async () => {
        setLoading(true);
        setPreview(null);
        try {
            const response = await payrollApi.getPreview(month, year);
            setPreview(response.data.data);
        } catch (err) {
            toast.error('Failed to get preview: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async (action = 'generate') => {
        let confirmText = '';
        if (action === 'generate' || action === 'regenerate') confirmText = 'Generate a new Draft payroll for this month? (This will cancel any existing active drafts)';
        if (action === 'approve') confirmText = 'Approve this Draft? (This indicates it has been reviewed and is ready for payment tracking)';
        if (action === 'lock') confirmText = 'Lock this Payroll? (Once locked, it is highly restricted and requires an Admin to manually reopen)';
        if (action === 'cancel') confirmText = 'Cancel this Payroll? (This soft-deletes the record and allows generating a fresh draft)';
        if (action === 'reopen') confirmText = 'Reopen this locked Payroll? (This changes the status back to Draft)';

        if (confirmText && !window.confirm(confirmText)) return;

        setGenerateLoading(true);
        try {
            if (action === 'generate' || action === 'regenerate') {
                await payrollApi.generate(month, year);
            } else if (preview && preview.id) {
                if (action === 'approve') await payrollApi.approvePayroll(preview.id);
                if (action === 'lock') await payrollApi.lockPayroll(preview.id);
                if (action === 'cancel') await payrollApi.cancelPayroll(preview.id, 'Cancelled via UI');
                if (action === 'reopen') await payrollApi.reopenPayroll(preview.id);
            }
            toast.success(`Payroll ${action} successful!`);
            handlePreview(); // Refresh data to show new statuses
        } catch (err) {
            toast.error(`Failed to ${action}: ` + (err.response?.data?.message || err.message));
        } finally {
            setGenerateLoading(false);
        }
    };

    const handleExport = async () => {
        try {
            const response = await payrollApi.export(month, year);
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `payroll_report_${year}_${month}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Export failed:', error);
            toast.error('Failed to export. Payroll might not be generated yet.');
        }
    };

    const handleDownloadPayslip = async (userId) => {
        setDownloadingId(userId);
        try {
            const response = await payrollApi.downloadEmployeePayslip(userId, month, year);
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `payslip_emp${userId}_${year}_${String(month).padStart(2, '0')}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Failed to download payslip:', err);
            toast.error('Failed to download payslip. Please ensure payroll is generated.');
        } finally {
            setDownloadingId(null);
        }
    };

    const handleBulkDownload = async () => {
        if (!preview?.items?.length) return;

        for (const item of preview.items) {
            await handleDownloadPayslip(item.user_id);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    };

    const handleViewHistory = async (userId, firstName, lastName) => {
        setHistoryLoading(true);
        try {
            const response = await adminApi.getEmployeePayrollHistory(userId);
            setHistoryModal({
                userId,
                name: `${firstName} ${lastName}`,
                records: response.data.data,
            });
        } catch (err) {
            toast.error('Failed to load payroll history: ' + (err.response?.data?.message || err.message));
        } finally {
            setHistoryLoading(false);
        }
    };

    return (
        <div className="payroll-tab">
            <div className="payroll-header">
                <div className="payroll-header__title">
                    <h2>Payroll Management</h2>
                </div>
                <div className="payroll-header__actions">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleExport}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <Download size={14} />
                        Export CSV
                    </Button>
                    {preview && (
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleBulkDownload}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            <FileText size={14} />
                            Bulk Payslips
                        </Button>
                    )}
                </div>
            </div>

            <Card className="payroll-controls">
                <div className="payroll-controls__group">
                    <div className="payroll-filter">
                        <label className="payroll-filter__label">Payroll Period</label>
                        <select
                            className="form-input payroll-filter__select"
                            value={month}
                            onChange={(e) => setMonth(parseInt(e.target.value))}
                        >
                            {Array.from({ length: 12 }, (_, i) => (
                                <option key={i + 1} value={i + 1}>
                                    {new Date(0, i).toLocaleString('default', { month: 'long' })}
                                </option>
                            ))}
                        </select>
                        <input
                            type="number"
                            className="form-input payroll-filter__input"
                            value={year}
                            onChange={(e) => setYear(parseInt(e.target.value))}
                        />
                    </div>

                    <div className="payroll-controls__actions">
                        <Button
                            variant="primary"
                            onClick={handlePreview}
                            loading={loading}
                            style={{ minWidth: '120px' }}
                        >
                            {loading ? 'Loading...' : 'Load Review'}
                        </Button>
                    </div>
                </div>
            </Card>

            {preview && (
                <div className="fade-in">
                    {/* Summary Cards */}
                    <div className="payroll-stats">
                        <Card className="payroll-stat-card">
                            <div className="payroll-stat-card__icon text-muted">
                                <Calendar size={56} />
                            </div>
                            <div className="payroll-stat-card__label">Working Days</div>
                            <div className="payroll-stat-card__value">{preview.working_days}</div>
                            <div className="payroll-stat-card__subtext">
                                {preview.days_in_month}d total − {preview.sundays} Sun − {preview.public_holidays} Hol
                            </div>
                        </Card>
                        <Card className="payroll-stat-card">
                            <div className="payroll-stat-card__icon text-muted">
                                <UserCheck size={56} />
                            </div>
                            <div className="payroll-stat-card__label">Total Employees</div>
                            <div className="payroll-stat-card__value">{preview.items.length}</div>
                            <div className="payroll-stat-card__subtext">Active for {new Date(year, month - 1).toLocaleString('default', { month: 'short' })}</div>
                        </Card>
                        <Card className="payroll-stat-card">
                            <div className="payroll-stat-card__icon" style={{ color: 'var(--color-primary)', opacity: 0.1 }}>
                                <IndianRupee size={56} />
                            </div>
                            <div className="payroll-stat-card__label">Total Salary Payout</div>
                            <div className="payroll-stat-card__value" style={{ color: 'var(--color-primary)' }}>
                                {formatCurrency(preview.total_payout)}
                            </div>
                            <div className="payroll-stat-card__subtext">Net amount to be disbursed</div>
                        </Card>
                    </div>

                    <div style={{ marginTop: 'var(--spacing-6)' }}>
                        <Card className="payroll-table-card">
                            <div className="payroll-table-header">
                                <div className="payroll-table-header__title">
                                    <h3>{new Date(year, month - 1).toLocaleString('default', { month: 'long' })} {year} Preview</h3>
                                    {preview.status && (
                                        <span className={`badge payroll-badge badge-${preview.status === 'LOCKED' ? 'success' : preview.status === 'APPROVED' ? 'info' : preview.status === 'CANCELLED' ? 'danger' : 'warning'}`}>
                                            {preview.status} {preview.version ? `(v${preview.version})` : ''}
                                        </span>
                                    )}
                                </div>

                                <div className="payroll-table-actions">
                                    {(!preview.status || preview.status === 'CANCELLED') && (
                                        <Button variant="primary" size="sm" onClick={() => handleGenerate('generate')} loading={generateLoading}>
                                            <RefreshCw size={14} style={{ marginRight: '6px' }} />
                                            Generate Draft
                                        </Button>
                                    )}

                                    {preview.status === 'DRAFT' && (
                                        <>
                                            <Button variant="success" size="sm" onClick={() => handleGenerate('approve')} loading={generateLoading}>
                                                <CheckCircle size={14} style={{ marginRight: '6px' }} />
                                                Approve
                                            </Button>
                                            <Button variant="danger" size="sm" onClick={() => handleGenerate('cancel')} loading={generateLoading}>
                                                <X size={14} style={{ marginRight: '6px' }} />
                                                Cancel
                                            </Button>
                                        </>
                                    )}

                                    {preview.status === 'APPROVED' && (
                                        <>
                                            <Button variant="success" size="sm" onClick={() => handleGenerate('lock')} loading={generateLoading}>
                                                <Lock size={14} style={{ marginRight: '6px' }} />
                                                Lock (Finalize)
                                            </Button>
                                            <Button variant="danger" size="sm" onClick={() => handleGenerate('cancel')} loading={generateLoading}>
                                                <Trash2 size={14} style={{ marginRight: '6px' }} />
                                                Cancel
                                            </Button>
                                        </>
                                    )}

                                    {preview.status === 'LOCKED' && (
                                        <Button variant="warning" size="sm" onClick={() => handleGenerate('reopen')} loading={generateLoading}>
                                            <Unlock size={14} style={{ marginRight: '6px' }} />
                                            Reopen (Admin)
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableHeader>Employee</TableHeader>
                                        <TableHeader>Role</TableHeader>
                                        <TableHeader>Base Salary</TableHeader>
                                        <TableHeader>Attendance</TableHeader>
                                        <TableHeader>Absence/LOP</TableHeader>
                                        <TableHeader>Overtime</TableHeader>
                                        <TableHeader>Net Salary</TableHeader>
                                        <TableHeader style={{ textAlign: 'center' }}>Actions</TableHeader>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {preview.items.map((item) => (
                                        <TableRow key={item.user_id} className="payroll-table-row">
                                            <TableCell>
                                                <div className="employee-cell">
                                                    <span
                                                        className="employee-name text-sm"
                                                        onClick={() => handleViewHistory(item.user_id, item.first_name, item.last_name)}
                                                    >
                                                        {item.first_name} {item.last_name}
                                                    </span>
                                                    <span className="text-muted text-xs">
                                                        @{item.username}
                                                        {item.employee_status === 'deactivated' && (
                                                            <span style={{ color: 'var(--color-danger)', marginLeft: '6px' }}>
                                                                <UserX size={11} style={{ verticalAlign: 'middle', marginRight: '2px' }} />
                                                                Inactive
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="badge badge-info" style={{ fontSize: '10px', padding: '2px 6px' }}>
                                                    {item.role}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium">{formatCurrency(item.base_salary)}</div>
                                                {item.pro_rated_salary !== undefined && item.pro_rated_salary !== item.base_salary && (
                                                    <span className="pro-rated-badge">
                                                        Pro-rated: {formatCurrency(item.pro_rated_salary)}
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm">{item.present_days} / {item.working_days}</div>
                                                <div className="text-muted text-xs">days present</div>
                                            </TableCell>
                                            <TableCell>
                                                {item.absent_days > 0 ? (
                                                    <div>
                                                        <span className="badge badge-warning text-xs">
                                                            {item.absent_days} Abs
                                                        </span>
                                                        <div className="text-danger text-xs font-medium mt-1">
                                                            −{formatCurrency(item.lop_deduction)}
                                                        </div>
                                                    </div>
                                                ) : <span className="text-muted">—</span>}
                                            </TableCell>
                                            <TableCell>
                                                {item.overtime_hours > 0 ? (
                                                    <div>
                                                        <div className="text-sm font-medium">{item.overtime_hours}h</div>
                                                        <div className="text-success text-xs">
                                                            +{formatCurrency(item.overtime_amount)}
                                                        </div>
                                                    </div>
                                                ) : <span className="text-muted">—</span>}
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-bold text-base" style={{ color: 'var(--color-primary)' }}>
                                                    {formatCurrency(item.net_salary)}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-2 justify-center">
                                                    <button
                                                        className="payroll-action-btn"
                                                        onClick={() => handleDownloadPayslip(item.user_id)}
                                                        disabled={downloadingId === item.user_id}
                                                        title="Download Payslip"
                                                    >
                                                        {downloadingId === item.user_id ?
                                                            <div className="spinner spinner--sm" /> :
                                                            <FileText size={16} />
                                                        }
                                                    </button>
                                                    <button
                                                        className="payroll-action-btn"
                                                        onClick={() => handleViewHistory(item.user_id, item.first_name, item.last_name)}
                                                        title="Payroll History"
                                                    >
                                                        <History size={16} />
                                                    </button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Card>
                    </div>
                </div>
            )}

            {/* Payroll History Modal */}
            {historyModal && (
                <div className="payroll-history-overlay" onClick={() => setHistoryModal(null)}>
                    <div className="payroll-history-modal shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="payroll-history-header">
                            <h3 className="m-0">Payroll Record History — {historyModal.name}</h3>
                            <button
                                onClick={() => setHistoryModal(null)}
                                className="payroll-action-btn"
                                style={{ border: 'none', background: 'transparent' }}
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="payroll-history-body">
                            {historyModal.records.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="text-muted mb-2"><History size={48} className="mx-auto opacity-20" /></div>
                                    <p className="text-muted">No historical records found for this employee.</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableHeader>Month / Year</TableHeader>
                                            <TableHeader>Base Salary</TableHeader>
                                            <TableHeader>Attendance</TableHeader>
                                            <TableHeader>Deductions</TableHeader>
                                            <TableHeader>Overtime</TableHeader>
                                            <TableHeader>Net Salary</TableHeader>
                                            <TableHeader>Processed On</TableHeader>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {historyModal.records.map((record, idx) => {
                                            const details = record.details || {};
                                            return (
                                                <TableRow key={idx}>
                                                    <TableCell className="font-bold">
                                                        {new Date(record.year, record.month - 1).toLocaleString('default', { month: 'short' })} {record.year}
                                                    </TableCell>
                                                    <TableCell>{formatCurrency(parseFloat(record.base_salary))}</TableCell>
                                                    <TableCell>{record.present_days} / {details.working_days || '—'}</TableCell>
                                                    <TableCell className="text-danger">
                                                        {parseFloat(record.total_attendance_deduction) > 0 ?
                                                            `−${formatCurrency(parseFloat(record.total_attendance_deduction))}` : '—'}
                                                    </TableCell>
                                                    <TableCell className="text-success">
                                                        {parseFloat(record.overtime_amount) > 0 ?
                                                            `+${formatCurrency(parseFloat(record.overtime_amount))}` : '—'}
                                                    </TableCell>
                                                    <TableCell className="font-bold text-main">
                                                        {formatCurrency(parseFloat(record.net_salary))}
                                                    </TableCell>
                                                    <TableCell className="text-muted text-xs">
                                                        {record.generated_at ?
                                                            new Date(record.generated_at).toLocaleDateString('en-IN', {
                                                                day: '2-digit', month: 'short', year: 'numeric'
                                                            }) : '—'}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
