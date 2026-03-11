import { body, param, query } from 'express-validator';

/**
 * Password complexity regex:
 *  - At least 8 characters
 *  - At least 1 uppercase letter
 *  - At least 1 lowercase letter
 *  - At least 1 digit
 *  - At least 1 special character (!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`)
 */
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~])/;
export const PASSWORD_RULES = 'Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character';

export const loginValidator = [
    body('username')
        .trim()
        .notEmpty()
        .withMessage('Username is required')
        .isLength({ min: 3, max: 50 })
        .withMessage('Username must be between 3 and 50 characters'),
    body('password')
        .notEmpty()
        .withMessage('Password is required'),
];

export const createEmployeeValidator = [
    body('username')
        .trim()
        .notEmpty()
        .withMessage('Username is required')
        .isLength({ min: 3, max: 50 })
        .withMessage('Username must be between 3 and 50 characters')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username can only contain letters, numbers, and underscores'),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters')
        .matches(PASSWORD_REGEX)
        .withMessage(PASSWORD_RULES),
    body('firstName')
        .trim()
        .notEmpty()
        .withMessage('First name is required')
        .isLength({ max: 50 })
        .withMessage('First name must be at most 50 characters'),
    body('lastName')
        .trim()
        .notEmpty()
        .withMessage('Last name is required')
        .isLength({ max: 50 })
        .withMessage('Last name must be at most 50 characters'),
    body('email')
        .optional()
        .isEmail()
        .withMessage('Please provide a valid email')
        .normalizeEmail(),
    body('role')
        .optional()
        .isIn(['EMPLOYEE', 'SUPERVISOR'])
        .withMessage('Role must be EMPLOYEE or SUPERVISOR'),
];

export const updateEmployeeValidator = [
    param('id')
        .isInt()
        .withMessage('Invalid employee ID'),
    body('username')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Username cannot be empty')
        .isLength({ min: 3, max: 50 })
        .withMessage('Username must be between 3 and 50 characters')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username can only contain letters, numbers, and underscores'),
    body('email')
        .optional()
        .isEmail()
        .withMessage('Please provide a valid email')
        .normalizeEmail(),
    body('firstName')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('First name cannot be empty')
        .isLength({ max: 50 })
        .withMessage('First name must be at most 50 characters'),
    body('lastName')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Last name cannot be empty')
        .isLength({ max: 50 })
        .withMessage('Last name must be at most 50 characters'),
    body('role')
        .optional()
        .isIn(['EMPLOYEE', 'SUPERVISOR'])
        .withMessage('Role must be EMPLOYEE or SUPERVISOR'),
];

export const attendanceCorrectionValidator = [
    param('id')
        .isInt()
        .withMessage('Invalid attendance ID'),
    body('checkIn')
        .optional()
        .isISO8601()
        .withMessage('Check-in must be a valid datetime'),
    body('checkOut')
        .optional()
        .isISO8601()
        .withMessage('Check-out must be a valid datetime'),
];

export const dateFilterValidator = [
    query('startDate')
        .optional()
        .isDate()
        .withMessage('Start date must be a valid date (YYYY-MM-DD)'),
    query('endDate')
        .optional()
        .isDate()
        .withMessage('End date must be a valid date (YYYY-MM-DD)'),
    query('userId')
        .optional()
        .isInt()
        .withMessage('User ID must be an integer'),
];

export const changePasswordValidator = [
    body('currentPassword')
        .notEmpty()
        .withMessage('Current password is required'),
    body('newPassword')
        .isLength({ min: 8 })
        .withMessage('New password must be at least 8 characters')
        .matches(PASSWORD_REGEX)
        .withMessage(PASSWORD_RULES),
];
