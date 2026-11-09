import { Router } from 'express';
import { db, generateId } from '../db/database.js';
import { verifyToken } from './auth.js';

export const pagamentosRouter = Router();

function autenticarAdmin(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = token ? verifyToken(token) : null;

    if (!user || user.tipo !== 'admin') {
        return res.status(401).json({ erro: 'Acesso não autorizado.' });
    }

    next();
}

pagamentosRouter.get('/', autenticarAdmin, (req, res) => {
    try {
        const pagamentos = db.prepare(
            'SELECT * FROM formas_pagamento ORDER BY ordem'
        ).all();

        res.json({ pagamentos });
    } catch {
        res.status(500).json({ erro: 'Erro ao buscar pagamentos.' });
    }
});

pagamentosRouter.post('/', autenticarAdmin, (req, res) => {
    try {
        const { nome, tipo, ativo, ordem } = req.body;

        if (!nome || !tipo) {
            return res.status(400).json({ erro: 'Nome e tipo são obrigatórios.' });
        }

        const id = generateId();

        db.prepare(`
            INSERT INTO formas_pagamento (id, nome, tipo, ativo, ordem)
            VALUES (?, ?, ?, ?, ?)
        `).run(id, nome, tipo, ativo ? 1 : 0, Number(ordem) || 0);

        res.status(201).json({ id, mensagem: 'Pagamento criado.' });
    } catch {
        res.status(500).json({ erro: 'Erro ao criar pagamento.' });
    }
});

pagamentosRouter.put('/:id', autenticarAdmin, (req, res) => {
    try {
        const { nome, tipo, ativo, ordem } = req.body;

        const result = db.prepare(`
            UPDATE formas_pagamento
            SET nome = ?, tipo = ?, ativo = ?, ordem = ?
            WHERE id = ?
        `).run(nome, tipo, ativo ? 1 : 0, Number(ordem) || 0, req.params.id);

        if (!result.changes) {
            return res.status(404).json({ erro: 'Pagamento não encontrado.' });
        }

        res.json({ mensagem: 'Pagamento atualizado.' });
    } catch {
        res.status(500).json({ erro: 'Erro ao atualizar pagamento.' });
    }
});

pagamentosRouter.delete('/:id', autenticarAdmin, (req, res) => {
    try {
        const result = db.prepare(
            'DELETE FROM formas_pagamento WHERE id = ?'
        ).run(req.params.id);

        if (!result.changes) {
            return res.status(404).json({ erro: 'Pagamento não encontrado.' });
        }

        res.json({ mensagem: 'Pagamento excluído.' });
    } catch {
        res.status(500).json({ erro: 'Erro ao excluir pagamento.' });
    }
});