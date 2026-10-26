import jwt from 'jsonwebtoken';
import db from '../database/connection.js';

const JWT_SECRET = process.env.JWT_SECRET || 'fraga-lanches-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

export function generateToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, nome: user.nome },
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
    const user = db.prepare('SELECT id, email, nome, ativo FROM usuarios_admin WHERE id = ?').get(decoded.id);

    if (!user || !user.ativo) {
        return res.status(401).json({ error: 'Usuário não encontrado ou inativo' });
    }

    req.user = user;
    next();
}

export function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);

        if (decoded) {
            const user = db.prepare('SELECT id, email, nome, ativo FROM usuarios_admin WHERE id = ?').get(decoded.id);
            if (user && user.ativo) {
                req.user = user;
            }
        }
    }

    next();
}