import prisma from '../config/prisma.js';
import { ensureInventorySchema } from '../utils/ensureInventorySchema.js';
import { DEFAULT_DIESEL_VEHICLES, normalizeVehicleKey } from '../constants/defaultDieselVehicles.js';

const parseDecimal = (value, fallback = 0) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const DIESEL_REFILL_TYPES = ['REFILL', 'ADD'];
const DIESEL_CONSUMPTION_TYPES = ['CONSUMPTION', 'ISSUE'];

const isRefillTransaction = (type) => DIESEL_REFILL_TYPES.includes(type);
const isConsumptionTransaction = (type) => DIESEL_CONSUMPTION_TYPES.includes(type);

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

const resolveMappedDieselVehicle = async (tx, vehicleInput, { required = true } = {}) => {
    const inputKey = normalizeVehicleKey(vehicleInput);
    if (!inputKey) {
        if (required) {
            throw new Error('Vehicle is required for govt bore diesel allocation.');
        }
        return null;
    }

    const vehicles = await tx.diesel_vehicle_master.findMany({
        where: { is_active: true },
        orderBy: [{ vehicle_number: 'asc' }],
    });

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
    const txns = await tx.diesel_stock_transactions.findMany({
        where: {
            reference_type: { in: ['INVENTORY_ENTRY', 'GOVT_BORE'] },
            OR: [
                { diesel_vehicle_id: vehicle.id },
                {
                    diesel_vehicle_id: null,
                    vehicle_name: { in: aliases },
                },
            ],
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

const ensureFuelWithinBounds = (value, vehicle) => {
    const capacity = parseDecimal(vehicle.tank_capacity, 0);
    if (value < -0.0001) {
        throw new Error(`Insufficient diesel in vehicle ${vehicle.vehicle_number}.`);
    }
    if (value > capacity + 0.0001) {
        throw new Error(`Vehicle ${vehicle.vehicle_number} cannot exceed tank capacity (${capacity.toFixed(2)} L).`);
    }
};

const GOVT_STATUS_CONSUMPTION_ELIGIBLE = ['started', 'operational', 'to be recording', 'done', 'completed'];

const normalizeGovtStatus = (status) => (status || '').toString().trim().toLowerCase();

const shouldConsumeForGovtStatus = (status) => Boolean(status && GOVT_STATUS_CONSUMPTION_ELIGIBLE.includes(normalizeGovtStatus(status)));

const getBoreReference = (record, boreId) => record?.village?.name || record?.location || `Govt Bore #${boreId}`;

const getOrCreateDieselMaster = async (tx) => {
    let master = await tx.diesel_master.findFirst({
        where: { storage_location: 'Main Tank' },
        include: { stock: true },
    });

    if (!master) {
        master = await tx.diesel_master.create({
            data: {
                storage_location: 'Main Tank',
                unit: 'liters',
                stock: { create: { available_quantity: 0 } },
            },
            include: { stock: true },
        });
    } else if (!master.stock) {
        await tx.diesel_stock.create({
            data: {
                diesel_master_id: master.id,
                available_quantity: 0,
            },
        });

        master = await tx.diesel_master.findUnique({
            where: { id: master.id },
            include: { stock: true },
        });
    }

    return master;
};

const getGovtBoreDieselTransaction = async (tx, boreId) => tx.diesel_stock_transactions.findFirst({
    where: {
        reference_type: 'GOVT_BORE',
        reference_id: parseInt(boreId),
    },
    orderBy: { id: 'desc' },
});

const ensureSufficientDiesel = async (tx, dieselMasterId, requiredQuantity) => {
    const stock = await tx.diesel_stock.findUnique({
        where: { diesel_master_id: dieselMasterId },
    });

    const available = parseDecimal(stock?.available_quantity);
    if (available + 0.0001 < requiredQuantity) {
        throw new Error(`Insufficient diesel stock. Available ${available.toFixed(2)} L, required ${requiredQuantity.toFixed(2)} L.`);
    }
};

export const releaseGovtBoreDieselAllocation = async ({
    tx = prisma,
    boreId,
    createdBy,
    remarks,
}) => {
    await ensureInventorySchema();
    const transaction = await getGovtBoreDieselTransaction(tx, boreId);
    if (!transaction) return null;

    const quantity = parseDecimal(transaction.quantity);
    if (quantity > 0) {
        await tx.diesel_stock.update({
            where: { diesel_master_id: transaction.diesel_master_id },
            data: { available_quantity: { increment: quantity } },
        });
    }

    await tx.diesel_stock_transactions.delete({ where: { id: transaction.id } });

    return {
        restored_quantity: quantity,
        restored_by: createdBy || null,
        remarks: remarks || null,
    };
};

export const syncGovtBoreDieselInventory = async ({
    tx = prisma,
    currentRecord,
    previousRecord = null,
    createdBy,
}) => {
    await ensureInventorySchema();

    const boreId = currentRecord?.id || previousRecord?.id;
    if (!boreId) return null;

    const currentStatus = currentRecord?.status || null;
    const previousStatus = previousRecord?.status || null;
    const currentEligible = shouldConsumeForGovtStatus(currentStatus);
    const previousEligible = shouldConsumeForGovtStatus(previousStatus);
    const desiredLiters = currentEligible ? parseDecimal(currentRecord?.diesel_liters) : 0;

    if ((!currentEligible || desiredLiters <= 0.0001) && previousEligible) {
        await releaseGovtBoreDieselAllocation({
            tx,
            boreId,
            createdBy,
            remarks: `Auto-restored diesel after govt bore #${boreId} changed to ${currentStatus || 'Pending'}`,
        });
        return null;
    }

    if (!currentEligible || desiredLiters <= 0.0001) {
        const existing = await getGovtBoreDieselTransaction(tx, boreId);
        if (existing) {
            await releaseGovtBoreDieselAllocation({
                tx,
                boreId,
                createdBy,
                remarks: `Auto-restored diesel after govt bore #${boreId} removed diesel usage`,
            });
        }
        return null;
    }

    const master = await getOrCreateDieselMaster(tx);
    const existing = await getGovtBoreDieselTransaction(tx, boreId);
    const previousLiters = parseDecimal(existing?.quantity);
    const delta = desiredLiters - previousLiters;
    const boreReference = getBoreReference(currentRecord || previousRecord, boreId);
    const usageDate = currentRecord?.material_date || currentRecord?.date || existing?.created_at || new Date();
    const amount = currentRecord?.diesel_amount !== undefined && currentRecord?.diesel_amount !== null && currentRecord?.diesel_amount !== ''
        ? parseFloat(currentRecord.diesel_amount)
        : null;
    const rate = currentRecord?.diesel_rate !== undefined && currentRecord?.diesel_rate !== null && currentRecord?.diesel_rate !== ''
        ? parseFloat(currentRecord.diesel_rate)
        : null;
    const selectedVehicle = currentRecord?.vehicle || previousRecord?.vehicle || existing?.vehicle_name || null;
    const mappedVehicle = await resolveMappedDieselVehicle(tx, selectedVehicle, { required: true });
    const existingVehicle = existing?.diesel_vehicle_id
        ? await tx.diesel_vehicle_master.findUnique({ where: { id: existing.diesel_vehicle_id } })
        : await resolveMappedDieselVehicle(tx, existing?.vehicle_name, { required: false });
    const vehicleName = mappedVehicle.vehicle_number;
    const supervisorName = currentRecord?.location || previousRecord?.location || null;
    const remarks = [
        `Auto-consumed diesel for ${boreReference}`,
        rate !== null ? `Rate ₹${rate.toFixed(2)}/L` : null,
    ].filter(Boolean).join(' · ');

    if (existing && existingVehicle && existingVehicle.id !== mappedVehicle.id) {
        const oldCurrentFuel = await getVehicleCurrentFuel(tx, existingVehicle);
        const newCurrentFuel = await getVehicleCurrentFuel(tx, mappedVehicle);
        ensureFuelWithinBounds(oldCurrentFuel + previousLiters, existingVehicle);
        ensureFuelWithinBounds(newCurrentFuel - desiredLiters, mappedVehicle);
    } else if (existing) {
        const currentFuel = await getVehicleCurrentFuel(tx, mappedVehicle);
        ensureFuelWithinBounds(currentFuel + previousLiters - desiredLiters, mappedVehicle);
    } else {
        const currentFuel = await getVehicleCurrentFuel(tx, mappedVehicle);
        ensureFuelWithinBounds(currentFuel - desiredLiters, mappedVehicle);
    }

    if (delta > 0.0001) {
        await ensureSufficientDiesel(tx, master.id, delta);
        await tx.diesel_stock.update({
            where: { diesel_master_id: master.id },
            data: { available_quantity: { decrement: delta } },
        });
    } else if (delta < -0.0001) {
        await tx.diesel_stock.update({
            where: { diesel_master_id: master.id },
            data: { available_quantity: { increment: Math.abs(delta) } },
        });
    }

    if (existing) {
        await tx.diesel_stock_transactions.update({
            where: { id: existing.id },
            data: {
                diesel_vehicle_id: mappedVehicle.id,
                transaction_type: 'CONSUMPTION',
                quantity: desiredLiters,
                amount,
                vehicle_name: vehicleName,
                supervisor_name: supervisorName,
                remarks,
                created_at: new Date(usageDate),
            },
        });
        return existing.id;
    }

    const transaction = await tx.diesel_stock_transactions.create({
        data: {
            diesel_master_id: master.id,
            diesel_vehicle_id: mappedVehicle.id,
            transaction_type: 'CONSUMPTION',
            quantity: desiredLiters,
            reference_type: 'GOVT_BORE',
            reference_id: parseInt(boreId),
            created_by: createdBy || 1,
            created_at: new Date(usageDate),
            remarks,
            vehicle_name: vehicleName,
            supervisor_name: supervisorName,
            amount,
        },
    });

    return transaction.id;
};