import express from 'express';
import * as boreController from '../controllers/boreController.js';
import { authenticate } from '../middleware/auth.js';
import { adminOnly, employeeRo, supervisorRo } from '../middleware/roleGuard.js';

const router = express.Router();

// Authenticate all routes
router.use(authenticate);

// GET /api/bores - Get all records (Read-only for everyone)
router.get('/', employeeRo, boreController.getAllRecords);

// GET /api/bores/:id/receipt - Download receipt (Read-only for everyone)
// Note: This might need special handling if it uses query token, but sticking to standard auth for now as per controller logic
router.get('/:id/receipt', supervisorRo, boreController.downloadReceipt);

// GET /api/bores/:id - Get single record (Read-only for everyone)
router.get('/:id', employeeRo, boreController.getRecord);

// POST /api/bores - Create new record (Admin only)
router.post('/', adminOnly, boreController.createRecord);

// PUT /api/bores/:id - Update record (Admin only)
router.put('/:id', adminOnly, boreController.updateRecord);

// DELETE /api/bores/:id - Delete record (Admin only)
router.delete('/:id', adminOnly, boreController.deleteRecord);

export default router;
