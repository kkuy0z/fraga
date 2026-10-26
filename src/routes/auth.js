import express from 'express';
import db from '../database/connection.js';
import { generateToken, verifyToken, authMiddleware, verifyPassword, hashPassword, requireRole } from '../middleware/auth.js';
import { authValidators } from '../middleware/validation.js';

const router = express.Router();

// Login
router.post('/login', authValidators.login, async (req, res) => {
    try {
        const { email, senha } = req.body;

        const user = await db.queryOne('SELECT * FROM usuarios_admin WHERE email = ?', [email]);
        if (!user) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        if (!user.ativo) {
            return res.status(401).json({ error: 'Usuário inativo' });
        }

        const validPassword = await verifyPassword(senha, user.senha_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        // Update last login
        await db.query('UPDATE usuarios_admin SET ultimo_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

        const token = generateToken(user);

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                nome: user.nome,
                perfil: user.perfil
            }
        });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).json({ error: 'Erro ao fazer login' });
    }
});

// Verify token
router.get('/verify', authMiddleware, async (req, res) => {
    res.json({
        user: {
            id: req.user.id,
            email: req.user.email,
            nome: req.user.nome
        }
    });
});

// Register new admin user (admin only)
router.post('/register', authMiddleware, requireRole('administrador'), authValidators.register, async (req, res) => {
    try {
        const { email, senha, nome, perfil = 'atendente' } = req.body;

        const existing = await db.queryOne('SELECT id FROM usuarios_admin WHERE email = ?', [email]);
        if (existing) {
            return res.status(400).json({ error: 'E-mail já cadastrado' });
        }

        const senhaHash = await hashPassword(senha);

        const result = await db.query('INSERT INTO usuarios_admin (email, senha_hash, nome, perfil) VALUES (?, ?, ?, ?)', [email, senhaHash, nome, perfil]);

        const user = await db.queryOne('SELECT id, email, nome, perfil, created_at FROM usuarios_admin WHERE id = ?', [result.lastInsertRowid]);

        res.status(201).json(user);
    } catch (error) {
        console.error('Error registering admin user:', error);
        res.status(500).json({ error: 'Erro ao cadastrar usuário' });
    }
});

// Change password (authenticated user)
router.put('/password', authMiddleware, async (req, res) => {
    try {
        const { senha_atual, nova_senha } = req.body;

        if (!senha_atual || !nova_senha) {
            return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias' });
        }

        if (nova_senha.length < 6) {
            return res.status(400).json({ error: 'Nova senha deve ter no mínimo 6 caracteres' });
        }

        const user = await db.queryOne('SELECT senha_hash FROM usuarios_admin WHERE id = ?', [req.user.id]);
        const validPassword = await verifyPassword(senha_atual, user.senha_hash);

        if (!validPassword) {
            return res.status(401).json({ error: 'Senha atual incorreta' });
        }

        const novaSenhaHash = await hashPassword(nova_senha);
        await db.query('UPDATE usuarios_admin SET senha_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [novaSenhaHash, req.user.id]);

        res.json({ message: 'Senha alterada com sucesso' });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ error: 'Erro ao alterar senha' });
    }
});

export default router;