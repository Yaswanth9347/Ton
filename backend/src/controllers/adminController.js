import * as userService from '../services/userService.js';
import * as attendanceService from '../services/attendanceService.js';
import * as payrollService from '../services/payrollService.js';
import { getCurrentISTDate, getCurrentISTMonthYear, getISTDateDaysAgo } from '../utils/dateTime.js';
import * as overtimeService from '../services/overtimeService.js';
import { logAudit } from '../middleware/auditLogger.js';
import db from '../models/db.js';

/**
 * Get dashboard statistics
 * GET /api/admin/dashboard
 */
export const getDashboard = async (req, res, next) => {
    try {
        const stats = await attendanceService.getDashboardStats();

        res.json({
            success: true,
            data: stats,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all employees
 * GET /api/admin/employees
 */
export const getEmployees = async (req, res, next) => {
    try {
        const employees = await userService.getAllEmployees();

        res.json({
            success: true,
            data: employees,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Add new employee
 * POST /api/admin/employees
 */
export const addEmployee = async (req, res, next) => {
    try {
        const { username, password, firstName, lastName, email, role } = req.body;

        const employee = await userService.createEmployee({
            username,
            password,
            firstName,
            lastName,
            email,
            role,
        });

        // Log audit
        await logAudit(req.user.id, 'CREATE', 'EMPLOYEE', employee.id, null, {
            username: employee.username,
            firstName: employee.firstName,
            lastName: employee.lastName,
        });

        res.status(201).json({
            success: true,
            message: 'Employee created successfully',
            data: employee,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update employee
 * PUT /api/admin/employees/:id
 */
export const updateEmployee = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Get old values for audit
        const oldEmployee = await userService.getEmployeeById(id);

        const employee = await userService.updateEmployee(id, updates);

        // Log audit
        await logAudit(req.user.id, 'UPDATE', 'EMPLOYEE', employee.id, {
            username: oldEmployee.username,
            firstName: oldEmployee.firstName,
            lastName: oldEmployee.lastName,
            role: oldEmployee.role,
            baseSalary: oldEmployee.baseSalary,
        }, {
            username: employee.username,
            firstName: employee.firstName,
            lastName: employee.lastName,
            role: employee.role,
            baseSalary: employee.baseSalary,
        });

        res.json({
            success: true,
            message: 'Employee updated successfully',
            data: employee,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Deactivate employee
 * PATCH /api/admin/employees/:id/deactivate
 */
export const deactivateEmployee = async (req, res, next) => {
    try {
        const { id } = req.params;

        const employee = await userService.deactivateEmployee(id);

        // Log audit
        await logAudit(req.user.id, 'DEACTIVATE', 'EMPLOYEE', parseInt(id), { isActive: true }, { isActive: false });

        res.json({
            success: true,
            message: 'Employee deactivated successfully',
            data: employee,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Reactivate employee
 * PATCH /api/admin/employees/:id/reactivate
 */
export const reactivateEmployee = async (req, res, next) => {
    try {
        const { id } = req.params;

        const employee = await userService.reactivateEmployee(id);

        // Log audit
        await logAudit(req.user.id, 'REACTIVATE', 'EMPLOYEE', parseInt(id), { isActive: false }, { isActive: true });

        res.json({
            success: true,
            message: 'Employee reactivated successfully',
            data: employee,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Unlock employee account
 * PATCH /api/admin/employees/:id/unlock
 */
export const unlockEmployee = async (req, res, next) => {
    try {
        const { id } = req.params;

        const employee = await userService.unlockEmployee(id);

        await logAudit(req.user.id, 'UNLOCK', 'EMPLOYEE', parseInt(id), { accountLocked: true }, { accountLocked: false });

        res.json({
            success: true,
            message: 'Employee account unlocked successfully',
            data: employee,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all attendance records
 * GET /api/admin/attendance
 */
export const getAllAttendance = async (req, res, next) => {
    try {
        const { userId, startDate, endDate } = req.query;

        const attendance = await attendanceService.getAllAttendance({
            userId: userId ? parseInt(userId) : null,
            startDate,
            endDate,
        });

        res.json({
            success: true,
            data: attendance,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get employee attendance
 * GET /api/admin/attendance/:userId
 */
export const getEmployeeAttendance = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { startDate, endDate } = req.query;

        const attendance = await attendanceService.getAttendanceHistory(
            parseInt(userId),
            startDate,
            endDate
        );

        res.json({
            success: true,
            data: attendance,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Correct attendance record
 * PUT /api/admin/attendance/:id
 */
export const correctAttendance = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Get old values for audit
        const oldAttendance = await attendanceService.getAttendanceById(id);

        const attendance = await attendanceService.updateAttendance(id, updates);

        // Log audit
        await logAudit(req.user.id, 'CORRECT', 'ATTENDANCE', attendance.id, {
            checkIn: oldAttendance.checkIn,
            checkOut: oldAttendance.checkOut,
            status: oldAttendance.status,
        }, {
            checkIn: attendance.checkIn,
            checkOut: attendance.checkOut,
            status: attendance.status,
        });

        res.json({
            success: true,
            message: 'Attendance corrected successfully',
            data: attendance,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get audit logs
 * GET /api/admin/audit-logs
 */


/**
 * Export attendance report as CSV
 * GET /api/admin/attendance/export
 */
export const exportAttendanceCSV = async (req, res, next) => {
    try {
        const { userId, startDate, endDate } = req.query;
        const attendance = await attendanceService.getAllAttendance({
            userId: userId ? parseInt(userId) : null,
            startDate,
            endDate,
        });

        // Generate CSV string
        const header = ["Date", "Employee Name", "Username", "Check In", "Check Out", "Total Hours", "Status", "In Location", "Out Location"].join(",");
        const rows = attendance.map(a => [
            a.date,
            `"${a.employeeName}"`,
            a.username || '',
            a.checkIn || '',
            a.checkOut || '',
            a.totalHours || '0',
            a.status,
            a.checkInLocation?.address ? `"${a.checkInLocation.address}"` : '',
            a.checkOutLocation?.address ? `"${a.checkOutLocation.address}"` : ''
        ].join(","));

        const csvContent = [header, ...rows].join("\n");

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=attendance_report_${getCurrentISTDate()}.csv`);
        res.status(200).send(csvContent);
    } catch (error) {
        next(error);
    }
};

/**
 * Bulk upload attendance from CSV
 * POST /api/admin/attendance/bulk-upload
 */
export const bulkUploadAttendance = async (req, res, next) => {
    try {
        const { records } = req.body;

        if (!records || !Array.isArray(records) || records.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No records provided. Expected an array of attendance records.'
            });
        }

        const results = await attendanceService.bulkUploadAttendance(records, req.user.id);

        await logAudit(req.user.id, 'BULK_UPLOAD', 'ATTENDANCE', null, null, {
            totalRecords: records.length,
            success: results.success,
            failed: results.failed
        });

        res.json({
            success: true,
            message: `Processed ${records.length} records: ${results.success} successful, ${results.failed} failed`,
            data: results
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get attendance analytics for charts
 * GET /api/admin/attendance/analytics
 */
export const getAttendanceAnalytics = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;

        // Default to last 30 days if not specified
        const end = endDate || getCurrentISTDate();
        const start = startDate || getISTDateDaysAgo(30);

        const analytics = await attendanceService.getAttendanceAnalytics(start, end);

        res.json({
            success: true,
            data: analytics
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all overtime rules
 * GET /api/admin/overtime-rules
 */
export const getOvertimeRules = async (req, res, next) => {
    try {
        const rules = await overtimeService.getAllOvertimeRules();
        res.json({
            success: true,
            data: rules
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Create overtime rule
 * POST /api/admin/overtime-rules
 */
export const createOvertimeRule = async (req, res, next) => {
    try {
        const rule = await overtimeService.createOvertimeRule(req.body);

        await logAudit(req.user.id, 'CREATE', 'OVERTIME_RULE', rule.id, null, rule);

        res.status(201).json({
            success: true,
            message: 'Overtime rule created successfully',
            data: rule
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update overtime rule
 * PUT /api/admin/overtime-rules/:id
 */
export const updateOvertimeRule = async (req, res, next) => {
    try {
        const { id } = req.params;
        const oldRule = (await overtimeService.getAllOvertimeRules()).find(r => r.id === parseInt(id));

        const rule = await overtimeService.updateOvertimeRule(id, req.body);

        await logAudit(req.user.id, 'UPDATE', 'OVERTIME_RULE', rule.id, oldRule, rule);

        res.json({
            success: true,
            message: 'Overtime rule updated successfully',
            data: rule
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete overtime rule
 * DELETE /api/admin/overtime-rules/:id
 */
export const deleteOvertimeRule = async (req, res, next) => {
    try {
        const { id } = req.params;
        const rule = await overtimeService.deleteOvertimeRule(id);

        await logAudit(req.user.id, 'DELETE', 'OVERTIME_RULE', parseInt(id), rule, null);

        res.json({
            success: true,
            message: 'Overtime rule deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get employee calendar view (admin)
 * GET /api/admin/employees/:id/calendar
 */
export const getEmployeeCalendar = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { month, year } = req.query;
        const currentDate = getCurrentISTMonthYear();
        const targetMonth = month ? parseInt(month) : currentDate.month;
        const targetYear = year ? parseInt(year) : currentDate.year;

        const calendarData = await attendanceService.getMonthlyCalendarData(
            parseInt(id),
            targetMonth,
            targetYear
        );

        res.json({
            success: true,
            data: calendarData,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get payroll history for a specific employee
 * GET /api/admin/employees/:id/payroll-history
 */
export const getEmployeePayrollHistory = async (req, res, next) => {
    try {
        const { id } = req.params;

        const history = await payrollService.getEmployeePayrollHistory(parseInt(id));

        res.json({
            success: true,
            data: history,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get login audit history
 * GET /api/admin/login-history
 */
export const getLoginHistory = async (req, res, next) => {
    try {
        const { limit = 50, offset = 0, username, action } = req.query;

        let whereClause = '';
        const params = [];
        const conditions = [];

        if (username) {
            params.push(`%${username}%`);
            conditions.push(`la.username ILIKE $${params.length}`);
        }

        if (action) {
            params.push(action);
            conditions.push(`la.action = $${params.length}`);
        }

        if (conditions.length > 0) {
            whereClause = 'WHERE ' + conditions.join(' AND ');
        }

        params.push(parseInt(limit));
        params.push(parseInt(offset));

        const result = await db.query(
            `SELECT la.id, la.user_id, la.username, la.action,
                    la.ip_address, la.user_agent, la.details, la.created_at
             FROM login_audit la
             ${whereClause}
             ORDER BY la.created_at DESC
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        // Get total count for pagination
        const countResult = await db.query(
            `SELECT COUNT(*) as total FROM login_audit la ${whereClause}`,
            params.slice(0, -2) // exclude limit & offset
        );

        res.json({
            success: true,
            data: {
                records: result.rows.map((r) => ({
                    id: r.id,
                    userId: r.user_id,
                    username: r.username,
                    action: r.action,
                    ipAddress: r.ip_address,
                    userAgent: r.user_agent,
                    details: r.details,
                    createdAt: r.created_at,
                })),
                total: parseInt(countResult.rows[0].total),
                limit: parseInt(limit),
                offset: parseInt(offset),
            },
        });
    } catch (error) {
        // Table might not exist yet
        if (error.code === '42P01') {
            return res.json({ success: true, data: { records: [], total: 0, limit: 50, offset: 0 } });
        }
        next(error);
    }
};
