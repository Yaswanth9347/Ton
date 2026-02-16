import db from '../models/db.js';

/**
 * Audit logging middleware for admin actions
 * Wraps a controller function to log changes
 */
export const auditLogger = (action, entityType, getEntityId, getOldValue, getNewValue) => {
    return async (req, res, next) => {
        // Store original json method
        const originalJson = res.json.bind(res);

        // Override json to capture response and log audit
        res.json = async (data) => {
            try {
                // Only log successful operations
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    const entityId = typeof getEntityId === 'function' ? getEntityId(req, data) : null;
                    const oldValue = typeof getOldValue === 'function' ? await getOldValue(req, data) : null;
                    const newValue = typeof getNewValue === 'function' ? getNewValue(req, data) : null;

                    await db.query(
                        `INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, old_value, new_value)
             VALUES ($1, $2, $3, $4, $5, $6)`,
                        [
                            req.user.id,
                            action,
                            entityType,
                            entityId,
                            oldValue ? JSON.stringify(oldValue) : null,
                            newValue ? JSON.stringify(newValue) : null,
                        ]
                    );
                }
            } catch (error) {
                console.error('Audit logging error:', error);
                // Don't fail the request if audit logging fails
            }

            return originalJson(data);
        };

        next();
    };
};

/**
 * Simple audit log function for manual logging
 */
export const logAudit = async (adminId, action, entityType, entityId, oldValue, newValue) => {
    try {
        await db.query(
            `INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, old_value, new_value)
       VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                adminId,
                action,
                entityType,
                entityId,
                oldValue ? JSON.stringify(oldValue) : null,
                newValue ? JSON.stringify(newValue) : null,
            ]
        );
    } catch (error) {
        console.error('Audit logging error:', error);
    }
};
