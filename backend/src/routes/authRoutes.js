import express from 'express';
import * as authController from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { loginValidator } from '../utils/validators.js';
import { profileUpload } from '../middleware/upload.js';

const router = express.Router();

// POST /api/auth/login - Login user
router.post('/login', loginValidator, validateRequest, authController.login);

// POST /api/auth/logout - Logout user
router.post('/logout', authenticate, authController.logout);

// GET /api/auth/me - Get current user
router.get('/me', authenticate, authController.getMe);

// PUT /api/auth/profile - Update user profile
router.put('/profile', authenticate, authController.updateProfile);

// PUT /api/auth/change-password - Change password
router.put('/change-password', authenticate, authController.changePassword);

// POST /api/auth/profile/photo - Upload profile photo
router.post('/profile/photo', authenticate, profileUpload.single('photo'), authController.uploadProfilePhoto);

// DELETE /api/auth/profile/photo - Delete profile photo
router.delete('/profile/photo', authenticate, authController.deleteProfilePhoto);

export default router;
