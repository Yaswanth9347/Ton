import db from '../models/db.js';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors.js';
import * as overtimeService from './overtimeService.js';

/**
 * Get today's date in YYYY-MM-DD format (server time)
 */
const getTodayDate = () => {
    const now = new Date();
    return now.toISOString().split('T')[0];
};

/**
 * Get current timestamp (server time)
 */
const getCurrentTimestamp = () => {
    return new Date();
};

/**
 * Get today's attendance for a user
 */
export const getTodayAttendance = async (userId) => {
    const today = getTodayDate();

    const result = await db.query(
        `SELECT id, user_id, attendance_date, check_in, check_out, status, is_complete, created_at, updated_at
     FROM attendance
     WHERE user_id = $1 AND attendance_date = $2`,
        [userId, today]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const row = result.rows[0];
    return {
        id: row.id,
        userId: row.user_id,
        date: row.attendance_date,
        checkIn: row.check_in,
        checkOut: row.check_out,
        status: row.status,
        isComplete: row.is_complete,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
};

/**
 * Record check-in for user with optional location
 */
export const checkIn = async (userId, location = null) => {
    const today = getTodayDate();

    // Check if already checked in today
    const existing = await getTodayAttendance(userId);
    if (existing) {
        throw new ConflictError('Already checked in today');
    }

    const checkInTime = getCurrentTimestamp();
    const latitude = location?.latitude || null;
    const longitude = location?.longitude || null;
    const address = location?.address || null;

    const result = await db.query(
        `INSERT INTO attendance (user_id, attendance_date, check_in, check_in_latitude, check_in_longitude, check_in_address, status, is_complete)
     VALUES ($1, $2, $3, $4, $5, $6, 'present', false)
     RETURNING id, user_id, attendance_date, check_in, check_in_latitude, check_in_longitude, check_in_address, check_out, status, is_complete, created_at`,
        [userId, today, checkInTime, latitude, longitude, address]
    );

    const row = result.rows[0];
    return {
        id: row.id,
        userId: row.user_id,
        date: row.attendance_date,
        checkIn: row.check_in,
        checkInLocation: row.check_in_latitude ? {
            latitude: parseFloat(row.check_in_latitude),
            longitude: parseFloat(row.check_in_longitude),
            address: row.check_in_address,
        } : null,
        checkOut: row.check_out,
        status: row.status,
        isComplete: row.is_complete,
        createdAt: row.created_at,
    };
};

/**
 * Record check-out for user with optional location
 */
export const checkOut = async (userId, location = null) => {
    const today = getTodayDate();

    // Check if checked in today
    const existing = await getTodayAttendance(userId);
    if (!existing) {
        throw new ValidationError('Must check in before checking out');
    }

    if (existing.checkOut) {
        throw new ConflictError('Already checked out today');
    }

    const checkOutTime = getCurrentTimestamp();
    const latitude = location?.latitude || null;
    const longitude = location?.longitude || null;
    const address = location?.address || null;

    const result = await db.query(
        `UPDATE attendance 
     SET check_out = $1, check_out_latitude = $2, check_out_longitude = $3, check_out_address = $4, is_complete = true, updated_at = CURRENT_TIMESTAMP
     WHERE id = $5
     RETURNING id, user_id, attendance_date, check_in, check_out, check_out_latitude, check_out_longitude, check_out_address, status, is_complete, updated_at`,
        [checkOutTime, latitude, longitude, address, existing.id]
    );

    const row = result.rows[0];

    // Calculate and store overtime hours
    try {
        const hoursData = await overtimeService.calculateHoursWorked(
            row.check_in,
            row.check_out,
            row.attendance_date
        );
        await overtimeService.updateAttendanceHours(
            row.id,
            hoursData.regularHours,
            hoursData.overtimeHours
        );
    } catch (err) {
        console.error('Error calculating overtime:', err);
    }

    return {
        id: row.id,
        userId: row.user_id,
        date: row.attendance_date,
        checkIn: row.check_in,
        checkOut: row.check_out,
        checkOutLocation: row.check_out_latitude ? {
            latitude: parseFloat(row.check_out_latitude),
            longitude: parseFloat(row.check_out_longitude),
            address: row.check_out_address,
        } : null,
        status: row.status,
        isComplete: row.is_complete,
        updatedAt: row.updated_at,
    };
};

/**
 * Get attendance history for a user
 */
export const getAttendanceHistory = async (userId, startDate, endDate) => {
    let query = `
    SELECT id, user_id, attendance_date, check_in, check_out, status, is_complete, created_at, updated_at
    FROM attendance
    WHERE user_id = $1
  `;
    const params = [userId];
    let paramCount = 2;

    if (startDate) {
        query += ` AND attendance_date >= $${paramCount++}`;
        params.push(startDate);
    }

    if (endDate) {
        query += ` AND attendance_date <= $${paramCount++}`;
        params.push(endDate);
    }

    query += ' ORDER BY attendance_date DESC';

    const result = await db.query(query, params);

    return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        date: row.attendance_date,
        checkIn: row.check_in,
        checkOut: row.check_out,
        status: row.status,
        isComplete: row.is_complete,
        totalHours: calculateTotalHours(row.check_in, row.check_out),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }));
};

/**
 * Calculate total hours between check-in and check-out
 */
const calculateTotalHours = (checkIn, checkOut) => {
    if (!checkIn || !checkOut) {
        return null;
    }

    const diff = new Date(checkOut) - new Date(checkIn);
    const hours = diff / (1000 * 60 * 60);
    return Math.round(hours * 100) / 100; // Round to 2 decimal places
};

/**
 * Get all attendance records with optional filters (admin)
 */
export const getAllAttendance = async ({ userId, startDate, endDate }) => {
    let query = `
    SELECT a.id, a.user_id, a.attendance_date, a.check_in, a.check_out, a.status, a.is_complete,
           a.created_at, a.updated_at, u.first_name, u.last_name, u.email
    FROM attendance a
    JOIN users u ON a.user_id = u.id
    WHERE 1=1
  `;
    const params = [];
    let paramCount = 1;

    if (userId) {
        query += ` AND a.user_id = $${paramCount++}`;
        params.push(userId);
    }

    if (startDate) {
        query += ` AND a.attendance_date >= $${paramCount++}`;
        params.push(startDate);
    }

    if (endDate) {
        query += ` AND a.attendance_date <= $${paramCount++}`;
        params.push(endDate);
    }

    query += ' ORDER BY a.attendance_date DESC, u.first_name ASC';

    const result = await db.query(query, params);

    return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        employeeName: `${row.first_name} ${row.last_name}`,
        employeeEmail: row.email,
        date: row.attendance_date,
        checkIn: row.check_in,
        checkOut: row.check_out,
        status: row.status,
        isComplete: row.is_complete,
        totalHours: calculateTotalHours(row.check_in, row.check_out),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }));
};

/**
 * Get attendance record by ID
 */
export const getAttendanceById = async (id) => {
    const result = await db.query(
        `SELECT a.id, a.user_id, a.attendance_date, a.check_in, a.check_out, a.status, a.is_complete,
            a.created_at, a.updated_at, u.first_name, u.last_name, u.email
     FROM attendance a
     JOIN users u ON a.user_id = u.id
     WHERE a.id = $1`,
        [id]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const row = result.rows[0];
    return {
        id: row.id,
        userId: row.user_id,
        employeeName: `${row.first_name} ${row.last_name}`,
        employeeEmail: row.email,
        date: row.attendance_date,
        checkIn: row.check_in,
        checkOut: row.check_out,
        status: row.status,
        isComplete: row.is_complete,
        totalHours: calculateTotalHours(row.check_in, row.check_out),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
};

/**
 * Update attendance record (admin correction)
 */
export const updateAttendance = async (id, updates) => {
    const attendance = await getAttendanceById(id);
    if (!attendance) {
        throw new NotFoundError('Attendance record not found');
    }

    const fields = [];
    const values = [];
    let paramCount = 1;

    if (updates.checkIn !== undefined) {
        fields.push(`check_in = $${paramCount++}`);
        values.push(updates.checkIn);
    }

    if (updates.checkOut !== undefined) {
        fields.push(`check_out = $${paramCount++}`);
        values.push(updates.checkOut);
    }

    if (updates.status !== undefined) {
        fields.push(`status = $${paramCount++}`);
        values.push(updates.status);
    }

    // Auto-update is_complete based on check-in and check-out
    const newCheckIn = updates.checkIn !== undefined ? updates.checkIn : attendance.checkIn;
    const newCheckOut = updates.checkOut !== undefined ? updates.checkOut : attendance.checkOut;
    const isComplete = !!(newCheckIn && newCheckOut);
    fields.push(`is_complete = $${paramCount++}`);
    values.push(isComplete);

    if (fields.length === 1) {
        // Only is_complete, no actual updates
        return attendance;
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await db.query(
        `UPDATE attendance SET ${fields.join(', ')} WHERE id = $${paramCount}
     RETURNING id, user_id, attendance_date, check_in, check_out, status, is_complete, updated_at`,
        values
    );

    return getAttendanceById(id);
};

/**
 * Get dashboard statistics (admin)
 */
export const getDashboardStats = async () => {
    const today = getTodayDate();

    // Total employees
    const totalResult = await db.query(
        `SELECT COUNT(*) as count FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE r.name = 'EMPLOYEE' AND u.is_active = true`
    );

    // Present today
    const presentResult = await db.query(
        `SELECT COUNT(*) as count FROM attendance
     WHERE attendance_date = $1 AND status = 'present'`,
        [today]
    );

    // Incomplete (checked in but not out)
    const incompleteResult = await db.query(
        `SELECT COUNT(*) as count FROM attendance
     WHERE attendance_date = $1 AND is_complete = false`,
        [today]
    );

    const totalEmployees = parseInt(totalResult.rows[0].count);
    const presentToday = parseInt(presentResult.rows[0].count);
    const incompleteToday = parseInt(incompleteResult.rows[0].count);
    const absentToday = totalEmployees - presentToday;

    return {
        totalEmployees,
        presentToday,
        absentToday,
        incompleteToday,
        date: today,
    };
};

/**
 * Bulk upload attendance from CSV data
 * Expected format: username, date (YYYY-MM-DD), check_in (HH:MM), check_out (HH:MM), status
 */
export const bulkUploadAttendance = async (records, adminId) => {
    const results = {
        success: 0,
        failed: 0,
        errors: []
    };

    for (const record of records) {
        try {
            const { username, date, checkIn, checkOut, status } = record;

            // Validate required fields
            if (!username || !date) {
                results.failed++;
                results.errors.push({ row: record, error: 'Username and date are required' });
                continue;
            }

            // Find user by username
            const userResult = await db.query(
                'SELECT id FROM users WHERE username = $1',
                [username.trim()]
            );

            if (userResult.rows.length === 0) {
                results.failed++;
                results.errors.push({ row: record, error: `User '${username}' not found` });
                continue;
            }

            const userId = userResult.rows[0].id;

            // Parse times
            const checkInTime = checkIn ? new Date(`${date}T${checkIn}:00`) : null;
            const checkOutTime = checkOut ? new Date(`${date}T${checkOut}:00`) : null;
            const isComplete = !!(checkInTime && checkOutTime);
            const recordStatus = status || (checkInTime ? 'present' : 'absent');

            // Upsert attendance record
            await db.query(
                `INSERT INTO attendance (user_id, attendance_date, check_in, check_out, status, is_complete)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (user_id, attendance_date) 
                 DO UPDATE SET check_in = COALESCE($3, attendance.check_in),
                               check_out = COALESCE($4, attendance.check_out),
                               status = $5,
                               is_complete = $6,
                               updated_at = NOW()`,
                [userId, date, checkInTime, checkOutTime, recordStatus, isComplete]
            );

            results.success++;
        } catch (error) {
            results.failed++;
            results.errors.push({ row: record, error: error.message });
        }
    }

    return results;
};

/**
 * Get attendance analytics for dashboard charts
 */
export const getAttendanceAnalytics = async (startDate, endDate) => {
    // Daily attendance trend
    const dailyTrend = await db.query(
        `SELECT 
            attendance_date,
            COUNT(*) FILTER (WHERE status = 'present') as present,
            COUNT(*) FILTER (WHERE status = 'absent' OR status IS NULL) as absent,
            COUNT(*) FILTER (WHERE status = 'half_day') as half_day,
            COUNT(*) FILTER (WHERE status = 'late') as late
         FROM attendance
         WHERE attendance_date >= $1 AND attendance_date <= $2
         GROUP BY attendance_date
         ORDER BY attendance_date`,
        [startDate, endDate]
    );

    // Overall summary
    const summary = await db.query(
        `SELECT 
            COUNT(*) as total_records,
            COUNT(*) FILTER (WHERE status = 'present') as total_present,
            COUNT(*) FILTER (WHERE is_complete = true) as total_complete,
            AVG(EXTRACT(EPOCH FROM (check_out - check_in)) / 3600) as avg_hours
         FROM attendance
         WHERE attendance_date >= $1 AND attendance_date <= $2`,
        [startDate, endDate]
    );

    return {
        dailyTrend: dailyTrend.rows,
        summary: summary.rows[0]
    };
};

/**
 * Get monthly calendar data for a user
 */
export const getMonthlyCalendarData = async (userId, month, year) => {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Check if user is active
    const userResult = await db.query(
        'SELECT is_active FROM users WHERE id = $1',
        [userId]
    );

    const isUserActive = userResult.rows[0]?.is_active || false;

    // Get attendance records for the month
    const attendanceResult = await db.query(
        `SELECT 
            attendance_date, check_in, check_out, status, is_complete, 
            regular_hours, overtime_hours
         FROM attendance 
         WHERE user_id = $1 
         AND attendance_date >= $2 AND attendance_date <= $3
         ORDER BY attendance_date`,
        [userId, startDateStr, endDateStr]
    );

    // Leaves feature removed
    const leavesResult = { rows: [] };

    // Holidays feature removed
    const holidaysResult = { rows: [] };

    // Build calendar data
    const calendarDays = [];
    const daysInMonth = endDate.getDate();

    for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(year, month - 1, day);
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayOfWeek = currentDate.getDay();

        // Check if weekend (only Sunday = 0)
        const isWeekend = dayOfWeek === 0;

        // Check if holiday
        let isHoliday = false;
        let holidayName = null;
        for (const holiday of holidaysResult.rows) {
            if (holiday.holiday_date?.toISOString().split('T')[0] === dateStr) {
                isHoliday = true;
                holidayName = holiday.name;
                break;
            }
            // Check recurring
            if (holiday.recurrence_type === 'weekly' && holiday.recurrence_day === dayOfWeek) {
                isHoliday = true;
                holidayName = holiday.name;
                break;
            }
            if (holiday.recurrence_type === 'monthly' && holiday.recurrence_day === day) {
                isHoliday = true;
                holidayName = holiday.name;
                break;
            }
            if (holiday.recurrence_type === 'yearly' &&
                holiday.recurrence_month === month &&
                holiday.recurrence_day === day) {
                isHoliday = true;
                holidayName = holiday.name;
                break;
            }
        }

        // Check if on approved leave
        let isOnLeave = false;
        let leaveType = null;
        for (const leave of leavesResult.rows) {
            const leaveStart = new Date(leave.start_date);
            const leaveEnd = new Date(leave.end_date);
            if (currentDate >= leaveStart && currentDate <= leaveEnd) {
                isOnLeave = true;
                leaveType = leave.leave_type_name || leave.leave_type;
                break;
            }
        }

        // Find attendance record
        const attendance = attendanceResult.rows.find(
            a => a.attendance_date.toISOString().split('T')[0] === dateStr
        );

        // Determine status
        let status = 'none';
        let displayStatus = '';

        // If user is inactive, mark all days as holiday
        if (!isUserActive) {
            status = 'holiday';
            displayStatus = 'Inactive Account';
        } else if (isHoliday) {
            status = 'holiday';
            displayStatus = holidayName || 'Holiday';
        } else if (isOnLeave) {
            status = 'leave';
            displayStatus = leaveType || 'Leave';
        } else if (isWeekend) {
            status = 'weekend';
            displayStatus = 'Weekend';
        } else if (attendance) {
            if (attendance.is_complete) {
                status = 'present';
                displayStatus = 'Present';
            } else if (attendance.check_in && !attendance.check_out) {
                status = 'half_day';
                displayStatus = 'Incomplete';
            } else {
                status = 'present';
                displayStatus = 'Present';
            }
        } else if (currentDate < new Date()) {
            status = 'absent';
            displayStatus = 'Absent';
        }

        calendarDays.push({
            date: dateStr,
            day,
            dayOfWeek,
            status,
            displayStatus,
            isWeekend,
            isHoliday,
            holidayName,
            isOnLeave,
            leaveType,
            attendance: attendance ? {
                checkIn: attendance.check_in,
                checkOut: attendance.check_out,
                isComplete: attendance.is_complete,
                regularHours: parseFloat(attendance.regular_hours || 0),
                overtimeHours: parseFloat(attendance.overtime_hours || 0)
            } : null
        });
    }

    // Calculate summary
    const summary = {
        totalWorkingDays: calendarDays.filter(d => !d.isWeekend && !d.isHoliday).length,
        presentDays: calendarDays.filter(d => d.status === 'present').length,
        absentDays: calendarDays.filter(d => d.status === 'absent').length,
        leaveDays: calendarDays.filter(d => d.status === 'leave').length,
        halfDays: calendarDays.filter(d => d.status === 'half_day').length,
        holidays: calendarDays.filter(d => d.isHoliday).length,
        weekends: calendarDays.filter(d => d.isWeekend && !d.isHoliday).length
    };

    return {
        month,
        year,
        days: calendarDays,
        summary
    };
};
