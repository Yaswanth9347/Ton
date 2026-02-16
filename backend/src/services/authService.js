import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../models/db.js';
import jwtConfig from '../config/jwt.js';
import { UnauthorizedError, ValidationError } from '../utils/errors.js';

const SALT_ROUNDS = 10;

/**
 * Hash a password using bcrypt
 */
export const hashPassword = async (password) => {
    return bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Compare password with hash
 */
export const comparePassword = async (password, hash) => {
    return bcrypt.compare(password, hash);
};

/**
 * Generate JWT token
 */
export const generateToken = (userId) => {
    return jwt.sign({ userId }, jwtConfig.secret, {
        expiresIn: jwtConfig.expiresIn,
    });
};

/**
 * Authenticate user with username and password
 */
export const authenticateUser = async (username, password) => {
    // Find user by username
    const result = await db.query(
        `SELECT u.id, u.username, u.email, u.password_hash, u.first_name, u.last_name, u.is_active, r.name as role
     FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE u.username = $1`,
        [username]
    );

    if (result.rows.length === 0) {
        throw new UnauthorizedError('Invalid username or password');
    }

    const user = result.rows[0];

    if (!user.is_active) {
        throw new UnauthorizedError('Account has been deactivated');
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.password_hash);
    if (!isValidPassword) {
        throw new UnauthorizedError('Invalid username or password');
    }

    // Generate token
    const token = generateToken(user.id);

    return {
        token,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role,
        },
    };
};

/**
 * Get user profile by ID
 */
export const getUserProfile = async (userId) => {
    const result = await db.query(
        `SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.is_active, u.created_at, u.profile_photo_url, r.name as role
     FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE u.id = $1`,
        [userId]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const user = result.rows[0];
    return {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        isActive: user.is_active,
        createdAt: user.created_at,
        profilePhotoUrl: user.profile_photo_url,
    };
};
