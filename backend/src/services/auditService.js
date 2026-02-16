import db from '../models/db.js';

/**
 * Get all audit logs with optional filters
 */
export const getAuditLogs = async ({ adminId, entityType, startDate, endDate, limit = 100, offset = 0 }) => {
    let query = `
    SELECT al.id, al.admin_id, al.action, al.entity_type, al.entity_id, 
           al.old_value, al.new_value, al.created_at,
           u.first_name, u.last_name, u.email
    FROM audit_logs al
    JOIN users u ON al.admin_id = u.id
    WHERE 1=1
  `;
    const params = [];
    let paramCount = 1;

    if (adminId) {
        query += ` AND al.admin_id = $${paramCount++}`;
        params.push(adminId);
    }

    if (entityType) {
        query += ` AND al.entity_type = $${paramCount++}`;
        params.push(entityType);
    }

    if (startDate) {
        query += ` AND al.created_at >= $${paramCount++}`;
        params.push(startDate);
    }

    if (endDate) {
        query += ` AND al.created_at <= $${paramCount++}`;
        params.push(endDate);
    }

    query += ` ORDER BY al.created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    return result.rows.map(row => ({
        id: row.id,
        adminId: row.admin_id,
        adminName: `${row.first_name} ${row.last_name}`,
        adminEmail: row.email,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        oldValue: row.old_value,
        newValue: row.new_value,
        createdAt: row.created_at,
    }));
};

/**
 * Get audit logs count
 */
export const getAuditLogsCount = async ({ adminId, entityType, startDate, endDate }) => {
    let query = 'SELECT COUNT(*) as count FROM audit_logs WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (adminId) {
        query += ` AND admin_id = $${paramCount++}`;
        params.push(adminId);
    }

    if (entityType) {
        query += ` AND entity_type = $${paramCount++}`;
        params.push(entityType);
    }

    if (startDate) {
        query += ` AND created_at >= $${paramCount++}`;
        params.push(startDate);
    }

    if (endDate) {
        query += ` AND created_at <= $${paramCount++}`;
        params.push(endDate);
    }

    const result = await db.query(query, params);
    return parseInt(result.rows[0].count);
};
