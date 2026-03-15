import express from 'express';
import * as boreController from '../controllers/boreController.js';
import { authenticate } from '../middleware/auth.js';
import { operationalAdmin, anyRole } from '../middleware/roleGuard.js';

const router = express.Router();

// Authenticate all routes
router.use(authenticate);

// GET /api/bores - Get all records (Read-only for everyone)
router.get('/', anyRole, boreController.getAllRecords);

// GET /api/bores/:id/receipt - Download receipt (Admin + Supervisor)
router.get('/:id/receipt', operationalAdmin, boreController.downloadReceipt);

// GET /api/bores/:id - Get single record (Read-only for everyone)
router.get('/:id', anyRole, boreController.getRecord);

// POST /api/bores - Create new record (Admin + Supervisor)
router.post('/', operationalAdmin, boreController.createRecord);

// PUT /api/bores/:id - Update record (Admin + Supervisor)
router.put('/:id', operationalAdmin, boreController.updateRecord);

// DELETE /api/bores/:id - Delete record (Admin + Supervisor)
router.delete('/:id', operationalAdmin, boreController.deleteRecord);

export default router;

