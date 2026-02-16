import express from 'express';
import * as attendanceController from '../controllers/attendanceController.js';
import { authenticate } from '../middleware/auth.js';
import { anyRole } from '../middleware/roleGuard.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);
router.use(anyRole);

// POST /api/attendance/check-in - Check in
router.post('/check-in', attendanceController.checkIn);

// POST /api/attendance/check-out - Check out
router.post('/check-out', attendanceController.checkOut);

// GET /api/attendance/today - Get today's status
router.get('/today', attendanceController.getTodayStatus);

// GET /api/attendance/history - Get attendance history
router.get('/history', attendanceController.getHistory);

// GET /api/attendance/calendar - Get monthly calendar view
router.get('/calendar', attendanceController.getCalendarView);

// GET /api/attendance/overtime-summary - Get overtime summary
router.get('/overtime-summary', attendanceController.getOvertimeSummary);

export default router;
