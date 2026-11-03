import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuração centralizada
export const config = {
    // Servidor
    server: {
        port: parseInt(process.env.PORT) || 3000,
        wsPort: parseInt(process.env.WS_PORT) || 3001,
        env: process.env.NODE_ENV || 'development'
    },

    // Banco de dados
    database: {
        path: process.env.DB_PATH || join(__dirname, '..', '..', 'fraga_lanches.db')
    },

    // JWT
    jwt: {
        secret: process.env.JWT_SECRET,
        expiresIn: process.env.JWT_EXPIRES_IN || '8h',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    },

    // Frontend URL (para CORS)
    frontend: {
        url: process.env.FRONTEND_URL || 'http://localhost:3000'
    },

    // Rate limiting
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 min
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
    },

    // Web Push (VAPID)
    webPush: {
        publicKey: process.env.VAPID_PUBLIC_KEY,
        privateKey: process.env.VAPID_PRIVATE_KEY,
        subject: process.env.VAPID_SUBJECT || 'mailto:admin@fragalanches.com'
    },

    // Mercado Pago
    mercadoPago: {
        accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN,
        publicKey: process.env.MERCADO_PAGO_PUBLIC_KEY,
        webhookSecret: process.env.MERCADO_PAGO_WEBHOOK_SECRET
    },

    // Logs
    logging: {
        level: process.env.LOG_LEVEL || 'info'
    }
};

// Validação de configurações críticas
export function validateConfig() {
    const errors = [];

    if (config.server.env === 'production') {
        if (!config.jwt.secret || config.jwt.secret.length < 32) {
            errors.push('JWT_SECRET deve ter pelo menos 32 caracteres em produção');
        }

        if (!config.webPush.publicKey || !config.webPush.privateKey) {
            errors.push('VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY são obrigatórios em produção');
        }

        if (!config.mercadoPago.accessToken) {
            errors.push('MERCADO_PAGO_ACCESS_TOKEN é obrigatório em produção');
        }
    }

    if (errors.length > 0) {
        throw new Error(`Configuração inválida:\n${errors.join('\n')}`);
    }

    return true;
}

export default config;