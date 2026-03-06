import 'dotenv/config';
import prisma from '../src/config/prisma.js';

async function main() {
    const before = {
        pipes: await prisma.pipes_master.count(),
        pipeStock: await prisma.pipes_stock.count(),
        pipeTransactions: await prisma.pipes_stock_transactions.count(),
        pipeAllocations: await prisma.pipe_bore_allocations.count(),
        spares: await prisma.spares_master.count(),
        spareStock: await prisma.spares_stock.count(),
        spareTransactions: await prisma.spares_stock_transactions.count(),
        dieselMasters: await prisma.diesel_master.count(),
        dieselStock: await prisma.diesel_stock.count(),
        dieselTransactions: await prisma.diesel_stock_transactions.count(),
        privateBoreLinks: await prisma.borewell_data.count({ where: { pipe_inventory_id: { not: null } } }),
        govtBoreLinks: await prisma.borewellWork.count({ where: { pipe_inventory_id: { not: null } } })
    };

    await prisma.$transaction(async (tx) => {
        await tx.borewell_data.updateMany({
            where: { pipe_inventory_id: { not: null } },
            data: { pipe_inventory_id: null }
        });

        await tx.borewellWork.updateMany({
            where: { pipe_inventory_id: { not: null } },
            data: { pipe_inventory_id: null }
        });

        await tx.pipes_stock_transactions.deleteMany({});
        await tx.pipe_bore_allocations.deleteMany({});
        await tx.pipes_stock.deleteMany({});
        await tx.pipes_master.deleteMany({});

        await tx.spares_stock_transactions.deleteMany({});
        await tx.spares_stock.deleteMany({});
        await tx.spares_master.deleteMany({});

        await tx.diesel_stock_transactions.deleteMany({});
        await tx.diesel_stock.updateMany({ data: { available_quantity: 0 } });
    });

    const after = {
        pipes: await prisma.pipes_master.count(),
        pipeStock: await prisma.pipes_stock.count(),
        pipeTransactions: await prisma.pipes_stock_transactions.count(),
        pipeAllocations: await prisma.pipe_bore_allocations.count(),
        spares: await prisma.spares_master.count(),
        spareStock: await prisma.spares_stock.count(),
        spareTransactions: await prisma.spares_stock_transactions.count(),
        dieselMasters: await prisma.diesel_master.count(),
        dieselStock: await prisma.diesel_stock.count(),
        dieselTransactions: await prisma.diesel_stock_transactions.count(),
        privateBoreLinks: await prisma.borewell_data.count({ where: { pipe_inventory_id: { not: null } } }),
        govtBoreLinks: await prisma.borewellWork.count({ where: { pipe_inventory_id: { not: null } } })
    };

    console.log(JSON.stringify({ before, after }, null, 2));
}

main()
    .catch((error) => {
        console.error('Inventory reset failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
