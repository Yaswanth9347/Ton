import express from 'express';
import * as adminController from '../controllers/adminController.js';

import { authenticate } from '../middleware/auth.js';
import { adminOnly } from '../middleware/roleGuard.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
    createEmployeeValidator,
    updateEmployeeValidator,
    attendanceCorrectionValidator,
    dateFilterValidator,
} from '../utils/validators.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(adminOnly);

// Dashboard
// GET /api/admin/dashboard - Get dashboard statistics
router.get('/dashboard', adminController.getDashboard);

// Employee Management
// GET /api/admin/employees - Get all employees
router.get('/employees', adminController.getEmployees);

// POST /api/admin/employees - Add new employee
router.post('/employees', createEmployeeValidator, validateRequest, adminController.addEmployee);

// PUT /api/admin/employees/:id - Update employee
router.put('/employees/:id', updateEmployeeValidator, validateRequest, adminController.updateEmployee);

// PATCH /api/admin/employees/:id/deactivate - Deactivate employee
router.patch('/employees/:id/deactivate', adminController.deactivateEmployee);

// PATCH /api/admin/employees/:id/reactivate - Reactivate employee
router.patch('/employees/:id/reactivate', adminController.reactivateEmployee);

// Attendance Management
// GET /api/admin/attendance - Get all attendance records
router.get('/attendance', dateFilterValidator, validateRequest, adminController.getAllAttendance);

// GET /api/admin/attendance/export - Export attendance report
router.get('/attendance/export', adminController.exportAttendanceCSV);

// GET /api/admin/attendance/analytics - Get attendance analytics for charts
router.get('/attendance/analytics', adminController.getAttendanceAnalytics);

// POST /api/admin/attendance/bulk-upload - Bulk upload attendance
router.post('/attendance/bulk-upload', adminController.bulkUploadAttendance);

// GET /api/admin/attendance/:userId - Get employee attendance
router.get('/attendance/:userId', dateFilterValidator, validateRequest, adminController.getEmployeeAttendance);

// PUT /api/admin/attendance/:id - Correct attendance record
router.put('/attendance/:id', attendanceCorrectionValidator, validateRequest, adminController.correctAttendance);



// Overtime rules management
router.get('/overtime-rules', adminController.getOvertimeRules);
router.post('/overtime-rules', adminController.createOvertimeRule);
router.put('/overtime-rules/:id', adminController.updateOvertimeRule);
router.delete('/overtime-rules/:id', adminController.deleteOvertimeRule);

// Employee calendar view
router.get('/employees/:id/calendar', adminController.getEmployeeCalendar);

// Employee payroll history
router.get('/employees/:id/payroll-history', adminController.getEmployeePayrollHistory);

export default router;
