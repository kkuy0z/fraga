import argon2 from 'argon2';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const dbPath = 'C:\\Users\\.kz\\Documents\\Fraga\\fraga\\fraga_lanches.db';

const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
});

const newPassword = 'admin123';
const newHash = await argon2.hash(newPassword, { type: argon2.argon2id });
console.log('New hash:', newHash);

await db.run('UPDATE usuarios_admin SET senha_hash = ? WHERE email = ?', [newHash, 'admin@fragalanches.com']);
console.log('Password reset for admin@fragalanches.com');