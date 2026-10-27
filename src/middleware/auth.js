import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import db from '../database/connection.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '24h';

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET não configurado. Defina a variável de ambiente JWT_SECRET no arquivo .env');
}

if (process.env.NODE_ENV === 'production' && JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET muito fraco para produção. Use no mínimo 32 caracteres.');
}

export function generateToken(user) {
    // Include all user properties, ensuring required fields are present
    // Include both 'perfil' (backend) and 'role' (frontend compatibility)
    const payload = {
        id: user.id,
        email: user.email,
        nome: user.nome,
        ...user,
        role: user.perfil || user.role
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
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

    // Reject client tokens on admin routes
    if (decoded.tipo === 'cliente') {
        return res.status(401).json({ error: 'Token inválido para esta rota' });
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
            // Check if it's an admin token
            if (!decoded.tipo || decoded.tipo !== 'cliente') {
                db.queryOne('SELECT id, email, nome, perfil, ativo FROM usuarios_admin WHERE id = ?', [decoded.id])
                    .then(user => {
                        if (user && user.ativo) {
                            req.user = user;
                        }
                        next();
                    })
                    .catch(() => next());
            }
            // Check if it's a client token
            else if (decoded.tipo === 'cliente') {
                db.queryOne('SELECT id, nome, email, telefone, ativo FROM clientes WHERE id = ?', [decoded.id])
                    .then(cliente => {
                        if (cliente && cliente.ativo) {
                            req.cliente = cliente;
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
    } else {
        next();
    }
}

// Client authentication middleware
export async function clienteAuthMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token de autenticação não fornecido' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded || decoded.tipo !== 'cliente') {
        return res.status(401).json({ error: 'Token inválido ou expirado' });
    }

    // Verify client still exists and is active
    const cliente = await db.queryOne(
        'SELECT id, nome, email, telefone, ativo FROM clientes WHERE id = ?',
        [decoded.id]
    );

    if (!cliente || !cliente.ativo) {
        return res.status(401).json({ error: 'Cliente não encontrado ou inativo' });
    }

    req.cliente = cliente;
    next();
}