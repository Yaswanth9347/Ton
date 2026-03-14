import bcrypt from 'bcryptjs';
import db from '../models/db.js';
import { ensureAuthSchema } from './ensureAuthSchema.js';

const SALT_ROUNDS = 10;

const DEFAULT_USERS = [
  {
    role: 'ADMIN',
    username: 'Admin',
    password: 'Admin@13',
    email: 'yaswanthyerra2025@gmail.com',
    firstName: 'System',
    lastName: 'Administrator',
    baseSalary: 50000.0,
  },
  {
    role: 'SUPERVISOR',
    username: 'Supervisor',
    password: 'Super@13',
    email: 'supervisor@company.com',
    firstName: 'Site',
    lastName: 'Supervisor',
    baseSalary: 0,
  },
  {
    role: 'EMPLOYEE',
    username: 'User1',
    password: 'User@123',
    email: 'user1@company.com',
    firstName: 'John',
    lastName: 'Doe',
    baseSalary: 3000.0,
  },
];

let ensureDefaultsPromise = null;

export async function ensureDefaultAuthUsers() {
  if (!ensureDefaultsPromise) {
    ensureDefaultsPromise = runEnsureDefaultAuthUsers().catch((error) => {
      ensureDefaultsPromise = null;
      throw error;
    });
  }

  return ensureDefaultsPromise;
}

async function runEnsureDefaultAuthUsers() {
  await ensureAuthSchema();

  await db.query(
    `INSERT INTO roles (name)
     VALUES ('ADMIN'), ('SUPERVISOR'), ('EMPLOYEE')
     ON CONFLICT (name) DO NOTHING`
  );

  const roleResult = await db.query(
    `SELECT id, name
     FROM roles
     WHERE name IN ('ADMIN', 'SUPERVISOR', 'EMPLOYEE')`
  );

  const roleIds = Object.fromEntries(roleResult.rows.map((row) => [row.name, row.id]));

  for (const user of DEFAULT_USERS) {
    const roleId = roleIds[user.role];
    if (!roleId) {
      throw new Error(`Missing role during default user bootstrap: ${user.role}`);
    }

    const passwordHash = await bcrypt.hash(user.password, SALT_ROUNDS);

    await db.query(
      `INSERT INTO users (
         username,
         email,
         password_hash,
         first_name,
         last_name,
         role_id,
         is_active,
         failed_login_attempts,
         account_locked,
         last_failed_login,
         reset_token,
         reset_token_expiry,
         base_salary,
         updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, true, 0, false, NULL, NULL, NULL, $7, CURRENT_TIMESTAMP
       )
       ON CONFLICT (username) DO UPDATE
       SET email = COALESCE(users.email, EXCLUDED.email),
           password_hash = EXCLUDED.password_hash,
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           role_id = EXCLUDED.role_id,
           is_active = true,
           failed_login_attempts = 0,
           account_locked = false,
           last_failed_login = NULL,
           reset_token = NULL,
           reset_token_expiry = NULL,
           base_salary = EXCLUDED.base_salary,
           updated_at = CURRENT_TIMESTAMP`,
      [
        user.username,
        user.email,
        passwordHash,
        user.firstName,
        user.lastName,
        roleId,
        user.baseSalary,
      ]
    );
  }
}
