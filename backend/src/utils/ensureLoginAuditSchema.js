import db from '../models/db.js';

let loginAuditReady = false;

/**
 * Ensure the login_audit table exists.
 * Called once on startup; subsequent calls are no-ops.
 */
export async function ensureLoginAuditSchema() {
    if (loginAuditReady) return;

    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS login_audit (
                id          SERIAL PRIMARY KEY,
                user_id     INTEGER,
                username    VARCHAR(100),
                action      VARCHAR(30) NOT NULL,
                ip_address  VARCHAR(45),
                user_agent  TEXT,
                details     TEXT,
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Index for fast admin queries
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_login_audit_created
            ON login_audit (created_at DESC)
        `);

        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_login_audit_user
            ON login_audit (user_id)
        `);

        loginAuditReady = true;
    } catch (error) {
        console.error('[LOGIN_AUDIT] Schema setup failed:', error.message);
    }
}

/**
 * Record a login-related event.
 *
 * @param {Object} opts
 * @param {number|null} opts.userId
 * @param {string}      opts.username
 * @param {string}      opts.action   - LOGIN_SUCCESS | LOGIN_FAILED | LOGOUT | ACCOUNT_LOCKED | PASSWORD_CHANGED | PASSWORD_RESET
 * @param {string}      opts.ip
 * @param {string}      opts.userAgent
 * @param {string}      [opts.details]
 */
export async function logLoginEvent({ userId = null, username = '', action, ip = '', userAgent = '', details = '' }) {
    try {
        await ensureLoginAuditSchema();
        await db.query(
            `INSERT INTO login_audit (user_id, username, action, ip_address, user_agent, details)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [userId, username, action, ip, userAgent, details]
        );
    } catch (error) {
        // Never let audit logging break the auth flow
        console.error('[LOGIN_AUDIT] Failed to log event:', error.message);
    }
}
