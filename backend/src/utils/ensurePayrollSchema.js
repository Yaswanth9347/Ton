import db from '../models/db.js';

let payrollSchemaReady = false;
let payrollSchemaPromise = null;

const payrollSchemaStatements = [
    `
    CREATE TABLE IF NOT EXISTS payroll (
        id SERIAL PRIMARY KEY,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        status VARCHAR(20) DEFAULT 'DRAFT',
        version INTEGER DEFAULT 1,
        is_deleted BOOLEAN DEFAULT false,
        deleted_at TIMESTAMP(6),
        deleted_by INTEGER,
        cancellation_reason TEXT,
        approved_by INTEGER,
        approved_at TIMESTAMP(6),
        locked_at TIMESTAMP(6),
        reopened_by INTEGER,
        reopened_at TIMESTAMP(6),
        total_payout DECIMAL(12, 2) DEFAULT 0.00,
        generated_by INTEGER NOT NULL REFERENCES users(id),
        generated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
    )
    `,
    `
    CREATE TABLE IF NOT EXISTS payroll_items (
        id SERIAL PRIMARY KEY,
        payroll_id INTEGER NOT NULL REFERENCES payroll(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
        base_salary DECIMAL(10, 2) NOT NULL,
        present_days INTEGER NOT NULL,
        total_attendance_deduction DECIMAL(10, 2) DEFAULT 0.00,
        approved_lunch_total DECIMAL(10, 2) DEFAULT 0.00,
        gross_salary DECIMAL(10, 2) NOT NULL,
        net_salary DECIMAL(10, 2) NOT NULL,
        details JSONB,
        overtime_hours DECIMAL(6, 2) DEFAULT 0,
        overtime_amount DECIMAL(10, 2) DEFAULT 0
    )
    `,
    `
    CREATE TABLE IF NOT EXISTS overtime_rules (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        regular_hours_per_day DECIMAL(4, 2) DEFAULT 8.0,
        overtime_multiplier DECIMAL(3, 2) DEFAULT 1.5,
        weekend_multiplier DECIMAL(3, 2) DEFAULT 2.0,
        holiday_multiplier DECIMAL(3, 2) DEFAULT 2.0,
        max_overtime_per_day DECIMAL(4, 2) DEFAULT 4.0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    `,
    `
    ALTER TABLE payroll ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'DRAFT'
    `,
    `
    ALTER TABLE payroll ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1
    `,
    `
    ALTER TABLE payroll ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false
    `,
    `
    ALTER TABLE payroll ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP(6)
    `,
    `
    ALTER TABLE payroll ADD COLUMN IF NOT EXISTS deleted_by INTEGER
    `,
    `
    ALTER TABLE payroll ADD COLUMN IF NOT EXISTS cancellation_reason TEXT
    `,
    `
    ALTER TABLE payroll ADD COLUMN IF NOT EXISTS approved_by INTEGER
    `,
    `
    ALTER TABLE payroll ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP(6)
    `,
    `
    ALTER TABLE payroll ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP(6)
    `,
    `
    ALTER TABLE payroll ADD COLUMN IF NOT EXISTS reopened_by INTEGER
    `,
    `
    ALTER TABLE payroll ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMP(6)
    `,
    `
    ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS overtime_hours DECIMAL(6, 2) DEFAULT 0
    `,
    `
    ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS overtime_amount DECIMAL(10, 2) DEFAULT 0
    `,
    `
    ALTER TABLE attendance ADD COLUMN IF NOT EXISTS regular_hours DECIMAL(4, 2) DEFAULT 0
    `,
    `
    ALTER TABLE attendance ADD COLUMN IF NOT EXISTS overtime_hours DECIMAL(4, 2) DEFAULT 0
    `,
    `
    ALTER TABLE holidays ADD COLUMN IF NOT EXISTS recurrence_type VARCHAR(20) DEFAULT 'none'
    `,
    `
    ALTER TABLE holidays ADD COLUMN IF NOT EXISTS recurrence_day INTEGER
    `,
    `
    ALTER TABLE holidays ADD COLUMN IF NOT EXISTS recurrence_month INTEGER
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_payroll_month_year ON payroll(month, year)
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_payroll_items_user ON payroll_items(user_id)
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_overtime_rules_active ON overtime_rules(is_active)
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(holiday_date)
    `,
    `
    UPDATE payroll SET status = 'DRAFT' WHERE status = 'generated'
    `,
    `
    INSERT INTO overtime_rules (
        name,
        regular_hours_per_day,
        overtime_multiplier,
        weekend_multiplier,
        holiday_multiplier,
        max_overtime_per_day,
        is_active
    )
    SELECT 'Default', 8.0, 1.5, 2.0, 2.0, 4.0, true
    WHERE NOT EXISTS (SELECT 1 FROM overtime_rules)
    `,
    `
    DO $$
    BEGIN
        IF EXISTS (
            SELECT 1
            FROM information_schema.table_constraints
            WHERE table_schema = 'public'
              AND table_name = 'payroll'
              AND constraint_name = 'payroll_month_year_key'
        ) THEN
            ALTER TABLE payroll DROP CONSTRAINT payroll_month_year_key;
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.table_constraints
            WHERE table_schema = 'public'
              AND table_name = 'payroll'
              AND constraint_name = 'payroll_month_year_version_key'
        ) THEN
            ALTER TABLE payroll ADD CONSTRAINT payroll_month_year_version_key UNIQUE (month, year, version);
        END IF;
    END $$
    `,
];

export function resetPayrollSchemaCache() {
    payrollSchemaReady = false;
    payrollSchemaPromise = null;
}

export async function ensurePayrollSchema() {
    if (payrollSchemaReady) {
        return true;
    }

    if (payrollSchemaPromise) {
        return payrollSchemaPromise;
    }

    payrollSchemaPromise = (async () => {
        const client = await db.getClient();

        try {
            await client.query('BEGIN');

            for (const statement of payrollSchemaStatements) {
                await client.query(statement);
            }

            await client.query('COMMIT');
            payrollSchemaReady = true;
            console.log('[PAYROLL] Schema verified');
            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            payrollSchemaPromise = null;
            console.error('[PAYROLL] Schema setup failed:', error.message);
            throw error;
        } finally {
            client.release();
        }
    })();

    return payrollSchemaPromise;
}