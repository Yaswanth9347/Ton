import prisma from '../config/prisma.js';
import { DEFAULT_GOVT_SPARE_MATERIALS } from '../constants/defaultSpareMaterials.js';

let inventorySchemaReady = false;
let inventorySchemaPromise = null;

export function resetInventorySchemaCache() {
    inventorySchemaReady = false;
    inventorySchemaPromise = null;
}

/**
 * Ensure default inventory items exist in the database.
 * No DDL (table creations/modifications) is executed at runtime; that is handled by Prisma.
 */
export async function ensureInventorySchema() {
    if (inventorySchemaReady) {
        return true;
    }

    if (inventorySchemaPromise) {
        return inventorySchemaPromise;
    }

    inventorySchemaPromise = (async () => {
        try {
            // Seed default spare materials if they don't exist
            for (const item of DEFAULT_GOVT_SPARE_MATERIALS) {
                // Find if the spares_master record exists
                let spare = await prisma.spares_master.findFirst({
                    where: {
                        spare_name: item.spare_name,
                        category: item.category,
                    },
                });

                if (!spare) {
                    spare = await prisma.spares_master.create({
                        data: {
                            spare_name: item.spare_name,
                            category: item.category,
                            unit: 'nos',
                            description: 'Default govt bore material',
                            unit_type: item.unit_type,
                            reorder_level: item.reorder_level,
                            is_active: true,
                        },
                    });
                } else {
                    // Update existing to match default properties
                    await prisma.spares_master.update({
                        where: { id: spare.id },
                        data: {
                            unit_type: item.unit_type,
                            reorder_level: item.reorder_level,
                            is_active: true,
                        },
                    });
                }

                // Ensure a spares_stock record exists for it
                const stock = await prisma.spares_stock.findUnique({
                    where: { spare_master_id: spare.id },
                });

                if (!stock) {
                    await prisma.spares_stock.create({
                        data: {
                            spare_master_id: spare.id,
                            available_quantity: 0,
                        },
                    });
                }
            }

            inventorySchemaReady = true;
            console.log('[INVENTORY] Default spare materials seeded/verified');
            return true;
        } catch (error) {
            inventorySchemaPromise = null;
            console.error('[INVENTORY] Spares seeding failed:', error.message);
            throw error;
        }
    })();

    return inventorySchemaPromise;
}