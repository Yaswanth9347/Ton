import prisma from '../config/prisma.js';
import { ensureInventorySchema } from '../utils/ensureInventorySchema.js';
import { ensureDefaultSpares } from '../utils/ensureDefaultSpares.js';
import { DEFAULT_GOVT_SPARE_MATERIALS } from '../constants/defaultSpareMaterials.js';

const parseDecimal = (value, fallback = 0) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const GOVT_STATUS_ISSUE_ELIGIBLE = ['To be recording', 'Done', 'Completed'];

const shouldIssueForGovtStatus = (status) => Boolean(status && GOVT_STATUS_ISSUE_ELIGIBLE.includes(status));
const isGovtStatusActive = (status) => status === 'To be recording';
const isGovtStatusClosed = (status) => status === 'Done' || status === 'Completed';

const resolveBoreWhere = (boreType, boreId) => {
    if (boreType === 'private') {
        return { bore_type: 'private', private_bore_id: parseInt(boreId), govt_bore_id: null };
    }
    return { bore_type: 'govt', govt_bore_id: parseInt(boreId), private_bore_id: null };
};

const getBoreReference = (record, boreType, boreId) => {
    if (boreType === 'govt') {
        return record?.village?.name || record?.location || `Govt Bore #${boreId}`;
    }
    return record?.customer_name || `Private Bore #${boreId}`;
};

const getSpareMasters = async (tx) => {
    await ensureDefaultSpares(tx);
    const masters = await tx.spares_master.findMany({
        where: {
            is_active: true,
            OR: DEFAULT_GOVT_SPARE_MATERIALS.map((item) => ({
                spare_name: item.spare_name,
                category: item.category,
            })),
        },
        include: { stock: true },
    });

    return new Map(masters.map((item) => [item.spare_name, item]));
};

const buildDesiredMaterialMap = async (tx, record, { eligible }) => {
    const mastersByName = await getSpareMasters(tx);
    const desired = new Map();

    if (!eligible || !record) {
        return desired;
    }

    for (const item of DEFAULT_GOVT_SPARE_MATERIALS) {
        const quantity = parseDecimal(record[item.syncKey]);
        if (quantity <= 0) continue;

        const spareMaster = mastersByName.get(item.spare_name);
        if (!spareMaster) {
            throw new Error(`Default spare material "${item.spare_name}" is missing from inventory.`);
        }

        desired.set(spareMaster.id, {
            spareMaster,
            quantity,
        });
    }

    return desired;
};

const getSpareAllocation = async (tx, { spareMasterId, boreType, boreId }) => {
    return tx.spare_bore_allocations.findFirst({
        where: {
            spare_master_id: parseInt(spareMasterId),
            ...resolveBoreWhere(boreType, boreId),
        },
    });
};

const createSpareTransaction = async (tx, data) => tx.spares_stock_transactions.create({
    data: {
        spare_master_id: data.spareMasterId,
        transaction_type: data.transactionType,
        quantity: data.quantity,
        reference_type: data.referenceType,
        reference_id: data.referenceId || null,
        created_by: data.createdBy,
        remarks: data.remarks || null,
        vehicle_name: data.vehicleName || null,
        supervisor_name: data.supervisorName || null,
    },
});

export const issueSpareAllocation = async ({
    tx = prisma,
    spareMasterId,
    boreType,
    boreId,
    quantity,
    createdBy,
    remarks,
    vehicleName,
    supervisorName,
    autoCreated = false,
}) => {
    await ensureInventorySchema();
    const spare = await tx.spares_master.findUnique({
        where: { id: parseInt(spareMasterId) },
        include: { stock: true },
    });

    if (!spare) throw new Error('Spare inventory item not found');

    const qty = parseDecimal(quantity);
    if (qty <= 0) throw new Error('Issue quantity must be greater than 0');

    const available = parseDecimal(spare.stock?.available_quantity);
    if (available < qty) {
        throw new Error(`Insufficient stock for ${spare.spare_name}. Available ${available}, requested ${qty}.`);
    }

    let allocation = await getSpareAllocation(tx, { spareMasterId, boreType, boreId });
    if (allocation) {
        allocation = await tx.spare_bore_allocations.update({
            where: { id: allocation.id },
            data: {
                issued_quantity: { increment: qty },
                status: 'OPEN',
                auto_created: autoCreated || allocation.auto_created,
            },
        });
    } else {
        allocation = await tx.spare_bore_allocations.create({
            data: {
                spare_master_id: parseInt(spareMasterId),
                ...resolveBoreWhere(boreType, boreId),
                issued_quantity: qty,
                returned_quantity: 0,
                status: 'OPEN',
                auto_created: autoCreated,
                created_by: createdBy || null,
            },
        });
    }

    await tx.spares_stock.update({
        where: { spare_master_id: parseInt(spareMasterId) },
        data: { available_quantity: { decrement: qty } },
    });

    await createSpareTransaction(tx, {
        spareMasterId: parseInt(spareMasterId),
        transactionType: 'ISSUE',
        quantity: qty,
        referenceType: boreType === 'govt' ? 'GOVT_BORE' : 'PRIVATE_BORE',
        referenceId: parseInt(boreId),
        createdBy,
        remarks: remarks || `Issued to ${boreType} bore #${boreId}`,
        vehicleName,
        supervisorName,
    });

    return allocation;
};

export const returnSpareAllocation = async ({
    tx = prisma,
    allocationId,
    quantity,
    createdBy,
    remarks,
    vehicleName,
    supervisorName,
}) => {
    await ensureInventorySchema();
    const allocation = await tx.spare_bore_allocations.findUnique({
        where: { id: parseInt(allocationId) },
        include: {
            spare_master: { include: { stock: true } },
        },
    });

    if (!allocation) throw new Error('Spare allocation not found');

    const qty = parseDecimal(quantity);
    if (qty <= 0) throw new Error('Return quantity must be greater than 0');

    const openBalance = parseDecimal(allocation.issued_quantity) - parseDecimal(allocation.returned_quantity);
    if (qty > openBalance + 0.0001) {
        throw new Error(`Return quantity exceeds open balance for ${allocation.spare_master.spare_name}.`);
    }

    const updated = await tx.spare_bore_allocations.update({
        where: { id: allocation.id },
        data: {
            returned_quantity: { increment: qty },
            status: openBalance - qty <= 0.0001 ? 'CLOSED' : allocation.status,
        },
    });

    await tx.spares_stock.update({
        where: { spare_master_id: allocation.spare_master_id },
        data: { available_quantity: { increment: qty } },
    });

    await createSpareTransaction(tx, {
        spareMasterId: allocation.spare_master_id,
        transactionType: 'RETURN',
        quantity: qty,
        referenceType: allocation.bore_type === 'govt' ? 'GOVT_BORE_RETURN' : 'PRIVATE_BORE_RETURN',
        referenceId: allocation.govt_bore_id || allocation.private_bore_id,
        createdBy,
        remarks: remarks || `Returned from ${allocation.bore_type} bore #${allocation.govt_bore_id || allocation.private_bore_id}`,
        vehicleName,
        supervisorName,
    });

    return updated;
};

export const releaseBoreSpareAllocations = async ({
    tx = prisma,
    boreType,
    boreId,
    spareMasterId = null,
    createdBy,
    remarks,
    vehicleName,
    supervisorName,
}) => {
    await ensureInventorySchema();
    const allocations = await tx.spare_bore_allocations.findMany({
        where: {
            ...resolveBoreWhere(boreType, boreId),
            ...(spareMasterId ? { spare_master_id: parseInt(spareMasterId) } : {}),
        },
        include: {
            spare_master: true,
        },
    });

    for (const allocation of allocations) {
        const openBalance = parseDecimal(allocation.issued_quantity) - parseDecimal(allocation.returned_quantity);
        if (openBalance <= 0.0001) continue;

        await returnSpareAllocation({
            tx,
            allocationId: allocation.id,
            quantity: openBalance,
            createdBy,
            remarks: remarks || `Auto-restored after ${boreType} bore change`,
            vehicleName,
            supervisorName,
        });
    }
};

export const syncGovtBoreSpareInventory = async ({ tx = prisma, currentRecord, previousRecord = null, createdBy }) => {
    await ensureInventorySchema();
    const boreId = currentRecord?.id || previousRecord?.id;
    if (!boreId) return null;

    const currentStatus = currentRecord?.status || null;
    const previousStatus = previousRecord?.status || null;
    const currentEligible = shouldIssueForGovtStatus(currentStatus);
    const previousEligible = shouldIssueForGovtStatus(previousStatus);

    const boreReference = getBoreReference(currentRecord || previousRecord, 'govt', boreId);
    const vehicleName = currentRecord?.vehicle || previousRecord?.vehicle || null;
    const supervisorName = currentRecord?.location || previousRecord?.location || null;

    if (!currentEligible && previousEligible) {
        await releaseBoreSpareAllocations({
            tx,
            boreType: 'govt',
            boreId,
            createdBy,
            remarks: `Auto-restored after govt bore #${boreId} reverted to ${currentStatus || 'Pending'}`,
            vehicleName,
            supervisorName,
        });
        return null;
    }

    if (!currentEligible && !previousEligible) {
        return null;
    }

    const currentDesired = await buildDesiredMaterialMap(tx, currentRecord, { eligible: currentEligible });
    const previousDesired = await buildDesiredMaterialMap(tx, previousRecord, { eligible: previousEligible });

    const spareIds = new Set([...currentDesired.keys(), ...previousDesired.keys()]);

    for (const spareId of spareIds) {
        const currentItem = currentDesired.get(spareId);
        const previousItem = previousDesired.get(spareId);
        const currentQty = parseDecimal(currentItem?.quantity);
        const previousQty = parseDecimal(previousItem?.quantity);
        const delta = currentQty - previousQty;
        const spareName = currentItem?.spareMaster?.spare_name || previousItem?.spareMaster?.spare_name || 'Material';

        if (delta > 0.0001) {
            await issueSpareAllocation({
                tx,
                spareMasterId: spareId,
                boreType: 'govt',
                boreId,
                quantity: delta,
                createdBy,
                remarks: `Auto-issued ${spareName} for ${boreReference}`,
                vehicleName,
                supervisorName,
                autoCreated: true,
            });
        } else if (delta < -0.0001) {
            const allocation = await getSpareAllocation(tx, { spareMasterId: spareId, boreType: 'govt', boreId });
            if (allocation) {
                await returnSpareAllocation({
                    tx,
                    allocationId: allocation.id,
                    quantity: Math.abs(delta),
                    createdBy,
                    remarks: `Auto-restored ${spareName} after update on ${boreReference}`,
                    vehicleName,
                    supervisorName,
                });
            }
        }
    }

    if (isGovtStatusClosed(currentStatus)) {
        await tx.spare_bore_allocations.updateMany({
            where: {
                bore_type: 'govt',
                govt_bore_id: parseInt(boreId),
            },
            data: { status: 'CLOSED' },
        });
    } else if (isGovtStatusActive(currentStatus)) {
        await tx.spare_bore_allocations.updateMany({
            where: {
                bore_type: 'govt',
                govt_bore_id: parseInt(boreId),
            },
            data: { status: 'OPEN' },
        });
    }

    return true;
};
