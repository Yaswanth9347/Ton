import * as payrollService from '../services/payrollService.js';
import { logAudit } from '../middleware/auditLogger.js';

export const getPayrollPreview = async (req, res, next) => {
    try {
        const { month, year } = req.query;
        if (!month || !year) throw new Error('Month and Year are required');

        const preview = await payrollService.calculatePayrollPreview(parseInt(month), parseInt(year), req.user);
        res.json({ success: true, data: preview });
    } catch (error) {
        next(error);
    }
};

export const generatePayroll = async (req, res, next) => {
    try {
        const { month, year } = req.body;
        if (!month || !year) throw new Error('Month and Year are required');

        const payroll = await payrollService.generatePayroll(req.user.id, parseInt(month), parseInt(year), req.user);

        await logAudit(req.user.id, 'GENERATE', 'PAYROLL', payroll.id, null, { month, year });

        res.json({ success: true, data: payroll });
    } catch (error) {
        next(error);
    }
};

export const getMyPayroll = async (req, res, next) => {
    try {
        const history = await payrollService.getEmployeePayrollHistory(req.user.id);
        res.json({ success: true, data: history });
    } catch (error) {
        next(error);
    }
};

export const exportPayroll = async (req, res, next) => {
    try {
        const { month, year } = req.query;
        if (!month || !year) throw new Error('Month and Year are required');

        const csv = await payrollService.exportPayrollToCSV(parseInt(month), parseInt(year), req.user);

        res.header('Content-Type', 'text/csv');
        res.attachment(`payroll_${year}_${month}.csv`);
        res.send(csv);
    } catch (error) {
        next(error);
    }
};

/**
 * Download payslip PDF for current user
 * GET /api/payroll/payslip/:month/:year
 */
export const downloadPayslip = async (req, res, next) => {
    try {
        const { month, year } = req.params;
        if (!month || !year) throw new Error('Month and Year are required');

        const pdfBuffer = await payrollService.generatePayslipPDF(
            req.user.id,
            parseInt(month),
            parseInt(year)
        );

        res.header('Content-Type', 'application/pdf');
        res.header('Content-Disposition', `attachment; filename=payslip_${year}_${month}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        next(error);
    }
};

/**
 * Get payslip details for current user
 * GET /api/payroll/payslip-details/:month/:year
 */
export const getPayslipDetails = async (req, res, next) => {
    try {
        const { month, year } = req.params;
        if (!month || !year) throw new Error('Month and Year are required');

        const details = await payrollService.getPayslipDetails(
            req.user.id,
            parseInt(month),
            parseInt(year)
        );

        res.json({ success: true, data: details });
    } catch (error) {
        next(error);
    }
};

/**
 * Admin: Download payslip PDF for any user
 * GET /api/admin/payroll/payslip/:userId/:month/:year
 */
export const downloadEmployeePayslip = async (req, res, next) => {
    try {
        const { userId, month, year } = req.params;
        if (!userId || !month || !year) throw new Error('User ID, Month and Year are required');

        const pdfBuffer = await payrollService.generatePayslipPDF(
            parseInt(userId),
            parseInt(month),
            parseInt(year)
        );

        res.header('Content-Type', 'application/pdf');
        res.header('Content-Disposition', `attachment; filename=payslip_emp${userId}_${year}_${month}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        next(error);
    }
};

// ─── Lifecycle Controllers ──────────────────────────────────────────────

export const approvePayroll = async (req, res, next) => {
    try {
        const { id } = req.params;
        const payroll = await payrollService.approvePayroll(req.user.id, parseInt(id));
        await logAudit(req.user.id, 'APPROVE', 'PAYROLL', payroll.id, null, null);
        res.json({ success: true, message: 'Payroll approved successfully', data: payroll });
    } catch (error) {
        next(error);
    }
};

export const lockPayroll = async (req, res, next) => {
    try {
        const { id } = req.params;
        const payroll = await payrollService.lockPayroll(req.user.id, parseInt(id));
        await logAudit(req.user.id, 'LOCK', 'PAYROLL', payroll.id, null, null);
        res.json({ success: true, message: 'Payroll locked successfully', data: payroll });
    } catch (error) {
        next(error);
    }
};

export const cancelPayroll = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const payroll = await payrollService.cancelPayroll(req.user.id, parseInt(id), reason);
        await logAudit(req.user.id, 'CANCEL', 'PAYROLL', payroll.id, null, { reason });
        res.json({ success: true, message: 'Payroll cancelled successfully', data: payroll });
    } catch (error) {
        next(error);
    }
};

export const reopenPayroll = async (req, res, next) => {
    try {
        const { id } = req.params;
        const payroll = await payrollService.reopenPayroll(req.user.id, parseInt(id));
        await logAudit(req.user.id, 'REOPEN', 'PAYROLL', payroll.id, null, null);
        res.json({ success: true, message: 'Payroll reopened to draft successfully', data: payroll });
    } catch (error) {
        next(error);
    }
};
