import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token de acesso requerido' });
    }

    jwt.verify(token, config.jwt.secret, (err, user) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ error: 'Token expirado', code: 'TOKEN_EXPIRED' });
            }
            return res.status(403).json({ error: 'Token inválido' });
        }
        req.user = user;
        next();
    });
}

export function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return next();
    }

    jwt.verify(token, config.jwt.secret, (err, user) => {
        if (!err) {
            req.user = user;
        }
        next();
    });
}

export function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Autenticação necessária' });
        }

        if (!allowedRoles.includes(req.user.perfil)) {
            return res.status(403).json({ error: 'Permissão insuficiente para esta ação' });
        }

        next();
    };
}

export function requireAdmin(req, res, next) {
    return requireRole('administrador')(req, res, next);
}

export function requireAtendenteOuAdmin(req, res, next) {
    return requireRole('administrador', 'atendente')(req, res, next);
}

export function requireCozinhaOuAdmin(req, res, next) {
    return requireRole('administrador', 'cozinha')(req, res, next);
}

export function requireEntregadorOuAdmin(req, res, next) {
    return requireRole('administrador', 'entregador')(req, res, next);
}

export function requireCliente(req, res, next) {
    if (!req.user || req.user.tipo !== 'cliente') {
        return res.status(403).json({ error: 'Acesso restrito a clientes' });
    }
    next();
}

export function generateToken(payload) {
    return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
}

export function generateRefreshToken(payload) {
    return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.refreshExpiresIn });
}

export function verifyToken(token) {
    return jwt.verify(token, config.jwt.secret);
}

export default {
    authenticateToken,
    optionalAuth,
    requireRole,
    requireAdmin,
    requireAtendenteOuAdmin,
    requireCozinhaOuAdmin,
    requireEntregadorOuAdmin,
    requireCliente,
    generateToken,
    generateRefreshToken,
    verifyToken
};