import sqlite from 'better-sqlite3';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

const dbPath = process.env.DB_PATH || join(__dirname, '..', '..', 'fraga_lanches.db');
const db = new sqlite(dbPath);

db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

function query(sql, params = []) {
    try {
        const stmt = db.prepare(sql);
        return stmt.all(params);
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
}

function queryOne(sql, params = []) {
    try {
        const stmt = db.prepare(sql);
        return stmt.get(params);
    } catch (error) {
        console.error('Database queryOne error:', error);
        throw error;
    }
}

function run(sql, params = []) {
    try {
        const stmt = db.prepare(sql);
        return stmt.run(params);
    } catch (error) {
        console.error('Database run error:', error);
        throw error;
    }
}

function transaction(callback) {
    const txn = db.transaction(callback);
    return txn();
}

export { db, query, queryOne, run, transaction };
export default { query, queryOne, run, transaction };