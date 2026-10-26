import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

const dbPath = join(__dirname, '..', '..', 'fraga_lanches.db');

async function migrate() {
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    await db.exec('PRAGMA foreign_keys = ON');

    console.log('Running migrations...');

    // Add perfil column to usuarios_admin if it doesn't exist
    try {
        await db.exec(`
            ALTER TABLE usuarios_admin
            ADD COLUMN perfil TEXT NOT NULL DEFAULT 'atendente'
            CHECK (perfil IN ('administrador', 'atendente', 'cozinha', 'entregador'))
        `);
        console.log('Added perfil column to usuarios_admin');
    } catch (error) {
        if (error.message.includes('duplicate column name')) {
            console.log('perfil column already exists in usuarios_admin');
        } else {
            console.error('Error adding perfil column:', error.message);
        }
    }

    // Update existing admin user to have 'administrador' profile
    try {
        await db.exec(`
            UPDATE usuarios_admin
            SET perfil = 'administrador'
            WHERE email = 'admin@fragalanches.com'
        `);
        console.log('Updated admin user profile');
    } catch (error) {
        console.error('Error updating admin profile:', error.message);
    }

    await db.close();
    console.log('Migrations complete!');
}

migrate().catch(console.error);