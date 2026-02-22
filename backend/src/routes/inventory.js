import express from 'express';
import * as inventoryController from '../controllers/inventoryController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All inventory routes require authentication
router.use(authenticate);

// =============================================
// PIPES ROUTES
// =============================================

router.get('/pipes', inventoryController.getPipes);
router.post('/pipes', inventoryController.createPipe);
router.post('/pipes/add-stock', inventoryController.addStock);
router.post('/pipes/issue', inventoryController.issuePipes);
router.post('/pipes/return', inventoryController.returnPipes);
router.delete('/pipes/:id', inventoryController.deletePipe);
router.get('/pipes/transactions', inventoryController.getPipeTransactions);

// =============================================
// SPARES ROUTES
// =============================================

router.get('/spares', inventoryController.getSpares);
router.post('/spares', inventoryController.createSpare);
router.post('/spares/:id/issue', inventoryController.issueSpare);
router.post('/spares/:id/return', inventoryController.returnSpare);
router.patch('/spares/:id/status', inventoryController.updateSpareStatus);
router.delete('/spares/:id', inventoryController.deleteSpare);
router.get('/spares/transactions', inventoryController.getSparesTransactions);

// =============================================
// DIESEL ROUTES
// =============================================

router.get('/diesel', inventoryController.getDieselRecords);
router.post('/diesel', inventoryController.createDieselRecord);
router.put('/diesel/:id', inventoryController.updateDieselRecord);
router.delete('/diesel/:id', inventoryController.deleteDieselRecord);
router.get('/diesel/summary', inventoryController.getDieselSummary);

export default router;
