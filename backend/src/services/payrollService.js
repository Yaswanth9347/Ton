import db from '../models/db.js';
import { AppError, ConflictError, NotFoundError } from '../utils/errors.js';
import * as overtimeService from './overtimeService.js';
import * as pdfService from './pdfService.js';
import {
    getCurrentISTDate,
    getISTDateString,
    getISTMonthBounds,
    getISTWeekdayIndex,
} from '../utils/dateTime.js';

// ─── Role-based LOP rates (Admin excluded — Admin manages payroll, no salary) ─
const LOP_RATES = {
    SUPERVISOR: 500,
    EMPLOYEE: 400
};

/**
 * Count Sundays in a given month/year
 */
function countSundaysInMonth(month, year) {
    const { daysInMonth } = getISTMonthBounds(month, year);
    let sundays = 0;
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (getISTWeekdayIndex(dateStr) === 0) {
            sundays++;
        }
    }
    return sundays;
}

/**
 * Get public holidays in a month that fall on weekdays (Mon–Sat),
 * excluding Sundays (to avoid double-counting).
 */
async function getWeekdayHolidaysInMonth(month, year) {
    const { startDate, endDate } = getISTMonthBounds(month, year);

    // Get one-time holidays in this month
    const result = await db.query(
        `SELECT holiday_date FROM holidays 
         WHERE holiday_date >= $1 AND holiday_date <= $2 
         AND (recurrence_type IS NULL OR recurrence_type = 'none')`,
        [startDate, endDate]
    );

    // Also get yearly recurring holidays that fall in this month
    const yearlyResult = await db.query(
        `SELECT recurrence_day, recurrence_month FROM holidays 
         WHERE recurrence_type = 'yearly' AND recurrence_month = $1`,
        [month]
    );

    const holidayDates = new Set();

    // One-time holidays
    for (const row of result.rows) {
        const holidayDate = getISTDateString(row.holiday_date);
        if (getISTWeekdayIndex(holidayDate) !== 0) {
            holidayDates.add(holidayDate);
        }
    }

    // Yearly recurring holidays
    for (const row of yearlyResult.rows) {
        const holidayDate = `${year}-${String(row.recurrence_month).padStart(2, '0')}-${String(row.recurrence_day).padStart(2, '0')}`;
        if (row.recurrence_month === month && getISTWeekdayIndex(holidayDate) !== 0) {
            holidayDates.add(holidayDate);
        }
    }

    return holidayDates;
}

/**
 * Calculate working days in a month (excluding Sundays and public holidays)
 */
async function calculateWorkingDays(month, year) {
    const { daysInMonth } = getISTMonthBounds(month, year);
    const sundays = countSundaysInMonth(month, year);
    const holidays = await getWeekdayHolidaysInMonth(month, year);
    const workingDays = daysInMonth - sundays - holidays.size;

    return { daysInMonth, sundays, publicHolidays: holidays.size, workingDays, holidayDates: [...holidays] };
}

/**
 * Get per-day LOP rate based on role name
 */
function getLopRate(roleName) {
    return LOP_RATES[roleName] || LOP_RATES.EMPLOYEE;
}

// ────────────────────────────────────────────────────────────────────────────

export const getPayrollByMonth = async (month, year) => {
    const result = await db.query(
        'SELECT * FROM payroll WHERE month = $1 AND year = $2',
        [month, year]
    );
    if (result.rows.length === 0) return null;

    const payroll = result.rows[0];
    const items = await db.query(
        `SELECT pi.*, u.first_name, u.last_name, u.username
         FROM payroll_items pi
         JOIN users u ON pi.user_id = u.id
         WHERE pi.payroll_id = $1`,
        [payroll.id]
    );
    payroll.items = items.rows;
    return payroll;
};

export const calculatePayrollPreview = async (month, year, callerUser) => {
    // 1. Get all NON-ADMIN employees who were active for ANY part of the month
    //    - Currently active employees
    //    - Active employees only
    const { startDate, endDate } = getISTMonthBounds(month, year);

    let usersQuery = `
        SELECT u.id, u.first_name, u.last_name, u.username, u.base_salary,
                u.is_active, r.name as role
         FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE r.name NOT IN ('ADMIN')
         AND u.is_active = true
    `;
    const queryParams = [];


    const users = await db.query(usersQuery, queryParams);

    // 2. Calculate working days (excludes Sundays + public holidays) for the full month
    const workingInfo = await calculateWorkingDays(month, year);
    const { daysInMonth, sundays, publicHolidays, workingDays, holidayDates } = workingInfo;

    const previewItems = [];
    let totalPayout = 0;

    for (const user of users.rows) {
        const baseSalary = parseFloat(user.base_salary) || 0;
        const lopRate = getLopRate(user.role);

        // Determine effective working days for this employee
        // If deactivated mid-month, only count working days up to deactivation date
        let effectiveWorkingDays = workingDays;
        let employeeStatus = 'active';
        let effectiveEndDate = endDate;


        // Pro-rate base salary based on active working days
        const proRatedSalary = effectiveWorkingDays === workingDays
            ? baseSalary
            : parseFloat(((baseSalary / workingDays) * effectiveWorkingDays).toFixed(2));

        // Count present days within the effective period
        const attendanceRes = await db.query(
            `SELECT COUNT(*) as days FROM attendance 
             WHERE user_id = $1 
             AND attendance_date >= $2 AND attendance_date <= $3 
             AND status = 'present'
             AND EXTRACT(dow FROM attendance_date) != 0`,
            [user.id, startDate, effectiveEndDate]
        );
        const presentDays = parseInt(attendanceRes.rows[0].days);

        // Absent days = effective working days minus present days
        const absentDays = Math.max(0, effectiveWorkingDays - presentDays);

        // LOP deduction
        const lopDeduction = absentDays * lopRate;

        // Overtime calculation
        const hourlyRate = baseSalary / (workingDays * 8); // use full-month rate for consistency
        const overtimeData = await overtimeService.calculateOvertimePay(user.id, month, year, hourlyRate);

        // Net salary
        const netSalary = Math.max(0, proRatedSalary - lopDeduction + overtimeData.totalOvertimeAmount);

        previewItems.push({
            user_id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            username: user.username,
            role: user.role,
            base_salary: baseSalary,
            pro_rated_salary: proRatedSalary,
            present_days: presentDays,
            absent_days: absentDays,
            working_days: effectiveWorkingDays,
            total_working_days: workingDays,
            days_in_month: daysInMonth,
            sundays,
            public_holidays: publicHolidays,
            lop_rate: lopRate,
            lop_deduction: parseFloat(lopDeduction.toFixed(2)),
            overtime_hours: overtimeData.totalOvertimeHours,
            overtime_amount: overtimeData.totalOvertimeAmount,
            gross_salary: proRatedSalary,
            net_salary: parseFloat(netSalary.toFixed(2)),
            employee_status: employeeStatus,
        });

        totalPayout += netSalary;
    }

    return {
        month,
        year,
        working_days: workingDays,
        days_in_month: daysInMonth,
        sundays,
        public_holidays: publicHolidays,
        holiday_dates: holidayDates,
        total_payout: parseFloat(totalPayout.toFixed(2)),
        items: previewItems
    };
};

export const generatePayroll = async (adminId, month, year, callerUser) => {
    // 1. Check if an active payroll already exists for this month
    const existingRes = await db.query(
        'SELECT id, version, status FROM payroll WHERE month = $1 AND year = $2 ORDER BY version DESC LIMIT 1',
        [month, year]
    );

    let nextVersion = 1;
    let reusePayrollId = null;

    if (existingRes.rows.length > 0) {
        const latest = existingRes.rows[0];

        // If there's already a payroll row for the month, regenerate in-place for DRAFT/CANCELLED.
        if (latest.status === 'DRAFT' || latest.status === 'CANCELLED') {
            reusePayrollId = latest.id;
            nextVersion = latest.version || 1;
        } else {
            // Don't allow regeneration if APPROVED or LOCKED
            throw new ConflictError(`Cannot regenerate: An ${latest.status} payroll already exists for this month. Cancel it first.`);
        }
    }

    // 2. Calculate
    const preview = await calculatePayrollPreview(month, year, callerUser);

    // 3. Insert Payroll Record
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        let payrollId = reusePayrollId;
        if (payrollId) {
            // Update existing payroll row and clear soft-delete fields if present.
            await client.query(
                `UPDATE payroll
                 SET status = 'DRAFT', total_payout = $1, generated_by = $2
                 WHERE id = $3`,
                [preview.total_payout, adminId, payrollId]
            );

            try {
                await client.query(
                    `UPDATE payroll
                     SET is_deleted = false, deleted_by = NULL, deleted_at = NULL, cancellation_reason = NULL
                     WHERE id = $1`,
                    [payrollId]
                );
            } catch (e) {
                // Ignore if columns don't exist in older schemas
            }

            // Replace items
            await client.query('DELETE FROM payroll_items WHERE payroll_id = $1', [payrollId]);
        } else {
            const payrollRes = await client.query(
                `INSERT INTO payroll (month, year, status, version, total_payout, generated_by)
                 VALUES ($1, $2, 'DRAFT', $3, $4, $5)
                 RETURNING id`,
                [month, year, nextVersion, preview.total_payout, adminId]
            );
            payrollId = payrollRes.rows[0].id;
        }

        // 4. Insert Items
        for (const item of preview.items) {
            await client.query(
                `INSERT INTO payroll_items 
                 (payroll_id, user_id, base_salary, present_days, total_attendance_deduction, approved_lunch_total, overtime_hours, overtime_amount, gross_salary, net_salary, details)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                [
                    payrollId,
                    item.user_id,
                    item.base_salary,
                    item.present_days,
                    item.lop_deduction,
                    0, // approved_lunch_total — unused, kept for schema compat
                    item.overtime_hours || 0,
                    item.overtime_amount || 0,
                    item.gross_salary,
                    item.net_salary,
                    JSON.stringify({
                        days_in_month: item.days_in_month,
                        working_days: item.working_days,
                        absent_days: item.absent_days,
                        sundays: item.sundays,
                        public_holidays: item.public_holidays,
                        lop_rate: item.lop_rate,
                        lop_deduction: item.lop_deduction,
                        role: item.role
                    })
                ]
            );
        }

        await client.query('COMMIT');
        return { id: payrollId, ...preview };
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

export const getEmployeePayrollHistory = async (userId) => {
    const result = await db.query(
        `SELECT pi.*, p.month, p.year, p.generated_at, p.status, p.version
         FROM payroll_items pi
         JOIN payroll p ON pi.payroll_id = p.id
         WHERE pi.user_id = $1 AND p.is_deleted = false
         ORDER BY p.year DESC, p.month DESC, p.version DESC`,
        [userId]
    );
    return result.rows;
};

export const exportPayrollToCSV = async (month, year, callerUser) => {
    const payroll = await getPayrollByMonth(month, year);
    if (!payroll) throw new AppError('Payroll not found', 404);

    const header = ['Employee ID', 'Name', 'Username', 'Role', 'Base Salary', 'Working Days', 'Present Days', 'Absent Days', 'LOP Rate', 'LOP Deduction', 'Overtime Hours', 'Overtime Amount', 'Net Salary', 'Generated At'];
    const rows = [header.join(',')];

    for (const item of payroll.items) {

        const details = item.details || {};
        rows.push([
            item.user_id,
            `"${item.first_name} ${item.last_name}"`,
            item.username,
            details.role || 'EMPLOYEE',
            item.base_salary,
            details.working_days || '-',
            item.present_days,
            details.absent_days || 0,
            details.lop_rate || '-',
            item.total_attendance_deduction,
            item.overtime_hours || 0,
            item.overtime_amount || 0,
            item.net_salary,
            getISTDateString(payroll.generated_at)
        ].join(','));
    }

    return rows.join('\n');
};

// ─── Lifecycle Endpoints ──────────────────────────────────────────────

export const approvePayroll = async (adminId, payrollId) => {
    const res = await db.query('UPDATE payroll SET status = $1, approved_by = $2, approved_at = NOW() WHERE id = $3 AND status = $4 RETURNING *',
        ['APPROVED', adminId, payrollId, 'DRAFT']
    );
    if (res.rowCount === 0) throw new Error('Payroll must be in DRAFT state to approve');
    return res.rows[0];
};

export const lockPayroll = async (adminId, payrollId) => {
    const res = await db.query('UPDATE payroll SET status = $1, locked_at = NOW() WHERE id = $2 AND status = $3 RETURNING *',
        ['LOCKED', payrollId, 'APPROVED']
    );
    if (res.rowCount === 0) throw new Error('Payroll must be in APPROVED state to lock');
    return res.rows[0];
};

export const cancelPayroll = async (adminId, payrollId, reason) => {
    const res = await db.query(
        `UPDATE payroll SET status = $1, is_deleted = true, deleted_by = $2, deleted_at = NOW(), cancellation_reason = $3
         WHERE id = $4 AND status IN ('DRAFT', 'APPROVED') RETURNING *`,
        ['CANCELLED', adminId, reason, payrollId]
    );
    if (res.rowCount === 0) throw new Error('Cannot cancel a LOCKED payroll. Reopen it first.');
    return res.rows[0];
};

export const reopenPayroll = async (adminId, payrollId) => {
    const res = await db.query(
        `UPDATE payroll SET status = $1, reopened_by = $2, reopened_at = NOW()
         WHERE id = $3 AND status = $4 RETURNING *`,
        ['DRAFT', adminId, payrollId, 'LOCKED']
    );
    if (res.rowCount === 0) throw new Error('Can only reopen LOCKED payrolls');
    return res.rows[0];
};

/**
 * Generate a payslip PDF for a specific user
 */
export const generatePayslipPDF = async (userId, month, year) => {
    let payrollItem = null;

    // Try to get from generated payroll first
    const payroll = await getPayrollByMonth(month, year);
    if (payroll) {
        payrollItem = payroll.items.find(item => item.user_id === userId);
    }

    // If no generated payroll, calculate from live preview
    if (!payrollItem) {
        const preview = await calculatePayrollPreview(month, year);
        const previewItem = preview.items.find(item => item.user_id === userId);
        if (!previewItem) {
            throw new NotFoundError('No payslip data found for this user in this period');
        }
        // Map preview fields to payroll_item format
        payrollItem = {
            user_id: previewItem.user_id,
            base_salary: previewItem.base_salary,
            present_days: previewItem.present_days,
            overtime_hours: previewItem.overtime_hours,
            overtime_amount: previewItem.overtime_amount,
            total_attendance_deduction: previewItem.lop_deduction,
            gross_salary: previewItem.base_salary,
            net_salary: previewItem.net_salary,
            details: {
                role: previewItem.role,
                working_days: previewItem.working_days,
                absent_days: previewItem.absent_days,
                lop_rate: previewItem.lop_rate,
            },
        };
    }

    // Get user details
    const userResult = await db.query(
        'SELECT id, username, first_name, last_name, email FROM users WHERE id = $1',
        [userId]
    );
    if (userResult.rows.length === 0) {
        throw new NotFoundError('User not found');
    }
    const user = userResult.rows[0];

    const details = payrollItem.details || {};
    const workingDays = details.working_days || 0;
    const absentDays = details.absent_days || 0;
    const lopRate = details.lop_rate || 0;

    // Prepare payslip data
    const payslipData = {
        employeeName: `${user.first_name} ${user.last_name}`,
        employeeId: `EMP${String(user.id).padStart(4, '0')}`,
        designation: details.role || 'Employee',
        monthName: pdfService.getMonthName(month),
        month,
        year,
        payDate: getCurrentISTDate(),
        workingDays,
        presentDays: parseInt(payrollItem.present_days) || 0,
        absentDays,
        leavesTaken: 0,
        overtimeHours: parseFloat(payrollItem.overtime_hours) || 0,
        baseSalary: parseFloat(payrollItem.base_salary) || 0,
        overtimeAmount: parseFloat(payrollItem.overtime_amount) || 0,
        expenseReimbursement: 0,
        lopRate,
        lopDeduction: parseFloat(payrollItem.total_attendance_deduction) || 0,
        attendanceDeduction: parseFloat(payrollItem.total_attendance_deduction) || 0,
        taxDeduction: 0,
        otherDeductions: 0,
        grossSalary: parseFloat(payrollItem.gross_salary) || 0,
        netSalary: parseFloat(payrollItem.net_salary) || 0
    };

    // Generate PDF
    const pdfBuffer = await pdfService.generatePayslipPDF(payslipData);
    return pdfBuffer;
};

/**
 * Get payslip details for a user
 */
export const getPayslipDetails = async (userId, month, year) => {
    const payroll = await getPayrollByMonth(month, year);
    if (!payroll) {
        throw new NotFoundError('Payroll not found for this period');
    }

    const payrollItem = payroll.items.find(item => item.user_id === userId);
    if (!payrollItem) {
        throw new NotFoundError('No payslip found for this user in this period');
    }

    return {
        ...payrollItem,
        month,
        year,
        generated_at: payroll.generated_at
    };
};
