import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000; // 15 minutos
const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10; // 10 requisições por janela

// Custom key generator to properly handle proxied IPs with IPv6 support
const customKeyGenerator = (req) => {
    // Use x-forwarded-for if behind proxy (trust proxy is enabled)
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        // Get the first IP in the chain (client IP)
        const clientIp = forwarded.split(',')[0].trim();
        // Use the library's ipKeyGenerator to properly format IPv6 addresses
        return ipKeyGenerator({ ip: clientIp });
    }
    // Fallback to library's ipKeyGenerator for proper IPv6 handling
    return ipKeyGenerator(req);
};

// Custom handler to log rate limit events
const rateLimitHandler = (req, res, next, options) => {
    console.warn(`Rate limit exceeded for IP: ${customKeyGenerator(req)} on ${req.path}`);
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