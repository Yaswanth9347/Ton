import jwt from 'jsonwebtoken';
import jwtConfig from '../config/jwt.js';
import { UnauthorizedError } from '../utils/errors.js';
import db from '../models/db.js';

/**
 * Authentication middleware - verifies JWT token
 */
export const authenticate = async (req, res, next) => {
    try {
        // Get token from Authorization header or cookie
        let token;

        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        } else if (req.cookies && req.cookies.token) {
            token = req.cookies.token;
        }

        if (!token) {
            throw new UnauthorizedError('Please log in to access this resource');
        }

        // Verify token
        const decoded = jwt.verify(token, jwtConfig.secret);

        // Check if user still exists
        const result = await db.query(
            `SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.is_active, r.name as role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            throw new UnauthorizedError('User no longer exists');
        }

        const user = result.rows[0];

        if (!user.is_active) {
            throw new UnauthorizedError('Account has been deactivated');
        }

        // Attach user to request
        req.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role,
        };

        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return next(new UnauthorizedError('Invalid token'));
        }
        if (error.name === 'TokenExpiredError') {
            return next(new UnauthorizedError('Token has expired'));
        }
        next(error);
    }
};
