import pg from 'pg';
import bcrypt from 'bcryptjs';
import dbConfig from './src/config/database.js';

const pool = new pg.Pool(dbConfig);

async function testLogin() {
    const username = 'Admin';
    const password = 'Admin@13';

    try {
        const result = await pool.query('SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [username]);
        if (result.rows.length === 0) {
            console.log('User not found in DB!');
            return;
        }

        const user = result.rows[0];
        console.log('User found:', {
            id: user.id,
            username: user.username,
            password_hash: user.password_hash
        });

        const isValid = await bcrypt.compare(password, user.password_hash);
        console.log('Is valid with "Admin@13"?', isValid);

        const isValidLower = await bcrypt.compare('admin@13', user.password_hash);
        console.log('Is valid with "admin@13"?', isValidLower);

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

testLogin();
