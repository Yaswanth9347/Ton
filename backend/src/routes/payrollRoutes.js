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

// Admin & Supervisor Routes (Supervisor has same privileges as Admin)
router.get('/preview', roleGuard('ADMIN', 'SUPERVISOR'), payrollController.getPayrollPreview);
router.post('/generate', roleGuard('ADMIN', 'SUPERVISOR'), payrollController.generatePayroll);
router.get('/export', roleGuard('ADMIN', 'SUPERVISOR'), payrollController.exportPayroll);
router.get('/admin-payslip/:userId/:month/:year', roleGuard('ADMIN', 'SUPERVISOR'), payrollController.downloadEmployeePayslip);

export default router;
