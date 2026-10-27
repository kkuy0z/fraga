// Global teardown - runs once after all test suites
import { join } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

const testDbPath = join(__dirname, '..', 'test_fraga_lanches.db');

export default async function globalTeardown() {
  // Remove test database file
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
    console.log('Test database file removed');
  }
}