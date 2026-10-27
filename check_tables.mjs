import db from './src/database/connection.js';
const tables = await db.query('SELECT name FROM sqlite_master WHERE type="table" ORDER BY name');
console.log(JSON.stringify(tables.map(t => t.name), null, 2));