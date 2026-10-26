import express from 'express';
import db from '../database/connection.js';
import { authMiddleware, optionalAuth } from '../middleware/auth.js';
import { produtoValidators, personalizacaoValidators } from '../middleware/validation.js';

const router = express.Router();

// List products with filters (public)
router.get('/', optionalAuth, produtoValidators.list, async (req, res) => {
    try {
        const { categoria_id, disponivel, search, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE 1=1';
        const params = [];

        if (categoria_id) {
            whereClause += ' AND p.categoria_id = ?';
            params.push(categoria_id);
        }

        if (disponivel !== undefined) {
            whereClause += ' AND p.disponivel = ?';
            params.push(disponivel === 'true' ? 1 : 0);
        }

        if (search) {
            whereClause += ' AND (p.nome LIKE ? OR p.descricao LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        // Only show available products to non-authenticated users
        if (!req.user) {
            whereClause += ' AND p.disponivel = 1';
        }

        const countSql = `SELECT COUNT(*) as total FROM produtos p ${whereClause}`;
        const totalResult = await db.queryOne(countSql, params);
        const total = totalResult.total;

        const sql = `
            SELECT p.*, c.nome as categoria_nome
            FROM produtos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            ${whereClause}
            ORDER BY c.ordem_exibicao, p.nome
            LIMIT ? OFFSET ?
        `;
        params.push(limit, offset);

        const produtos = await db.query(sql, params);

        // Get personalization groups for each product
        for (const produto of produtos) {
            const grupos = await db.query(`
                SELECT pg.*,
                    (SELECT json_group_array(json_object(
                        'id', po.id,
                        'nome', po.nome,
                        'preco_adicional', po.preco_adicional,
                        'ativo', po.ativo
                    )) FROM personalizacao_opcoes po WHERE po.grupo_id = pg.id AND po.ativo = 1) as opcoes
                FROM personalizacao_grupos pg
                WHERE pg.produto_id = ?
                ORDER BY pg.id
            `, [produto.id]);

            produto.personalizacoes = grupos.map(g => ({
                ...g,
                opcoes: g.opcoes ? JSON.parse(g.opcoes) : []
            }));
        }

        res.json({
            data: produtos,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error listing products:', error);
        res.status(500).json({ error: 'Erro ao listar produtos' });
    }
});

// Get single product with personalizations (public)
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const produto = await db.queryOne(`
            SELECT p.*, c.nome as categoria_nome
            FROM produtos p
            LEFT JOIN categorias c ON p.categoria_id = c.id
            WHERE p.id = ?
        `, [id]);

        if (!produto) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }

        // Non-admin users can only see available products
        if (!req.user && !produto.disponivel) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }

        // Get personalization groups
        const grupos = await db.query(`
            SELECT pg.*,
                (SELECT json_group_array(json_object(
                    'id', po.id,
                    'nome', po.nome,
                    'preco_adicional', po.preco_adicional,
                    'ativo', po.ativo
                )) FROM personalizacao_opcoes po WHERE po.grupo_id = pg.id AND po.ativo = 1) as opcoes
            FROM personalizacao_grupos pg
            WHERE pg.produto_id = ?
            ORDER BY pg.id
        `, [id]);

        produto.personalizacoes = grupos.map(g => ({
            ...g,
            opcoes: g.opcoes ? JSON.parse(g.opcoes) : []
        }));

        res.json(produto);
    } catch (error) {
        console.error('Error getting product:', error);
        res.status(500).json({ error: 'Erro ao buscar produto' });
    }
});

// Create product (admin only)
router.post('/', authMiddleware, produtoValidators.create, async (req, res) => {
    try {
        const { categoria_id, nome, descricao, preco_base, imagem_url, disponivel = true } = req.body;

        // Verify category exists
        const categoria = await db.queryOne('SELECT id FROM categorias WHERE id = ? AND ativo = 1', [categoria_id]);
        if (!categoria) {
            return res.status(400).json({ error: 'Categoria não encontrada ou inativa' });
        }

        const result = await db.query(
            'INSERT INTO produtos (categoria_id, nome, descricao, preco_base, imagem_url, disponivel) VALUES (?, ?, ?, ?, ?, ?)',
            [categoria_id, nome, descricao, preco_base, imagem_url, disponivel ? 1 : 0]
        );

        const produto = await db.queryOne('SELECT * FROM produtos WHERE id = ?', [result.lastInsertRowid]);
        res.status(201).json(produto);
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({ error: 'Erro ao criar produto' });
    }
});

// Update product (admin only)
router.put('/:id', authMiddleware, produtoValidators.update, async (req, res) => {
    try {
        const { id } = req.params;
        const { categoria_id, nome, descricao, preco_base, imagem_url, disponivel } = req.body;

        const produto = await db.queryOne('SELECT * FROM produtos WHERE id = ?', [id]);
        if (!produto) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }

        if (categoria_id) {
            const categoria = await db.queryOne('SELECT id FROM categorias WHERE id = ? AND ativo = 1', [categoria_id]);
            if (!categoria) {
                return res.status(400).json({ error: 'Categoria não encontrada ou inativa' });
            }
        }

        const updates = [];
        const params = [];

        if (categoria_id !== undefined) { updates.push('categoria_id = ?'); params.push(categoria_id); }
        if (nome !== undefined) { updates.push('nome = ?'); params.push(nome); }
        if (descricao !== undefined) { updates.push('descricao = ?'); params.push(descricao); }
        if (preco_base !== undefined) { updates.push('preco_base = ?'); params.push(preco_base); }
        if (imagem_url !== undefined) { updates.push('imagem_url = ?'); params.push(imagem_url); }
        if (disponivel !== undefined) { updates.push('disponivel = ?'); params.push(disponivel ? 1 : 0); }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nenhum campo para atualizar' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(id);

        await db.query(`UPDATE produtos SET ${updates.join(', ')} WHERE id = ?`, params);

        const updated = await db.queryOne('SELECT * FROM produtos WHERE id = ?', [id]);
        res.json(updated);
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ error: 'Erro ao atualizar produto' });
    }
});

// Delete product (admin only)
router.delete('/:id', authMiddleware, produtoValidators.delete, async (req, res) => {
    try {
        const { id } = req.params;

        const produto = await db.queryOne('SELECT * FROM produtos WHERE id = ?', [id]);
        if (!produto) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }

        // Check if product is in any pending orders
        const pedidosCount = await db.queryOne(`
            SELECT COUNT(*) as count FROM pedido_itens pi
            JOIN pedidos p ON pi.pedido_id = p.id
            WHERE pi.produto_id = ? AND p.status IN ('pendente', 'confirmado', 'preparando', 'saiu_entrega')
        `, [id]);

        if (pedidosCount.count > 0) {
            return res.status(400).json({
                error: 'Não é possível excluir produto com pedidos em andamento',
                detalhes: `Existem ${pedidosCount.count} item(ns) em pedidos ativos`
            });
        }

        // Delete personalization groups and options (cascade will handle this)
        await db.query('DELETE FROM produtos WHERE id = ?', [id]);
        res.json({ message: 'Produto excluído com sucesso' });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ error: 'Erro ao excluir produto' });
    }
});

// ========== PERSONALIZATION ROUTES ==========

// Get personalization groups for a product (public)
router.get('/:id/personalizacoes', optionalAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const produto = await db.queryOne('SELECT id, disponivel FROM produtos WHERE id = ?', [id]);
        if (!produto) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }

        if (!req.user && !produto.disponivel) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }

        const grupos = await db.query(`
            SELECT pg.*,
                (SELECT json_group_array(json_object(
                    'id', po.id,
                    'nome', po.nome,
                    'preco_adicional', po.preco_adicional,
                    'ativo', po.ativo
                )) FROM personalizacao_opcoes po WHERE po.grupo_id = pg.id AND po.ativo = 1) as opcoes
            FROM personalizacao_grupos pg
            WHERE pg.produto_id = ?
            ORDER BY pg.id
        `, [id]);

        const result = grupos.map(g => ({
            ...g,
            opcoes: g.opcoes ? JSON.parse(g.opcoes) : []
        }));

        res.json(result);
    } catch (error) {
        console.error('Error getting personalizations:', error);
        res.status(500).json({ error: 'Erro ao buscar personalizações' });
    }
});

// Create personalization group (admin only)
router.post('/:id/personalizacoes/grupos', authMiddleware, personalizacaoValidators.grupoCreate, async (req, res) => {
    try {
        const { id: produto_id } = req.params;
        const { nome, tipo, obrigatorio = false, min_selecoes = 0, max_selecoes = 1 } = req.body;

        const produto = await db.queryOne('SELECT id FROM produtos WHERE id = ?', [produto_id]);
        if (!produto) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }

        const result = await db.query(
            'INSERT INTO personalizacao_grupos (produto_id, nome, tipo, obrigatorio, min_selecoes, max_selecoes) VALUES (?, ?, ?, ?, ?, ?)',
            [produto_id, nome, tipo, obrigatorio ? 1 : 0, min_selecoes, max_selecoes]
        );

        const grupo = await db.queryOne('SELECT * FROM personalizacao_grupos WHERE id = ?', [result.lastInsertRowid]);
        res.status(201).json(grupo);
    } catch (error) {
        console.error('Error creating personalization group:', error);
        res.status(500).json({ error: 'Erro ao criar grupo de personalização' });
    }
});

// Update personalization group (admin only)
router.put('/personalizacoes/grupos/:id', authMiddleware, personalizacaoValidators.grupoUpdate, async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, tipo, obrigatorio, min_selecoes, max_selecoes } = req.body;

        const grupo = await db.queryOne('SELECT * FROM personalizacao_grupos WHERE id = ?', [id]);
        if (!grupo) {
            return res.status(404).json({ error: 'Grupo de personalização não encontrado' });
        }

        const updates = [];
        const params = [];

        if (nome !== undefined) { updates.push('nome = ?'); params.push(nome); }
        if (tipo !== undefined) { updates.push('tipo = ?'); params.push(tipo); }
        if (obrigatorio !== undefined) { updates.push('obrigatorio = ?'); params.push(obrigatorio ? 1 : 0); }
        if (min_selecoes !== undefined) { updates.push('min_selecoes = ?'); params.push(min_selecoes); }
        if (max_selecoes !== undefined) { updates.push('max_selecoes = ?'); params.push(max_selecoes); }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nenhum campo para atualizar' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(id);

        await db.query(`UPDATE personalizacao_grupos SET ${updates.join(', ')} WHERE id = ?`, params);

        const updated = await db.queryOne('SELECT * FROM personalizacao_grupos WHERE id = ?', [id]);
        res.json(updated);
    } catch (error) {
        console.error('Error updating personalization group:', error);
        res.status(500).json({ error: 'Erro ao atualizar grupo de personalização' });
    }
});

// Delete personalization group (admin only)
router.delete('/personalizacoes/grupos/:id', authMiddleware, personalizacaoValidators.grupoDelete, async (req, res) => {
    try {
        const { id } = req.params;

        const grupo = await db.queryOne('SELECT * FROM personalizacao_grupos WHERE id = ?', [id]);
        if (!grupo) {
            return res.status(404).json({ error: 'Grupo de personalização não encontrado' });
        }

        await db.query('DELETE FROM personalizacao_grupos WHERE id = ?', [id]);
        res.json({ message: 'Grupo de personalização excluído com sucesso' });
    } catch (error) {
        console.error('Error deleting personalization group:', error);
        res.status(500).json({ error: 'Erro ao excluir grupo de personalização' });
    }
});

// Create personalization option (admin only)
router.post('/personalizacoes/grupos/:grupo_id/opcoes', authMiddleware, personalizacaoValidators.opcaoCreate, async (req, res) => {
    try {
        const { grupo_id } = req.params;
        const { nome, preco_adicional = 0, ativo = true } = req.body;

        const grupo = await db.queryOne('SELECT id FROM personalizacao_grupos WHERE id = ?', [grupo_id]);
        if (!grupo) {
            return res.status(404).json({ error: 'Grupo de personalização não encontrado' });
        }

        const result = await db.query(
            'INSERT INTO personalizacao_opcoes (grupo_id, nome, preco_adicional, ativo) VALUES (?, ?, ?, ?)',
            [grupo_id, nome, preco_adicional, ativo ? 1 : 0]
        );

        const opcao = await db.queryOne('SELECT * FROM personalizacao_opcoes WHERE id = ?', [result.lastInsertRowid]);
        res.status(201).json(opcao);
    } catch (error) {
        console.error('Error creating personalization option:', error);
        res.status(500).json({ error: 'Erro ao criar opção de personalização' });
    }
});

// Update personalization option (admin only)
router.put('/personalizacoes/opcoes/:id', authMiddleware, personalizacaoValidators.opcaoUpdate, async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, preco_adicional, ativo } = req.body;

        const opcao = await db.queryOne('SELECT * FROM personalizacao_opcoes WHERE id = ?', [id]);
        if (!opcao) {
            return res.status(404).json({ error: 'Opção de personalização não encontrada' });
        }

        const updates = [];
        const params = [];

        if (nome !== undefined) { updates.push('nome = ?'); params.push(nome); }
        if (preco_adicional !== undefined) { updates.push('preco_adicional = ?'); params.push(preco_adicional); }
        if (ativo !== undefined) { updates.push('ativo = ?'); params.push(ativo ? 1 : 0); }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nenhum campo para atualizar' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(id);

        await db.query(`UPDATE personalizacao_opcoes SET ${updates.join(', ')} WHERE id = ?`, params);

        const updated = await db.queryOne('SELECT * FROM personalizacao_opcoes WHERE id = ?', [id]);
        res.json(updated);
    } catch (error) {
        console.error('Error updating personalization option:', error);
        res.status(500).json({ error: 'Erro ao atualizar opção de personalização' });
    }
});

// Delete personalization option (admin only)
router.delete('/personalizacoes/opcoes/:id', authMiddleware, personalizacaoValidators.opcaoDelete, async (req, res) => {
    try {
        const { id } = req.params;

        const opcao = await db.queryOne('SELECT * FROM personalizacao_opcoes WHERE id = ?', [id]);
        if (!opcao) {
            return res.status(404).json({ error: 'Opção de personalização não encontrada' });
        }

        await db.query('DELETE FROM personalizacao_opcoes WHERE id = ?', [id]);
        res.json({ message: 'Opção de personalização excluída com sucesso' });
    } catch (error) {
        console.error('Error deleting personalization option:', error);
        res.status(500).json({ error: 'Erro ao excluir opção de personalização' });
    }
});

export default router;