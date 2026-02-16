import db from '../models/db.js';
import { AppError, ValidationError, NotFoundError } from '../utils/errors.js';

/**
 * Get active overtime rules
 */
export const getActiveOvertimeRule = async () => {
    const result = await db.query(
        'SELECT * FROM overtime_rules WHERE is_active = true ORDER BY id LIMIT 1'
    );
    return result.rows[0] || {
        regular_hours_per_day: 8.0,
        overtime_multiplier: 1.5,
        weekend_multiplier: 2.0,
        holiday_multiplier: 2.0,
        max_overtime_per_day: 4.0
    };
};

/**
 * Get all overtime rules
 */
export const getAllOvertimeRules = async () => {
    const result = await db.query(
        'SELECT * FROM overtime_rules ORDER BY created_at DESC'
    );
    return result.rows;
};

/**
 * Create overtime rule
 */
export const createOvertimeRule = async (data) => {
    const { name, regularHoursPerDay, overtimeMultiplier, weekendMultiplier, holidayMultiplier, maxOvertimePerDay } = data;
    
    const result = await db.query(
        `INSERT INTO overtime_rules 
         (name, regular_hours_per_day, overtime_multiplier, weekend_multiplier, holiday_multiplier, max_overtime_per_day)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [name, regularHoursPerDay || 8.0, overtimeMultiplier || 1.5, weekendMultiplier || 2.0, holidayMultiplier || 2.0, maxOvertimePerDay || 4.0]
    );
    return result.rows[0];
};

/**
 * Update overtime rule
 */
export const updateOvertimeRule = async (id, data) => {
    const { name, regularHoursPerDay, overtimeMultiplier, weekendMultiplier, holidayMultiplier, maxOvertimePerDay, isActive } = data;
    
    const result = await db.query(
        `UPDATE overtime_rules SET
            name = COALESCE($1, name),
            regular_hours_per_day = COALESCE($2, regular_hours_per_day),
            overtime_multiplier = COALESCE($3, overtime_multiplier),
            weekend_multiplier = COALESCE($4, weekend_multiplier),
            holiday_multiplier = COALESCE($5, holiday_multiplier),
            max_overtime_per_day = COALESCE($6, max_overtime_per_day),
            is_active = COALESCE($7, is_active)
         WHERE id = $8
         RETURNING *`,
        [name, regularHoursPerDay, overtimeMultiplier, weekendMultiplier, holidayMultiplier, maxOvertimePerDay, isActive, id]
    );
    
    if (result.rows.length === 0) {
        throw new NotFoundError('Overtime rule not found');
    }
    return result.rows[0];
};

/**
 * Delete overtime rule
 */
export const deleteOvertimeRule = async (id) => {
    const result = await db.query(
        'DELETE FROM overtime_rules WHERE id = $1 RETURNING *',
        [id]
    );
    if (result.rows.length === 0) {
        throw new NotFoundError('Overtime rule not found');
    }
    return result.rows[0];
};

/**
 * Check if a date is a weekend
 */
export const isWeekend = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    return day === 0 || day === 6; // Sunday = 0, Saturday = 6
};

/**
 * Check if a date is a holiday
 */
export const isHoliday = async (date) => {
    const dateStr = new Date(date).toISOString().split('T')[0];
    const d = new Date(date);
    
    // Check one-time holidays
    const oneTimeResult = await db.query(
        `SELECT id FROM holidays 
         WHERE holiday_date = $1 AND (recurrence_type IS NULL OR recurrence_type = 'none')`,
        [dateStr]
    );
    if (oneTimeResult.rows.length > 0) return true;
    
    // Check weekly recurring (e.g., every Sunday)
    const dayOfWeek = d.getDay();
    const weeklyResult = await db.query(
        `SELECT id FROM holidays 
         WHERE recurrence_type = 'weekly' AND recurrence_day = $1`,
        [dayOfWeek]
    );
    if (weeklyResult.rows.length > 0) return true;
    
    // Check monthly recurring
    const dayOfMonth = d.getDate();
    const monthlyResult = await db.query(
        `SELECT id FROM holidays 
         WHERE recurrence_type = 'monthly' AND recurrence_day = $1`,
        [dayOfMonth]
    );
    if (monthlyResult.rows.length > 0) return true;
    
    // Check yearly recurring
    const month = d.getMonth() + 1;
    const yearlyResult = await db.query(
        `SELECT id FROM holidays 
         WHERE recurrence_type = 'yearly' AND recurrence_month = $1 AND recurrence_day = $2`,
        [month, dayOfMonth]
    );
    if (yearlyResult.rows.length > 0) return true;
    
    return false;
};

/**
 * Calculate hours worked and overtime for an attendance record
 */
export const calculateHoursWorked = async (checkIn, checkOut, attendanceDate) => {
    if (!checkIn || !checkOut) {
        return { totalHours: 0, regularHours: 0, overtimeHours: 0, multiplier: 1.0 };
    }
    
    const rule = await getActiveOvertimeRule();
    const regularHoursLimit = parseFloat(rule.regular_hours_per_day);
    const maxOvertime = parseFloat(rule.max_overtime_per_day);
    
    // Calculate total hours
    const checkInTime = new Date(checkIn);
    const checkOutTime = new Date(checkOut);
    let totalHours = (checkOutTime - checkInTime) / (1000 * 60 * 60);
    totalHours = Math.max(0, totalHours);
    
    // Determine multiplier based on day type
    let multiplier = parseFloat(rule.overtime_multiplier);
    const dateIsHoliday = await isHoliday(attendanceDate);
    const dateIsWeekend = isWeekend(attendanceDate);
    
    if (dateIsHoliday) {
        multiplier = parseFloat(rule.holiday_multiplier);
    } else if (dateIsWeekend) {
        multiplier = parseFloat(rule.weekend_multiplier);
    }
    
    // Calculate regular and overtime hours
    let regularHours = Math.min(totalHours, regularHoursLimit);
    let overtimeHours = Math.max(0, totalHours - regularHoursLimit);
    
    // Cap overtime at max allowed
    overtimeHours = Math.min(overtimeHours, maxOvertime);
    
    return {
        totalHours: parseFloat(totalHours.toFixed(2)),
        regularHours: parseFloat(regularHours.toFixed(2)),
        overtimeHours: parseFloat(overtimeHours.toFixed(2)),
        multiplier,
        isWeekend: dateIsWeekend,
        isHoliday: dateIsHoliday
    };
};

/**
 * Update attendance record with calculated hours
 */
export const updateAttendanceHours = async (attendanceId, regularHours, overtimeHours) => {
    await db.query(
        `UPDATE attendance SET regular_hours = $1, overtime_hours = $2, updated_at = NOW()
         WHERE id = $3`,
        [regularHours, overtimeHours, attendanceId]
    );
};

/**
 * Get overtime summary for a user in a date range
 */
export const getOvertimeSummary = async (userId, startDate, endDate) => {
    const result = await db.query(
        `SELECT 
            SUM(regular_hours) as total_regular_hours,
            SUM(overtime_hours) as total_overtime_hours,
            COUNT(*) as days_worked
         FROM attendance 
         WHERE user_id = $1 
         AND attendance_date BETWEEN $2 AND $3 
         AND status = 'present'`,
        [userId, startDate, endDate]
    );
    
    const summary = result.rows[0];
    return {
        totalRegularHours: parseFloat(summary.total_regular_hours || 0),
        totalOvertimeHours: parseFloat(summary.total_overtime_hours || 0),
        daysWorked: parseInt(summary.days_worked || 0)
    };
};

/**
 * Calculate overtime pay for payroll
 */
export const calculateOvertimePay = async (userId, month, year, hourlyRate) => {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    const result = await db.query(
        `SELECT 
            a.attendance_date,
            a.overtime_hours
         FROM attendance a
         WHERE a.user_id = $1 
         AND a.attendance_date BETWEEN $2 AND $3 
         AND a.overtime_hours > 0`,
        [userId, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
    );
    
    const rule = await getActiveOvertimeRule();
    let totalOvertimeHours = 0;
    let totalOvertimeAmount = 0;
    
    for (const record of result.rows) {
        const hours = parseFloat(record.overtime_hours);
        const dateIsHoliday = await isHoliday(record.attendance_date);
        const dateIsWeekend = isWeekend(record.attendance_date);
        
        let multiplier = parseFloat(rule.overtime_multiplier);
        if (dateIsHoliday) {
            multiplier = parseFloat(rule.holiday_multiplier);
        } else if (dateIsWeekend) {
            multiplier = parseFloat(rule.weekend_multiplier);
        }
        
        totalOvertimeHours += hours;
        totalOvertimeAmount += hours * hourlyRate * multiplier;
    }
    
    return {
        totalOvertimeHours: parseFloat(totalOvertimeHours.toFixed(2)),
        totalOvertimeAmount: parseFloat(totalOvertimeAmount.toFixed(2))
    };
};
