import * as inventoryModel from '../models/inventory.js';
import db from '../models/db.js';
import { convertToFeet, formatQuantityDisplay, validateQuantity } from '../utils/pipeConversions.js';

// =============================================
// PIPES SERVICE
// =============================================

export const getAllPipes = async () => {
    return await inventoryModel.getPipeInventory();
};

export const createNewPipe = async (data) => {
    return await inventoryModel.createPipe(data);
};

export const addPipeStock = async (pipeId, quantity, unit, userId) => {
    const pipe = await inventoryModel.getPipeById(pipeId);
    if (!pipe) {
        throw new Error('Pipe not found');
    }

    // Validate and convert to feet
    const validation = validateQuantity(quantity, unit || 'pipes');
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    const quantityInFeet = validation.feet;
    const isPipesUnit = (unit === 'pipes' || !unit);

    // Update pieces bucket
    const currentPieces = pipe.pieces || {};
    const newPieces = { ...currentPieces };

    if (isPipesUnit) {
        // Adding full pipes (e.g. 5 pipes -> 5 x 20ft)
        // If input is 5.5 pipes, treat as 5 x 20ft + 1 x 10ft? 
        // For simplicity, let's assume 'pipes' input is always full pipes unless decimal.
        // If decimal, convert to feet and treat as single piece? 
        // User likely adds whole pipes.
        const numPipes = parseFloat(quantity);
        const fullPipes = Math.floor(numPipes);
        const remainderPipes = numPipes - fullPipes;

        if (fullPipes > 0) {
            newPieces['20'] = (newPieces['20'] || 0) + fullPipes;
        }
        if (remainderPipes > 0) {
            const remainderFeet = remainderPipes * 20;
            // Round to sensible decimal
            const key = parseFloat(remainderFeet.toFixed(2)).toString();
            newPieces[key] = (newPieces[key] || 0) + 1;
        }
    } else {
        // Adding specific length in feet (e.g. 10ft -> 1 x 10ft)
        // Treat as a SINGLE piece unless specified otherwise?
        // Usually 'Add Stock' in feet might be returning a specific piece or buying a custom length.
        const key = parseFloat(quantity).toString();
        newPieces[key] = (newPieces[key] || 0) + 1;
    }

    const newQuantity = parseFloat(pipe.quantity) + quantityInFeet;

    // Update inventory with pieces
    await inventoryModel.updatePipeQuantity(pipeId, newQuantity, newPieces);

    // Create transaction record
    await inventoryModel.createPipeTransaction({
        pipe_inventory_id: pipeId,
        transaction_type: 'LOAD',
        quantity: quantityInFeet,
        unit_type: unit || 'pipes'
    }, userId);

    return await inventoryModel.getPipeById(pipeId);
};

export const issuePipesToBore = async (data, userId) => {
    const pipe = await inventoryModel.getPipeById(data.pipe_inventory_id);
    if (!pipe) {
        throw new Error('Pipe not found');
    }

    // Validate and convert to feet
    const validation = validateQuantity(data.quantity, data.unit || 'pipes');
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    const quantityInFeet = validation.feet;
    const currentStock = parseFloat(pipe.quantity);

    if (currentStock < quantityInFeet) {
        throw new Error(`Insufficient stock. Available: ${formatQuantityDisplay(currentStock)}, Requested: ${formatQuantityDisplay(quantityInFeet)}`);
    }

    // Piece Management Logic (Find & Cut)
    const currentPieces = pipe.pieces || {};
    const newPieces = { ...currentPieces };

    // Sort available lengths descending
    const availableLengths = Object.keys(newPieces).map(parseFloat).sort((a, b) => a - b);

    // Strategy: Find Smallest Piece >= Requested Length (Best Fit)
    // If exact match: Perfect.
    // If larger match: Cut it (Add remainder).

    let sourcePieceLength = -1;

    for (const len of availableLengths) {
        if (len >= quantityInFeet) {
            sourcePieceLength = len;
            break;
        }
    }

    if (sourcePieceLength === -1) {
        // No single piece is large enough.
        // Fallback: This gets complicated. User might be welding pieces?
        // For now, ERROR. User should issue separate pieces if welding.
        throw new Error(`No single pipe piece available of length ${quantityInFeet}ft or larger. please issue multiple smaller pieces if needed.`);
    }

    // Perform Issue
    const sourceKey = sourcePieceLength.toString();
    newPieces[sourceKey] = newPieces[sourceKey] - 1;
    if (newPieces[sourceKey] <= 0) {
        delete newPieces[sourceKey];
    }

    // Add Remainder if cut
    if (sourcePieceLength > quantityInFeet) {
        const remainder = sourcePieceLength - quantityInFeet;
        const remainderKey = parseFloat(remainder.toFixed(2)).toString();
        newPieces[remainderKey] = (newPieces[remainderKey] || 0) + 1;
    }

    const newQuantity = currentStock - quantityInFeet;

    // Update inventory with pieces
    await inventoryModel.updatePipeQuantity(data.pipe_inventory_id, newQuantity, newPieces);

    // Create transaction record
    await inventoryModel.createPipeTransaction({
        pipe_inventory_id: data.pipe_inventory_id,
        transaction_type: 'ISSUE',
        quantity: quantityInFeet,
        unit_type: data.unit || 'pipes',
        bore_type: data.bore_type,
        bore_id: data.bore_id,
        vehicle_name: data.vehicle_name,
        supervisor_name: data.supervisor_name,
        remarks: data.remarks
    }, userId);

    return await inventoryModel.getPipeById(data.pipe_inventory_id);
};

export const returnPipesFromBore = async (data, userId) => {
    const pipe = await inventoryModel.getPipeById(data.pipe_inventory_id);
    if (!pipe) {
        throw new Error('Pipe not found');
    }

    // Validate and convert to feet
    const validation = validateQuantity(data.quantity, data.unit || 'pipes');
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    const quantityInFeet = validation.feet;

    // Update pieces bucket
    const currentPieces = pipe.pieces || {};
    const newPieces = { ...currentPieces };

    // Treat return as a single piece (or multiple full pipes if unit is pipes)
    // Same logic as 'Add Stock'
    const isPipesUnit = (data.unit === 'pipes' || !data.unit);

    if (isPipesUnit) {
        const numPipes = parseFloat(data.quantity);
        const fullPipes = Math.floor(numPipes);
        const remainderPipes = numPipes - fullPipes;

        if (fullPipes > 0) {
            newPieces['20'] = (newPieces['20'] || 0) + fullPipes;
        }
        if (remainderPipes > 0) {
            const remainderFeet = remainderPipes * 20;
            const key = parseFloat(remainderFeet.toFixed(2)).toString();
            newPieces[key] = (newPieces[key] || 0) + 1;
        }
    } else {
        const key = parseFloat(quantityInFeet).toString();
        newPieces[key] = (newPieces[key] || 0) + 1;
    }

    const newQuantity = parseFloat(pipe.quantity) + quantityInFeet;

    // Update inventory with pieces
    await inventoryModel.updatePipeQuantity(data.pipe_inventory_id, newQuantity, newPieces);

    // Create transaction record
    await inventoryModel.createPipeTransaction({
        pipe_inventory_id: data.pipe_inventory_id,
        transaction_type: 'RETURN',
        quantity: quantityInFeet,
        unit_type: data.unit || 'pipes',
        bore_type: data.bore_type,
        bore_id: data.bore_id,
        vehicle_name: data.vehicle_name,
        supervisor_name: data.supervisor_name,
        remarks: data.remarks
    }, userId);

    return await inventoryModel.getPipeById(data.pipe_inventory_id);
};

export const deletePipe = async (pipeId) => {
    return await inventoryModel.deletePipe(pipeId);
};

export const getPipeTransactions = async (filters) => {
    return await inventoryModel.getPipeTransactions(filters);
};

// =============================================
// SPARES SERVICE
// =============================================

export const getAllSpares = async (filters) => {
    return await inventoryModel.getSparesInventory(filters);
};

export const addNewSpare = async (data) => {
    return await inventoryModel.createSpare(data);
};

export const issueSpareToVehicle = async (spareId, data, userId) => {
    const spare = await inventoryModel.getSpareById(spareId);
    if (!spare) {
        throw new Error('Spare not found');
    }

    if (spare.status !== 'AVAILABLE') {
        throw new Error(`Spare is not available. Current status: ${spare.status}`);
    }

    // Update spare location and status
    await inventoryModel.updateSpare(spareId, {
        current_location: 'VEHICLE',
        vehicle_name: data.vehicle_name,
        supervisor_name: data.supervisor_name,
        status: 'IN_USE'
    });

    // Create transaction record
    await inventoryModel.createSpareTransaction({
        spare_id: spareId,
        transaction_type: 'ISSUE',
        vehicle_name: data.vehicle_name,
        supervisor_name: data.supervisor_name,
        remarks: data.remarks
    }, userId);

    return await inventoryModel.getSpareById(spareId);
};

export const returnSpareToHome = async (spareId, data, userId) => {
    const spare = await inventoryModel.getSpareById(spareId);
    if (!spare) {
        throw new Error('Spare not found');
    }

    // Update spare location and status
    await inventoryModel.updateSpare(spareId, {
        current_location: 'HOME',
        vehicle_name: null,
        supervisor_name: null,
        status: 'AVAILABLE'
    });

    // Create transaction record
    await inventoryModel.createSpareTransaction({
        spare_id: spareId,
        transaction_type: 'RETURN',
        vehicle_name: spare.vehicle_name,
        supervisor_name: spare.supervisor_name,
        remarks: data.remarks
    }, userId);

    return await inventoryModel.getSpareById(spareId);
};

export const updateSpareStatus = async (spareId, status) => {
    const spare = await inventoryModel.getSpareById(spareId);
    if (!spare) {
        throw new Error('Spare not found');
    }

    return await inventoryModel.updateSpare(spareId, {
        ...spare,
        status
    });
};

export const deleteSpare = async (spareId) => {
    return await inventoryModel.deleteSpare(spareId);
};

export const getSparesTransactions = async (spareId) => {
    return await inventoryModel.getSparesTransactions(spareId);
};

// =============================================
// DIESEL SERVICE
// =============================================

export const getAllDieselRecords = async (filters) => {
    return await inventoryModel.getDieselRecords(filters);
};

export const addDieselRecord = async (data, userId) => {
    return await inventoryModel.createDieselRecord(data, userId);
};

export const updateDieselRecord = async (id, data) => {
    const record = await inventoryModel.getDieselRecordById(id);
    if (!record) {
        throw new Error('Diesel record not found');
    }

    return await inventoryModel.updateDieselRecord(id, data);
};

export const deleteDieselRecord = async (id) => {
    const record = await inventoryModel.getDieselRecordById(id);
    if (!record) {
        throw new Error('Diesel record not found');
    }

    return await inventoryModel.deleteDieselRecord(id);
};

export const getDieselSummary = async (startDate, endDate) => {
    const result = await db.query(`
        SELECT 
            COUNT(*) as total_records,
            SUM(amount) as total_amount,
            SUM(liters) as total_liters,
            vehicle_name,
            COUNT(*) as vehicle_count
        FROM diesel_records
        WHERE purchase_date BETWEEN $1 AND $2
        GROUP BY vehicle_name
        ORDER BY total_amount DESC
    `, [startDate, endDate]);

    const summary = await db.query(`
        SELECT 
            COUNT(*) as total_records,
            SUM(amount) as total_amount,
            SUM(liters) as total_liters
        FROM diesel_records
        WHERE purchase_date BETWEEN $1 AND $2
    `, [startDate, endDate]);

    return {
        summary: summary.rows[0],
        byVehicle: result.rows
    };
};

export default {
    getAllPipes,
    addPipeStock,
    issuePipesToBore,
    returnPipesFromBore,
    getPipeTransactions,
    getAllSpares,
    addNewSpare,
    issueSpareToVehicle,
    returnSpareToHome,
    updateSpareStatus,
    deleteSpare,
    getSparesTransactions,
    getAllDieselRecords,
    addDieselRecord,
    updateDieselRecord,
    deleteDieselRecord,
    getDieselSummary
};
