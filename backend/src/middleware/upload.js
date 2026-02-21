import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import dotenv from 'dotenv';
dotenv.config();

const isVercel = !!process.env.VERCEL;
const projectRoot = path.resolve();
const uploadsRootDir = isVercel ? path.join('/tmp', 'uploads') : path.join(projectRoot, 'uploads');
const profilePhotosDir = path.join(uploadsRootDir, 'profiles');

const ensureDirExists = (dirPath) => {
    try {
        fs.mkdirSync(dirPath, { recursive: true });
    } catch (err) {
        if (!isVercel) {
            throw err;
        }
    }
};

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        ensureDirExists(uploadsRootDir);
        cb(null, uploadsRootDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
    }
});

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Production Cloudinary Storage
const cloudinaryStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'v-ops-profiles',
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
        public_id: (req, file) => `profile-${req.user?.id || 'unknown'}-${Date.now()}`,
    }
});

// Profile photo storage (Cloudinary for Vercel, Local for Dev)
const profileStorage = isVercel ? cloudinaryStorage : multer.diskStorage({
    destination: function (req, file, cb) {
        ensureDirExists(profilePhotosDir);
        cb(null, profilePhotosDir);
    },
    filename: function (req, file, cb) {
        const userId = req.user?.id || 'unknown';
        const uniqueSuffix = Date.now();
        cb(null, `profile-${userId}-${uniqueSuffix}${path.extname(file.originalname)}`)
    }
});

const fileFilter = (req, file, cb) => {
    // Prevent double extension attacks (e.g., image.php.jpg)
    if (file.originalname.split('.').length > 2) {
        return cb(new Error('Files with double extensions are not allowed!'));
    }

    const allowedExtensions = ['.jpeg', '.jpg', '.png', '.pdf'];
    const allowedMimes = ['image/jpeg', 'image/png', 'application/pdf'];

    const extname = path.extname(file.originalname).toLowerCase();
    const mimetype = file.mimetype;

    if (allowedExtensions.includes(extname) && allowedMimes.includes(mimetype)) {
        return cb(null, true);
    } else {
        cb(new Error('Only images (JPEG, PNG) and PDFs are allowed!'));
    }
};

const imageOnlyFilter = (req, file, cb) => {
    // Prevent double extension attacks
    if (file.originalname.split('.').length > 2) {
        return cb(new Error('Files with double extensions are not allowed!'));
    }

    const allowedExtensions = ['.jpeg', '.jpg', '.png', '.gif', '.webp'];
    const extname = path.extname(file.originalname).toLowerCase();

    if (allowedExtensions.includes(extname) && file.mimetype.startsWith('image/')) {
        return cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'));
    }
};

export const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: fileFilter
});

export const profileUpload = multer({
    storage: profileStorage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit for profile photos
    fileFilter: imageOnlyFilter
});


