// Set test environment variables BEFORE any other imports
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only-minimum-32-chars-long';
process.env.DB_PATH = './test_fraga_lanches.db';
process.env.RATE_LIMIT_WINDOW_MS = '60000';
process.env.RATE_LIMIT_MAX_REQUESTS = '100';

import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { join } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

// Test database path - must match connection.js path
const testDbPath = join(__dirname, 'test_fraga_lanches.db');

// Global test database connection
let testDb = null;

// Initialize test database connection before all tests
beforeAll(async () => {
  testDb = await open({
    filename: testDbPath,
    driver: sqlite3.Database
  });

  await testDb.exec('PRAGMA foreign_keys = ON');
  console.log('Test database connection opened');
});

// Clean up after each test - clear data but keep schema
afterEach(async () => {
  if (testDb) {
    // Clear test data but keep schema and seed data
    await testDb.exec('DELETE FROM pedidos');
    await testDb.exec('DELETE FROM pedido_itens');
    await testDb.exec('DELETE FROM pedido_item_personalizacoes');
    await testDb.exec('DELETE FROM clientes WHERE id > 1'); // Keep test client (id=1)
    await testDb.exec('DELETE FROM enderecos_cliente');
  }
});

// Close database after all tests
afterAll(async () => {
  if (testDb) {
    await testDb.close();
    console.log('Test database connection closed');
  }
  // Note: globalTeardown will remove the test database file
});

// Export test database for use in tests
global.testDb = testDb;