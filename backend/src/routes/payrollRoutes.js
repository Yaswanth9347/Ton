import express from 'express';
import * as payrollController from '../controllers/payrollController.js';
import { authenticate } from '../middleware/auth.js';
import { roleGuard } from '../middleware/roleGuard.js';

const router = express.Router();

router.use(authenticate);

// Employee Routes for personal payroll
router.get('/me', roleGuard('EMPLOYEE'), payrollController.getMyPayroll);

// Payslip routes (for any authenticated user)
router.get('/payslip/:month/:year', payrollController.downloadPayslip);
router.get('/payslip-details/:month/:year', payrollController.getPayslipDetails);

// Admin-only Payroll Routes (Supervisor cannot access)
router.get('/preview', roleGuard('ADMIN'), payrollController.getPayrollPreview);
router.post('/generate', roleGuard('ADMIN'), payrollController.generatePayroll);
router.get('/export', roleGuard('ADMIN'), payrollController.exportPayroll);
router.get('/admin-payslip/:userId/:month/:year', roleGuard('ADMIN'), payrollController.downloadEmployeePayslip);

// Admin-only Lifecycle Routes
router.put('/:id/approve', roleGuard('ADMIN'), payrollController.approvePayroll);
router.put('/:id/lock', roleGuard('ADMIN'), payrollController.lockPayroll);
router.put('/:id/reopen', roleGuard('ADMIN'), payrollController.reopenPayroll);
router.post('/:id/cancel', roleGuard('ADMIN'), payrollController.cancelPayroll);

export default router;
