import { initializeDatabase } from '../../shared/database/init.js';

// Executar inicialização do banco de dados compartilhado
initializeDatabase().catch(console.error);