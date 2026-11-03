import rateLimit from 'express-rate-limit';

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000; // 15 minutos
const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10; // 10 requisições por janela

// Custom key generator to properly handle proxied IPs
const ipKeyGenerator = (req) => {
    // Use x-forwarded-for if behind proxy (trust proxy is enabled)
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return req.ip || req.connection?.remoteAddress || 'unknown';
};

// Custom handler to log rate limit events
const rateLimitHandler = (req, res, next, options) => {
    console.warn(`Rate limit exceeded for IP: ${ipKeyGenerator(req)} on ${req.path}`);
    res.status(429).json(options.message);
};

export const authLimiter = rateLimit({
    windowMs,
    max: maxRequests,
    message: {
        error: 'Muitas tentativas de login. Tente novamente em 15 minutos.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: ipKeyGenerator,
    handler: rateLimitHandler,
    skipSuccessfulRequests: false,
    skipFailedRequests: false
});

export const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 5, // 5 registros por hora por IP
    message: {
        error: 'Muitos registros. Tente novamente em 1 hora.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: ipKeyGenerator,
    handler: rateLimitHandler
});

export const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 60, // 60 requisições por minuto
    message: {
        error: 'Muitas requisições. Aguarde um momento.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: ipKeyGenerator,
    handler: rateLimitHandler
});