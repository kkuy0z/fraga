import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { config, validateConfig } from '../shared/config/index.js';
import { generalLimiter } from '../shared/middleware/rateLimiter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

// Validar configuração
validateConfig();

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

const app = express();

// Middlewares globais
app.use(helmet({
    contentSecurityPolicy: config.server.env === 'production' ? {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "ws:", "wss:"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'self'"]
        }
    } : false,
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
    res.json({ status: 'ok', service: 'frontend', timestamp: new Date().toISOString() });
});

// ============================================
// SERVIR ARQUIVOS ESTÁTICOS
// ============================================

const staticPath = join(__dirname, '..', '..', 'inicio');

app.use(express.static(staticPath, {
    maxAge: config.server.env === 'production' ? '1d' : 0,
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
        // Cache headers para assets
        if (path.match(/\.(js|css|png|jpg|jpeg|webp|svg|ico|woff|woff2)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=86400');
        }
        // Service Worker não deve ser cacheado
        if (path.endsWith('service-worker.js')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Service-Worker-Allowed', '/');
        }
        // Manifest
        if (path.endsWith('manifest.json')) {
            res.setHeader('Cache-Control', 'public, max-age=3600');
        }
    }
}));

// ============================================
// SPA FALLBACK
// ============================================

app.get('*', (req, res) => {
    // Não interceptar API routes
    if (req.path.startsWith('/api/') || req.path.startsWith('/health')) {
        return res.status(404).json({ error: 'Não encontrado' });
    }

    res.sendFile(join(staticPath, 'index.html'), (err) => {
        if (err) {
            console.error('Erro ao servir index.html:', err);
            res.status(500).send('Erro ao carregar aplicação');
        }
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('[Frontend] Error:', err);
    res.status(500).send('Erro interno do servidor');
});

const PORT = config.server.port + 9; // 3009
app.listen(PORT, () => {
    console.log(`🌐 Frontend Service rodando na porta ${PORT}`);
    console.log(`   Servindo arquivos de: ${staticPath}`);
});

export default app;