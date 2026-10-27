import rateLimit from 'express-rate-limit';

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000; // 15 minutos
const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10; // 10 requisições por janela

export const authLimiter = rateLimit({
    windowMs,
    max: maxRequests,
    message: {
        error: 'Muitas tentativas de login. Tente novamente em 15 minutos.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

export const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 5, // 5 registros por hora por IP
    message: {
        error: 'Muitos registros. Tente novamente em 1 hora.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

export const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 60, // 60 requisições por minuto
    message: {
        error: 'Muitas requisições. Aguarde um momento.'
    },
    standardHeaders: true,
    legacyHeaders: false
});