import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Ensure uploads directories exist
const __dirname = path.resolve();
const uploadDir = path.join(__dirname, 'uploads');
const profilePhotosDir = path.join(__dirname, 'uploads/profiles');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(profilePhotosDir)) {
    fs.mkdirSync(profilePhotosDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir)
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
    }
});

// Profile photo storage
const profileStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, profilePhotosDir)
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


