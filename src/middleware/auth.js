import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import db from '../database/connection.js';

const JWT_SECRET = process.env.JWT_SECRET || 'fraga-lanches-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

export function generateToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, nome: user.nome, perfil: user.perfil },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

export async function verifyPassword(senha, hash) {
    try {
        return await argon2.verify(hash, senha);
    } catch (error) {
        return false;
    }
}

export async function hashPassword(senha) {
    return await argon2.hash(senha, { type: argon2.argon2id });
}

export async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token de autenticação não fornecido' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded) {
        return res.status(401).json({ error: 'Token inválido ou expirado' });
    }

    // Verify user still exists and is active
    const user = await db.queryOne('SELECT id, email, nome, perfil, ativo FROM usuarios_admin WHERE id = ?', [decoded.id]);

    if (!user || !user.ativo) {
        return res.status(401).json({ error: 'Usuário não encontrado ou inativo' });
    }

    req.user = user;
    next();
}

// Role-based authorization middleware
export function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Autenticação necessária' });
        }

        if (!allowedRoles.includes(req.user.perfil)) {
            return res.status(403).json({ error: 'Acesso negado: permissão insuficiente' });
        }

        next();
    };
}

export function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);

        if (decoded) {
            db.queryOne('SELECT id, email, nome, perfil, ativo FROM usuarios_admin WHERE id = ?', [decoded.id])
                .then(user => {
                    if (user && user.ativo) {
                        req.user = user;
                    }
                    next();
                })
                .catch(() => next());
        } else {
            next();
        }
    } else {
        next();
    }
}