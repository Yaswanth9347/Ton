import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import dbConfig from '../src/config/database.js';

dotenv.config();

const { Pool } = pg;
const pool = new Pool(dbConfig);

const SALT_ROUNDS = 10;

async function seed() {
    console.log('Seeding database...');

    try {
        // Ensure SUPERVISOR role exists (Admin == Supervisor privileges)
        await pool.query(
            `INSERT INTO roles (name) VALUES ('SUPERVISOR'), ('ADMIN'), ('EMPLOYEE')
             ON CONFLICT (name) DO NOTHING`
        );
        console.log('Roles ensured (SUPERVISOR, ADMIN, EMPLOYEE).');

        // Get role IDs
        const rolesResult = await pool.query('SELECT id, name FROM roles');
        const roles = {};
        rolesResult.rows.forEach(row => {
            roles[row.name] = row.id;
        });

        // Create admin user with username: Admin, password: Admin@13
        const adminPassword = await bcrypt.hash('Admin@13', SALT_ROUNDS);
        await pool.query(
            `INSERT INTO users (username, email, password_hash, first_name, last_name, role_id, is_active, base_salary)
       VALUES ($1, $2, $3, $4, $5, $6, true, 50000.00)
       ON CONFLICT (username) DO UPDATE SET password_hash = $3, base_salary = 50000.00`,
            ['Admin', 'admin@company.com', adminPassword, 'System', 'Administrator', roles.ADMIN]
        );
        console.log('Admin user created: Admin / Admin@13');

        // Create supervisor user with username: Supervisor, password: Super@13
        const supervisorPassword = await bcrypt.hash('Super@13', SALT_ROUNDS);
        await pool.query(
            `INSERT INTO users (username, email, password_hash, first_name, last_name, role_id, is_active, base_salary)
       VALUES ($1, $2, $3, $4, $5, $6, true, 0)
       ON CONFLICT (username) DO UPDATE SET password_hash = $3, role_id = $6`,
            ['Supervisor', 'supervisor@company.com', supervisorPassword, 'Site', 'Supervisor', roles.SUPERVISOR]
        );
        console.log('Supervisor user created: Supervisor / Super@13');

        // Create employee user with username: User1, password: User@123
        const userPassword = await bcrypt.hash('User@123', SALT_ROUNDS);
        await pool.query(
            `INSERT INTO users (username, email, password_hash, first_name, last_name, role_id, is_active, base_salary)
       VALUES ($1, $2, $3, $4, $5, $6, true, 3000.00)
       ON CONFLICT (username) DO UPDATE SET password_hash = $3, base_salary = 3000.00`,
            ['User1', 'user1@company.com', userPassword, 'John', 'Doe', roles.EMPLOYEE]
        );
        console.log('Employee user created: User1 / User@123');

        console.log('\nSeeding completed successfully!');
        console.log('\nCredentials:');
        console.log('  Admin:      Admin / Admin@13');
        console.log('  Supervisor: Supervisor / Super@13');
        console.log('  Employee:   User1 / User@123');
        console.log('\nNote: You can create more employee accounts from the Admin dashboard.');

    } catch (error) {
        console.error('Seeding failed:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

seed().catch(() => process.exit(1));
