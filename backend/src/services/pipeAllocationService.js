import prisma from '../config/prisma.js';

const MAIN_STORE = 'MAIN_STORE';

const toVehicleLocation = (vehicleName) => vehicleName ? `VEHICLE:${vehicleName}` : 'VEHICLE:UNASSIGNED';

const parseDecimal = (value, fallback = 0) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const getPipeLengthFeet = (pipeMaster) => parseDecimal(pipeMaster?.length_feet, 20);

const resolveBoreWhere = (boreType, boreId) => {
    if (boreType === 'private') {
        return { bore_type: 'private', private_bore_id: parseInt(boreId), govt_bore_id: null };
    }
    return { bore_type: 'govt', govt_bore_id: parseInt(boreId), private_bore_id: null };
};

const getIssueFeetFromRecord = (boreType, record, pipeMaster) => {
    if (!record?.pipe_inventory_id) return 0;
    const lengthFeet = getPipeLengthFeet(pipeMaster);
    if (boreType === 'private') {
        return parseDecimal(record.pipes_on_vehicle_before) * lengthFeet;
    }
    return parseDecimal(record.gi_pipes_qty) * lengthFeet;
};

/**
 * For govt bores with status "Done"/"Completed", compute how many feet
 * the user says were returned to the store (gi_pipes_returned_qty * length_feet).
 * This drives the returned_quantity on the allocation.
 */
const getReturnFeetFromRecord = (boreType, record, pipeMaster) => {
    if (boreType !== 'govt') return 0;
    if (!record?.pipe_inventory_id) return 0;
    const status = record?.status;
    if (status !== 'Done' && status !== 'Completed') return 0;
    const lengthFeet = getPipeLengthFeet(pipeMaster);
    return parseDecimal(record.gi_pipes_returned_qty) * lengthFeet;
};

/**
 * Status-based inventory thresholds for govt bores.
 * - Pending / null / empty  → no inventory movement
 * - "To be recording"       → issue pipes from store to vehicle
 * - "Done"                  → operation complete; returned pipes should go back
 * - "Completed"             → finalized, no further changes
 */
const GOVT_STATUS_ISSUE_ELIGIBLE = ['To be recording', 'Done', 'Completed'];
const shouldIssueForGovtStatus = (status) => {
    if (!status) return false;
    return GOVT_STATUS_ISSUE_ELIGIBLE.includes(status);
};

const isGovtStatusActive = (status) => status === 'To be recording';
const isGovtStatusClosed = (status) => status === 'Done' || status === 'Completed';

export const reconcileGovtBoreAllocationStatuses = async (tx = prisma) => {
    await tx.$executeRawUnsafe(`
        UPDATE pipe_bore_allocations AS pba
        SET status = 'CLOSED', updated_at = NOW()
        FROM "BorewellWork" AS bw
        WHERE pba.govt_bore_id = bw.id
          AND pba.status = 'OPEN'
          AND bw.status IN ('Done', 'Completed')
    `);
};

const getPipeMasterWithStock = async (tx, pipeMasterId) => {
    const pipeMaster = await tx.pipes_master.findUnique({
        where: { id: parseInt(pipeMasterId) },
        include: { stock: true }
    });
    if (!pipeMaster) throw new Error('Pipe inventory item not found');
    return pipeMaster;
};

const createPipeTransaction = async (tx, data) => {
    return tx.pipes_stock_transactions.create({
        data: {
            pipe_master_id: data.pipeMasterId,
            transaction_type: data.transactionType,
            quantity: data.quantity,
            reference_type: data.referenceType,
            reference_id: data.referenceId,
            created_by: data.createdBy,
            remarks: data.remarks || null,
            vehicle_name: data.vehicleName || null,
            supervisor_name: data.supervisorName || null,
            source_location: data.sourceLocation || MAIN_STORE,
            destination_location: data.destinationLocation || null,
            supplier_name: data.supplierName || null,
            purchase_mode: data.purchaseMode || null,
            allocation_id: data.allocationId || null
        }
    });
};

export const issuePipeAllocation = async ({
    tx = prisma,
    pipeMasterId,
    boreType,
    boreId,
    quantity,
    unit = 'feet',
    vehicleName,
    supervisorName,
    createdBy,
    remarks,
    autoCreated = false,
    transactionType = 'LOAD'
}) => {
    const pipeMaster = await getPipeMasterWithStock(tx, pipeMasterId);
    const quantityFeet = unit === 'feet' ? parseDecimal(quantity) : parseDecimal(quantity) * getPipeLengthFeet(pipeMaster);
    if (quantityFeet <= 0) {
        throw new Error('Issue quantity must be greater than 0');
    }

    // Pessimistic lock: SELECT ... FOR UPDATE to prevent concurrent stock races
    const lockedStock = await tx.$queryRawUnsafe(
        `SELECT available_quantity FROM pipes_stock WHERE pipe_master_id = $1 FOR UPDATE`,
        parseInt(pipeMasterId)
    );
    const currentStock = lockedStock.length > 0 ? parseDecimal(lockedStock[0].available_quantity) : 0;
    if (currentStock < quantityFeet) {
        throw new Error(`Insufficient store stock. Available ${currentStock.toFixed(2)} ft, requested ${quantityFeet.toFixed(2)} ft.`);
    }

    const boreWhere = resolveBoreWhere(boreType, boreId);
    let allocation = await tx.pipe_bore_allocations.findFirst({
        where: {
            pipe_master_id: parseInt(pipeMasterId),
            ...boreWhere
        }
    });

    if (allocation) {
        allocation = await tx.pipe_bore_allocations.update({
            where: { id: allocation.id },
            data: {
                issued_quantity: { increment: quantityFeet },
                vehicle_name: vehicleName || allocation.vehicle_name,
                supervisor_name: supervisorName || allocation.supervisor_name,
                destination_location: toVehicleLocation(vehicleName || allocation.vehicle_name),
                status: 'OPEN',
                auto_created: autoCreated || allocation.auto_created
            }
        });
    } else {
        allocation = await tx.pipe_bore_allocations.create({
            data: {
                pipe_master_id: parseInt(pipeMasterId),
                ...boreWhere,
                vehicle_name: vehicleName || null,
                supervisor_name: supervisorName || null,
                issued_quantity: quantityFeet,
                returned_quantity: 0,
                source_location: MAIN_STORE,
                destination_location: toVehicleLocation(vehicleName),
                status: 'OPEN',
                auto_created: autoCreated,
                created_by: createdBy || null
            }
        });
    }

    await tx.pipes_stock.update({
        where: { pipe_master_id: parseInt(pipeMasterId) },
        data: { available_quantity: { decrement: quantityFeet } }
    });

    await createPipeTransaction(tx, {
        pipeMasterId: parseInt(pipeMasterId),
        transactionType,
        quantity: quantityFeet,
        referenceType: boreType === 'govt' ? 'GOVT_BORE' : 'PRIVATE_BORE',
        referenceId: parseInt(boreId),
        createdBy,
        remarks: remarks || `Issued from store to ${vehicleName || 'vehicle'} for ${boreType} bore #${boreId}`,
        vehicleName,
        supervisorName,
        sourceLocation: MAIN_STORE,
        destinationLocation: toVehicleLocation(vehicleName),
        allocationId: allocation.id
    });

    return allocation;
};

export const returnPipeAllocation = async ({
    tx = prisma,
    allocationId,
    quantity,
    unit = 'feet',
    createdBy,
    remarks,
    closeIfFullyReturned = true
}) => {
    const allocation = await tx.pipe_bore_allocations.findUnique({
        where: { id: parseInt(allocationId) },
        include: { pipe_master: { include: { stock: true } } }
    });

    if (!allocation) throw new Error('Pipe allocation not found');

    const quantityFeet = unit === 'feet'
        ? parseDecimal(quantity)
        : parseDecimal(quantity) * getPipeLengthFeet(allocation.pipe_master);

    if (quantityFeet <= 0) throw new Error('Return quantity must be greater than 0');

    const openBalance = parseDecimal(allocation.issued_quantity) - parseDecimal(allocation.returned_quantity);
    if (quantityFeet > openBalance) {
        throw new Error(`Return quantity exceeds open balance. Open balance: ${openBalance.toFixed(2)} ft.`);
    }

    const updatedAllocation = await tx.pipe_bore_allocations.update({
        where: { id: allocation.id },
        data: {
            returned_quantity: { increment: quantityFeet },
            status: closeIfFullyReturned && Math.abs(openBalance - quantityFeet) < 0.0001 ? 'CLOSED' : allocation.status
        }
    });

    await tx.pipes_stock.update({
        where: { pipe_master_id: allocation.pipe_master_id },
        data: { available_quantity: { increment: quantityFeet } }
    });

    await createPipeTransaction(tx, {
        pipeMasterId: allocation.pipe_master_id,
        transactionType: 'RETURN',
        quantity: quantityFeet,
        referenceType: allocation.bore_type === 'govt' ? 'GOVT_BORE_RETURN' : 'PRIVATE_BORE_RETURN',
        referenceId: allocation.govt_bore_id || allocation.private_bore_id,
        createdBy,
        remarks: remarks || `Returned from ${allocation.vehicle_name || 'vehicle'} to store`,
        vehicleName: allocation.vehicle_name,
        supervisorName: allocation.supervisor_name,
        sourceLocation: allocation.destination_location || toVehicleLocation(allocation.vehicle_name),
        destinationLocation: MAIN_STORE,
        allocationId: allocation.id
    });

    if (closeIfFullyReturned) {
        const refreshed = await tx.pipe_bore_allocations.findUnique({ where: { id: allocation.id } });
        const remaining = parseDecimal(refreshed.issued_quantity) - parseDecimal(refreshed.returned_quantity);
        if (remaining <= 0.0001 && refreshed.status !== 'CLOSED') {
            await tx.pipe_bore_allocations.update({
                where: { id: refreshed.id },
                data: { status: 'CLOSED' }
            });
        }
    }

    return updatedAllocation;
};

export const releaseBorePipeAllocations = async ({ tx = prisma, boreType, boreId, pipeMasterId = null, createdBy, remarks }) => {
    const allocations = await tx.pipe_bore_allocations.findMany({
        where: {
            ...resolveBoreWhere(boreType, boreId),
            status: 'OPEN',
            ...(pipeMasterId ? { pipe_master_id: parseInt(pipeMasterId) } : {})
        },
        include: { pipe_master: true }
    });

    for (const allocation of allocations) {
        const openBalance = parseDecimal(allocation.issued_quantity) - parseDecimal(allocation.returned_quantity);
        if (openBalance <= 0) continue;
        await returnPipeAllocation({
            tx,
            allocationId: allocation.id,
            quantity: openBalance,
            unit: 'feet',
            createdBy,
            remarks: remarks || `Auto-released back to store after ${boreType} bore change`
        });
    }
}

const updateAllocationVehicleOnly = async ({ tx = prisma, boreType, boreId, pipeMasterId, vehicleName, supervisorName }) => {
    const allocation = await tx.pipe_bore_allocations.findFirst({
        where: {
            pipe_master_id: parseInt(pipeMasterId),
            ...resolveBoreWhere(boreType, boreId)
        }
    });

    if (!allocation) return null;

    return tx.pipe_bore_allocations.update({
        where: { id: allocation.id },
        data: {
            vehicle_name: vehicleName || allocation.vehicle_name,
            supervisor_name: supervisorName || allocation.supervisor_name,
            destination_location: toVehicleLocation(vehicleName || allocation.vehicle_name)
        }
    });
};

const updateAllocationStatus = async ({ tx = prisma, boreType, boreId, pipeMasterId, status }) => {
    const where = {
        ...resolveBoreWhere(boreType, boreId),
        ...(pipeMasterId ? { pipe_master_id: parseInt(pipeMasterId) } : {})
    };

    await tx.pipe_bore_allocations.updateMany({
        where,
        data: { status }
    });
};

/**
 * Process pipe returns based on the gi_pipes_returned_qty field.
 * Only active for govt bores when status = Done / Completed.
 * Compares the desired returned feet with what's already been returned
 * on the allocation and processes the delta.
 */
const processReturnFromRecord = async ({ tx, boreType, boreId, currentRecord, currentPipeMaster, createdBy }) => {
    const desiredReturnFeet = getReturnFeetFromRecord(boreType, currentRecord, currentPipeMaster);
    if (desiredReturnFeet <= 0) return;

    const currentPipeId = parseInt(currentRecord.pipe_inventory_id);
    const allocation = await tx.pipe_bore_allocations.findFirst({
        where: {
            pipe_master_id: currentPipeId,
            ...resolveBoreWhere(boreType, boreId),
            status: 'OPEN'
        }
    });

    if (!allocation) return;

    const alreadyReturned = parseDecimal(allocation.returned_quantity);
    const returnDelta = desiredReturnFeet - alreadyReturned;

    if (returnDelta > 0.0001) {
        // Return more pipes to store
        const openBalance = parseDecimal(allocation.issued_quantity) - alreadyReturned;
        const actualReturn = Math.min(returnDelta, openBalance); // Can't return more than open balance
        if (actualReturn > 0.0001) {
            await returnPipeAllocation({
                tx,
                allocationId: allocation.id,
                quantity: actualReturn,
                unit: 'feet',
                createdBy,
                remarks: `Pipes returned to store after ${boreType} bore #${boreId} marked Done`,
                closeIfFullyReturned: true
            });
        }
    }
    // Note: if returnDelta < 0 (returned qty reduced), we don't re-issue.
    // Once physically returned to store, the quantity stays. User should adjust gi_pipes_qty instead.
};

const syncBorePipeInventoryInternal = async ({ tx = prisma, boreType, boreId, currentRecord, previousRecord, createdBy }) => {
    const currentPipeId = currentRecord?.pipe_inventory_id ? parseInt(currentRecord.pipe_inventory_id) : null;
    const previousPipeId = previousRecord?.pipe_inventory_id ? parseInt(previousRecord.pipe_inventory_id) : null;

    // --- STATUS-BASED GUARD FOR GOVT BORES ---
    // For govt bores: inventory only moves when status is "To be recording" or later.
    // Pending / null / empty  ⇒ no inventory movement at all.
    if (boreType === 'govt') {
        const currentStatus = currentRecord?.status || null;
        const previousStatus = previousRecord?.status || null;
        const currentEligible = shouldIssueForGovtStatus(currentStatus);
        const previousEligible = shouldIssueForGovtStatus(previousStatus);

        // If moving FROM an eligible status to a non-eligible status (shouldn't normally happen, but be safe)
        if (!currentEligible && previousEligible && previousPipeId) {
            await releaseBorePipeAllocations({
                tx, boreType, boreId, pipeMasterId: previousPipeId, createdBy,
                remarks: `Auto-returned: govt bore #${boreId} status reverted to ${currentStatus || 'Pending'}`
            });
            return null;
        }

        // If not yet eligible, skip all inventory work
        if (!currentEligible) {
            return null;
        }

        // If transitioning TO eligible for the first time (Pending → To be recording),
        // previousRecord existed but wasn't eligible, so previousIssuedFeet should be 0
        if (!previousEligible && currentEligible && previousPipeId === currentPipeId) {
            // Treat as fresh issue: previousIssuedFeet = 0
        }
    }

    const currentPipeMaster = currentPipeId ? await getPipeMasterWithStock(tx, currentPipeId) : null;
    const previousPipeMaster = previousPipeId && previousPipeId !== currentPipeId
        ? await getPipeMasterWithStock(tx, previousPipeId)
        : currentPipeMaster;

    const desiredIssuedFeet = currentPipeId ? getIssueFeetFromRecord(boreType, currentRecord, currentPipeMaster) : 0;

    // For govt bores, only count previous issued if the previous status was eligible
    let previousIssuedFeet = 0;
    if (previousPipeId) {
        if (boreType === 'govt') {
            const prevStatusEligible = shouldIssueForGovtStatus(previousRecord?.status);
            previousIssuedFeet = prevStatusEligible ? getIssueFeetFromRecord(boreType, previousRecord, previousPipeMaster) : 0;
        } else {
            previousIssuedFeet = getIssueFeetFromRecord(boreType, previousRecord, previousPipeMaster);
        }
    }

    // If pipe type changed, release old allocations
    if (previousPipeId && previousPipeId !== currentPipeId) {
        await releaseBorePipeAllocations({
            tx,
            boreType,
            boreId,
            pipeMasterId: previousPipeId,
            createdBy,
            remarks: `Auto-returned after changing pipe inventory for ${boreType} bore #${boreId}`
        });
    }

    // If no pipe selected or zero quantity, release everything
    if (!currentPipeId || desiredIssuedFeet <= 0) {
        if (previousPipeId && previousIssuedFeet > 0) {
            await releaseBorePipeAllocations({
                tx,
                boreType,
                boreId,
                pipeMasterId: previousPipeId,
                createdBy,
                remarks: `Auto-returned because no pipe allocation remains for ${boreType} bore #${boreId}`
            });
        }
        return null;
    }

    // Same pipe: calculate delta
    if (previousPipeId === currentPipeId) {
        const deltaFeet = desiredIssuedFeet - previousIssuedFeet;
        if (deltaFeet > 0.0001) {
            // Adjustment: use ISSUE for mid-job quantity increases (not initial LOAD)
            await issuePipeAllocation({
                tx,
                pipeMasterId: currentPipeId,
                boreType,
                boreId,
                quantity: deltaFeet,
                unit: 'feet',
                vehicleName: currentRecord.vehicle || currentRecord.vehicle_name,
                supervisorName: currentRecord.location || currentRecord.supervisor_name,
                createdBy,
                remarks: `Adjustment: increased pipe qty on ${boreType} bore #${boreId}`,
                autoCreated: true,
                transactionType: previousIssuedFeet > 0 ? 'ISSUE' : 'LOAD'
            });
        } else if (deltaFeet < -0.0001) {
            const allocation = await tx.pipe_bore_allocations.findFirst({
                where: {
                    pipe_master_id: currentPipeId,
                    ...resolveBoreWhere(boreType, boreId)
                }
            });
            if (allocation) {
                await returnPipeAllocation({
                    tx,
                    allocationId: allocation.id,
                    quantity: Math.abs(deltaFeet),
                    unit: 'feet',
                    createdBy,
                    remarks: `Auto-returned after ${boreType} bore update #${boreId}`
                });
            }
        } else {
            await updateAllocationVehicleOnly({
                tx,
                boreType,
                boreId,
                pipeMasterId: currentPipeId,
                vehicleName: currentRecord.vehicle || currentRecord.vehicle_name,
                supervisorName: currentRecord.location || currentRecord.supervisor_name
            });

            if (boreType === 'govt' && isGovtStatusActive(currentRecord?.status)) {
                await updateAllocationStatus({
                    tx,
                    boreType,
                    boreId,
                    pipeMasterId: currentPipeId,
                    status: 'OPEN'
                });
            }
        }

        // --- HANDLE PIPE RETURNS (govt Done/Completed) ---
        await processReturnFromRecord({ tx, boreType, boreId, currentRecord, currentPipeMaster, createdBy });

        if (boreType === 'govt' && isGovtStatusClosed(currentRecord?.status)) {
            await updateAllocationStatus({
                tx,
                boreType,
                boreId,
                pipeMasterId: currentPipeId,
                status: 'CLOSED'
            });
        }

        return true;
    }

    // New pipe type: issue full quantity
    await issuePipeAllocation({
        tx,
        pipeMasterId: currentPipeId,
        boreType,
        boreId,
        quantity: desiredIssuedFeet,
        unit: 'feet',
        vehicleName: currentRecord.vehicle || currentRecord.vehicle_name,
        supervisorName: currentRecord.location || currentRecord.supervisor_name,
        createdBy,
        remarks: `Auto-issued on ${boreType} bore creation #${boreId}`,
        autoCreated: true
    });

    // --- HANDLE PIPE RETURNS (govt Done/Completed) ---
    await processReturnFromRecord({ tx, boreType, boreId, currentRecord, currentPipeMaster, createdBy });

    if (boreType === 'govt' && isGovtStatusClosed(currentRecord?.status)) {
        await updateAllocationStatus({
            tx,
            boreType,
            boreId,
            pipeMasterId: currentPipeId,
            status: 'CLOSED'
        });
    }

    return true;
};

export const syncPrivateBorePipeInventory = async ({ tx, currentRecord, previousRecord = null, createdBy }) => {
    const boreId = currentRecord?.id || previousRecord?.id;
    if (!boreId) return null;
    return syncBorePipeInventoryInternal({
        tx: tx || prisma,
        boreType: 'private',
        boreId,
        currentRecord,
        previousRecord,
        createdBy
    });
};

export const syncGovtBorePipeInventory = async ({ tx, currentRecord, previousRecord = null, createdBy }) => {
    const boreId = currentRecord?.id || previousRecord?.id;
    if (!boreId) return null;
    return syncBorePipeInventoryInternal({
        tx: tx || prisma,
        boreType: 'govt',
        boreId,
        currentRecord,
        previousRecord,
        createdBy
    });
};

export const getOpenPipeAllocations = async () => {
    await reconcileGovtBoreAllocationStatuses(prisma);

    const allocations = await prisma.pipe_bore_allocations.findMany({
        where: { status: 'OPEN' },
        include: {
            pipe_master: true,
            private_bore: true,
            govt_bore: {
                include: { village: true, mandal: true }
            }
        },
        orderBy: { created_at: 'desc' }
    });

    return allocations.map((allocation) => {
        const openFeet = parseDecimal(allocation.issued_quantity) - parseDecimal(allocation.returned_quantity);
        return {
            id: allocation.id,
            bore_type: allocation.bore_type,
            bore_id: allocation.private_bore_id || allocation.govt_bore_id,
            vehicle_name: allocation.vehicle_name,
            supervisor_name: allocation.supervisor_name,
            pipe_inventory_id: allocation.pipe_master_id,
            pipe_company: allocation.pipe_master?.pipe_type_name,
            pipe_size: allocation.pipe_master?.pipe_size,
            length_feet: parseDecimal(allocation.pipe_master?.length_feet, 20),
            issued_quantity: parseDecimal(allocation.issued_quantity),
            returned_quantity: parseDecimal(allocation.returned_quantity),
            open_quantity: openFeet,
            destination_location: allocation.destination_location,
            source_location: allocation.source_location,
            created_at: allocation.created_at,
            bore_reference: allocation.bore_type === 'private'
                ? allocation.private_bore?.customer_name || `Private Bore #${allocation.private_bore_id}`
                : allocation.govt_bore?.village?.name || allocation.govt_bore?.location || `Govt Bore #${allocation.govt_bore_id}`
        };
    });
};
