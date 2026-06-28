import prisma from '../config/prisma.js';

let payrollSchemaReady = false;
let payrollSchemaPromise = null;

export function resetPayrollSchemaCache() {
    payrollSchemaReady = false;
    payrollSchemaPromise = null;
}

/**
 * Ensure default payroll rules exist in the database.
 * No DDL (table creations/modifications) is executed at runtime; that is handled by Prisma.
 */
export async function ensurePayrollSchema() {
    if (payrollSchemaReady) {
        return true;
    }

    if (payrollSchemaPromise) {
        return payrollSchemaPromise;
    }

    payrollSchemaPromise = (async () => {
        try {
            // One-time status migration
            await prisma.payroll.updateMany({
                where: { status: 'generated' },
                data: { status: 'DRAFT' },
            });

            // Ensure default overtime rule exists
            const ruleCount = await prisma.overtime_rules.count();
            if (ruleCount === 0) {
                await prisma.overtime_rules.create({
                    data: {
                        name: 'Default',
                        regular_hours_per_day: 8.0,
                        overtime_multiplier: 1.5,
                        weekend_multiplier: 2.0,
                        holiday_multiplier: 2.0,
                        max_overtime_per_day: 4.0,
                        is_active: true,
                    },
                });
            }

            payrollSchemaReady = true;
            console.log('[PAYROLL] Default overtime rules verified');
            return true;
        } catch (error) {
            payrollSchemaPromise = null;
            console.error('[PAYROLL] Payroll seeding failed:', error.message);
            throw error;
        }
    })();

    return payrollSchemaPromise;
}