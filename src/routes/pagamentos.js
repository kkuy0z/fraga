import express from 'express';
import db from '../database/connection.js';
import { authMiddleware } from '../middleware/auth.js';
import { formaPagamentoValidators } from '../middleware/validation.js';

const router = express.Router();

// List payment methods (public - only active ones)
router.get('/', async (req, res) => {
    try {
        const { ativo = true } = req.query;
        const sql = ativo === 'true'
            ? 'SELECT * FROM formas_pagamento WHERE ativo = 1 ORDER BY id'
            : 'SELECT * FROM formas_pagamento ORDER BY id';
        const formas = await db.query(sql);
        res.json(formas.map(f => ({
            ...f,
            configuracao: f.configuracao ? JSON.parse(f.configuracao) : {}
        })));
    } catch (error) {
        console.error('Error listing payment methods:', error);
        res.status(500).json({ error: 'Erro ao listar formas de pagamento' });
    }
});

// Get single payment method (public)
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const forma = await db.queryOne('SELECT * FROM formas_pagamento WHERE id = ?', [id]);
        if (!forma) {
            return res.status(404).json({ error: 'Forma de pagamento não encontrada' });
        }
        res.json({
            ...forma,
            configuracao: forma.configuracao ? JSON.parse(forma.configuracao) : {}
        });
    } catch (error) {
        console.error('Error getting payment method:', error);
        res.status(500).json({ error: 'Erro ao buscar forma de pagamento' });
    }
});

// Create payment method (admin only)
router.post('/', authMiddleware, formaPagamentoValidators.create, async (req, res) => {
    try {
        const { nome, tipo, configuracao = {}, ativo = true } = req.body;

        const result = await db.query(
            'INSERT INTO formas_pagamento (nome, tipo, configuracao, ativo) VALUES (?, ?, ?, ?)',
            [nome, tipo, JSON.stringify(configuracao), ativo ? 1 : 0]
        );

        const forma = await db.queryOne('SELECT * FROM formas_pagamento WHERE id = ?', [result.lastInsertRowid]);
        res.status(201).json({
            ...forma,
            configuracao: forma.configuracao ? JSON.parse(forma.configuracao) : {}
        });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(400).json({ error: 'Já existe uma forma de pagamento com este nome' });
        }
        console.error('Error creating payment method:', error);
        res.status(500).json({ error: 'Erro ao criar forma de pagamento' });
    }
});

// Update payment method (admin only)
router.put('/:id', authMiddleware, formaPagamentoValidators.update, async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, tipo, configuracao, ativo } = req.body;

        const forma = await db.queryOne('SELECT * FROM formas_pagamento WHERE id = ?', [id]);
        if (!forma) {
            return res.status(404).json({ error: 'Forma de pagamento não encontrada' });
        }

        const updates = [];
        const params = [];

        if (nome !== undefined) { updates.push('nome = ?'); params.push(nome); }
        if (tipo !== undefined) { updates.push('tipo = ?'); params.push(tipo); }
        if (configuracao !== undefined) { updates.push('configuracao = ?'); params.push(JSON.stringify(configuracao)); }
        if (ativo !== undefined) { updates.push('ativo = ?'); params.push(ativo ? 1 : 0); }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nenhum campo para atualizar' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(id);

        await db.query(`UPDATE formas_pagamento SET ${updates.join(', ')} WHERE id = ?`, params);

        const updated = await db.queryOne('SELECT * FROM formas_pagamento WHERE id = ?', [id]);
        res.json({
            ...updated,
            configuracao: updated.configuracao ? JSON.parse(updated.configuracao) : {}
        });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(400).json({ error: 'Já existe uma forma de pagamento com este nome' });
        }
        console.error('Error updating payment method:', error);
        res.status(500).json({ error: 'Erro ao atualizar forma de pagamento' });
    }
});

// Delete payment method (admin only)
router.delete('/:id', authMiddleware, formaPagamentoValidators.delete, async (req, res) => {
    try {
        const { id } = req.params;

        const forma = await db.queryOne('SELECT * FROM formas_pagamento WHERE id = ?', [id]);
        if (!forma) {
            return res.status(404).json({ error: 'Forma de pagamento não encontrada' });
        }

        // Check if used in orders
        const pedidosCount = await db.queryOne('SELECT COUNT(*) as count FROM pedidos WHERE forma_pagamento_id = ?', [id]);
        if (pedidosCount.count > 0) {
            return res.status(400).json({
                error: 'Não é possível excluir forma de pagamento usada em pedidos',
                detalhes: `Existem ${pedidosCount.count} pedido(s) usando esta forma de pagamento`
            });
        }

        await db.query('DELETE FROM formas_pagamento WHERE id = ?', [id]);
        res.json({ message: 'Forma de pagamento excluída com sucesso' });
    } catch (error) {
        console.error('Error deleting payment method:', error);
        res.status(500).json({ error: 'Erro ao excluir forma de pagamento' });
    }
});

export default router;