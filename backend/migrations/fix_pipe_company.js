import pg from 'pg';
import dotenv from 'dotenv';
import dbConfig from '../src/config/database.js';

dotenv.config();

const { Pool } = pg;
const pool = new Pool(dbConfig);

const sql = `
-- Create pipes_company_master
CREATE TABLE IF NOT EXISTS "pipes_company_master" (
    "id" SERIAL PRIMARY KEY,
    "company_name" VARCHAR(100) UNIQUE NOT NULL,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
);

-- Add column to BorewellWork
ALTER TABLE "BorewellWork" ADD COLUMN IF NOT EXISTS "pipe_company_id" INTEGER;

-- Add foreign key constraint if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'BorewellWork_pipe_company_id_fkey'
    ) THEN
        ALTER TABLE "BorewellWork" 
        ADD CONSTRAINT "BorewellWork_pipe_company_id_fkey" 
        FOREIGN KEY ("pipe_company_id") 
        REFERENCES "pipes_company_master"("id") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE;
    END IF;
END $$;
`;

async function run() {
    console.log('Running fix for pipe_company_id...');
    try {
        await pool.query(sql);
        console.log('Successfully applied missing schema updates for pipe company!');
    } catch (e) {
        console.error('Failed to apply schema fix:', e);
    } finally {
        await pool.end();
    }
}

run();
