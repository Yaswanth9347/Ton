import { useState } from 'react';
import { payrollApi, adminApi } from '../../services/api';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { toast } from 'react-hot-toast';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../common/Table';
import { formatCurrency } from '../../utils/formatters';
import { FileText, AlertTriangle, History, X, UserX } from 'lucide-react';

export function AdminPayrollTab() {
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

    const handleGenerate = async () => {
        if (!window.confirm('Are you sure? This action is irreversible. Salary pay date should be between 1st–4th of the month.')) return;

        setGenerateLoading(true);
        try {
            await payrollApi.generate(month, year);
            toast.success('Payroll generated successfully!');
            setPreview(null);
        } catch (err) {
            toast.error('Failed to generate: ' + (err.response?.data?.message || err.message));
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
        <div>
            <h2 className="mb-4">Payroll Management</h2>

            <Card className="mb-6">
                <div className="flex gap-4 items-end flex-wrap">
                    <div className="form-group mb-0">
                        <label className="form-label">Month</label>
                        <select className="form-input" value={month} onChange={(e) => setMonth(parseInt(e.target.value))}
                            style={{ padding: '6px 10px', fontSize: '0.85rem' }}>
                            {Array.from({ length: 12 }, (_, i) => (
                                <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group mb-0">
                        <label className="form-label">Year</label>
                        <input type="number" className="form-input" value={year} onChange={(e) => setYear(parseInt(e.target.value))}
                            style={{ padding: '6px 10px', fontSize: '0.85rem' }} />
                    </div>
                    <Button variant="primary" size="sm" onClick={handlePreview} loading={loading}>
                        Load Preview
                    </Button>
                    <Button variant="secondary" size="sm" onClick={handleExport}>
                        📥 Export CSV
                    </Button>
                    {preview && (
                        <Button variant="secondary" size="sm" onClick={handleBulkDownload}>
                            📄 Bulk PDF Download
                        </Button>
                    )}
                </div>
            </Card>

            {preview && (
                <div className="fade-in">
                    {/* Summary Cards */}
                    <div className="flex gap-4 mb-4 flex-wrap">
                        <Card style={{ flex: 1, minWidth: '180px', textAlign: 'center' }}>
                            <div className="text-muted text-xs mb-1">Working Days</div>
                            <div className="text-xl font-bold">{preview.working_days}</div>
                            <div className="text-muted text-xs">
                                {preview.days_in_month} days − {preview.sundays} Sun − {preview.public_holidays} holidays
                            </div>
                        </Card>
                        <Card style={{ flex: 1, minWidth: '180px', textAlign: 'center' }}>
                            <div className="text-muted text-xs mb-1">Total Employees</div>
                            <div className="text-xl font-bold">{preview.items.length}</div>
                        </Card>
                        <Card style={{ flex: 1, minWidth: '180px', textAlign: 'center' }}>
                            <div className="text-muted text-xs mb-1">Total Payout</div>
                            <div className="text-xl font-bold" style={{ color: 'var(--color-primary)' }}>
                                {formatCurrency(preview.total_payout)}
                            </div>
                        </Card>
                    </div>

                    <div className="flex justify-between items-center mb-4">
                        <h3>Preview: {new Date(year, month - 1).toLocaleString('default', { month: 'long' })} {year}</h3>
                        <div className="flex gap-4 items-center">
                            <Button variant="success" size="sm" onClick={handleGenerate} loading={generateLoading}>
                                Generate Payroll
                            </Button>
                        </div>
                    </div>

                    <Card>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableHeader>Employee</TableHeader>
                                    <TableHeader>Role</TableHeader>
                                    <TableHeader>Base Salary</TableHeader>
                                    <TableHeader>Present / Working</TableHeader>
                                    <TableHeader>Absent Days</TableHeader>
                                    <TableHeader>LOP Deduction</TableHeader>
                                    <TableHeader>Overtime</TableHeader>
                                    <TableHeader>Net Salary</TableHeader>
                                    <TableHeader>Actions</TableHeader>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {preview.items.map((item) => (
                                    <TableRow key={item.user_id}>
                                        <TableCell>
                                            <div
                                                style={{ cursor: 'pointer', color: 'var(--color-primary)' }}
                                                onClick={() => handleViewHistory(item.user_id, item.first_name, item.last_name)}
                                                title="View payroll history"
                                            >
                                                {item.first_name} {item.last_name}
                                            </div>
                                            <div className="text-muted text-xs">
                                                @{item.username}
                                                {item.employee_status === 'deactivated' && (
                                                    <span style={{ color: 'var(--color-danger)', marginLeft: '6px', fontWeight: 600 }}>
                                                        <UserX size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '2px' }} />
                                                        Deactivated
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                                                {item.role}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            {formatCurrency(item.base_salary)}
                                            {item.pro_rated_salary !== undefined && item.pro_rated_salary !== item.base_salary && (
                                                <div className="text-muted text-xs" style={{ color: 'var(--color-warning)' }}>
                                                    Pro-rated: {formatCurrency(item.pro_rated_salary)}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {item.present_days} / {item.working_days}
                                            {item.total_working_days && item.working_days !== item.total_working_days && (
                                                <div className="text-muted text-xs">(of {item.total_working_days} total)</div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {item.absent_days > 0 ? (
                                                <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                    <AlertTriangle size={12} /> {item.absent_days}
                                                </span>
                                            ) : (
                                                <span className="badge badge-success">0</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {item.lop_deduction > 0 ? (
                                                <span style={{ color: 'var(--color-danger)' }}>
                                                    −{formatCurrency(item.lop_deduction)}
                                                </span>
                                            ) : '—'}
                                            {item.lop_deduction > 0 && (
                                                <div className="text-muted text-xs">
                                                    {item.absent_days} × ₹{item.lop_rate}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {item.overtime_hours > 0 ? (
                                                <span className="badge badge-info">
                                                    {item.overtime_hours}h ({formatCurrency(item.overtime_amount)})
                                                </span>
                                            ) : '—'}
                                        </TableCell>
                                        <TableCell className="font-bold">{formatCurrency(item.net_salary)}</TableCell>
                                        <TableCell>
                                            <div className="flex gap-4">
                                                <button
                                                    onClick={() => handleDownloadPayslip(item.user_id)}
                                                    disabled={downloadingId === item.user_id}
                                                    title="Download Payslip"
                                                    style={{
                                                        background: 'transparent', border: 'none', padding: 0,
                                                        color: 'var(--color-primary)', cursor: 'pointer',
                                                        opacity: downloadingId === item.user_id ? 0.5 : 1,
                                                        transition: 'transform 0.15s',
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
                                                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                                >
                                                    {downloadingId === item.user_id ? '⏳' : <FileText size={18} />}
                                                </button>
                                                <button
                                                    onClick={() => handleViewHistory(item.user_id, item.first_name, item.last_name)}
                                                    title="View Payroll History"
                                                    style={{
                                                        background: 'transparent', border: 'none', padding: 0,
                                                        color: 'var(--color-primary)', cursor: 'pointer',
                                                        transition: 'transform 0.15s',
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
                                                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                                >
                                                    <History size={18} />
                                                </button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                </div>
            )}

            {/* Payroll History Modal — solid opaque background */}
            {historyModal && (
                <div
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0, 0, 0, 0.85)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 1000, backdropFilter: 'blur(4px)',
                    }}
                    onClick={() => setHistoryModal(null)}
                >
                    <div
                        style={{
                            background: 'var(--color-bg-card, #1a1d2e)',
                            borderRadius: '12px', padding: '24px',
                            maxWidth: '800px', width: '90%', maxHeight: '80vh',
                            overflow: 'auto',
                            border: '1px solid var(--color-border, #2a2d3e)',
                            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-4">
                            <h3 style={{ margin: 0 }}>Payroll History — {historyModal.name}</h3>
                            <button
                                onClick={() => setHistoryModal(null)}
                                style={{
                                    background: 'transparent', border: 'none', cursor: 'pointer',
                                    color: 'var(--color-primary)',
                                }}
                            >
                                <X size={22} />
                            </button>
                        </div>

                        {historyModal.records.length === 0 ? (
                            <div className="text-muted text-center" style={{ padding: '32px' }}>
                                No payroll records found. Payroll history will appear here once payroll is generated.
                            </div>
                        ) : (
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableHeader>Period</TableHeader>
                                        <TableHeader>Base Salary</TableHeader>
                                        <TableHeader>Present Days</TableHeader>
                                        <TableHeader>Deductions</TableHeader>
                                        <TableHeader>Overtime</TableHeader>
                                        <TableHeader>Net Salary</TableHeader>
                                        <TableHeader>Generated</TableHeader>
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
                                                <TableCell>
                                                    {parseFloat(record.total_attendance_deduction) > 0 ? (
                                                        <span style={{ color: 'var(--color-danger)' }}>
                                                            −{formatCurrency(parseFloat(record.total_attendance_deduction))}
                                                        </span>
                                                    ) : '—'}
                                                </TableCell>
                                                <TableCell>
                                                    {parseFloat(record.overtime_amount) > 0
                                                        ? formatCurrency(parseFloat(record.overtime_amount))
                                                        : '—'}
                                                </TableCell>
                                                <TableCell className="font-bold">
                                                    {formatCurrency(parseFloat(record.net_salary))}
                                                </TableCell>
                                                <TableCell className="text-muted text-xs">
                                                    {record.generated_at
                                                        ? new Date(record.generated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                                        : '—'}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
