import * as authService from '../services/authService.js';
import * as userService from '../services/userService.js';
import { logAudit } from '../middleware/auditLogger.js';
import { logLoginEvent } from '../utils/ensureLoginAuditSchema.js';
import fs from 'fs';

/** Extract client IP and user agent from request */
function getClientInfo(req) {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.connection?.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    return { ip, userAgent };
}

/**
 * Login user
 * POST /api/auth/login
 */
export const login = async (req, res, next) => {
    try {
        const { username, password } = req.body;
        const { ip, userAgent } = getClientInfo(req);

        const result = await authService.authenticateUser(username, password);

        // Log successful login
        logLoginEvent({
            userId: result.user.id,
            username: result.user.username,
            action: 'LOGIN_SUCCESS',
            ip,
            userAgent,
        });

        // Set token in httpOnly cookie
        res.cookie('token', result.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
        });

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                user: result.user,
                token: result.token,
            },
        });
    } catch (error) {
        // Log failed login attempt
        const { ip, userAgent } = getClientInfo(req);
        const action = error.statusCode === 403 ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED';
        logLoginEvent({
            userId: null,
            username: req.body?.username || '',
            action,
            ip,
            userAgent,
            details: error.message,
        });
        next(error);
    }
};

/**
 * Admin Forgot Password (email-based recovery)
 * POST /api/auth/forgot-password
 * Public — no auth required
 */
export const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required',
            });
        }

        const result = await authService.forgotPasswordAdmin(email);

        res.json({
            success: true,
            message: result.message,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Reset Password with token (Admin email flow)
 * POST /api/auth/reset-password/:token
 * Public — no auth required
 */
export const resetPassword = async (req, res, next) => {
    try {
        const { token } = req.params;
        const { newPassword } = req.body;

        if (!newPassword) {
            return res.status(400).json({
                success: false,
                message: 'New password is required',
            });
        }

        const result = await authService.resetPasswordWithToken(token, newPassword);

        res.json({
            success: true,
            message: result.message,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Reset another user's password (Admin/Supervisor hierarchy)
 * PUT /api/auth/users/:id/reset-password
 * Requires auth — Admin or Supervisor
 */
export const resetUserPassword = async (req, res, next) => {
    try {
        const targetUserId = parseInt(req.params.id, 10);
        const { newPassword } = req.body;

        if (!newPassword) {
            return res.status(400).json({
                success: false,
                message: 'New password is required',
            });
        }

        const result = await authService.resetUserPassword(req.user.id, targetUserId, newPassword);

        await logAudit(req.user.id, 'UPDATE', 'PASSWORD_RESET', targetUserId, null, {
            targetUsername: result.targetUsername,
        });

        res.json({
            success: true,
            message: result.message,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Logout user
 * POST /api/auth/logout
 */
export const logout = async (req, res, next) => {
    try {
        // Log logout event
        const { ip, userAgent } = getClientInfo(req);
        logLoginEvent({
            userId: req.user?.id || null,
            username: req.user?.username || '',
            action: 'LOGOUT',
            ip,
            userAgent,
        });

        // Clear the token cookie
        res.cookie('token', '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            expires: new Date(0),
        });

        res.json({
            success: true,
            message: 'Logout successful',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get current user profile
 * GET /api/auth/me
 */
export const getMe = async (req, res, next) => {
    try {
        const user = await authService.getUserProfile(req.user.id);

        res.json({
            success: true,
            data: user,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Refresh JWT token (silent renewal)
 * POST /api/auth/refresh
 * Requires a valid (non-expired) token. Issues a fresh token.
 */
export const refreshToken = async (req, res, next) => {
    try {
        const newToken = authService.generateToken(req.user.id);

        // Set updated cookie
        res.cookie('token', newToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000,
        });

        res.json({
            success: true,
            data: { token: newToken },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update user profile
 * PUT /api/auth/profile
 */
export const updateProfile = async (req, res, next) => {
    try {
        const { firstName, lastName, email } = req.body;
        const user = await userService.updateProfile(req.user.id, { firstName, lastName, email });

        // Log not always needed for self-update, but good for security audit
        // await logAudit(req.user.id, 'UPDATE', 'PROFILE', req.user.id, null, { firstName, lastName, email });

        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: user
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Change password
 * PUT /api/auth/change-password
 */
export const changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;
        await userService.changePassword(req.user.id, { currentPassword, newPassword });

        await logAudit(req.user.id, 'UPDATE', 'PASSWORD', req.user.id, null, null);

        // Log password change event
        const { ip, userAgent } = getClientInfo(req);
        logLoginEvent({
            userId: req.user.id,
            username: req.user.username,
            action: 'PASSWORD_CHANGED',
            ip,
            userAgent,
        });

        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Upload profile photo
 * POST /api/auth/profile/photo
 */
export const uploadProfilePhoto = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        // Get old photo to delete
        const currentUser = await authService.getUserProfile(req.user.id);
        if (currentUser.profilePhotoUrl) {
            const oldPath = currentUser.profilePhotoUrl.replace('/uploads/', 'uploads/');
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
        }

        const photoUrl = `/uploads/profiles/${req.file.filename}`;
        await userService.updateProfilePhoto(req.user.id, photoUrl);

        res.json({
            success: true,
            message: 'Profile photo uploaded successfully',
            data: { profilePhotoUrl: photoUrl }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete profile photo
 * DELETE /api/auth/profile/photo
 */
export const deleteProfilePhoto = async (req, res, next) => {
    try {
        const currentUser = await authService.getUserProfile(req.user.id);
        
        if (currentUser.profilePhotoUrl) {
            const photoPath = currentUser.profilePhotoUrl.replace('/uploads/', 'uploads/');
            if (fs.existsSync(photoPath)) {
                fs.unlinkSync(photoPath);
            }
        }

        await userService.updateProfilePhoto(req.user.id, null);

        res.json({
            success: true,
            message: 'Profile photo removed successfully'
        });
    } catch (error) {
        next(error);
    }
};
