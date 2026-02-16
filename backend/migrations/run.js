import pg from 'pg';
import dotenv from 'dotenv';
import dbConfig from '../src/config/database.js';

dotenv.config();

const { Pool } = pg;
const pool = new Pool(dbConfig);

const migrations = `
-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    role_id INTEGER NOT NULL REFERENCES roles(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create attendance table with location support
CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    attendance_date DATE NOT NULL,
    check_in TIMESTAMP,
    check_out TIMESTAMP,
    check_in_latitude DECIMAL(10, 8),
    check_in_longitude DECIMAL(11, 8),
    check_out_latitude DECIMAL(10, 8),
    check_out_longitude DECIMAL(11, 8),
    check_in_address TEXT,
    check_out_address TEXT,
    status VARCHAR(20) DEFAULT 'present',
    is_complete BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, attendance_date)
);

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER NOT NULL REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER,
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create holidays table
CREATE TABLE IF NOT EXISTS holidays (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    holiday_date DATE,
    description TEXT,
    is_recurring BOOLEAN DEFAULT false,
    recurrence_type VARCHAR(20) DEFAULT 'none',
    recurrence_day INTEGER,
    recurrence_month INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create leave_requests table
CREATE TABLE IF NOT EXISTS leave_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    leave_type VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(holiday_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_user_id ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(start_date, end_date);

-- Add profile_photo_url to users if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='profile_photo_url') THEN
        ALTER TABLE users ADD COLUMN profile_photo_url TEXT;
    END IF;
END $$;

-- Add base_salary to users if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='base_salary') THEN
        ALTER TABLE users ADD COLUMN base_salary DECIMAL(10, 2) DEFAULT 0.00;
    END IF;
END $$;

-- Add deactivated_at to users if not exists (tracks when employee was deactivated for pro-rata payroll)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='deactivated_at') THEN
        ALTER TABLE users ADD COLUMN deactivated_at TIMESTAMP;
    END IF;
END $$;

-- Create lunch_expenses table
CREATE TABLE IF NOT EXISTS lunch_expenses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    expense_date DATE NOT NULL,
    category VARCHAR(20) DEFAULT 'lunch',
    location TEXT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    receipt_url TEXT,
    remarks TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    admin_remarks TEXT,
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create payroll table
CREATE TABLE IF NOT EXISTS payroll (
    id SERIAL PRIMARY KEY,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'generated',
    total_payout DECIMAL(12, 2) DEFAULT 0.00,
    generated_by INTEGER NOT NULL REFERENCES users(id),
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(month, year)
);

-- Create payroll_items table
CREATE TABLE IF NOT EXISTS payroll_items (
    id SERIAL PRIMARY KEY,
    payroll_id INTEGER NOT NULL REFERENCES payroll(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    base_salary DECIMAL(10, 2) NOT NULL,
    present_days INTEGER NOT NULL,
    total_attendance_deduction DECIMAL(10, 2) DEFAULT 0.00,
    approved_lunch_total DECIMAL(10, 2) DEFAULT 0.00,
    gross_salary DECIMAL(10, 2) NOT NULL,
    net_salary DECIMAL(10, 2) NOT NULL,
    details JSONB
);

-- Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_lunch_expenses_user_date ON lunch_expenses(user_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_lunch_expenses_status ON lunch_expenses(status);
CREATE INDEX IF NOT EXISTS idx_payroll_month_year ON payroll(month, year);
CREATE INDEX IF NOT EXISTS idx_payroll_items_user ON payroll_items(user_id);

-- Create meal_categories table for expense limits
CREATE TABLE IF NOT EXISTS meal_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    max_amount DECIMAL(10, 2) DEFAULT 500.00,
    daily_limit DECIMAL(10, 2) DEFAULT 500.00,
    weekly_limit DECIMAL(10, 2) DEFAULT 2500.00,
    monthly_limit DECIMAL(10, 2) DEFAULT 10000.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default meal categories
INSERT INTO meal_categories (name, max_amount, daily_limit, weekly_limit, monthly_limit) VALUES
    ('breakfast', 150.00, 150.00, 750.00, 3000.00),
    ('lunch', 300.00, 300.00, 1500.00, 6000.00),
    ('dinner', 250.00, 250.00, 1250.00, 5000.00),
    ('snacks', 100.00, 100.00, 500.00, 2000.00)
ON CONFLICT (name) DO NOTHING;

-- Add recurrence columns to holidays if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='holidays' AND column_name='recurrence_type') THEN
        ALTER TABLE holidays ADD COLUMN recurrence_type VARCHAR(20) DEFAULT 'none';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='holidays' AND column_name='recurrence_day') THEN
        ALTER TABLE holidays ADD COLUMN recurrence_day INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='holidays' AND column_name='recurrence_month') THEN
        ALTER TABLE holidays ADD COLUMN recurrence_month INTEGER;
    END IF;
END $$;

-- Add category column to lunch_expenses if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lunch_expenses' AND column_name='category') THEN
        ALTER TABLE lunch_expenses ADD COLUMN category VARCHAR(20) DEFAULT 'lunch';
    END IF;
END $$;

-- Create leave_types table for different types of leaves
CREATE TABLE IF NOT EXISTS leave_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    code VARCHAR(10) NOT NULL UNIQUE,
    description TEXT,
    default_days INTEGER DEFAULT 0,
    is_paid BOOLEAN DEFAULT true,
    carry_forward BOOLEAN DEFAULT false,
    max_carry_forward INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create leave_balances table to track each employee's leave balance
CREATE TABLE IF NOT EXISTS leave_balances (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    leave_type_id INTEGER NOT NULL REFERENCES leave_types(id),
    year INTEGER NOT NULL,
    allocated_days DECIMAL(4, 1) DEFAULT 0,
    used_days DECIMAL(4, 1) DEFAULT 0,
    pending_days DECIMAL(4, 1) DEFAULT 0,
    carried_forward DECIMAL(4, 1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, leave_type_id, year)
);

-- Add leave_type_id to leave_requests if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leave_requests' AND column_name='leave_type_id') THEN
        ALTER TABLE leave_requests ADD COLUMN leave_type_id INTEGER REFERENCES leave_types(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leave_requests' AND column_name='days_count') THEN
        ALTER TABLE leave_requests ADD COLUMN days_count DECIMAL(4, 1) DEFAULT 1;
    END IF;
END $$;

-- Insert default leave types
INSERT INTO leave_types (name, code, description, default_days, is_paid, carry_forward, max_carry_forward) VALUES
    ('Casual Leave', 'CL', 'For personal matters and emergencies', 12, true, false, 0),
    ('Sick Leave', 'SL', 'For medical reasons with or without documentation', 12, true, true, 6),
    ('Earned Leave', 'EL', 'Privilege leave earned based on service', 15, true, true, 30),
    ('Loss of Pay', 'LOP', 'Unpaid leave when other leaves exhausted', 0, false, false, 0),
    ('Maternity Leave', 'ML', 'For expecting mothers', 180, true, false, 0),
    ('Paternity Leave', 'PL', 'For new fathers', 15, true, false, 0),
    ('Compensatory Off', 'CO', 'For working on holidays/weekends', 0, true, false, 0)
ON CONFLICT (code) DO NOTHING;

-- Create indexes for leave tables
CREATE INDEX IF NOT EXISTS idx_leave_balances_user_year ON leave_balances(user_id, year);
CREATE INDEX IF NOT EXISTS idx_leave_types_code ON leave_types(code);

-- Insert default roles
INSERT INTO roles (name) VALUES ('ADMIN'), ('EMPLOYEE')
ON CONFLICT (name) DO NOTHING;

-- Phase 3: Add overtime columns to attendance
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attendance' AND column_name='regular_hours') THEN
        ALTER TABLE attendance ADD COLUMN regular_hours DECIMAL(4, 2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attendance' AND column_name='overtime_hours') THEN
        ALTER TABLE attendance ADD COLUMN overtime_hours DECIMAL(4, 2) DEFAULT 0;
    END IF;
END $$;

-- Create overtime_rules table
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
);

-- Insert default overtime rule
INSERT INTO overtime_rules (name, regular_hours_per_day, overtime_multiplier, weekend_multiplier, holiday_multiplier, max_overtime_per_day) 
VALUES ('Default', 8.0, 1.5, 2.0, 2.0, 4.0)
ON CONFLICT DO NOTHING;

-- Add overtime columns to payroll_items
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payroll_items' AND column_name='overtime_hours') THEN
        ALTER TABLE payroll_items ADD COLUMN overtime_hours DECIMAL(6, 2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payroll_items' AND column_name='overtime_amount') THEN
        ALTER TABLE payroll_items ADD COLUMN overtime_amount DECIMAL(10, 2) DEFAULT 0;
    END IF;
END $$;

-- Create index for overtime_rules
CREATE INDEX IF NOT EXISTS idx_overtime_rules_active ON overtime_rules(is_active);

-- Create govt_bores table
CREATE TABLE IF NOT EXISTS govt_bores (
    id SERIAL PRIMARY KEY,
    s_no VARCHAR(50),
    vehicle VARCHAR(100),
    bore_date DATE,
    village VARCHAR(255),
    location VARCHAR(255),
    grant_name VARCHAR(255),
    est_cost DECIMAL(12, 2),
    drill_depth DECIMAL(10, 2),
    drill_rate DECIMAL(10, 2),
    drill_amt DECIMAL(12, 2),
    cas180_depth DECIMAL(10, 2),
    cas180_rate DECIMAL(10, 2),
    cas180_amt DECIMAL(12, 2),
    cas140_depth DECIMAL(10, 2),
    cas140_rate DECIMAL(10, 2),
    cas140_amt DECIMAL(12, 2),
    slot_qty DECIMAL(10, 2),
    slot_rate DECIMAL(10, 2),
    slot_amt DECIMAL(12, 2),
    pump_rate DECIMAL(10, 2),
    gi_qty DECIMAL(10, 2),
    gi_rate DECIMAL(10, 2),
    gi_amt DECIMAL(12, 2),
    plot_farm_rate DECIMAL(10, 2),
    erection_rate DECIMAL(10, 2),
    bore_cap_rate DECIMAL(10, 2),
    total_amt DECIMAL(12, 2),
    status VARCHAR(100),
    m_book_no VARCHAR(100),
    total_bill_amt DECIMAL(12, 2),
    first_part DECIMAL(12, 2),
    second_part DECIMAL(12, 2),
    it DECIMAL(12, 2),
    vat DECIMAL(12, 2),
    total_recoveries DECIMAL(12, 2),
    net_amount DECIMAL(12, 2),
    voucher_no VARCHAR(100),
    cheque_no_date VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for govt_bores
CREATE INDEX IF NOT EXISTS idx_govt_bores_village ON govt_bores(village);
CREATE INDEX IF NOT EXISTS idx_govt_bores_status ON govt_bores(status);
CREATE INDEX IF NOT EXISTS idx_govt_bores_date ON govt_bores(bore_date);

-- Create borewell_data table (private bores tracking)
CREATE TABLE IF NOT EXISTS borewell_data (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    client_name VARCHAR(255) NOT NULL,
    village VARCHAR(255),
    total_feet DECIMAL(10, 2) DEFAULT 0,
    fell_feet DECIMAL(10, 2) DEFAULT 0,
    pipes INTEGER DEFAULT 0,
    amount DECIMAL(10, 2) DEFAULT 0,
    cash DECIMAL(10, 2) DEFAULT 0,
    phone_pe DECIMAL(10, 2) DEFAULT 0,
    pending DECIMAL(10, 2) DEFAULT 0,
    point_name VARCHAR(255),
    diesel DECIMAL(10, 2) DEFAULT 0,
    diesel_amount DECIMAL(10, 2) DEFAULT 0,
    commission DECIMAL(10, 2) DEFAULT 0,
    profit DECIMAL(10, 2) DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for borewell_data
CREATE INDEX IF NOT EXISTS idx_borewell_data_date ON borewell_data(date);
CREATE INDEX IF NOT EXISTS idx_borewell_data_client ON borewell_data(client_name);
CREATE INDEX IF NOT EXISTS idx_borewell_data_village ON borewell_data(village);
CREATE INDEX IF NOT EXISTS idx_borewell_data_point ON borewell_data(point_name);
CREATE INDEX IF NOT EXISTS idx_borewell_data_created_by ON borewell_data(created_by);
`;

async function runMigrations() {
    console.log('Running migrations...');

    try {
        await pool.query(migrations);
        console.log('Migrations completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

runMigrations().catch(() => process.exit(1));
