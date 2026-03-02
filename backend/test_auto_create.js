import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const data = { company: 'Astral Pipes API Test', size: '20 inch', unit: 'pieces', quantity: 0 };

    await prisma.$transaction(async (tx) => {
        // Mimic the new backend logic
        const existingCompany = await tx.pipes_company_master.findFirst({
            where: { company_name: { equals: data.company, mode: 'insensitive' } }
        });

        if (!existingCompany) {
            console.log(`[Test] Auto-creating new company master entry for: ${data.company}`);
            await tx.pipes_company_master.create({
                data: { company_name: data.company, is_active: true }
            });
        }

        const testPipe = await tx.pipes_master.create({
            data: {
                pipe_type_name: data.company,
                pipe_size: data.size,
                unit: data.unit || 'pieces',
                stock: { create: { available_quantity: data.quantity || 0 } }
            }
        });
        console.log(`[Test] Pipe Master id: ${testPipe.id} successfully created.`);
    });

    const updatedCompanies = await prisma.pipes_company_master.findMany();
    console.log('Total Companies Now:', updatedCompanies.length);
    console.log(updatedCompanies.map(c => c.company_name).join(', '));
}

main().catch(console.error).finally(() => prisma.$disconnect());
