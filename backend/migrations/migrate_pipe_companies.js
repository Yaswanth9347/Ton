import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
    console.log('[Migration] Starting Pipe Companies Normalization...');

    try {
        // Step 1: Seed the Constants
        const companiesToSeed = ['Nandi', 'Sudhakar (G1)', 'Sudhakar (G2)'];

        console.log('[Migration] Seeding companies:', companiesToSeed);

        for (const company of companiesToSeed) {
            await prisma.pipes_company_master.upsert({
                where: { company_name: company },
                update: {}, // Do nothing if it exists
                create: { company_name: company, is_active: true }
            });
        }

        console.log('[Migration] Companies seeded successfully.');

        // Step 2: Fetch mapping of name -> ID
        const allCompanies = await prisma.pipes_company_master.findMany();
        const companyMap = {};
        allCompanies.forEach(c => {
            companyMap[c.company_name] = c.id;
        });

        console.log('[Migration] Company Memory Map:', companyMap);

        // Step 3: Backfill BorewellWork
        console.log('[Migration] Fetching Historical Borewell Works...');

        const works = await prisma.borewellWork.findMany({
            where: {
                pipe_company: { not: null },
                pipe_company_id: null
            }
        });

        console.log(`[Migration] Found ${works.length} BorewellWorks needing backfill.`);

        let updatedCount = 0;
        for (const work of works) {
            const companyName = work.pipe_company;
            const targetId = companyMap[companyName];

            if (targetId) {
                await prisma.borewellWork.update({
                    where: { id: work.id },
                    data: {
                        pipe_company_id: targetId,
                        // Keep pipe_company string for safety temporarily
                    }
                });
                updatedCount++;
            } else {
                console.warn(`[Migration] Warning: Could not find company ID for legacy string "${companyName}" on Bore ID: ${work.id}. You may need to seed this company manually.`);
            }
        }

        console.log(`[Migration] Backfilled ${updatedCount} out of ${works.length} historical records.`);
        console.log('[Migration] Migration Completed Successfully.');

    } catch (e) {
        console.error('[Migration] Failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

run();
