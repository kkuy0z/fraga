import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const dbPath = 'C:\\Users\\.kz\\Documents\\Fraga\\fraga\\fraga_lanches.db';

const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
});

const users = await db.all('SELECT id, email, nome, perfil, ativo, senha_hash FROM usuarios_admin');
console.log('Users:', users);