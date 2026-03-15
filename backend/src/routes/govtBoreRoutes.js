import express from 'express';
import * as govtBoreController from '../controllers/govtBoreController.js';
import { authenticate } from '../middleware/auth.js';
import { operationalAdmin, anyRole } from '../middleware/roleGuard.js';

const router = express.Router();

// Authenticate all routes
router.use(authenticate);

// Import routes (must be before /:id to avoid capturing "import" as an id)


// GET /api/govt-bores - Get all records (Read-only for everyone)
router.get('/', anyRole, govtBoreController.getAllRecords);

// Master Data Routes
router.get('/mandals', govtBoreController.getMandals);
router.get('/mandals/:id/villages', govtBoreController.getVillages);

// GET /api/govt-bores/:id - Get single record (Read-only for everyone)
router.get('/:id', anyRole, govtBoreController.getRecord);

// POST /api/govt-bores - Create new record (Admin + Supervisor)
router.post('/', operationalAdmin, govtBoreController.createRecord);

// PUT /api/govt-bores/:id - Update record (Admin + Supervisor)
router.put('/:id', operationalAdmin, govtBoreController.updateRecord);

// DELETE /api/govt-bores/:id - Delete record (Admin + Supervisor)
router.delete('/:id', operationalAdmin, govtBoreController.deleteRecord);

export default router;

