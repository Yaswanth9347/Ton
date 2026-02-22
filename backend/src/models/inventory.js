import db from './db.js';

// =============================================
// PIPES INVENTORY
// =============================================

export const getPipeInventory = async () => {
    const result = await db.query(`
        SELECT * FROM pipe_inventory 
        ORDER BY size, company
    `);
    return result.rows;
};

export const getPipeById = async (id) => {
    const result = await db.query('SELECT * FROM pipe_inventory WHERE id = $1', [id]);
    return result.rows[0];
};

export const createPipe = async (data) => {
    const result = await db.query(
        `INSERT INTO pipe_inventory (size, company, quantity, unit)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [data.size, data.company, data.quantity || 0, data.unit || 'pieces']
    );
    return result.rows[0];
};

export const updatePipeQuantity = async (id, quantity, pieces) => {
    let query, params;
    if (pieces) {
        query = 'UPDATE pipe_inventory SET quantity = $1, pieces = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *';
        params = [quantity, pieces, id];
    } else {
        query = 'UPDATE pipe_inventory SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *';
        params = [quantity, id];
    }
    const result = await db.query(query, params);
    return result.rows[0];
};

export const deletePipe = async (id) => {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        // Delete related transactions first to satisfy foreign key constraints
        await client.query('DELETE FROM pipe_transactions WHERE pipe_inventory_id = $1', [id]);
        // Delete the pipe inventory record
        const result = await client.query('DELETE FROM pipe_inventory WHERE id = $1 RETURNING *', [id]);
        await client.query('COMMIT');
        return result.rows[0];
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

export const getPipeTransactions = async (filters = {}) => {
    let query = `
        SELECT pt.*, pi.size, pi.company, u.username as created_by_name
        FROM pipe_transactions pt
        LEFT JOIN pipe_inventory pi ON pt.pipe_inventory_id = pi.id
        LEFT JOIN users u ON pt.created_by = u.id
        WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (filters.startDate) {
        query += ` AND pt.created_at >= $${paramCount}`;
        params.push(filters.startDate);
        paramCount++;
    }

    if (filters.endDate) {
        query += ` AND pt.created_at <= $${paramCount}`;
        params.push(filters.endDate);
        paramCount++;
    }

    if (filters.transactionType) {
        query += ` AND pt.transaction_type = $${paramCount}`;
        params.push(filters.transactionType);
        paramCount++;
    }

    query += ' ORDER BY pt.created_at DESC';

    const result = await db.query(query, params);
    return result.rows;
};

export const createPipeTransaction = async (data, userId) => {
    const result = await db.query(
        `INSERT INTO pipe_transactions (
            pipe_inventory_id, transaction_type, quantity, unit_type, bore_type, bore_id,
            vehicle_name, supervisor_name, remarks, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [
            data.pipe_inventory_id,
            data.transaction_type,
            data.quantity,
            data.unit_type || 'pipes',
            data.bore_type || null,
            data.bore_id || null,
            data.vehicle_name || null,
            data.supervisor_name || null,
            data.remarks || null,
            userId
        ]
    );
    return result.rows[0];
};

// =============================================
// SPARES INVENTORY
// =============================================

export const getSparesInventory = async (filters = {}) => {
    let query = 'SELECT * FROM spares_inventory WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (filters.spareType) {
        query += ` AND spare_type = $${paramCount}`;
        params.push(filters.spareType);
        paramCount++;
    }

    if (filters.status) {
        query += ` AND status = $${paramCount}`;
        params.push(filters.status);
        paramCount++;
    }

    if (filters.location) {
        query += ` AND current_location = $${paramCount}`;
        params.push(filters.location);
        paramCount++;
    }

    query += ' ORDER BY spare_type, spare_number';

    const result = await db.query(query, params);
    return result.rows;
};

export const getSpareById = async (id) => {
    const result = await db.query('SELECT * FROM spares_inventory WHERE id = $1', [id]);
    return result.rows[0];
};

export const createSpare = async (data) => {
    const result = await db.query(
        `INSERT INTO spares_inventory (spare_type, spare_number, status)
         VALUES ($1, $2, $3) RETURNING *`,
        [data.spare_type, data.spare_number, data.status || 'AVAILABLE']
    );
    return result.rows[0];
};

export const updateSpare = async (id, data) => {
    const result = await db.query(
        `UPDATE spares_inventory SET
            current_location = $1,
            vehicle_name = $2,
            supervisor_name = $3,
            status = $4,
            updated_at = CURRENT_TIMESTAMP
         WHERE id = $5 RETURNING *`,
        [
            data.current_location,
            data.vehicle_name || null,
            data.supervisor_name || null,
            data.status,
            id
        ]
    );
    return result.rows[0];
};

export const deleteSpare = async (id) => {
    const result = await db.query('DELETE FROM spares_inventory WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
};

export const getSparesTransactions = async (spareId = null) => {
    let query = `
        SELECT st.*, si.spare_type, si.spare_number, u.username as created_by_name
        FROM spares_transactions st
        LEFT JOIN spares_inventory si ON st.spare_id = si.id
        LEFT JOIN users u ON st.created_by = u.id
        WHERE 1=1
    `;
    const params = [];

    if (spareId) {
        query += ' AND st.spare_id = $1';
        params.push(spareId);
    }

    query += ' ORDER BY st.created_at DESC';

    const result = await db.query(query, params);
    return result.rows;
};

export const createSpareTransaction = async (data, userId) => {
    const result = await db.query(
        `INSERT INTO spares_transactions (
            spare_id, transaction_type, vehicle_name, supervisor_name, remarks, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
            data.spare_id,
            data.transaction_type,
            data.vehicle_name || null,
            data.supervisor_name || null,
            data.remarks || null,
            userId
        ]
    );
    return result.rows[0];
};

// =============================================
// DIESEL RECORDS
// =============================================

export const getDieselRecords = async (filters = {}) => {
    let query = `
        SELECT dr.*, u.username as created_by_name
        FROM diesel_records dr
        LEFT JOIN users u ON dr.created_by = u.id
        WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (filters.startDate) {
        query += ` AND dr.purchase_date >= $${paramCount}`;
        params.push(filters.startDate);
        paramCount++;
    }

    if (filters.endDate) {
        query += ` AND dr.purchase_date <= $${paramCount}`;
        params.push(filters.endDate);
        paramCount++;
    }

    if (filters.vehicle) {
        query += ` AND dr.vehicle_name ILIKE $${paramCount}`;
        params.push(`%${filters.vehicle}%`);
        paramCount++;
    }

    if (filters.supervisor) {
        query += ` AND dr.supervisor_name ILIKE $${paramCount}`;
        params.push(`%${filters.supervisor}%`);
        paramCount++;
    }

    query += ' ORDER BY dr.purchase_date DESC, dr.created_at DESC';

    const result = await db.query(query, params);
    return result.rows;
};

export const getDieselRecordById = async (id) => {
    const result = await db.query('SELECT * FROM diesel_records WHERE id = $1', [id]);
    return result.rows[0];
};

export const createDieselRecord = async (data, userId) => {
    const result = await db.query(
        `INSERT INTO diesel_records (
            vehicle_name, purchase_date, supervisor_name, amount, liters, bill_url, remarks, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
            data.vehicle_name,
            data.purchase_date,
            data.supervisor_name || null,
            data.amount,
            data.liters || null,
            data.bill_url || null,
            data.remarks || null,
            userId
        ]
    );
    return result.rows[0];
};

export const updateDieselRecord = async (id, data) => {
    const result = await db.query(
        `UPDATE diesel_records SET
            vehicle_name = $1,
            purchase_date = $2,
            supervisor_name = $3,
            amount = $4,
            liters = $5,
            bill_url = $6,
            remarks = $7,
            updated_at = CURRENT_TIMESTAMP
         WHERE id = $8 RETURNING *`,
        [
            data.vehicle_name,
            data.purchase_date,
            data.supervisor_name,
            data.amount,
            data.liters,
            data.bill_url,
            data.remarks,
            id
        ]
    );
    return result.rows[0];
};

export const deleteDieselRecord = async (id) => {
    const result = await db.query('DELETE FROM diesel_records WHERE id = $1 RETURNING *', [id]);
    return result.rows[0];
};

export default {
    getPipeInventory,
    getPipeById,
    updatePipeQuantity,
    getPipeTransactions,
    createPipeTransaction,
    getSparesInventory,
    getSpareById,
    createSpare,
    updateSpare,
    deleteSpare,
    getSparesTransactions,
    createSpareTransaction,
    getDieselRecords,
    getDieselRecordById,
    createDieselRecord,
    updateDieselRecord,
    deleteDieselRecord
};
