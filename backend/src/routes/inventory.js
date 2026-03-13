import express from 'express';
import * as inventoryController from '../controllers/inventoryController.js';
import { authenticate } from '../middleware/auth.js';
import { roleGuard } from '../middleware/roleGuard.js';

const router = express.Router();

// All inventory routes require authentication
router.use(authenticate);

// =============================================
// INVENTORY SUMMARY
// =============================================

router.get('/summary', inventoryController.getSummary);

// =============================================
// PIPES ROUTES
// =============================================

router.get('/pipes', inventoryController.getPipes);
router.get('/pipes/allocations', inventoryController.getPipeAllocations);
router.post('/pipes', roleGuard('ADMIN', 'SUPERVISOR'), inventoryController.createPipe);
router.post('/pipes/add-stock', roleGuard('ADMIN', 'SUPERVISOR'), inventoryController.addStock);
router.post('/pipes/issue', roleGuard('ADMIN', 'SUPERVISOR'), inventoryController.issuePipes);
router.post('/pipes/return', roleGuard('ADMIN', 'SUPERVISOR'), inventoryController.returnPipes);
router.delete('/pipes/:id', roleGuard('ADMIN'), inventoryController.deletePipe);
router.get('/pipes/transactions', inventoryController.getPipeTransactions);

router.get('/pipes/companies', inventoryController.getPipeCompanies);
router.post('/pipes/companies', roleGuard('ADMIN'), inventoryController.addPipeCompany);
router.put('/pipes/companies/:id', roleGuard('ADMIN'), inventoryController.updatePipeCompany);
router.delete('/pipes/companies/:id', roleGuard('ADMIN'), inventoryController.deletePipeCompany);

// =============================================
// SPARES ROUTES
// =============================================

router.get('/spares', inventoryController.getSpares);
router.post('/spares', roleGuard('ADMIN', 'SUPERVISOR'), inventoryController.createSpare);
router.post('/spares/:id/add-stock', roleGuard('ADMIN', 'SUPERVISOR'), inventoryController.addSpareStock);
router.post('/spares/:id/issue', roleGuard('ADMIN', 'SUPERVISOR'), inventoryController.issueSpare);
router.post('/spares/:id/return', roleGuard('ADMIN', 'SUPERVISOR'), inventoryController.returnSpare);
router.patch('/spares/:id/status', roleGuard('ADMIN', 'SUPERVISOR'), inventoryController.updateSpareStatus);
router.delete('/spares/:id', roleGuard('ADMIN'), inventoryController.deleteSpare);
router.get('/spares/transactions', inventoryController.getSparesTransactions);

// =============================================
// DIESEL ROUTES
// =============================================

router.get('/diesel', inventoryController.getDieselRecords);
router.post('/diesel', roleGuard('ADMIN', 'SUPERVISOR'), inventoryController.createDieselRecord);
router.put('/diesel/:id', roleGuard('ADMIN', 'SUPERVISOR'), inventoryController.updateDieselRecord);
router.delete('/diesel/:id', roleGuard('ADMIN'), inventoryController.deleteDieselRecord);
router.get('/diesel/summary', inventoryController.getDieselSummary);
router.get('/diesel/vehicles', inventoryController.getDieselVehicleStatus);
router.post('/diesel/vehicles', roleGuard('ADMIN'), inventoryController.createDieselVehicle);
router.delete('/diesel/vehicles/:id', roleGuard('ADMIN'), inventoryController.deleteDieselVehicle);

export default router;
