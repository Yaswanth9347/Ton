import * as inventoryModel from '../models/inventory.js';
import db from '../models/db.js';
import { convertToFeet, formatQuantityDisplay, validateQuantity } from '../utils/pipeConversions.js';
import prisma from '../config/prisma.js';

// =============================================
// PIPES SERVICE (ERP ORM)
// =============================================

export const getAllPipes = async () => {
    const pipes = await prisma.pipes_master.findMany({
        where: { is_active: true },
        include: { stock: true },
        orderBy: [{ pipe_size: 'asc' }, { pipe_type_name: 'asc' }]
    });

    return pipes.map(p => ({
        id: p.id,
        size: p.pipe_size,
        company: p.pipe_type_name,
        unit: p.unit,
        quantity: p.stock?.available_quantity || 0,
        pieces: {}
    }));
};

export const createNewPipe = async (data, userId) => {
    return await prisma.$transaction(async (tx) => {
        console.log(`[Inventory - Pipes] Initiating creation of new pipe type...`, JSON.stringify({ size: data.size, company: data.company }));
        const existing = await tx.pipes_master.findFirst({
            where: { pipe_type_name: data.company, pipe_size: data.size, is_active: true }
        });

        if (existing) {
            console.error("[Inventory - Pipes] Failed to create pipe. Reason: Duplicate pipe mapping.");
            throw new Error('Pipe type and size combination already exists.');
        }

        const pipe = await tx.pipes_master.create({
            data: {
                pipe_type_name: data.company,
                pipe_size: data.size,
                unit: data.unit || 'pieces',
                stock: {
                    create: { available_quantity: data.quantity || 0 }
                }
            },
            include: { stock: true }
        });

        if (parseFloat(data.quantity || 0) > 0) {
            await tx.pipes_stock_transactions.create({
                data: {
                    pipe_master_id: pipe.id,
                    transaction_type: 'ADD',
                    quantity: parseFloat(data.quantity || 0),
                    reference_type: 'INVENTORY_ENTRY',
                    created_by: userId
                }
            });
        }

        console.log(`[Inventory - Pipes] Pipe type created successfully. Master ID: ${pipe.id}`);
        return {
            id: pipe.id,
            size: pipe.pipe_size,
            company: pipe.pipe_type_name,
            quantity: pipe.stock?.available_quantity || 0,
            unit: pipe.unit
        };
    });
};

export const addPipeStock = async (pipeId, quantity, unit, userId) => {
    return await prisma.$transaction(async (tx) => {
        const pipeMaster = await tx.pipes_master.findUnique({ where: { id: parseInt(pipeId) }, include: { stock: true } });
        if (!pipeMaster) throw new Error('Pipe not found');

        const validation = validateQuantity(quantity, unit || 'pipes');
        if (!validation.valid) throw new Error(validation.error);
        const quantityInFeet = validation.feet;

        const stock = await tx.pipes_stock.update({
            where: { pipe_master_id: pipeMaster.id },
            data: { available_quantity: { increment: quantityInFeet } }
        });

        await tx.pipes_stock_transactions.create({
            data: {
                pipe_master_id: pipeMaster.id,
                transaction_type: 'ADD',
                quantity: quantityInFeet,
                reference_type: 'INVENTORY_ENTRY',
                created_by: userId
            }
        });

        return {
            id: pipeMaster.id,
            size: pipeMaster.pipe_size,
            company: pipeMaster.pipe_type_name,
            quantity: stock.available_quantity,
            unit: pipeMaster.unit
        };
    });
};

export const issuePipesToBore = async (data, userId) => {
    return await prisma.$transaction(async (tx) => {
        const pipeMaster = await tx.pipes_master.findUnique({
            where: { id: parseInt(data.pipe_inventory_id) },
            include: { stock: true }
        });

        if (!pipeMaster) throw new Error('Pipe not found');

        const validation = validateQuantity(data.quantity, data.unit || 'pipes');
        if (!validation.valid) throw new Error(validation.error);
        const quantityInFeet = validation.feet;

        const currentStock = parseFloat(pipeMaster.stock?.available_quantity || 0);
        if (currentStock < quantityInFeet) {
            throw new Error(`Insufficient stock. Available: ${formatQuantityDisplay(currentStock)}, Requested: ${formatQuantityDisplay(quantityInFeet)}`);
        }

        const stock = await tx.pipes_stock.update({
            where: { pipe_master_id: pipeMaster.id },
            data: { available_quantity: { decrement: quantityInFeet } }
        });

        await tx.pipes_stock_transactions.create({
            data: {
                pipe_master_id: pipeMaster.id,
                transaction_type: 'DEDUCT',
                quantity: quantityInFeet,
                reference_type: data.bore_type === 'govt' ? 'GOVT_BORE' : 'PRIVATE_BORE',
                reference_id: data.bore_id ? parseInt(data.bore_id) : null,
                created_by: userId,
                remarks: data.remarks || `Issued to vehicle ${data.vehicle_name || 'Unknown'}`
            }
        });

        return {
            id: pipeMaster.id,
            size: pipeMaster.pipe_size,
            company: pipeMaster.pipe_type_name,
            quantity: stock.available_quantity,
            unit: pipeMaster.unit
        };
    });
};

export const returnPipesFromBore = async (data, userId) => {
    return await prisma.$transaction(async (tx) => {
        const pipeMaster = await tx.pipes_master.findUnique({ where: { id: parseInt(data.pipe_inventory_id) } });
        if (!pipeMaster) throw new Error('Pipe not found');

        const validation = validateQuantity(data.quantity, data.unit || 'pipes');
        if (!validation.valid) throw new Error(validation.error);
        const quantityInFeet = validation.feet;

        const stock = await tx.pipes_stock.update({
            where: { pipe_master_id: pipeMaster.id },
            data: { available_quantity: { increment: quantityInFeet } }
        });

        await tx.pipes_stock_transactions.create({
            data: {
                pipe_master_id: pipeMaster.id,
                transaction_type: 'ADD',
                quantity: quantityInFeet,
                reference_type: 'INVENTORY_ENTRY',
                created_by: userId,
                remarks: data.remarks || `Returned from bore ${data.bore_id || ''}`
            }
        });

        return {
            id: pipeMaster.id,
            size: pipeMaster.pipe_size,
            company: pipeMaster.pipe_type_name,
            quantity: stock.available_quantity,
            unit: pipeMaster.unit
        };
    });
};

export const deletePipe = async (pipeId) => {
    return await prisma.$transaction(async (tx) => {
        const pipeMaster = await tx.pipes_master.findUnique({ where: { id: parseInt(pipeId) }, include: { stock: true } });
        if (!pipeMaster) throw new Error('Pipe not found');

        if (parseFloat(pipeMaster.stock?.available_quantity || 0) > 0) {
            throw new Error('Cannot delete pipe type with existing stock. Please adjust stock to 0 first.');
        }

        return await tx.pipes_master.update({
            where: { id: parseInt(pipeId) },
            data: { is_active: false }
        });
    });
};

export const getPipeTransactions = async (filters) => {
    const whereClause = {};
    if (filters.startDate || filters.endDate) {
        whereClause.created_at = {};
        if (filters.startDate) whereClause.created_at.gte = new Date(filters.startDate);
        if (filters.endDate) whereClause.created_at.lte = new Date(filters.endDate);
    }

    // Map legacy 'LOAD' / 'ISSUE' queries dynamically if requested from frontend mapping
    if (filters.transactionType) {
        if (filters.transactionType === 'LOAD') whereClause.transaction_type = 'ADD';
        else if (filters.transactionType === 'ISSUE') whereClause.transaction_type = 'DEDUCT';
        else if (filters.transactionType === 'RETURN') whereClause.transaction_type = 'ADD';
    }

    const txns = await prisma.pipes_stock_transactions.findMany({
        where: whereClause,
        include: {
            pipe_master: true,
            user: { select: { username: true } }
        },
        orderBy: { created_at: 'desc' }
    });

    return txns.map(t => ({
        id: t.id,
        pipe_inventory_id: t.pipe_master_id,
        size: t.pipe_master.pipe_size,
        company: t.pipe_master.pipe_type_name,
        transaction_type: t.transaction_type === 'DEDUCT' ? 'ISSUE' : (t.transaction_type === 'ADD' && t.reference_type === 'INVENTORY_ENTRY' ? 'LOAD' : t.transaction_type), // Mimic previous schema response for UI colors
        quantity: t.quantity,
        unit_type: t.pipe_master.unit,
        bore_type: t.reference_type === 'GOVT_BORE' ? 'govt' : (t.reference_type === 'PRIVATE_BORE' ? 'private' : null),
        bore_id: t.reference_id,
        created_by_name: t.user?.username || 'System',
        created_at: t.created_at,
        remarks: t.remarks
    }));
};

// =============================================
// SPARES SERVICE
// =============================================

export const getAllSpares = async (filters) => {
    const whereClause = { is_active: true };
    if (filters?.spareType) whereClause.category = filters.spareType;

    const spares = await prisma.spares_master.findMany({
        where: whereClause,
        include: {
            stock: true,
            transactions: {
                orderBy: { created_at: 'desc' },
                take: 1
            }
        },
        orderBy: [{ category: 'asc' }, { spare_name: 'asc' }]
    });

    let mappedSpares = spares.map(s => {
        const available = parseFloat(s.stock?.available_quantity || 0) > 0;
        const latestTxn = s.transactions[0] || null;

        return {
            id: s.id,
            spare_type: s.category,
            spare_number: s.spare_name,
            status: available ? 'AVAILABLE' : 'IN_USE',
            current_location: available ? 'HOME' : 'VEHICLE',
            vehicle_name: (!available && latestTxn) ? latestTxn.vehicle_name : null,
            supervisor_name: (!available && latestTxn) ? latestTxn.supervisor_name : null,
            created_at: s.created_at,
            updated_at: s.updated_at
        };
    });

    if (filters?.status) {
        mappedSpares = mappedSpares.filter(s => s.status === filters.status);
    }
    if (filters?.location) {
        mappedSpares = mappedSpares.filter(s => s.current_location === filters.location);
    }

    return mappedSpares;
};

export const addNewSpare = async (data, userId) => {
    return await prisma.$transaction(async (tx) => {
        console.log(`[Inventory - Spares] Creating new spare...`, JSON.stringify(data));

        const existing = await tx.spares_master.findFirst({
            where: { spare_name: data.spare_number, category: data.spare_type, is_active: true }
        });

        if (existing) {
            console.error("[Inventory - Spares] Failed to create spare. Reason: Duplicate spare number.");
            throw new Error('Spare number already exists in this category.');
        }

        const spare = await tx.spares_master.create({
            data: {
                spare_name: data.spare_number,
                category: data.spare_type,
                unit: 'nos',
                stock: {
                    create: { available_quantity: 1 }
                }
            },
            include: { stock: true }
        });

        await tx.spares_stock_transactions.create({
            data: {
                spare_master_id: spare.id,
                transaction_type: 'ADD',
                quantity: 1,
                reference_type: 'INVENTORY_ENTRY',
                created_by: userId || 1
            }
        });

        console.log(`[Inventory - Spares] Spare added successfully. ID: ${spare.id}`);
        return {
            id: spare.id,
            spare_type: spare.category,
            spare_number: spare.spare_name,
            status: 'AVAILABLE',
            current_location: 'HOME',
            vehicle_name: null,
            supervisor_name: null
        };
    });
};

export const issueSpareToVehicle = async (spareId, data, userId) => {
    return await prisma.$transaction(async (tx) => {
        const spare = await tx.spares_master.findUnique({ where: { id: parseInt(spareId) }, include: { stock: true } });
        if (!spare) throw new Error('Spare not found');

        const currentStock = parseFloat(spare.stock?.available_quantity || 0);
        if (currentStock <= 0) {
            throw new Error(`Spare is not available. It is currently in use.`);
        }

        const stock = await tx.spares_stock.update({
            where: { spare_master_id: spare.id },
            data: { available_quantity: 0 }
        });

        await tx.spares_stock_transactions.create({
            data: {
                spare_master_id: spare.id,
                transaction_type: 'DEDUCT',
                quantity: 1,
                reference_type: 'PRIVATE_BORE',
                vehicle_name: data.vehicle_name,
                supervisor_name: data.supervisor_name,
                remarks: data.remarks || `Issued to vehicle ${data.vehicle_name || 'Unknown'}`,
                created_by: userId
            }
        });

        return {
            id: spare.id,
            spare_type: spare.category,
            spare_number: spare.spare_name,
            status: 'IN_USE',
            current_location: 'VEHICLE',
            vehicle_name: data.vehicle_name,
            supervisor_name: data.supervisor_name
        };
    });
};

export const returnSpareToHome = async (spareId, data, userId) => {
    return await prisma.$transaction(async (tx) => {
        const spare = await tx.spares_master.findUnique({ where: { id: parseInt(spareId) }, include: { stock: true } });
        if (!spare) throw new Error('Spare not found');

        const stock = await tx.spares_stock.update({
            where: { spare_master_id: spare.id },
            data: { available_quantity: 1 }
        });

        await tx.spares_stock_transactions.create({
            data: {
                spare_master_id: spare.id,
                transaction_type: 'ADD',
                quantity: 1,
                reference_type: 'INVENTORY_ENTRY',
                remarks: data.remarks || `Returned to home`,
                created_by: userId
            }
        });

        return {
            id: spare.id,
            spare_type: spare.category,
            spare_number: spare.spare_name,
            status: 'AVAILABLE',
            current_location: 'HOME',
            vehicle_name: null,
            supervisor_name: null
        };
    });
};

export const updateSpareStatus = async (spareId, status) => {
    return { success: true, message: 'Status is driven dynamically via Issue/Return workflows now.' };
};

export const deleteSpare = async (spareId) => {
    return await prisma.$transaction(async (tx) => {
        const spare = await tx.spares_master.findUnique({ where: { id: parseInt(spareId) }, include: { stock: true } });
        if (!spare) throw new Error('Spare not found');

        if (parseFloat(spare.stock?.available_quantity || 0) <= 0) {
            throw new Error('Cannot delete a spare that is currently in use / issued to a vehicle.');
        }

        return await tx.spares_master.update({
            where: { id: parseInt(spareId) },
            data: { is_active: false }
        });
    });
};

export const getSparesTransactions = async (spareId = null) => {
    const whereClause = {};
    if (spareId) whereClause.spare_master_id = parseInt(spareId);

    const txns = await prisma.spares_stock_transactions.findMany({
        where: whereClause,
        include: {
            spare_master: true,
            user: { select: { username: true } }
        },
        orderBy: { created_at: 'desc' }
    });

    return txns.map(t => ({
        id: t.id,
        spare_id: t.spare_master_id,
        spare_type: t.spare_master.category,
        spare_number: t.spare_master.spare_name,
        transaction_type: t.transaction_type === 'DEDUCT' ? 'ISSUE' : (t.transaction_type === 'ADD' && t.reference_type === 'INVENTORY_ENTRY' ? 'RETURN' : t.transaction_type),
        vehicle_name: t.vehicle_name,
        supervisor_name: t.supervisor_name,
        remarks: t.remarks,
        created_by_name: t.user?.username || 'System',
        created_at: t.created_at
    }));
};

// =============================================
// DIESEL SERVICE (ERP ORM)
// =============================================

export const getAllDieselRecords = async (filters) => {
    const whereClause = { reference_type: 'INVENTORY_ENTRY' };

    if (filters?.startDate) whereClause.created_at = { ...whereClause.created_at, gte: new Date(filters.startDate) };
    if (filters?.endDate) whereClause.created_at = { ...whereClause.created_at, lte: new Date(filters.endDate) };
    if (filters?.vehicle) whereClause.vehicle_name = { contains: filters.vehicle, mode: 'insensitive' };
    if (filters?.supervisor) whereClause.supervisor_name = { contains: filters.supervisor, mode: 'insensitive' };

    const txns = await prisma.diesel_stock_transactions.findMany({
        where: whereClause,
        include: { user: { select: { username: true } } },
        orderBy: { created_at: 'desc' }
    });

    return txns.map(t => ({
        id: t.id,
        vehicle_name: t.vehicle_name,
        purchase_date: t.created_at,
        supervisor_name: t.supervisor_name,
        amount: t.amount,
        liters: t.quantity,
        bill_url: t.bill_url,
        remarks: t.remarks,
        created_by_name: t.user?.username || 'System',
        created_at: t.created_at
    }));
};

export const addDieselRecord = async (data, userId) => {
    return await prisma.$transaction(async (tx) => {
        let master = await tx.diesel_master.findFirst({ where: { storage_location: 'Main Tank' }, include: { stock: true } });
        if (!master) {
            master = await tx.diesel_master.create({
                data: {
                    storage_location: 'Main Tank',
                    unit: 'liters',
                    stock: { create: { available_quantity: 0 } }
                },
                include: { stock: true }
            });
        }

        const quantity = parseFloat(data.liters || 0);

        if (quantity > 0) {
            await tx.diesel_stock.update({
                where: { diesel_master_id: master.id },
                data: { available_quantity: { increment: quantity } }
            });
        }

        const record = await tx.diesel_stock_transactions.create({
            data: {
                diesel_master_id: master.id,
                transaction_type: 'ADD',
                quantity: quantity,
                reference_type: 'INVENTORY_ENTRY',
                vehicle_name: data.vehicle_name,
                supervisor_name: data.supervisor_name,
                amount: data.amount ? parseFloat(data.amount) : null,
                bill_url: data.bill_url,
                remarks: data.remarks,
                created_by: userId || 1,
                created_at: data.purchase_date ? new Date(data.purchase_date) : undefined
            }
        });

        return {
            id: record.id,
            vehicle_name: record.vehicle_name,
            purchase_date: record.created_at,
            amount: record.amount,
            liters: record.quantity
        };
    });
};

export const updateDieselRecord = async (id, data) => {
    return await prisma.$transaction(async (tx) => {
        const record = await tx.diesel_stock_transactions.findUnique({ where: { id: parseInt(id) } });
        if (!record) throw new Error('Diesel record not found');

        const oldQuantity = parseFloat(record.quantity);
        const newQuantity = parseFloat(data.liters || oldQuantity);
        const difference = newQuantity - oldQuantity;

        if (difference !== 0) {
            await tx.diesel_stock.update({
                where: { diesel_master_id: record.diesel_master_id },
                data: { available_quantity: { increment: difference } }
            });
        }

        const updated = await tx.diesel_stock_transactions.update({
            where: { id: record.id },
            data: {
                vehicle_name: data.vehicle_name,
                supervisor_name: data.supervisor_name,
                amount: data.amount ? parseFloat(data.amount) : record.amount,
                quantity: newQuantity,
                bill_url: data.bill_url,
                remarks: data.remarks,
                created_at: data.purchase_date ? new Date(data.purchase_date) : record.created_at
            }
        });

        return updated;
    });
};

export const deleteDieselRecord = async (id) => {
    return await prisma.$transaction(async (tx) => {
        const record = await tx.diesel_stock_transactions.findUnique({ where: { id: parseInt(id) } });
        if (!record) throw new Error('Diesel record not found');

        await tx.diesel_stock.update({
            where: { diesel_master_id: record.diesel_master_id },
            data: { available_quantity: { decrement: record.quantity } }
        });

        return await tx.diesel_stock_transactions.delete({ where: { id: record.id } });
    });
};

export const getDieselSummary = async (startDate, endDate) => {
    const whereClause = {
        reference_type: 'INVENTORY_ENTRY',
        created_at: { gte: new Date(startDate), lte: new Date(endDate) }
    };

    const byVehicleAgg = await prisma.diesel_stock_transactions.groupBy({
        by: ['vehicle_name'],
        where: whereClause,
        _count: { id: true },
        _sum: { amount: true, quantity: true },
        orderBy: { _sum: { amount: 'desc' } }
    });

    const totalAgg = await prisma.diesel_stock_transactions.aggregate({
        where: whereClause,
        _count: { id: true },
        _sum: { amount: true, quantity: true }
    });

    const byVehicle = byVehicleAgg.map(v => ({
        vehicle_name: v.vehicle_name || 'Unknown',
        total_records: v._count.id,
        vehicle_count: v._count.id,
        total_amount: v._sum.amount || 0,
        total_liters: v._sum.quantity || 0
    }));

    return {
        summary: {
            total_records: totalAgg._count.id,
            total_amount: totalAgg._sum.amount || 0,
            total_liters: totalAgg._sum.quantity || 0
        },
        byVehicle
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
