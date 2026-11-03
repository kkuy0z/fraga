import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { config, validateConfig } from '../shared/config/index.js';
import { generalLimiter, authLimiter, sensitiveApiLimiter } from '../shared/middleware/rateLimiter.js';

// Validar configuração
validateConfig();

const app = express();

// Middlewares globais
app.use(helmet({
    contentSecurityPolicy: config.server.env === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false
}));
app.use(cors({
    origin: config.server.env === 'production' ? config.frontend.url : true,
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(generalLimiter);

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'api-gateway',
        timestamp: new Date().toISOString(),
        services: {
            auth: `http://localhost:${config.server.port}`,
            menu: `http://localhost:${config.server.port + 1}`,
            order: `http://localhost:${config.server.port + 2}`,
            client: `http://localhost:${config.server.port + 3}`,
            delivery: `http://localhost:${config.server.port + 4}`,
            notification: `http://localhost:${config.server.port + 5}`,
            report: `http://localhost:${config.server.port + 6}`,
            review: `http://localhost:${config.server.port + 7}`,
            payment: `http://localhost:${config.server.port + 8}`
        }
    });
});

// ============================================
// PROXY CONFIGURATION
// ============================================

const services = {
    auth: { target: `http://localhost:${config.server.port}`, prefix: '/api/auth' },
    menu: { target: `http://localhost:${config.server.port + 1}`, prefix: '/api' },
    order: { target: `http://localhost:${config.server.port + 2}`, prefix: '/api' },
    client: { target: `http://localhost:${config.server.port + 3}`, prefix: '/api' },
    delivery: { target: `http://localhost:${config.server.port + 4}`, prefix: '/api' },
    notification: { target: `http://localhost:${config.server.port + 5}`, prefix: '/api' },
    report: { target: `http://localhost:${config.server.port + 6}`, prefix: '/api' },
    review: { target: `http://localhost:${config.server.port + 7}`, prefix: '/api' },
    payment: { target: `http://localhost:${config.server.port + 8}`, prefix: '/api' }
};

// Criar proxies para cada serviço
function createServiceProxy(serviceName, serviceConfig) {
    return createProxyMiddleware({
        target: serviceConfig.target,
        changeOrigin: true,
        pathRewrite: {
            [`^${serviceConfig.prefix}`]: '/api' // Reescrever /api/... para /api/... no serviço
        },
        onProxyReq: (proxyReq, req, res) => {
            // Log para debug
            console.log(`[Gateway] ${req.method} ${req.originalUrl} -> ${serviceName}`);
        },
        onError: (err, req, res) => {
            console.error(`[Gateway] Error proxying to ${serviceName}:`, err.message);
            if (!res.headersSent) {
                res.status(502).json({ error: `Serviço ${serviceName} indisponível` });
            }
        },
        onProxyRes: (proxyRes, req, res) => {
            // Adicionar header de serviço
            res.setHeader('X-Served-By', serviceName);
        }
    });
}

// ============================================
// ROUTE MAPPING
// ============================================

// Auth routes -> Auth Service
app.use('/api/auth', createServiceProxy('auth', services.auth));
app.use('/api/auth', authLimiter); // Rate limit extra para auth

// Menu routes (categorias, produtos, personalizacoes, horarios, formas-pagamento, config-entrega) -> Menu Service
app.use('/api/categorias', createServiceProxy('menu', services.menu));
app.use('/api/produtos', createServiceProxy('menu', services.menu));
app.use('/api/personalizacoes', createServiceProxy('menu', services.menu));
app.use('/api/horarios', createServiceProxy('menu', services.menu));
app.use('/api/formas-pagamento', createServiceProxy('menu', services.menu));
app.use('/api/config-entrega', createServiceProxy('menu', services.menu));

// Order routes (pedidos) -> Order Service
app.use('/api/pedidos', createServiceProxy('order', services.order));
app.use('/api/admin/pedidos', createServiceProxy('order', services.order));

// Client routes -> Client Service
app.use('/api/cliente', createServiceProxy('client', services.client));
app.use('/api/admin/clientes', createServiceProxy('client', services.client));

// Delivery routes -> Delivery Service
app.use('/api/entregas', createServiceProxy('delivery', services.delivery));
app.use('/api/admin/entregas', createServiceProxy('delivery', services.delivery));
app.use('/api/cliente/entregas', createServiceProxy('delivery', services.delivery));

// Notification routes -> Notification Service
app.use('/api/notificacoes', createServiceProxy('notification', services.notification));
app.use('/api/push', createServiceProxy('notification', services.notification));

// Report routes -> Report Service
app.use('/api/relatorios', createServiceProxy('report', services.report));

// Review routes -> Review Service
app.use('/api/avaliacoes', createServiceProxy('review', services.review));
app.use('/api/admin/avaliacoes', createServiceProxy('review', services.review));

// Payment routes -> Payment Service
app.use('/api/pagamentos', createServiceProxy('payment', services.payment));

// ============================================
// FALLBACK PARA ROTAS NÃO ENCONTRADAS
// ============================================

app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'Endpoint não encontrado', path: req.originalUrl });
});

// ============================================
// SERVIR ARQUIVOS ESTÁTICOS (FRONTEND)
// ============================================

import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

app.use(express.static(join(__dirname, '..', '..', 'inicio'), {
    maxAge: config.server.env === 'production' ? '1d' : 0,
    etag: true
}));

// SPA fallback - servir index.html para rotas não-API
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/health')) {
        return next();
    }
    res.sendFile(join(__dirname, '..', '..', 'inicio', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
    console.error('[Gateway] Error:', err);
    res.status(500).json({ error: 'Erro interno do gateway' });
});

const PORT = config.server.port - 1; // 2999 (gateway na porta principal)
app.listen(PORT, () => {
    console.log(`🚪 API Gateway rodando na porta ${PORT}`);
    console.log(`   Frontend servido em http://localhost:${PORT}`);
    console.log(`   API disponível em http://localhost:${PORT}/api`);
});

export default app;