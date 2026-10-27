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

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for rate limiter
app.set('trust proxy', true);

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/categorias', categoriasRoutes);
app.use('/api/produtos', produtosRoutes);
app.use('/api/horarios', horariosRoutes);
app.use('/api/entrega', entregaRoutes);
app.use('/api/pagamentos', pagamentosRoutes);
app.use('/api/pedidos', pedidosRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: 'Erro interno do servidor',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'Rota não encontrada' });
});

export default app;