import * as authService from '../services/authService.js';
import * as userService from '../services/userService.js';
import { logAudit } from '../middleware/auditLogger.js';
import fs from 'fs';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const isVercel = !!process.env.VERCEL;

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
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
        });

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                user: result.user,
                token: result.token, // Also send in response for flexibility
            },
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
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
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
            if (currentUser.profilePhotoUrl.includes('cloudinary.com')) {
                // Deleting from Cloudinary is complex without the exact public_id easily parsed.
                // For simplicity in this fix, we will just let it be orphaned, or you could parse it:
                // e.g. v-ops-profiles/profile-1-17000000
                const urlParts = currentUser.profilePhotoUrl.split('/');
                const filenameWithExt = urlParts[urlParts.length - 1];
                const publicId = `v-ops-profiles/${filenameWithExt.split('.')[0]}`;

                cloudinary.uploader.destroy(publicId).catch(console.error);
            } else {
                const oldPath = currentUser.profilePhotoUrl.replace('/uploads/', 'uploads/');
                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                }
            }
        }

        let photoUrl = `/uploads/profiles/${req.file.filename}`;

        if (isVercel) {
            try {
                // Upload to cloudinary from the temporary file
                const result = await cloudinary.uploader.upload(req.file.path, {
                    folder: 'v-ops-profiles',
                    public_id: `profile-${req.user.id}-${Date.now()}`
                });
                photoUrl = result.secure_url;

                // Cleanup temp file safely
                if (fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                }
            } catch (cloudError) {
                console.error("Cloudinary Upload Error:", cloudError);
                // Also clean up temp file on failure
                if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
                return res.status(500).json({
                    success: false,
                    message: `Cloud storage upload failed: ${cloudError.message}. Please check Cloudinary credentials in Vercel.`,
                    error: cloudError.message
                });
            }
        }

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
            if (currentUser.profilePhotoUrl.includes('cloudinary.com')) {
                const urlParts = currentUser.profilePhotoUrl.split('/');
                const filenameWithExt = urlParts[urlParts.length - 1];
                const publicId = `v-ops-profiles/${filenameWithExt.split('.')[0]}`;

                cloudinary.uploader.destroy(publicId).catch(console.error);
            } else {
                const photoPath = currentUser.profilePhotoUrl.replace('/uploads/', 'uploads/');
                if (fs.existsSync(photoPath)) {
                    fs.unlinkSync(photoPath);
                }
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
