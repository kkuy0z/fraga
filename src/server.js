import './config/env.js';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { fileURLToPath } from 'url';
import { join, resolve } from 'path';

import authRoutes from './routes/auth.js';
import clientesRoutes from './routes/clientes.js';
import categoriasRoutes from './routes/categorias.js';
import produtosRoutes from './routes/produtos.js';
import horariosRoutes from './routes/horarios.js';
import entregaRoutes from './routes/entrega.js';
import entregasRoutes from './routes/entregas.js';
import pagamentosRoutes from './routes/pagamentos.js';
import pedidosRoutes from './routes/pedidos.js';
import notificacoesRoutes from './routes/notificacoes.js';
import avaliacoesRoutes from './routes/avaliacoes.js';
import relatoriosRoutes from './routes/relatorios.js';
import { apiLimiter } from './middleware/rateLimiter.js';

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

// Serve static files - serve inicio at root for proper relative paths
app.use(express.static(join(__dirname, '..', 'inicio')));
app.use('/img', express.static(join(__dirname, '..', 'img')));

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