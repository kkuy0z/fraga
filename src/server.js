import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { join, resolve } from 'path';

import authRoutes from './routes/auth.js';
import categoriasRoutes from './routes/categorias.js';
import produtosRoutes from './routes/produtos.js';
import horariosRoutes from './routes/horarios.js';
import entregaRoutes from './routes/entrega.js';
import pagamentosRoutes from './routes/pagamentos.js';
import pedidosRoutes from './routes/pedidos.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(join(__dirname, '..', 'public')));
app.use('/inicio', express.static(join(__dirname, '..', 'inicio')));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
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

// Serve frontend for non-API routes (SPA fallback)
app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '..', 'inicio', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📱 Frontend: http://localhost:${PORT}`);
    console.log(`🔧 API: http://localhost:${PORT}/api`);
    console.log(`📄 Health check: http://localhost:${PORT}/api/health`);
});

export default app;