import rateLimit from 'express-rate-limit';
import { ipKeyGenerator } from 'express-rate-limit';
import { config } from '../config/index.js';

// Rate limiter geral
export const generalLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: { error: 'Muitas requisições, tente novamente mais tarde' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: ipKeyGenerator,
    skip: (req) => config.server.env === 'development'
});

// Rate limiter para autenticação (mais restritivo)
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10, // 10 tentativas por janela
    message: { error: 'Muitas tentativas de login, tente novamente em 15 minutos' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: ipKeyGenerator,
    skipSuccessfulRequests: true,
    skip: (req) => config.server.env === 'development'
});

// Rate limiter para APIs sensíveis
export const sensitiveApiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 30, // 30 requisições por minuto
    message: { error: 'Limite de requisições excedido' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: ipKeyGenerator,
    skip: (req) => config.server.env === 'development'
});

// Rate limiter para upload/criação
export const createLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 20, // 20 criações por minuto
    message: { error: 'Muitas criações, aguarde um momento' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: ipKeyGenerator,
    skip: (req) => config.server.env === 'development'
});

// Rate limiter para WebSocket connections
export const wsConnectionLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 50, // 50 conexões por minuto por IP
    message: { error: 'Muitas conexões WebSocket, tente novamente mais tarde' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: ipKeyGenerator,
    skip: (req) => config.server.env === 'development'
});

export default {
    generalLimiter,
    authLimiter,
    sensitiveApiLimiter,
    createLimiter,
    wsConnectionLimiter
};