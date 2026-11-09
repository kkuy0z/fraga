import './src/config/env.js';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { fileURLToPath } from 'url';
import { join, resolve } from 'path';

import authRoutes from './src/routes/auth.js';
import clientesRoutes from './src/routes/clientes.js';
import categoriasRoutes from './src/routes/categorias.js';
import produtosRoutes from './src/routes/produtos.js';
import horariosRoutes from './src/routes/horarios.js';
import entregaRoutes from './src/routes/entrega.js';
import entregasRoutes from './src/routes/entregas.js';
import pagamentosRoutes from './src/routes/pagamentos.js';
import pedidosRoutes from './src/routes/pedidos.js';
import notificacoesRoutes from './src/routes/notificacoes.js';
import avaliacoesRoutes from './src/routes/avaliacoes.js';
import relatoriosRoutes from './src/routes/relatorios.js';
import fidelidadeRoutes from './src/routes/fidelidade.js';
import { apiLimiter } from './src/middleware/rateLimiter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for rate limiter (when behind nginx/reverse proxy) - MUST be before rate limiter middleware
app.set('trust proxy', true);

// Security headers with Helmet
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            scriptSrc: ["'self'"],
            connectSrc: ["'self'", process.env.FRONTEND_URL || "http://localhost:3000"],
            frameAncestors: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"]
        }
    },
    crossOriginEmbedderPolicy: false, // Required for some APIs
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

// CORS configuration - restrict in production
const corsOptions = {
    origin: process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? false : 'http://localhost:3000'),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 86400 // 24 hours
};
app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// HTTPS enforcement in production (behind reverse proxy)
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        if (req.header('x-forwarded-proto') !== 'https') {
            return res.redirect(`https://${req.header('host')}${req.url}`);
        }
        next();
    });
}

// Serve static files - serve built React app from dist/frontend
app.use(express.static(join(__dirname, 'dist', 'frontend')));
app.use('/img', express.static(join(__dirname, 'img')));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Apply general API rate limiter to all API routes
app.use('/api', apiLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/categorias', categoriasRoutes);
app.use('/api/produtos', produtosRoutes);
app.use('/api/horarios', horariosRoutes);
app.use('/api/entrega', entregaRoutes);
app.use('/api/entregas', entregasRoutes);
app.use('/api/pagamentos', pagamentosRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/notificacoes', notificacoesRoutes);
app.use('/api/avaliacoes', avaliacoesRoutes);
app.use('/api/relatorios', relatoriosRoutes);
app.use('/api/fidelidade', fidelidadeRoutes);

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
    res.sendFile(join(__dirname, 'dist', 'frontend', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📱 Frontend: http://localhost:${PORT}`);
    console.log(`🔧 API: http://localhost:${PORT}/api`);
    console.log(`📄 Health check: http://localhost:${PORT}/api/health`);
});

export default app;