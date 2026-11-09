import { Router } from 'express';
import {
    db,
    generateId,
    hashPassword,
    verifyPassword
} from '../db/database.js';

import { verifyToken } from './auth.js';

export const adminRouter = Router();

function autenticarAdmin(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = token ? verifyToken(token) : null;

    if (!user || user.tipo !== 'admin') {
        return res.status(401).json({ erro: 'Acesso não autorizado.' });
    }

    const admin = db.prepare(
        'SELECT * FROM users WHERE id = ? AND ativo = 1'
    ).get(user.id);

    if (!admin) {
        return res.status(401).json({ erro: 'Usuário inválido.' });
    }

    req.admin = admin;
    next();
}

adminRouter.use(autenticarAdmin);

adminRouter.get('/usuarios', (req, res) => {
    try {
        const { busca, perfil, ativo, pagina = 1, limite = 10 } = req.query;

        let sql = 'SELECT id, nome, email, role, ativo, criado_em FROM users WHERE 1=1';
        const params = [];

        if (busca) {
            sql += ' AND (nome LIKE ? OR email LIKE ?)';
            params.push(`%${busca}%`, `%${busca}%`);
        }

        if (perfil) {
            sql += ' AND role = ?';
            params.push(perfil);
        }

        if (ativo !== undefined) {
            sql += ' AND ativo = ?';
            params.push(ativo === 'true' ? 1 : 0);
        }

        const total = db.prepare(
            sql.replace('SELECT id, nome, email, role, ativo, criado_em', 'SELECT COUNT(*) AS total')
        ).get(...params).total;

        sql += ' ORDER BY nome LIMIT ? OFFSET ?';
        params.push(Number(limite), (Number(pagina) - 1) * Number(limite));

        const usuarios = db.prepare(sql).all(...params).map(u => ({
            ...u,
            perfil: u.role
        }));

        res.json({ usuarios, total });
    } catch {
        res.status(500).json({ erro: 'Erro ao buscar usuários.' });
    }
});

adminRouter.post('/usuarios', (req, res) => {
    try {
        const { nome, email, senha, perfil } = req.body;

        if (!nome || !email || !senha || senha.length < 8) {
            return res.status(400).json({ erro: 'Dados inválidos. A senha deve ter ao menos 8 caracteres.' });
        }

        const id = generateId();

        db.prepare(`
            INSERT INTO users (id, nome, email, senha_hash, role, ativo)
            VALUES (?, ?, ?, ?, ?, 1)
        `).run(id, nome, email.toLowerCase(), hashPassword(senha), perfil || 'atendente');

        res.status(201).json({ id, mensagem: 'Usuário criado.' });
    } catch {
        res.status(400).json({ erro: 'Não foi possível criar o usuário. Verifique se o e-mail já existe.' });
    }
});

adminRouter.put('/usuarios/:id', (req, res) => {
    try {
        const { nome, email, senha, perfil, ativo } = req.body;
        const usuario = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);

        if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
        if (usuario.id === req.admin.id) {
            return res.status(403).json({ erro: 'Não edite seu próprio usuário por esta rota.' });
        }

        db.prepare(`
            UPDATE users
            SET nome = ?, email = ?, role = ?, ativo = ?, atualizado_em = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(nome, email.toLowerCase(), perfil || usuario.role, ativo === false ? 0 : 1, req.params.id);

        if (senha) {
            if (senha.length < 8) return res.status(400).json({ erro: 'Senha muito curta.' });
            db.prepare('UPDATE users SET senha_hash = ? WHERE id = ?')
                .run(hashPassword(senha), req.params.id);
        }

        res.json({ mensagem: 'Usuário atualizado.' });
    } catch {
        res.status(400).json({ erro: 'Erro ao atualizar usuário.' });
    }
});

adminRouter.delete('/usuarios/:id', (req, res) => {
    if (req.params.id === req.admin.id) {
        return res.status(403).json({ erro: 'Você não pode excluir seu próprio usuário.' });
    }

    const result = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);

    if (!result.changes) return res.status(404).json({ erro: 'Usuário não encontrado.' });

    res.json({ mensagem: 'Usuário excluído.' });
});

adminRouter.put('/senha', (req, res) => {
    try {
        const { senha_atual, nova_senha } = req.body;

        if (!verifyPassword(senha_atual, req.admin.senha_hash)) {
            return res.status(400).json({ erro: 'Senha atual incorreta.' });
        }

        if (!nova_senha || nova_senha.length < 8) {
            return res.status(400).json({ erro: 'A nova senha deve ter ao menos 8 caracteres.' });
        }

        db.prepare('UPDATE users SET senha_hash = ? WHERE id = ?')
            .run(hashPassword(nova_senha), req.admin.id);

        res.json({ mensagem: 'Senha alterada.' });
    } catch {
        res.status(500).json({ erro: 'Erro ao alterar senha.' });
    }
});

adminRouter.get('/dashboard', (req, res) => {
    try {
        const pedidosHoje = db.prepare(`
            SELECT COUNT(*) AS total FROM pedidos
            WHERE date(criado_em) = date('now', 'localtime')
        `).get().total;

        const pedidosEntregues = db.prepare(`
            SELECT COUNT(*) AS total FROM pedidos
            WHERE status = 'entregue'
            AND date(criado_em) = date('now', 'localtime')
        `).get().total;

        const pedidosPendentes = db.prepare(`
            SELECT COUNT(*) AS total FROM pedidos
            WHERE status = 'pendente'
        `).get().total;

        const produtos = db.prepare(
            'SELECT COUNT(*) AS total FROM produtos WHERE disponivel = 1'
        ).get().total;

        const categorias = db.prepare(
            'SELECT COUNT(*) AS total FROM categorias WHERE ativo = 1'
        ).get().total;

        res.json({
            pedidosHoje,
            pedidosEntregues,
            pedidosPendentes,
            produtos,
            categorias
        });
    } catch {
        res.status(500).json({ erro: 'Erro ao carregar dashboard.' });
    }
});