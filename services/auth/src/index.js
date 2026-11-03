import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config, validateConfig } from '../shared/config/index.js';
import { generalLimiter, authLimiter, sensitiveApiLimiter, createLimiter } from '../shared/middleware/rateLimiter.js';
import { authenticateToken, optionalAuth } from '../shared/middleware/auth.js';
import { commonValidators, authValidators, clienteValidators } from '../shared/middleware/validation.js';
import { query, queryOne, run, transaction } from '../shared/database/connection.js';
import argon2 from 'argon2';
import { generateToken, generateRefreshToken } from '../shared/middleware/auth.js';
import { generateOrderNumber, formatCurrency } from '../shared/utils/index.js';

// Validar configuração
validateConfig();

const app = express();

// Middlewares globais
app.use(helmet({
    contentSecurityPolicy: config.server.env === 'production' ? undefined : false,
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
    res.json({ status: 'ok', service: 'auth', timestamp: new Date().toISOString() });
});

// ============================================
// ROTAS DE AUTENTICAÇÃO ADMIN
// ============================================

// Login admin
app.post('/api/auth/admin/login', authLimiter, authValidators.login, async (req, res) => {
    try {
        const { email, senha } = req.body;

        const user = await queryOne('SELECT * FROM usuarios_admin WHERE email = ? AND ativo = 1', [email]);
        if (!user) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        const valid = await argon2.verify(user.senha_hash, senha);
        if (!valid) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        // Atualizar último login
        await run('UPDATE usuarios_admin SET ultimo_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

        const payload = {
            id: user.id,
            email: user.email,
            nome: user.nome,
            perfil: user.perfil,
            tipo: 'admin'
        };

        const token = generateToken(payload);
        const refreshToken = generateRefreshToken({ id: user.id, tipo: 'admin' });

        res.json({
            token,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                nome: user.nome,
                perfil: user.perfil,
                forcaTrocaSenha: Boolean(user.forca_troca_senha)
            }
        });
    } catch (error) {
        console.error('Login admin error:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Login cliente
app.post('/api/auth/cliente/login', authLimiter, authValidators.login, async (req, res) => {
    try {
        const { email, senha } = req.body;

        const client = await queryOne('SELECT * FROM clientes WHERE email = ? AND ativo = 1', [email]);
        if (!client) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        const valid = await argon2.verify(client.senha_hash, senha);
        if (!valid) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        const payload = {
            id: client.id,
            email: client.email,
            nome: client.nome,
            tipo: 'cliente'
        };

        const token = generateToken(payload);
        const refreshToken = generateRefreshToken({ id: client.id, tipo: 'cliente' });

        res.json({
            token,
            refreshToken,
            user: {
                id: client.id,
                email: client.email,
                nome: client.nome
            }
        });
    } catch (error) {
        console.error('Login cliente error:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Registro cliente
app.post('/api/auth/cliente/register', authLimiter, clienteValidators.create, async (req, res) => {
    try {
        const { nome, email, telefone, senha } = req.body;

        const existing = await queryOne('SELECT 1 FROM clientes WHERE email = ?', [email]);
        if (existing) {
            return res.status(409).json({ error: 'Email já cadastrado' });
        }

        const hash = await argon2.hash(senha, { type: argon2.argon2id });
        const result = await run(
            'INSERT INTO clientes (nome, email, telefone, senha_hash) VALUES (?, ?, ?, ?)',
            [nome, email, telefone, hash]
        );

        const payload = {
            id: result.lastInsertRowid,
            email,
            nome,
            tipo: 'cliente'
        };

        const token = generateToken(payload);
        const refreshToken = generateRefreshToken({ id: result.lastInsertRowid, tipo: 'cliente' });

        res.status(201).json({
            token,
            refreshToken,
            user: { id: result.lastInsertRowid, email, nome }
        });
    } catch (error) {
        console.error('Register cliente error:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Refresh token
app.post('/api/auth/refresh', authLimiter, async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token obrigatório' });
        }

        const decoded = await import('jsonwebtoken').then(jwt =>
            new Promise((resolve, reject) =>
                jwt.verify(refreshToken, config.jwt.secret, (err, decoded) =>
                    err ? reject(err) : resolve(decoded)
                )
            )
        );

        const newToken = generateToken({
            id: decoded.id,
            email: decoded.email,
            nome: decoded.nome,
            perfil: decoded.perfil,
            tipo: decoded.tipo
        });

        const newRefreshToken = generateRefreshToken({ id: decoded.id, tipo: decoded.tipo });

        res.json({ token: newToken, refreshToken: newRefreshToken });
    } catch (error) {
        res.status(401).json({ error: 'Refresh token inválido ou expirado' });
    }
});

// Perfil do usuário logado (admin ou cliente)
app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        if (req.user.tipo === 'admin') {
            const user = await queryOne(
                'SELECT id, email, nome, perfil, forca_troca_senha, ultimo_login FROM usuarios_admin WHERE id = ?',
                [req.user.id]
            );
            if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
            res.json({ user });
        } else {
            const client = await queryOne(
                'SELECT id, email, nome, telefone FROM clientes WHERE id = ?',
                [req.user.id]
            );
            if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });
            res.json({ user: client });
        }
    } catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Alterar senha (admin)
app.put('/api/auth/admin/password', authenticateToken, requireRole('administrador'), authValidators.changePassword, async (req, res) => {
    try {
        const { senhaAtual, novaSenha } = req.body;
        const user = await queryOne('SELECT senha_hash FROM usuarios_admin WHERE id = ?', [req.user.id]);

        const valid = await argon2.verify(user.senha_hash, senhaAtual);
        if (!valid) {
            return res.status(400).json({ error: 'Senha atual incorreta' });
        }

        const hash = await argon2.hash(novaSenha, { type: argon2.argon2id });
        await run(
            'UPDATE usuarios_admin SET senha_hash = ?, forca_troca_senha = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [hash, req.user.id]
        );

        res.json({ message: 'Senha alterada com sucesso' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Alterar senha (cliente)
app.put('/api/auth/cliente/password', authenticateToken, requireRole('cliente'), authValidators.changePassword, async (req, res) => {
    try {
        const { senhaAtual, novaSenha } = req.body;
        const client = await queryOne('SELECT senha_hash FROM clientes WHERE id = ?', [req.user.id]);

        const valid = await argon2.verify(client.senha_hash, senhaAtual);
        if (!valid) {
            return res.status(400).json({ error: 'Senha atual incorreta' });
        }

        const hash = await argon2.hash(novaSenha, { type: argon2.argon2id });
        await run(
            'UPDATE clientes SET senha_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [hash, req.user.id]
        );

        res.json({ message: 'Senha alterada com sucesso' });
    } catch (error) {
        console.error('Change password cliente error:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Função helper para requireRole (duplicada aqui para evitar import circular)
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Autenticação necessária' });
        }
        if (!allowedRoles.includes(req.user.perfil) && !allowedRoles.includes(req.user.tipo)) {
            return res.status(403).json({ error: 'Permissão insuficiente' });
        }
        next();
    };
}

const PORT = config.server.port;
app.listen(PORT, () => {
    console.log(`🔐 Auth Service rodando na porta ${PORT}`);
});

export default app;