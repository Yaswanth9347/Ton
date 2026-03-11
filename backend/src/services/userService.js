
import db from '../models/db.js';
import { hashPassword, comparePassword } from './authService.js';
import { NotFoundError, ConflictError, ValidationError, UnauthorizedError } from '../utils/errors.js';
import { ensureAuthSchema } from '../utils/ensureAuthSchema.js';
import { PASSWORD_REGEX, PASSWORD_RULES } from '../utils/validators.js';

// Role-based default salary mapping
const ROLE_SALARIES = {
    EMPLOYEE: 12000,
    SUPERVISOR: 15000,
};

/**
 * Get all employees (excludes admins, includes supervisors)
 */
export const getAllEmployees = async () => {
    const authSchema = await ensureAuthSchema();

    const result = await db.query(
        `SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.is_active,
                u.base_salary, u.created_at, u.updated_at, r.name as role,
                ${authSchema.account_locked ? 'u.account_locked' : 'false'} as account_locked,
                ${authSchema.failed_login_attempts ? 'u.failed_login_attempts' : '0'} as failed_login_attempts
         FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE r.name IN ('EMPLOYEE', 'SUPERVISOR')
         ORDER BY u.created_at DESC`
    );

    return result.rows.map(row => ({
        id: row.id,
        username: row.username,
        email: row.email,
        firstName: row.first_name,
        lastName: row.last_name,
        role: row.role,
        baseSalary: parseFloat(row.base_salary) || 0,
        isActive: row.is_active,
        accountLocked: row.account_locked || false,
        failedLoginAttempts: parseInt(row.failed_login_attempts) || 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }));
};

/**
 * Get employee by ID
 */
export const getEmployeeById = async (id) => {
    const result = await db.query(
        `SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.is_active,
                u.base_salary, u.created_at, u.updated_at, r.name as role
         FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE u.id = $1`,
        [id]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const row = result.rows[0];
    return {
        id: row.id,
        username: row.username,
        email: row.email,
        firstName: row.first_name,
        lastName: row.last_name,
        isActive: row.is_active,
        role: row.role,
        baseSalary: parseFloat(row.base_salary) || 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
};

/**
 * Create a new employee
 */
export const createEmployee = async ({ username, password, firstName, lastName, email, role }) => {
    // Check if username already exists (case-insensitive)
    const existing = await db.query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [username]);
    if (existing.rows.length > 0) {
        throw new ConflictError('Username already taken');
    }

    // Determine role (default to EMPLOYEE)
    const roleName = (role === 'SUPERVISOR') ? 'SUPERVISOR' : 'EMPLOYEE';
    const roleResult = await db.query('SELECT id FROM roles WHERE name = $1', [roleName]);
    if (roleResult.rows.length === 0) {
        throw new ValidationError(`${roleName} role not found`);
    }
    const roleId = roleResult.rows[0].id;

    // Auto-assign salary based on role
    const baseSalary = ROLE_SALARIES[roleName] || 0;

    // Hash password
    const passwordHash = await hashPassword(password);

    // Enforce Last Name required for employees
    if (!lastName || lastName.trim() === '') {
        throw new ValidationError('Last name is required for employees');
    }

    // Insert new employee
    const result = await db.query(
        `INSERT INTO users(username, email, password_hash, first_name, last_name, role_id, base_salary, is_active)
         VALUES($1, $2, $3, $4, $5, $6, $7, true)
         RETURNING id, username, email, first_name, last_name, base_salary, is_active, created_at`,
        [username, email || null, passwordHash, firstName, lastName || null, roleId, baseSalary]
    );

    const row = result.rows[0];
    return {
        id: row.id,
        username: row.username,
        email: row.email,
        firstName: row.first_name,
        lastName: row.last_name,
        role: roleName,
        baseSalary: parseFloat(row.base_salary) || 0,

        isActive: row.is_active,
        createdAt: row.created_at,
    };
};

/**
 * Update an employee
 */
export const updateEmployee = async (id, updates) => {
    const employee = await getEmployeeById(id);
    if (!employee) {
        throw new NotFoundError('Employee not found');
    }

    const fields = [];
    const values = [];
    let paramCount = 1;
    let newRole = employee.role; // Track the final role

    if (updates.username !== undefined) {
        // Check if new username is already taken by another user (case-insensitive)
        const existing = await db.query('SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND id != $2', [updates.username, id]);
        if (existing.rows.length > 0) {
            throw new ConflictError('Username already taken');
        }
        fields.push(`username = $${paramCount++} `);
        values.push(updates.username);
    }

    if (updates.email !== undefined) {
        fields.push(`email = $${paramCount++} `);
        values.push(updates.email);
    }

    if (updates.firstName !== undefined) {
        fields.push(`first_name = $${paramCount++} `);
        values.push(updates.firstName);
    }

    if (updates.lastName !== undefined) {
        // Enforce Last Name required for non-admin users
        if (employee.role !== 'ADMIN' && (!updates.lastName || updates.lastName.trim() === '')) {
            throw new ValidationError('Last name is required for employees');
        }
        fields.push(`last_name = $${paramCount++} `);
        values.push(updates.lastName || null);
    }

    if (updates.password !== undefined) {
        const passwordHash = await hashPassword(updates.password);
        fields.push(`password_hash = $${paramCount++} `);
        values.push(passwordHash);
        // Unlock account and reset failed attempts when password is changed by admin (schema-aware)
        const authSchema = await ensureAuthSchema();
        if (authSchema.failed_login_attempts) {
            fields.push(`failed_login_attempts = $${paramCount++} `);
            values.push(0);
        }
        if (authSchema.account_locked) {
            fields.push(`account_locked = $${paramCount++} `);
            values.push(false);
        }
    }

    // Handle role change (EMPLOYEE <-> SUPERVISOR)
    if (updates.role !== undefined && updates.role !== employee.role) {
        const allowedRoles = ['EMPLOYEE', 'SUPERVISOR'];
        if (!allowedRoles.includes(updates.role)) {
            throw new ValidationError('Role must be EMPLOYEE or SUPERVISOR');
        }
        // Cannot change admin's role
        if (employee.role === 'ADMIN') {
            throw new ValidationError('Cannot change admin role');
        }
        const roleResult = await db.query('SELECT id FROM roles WHERE name = $1', [updates.role]);
        if (roleResult.rows.length === 0) {
            throw new ValidationError(`Role ${updates.role} not found`);
        }
        fields.push(`role_id = $${paramCount++} `);
        values.push(roleResult.rows[0].id);
        newRole = updates.role;

        // Auto-assign salary based on new role
        const newSalary = ROLE_SALARIES[updates.role] || 0;
        fields.push(`base_salary = $${paramCount++} `);
        values.push(newSalary);
    }



    if (fields.length === 0) {
        return employee;
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await db.query(
        `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramCount}
         RETURNING id, username, email, first_name, last_name, base_salary, is_active, updated_at`,
        values
    );

    const row = result.rows[0];
    return {
        id: row.id,
        username: row.username,
        email: row.email,
        firstName: row.first_name,
        lastName: row.last_name,
        role: newRole,
        baseSalary: parseFloat(row.base_salary) || 0,

        isActive: row.is_active,
        updatedAt: row.updated_at,
    };
};

/**
 * Deactivate an employee
 */
export const deactivateEmployee = async (id) => {
    const employee = await getEmployeeById(id);
    if (!employee) {
        throw new NotFoundError('Employee not found');
    }

    if (employee.role === 'ADMIN') {
        throw new ValidationError('Cannot deactivate admin users');
    }

    await db.query(
        `UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [id]
    );

    return { ...employee, isActive: false };
};

/**
 * Reactivate an employee
 */
export const reactivateEmployee = async (id) => {
    const employee = await getEmployeeById(id);
    if (!employee) {
        throw new NotFoundError('Employee not found');
    }

    await db.query(
        `UPDATE users SET is_active = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [id]
    );

    return { ...employee, isActive: true };
};

/**
 * Update user profile (Self-Service)
 */
export const updateProfile = async (userId, { firstName, lastName, email }) => {
    const user = await getEmployeeById(userId);
    if (!user) throw new NotFoundError('User not found');

    const fields = [];
    const values = [];
    let paramCount = 1;

    if (firstName !== undefined) {
        fields.push(`first_name = $${paramCount++} `);
        values.push(firstName);
    }

    if (lastName !== undefined) {
        // Enforce Last Name required for non-admin users
        if (user.role !== 'ADMIN' && (!lastName || lastName.trim() === '')) {
            throw new ValidationError('Last name is required for employees');
        }
        fields.push(`last_name = $${paramCount++} `);
        values.push(lastName || null);
    }

    if (email !== undefined) {
        fields.push(`email = $${paramCount++} `);
        values.push(email);
    }

    if (fields.length === 0) return user;

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const result = await db.query(
        `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramCount}
         RETURNING id, username, email, first_name, last_name, is_active, updated_at`,
        values
    );

    return result.rows[0];
};

/**
 * Change Password (Self-Service)
 */
export const changePassword = async (userId, { currentPassword, newPassword }) => {
    // Validate new password length
    if (!newPassword || newPassword.length < 8) {
        throw new ValidationError('New password must be at least 8 characters long.');
    }
    if (!PASSWORD_REGEX.test(newPassword)) {
        throw new ValidationError(PASSWORD_RULES);
    }

    const result = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) throw new NotFoundError('User not found');

    const user = result.rows[0];

    // Verify old password
    const isValid = await comparePassword(currentPassword, user.password_hash);
    if (!isValid) throw new UnauthorizedError('Incorrect current password');

    // Hash new password
    const newHash = await hashPassword(newPassword);

    // Build update — also reset security counters on successful password change
    const authSchema = await ensureAuthSchema();
    const setClauses = ['password_hash = $1', 'updated_at = CURRENT_TIMESTAMP'];
    const params = [newHash];

    if (authSchema.failed_login_attempts) setClauses.push('failed_login_attempts = 0');
    if (authSchema.account_locked) setClauses.push('account_locked = false');

    params.push(userId);
    await db.query(
        `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${params.length}`,
        params
    );

    return { success: true };
};

/**
 * Unlock a locked user account (Admin only)
 * Resets account_locked and failed_login_attempts
 */
export const unlockEmployee = async (id) => {
    const employee = await getEmployeeById(id);
    if (!employee) {
        throw new NotFoundError('Employee not found');
    }

    if (employee.role === 'ADMIN') {
        throw new ValidationError('Admin accounts cannot be unlocked this way. Use email-based password reset.');
    }

    const authSchema = await ensureAuthSchema();

    const setClauses = ['updated_at = CURRENT_TIMESTAMP'];
    if (authSchema.account_locked) setClauses.push('account_locked = false');
    if (authSchema.failed_login_attempts) setClauses.push('failed_login_attempts = 0');

    await db.query(
        `UPDATE users SET ${setClauses.join(', ')} WHERE id = $1`,
        [id]
    );

    return { ...employee, accountLocked: false, failedLoginAttempts: 0 };
};

/**
 * Update profile photo
 */
export const updateProfilePhoto = async (userId, photoUrl) => {
    const result = await db.query(
        `UPDATE users SET profile_photo_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
         RETURNING id, profile_photo_url`,
        [photoUrl, userId]
    );

    if (result.rows.length === 0) {
        throw new NotFoundError('User not found');
    }

    return result.rows[0];
};

