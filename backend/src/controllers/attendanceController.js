import * as attendanceService from '../services/attendanceService.js';
import * as overtimeService from '../services/overtimeService.js';
import { getCurrentISTMonthYear, getISTMonthBounds } from '../utils/dateTime.js';

/**
 * Check in
 * POST /api/attendance/check-in
 */
export const checkIn = async (req, res, next) => {
    try {
        const { location } = req.body;
        const attendance = await attendanceService.checkIn(req.user.id, location);

        res.status(201).json({
            success: true,
            message: 'Check-in recorded successfully',
            data: attendance,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Check out
 * POST /api/attendance/check-out
 */
export const checkOut = async (req, res, next) => {
    try {
        const { location } = req.body;
        const attendance = await attendanceService.checkOut(req.user.id, location);

        res.json({
            success: true,
            message: 'Check-out recorded successfully',
            data: attendance,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get today's attendance status
 * GET /api/attendance/today
 */
export const getTodayStatus = async (req, res, next) => {
    try {
        const attendance = await attendanceService.getTodayAttendance(req.user.id);

        res.json({
            success: true,
            data: attendance || { status: 'not_checked_in' },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get attendance history
 * GET /api/attendance/history
 */
export const getHistory = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;

        const history = await attendanceService.getAttendanceHistory(
            req.user.id,
            startDate,
            endDate
        );

        res.json({
            success: true,
            data: history,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get monthly calendar view
 * GET /api/attendance/calendar
 */
export const getCalendarView = async (req, res, next) => {
    try {
        const { month, year } = req.query;
        const currentDate = getCurrentISTMonthYear();
        const targetMonth = month ? parseInt(month) : currentDate.month;
        const targetYear = year ? parseInt(year) : currentDate.year;

        const calendarData = await attendanceService.getMonthlyCalendarData(
            req.user.id,
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
 * Get overtime summary for current user
 * GET /api/attendance/overtime-summary
 */
export const getOvertimeSummary = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;
        const currentDate = getCurrentISTMonthYear();
        const { startDate: defaultStartDate, endDate: defaultEndDate } = getISTMonthBounds(currentDate.month, currentDate.year);

        const summary = await overtimeService.getOvertimeSummary(
            req.user.id,
            startDate || defaultStartDate,
            endDate || defaultEndDate
        );

        res.json({
            success: true,
            data: summary,
        });
    } catch (error) {
        next(error);
    }
};
