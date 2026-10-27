import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

// Use test database in test environment
const isTest = process.env.NODE_ENV === 'test';
const dbFileName = isTest ? 'test_fraga_lanches.db' : 'fraga_lanches.db';
const dbPath = join(__dirname, '..', '..', dbFileName);

// Initialize database connection
let db = null;

export async function getDb() {
    if (!db) {
        db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });
        // Enable foreign keys
        await db.exec('PRAGMA foreign_keys = ON');
    }
    return db;
}

export async function query(sql, params = []) {
    try {
        const database = await getDb();
        const trimmedSql = sql.trim().toUpperCase();
        if (trimmedSql.startsWith('SELECT')) {
            return await database.all(sql, params);
        } else {
            const result = await database.run(sql, params);
            return { lastInsertRowid: result.lastID, changes: result.changes };
        }
    } catch (error) {
        console.error('Database query error:', error.message);
        console.error('SQL:', sql);
        console.error('Params:', params);
        throw error;
    }
}

export async function queryOne(sql, params = []) {
    try {
        const database = await getDb();
        return await database.get(sql, params);
    } catch (error) {
        console.error('Database queryOne error:', error.message);
        throw error;
    }
}

export async function transaction(fn) {
    const database = await getDb();
    return await database.exec('BEGIN TRANSACTION')
        .then(() => fn())
        .then(result => database.exec('COMMIT').then(() => result))
        .catch(error => database.exec('ROLLBACK').then(() => { throw error; }));
}

export async function close() {
    if (db) {
        await db.close();
        db = null;
    }
}

export default {
    query,
    queryOne,
    transaction,
    close,
    getDb
};