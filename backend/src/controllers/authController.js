import * as authService from '../services/authService.js';
import * as userService from '../services/userService.js';
import { logAudit } from '../middleware/auditLogger.js';
import fs from 'fs';
import path from 'path';

/**
 * Login user
 * POST /api/auth/login
 */
export const login = async (req, res, next) => {
    try {
        const { username, password } = req.body;

        const result = await authService.authenticateUser(username, password);

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
        const user = await userService.updateProfilePhoto(req.user.id, photoUrl);

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
