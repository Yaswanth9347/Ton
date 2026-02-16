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

// Use for Write operations (Create, Update, Delete) - Only Admins
export const adminOnly = roleGuard('ADMIN');

// Use for Sensitive Read operations (e.g. Downloading Receipts) - Admins & Supervisors
export const supervisorRo = roleGuard('ADMIN', 'SUPERVISOR');

// Use for General Read operations (Viewing Lists) - All Authenticated Roles
export const employeeRo = roleGuard('ADMIN', 'SUPERVISOR', 'EMPLOYEE');

export const anyRole = roleGuard('ADMIN', 'SUPERVISOR', 'EMPLOYEE');
