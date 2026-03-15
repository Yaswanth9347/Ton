import { ForbiddenError } from '../utils/errors.js';

/**
 * Role-based access control middleware
 * @param {...string} allowedRoles - Roles allowed to access the route
 */
export const roleGuard = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new ForbiddenError('User not authenticated'));
        }

        if (!allowedRoles.includes(req.user.role)) {
            return next(new ForbiddenError('You do not have permission to perform this action'));
        }

        next();
    };
};

// Convenience exports for common role checks
// adminOnly: strictly ADMIN — for employee mgmt, payroll, settings, attendance mgmt
export const adminOnly = roleGuard('ADMIN');
// operationalAdmin: ADMIN + SUPERVISOR — for Bores, Inventory (operational modules)
export const operationalAdmin = roleGuard('ADMIN', 'SUPERVISOR');
export const employeeOnly = roleGuard('EMPLOYEE');
export const anyRole = roleGuard('ADMIN', 'SUPERVISOR', 'EMPLOYEE');
