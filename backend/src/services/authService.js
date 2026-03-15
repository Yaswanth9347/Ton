/**
 * Auth Service — handles authentication, login security, and password resets.
 *
 * Security features:
 *  - Failed login attempt tracking
 *  - Account lockout after MAX_FAILED_ATTEMPTS (Admin only → email reset)
 *  - Password reset token generation & validation
 *  - Role-based reset hierarchy enforcement
 */

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import db from '../models/db.js';
import jwtConfig from '../config/jwt.js';
import { UnauthorizedError, ValidationError, ForbiddenError, NotFoundError } from '../utils/errors.js';
import { sendAdminResetEmail, sendLoginWarningEmail } from './emailService.js';
import { ensureAuthSchema } from '../utils/ensureAuthSchema.js';
import { ensureDefaultAuthUsers } from '../utils/ensureDefaultAuthUsers.js';
import { PASSWORD_REGEX, PASSWORD_RULES } from '../utils/validators.js';

const SALT_ROUNDS = 10;
const MAX_FAILED_ATTEMPTS = 3;
const RESET_TOKEN_EXPIRY_HOURS = 1;

// =============================================
// PASSWORD UTILITIES
// =============================================

export const hashPassword = async (password) => {
    return bcrypt.hash(password, SALT_ROUNDS);
};

export const comparePassword = async (password, hash) => {
    return bcrypt.compare(password, hash);
};

export const generateToken = (userId) => {
    return jwt.sign({ userId }, jwtConfig.secret, {
        expiresIn: jwtConfig.expiresIn,
    });
};

// =============================================
// LOGIN WITH ATTEMPT TRACKING
// =============================================

export const authenticateUser = async (username, password) => {
    const authSchema = await ensureAuthSchema();
    await ensureDefaultAuthUsers();

    // Find user (case-insensitive username match)
    const result = await db.query(
        `SELECT u.id, u.username, u.email, u.password_hash, u.first_name, u.last_name,
                u.is_active, u.profile_photo_url,
                ${authSchema.failed_login_attempts ? 'u.failed_login_attempts' : '0'} as failed_login_attempts,
                ${authSchema.account_locked ? 'u.account_locked' : 'false'} as account_locked,
                r.name as role
         FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE LOWER(u.username) = LOWER($1)`,
        [username]
    );

    if (result.rows.length === 0) {
        throw new UnauthorizedError('Invalid username or password');
    }

    const user = result.rows[0];

    // Check if account is locked
    if (user.account_locked) {
        if (user.role === 'ADMIN') {
            throw new ForbiddenError(
                'Admin account is locked due to multiple failed login attempts. ' +
                'A password reset link has been sent to the registered email. Please check your inbox.'
            );
        } else {
            throw new ForbiddenError(
                'Your account has been locked due to multiple failed login attempts. ' +
                'Please contact the Admin to reset your password.'
            );
        }
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.password_hash);

    if (!isValidPassword) {
        // Increment failed attempts
        const newAttempts = (user.failed_login_attempts || 0) + 1;

        if (authSchema.failed_login_attempts || authSchema.last_failed_login) {
            const updateParts = [];
            const params = [];

            if (authSchema.failed_login_attempts) {
                params.push(newAttempts);
                updateParts.push(`failed_login_attempts = $${params.length}`);
            }
            if (authSchema.last_failed_login) {
                updateParts.push('last_failed_login = CURRENT_TIMESTAMP');
            }

            params.push(user.id);
            await db.query(
                `UPDATE users SET ${updateParts.join(', ')} WHERE id = $${params.length}`,
                params
            );
        }

        // Lockout after MAX_FAILED_ATTEMPTS — all roles
        if (newAttempts >= MAX_FAILED_ATTEMPTS) {
            // Lock account
            if (authSchema.account_locked) {
                await db.query(
                    `UPDATE users SET account_locked = true WHERE id = $1`,
                    [user.id]
                );
            }

            if (user.role === 'ADMIN') {
                // Admin: generate reset token and send email
                const resetToken = crypto.randomBytes(32).toString('hex');
                const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
                const expiry = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

                if (authSchema.reset_token && authSchema.reset_token_expiry) {
                    await db.query(
                        `UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3`,
                        [resetTokenHash, expiry, user.id]
                    );
                }

                const adminName = `${user.first_name} ${user.last_name}`.trim() || user.username;
                if (user.email) {
                    sendLoginWarningEmail(user.email, adminName, newAttempts).catch(e =>
                        console.error('[AUTH] Warning email error:', e.message)
                    );
                    sendAdminResetEmail(user.email, resetToken, adminName).catch(e =>
                        console.error('[AUTH] Reset email error:', e.message)
                    );
                }

                throw new ForbiddenError(
                    'Admin account locked after ' + MAX_FAILED_ATTEMPTS + ' failed attempts. ' +
                    'A password reset link has been sent to the registered email.'
                );
            } else {
                // Supervisor / Employee: lock and tell them to contact Admin
                throw new ForbiddenError(
                    'Your account has been locked after ' + MAX_FAILED_ATTEMPTS + ' failed login attempts. ' +
                    'Please contact the Admin to reset your password.'
                );
            }
        }

        throw new UnauthorizedError('Invalid username or password');
    }

    // Check if account is active
    if (!user.is_active) {
        throw new ForbiddenError('Your account has been deactivated. Please contact the administrator.');
    }

    // Successful login — reset failed attempts
    if ((user.failed_login_attempts > 0 || user.account_locked) && (authSchema.failed_login_attempts || authSchema.account_locked)) {
        const resetParts = [];
        if (authSchema.failed_login_attempts) resetParts.push('failed_login_attempts = 0');
        if (authSchema.account_locked) resetParts.push('account_locked = false');
        await db.query(
            `UPDATE users SET ${resetParts.join(', ')} WHERE id = $1`,
            [user.id]
        );
    }

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
            profilePhotoUrl: user.profile_photo_url,
        },
    };
};

// =============================================
// USER PROFILE
// =============================================

export const getUserProfile = async (userId) => {
    const result = await db.query(
        `SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.is_active,
                u.created_at, u.profile_photo_url, r.name as role
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

// =============================================
// ADMIN-ONLY: FORGOT PASSWORD (Email-based)
// =============================================

/**
 * Initiate password reset for Admin account.
 * Only the Admin's registered email can trigger this.
 */
export const forgotPasswordAdmin = async (email) => {
    const authSchema = await ensureAuthSchema();

    // Find admin user by email
    const result = await db.query(
        `SELECT u.id, u.username, u.email, u.first_name, u.last_name, r.name as role
         FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE u.email = $1 AND r.name = 'ADMIN'`,
        [email]
    );

    // Always return success message to prevent email enumeration
    if (result.rows.length === 0) {
        return { message: 'If that email is associated with an Admin account, a reset link has been sent.' };
    }

    const admin = result.rows[0];

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiry = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    if (!authSchema.reset_token || !authSchema.reset_token_expiry) {
        throw new ValidationError('Password reset schema is unavailable. Please contact support.');
    }

    await db.query(
        `UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3`,
        [resetTokenHash, expiry, admin.id]
    );

    const adminName = `${admin.first_name} ${admin.last_name}`.trim() || admin.username;
    await sendAdminResetEmail(admin.email, resetToken, adminName);

    return { message: 'If that email is associated with an Admin account, a reset link has been sent.' };
};

// =============================================
// RESET PASSWORD WITH TOKEN (Admin email flow)
// =============================================

export const resetPasswordWithToken = async (token, newPassword) => {
    const authSchema = await ensureAuthSchema();
    if (!authSchema.reset_token || !authSchema.reset_token_expiry) {
        throw new ValidationError('Password reset schema is unavailable. Please contact support.');
    }

    // Hash the provided token and find matching user
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const result = await db.query(
        `SELECT u.id, u.username, r.name as role
         FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE u.reset_token = $1 AND u.reset_token_expiry > NOW()`,
        [tokenHash]
    );

    if (result.rows.length === 0) {
        throw new ValidationError('Invalid or expired reset token. Please request a new reset link.');
    }

    const user = result.rows[0];

    // Only admin accounts can use email-based reset
    if (user.role !== 'ADMIN') {
        throw new ForbiddenError('Email-based password reset is only available for Admin accounts.');
    }

    // Validate new password
    if (!newPassword || newPassword.length < 8) {
        throw new ValidationError('New password must be at least 8 characters long.');
    }
    if (!PASSWORD_REGEX.test(newPassword)) {
        throw new ValidationError(PASSWORD_RULES);
    }

    const newHash = await hashPassword(newPassword);

    const resetColumns = ['password_hash = $1', 'reset_token = NULL', 'reset_token_expiry = NULL'];
    if (authSchema.account_locked) resetColumns.push('account_locked = false');
    if (authSchema.failed_login_attempts) resetColumns.push('failed_login_attempts = 0');

    // Update password, clear reset token, unlock account, reset attempts
    await db.query(
        `UPDATE users SET
            ${resetColumns.join(',\n            ')}
         WHERE id = $2`,
        [newHash, user.id]
    );

    return { message: 'Password has been reset successfully. You can now log in with your new password.' };
};

// =============================================
// PASSWORD RESET BY ADMIN/SUPERVISOR (hierarchy)
// =============================================

/**
 * Reset a user's password (Admin/Supervisor initiated).
 *
 * Rules:
 *  - Admin can reset passwords for: Supervisors and Employees
 *  - Supervisor can reset passwords for: Employees only
 *  - Nobody can reset Admin password via this route (must use email)
 */
export const resetUserPassword = async (requesterId, targetUserId, newPassword) => {
    const authSchema = await ensureAuthSchema();

    // Get requester details
    const requesterResult = await db.query(
        `SELECT u.id, r.name as role FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE u.id = $1`,
        [requesterId]
    );

    if (requesterResult.rows.length === 0) {
        throw new NotFoundError('Requester not found');
    }

    const requester = requesterResult.rows[0];

    // Get target user details
    const targetResult = await db.query(
        `SELECT u.id, u.username, r.name as role FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE u.id = $1`,
        [targetUserId]
    );

    if (targetResult.rows.length === 0) {
        throw new NotFoundError('Target user not found');
    }

    const target = targetResult.rows[0];

    // ── Hierarchy enforcement ──
    // Admin password can ONLY be reset via email
    if (target.role === 'ADMIN') {
        throw new ForbiddenError(
            'Admin password cannot be reset by other users. Admin must use the email-based recovery.'
        );
    }

    // Supervisor can only reset EMPLOYEE passwords
    if (requester.role === 'SUPERVISOR' && target.role !== 'EMPLOYEE') {
        throw new ForbiddenError(
            'Supervisors can only reset passwords for Employees. Contact Admin for Supervisor password resets.'
        );
    }

    // Employees cannot reset anyone's password
    if (requester.role === 'EMPLOYEE') {
        throw new ForbiddenError('Employees do not have permission to reset passwords.');
    }

    // Validate new password
    if (!newPassword || newPassword.length < 8) {
        throw new ValidationError('New password must be at least 8 characters long.');
    }
    if (!PASSWORD_REGEX.test(newPassword)) {
        throw new ValidationError(PASSWORD_RULES);
    }

    const newHash = await hashPassword(newPassword);

    const updateColumns = ['password_hash = $1'];
    if (authSchema.failed_login_attempts) updateColumns.push('failed_login_attempts = 0');
    if (authSchema.account_locked) updateColumns.push('account_locked = false');
    updateColumns.push('updated_at = CURRENT_TIMESTAMP');

    await db.query(
        `UPDATE users SET
            ${updateColumns.join(',\n            ')}
         WHERE id = $2`,
        [newHash, targetUserId]
    );

    return {
        message: `Password for ${target.username} has been reset successfully.`,
        targetUsername: target.username,
    };
};
