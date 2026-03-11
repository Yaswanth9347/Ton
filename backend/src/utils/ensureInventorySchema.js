import db from '../models/db.js';

let inventorySchemaReady = false;
let inventorySchemaPromise = null;

const inventorySchemaStatements = [
    `
    CREATE TABLE IF NOT EXISTS pipes_company_master (
        id SERIAL PRIMARY KEY,
        company_name VARCHAR(100) UNIQUE NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
    )
    `,
    `
    CREATE TABLE IF NOT EXISTS pipes_master (
        id SERIAL PRIMARY KEY,
        pipe_type_name VARCHAR(100) NOT NULL,
        pipe_size VARCHAR(50) NOT NULL,
        unit VARCHAR(50) NOT NULL DEFAULT 'pieces',
        description TEXT,
        material_type VARCHAR(50),
        quality_grade VARCHAR(50),
        length_feet DECIMAL(8,2) DEFAULT 20,
        cost_per_unit DECIMAL(12,2) DEFAULT 0,
        reorder_level INTEGER DEFAULT 10,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT pipes_master_pipe_type_name_pipe_size_key UNIQUE (pipe_type_name, pipe_size)
    )
    `,
    `
    CREATE TABLE IF NOT EXISTS pipes_stock (
        id SERIAL PRIMARY KEY,
        pipe_master_id INTEGER NOT NULL UNIQUE REFERENCES pipes_master(id) ON DELETE CASCADE,
        available_quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
        last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    `,
    `
    CREATE TABLE IF NOT EXISTS pipes_stock_transactions (
        id SERIAL PRIMARY KEY,
        pipe_master_id INTEGER NOT NULL REFERENCES pipes_master(id) ON DELETE CASCADE,
        transaction_type VARCHAR(20) NOT NULL,
        quantity DECIMAL(10,2) NOT NULL,
        reference_type VARCHAR(50) NOT NULL,
        reference_id INTEGER,
        created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        remarks TEXT,
        vehicle_name VARCHAR(100),
        supervisor_name VARCHAR(100),
        source_location VARCHAR(100) DEFAULT 'MAIN_STORE',
        destination_location VARCHAR(100),
        supplier_name VARCHAR(150),
        purchase_mode VARCHAR(50),
        allocation_id INTEGER
    )
    `,
    `
    CREATE TABLE IF NOT EXISTS pipe_bore_allocations (
        id SERIAL PRIMARY KEY,
        pipe_master_id INTEGER NOT NULL REFERENCES pipes_master(id) ON DELETE CASCADE,
        bore_type VARCHAR(20) NOT NULL,
        private_bore_id INTEGER REFERENCES borewell_data(id) ON DELETE CASCADE,
        govt_bore_id INTEGER REFERENCES "BorewellWork"(id) ON DELETE CASCADE,
        vehicle_name VARCHAR(100),
        supervisor_name VARCHAR(100),
        issued_quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
        returned_quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
        source_location VARCHAR(100) DEFAULT 'MAIN_STORE',
        destination_location VARCHAR(100),
        status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
        auto_created BOOLEAN NOT NULL DEFAULT false,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_pipe_bore_allocation_one_bore CHECK (
            (private_bore_id IS NOT NULL AND govt_bore_id IS NULL AND bore_type = 'private') OR
            (private_bore_id IS NULL AND govt_bore_id IS NOT NULL AND bore_type = 'govt')
        )
    )
    `,
    `
    CREATE TABLE IF NOT EXISTS spares_master (
        id SERIAL PRIMARY KEY,
        spare_name VARCHAR(100) NOT NULL,
        category VARCHAR(50) NOT NULL,
        unit VARCHAR(50) NOT NULL DEFAULT 'nos',
        description TEXT,
        brand VARCHAR(100),
        unit_type VARCHAR(30) DEFAULT 'Piece',
        cost_per_unit DECIMAL(12,2) DEFAULT 0,
        reorder_level INTEGER DEFAULT 5,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT spares_master_spare_name_category_key UNIQUE (spare_name, category)
    )
    `,
    `
    CREATE TABLE IF NOT EXISTS spares_stock (
        id SERIAL PRIMARY KEY,
        spare_master_id INTEGER NOT NULL UNIQUE REFERENCES spares_master(id) ON DELETE CASCADE,
        available_quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
        last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    `,
    `
    CREATE TABLE IF NOT EXISTS spares_stock_transactions (
        id SERIAL PRIMARY KEY,
        spare_master_id INTEGER NOT NULL REFERENCES spares_master(id) ON DELETE CASCADE,
        transaction_type VARCHAR(20) NOT NULL,
        quantity DECIMAL(10,2) NOT NULL,
        reference_type VARCHAR(50) NOT NULL,
        reference_id INTEGER,
        created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        remarks TEXT,
        vehicle_name VARCHAR(100),
        supervisor_name VARCHAR(100)
    )
    `,
    `
    CREATE TABLE IF NOT EXISTS diesel_master (
        id SERIAL PRIMARY KEY,
        storage_location VARCHAR(100) NOT NULL DEFAULT 'Main Tank',
        unit VARCHAR(50) NOT NULL DEFAULT 'liters',
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT diesel_master_storage_location_key UNIQUE (storage_location)
    )
    `,
    `
    CREATE TABLE IF NOT EXISTS diesel_stock (
        id SERIAL PRIMARY KEY,
        diesel_master_id INTEGER NOT NULL UNIQUE REFERENCES diesel_master(id) ON DELETE CASCADE,
        available_quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
        last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    `,
    `
    CREATE TABLE IF NOT EXISTS diesel_stock_transactions (
        id SERIAL PRIMARY KEY,
        diesel_master_id INTEGER NOT NULL REFERENCES diesel_master(id) ON DELETE CASCADE,
        transaction_type VARCHAR(20) NOT NULL,
        quantity DECIMAL(10,2) NOT NULL,
        reference_type VARCHAR(50) NOT NULL,
        reference_id INTEGER,
        created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        remarks TEXT,
        vehicle_name VARCHAR(100),
        supervisor_name VARCHAR(100),
        amount DECIMAL(10,2),
        bill_url TEXT
    )
    `,
    `
    ALTER TABLE borewell_data
      ADD COLUMN IF NOT EXISTS pipe_inventory_id INTEGER
    `,
    `
    ALTER TABLE "BorewellWork"
      ADD COLUMN IF NOT EXISTS pipe_inventory_id INTEGER,
      ADD COLUMN IF NOT EXISTS pipe_company_id INTEGER,
      ADD COLUMN IF NOT EXISTS geologist VARCHAR(255)
    `,
    `
    ALTER TABLE pipes_master ADD COLUMN IF NOT EXISTS material_type VARCHAR(50)
    `,
    `
    ALTER TABLE pipes_master ADD COLUMN IF NOT EXISTS quality_grade VARCHAR(50)
    `,
    `
    ALTER TABLE pipes_master ADD COLUMN IF NOT EXISTS length_feet DECIMAL(8,2) DEFAULT 20
    `,
    `
    ALTER TABLE pipes_master ADD COLUMN IF NOT EXISTS cost_per_unit DECIMAL(12,2) DEFAULT 0
    `,
    `
    ALTER TABLE pipes_master ADD COLUMN IF NOT EXISTS reorder_level INTEGER DEFAULT 10
    `,
    `
    ALTER TABLE spares_master ADD COLUMN IF NOT EXISTS brand VARCHAR(100)
    `,
    `
    ALTER TABLE spares_master ADD COLUMN IF NOT EXISTS unit_type VARCHAR(30) DEFAULT 'Piece'
    `,
    `
    ALTER TABLE spares_master ADD COLUMN IF NOT EXISTS cost_per_unit DECIMAL(12,2) DEFAULT 0
    `,
    `
    ALTER TABLE spares_master ADD COLUMN IF NOT EXISTS reorder_level INTEGER DEFAULT 5
    `,
    `
    ALTER TABLE spares_stock_transactions
      ADD COLUMN IF NOT EXISTS vehicle_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS supervisor_name VARCHAR(100)
    `,
    `
    ALTER TABLE pipes_stock_transactions
      ADD COLUMN IF NOT EXISTS vehicle_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS supervisor_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS source_location VARCHAR(100) DEFAULT 'MAIN_STORE',
      ADD COLUMN IF NOT EXISTS destination_location VARCHAR(100),
      ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(150),
      ADD COLUMN IF NOT EXISTS purchase_mode VARCHAR(50),
      ADD COLUMN IF NOT EXISTS allocation_id INTEGER
    `,
    `
    CREATE UNIQUE INDEX IF NOT EXISTS uq_pipe_bore_allocations_pipe_bore
      ON pipe_bore_allocations (pipe_master_id, COALESCE(private_bore_id, 0), COALESCE(govt_bore_id, 0))
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_pipe_bore_allocations_status
      ON pipe_bore_allocations (bore_type, status)
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_pipe_bore_allocations_private_bore
      ON pipe_bore_allocations (private_bore_id)
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_pipe_bore_allocations_govt_bore
      ON pipe_bore_allocations (govt_bore_id)
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_pipes_master_material ON pipes_master(material_type)
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_pipes_master_size ON pipes_master(pipe_size)
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_spares_master_brand ON spares_master(brand)
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_pipes_stock_transactions_created_at ON pipes_stock_transactions(created_at DESC)
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_pipes_stock_transactions_pipe_master ON pipes_stock_transactions(pipe_master_id)
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_spares_stock_transactions_created_at ON spares_stock_transactions(created_at DESC)
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_diesel_stock_transactions_created_at ON diesel_stock_transactions(created_at DESC)
    `,
    `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'borewell_data'
          AND constraint_name = 'fk_borewell_data_pipe_inventory_id'
      ) THEN
        ALTER TABLE borewell_data
          ADD CONSTRAINT fk_borewell_data_pipe_inventory_id
          FOREIGN KEY (pipe_inventory_id) REFERENCES pipes_master(id) ON DELETE SET NULL;
      END IF;
    END $$
    `,
    `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'BorewellWork'
          AND constraint_name = 'fk_borewell_work_pipe_inventory_id'
      ) THEN
        ALTER TABLE "BorewellWork"
          ADD CONSTRAINT fk_borewell_work_pipe_inventory_id
          FOREIGN KEY (pipe_inventory_id) REFERENCES pipes_master(id) ON DELETE SET NULL;
      END IF;
    END $$
    `,
    `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'BorewellWork'
          AND constraint_name = 'BorewellWork_pipe_company_id_fkey'
      ) THEN
        ALTER TABLE "BorewellWork"
          ADD CONSTRAINT "BorewellWork_pipe_company_id_fkey"
          FOREIGN KEY (pipe_company_id) REFERENCES pipes_company_master(id) ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$
    `,
    `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'pipes_stock_transactions'
          AND constraint_name = 'fk_pipes_stock_transactions_allocation_id'
      ) THEN
        ALTER TABLE pipes_stock_transactions
          ADD CONSTRAINT fk_pipes_stock_transactions_allocation_id
          FOREIGN KEY (allocation_id) REFERENCES pipe_bore_allocations(id) ON DELETE SET NULL;
      END IF;
    END $$
    `,
];

export function resetInventorySchemaCache() {
    inventorySchemaReady = false;
    inventorySchemaPromise = null;
}

export async function ensureInventorySchema() {
    if (inventorySchemaReady) {
        return true;
    }

    if (inventorySchemaPromise) {
        return inventorySchemaPromise;
    }

    inventorySchemaPromise = (async () => {
        const client = await db.getClient();

        try {
            await client.query('BEGIN');

            for (const statement of inventorySchemaStatements) {
                await client.query(statement);
            }

            await client.query('COMMIT');
            inventorySchemaReady = true;
            console.log('[INVENTORY] Schema verified');
            return true;
        } catch (error) {
            await client.query('ROLLBACK');
            inventorySchemaPromise = null;
            console.error('[INVENTORY] Schema setup failed:', error.message);
            throw error;
        } finally {
            client.release();
        }
    })();

    return inventorySchemaPromise;
}