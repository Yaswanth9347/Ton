import { validateQuantity } from '../utils/pipeConversions.js';
import prisma from '../config/prisma.js';
import {
    getOpenPipeAllocations,
    issuePipeAllocation,
    reconcileGovtBoreAllocationStatuses,
    returnPipeAllocation,
} from './pipeAllocationService.js';
import { ensureDefaultSpares } from '../utils/ensureDefaultSpares.js';
import { DEFAULT_GOVT_SPARE_NAMES } from '../constants/defaultSpareMaterials.js';
import { ensureInventorySchema } from '../utils/ensureInventorySchema.js';
import { DEFAULT_DIESEL_VEHICLES, normalizeVehicleKey } from '../constants/defaultDieselVehicles.js';

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
        const normalizedCompany = (data.company || '').trim();
        const normalizedSize = (data.size || '').trim();
        const lengthFeet = data.length_feet ? parseFloat(data.length_feet) : 20;
        const validation = validateQuantity(data.quantity || 0, data.unit || 'pipes', lengthFeet);
        if (!validation.valid) {
            throw new Error(validation.error);
        }
        const quantityInFeet = validation.feet;

        const existing = await tx.pipes_master.findFirst({
            where: {
                pipe_type_name: { equals: normalizedCompany, mode: 'insensitive' },
                pipe_size: { equals: normalizedSize, mode: 'insensitive' }
            },
            include: { stock: true }
        });

        if (existing) {
            await tx.pipes_master.update({
                where: { id: existing.id },
                data: {
                    is_active: true,
                    unit: data.unit || existing.unit || 'pieces',
                    material_type: data.material_type || existing.material_type || null,
                    quality_grade: data.quality_grade || existing.quality_grade || null,
                    length_feet: lengthFeet,
                    cost_per_unit: data.cost_per_unit !== undefined ? parseFloat(data.cost_per_unit || 0) : (existing.cost_per_unit ? parseFloat(existing.cost_per_unit) : 0)
                },
                include: { stock: true }
            });

            if (quantityInFeet > 0) {
                await tx.pipes_stock.upsert({
                    where: { pipe_master_id: existing.id },
                    update: { available_quantity: { increment: quantityInFeet } },
                    create: { pipe_master_id: existing.id, available_quantity: quantityInFeet }
                });

                await tx.pipes_stock_transactions.create({
                    data: {
                        pipe_master_id: existing.id,
                        transaction_type: 'PURCHASE',
                        quantity: quantityInFeet,
                        reference_type: 'INVENTORY_ENTRY',
                        created_by: userId,
                        source_location: 'SUPPLIER',
                        destination_location: 'MAIN_STORE',
                        remarks: existing.is_active
                            ? 'Stock added to existing pipe type'
                            : 'Stock restored with reactivated pipe type'
                    }
                });
            }

            const updatedPipe = await tx.pipes_master.findUnique({
                where: { id: existing.id },
                include: { stock: true }
            });

            return {
                id: updatedPipe.id,
                size: updatedPipe.pipe_size,
                company: updatedPipe.pipe_type_name,
                quantity: updatedPipe.stock?.available_quantity || 0,
                unit: updatedPipe.unit,
                action: existing.is_active ? 'restocked' : 'reactivated'
            };
        }

        // Auto-create company in global master if it doesn't exist
        const existingCompany = await tx.pipes_company_master.findFirst({
            where: { company_name: { equals: data.company, mode: 'insensitive' } }
        });

        if (!existingCompany) {
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
                length_feet: lengthFeet,
                cost_per_unit: data.cost_per_unit ? parseFloat(data.cost_per_unit) : 0,
                stock: {
                    create: { available_quantity: quantityInFeet }
                }
            },
            include: { stock: true }
        });

        if (quantityInFeet > 0) {
            await tx.pipes_stock_transactions.create({
                data: {
                    pipe_master_id: pipe.id,
                    transaction_type: 'PURCHASE',
                    quantity: quantityInFeet,
                    reference_type: 'INVENTORY_ENTRY',
                    created_by: userId,
                    source_location: 'SUPPLIER',
                    destination_location: 'MAIN_STORE',
                    remarks: 'Opening stock created with new pipe type'
                }
            });
        }

        return {
            id: pipe.id,
            size: pipe.pipe_size,
            company: pipe.pipe_type_name,
            quantity: pipe.stock?.available_quantity || 0,
            unit: pipe.unit,
            action: 'created'
        };
    });
};

export const addPipeStock = async (pipeId, quantity, unit, userId, options = {}) => {
    return await prisma.$transaction(async (tx) => {
        const pipeMaster = await tx.pipes_master.findUnique({ where: { id: parseInt(pipeId) }, include: { stock: true } });
        if (!pipeMaster) throw new Error('Pipe not found');

        const lengthFeet = pipeMaster.length_feet ? parseFloat(pipeMaster.length_feet) : 20;
        const validation = validateQuantity(quantity, unit || 'pipes', lengthFeet);
        if (!validation.valid) throw new Error(validation.error);
        const quantityInFeet = validation.feet;

        const stock = await tx.pipes_stock.update({
            where: { pipe_master_id: pipeMaster.id },
            data: { available_quantity: { increment: quantityInFeet } }
        });

        await tx.pipes_stock_transactions.create({
            data: {
                pipe_master_id: pipeMaster.id,
                transaction_type: 'PURCHASE',
                quantity: quantityInFeet,
                reference_type: 'INVENTORY_ENTRY',
                created_by: userId,
                source_location: options.source_location || 'SUPPLIER',
                destination_location: options.destination_location || 'MAIN_STORE',
                remarks: 'Stock received into main store'
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
        const pipeMaster = await tx.pipes_master.findUnique({ where: { id: parseInt(data.pipe_inventory_id) } });
        if (!pipeMaster) throw new Error('Pipe not found');
        const lengthFeet = pipeMaster.length_feet ? parseFloat(pipeMaster.length_feet) : 20;
        const validation = validateQuantity(data.quantity, data.unit || 'pipes', lengthFeet);
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
        if (!data.allocation_id) {
            throw new Error('Allocation ID is required for returning pipes from bore');
        }
        const allocation = await tx.pipe_bore_allocations.findUnique({
            where: { id: parseInt(data.allocation_id) },
            include: { pipe_master: true }
        });
        if (!allocation) throw new Error('Allocation not found');
        const lengthFeet = allocation.pipe_master?.length_feet ? parseFloat(allocation.pipe_master.length_feet) : 20;
        const validation = validateQuantity(data.quantity, data.unit || 'pipes', lengthFeet);
        if (!validation.valid) throw new Error(validation.error);

        const updatedAllocation = await returnPipeAllocation({
            tx,
            allocationId: parseInt(data.allocation_id),
            quantity: validation.feet,
            unit: 'feet',
            createdBy: userId,
            remarks: data.remarks
        });

        const updatedPipe = await tx.pipes_master.findUnique({
            where: { id: updatedAllocation.pipe_master_id },
            include: { stock: true }
        });

        return {
            id: updatedPipe.id,
            size: updatedPipe.pipe_size,
            company: updatedPipe.pipe_type_name,
            quantity: updatedPipe.stock?.available_quantity || 0,
            unit: updatedPipe.unit,
            allocation_id: updatedAllocation.id
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

export const getPipeTransactions = async (filters = {}) => {
    const page = Math.max(parseInt(filters.page || 1, 10), 1);
    const limit = Math.min(Math.max(parseInt(filters.limit || 10, 10), 1), 100);
    const skip = (page - 1) * limit;
    const whereClause = {};
    if (filters.startDate || filters.endDate) {
        whereClause.created_at = {};
        if (filters.startDate) whereClause.created_at.gte = new Date(filters.startDate);
        if (filters.endDate) {
            const endDate = new Date(filters.endDate);
            endDate.setHours(23, 59, 59, 999);
            whereClause.created_at.lte = endDate;
        }
    }

    // Map filter values to actual DB transaction types (including legacy support)
    if (filters.transactionType) {
        const typeMap = {
            'PURCHASE': { in: ['PURCHASE', 'ADD'] },
            'LOAD': { in: ['LOAD', 'DEDUCT'] },
            'ISSUE': { equals: 'ISSUE' },
            'RETURN': { equals: 'RETURN' },
        };
        const mapped = typeMap[filters.transactionType];
        if (mapped) {
            whereClause.transaction_type = mapped;
        }
    }

    if (filters.company || filters.size) {
        const pipeWhere = {};
        if (filters.company) {
            pipeWhere.pipe_type_name = {
                equals: filters.company,
                mode: 'insensitive'
            };
        }
        if (filters.size) {
            pipeWhere.pipe_size = {
                equals: filters.size,
                mode: 'insensitive'
            };
        }

        const matchingPipeMasters = await prisma.pipes_master.findMany({
            where: pipeWhere,
            select: { id: true }
        });

        if (matchingPipeMasters.length === 0) {
            return {
                records: [],
                pagination: {
                    page,
                    limit,
                    total: 0,
                    totalPages: 0
                }
            };
        }

        whereClause.pipe_master_id = {
            in: matchingPipeMasters.map((pipe) => pipe.id)
        };
    }

    const total = await prisma.pipes_stock_transactions.count({ where: whereClause });

    const txns = await prisma.pipes_stock_transactions.findMany({
        where: whereClause,
        include: {
            pipe_master: true,
            user: { select: { username: true } }
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit
    });

    // Normalize legacy transaction types to new standard names
    const normalizeTransactionType = (t) => {
        const dbType = t.transaction_type;
        const refType = t.reference_type || '';

        // Already using new naming convention
        if (['PURCHASE', 'LOAD', 'ISSUE', 'RETURN'].includes(dbType)) return dbType;

        // Legacy: ADD could be PURCHASE (stock inward) or RETURN (bore return)
        if (dbType === 'ADD') {
            if (refType.includes('RETURN')) return 'RETURN';
            return 'PURCHASE';
        }

        // Legacy: DEDUCT was used for bore allocations
        if (dbType === 'DEDUCT') return 'LOAD';

        return dbType;
    };

    const records = txns.map(t => {
        const transactionType = normalizeTransactionType(t);
        const lengthFeet = t.pipe_master.length_feet ? parseFloat(t.pipe_master.length_feet) : 20;
        return {
            id: t.id,
            pipe_inventory_id: t.pipe_master_id,
            size: t.pipe_master.pipe_size,
            company: t.pipe_master.pipe_type_name,
            transaction_type: transactionType,
            quantity: t.quantity,
            length_feet: lengthFeet,
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
            allocation_id: t.allocation_id
        };
    });

    return {
        records,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
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

const getSpareStockStatus = (availableQty, reorderLevel) => {
    if (availableQty <= 0) return 'OUT_OF_STOCK';
    if (availableQty <= reorderLevel) return 'LOW_STOCK';
    return 'IN_STOCK';
};

export const getAllSpares = async (filters) => {
    await ensureDefaultSpares(prisma);

    const whereClause = { is_active: true };
    if (filters?.spareType) whereClause.category = filters.spareType;

    const spares = await prisma.spares_master.findMany({
        where: whereClause,
        include: {
            stock: true,
            allocations: {
                where: {
                    status: 'OPEN',
                    bore_type: 'govt'
                },
                include: {
                    govt_bore: {
                        include: { village: true }
                    }
                }
            },
            transactions: {
                orderBy: { created_at: 'desc' },
                take: 1
            }
        },
        orderBy: [{ category: 'asc' }, { spare_name: 'asc' }]
    });

    let mappedSpares = spares.map(s => {
        const availableQty = parseFloat(s.stock?.available_quantity || 0);
        const reorderLevel = s.reorder_level || 5;
        const latestTxn = s.transactions[0] || null;
        const activeAllocations = (s.allocations || []).filter((allocation) => {
            const openBalance = parseFloat(allocation.issued_quantity || 0) - parseFloat(allocation.returned_quantity || 0);
            return openBalance > 0.0001;
        });
        const activeBoreReferences = activeAllocations.map((allocation) => {
            return allocation.govt_bore?.village?.name || allocation.govt_bore?.location || `Govt Bore #${allocation.govt_bore_id}`;
        });
        const allocatedQty = activeAllocations.reduce((sum, allocation) => {
            return sum + (parseFloat(allocation.issued_quantity || 0) - parseFloat(allocation.returned_quantity || 0));
        }, 0);
        const status = getSpareStockStatus(availableQty, reorderLevel);

        return {
            id: s.id,
            spare_type: s.category,
            spare_number: s.spare_name,
            is_default: s.category === 'MATERIAL' && DEFAULT_GOVT_SPARE_NAMES.includes(s.spare_name),
            status,
            available_quantity: availableQty,
            allocated_quantity: allocatedQty,
            active_bore_count: activeAllocations.length,
            active_bore_reference: activeBoreReferences[0] || null,
            active_bore_references: activeBoreReferences,
            current_location: activeAllocations.length > 0 ? 'Govt Bore' : 'Main Store',
            vehicle_name: latestTxn?.vehicle_name || null,
            supervisor_name: latestTxn?.supervisor_name || null,
            brand: s.brand || null,
            unit_type: s.unit_type || 'Piece',
            cost_per_unit: s.cost_per_unit ? parseFloat(s.cost_per_unit) : 0,
            reorder_level: reorderLevel,
            total_value: availableQty * (s.cost_per_unit ? parseFloat(s.cost_per_unit) : 0),
            last_transaction_at: latestTxn?.created_at || null,
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
            where: {
                spare_name: { equals: data.spare_number, mode: 'insensitive' },
                category: { equals: data.spare_type, mode: 'insensitive' },
                is_active: true,
            }
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
                description: data.description || null,
                brand: data.brand || null,
                unit_type: data.unit_type || 'Piece',
                cost_per_unit: data.cost_per_unit ? parseFloat(data.cost_per_unit) : 0,
                reorder_level: data.reorder_level ? parseInt(data.reorder_level, 10) : 5,
                stock: {
                    create: { available_quantity: 0 }
                }
            },
            include: { stock: true }
        });

        console.log(`[Inventory - Spares] Spare added successfully. ID: ${spare.id}`);
        return {
            id: spare.id,
            spare_type: spare.category,
            spare_number: spare.spare_name,
            status: 'OUT_OF_STOCK',
            current_location: 'Main Store',
            available_quantity: 0,
            allocated_quantity: 0,
            brand: spare.brand || null,
            unit_type: spare.unit_type || 'Piece',
            cost_per_unit: spare.cost_per_unit ? parseFloat(spare.cost_per_unit) : 0,
            reorder_level: spare.reorder_level || 5
        };
    });
};

export const addSpareStock = async (spareId, data, userId) => {
    return await prisma.$transaction(async (tx) => {
        const spare = await tx.spares_master.findUnique({
            where: { id: parseInt(spareId) },
            include: { stock: true },
        });

        if (!spare || !spare.is_active) throw new Error('Spare not found');

        const quantity = parseFloat(data.quantity || 0);
        if (!Number.isFinite(quantity) || quantity <= 0) {
            throw new Error('Stock quantity must be greater than 0');
        }

        const nextCostPerUnit = data.cost_per_unit !== undefined && data.cost_per_unit !== null && data.cost_per_unit !== ''
            ? parseFloat(data.cost_per_unit)
            : null;

        if (nextCostPerUnit !== null && (!Number.isFinite(nextCostPerUnit) || nextCostPerUnit < 0)) {
            throw new Error('Cost must be 0 or greater');
        }

        if (nextCostPerUnit !== null) {
            await tx.spares_master.update({
                where: { id: spare.id },
                data: { cost_per_unit: nextCostPerUnit },
            });
        }

        await tx.spares_stock.upsert({
            where: { spare_master_id: spare.id },
            update: { available_quantity: { increment: quantity } },
            create: { spare_master_id: spare.id, available_quantity: quantity },
        });

        await tx.spares_stock_transactions.create({
            data: {
                spare_master_id: spare.id,
                transaction_type: 'ADD_STOCK',
                quantity,
                reference_type: 'INVENTORY_ENTRY',
                created_by: userId || 1,
                remarks: 'Stock added from inventory page',
            },
        });

        const updated = await tx.spares_master.findUnique({
            where: { id: spare.id },
            include: {
                stock: true,
                allocations: {
                    where: { status: 'OPEN', bore_type: 'govt' },
                    include: { govt_bore: { include: { village: true } } },
                },
                transactions: { orderBy: { created_at: 'desc' }, take: 1 },
            },
        });

        const availableQty = parseFloat(updated.stock?.available_quantity || 0);
        const activeAllocations = (updated.allocations || []).filter((allocation) => {
            const openBalance = parseFloat(allocation.issued_quantity || 0) - parseFloat(allocation.returned_quantity || 0);
            return openBalance > 0.0001;
        });

        return {
            id: updated.id,
            spare_type: updated.category,
            spare_number: updated.spare_name,
            status: getSpareStockStatus(availableQty, updated.reorder_level || 5),
            available_quantity: availableQty,
            cost_per_unit: updated.cost_per_unit ? parseFloat(updated.cost_per_unit) : 0,
            total_value: availableQty * (updated.cost_per_unit ? parseFloat(updated.cost_per_unit) : 0),
            allocated_quantity: activeAllocations.reduce((sum, allocation) => sum + (parseFloat(allocation.issued_quantity || 0) - parseFloat(allocation.returned_quantity || 0)), 0),
            active_bore_count: activeAllocations.length,
            active_bore_reference: activeAllocations[0]?.govt_bore?.village?.name || activeAllocations[0]?.govt_bore?.location || null,
            current_location: activeAllocations.length > 0 ? 'Govt Bore' : 'Main Store',
        };
    });
};

export const issueSpareToVehicle = async (_spareId, _data, _userId) => {
    throw new Error('Manual spare issue is disabled. Govt bore material quantities now drive spare deductions automatically.');
};

export const returnSpareToHome = async (_spareId, _data, _userId) => {
    throw new Error('Manual spare return is disabled. Update or delete the govt bore record to restore synced quantities.');
};

export const updateSpareStatus = async (_spareId, _status) => {
    return { success: true, message: 'Status is derived from quantity and reorder level.' };
};

export const deleteSpare = async (spareId) => {
    return await prisma.$transaction(async (tx) => {
        const spare = await tx.spares_master.findUnique({
            where: { id: parseInt(spareId) },
            include: {
                stock: true,
                allocations: {
                    where: { status: 'OPEN' },
                },
            },
        });
        if (!spare) throw new Error('Spare not found');

        if ((spare.allocations || []).some((allocation) => {
            const openBalance = parseFloat(allocation.issued_quantity || 0) - parseFloat(allocation.returned_quantity || 0);
            return openBalance > 0.0001;
        })) {
            throw new Error('Cannot delete a spare that is currently linked to an active bore allocation.');
        }

        if (spare.category === 'MATERIAL' && DEFAULT_GOVT_SPARE_NAMES.includes(spare.spare_name)) {
            throw new Error('Default govt bore material spares cannot be deleted.');
        }

        return await tx.spares_master.update({
            where: { id: parseInt(spareId) },
            data: { is_active: false }
        });
    });
};

export const getSparesTransactions = async (options = {}) => {
    await ensureDefaultSpares(prisma);
    const page = Math.max(parseInt(options.page || 1, 10), 1);
    const limit = Math.min(Math.max(parseInt(options.limit || 10, 10), 1), 100);
    const skip = (page - 1) * limit;

    const spareId = options.spareId ? parseInt(options.spareId, 10) : null;
    const whereClause = {};
    if (spareId) whereClause.spare_master_id = parseInt(spareId);

    if (options.transactionType) {
        whereClause.transaction_type = options.transactionType;
    }

    if (options.startDate || options.endDate) {
        whereClause.created_at = {};
        if (options.startDate) whereClause.created_at.gte = new Date(options.startDate);
        if (options.endDate) {
            const endDate = new Date(options.endDate);
            endDate.setHours(23, 59, 59, 999);
            whereClause.created_at.lte = endDate;
        }
    }

    if (options.spareName) {
        const matchingSpares = await prisma.spares_master.findMany({
            where: {
                spare_name: {
                    contains: options.spareName,
                    mode: 'insensitive'
                }
            },
            select: { id: true }
        });

        if (matchingSpares.length === 0) {
            return {
                records: [],
                pagination: {
                    page,
                    limit,
                    total: 0,
                    totalPages: 0
                }
            };
        }

        whereClause.spare_master_id = {
            in: matchingSpares.map((spare) => spare.id)
        };
    }

    const total = await prisma.spares_stock_transactions.count({ where: whereClause });

    const txns = await prisma.spares_stock_transactions.findMany({
        where: whereClause,
        include: {
            spare_master: true,
            user: { select: { username: true } }
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit
    });

    const govtReferenceIds = [...new Set(txns
        .filter((txn) => txn.reference_type?.includes('GOVT_BORE') && txn.reference_id)
        .map((txn) => txn.reference_id))];

    const govtBores = govtReferenceIds.length > 0
        ? await prisma.borewellWork.findMany({
            where: { id: { in: govtReferenceIds } },
            include: { village: true },
        })
        : [];

    const boreReferenceMap = new Map(govtBores.map((record) => [record.id, record.village?.name || record.location || `Govt Bore #${record.id}`]));

    const records = txns.map(t => ({
        id: t.id,
        spare_id: t.spare_master_id,
        spare_type: t.spare_master.category,
        spare_number: t.spare_master.spare_name,
        quantity: parseFloat(t.quantity || 0),
        transaction_type: t.transaction_type,
        bore_reference: t.reference_type?.includes('GOVT_BORE') ? (boreReferenceMap.get(t.reference_id) || `Govt Bore #${t.reference_id}`) : null,
        vehicle_name: t.vehicle_name,
        supervisor_name: t.supervisor_name,
        remarks: t.remarks,
        created_by_name: t.user?.username || 'System',
        created_at: t.created_at
    }));

    return {
        records,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
};

// =============================================
// DIESEL SERVICE (ERP ORM)
// =============================================

const DIESEL_REFERENCE_TYPES = ['INVENTORY_ENTRY', 'GOVT_BORE'];
const DIESEL_REFILL_TYPES = ['REFILL', 'ADD'];
const DIESEL_CONSUMPTION_TYPES = ['CONSUMPTION', 'ISSUE'];

const isRefillTransaction = (type) => DIESEL_REFILL_TYPES.includes(type);
const isConsumptionTransaction = (type) => DIESEL_CONSUMPTION_TYPES.includes(type);

const parseDecimal = (value, fallback = 0) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const getOrCreateDieselMaster = async (tx) => {
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
    } else if (!master.stock) {
        await tx.diesel_stock.create({
            data: { diesel_master_id: master.id, available_quantity: 0 }
        });

        master = await tx.diesel_master.findUnique({
            where: { id: master.id },
            include: { stock: true }
        });
    }

    return master;
};

const getVehicleAliases = (vehicle) => {
    const fromDefault = DEFAULT_DIESEL_VEHICLES.find(
        (item) => normalizeVehicleKey(item.vehicle_number) === normalizeVehicleKey(vehicle.vehicle_number)
            || normalizeVehicleKey(item.truck_type) === normalizeVehicleKey(vehicle.truck_type)
    );

    return [...new Set([
        vehicle.vehicle_number,
        vehicle.truck_type,
        ...(fromDefault?.aliases || []),
    ].filter(Boolean))];
};

const getActiveDieselVehicles = async (tx) => {
    try {
        const rows = await tx.diesel_vehicle_master.findMany({
            where: { is_active: true },
            orderBy: [{ vehicle_number: 'asc' }],
        });

        if (rows.length > 0) {
            return rows.map((row) => ({
                id: row.id,
                fallback_id: null,
                vehicle_number: row.vehicle_number,
                truck_type: row.truck_type,
                tank_capacity: parseDecimal(row.tank_capacity, 0),
            }));
        }
    } catch (error) {
        console.warn('[Inventory - Diesel] Vehicle mapping table unavailable:', error.message);
    }

    return [];
};

const resolveMappedDieselVehicle = async (tx, vehicleInput, { required = true } = {}) => {
    const inputKey = normalizeVehicleKey(vehicleInput);
    if (!inputKey) {
        if (required) {
            throw new Error('Vehicle is required. Select a configured truck vehicle number.');
        }
        return null;
    }

    const vehicles = await getActiveDieselVehicles(tx);

    const matched = vehicles.find((vehicle) => {
        const aliasKeys = getVehicleAliases(vehicle).map(normalizeVehicleKey);
        return aliasKeys.includes(inputKey);
    });

    if (!matched && required) {
        throw new Error(`Vehicle "${vehicleInput}" is not configured in diesel mapping.`);
    }

    return matched || null;
};

const getVehicleCurrentFuel = async (tx, vehicle) => {
    const aliases = getVehicleAliases(vehicle);
    const vehicleWhere = vehicle.id
        ? [
            { diesel_vehicle_id: vehicle.id },
            {
                diesel_vehicle_id: null,
                vehicle_name: { in: aliases },
            },
        ]
        : [
            { vehicle_name: { in: aliases } },
        ];

    const txns = await tx.diesel_stock_transactions.findMany({
        where: {
            reference_type: { in: DIESEL_REFERENCE_TYPES },
            OR: vehicleWhere,
        },
        select: {
            transaction_type: true,
            quantity: true,
        },
    });

    return txns.reduce((sum, txn) => {
        const qty = parseDecimal(txn.quantity, 0);
        if (isRefillTransaction(txn.transaction_type)) return sum + qty;
        if (isConsumptionTransaction(txn.transaction_type)) return sum - qty;
        return sum;
    }, 0);
};

const getGlobalDieselAvailable = async (tx, dieselMasterId) => {
    const stock = await tx.diesel_stock.findUnique({ where: { diesel_master_id: dieselMasterId } });
    return parseDecimal(stock?.available_quantity, 0);
};

const ensureFuelWithinBounds = (value, vehicle) => {
    const capacity = parseDecimal(vehicle.tank_capacity, 0);
    if (value < -0.0001) {
        throw new Error(`Vehicle ${vehicle.vehicle_number} has insufficient diesel.`);
    }
    if (value > capacity + 0.0001) {
        throw new Error(`Vehicle ${vehicle.vehicle_number} cannot exceed tank capacity (${capacity.toFixed(2)} L).`);
    }
};

const getDieselBoreReferenceMap = async (txns) => {
    const govtReferenceIds = [...new Set(txns
        .filter((txn) => txn.reference_type === 'GOVT_BORE' && txn.reference_id)
        .map((txn) => txn.reference_id))];

    if (govtReferenceIds.length === 0) {
        return new Map();
    }

    const govtBores = await prisma.borewellWork.findMany({
        where: { id: { in: govtReferenceIds } },
        include: { village: true },
    });

    return new Map(govtBores.map((record) => [
        record.id,
        record.village?.name || record.location || `Govt Bore #${record.id}`,
    ]));
};

export const getAllDieselRecords = async (filters = {}) => {
    try {
        await ensureInventorySchema();
    } catch (error) {
        console.warn('[Inventory - Diesel] Schema ensure failed for list API. Continuing with compatibility mode:', error.message);
    }
    const page = Math.max(parseInt(filters.page || 1, 10), 1);
    const limit = Math.min(Math.max(parseInt(filters.limit || 10, 10), 1), 100);
    const skip = (page - 1) * limit;

    const whereClause = { reference_type: { in: DIESEL_REFERENCE_TYPES } };

    if (filters?.startDate) whereClause.created_at = { ...whereClause.created_at, gte: new Date(filters.startDate) };
    if (filters?.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        whereClause.created_at = { ...whereClause.created_at, lte: endDate };
    }
    if (filters?.vehicleNumber) whereClause.vehicle_name = { contains: filters.vehicleNumber, mode: 'insensitive' };
    if (filters?.supervisor) whereClause.supervisor_name = { contains: filters.supervisor, mode: 'insensitive' };

    if (filters?.transactionType) {
        const upperType = String(filters.transactionType).toUpperCase();
        if (upperType === 'REFILL') {
            whereClause.transaction_type = { in: DIESEL_REFILL_TYPES };
        } else if (upperType === 'CONSUMPTION') {
            whereClause.transaction_type = { in: DIESEL_CONSUMPTION_TYPES };
        }
    }

    if (filters?.truckType) {
        const matchedVehicles = await prisma.diesel_vehicle_master.findMany({
            where: {
                is_active: true,
                truck_type: {
                    contains: filters.truckType,
                    mode: 'insensitive'
                }
            },
            select: {
                id: true,
                vehicle_number: true
            }
        });

        if (matchedVehicles.length === 0) {
            return {
                records: [],
                pagination: {
                    page,
                    limit,
                    total: 0,
                    totalPages: 0
                }
            };
        }

        whereClause.OR = [
            {
                diesel_vehicle_id: {
                    in: matchedVehicles.map((vehicle) => vehicle.id)
                }
            },
            {
                vehicle_name: {
                    in: matchedVehicles.map((vehicle) => vehicle.vehicle_number)
                }
            }
        ];
    }

    const total = await prisma.diesel_stock_transactions.count({ where: whereClause });

    const txns = await prisma.diesel_stock_transactions.findMany({
        where: whereClause,
        include: { user: { select: { username: true } } },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit
    });

    const vehicles = await prisma.$transaction(async (tx) => getActiveDieselVehicles(tx));
    const vehicleById = new Map(vehicles.filter((vehicle) => vehicle.id).map((vehicle) => [vehicle.id, vehicle]));
    const resolveVehicleFromName = (vehicleName) => {
        const key = normalizeVehicleKey(vehicleName);
        if (!key) return null;
        return vehicles.find((vehicle) => getVehicleAliases(vehicle).map(normalizeVehicleKey).includes(key)) || null;
    };

    const boreReferenceMap = await getDieselBoreReferenceMap(txns);

    const records = txns.map(t => ({
        id: t.id,
        vehicle_name: ((t.diesel_vehicle_id ? vehicleById.get(t.diesel_vehicle_id) : null) || resolveVehicleFromName(t.vehicle_name))?.vehicle_number || t.vehicle_name,
        truck_type: ((t.diesel_vehicle_id ? vehicleById.get(t.diesel_vehicle_id) : null) || resolveVehicleFromName(t.vehicle_name))?.truck_type || null,
        tank_capacity: ((t.diesel_vehicle_id ? vehicleById.get(t.diesel_vehicle_id) : null) || resolveVehicleFromName(t.vehicle_name))?.tank_capacity || null,
        purchase_date: t.created_at,
        supervisor_name: t.supervisor_name,
        amount: t.amount,
        liters: t.quantity,
        bill_url: t.bill_url,
        remarks: t.remarks,
        transaction_type: isRefillTransaction(t.transaction_type) ? 'REFILL' : (isConsumptionTransaction(t.transaction_type) ? 'CONSUMPTION' : t.transaction_type),
        source_destination: isRefillTransaction(t.transaction_type)
            ? 'Fuel Station → Truck'
            : (isConsumptionTransaction(t.transaction_type) ? 'Truck → Bore Operation' : '—'),
        record_source: t.reference_type === 'GOVT_BORE' ? 'GOVT_BORE' : 'MANUAL',
        bore_reference: t.reference_type === 'GOVT_BORE'
            ? (boreReferenceMap.get(t.reference_id) || `Govt Bore #${t.reference_id}`)
            : null,
        is_auto_synced: t.reference_type === 'GOVT_BORE',
        created_by_name: t.user?.username || 'System',
        created_at: t.created_at
    }));

    return {
        records,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
};

export const addDieselRecord = async (data, userId) => {
    await ensureInventorySchema();
    return await prisma.$transaction(async (tx) => {
        const master = await getOrCreateDieselMaster(tx);
        const vehicleInput = data.truck_type || data.vehicle_name;
        const vehicle = await resolveMappedDieselVehicle(tx, vehicleInput, { required: true });
        const quantity = parseDecimal(data.liters, 0);

        if (quantity <= 0) {
            throw new Error('Liters must be greater than zero for diesel refill.');
        }

        const currentFuel = await getVehicleCurrentFuel(tx, vehicle);
        ensureFuelWithinBounds(currentFuel + quantity, vehicle);

        await tx.diesel_stock.update({
            where: { diesel_master_id: master.id },
            data: { available_quantity: { increment: quantity } }
        });

        const record = await tx.diesel_stock_transactions.create({
            data: {
                diesel_master_id: master.id,
                ...(vehicle.id ? { diesel_vehicle_id: vehicle.id } : {}),
                transaction_type: 'REFILL',
                quantity: quantity,
                reference_type: 'INVENTORY_ENTRY',
                vehicle_name: vehicle.vehicle_number,
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
            liters: record.quantity,
            truck_type: vehicle.truck_type,
            tank_capacity: vehicle.tank_capacity
        };
    });
};

export const updateDieselRecord = async (id, data) => {
    await ensureInventorySchema();
    return await prisma.$transaction(async (tx) => {
        const record = await tx.diesel_stock_transactions.findUnique({ where: { id: parseInt(id) } });
        if (!record) throw new Error('Diesel record not found');
        if (record.reference_type !== 'INVENTORY_ENTRY') {
            throw new Error('Govt bore synced diesel records must be updated from the govt bore record.');
        }

        const oldQuantity = parseDecimal(record.quantity, 0);
        const newQuantity = data.liters !== undefined && data.liters !== null && data.liters !== ''
            ? parseDecimal(data.liters, 0)
            : oldQuantity;

        if (newQuantity < 0) {
            throw new Error('Liters cannot be negative.');
        }

        const existingVehicle = record.diesel_vehicle_id
            ? (await tx.diesel_vehicle_master.findUnique({ where: { id: record.diesel_vehicle_id } }).catch(() => null))
            : await resolveMappedDieselVehicle(tx, record.vehicle_name, { required: false });
        const nextVehicleInput = data.truck_type || data.vehicle_name || record.vehicle_name;
        const nextVehicle = await resolveMappedDieselVehicle(tx, nextVehicleInput, { required: true });

        if (!existingVehicle) {
            throw new Error('Existing diesel record is not linked to a configured vehicle. Update is not allowed.');
        }

        if (existingVehicle.id === nextVehicle.id) {
            const currentFuel = await getVehicleCurrentFuel(tx, existingVehicle);
            ensureFuelWithinBounds(currentFuel - oldQuantity + newQuantity, existingVehicle);
        } else {
            const currentOldVehicleFuel = await getVehicleCurrentFuel(tx, existingVehicle);
            const currentNextVehicleFuel = await getVehicleCurrentFuel(tx, nextVehicle);
            ensureFuelWithinBounds(currentOldVehicleFuel - oldQuantity, existingVehicle);
            ensureFuelWithinBounds(currentNextVehicleFuel + newQuantity, nextVehicle);
        }

        const difference = newQuantity - oldQuantity;
        const master = await getOrCreateDieselMaster(tx);

        if (difference > 0.0001) {
            const globalAvailable = await getGlobalDieselAvailable(tx, master.id);
            if (globalAvailable + 0.0001 < difference) {
                throw new Error(`Insufficient main diesel stock. Available ${globalAvailable.toFixed(2)} L, required ${difference.toFixed(2)} L.`);
            }
        }

        if (Math.abs(difference) > 0.0001) {
            await tx.diesel_stock.update({
                where: { diesel_master_id: master.id },
                data: { available_quantity: { increment: difference } }
            });
        }

        const updated = await tx.diesel_stock_transactions.update({
            where: { id: record.id },
            data: {
                ...(nextVehicle.id ? { diesel_vehicle_id: nextVehicle.id } : {}),
                vehicle_name: nextVehicle.vehicle_number,
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
    await ensureInventorySchema();
    return await prisma.$transaction(async (tx) => {
        const record = await tx.diesel_stock_transactions.findUnique({ where: { id: parseInt(id) } });
        if (!record) throw new Error('Diesel record not found');
        if (record.reference_type !== 'INVENTORY_ENTRY') {
            throw new Error('Govt bore synced diesel records must be removed from the govt bore record.');
        }

        const quantity = parseDecimal(record.quantity, 0);
        const vehicle = record.diesel_vehicle_id
            ? (await tx.diesel_vehicle_master.findUnique({ where: { id: record.diesel_vehicle_id } }).catch(() => null))
            : await resolveMappedDieselVehicle(tx, record.vehicle_name, { required: false });

        if (!vehicle) {
            throw new Error('Diesel record is not linked to a configured vehicle. Delete is not allowed.');
        }

        const currentFuel = await getVehicleCurrentFuel(tx, vehicle);
        ensureFuelWithinBounds(currentFuel - quantity, vehicle);

        const master = await getOrCreateDieselMaster(tx);
        const globalAvailable = await getGlobalDieselAvailable(tx, master.id);
        if (globalAvailable + 0.0001 < quantity) {
            throw new Error(`Cannot delete record because main diesel stock would go below zero.`);
        }

        await tx.diesel_stock.update({
            where: { diesel_master_id: master.id },
            data: { available_quantity: { decrement: quantity } }
        });

        return await tx.diesel_stock_transactions.delete({ where: { id: record.id } });
    });
};

export const getDieselVehicleStatus = async () => {
    try {
        await ensureInventorySchema();
    } catch (error) {
        console.warn('[Inventory - Diesel] Schema ensure failed for vehicle status API. Continuing with compatibility mode:', error.message);
    }
    return await prisma.$transaction(async (tx) => {
        const vehicles = await getActiveDieselVehicles(tx);

        const withStatus = await Promise.all(vehicles.map(async (vehicle) => {
            const currentFuel = await getVehicleCurrentFuel(tx, vehicle);
            const tankCapacity = parseDecimal(vehicle.tank_capacity, 0);
            const safeFuel = Math.max(0, Math.min(currentFuel, tankCapacity));
            const percentage = tankCapacity > 0 ? (safeFuel / tankCapacity) * 100 : 0;

            const aliases = getVehicleAliases(vehicle);
            const refillWhere = {
                reference_type: { in: DIESEL_REFERENCE_TYPES },
                transaction_type: { in: DIESEL_REFILL_TYPES },
                OR: [
                    { diesel_vehicle_id: vehicle.id || -1 },
                    { vehicle_name: { in: aliases } },
                ],
            };

            const [latestRefill, refillAggregate] = await Promise.all([
                tx.diesel_stock_transactions.findFirst({
                    where: refillWhere,
                    orderBy: { created_at: 'desc' },
                    select: { created_at: true },
                }),
                tx.diesel_stock_transactions.aggregate({
                    where: refillWhere,
                    _sum: {
                        quantity: true,
                        amount: true,
                    },
                }),
            ]);

            return {
                id: vehicle.id || vehicle.fallback_id,
                vehicle_number: vehicle.vehicle_number,
                truck_type: vehicle.truck_type,
                tank_capacity: tankCapacity,
                current_fuel: safeFuel,
                tank_percentage: Number(Math.max(0, Math.min(percentage, 100)).toFixed(2)),
                latest_purchase_date: latestRefill?.created_at || null,
                total_liters: parseDecimal(refillAggregate?._sum?.quantity, 0),
                total_cost: parseDecimal(refillAggregate?._sum?.amount, 0),
            };
        }));

        return withStatus;
    });
};

export const createDieselVehicle = async (data) => {
    await ensureInventorySchema();

    const truckType = String(data.truck_type || '').trim();
    const vehicleNumber = String(data.vehicle_number || '').trim();
    const tankCapacity = parseDecimal(data.tank_capacity, NaN);

    if (!truckType || !vehicleNumber || !Number.isFinite(tankCapacity) || tankCapacity <= 0) {
        throw new Error('Truck type, vehicle number, and positive tank capacity are required.');
    }

    return await prisma.$transaction(async (tx) => {
        const existing = await tx.diesel_vehicle_master.findFirst({
            where: {
                OR: [
                    { vehicle_number: { equals: vehicleNumber, mode: 'insensitive' } },
                    { truck_type: { equals: truckType, mode: 'insensitive' } },
                ],
            },
        });

        if (existing) {
            throw new Error('Truck type or vehicle number already exists in diesel vehicles.');
        }

        const created = await tx.diesel_vehicle_master.create({
            data: {
                truck_type: truckType,
                vehicle_number: vehicleNumber,
                tank_capacity: tankCapacity,
                is_active: true,
            },
        });

        return {
            id: created.id,
            truck_type: created.truck_type,
            vehicle_number: created.vehicle_number,
            tank_capacity: parseDecimal(created.tank_capacity, 0),
            current_fuel: 0,
            tank_percentage: 0,
        };
    });
};

export const deleteDieselVehicle = async (id) => {
    await ensureInventorySchema();

    return await prisma.$transaction(async (tx) => {
        const vehicleId = parseInt(id, 10);
        if (!Number.isInteger(vehicleId)) {
            throw new Error('Invalid diesel vehicle ID.');
        }

        const vehicle = await tx.diesel_vehicle_master.findUnique({
            where: { id: vehicleId },
        });

        if (!vehicle || !vehicle.is_active) {
            throw new Error('Diesel vehicle not found.');
        }

        const aliases = getVehicleAliases(vehicle);

        const dieselTxnCount = await tx.diesel_stock_transactions.count({
            where: {
                OR: [
                    { diesel_vehicle_id: vehicle.id },
                    { vehicle_name: { in: aliases } },
                ],
            },
        });

        const govtBoreCount = await tx.borewellWork.count({
            where: {
                OR: aliases.map((alias) => ({ vehicle: { equals: alias, mode: 'insensitive' } })),
            },
        });

        const privateBoreCount = tx.borewell_data?.count
            ? await tx.borewell_data.count({
                where: {
                    OR: aliases.map((alias) => ({ vehicle_name: { equals: alias, mode: 'insensitive' } })),
                },
            })
            : 0;

        if (dieselTxnCount > 0 || govtBoreCount > 0 || privateBoreCount > 0) {
            throw new Error('This truck cannot be deleted because it has related diesel transactions or bore records.');
        }

        await tx.diesel_vehicle_master.update({
            where: { id: vehicle.id },
            data: { is_active: false },
        });

        return { success: true };
    });
};

export const getDieselSummary = async (startDate, endDate) => {
    await ensureInventorySchema();
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
    await reconcileGovtBoreAllocationStatuses(prisma);

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
        const lengthFeet = parseFloat(p.length_feet || 20) || 20;
        const pipeCount = lengthFeet > 0 ? qty / lengthFeet : 0;
        totalPipeStock += qty;
        totalPipeValue += pipeCount * cost;
        if (pipeCount > 0 && pipeCount < (p.reorder_level || 10)) {
            lowStockPipes++;
        }
    });

    const openPipeAllocations = await prisma.pipe_bore_allocations.findMany({ where: { status: 'OPEN' } });
    totalPipeInUse = openPipeAllocations.reduce((sum, allocation) => {
        return sum + (parseFloat(allocation.issued_quantity || 0) - parseFloat(allocation.returned_quantity || 0));
    }, 0);

    // Spares summary
    await ensureDefaultSpares(prisma);
    const spares = await prisma.spares_master.findMany({
        where: { is_active: true },
        include: {
            stock: true,
            allocations: {
                where: { status: 'OPEN', bore_type: 'govt' }
            }
        }
    });

    let totalSpares = spares.length;
    let sparesStocked = 0;
    let sparesOutOfStock = 0;
    let sparesLowStock = 0;
    let totalSparesValue = 0;
    let totalAllocatedSpares = 0;
    spares.forEach(s => {
        const qty = parseFloat(s.stock?.available_quantity || 0);
        const cost = parseFloat(s.cost_per_unit || 0);
        totalSparesValue += qty * cost;
        totalAllocatedSpares += (s.allocations || []).reduce((sum, allocation) => sum + (parseFloat(allocation.issued_quantity || 0) - parseFloat(allocation.returned_quantity || 0)), 0);
        if (qty > 0) sparesStocked++;
        else sparesOutOfStock++;
        if (qty > 0 && qty <= (s.reorder_level || 5)) sparesLowStock++;
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
            available: sparesStocked,
            in_use: sparesOutOfStock,
            stocked: sparesStocked,
            out_of_stock: sparesOutOfStock,
            low_stock: sparesLowStock,
            total_allocated_qty: totalAllocatedSpares,
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
    addSpareStock,
    issueSpareToVehicle,
    returnSpareToHome,
    updateSpareStatus,
    deleteSpare,
    getSparesTransactions,
    getAllDieselRecords,
    addDieselRecord,
    updateDieselRecord,
    deleteDieselRecord,
    createDieselVehicle,
    deleteDieselVehicle,
    getDieselSummary,
    getInventorySummary
};
