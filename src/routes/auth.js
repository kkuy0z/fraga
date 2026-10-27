import express from 'express';
import db from '../database/connection.js';
import { generateToken, verifyToken, authMiddleware, verifyPassword, hashPassword, requireRole } from '../middleware/auth.js';
import { authValidators } from '../middleware/validation.js';
import { authLimiter, registerLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Login
router.post('/login', authLimiter, authValidators.login, async (req, res) => {
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
                perfil: user.perfil,
                forca_troca_senha: user.forca_troca_senha === 1
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
            nome: req.user.nome,
            perfil: req.user.perfil
        }
    });
});

// Register new admin user (admin only)
router.post('/register', authMiddleware, requireRole('administrador'), registerLimiter, authValidators.register, async (req, res) => {
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

// List all admin users (admin only)
router.get('/usuarios', authMiddleware, requireRole('administrador'), async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', role = '', status = '' } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE 1=1';
        const params = [];

        if (search) {
            whereClause += ' AND (nome LIKE ? OR email LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        if (role) {
            whereClause += ' AND perfil = ?';
            params.push(role);
        }

        if (status !== '') {
            whereClause += ' AND ativo = ?';
            params.push(status === 'true' ? 1 : 0);
        }

        const countResult = await db.queryOne(`SELECT COUNT(*) as total FROM usuarios_admin ${whereClause}`, params);
        const total = countResult.total;

        const usuarios = await db.query(
            `SELECT id, email, nome, perfil, ativo, ultimo_login, created_at
             FROM usuarios_admin
             ${whereClause}
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );

        res.json({
            data: usuarios,
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Error fetching admin users:', error);
        res.status(500).json({ error: 'Erro ao buscar usuários' });
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
        await db.query('UPDATE usuarios_admin SET senha_hash = ?, forca_troca_senha = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [novaSenhaHash, req.user.id]);

        res.json({ message: 'Senha alterada com sucesso' });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ error: 'Erro ao alterar senha' });
    }
});

// Update admin user (admin only)
router.put('/usuarios/:id', authMiddleware, requireRole('administrador'), async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, email, perfil, ativo, forca_troca_senha, senha } = req.body;

        // Não permitir editar a si mesmo para remover admin
        if (parseInt(id) === req.user.id && perfil && perfil !== 'administrador') {
            return res.status(400).json({ error: 'Você não pode alterar seu próprio perfil de administrador' });
        }

        // Não permitir desativar a si mesmo
        if (parseInt(id) === req.user.id && ativo === false) {
            return res.status(400).json({ error: 'Você não pode desativar seu próprio usuário' });
        }

        const usuario = await db.queryOne('SELECT * FROM usuarios_admin WHERE id = ?', [id]);
        if (!usuario) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        const updates = [];
        const params = [];

        if (nome !== undefined) { updates.push('nome = ?'); params.push(nome); }
        if (email !== undefined) {
            // Verificar se email já existe em outro usuário
            const existing = await db.queryOne('SELECT id FROM usuarios_admin WHERE email = ? AND id != ?', [email, id]);
            if (existing) {
                return res.status(400).json({ error: 'E-mail já cadastrado em outro usuário' });
            }
            updates.push('email = ?'); params.push(email);
        }
        if (perfil !== undefined) { updates.push('perfil = ?'); params.push(perfil); }
        if (ativo !== undefined) { updates.push('ativo = ?'); params.push(ativo ? 1 : 0); }
        if (forca_troca_senha !== undefined) { updates.push('forca_troca_senha = ?'); params.push(forca_troca_senha ? 1 : 0); }
        if (senha) {
            const senhaHash = await hashPassword(senha);
            updates.push('senha_hash = ?'); params.push(senhaHash);
            updates.push('forca_troca_senha = 0');
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nenhum campo para atualizar' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(id);

        await db.query(`UPDATE usuarios_admin SET ${updates.join(', ')} WHERE id = ?`, params);

        const updated = await db.queryOne('SELECT id, email, nome, perfil, ativo, forca_troca_senha, ultimo_login, created_at FROM usuarios_admin WHERE id = ?', [id]);
        res.json(updated);
    } catch (error) {
        console.error('Error updating admin user:', error);
        res.status(500).json({ error: 'Erro ao atualizar usuário' });
    }
});

// Delete admin user (admin only)
router.delete('/usuarios/:id', authMiddleware, requireRole('administrador'), async (req, res) => {
    try {
        const { id } = req.params;

        // Não permitir excluir a si mesmo
        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ error: 'Você não pode excluir seu próprio usuário' });
        }

        const usuario = await db.queryOne('SELECT * FROM usuarios_admin WHERE id = ?', [id]);
        if (!usuario) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        await db.query('DELETE FROM usuarios_admin WHERE id = ?', [id]);
        res.json({ message: 'Usuário excluído com sucesso' });
    } catch (error) {
        console.error('Error deleting admin user:', error);
        res.status(500).json({ error: 'Erro ao excluir usuário' });
    }
});

export default router;