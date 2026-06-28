import prisma from '../config/prisma.js';

/**
 * Ensure the login_audit table exists.
 * No-op for backward compatibility; schema is now managed via Prisma.
 */
export async function ensureLoginAuditSchema() {
    // No-op
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
        await prisma.login_audit.create({
            data: {
                user_id: userId,
                username: username || null,
                action: action,
                ip_address: ip || null,
                user_agent: userAgent || null,
                details: details || null,
            },
        });
    } catch (error) {
        // Never let audit logging break the auth flow
        console.error('[LOGIN_AUDIT] Failed to log event:', error.message);
    }
}
