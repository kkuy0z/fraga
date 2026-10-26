import express from 'express';
import db from '../database/connection.js';
import { authMiddleware } from '../middleware/auth.js';
import { categoriaValidators } from '../middleware/validation.js';

const router = express.Router();

// List all categories (public)
router.get('/', async (req, res) => {
    try {
        const { ativo = true } = req.query;
        const sql = ativo === 'true'
            ? 'SELECT * FROM categorias WHERE ativo = 1 ORDER BY ordem_exibicao, nome'
            : 'SELECT * FROM categorias ORDER BY ordem_exibicao, nome';
        const categorias = await db.query(sql);
        res.json(categorias);
    } catch (error) {
        console.error('Error listing categories:', error);
        res.status(500).json({ error: 'Erro ao listar categorias' });
    }
});

// Get single category (public)
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const categoria = await db.queryOne('SELECT * FROM categorias WHERE id = ?', [id]);
        if (!categoria) {
            return res.status(404).json({ error: 'Categoria não encontrada' });
        }
        res.json(categoria);
    } catch (error) {
        console.error('Error getting category:', error);
        res.status(500).json({ error: 'Erro ao buscar categoria' });
    }
});

// Create category (admin only)
router.post('/', authMiddleware, categoriaValidators.create, async (req, res) => {
    try {
        const { nome, descricao, ordem_exibicao = 0 } = req.body;

        const result = await db.query(
            'INSERT INTO categorias (nome, descricao, ordem_exibicao) VALUES (?, ?, ?)',
            [nome, descricao, ordem_exibicao]
        );

        const categoria = await db.queryOne('SELECT * FROM categorias WHERE id = ?', [result.lastInsertRowid]);
        res.status(201).json(categoria);
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(400).json({ error: 'Já existe uma categoria com este nome' });
        }
        console.error('Error creating category:', error);
        res.status(500).json({ error: 'Erro ao criar categoria' });
    }
});

// Update category (admin only)
router.put('/:id', authMiddleware, categoriaValidators.update, async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, descricao, ordem_exibicao, ativo } = req.body;

        const categoria = await db.queryOne('SELECT * FROM categorias WHERE id = ?', [id]);
        if (!categoria) {
            return res.status(404).json({ error: 'Categoria não encontrada' });
        }

        const updates = [];
        const params = [];

        if (nome !== undefined) { updates.push('nome = ?'); params.push(nome); }
        if (descricao !== undefined) { updates.push('descricao = ?'); params.push(descricao); }
        if (ordem_exibicao !== undefined) { updates.push('ordem_exibicao = ?'); params.push(ordem_exibicao); }
        if (ativo !== undefined) { updates.push('ativo = ?'); params.push(ativo ? 1 : 0); }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nenhum campo para atualizar' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(id);

        await db.query(`UPDATE categorias SET ${updates.join(', ')} WHERE id = ?`, params);

        const updated = await db.queryOne('SELECT * FROM categorias WHERE id = ?', [id]);
        res.json(updated);
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(400).json({ error: 'Já existe uma categoria com este nome' });
        }
        console.error('Error updating category:', error);
        res.status(500).json({ error: 'Erro ao atualizar categoria' });
    }
});

// Delete category (admin only)
router.delete('/:id', authMiddleware, categoriaValidators.delete, async (req, res) => {
    try {
        const { id } = req.params;

        const categoria = await db.queryOne('SELECT * FROM categorias WHERE id = ?', [id]);
        if (!categoria) {
            return res.status(404).json({ error: 'Categoria não encontrada' });
        }

        // Check if category has products
        const produtosCount = await db.queryOne('SELECT COUNT(*) as count FROM produtos WHERE categoria_id = ?', [id]);
        if (produtosCount.count > 0) {
            return res.status(400).json({
                error: 'Não é possível excluir categoria com produtos associados',
                detalhes: `Existem ${produtosCount.count} produto(s) nesta categoria`
            });
        }

        await db.query('DELETE FROM categorias WHERE id = ?', [id]);
        res.json({ message: 'Categoria excluída com sucesso' });
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ error: 'Erro ao excluir categoria' });
    }
});

export default router;