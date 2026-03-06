import { validateQuantity } from '../utils/pipeConversions.js';
import prisma from '../config/prisma.js';
import {
    getOpenPipeAllocations,
    issuePipeAllocation,
    returnPipeAllocation,
} from './pipeAllocationService.js';

// =============================================
// PIPES SERVICE (ERP ORM)
// =============================================

export const getAllPipes = async () => {
    const pipes = await prisma.pipes_master.findMany({
        where: { is_active: true },
        include: {
            stock: true,
            allocations: {
                where: { status: 'OPEN' },
                select: { issued_quantity: true, returned_quantity: true }
            }
        },
        orderBy: [{ pipe_size: 'asc' }, { pipe_type_name: 'asc' }]
    });

    return pipes.map(p => ({
        store_quantity: p.stock?.available_quantity || 0,
        in_use_quantity: p.allocations.reduce((sum, allocation) => {
            return sum + (parseFloat(allocation.issued_quantity || 0) - parseFloat(allocation.returned_quantity || 0));
        }, 0),
        id: p.id,
        size: p.pipe_size,
        company: p.pipe_type_name,
        unit: p.unit,
        quantity: p.stock?.available_quantity || 0,
        material_type: p.material_type || null,
        quality_grade: p.quality_grade || null,
        length_feet: p.length_feet ? parseFloat(p.length_feet) : 20,
        cost_per_unit: p.cost_per_unit ? parseFloat(p.cost_per_unit) : 0,
        reorder_level: p.reorder_level || 10,
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

        // Auto-create company in global master if it doesn't exist
        const existingCompany = await tx.pipes_company_master.findFirst({
            where: { company_name: { equals: data.company, mode: 'insensitive' } }
        });

        if (!existingCompany) {
            console.log(`[Inventory - Pipes] Auto-creating new company master global entry for: ${data.company}`);
            await tx.pipes_company_master.create({
                data: {
                    company_name: data.company,
                    is_active: true
                }
            });
        }

        const pipe = await tx.pipes_master.create({
            data: {
                pipe_type_name: data.company,
                pipe_size: data.size,
                unit: data.unit || 'pieces',
                material_type: data.material_type || null,
                quality_grade: data.quality_grade || null,
                length_feet: data.length_feet ? parseFloat(data.length_feet) : 20,
                cost_per_unit: data.cost_per_unit ? parseFloat(data.cost_per_unit) : 0,
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
                    created_by: userId,
                    source_location: 'PURCHASE',
                    destination_location: 'MAIN_STORE',
                    remarks: 'Opening stock created with new pipe type'
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

export const addPipeStock = async (pipeId, quantity, unit, userId, options = {}) => {
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
                created_by: userId,
                source_location: options.source_location || 'PURCHASE',
                destination_location: options.destination_location || 'MAIN_STORE',
                supplier_name: options.supplier_name || null,
                purchase_mode: options.purchase_mode || null,
                remarks: options.remarks || 'Stock received into main store'
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
        const validation = validateQuantity(data.quantity, data.unit || 'pipes');
        if (!validation.valid) throw new Error(validation.error);

        const allocation = await issuePipeAllocation({
            tx,
            pipeMasterId: parseInt(data.pipe_inventory_id),
            boreType: data.bore_type === 'govt' ? 'govt' : 'private',
            boreId: parseInt(data.bore_id),
            quantity: validation.feet,
            unit: 'feet',
            vehicleName: data.vehicle_name,
            supervisorName: data.supervisor_name,
            createdBy: userId,
            remarks: data.remarks
        });

        const updatedPipe = await tx.pipes_master.findUnique({
            where: { id: parseInt(data.pipe_inventory_id) },
            include: { stock: true }
        });

        return {
            id: updatedPipe.id,
            size: updatedPipe.pipe_size,
            company: updatedPipe.pipe_type_name,
            quantity: updatedPipe.stock?.available_quantity || 0,
            unit: updatedPipe.unit,
            allocation_id: allocation.id
        };
    });
};

export const returnPipesFromBore = async (data, userId) => {
    return await prisma.$transaction(async (tx) => {
        const validation = validateQuantity(data.quantity, data.unit || 'pipes');
        if (!validation.valid) throw new Error(validation.error);
        if (!data.allocation_id) {
            throw new Error('Allocation ID is required for returning pipes from bore');
        }

        const allocation = await returnPipeAllocation({
            tx,
            allocationId: parseInt(data.allocation_id),
            quantity: validation.feet,
            unit: 'feet',
            createdBy: userId,
            remarks: data.remarks
        });

        const updatedPipe = await tx.pipes_master.findUnique({
            where: { id: allocation.pipe_master_id },
            include: { stock: true }
        });

        return {
            id: updatedPipe.id,
            size: updatedPipe.pipe_size,
            company: updatedPipe.pipe_type_name,
            quantity: updatedPipe.stock?.available_quantity || 0,
            unit: updatedPipe.unit,
            allocation_id: allocation.id
        };
    });
};

export const deletePipe = async (pipeId) => {
    return await prisma.$transaction(async (tx) => {
        const pipeMaster = await tx.pipes_master.findUnique({ where: { id: parseInt(pipeId) }, include: { stock: true } });
        if (!pipeMaster) throw new Error('Pipe not found');

        const openAllocations = await tx.pipe_bore_allocations.count({
            where: { pipe_master_id: parseInt(pipeId), status: 'OPEN' }
        });
        if (openAllocations > 0) {
            throw new Error('Cannot delete pipe type with active bore allocations. Return the issued stock first.');
        }

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

    if (filters.transactionType === 'ISSUE') {
        whereClause.transaction_type = 'DEDUCT';
    }

    const txns = await prisma.pipes_stock_transactions.findMany({
        where: whereClause,
        include: {
            pipe_master: true,
            user: { select: { username: true } }
        },
        orderBy: { created_at: 'desc' }
    });

    const mapped = txns.map(t => ({
        id: t.id,
        pipe_inventory_id: t.pipe_master_id,
        size: t.pipe_master.pipe_size,
        company: t.pipe_master.pipe_type_name,
        transaction_type: t.transaction_type === 'DEDUCT' ? 'ISSUE' : (t.reference_type?.includes('RETURN') ? 'RETURN' : 'LOAD'),
        quantity: t.quantity,
        unit_type: t.pipe_master.unit,
        bore_type: t.reference_type?.includes('GOVT') ? 'govt' : (t.reference_type?.includes('PRIVATE') ? 'private' : null),
        bore_id: t.reference_id,
        created_by_name: t.user?.username || 'System',
        created_at: t.created_at,
        remarks: t.remarks,
        vehicle_name: t.vehicle_name,
        supervisor_name: t.supervisor_name,
        source_location: t.source_location,
        destination_location: t.destination_location,
        supplier_name: t.supplier_name,
        purchase_mode: t.purchase_mode,
        allocation_id: t.allocation_id
    }));

    if (filters.transactionType) {
        return mapped.filter((item) => item.transaction_type === filters.transactionType);
    }

    return mapped;
};

export const getPipeAllocations = async () => {
    return getOpenPipeAllocations();
};



// =============================================
// PIPE COMPANIES SERVICE
// =============================================

export const getAllPipeCompanies = async () => {
    return await prisma.pipes_company_master.findMany({
        where: { is_active: true },
        orderBy: { company_name: 'asc' }
    });
};

export const addPipeCompany = async (companyName) => {
    // Prevent exactly identical names
    const existing = await prisma.pipes_company_master.findUnique({
        where: { company_name: companyName }
    });
    if (existing) {
        if (!existing.is_active) {
            // Restore if previously deleted
            return await prisma.pipes_company_master.update({
                where: { id: existing.id },
                data: { is_active: true }
            });
        }
        throw new Error('A company with this name already exists.');
    }

    return await prisma.pipes_company_master.create({
        data: { company_name: companyName, is_active: true }
    });
};

export const updatePipeCompany = async (id, data) => {
    return await prisma.pipes_company_master.update({
        where: { id: parseInt(id) },
        data: { company_name: data.company_name, updated_at: new Date() }
    });
};

export const deletePipeCompany = async (companyId) => {
    return await prisma.$transaction(async (tx) => {
        const company = await tx.pipes_company_master.findUnique({ where: { id: parseInt(companyId) } });
        if (!company) throw new Error('Company not found');

        // Check 1: Are there any historical Borewell Works using this company?
        const boreCount = await tx.borewellWork.count({
            where: { pipe_company_id: parseInt(companyId) }
        });
        if (boreCount > 0) {
            throw new Error('Cannot delete this company. It is used in existing bore records.');
        }

        // Check 2: Are there any physical pipe inventory records tied to this company name?
        // (Legacy schema mapped them loosely by string matching)
        const productCount = await tx.pipes_master.count({
            where: { pipe_type_name: company.company_name }
        });
        if (productCount > 0) {
            throw new Error('Cannot delete this company. It has registered pipe specifications in inventory.');
        }

        // Soft delete
        return await tx.pipes_company_master.update({
            where: { id: parseInt(companyId) },
            data: { is_active: false }
        });
    });
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
            brand: s.brand || null,
            unit_type: s.unit_type || 'Piece',
            cost_per_unit: s.cost_per_unit ? parseFloat(s.cost_per_unit) : 0,
            reorder_level: s.reorder_level || 5,
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
                brand: data.brand || null,
                unit_type: data.unit_type || 'Piece',
                cost_per_unit: data.cost_per_unit ? parseFloat(data.cost_per_unit) : 0,
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

        await tx.spares_stock.update({
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

        await tx.spares_stock.update({
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

export const updateSpareStatus = async (_spareId, _status) => {
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

// =============================================
// INVENTORY SUMMARY
// =============================================

export const getInventorySummary = async () => {
    // Pipes summary
    const pipes = await prisma.pipes_master.findMany({
        where: { is_active: true },
        include: { stock: true }
    });

    let totalPipeStock = 0;
    let totalPipeValue = 0;
    let lowStockPipes = 0;
    let totalPipeInUse = 0;
    pipes.forEach(p => {
        const qty = parseFloat(p.stock?.available_quantity || 0);
        const cost = parseFloat(p.cost_per_unit || 0);
        totalPipeStock += qty;
        totalPipeValue += qty * cost;
        const pipeCount = qty / 20;
        if (pipeCount > 0 && pipeCount < (p.reorder_level || 10)) {
            lowStockPipes++;
        }
    });

    const openPipeAllocations = await prisma.pipe_bore_allocations.findMany({ where: { status: 'OPEN' } });
    totalPipeInUse = openPipeAllocations.reduce((sum, allocation) => {
        return sum + (parseFloat(allocation.issued_quantity || 0) - parseFloat(allocation.returned_quantity || 0));
    }, 0);

    // Spares summary
    const spares = await prisma.spares_master.findMany({
        where: { is_active: true },
        include: { stock: true }
    });

    let totalSpares = spares.length;
    let sparesAvailable = 0;
    let sparesInUse = 0;
    let totalSparesValue = 0;
    spares.forEach(s => {
        const qty = parseFloat(s.stock?.available_quantity || 0);
        const cost = parseFloat(s.cost_per_unit || 0);
        totalSparesValue += cost;
        if (qty > 0) sparesAvailable++;
        else sparesInUse++;
    });

    // Diesel summary (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dieselAgg = await prisma.diesel_stock_transactions.aggregate({
        where: {
            reference_type: 'INVENTORY_ENTRY',
            created_at: { gte: thirtyDaysAgo }
        },
        _sum: { amount: true, quantity: true },
        _count: { id: true }
    });

    const dieselStock = await prisma.diesel_stock.findFirst();

    return {
        pipes: {
            total_types: pipes.length,
            total_stock_feet: totalPipeStock,
            total_in_use_feet: totalPipeInUse,
            total_value: totalPipeValue,
            low_stock_count: lowStockPipes,
            open_allocations: openPipeAllocations.length
        },
        spares: {
            total: totalSpares,
            available: sparesAvailable,
            in_use: sparesInUse,
            total_value: totalSparesValue
        },
        diesel: {
            current_stock_liters: parseFloat(dieselStock?.available_quantity || 0),
            last_30_days_liters: parseFloat(dieselAgg._sum.quantity || 0),
            last_30_days_amount: parseFloat(dieselAgg._sum.amount || 0),
            last_30_days_entries: dieselAgg._count.id || 0
        }
    };
};

export default {
    getAllPipes,
    getPipeAllocations,
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
    getDieselSummary,
    getInventorySummary
};
