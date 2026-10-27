import dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });

import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { join } from 'path';

import authRoutes from './src/routes/auth.js';
import clientesRoutes from './src/routes/clientes.js';
import categoriasRoutes from './src/routes/categorias.js';
import produtosRoutes from './src/routes/produtos.js';
import horariosRoutes from './src/routes/horarios.js';
import entregaRoutes from './src/routes/entrega.js';
import pagamentosRoutes from './src/routes/pagamentos.js';
import pedidosRoutes from './src/routes/pedidos.js';

// Override database connection for tests
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { join as pathJoin } from 'path';
import { fileURLToPath as fileURLToPath2 } from 'url';

const __filename = fileURLToPath2(import.meta.url);
const __dirname = pathJoin(__filename, '..');
const testDbPath = pathJoin(__dirname, '..', 'test_fraga_lanches.db');

let testDb = null;

async function getTestDb() {
  if (!testDb) {
    testDb = await open({
      filename: testDbPath,
      driver: sqlite3.Database
    });
    await testDb.exec('PRAGMA foreign_keys = ON');
  }
  return testDb;
}

export async function query(sql, params = []) {
  try {
    const database = await getTestDb();
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
    const database = await getTestDb();
    return await database.get(sql, params);
  } catch (error) {
    console.error('Database queryOne error:', error.message);
    throw error;
  }
}

export async function transaction(fn) {
  const database = await getTestDb();
  return await database.exec('BEGIN TRANSACTION')
    .then(() => fn())
    .then(result => database.exec('COMMIT').then(() => result))
    .catch(error => database.exec('ROLLBACK').then(() => { throw error; }));
}

export async function close() {
  if (testDb) {
    await testDb.close();
    testDb = null;
  }
}

const testDbModule = {
  query,
  queryOne,
  transaction,
  close,
  getDb: getTestDb
};

export default testDbModule;

// Replace the database connection in routes
import * as authMiddleware from './src/middleware/auth.js';
import * as connectionModule from './src/database/connection.js';

// Monkey-patch the database connection
Object.assign(connectionModule, testDbModule);
Object.assign(authMiddleware, { default: testDbModule });