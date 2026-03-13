import prisma from '../config/prisma.js';
import { DEFAULT_GOVT_SPARE_MATERIALS } from '../constants/defaultSpareMaterials.js';

export const ensureDefaultSpares = async (tx = prisma) => {
    for (const item of DEFAULT_GOVT_SPARE_MATERIALS) {
        const spare = await tx.spares_master.upsert({
            where: {
                spare_name_category: {
                    spare_name: item.spare_name,
                    category: item.category,
                },
            },
            update: {
                unit_type: item.unit_type,
                reorder_level: item.reorder_level,
                is_active: true,
            },
            create: {
                spare_name: item.spare_name,
                category: item.category,
                unit: 'nos',
                description: 'Default govt bore material',
                unit_type: item.unit_type,
                reorder_level: item.reorder_level,
                cost_per_unit: 0,
                is_active: true,
            },
        });

        await tx.spares_stock.upsert({
            where: { spare_master_id: spare.id },
            update: {},
            create: {
                spare_master_id: spare.id,
                available_quantity: 0,
            },
        });
    }
};
