import express from 'express';
import db from '../database/connection.js';
import { clienteAuthMiddleware, authMiddleware, requireRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/fidelidade/resumo
 * Resumo de pontos do cliente autenticado
 */
router.get('/resumo', clienteAuthMiddleware, async (req, res) => {
    try {
        const clienteId = req.cliente.id;

        // Get or create fidelidade record
        let fidelidade = await db.queryOne(`
            SELECT * FROM fidelidade WHERE cliente_id = ?
        `, [clienteId]);

        if (!fidelidade) {
            // Create initial fidelidade record
            const result = await db.query(`
                INSERT INTO fidelidade (cliente_id, pontos_atuais, total_acumulado, total_resgatado, nivel)
                VALUES (?, 0, 0, 0, 'Bronze')
            `, [clienteId]);
            fidelidade = await db.queryOne('SELECT * FROM fidelidade WHERE id = ?', [result.lastInsertRowid]);
        }

        // Get next level info
        const niveis = [
            { nome: 'Bronze', min: 0, max: 499 },
            { nome: 'Prata', min: 500, max: 1499 },
            { nome: 'Ouro', min: 1500, max: 4999 },
            { nome: 'Diamante', min: 5000, max: 999999 }
        ];

        const currentLevel = niveis.find(n => n.nome === fidelidade.nivel) || niveis[0];
        const nextLevel = niveis[niveis.indexOf(currentLevel) + 1];

        res.json({
            pontos_atuais: fidelidade.pontos_atuais,
            total_acumulado: fidelidade.total_acumulado,
            total_resgatado: fidelidade.total_resgatado,
            nivel: fidelidade.nivel,
            proximo_nivel: nextLevel ? {
                nome: nextLevel.nome,
                pontos_necessarios: nextLevel.min
            } : undefined
        });
    } catch (error) {
        console.error('Error getting fidelidade resumo:', error);
        res.status(500).json({ error: 'Erro ao buscar resumo de fidelidade' });
    }
});

/**
 * GET /api/fidelidade/historico
 * Histórico de movimentação de pontos do cliente
 */
router.get('/historico', clienteAuthMiddleware, async (req, res) => {
    try {
        const clienteId = req.cliente.id;
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        const historico = await db.query(`
            SELECT
                fh.*,
                p.numero_pedido,
                r.nome as recompensa_nome
            FROM fidelidade_historico fh
            LEFT JOIN pedidos p ON fh.pedido_id = p.id
            LEFT JOIN recompensas r ON fh.recompensa_id = r.id
            WHERE fh.cliente_id = ?
            ORDER BY fh.created_at DESC
            LIMIT ? OFFSET ?
        `, [clienteId, parseInt(limit), offset]);

        const total = await db.queryOne(`
            SELECT COUNT(*) as count FROM fidelidade_historico WHERE cliente_id = ?
        `, [clienteId]);

        res.json({
            historico,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total.count,
                totalPages: Math.ceil(total.count / limit)
            }
        });
    } catch (error) {
        console.error('Error getting fidelidade historico:', error);
        res.status(500).json({ error: 'Erro ao buscar histórico de fidelidade' });
    }
});

/**
 * GET /api/fidelidade/recompensas
 * Lista de recompensas disponíveis para resgate
 */
router.get('/recompensas', clienteAuthMiddleware, async (req, res) => {
    try {
        const recompensas = await db.query(`
            SELECT
                r.*,
                p.nome as produto_nome
            FROM recompensas r
            LEFT JOIN produtos p ON r.produto_id = p.id
            WHERE r.ativo = 1
            ORDER BY r.pontos_custo ASC
        `);

        res.json(recompensas);
    } catch (error) {
        console.error('Error getting recompensas:', error);
        res.status(500).json({ error: 'Erro ao buscar recompensas' });
    }
});

/**
 * POST /api/fidelidade/resgatar
 * Resgatar uma recompensa
 */
router.post('/resgatar', clienteAuthMiddleware, async (req, res) => {
    try {
        const clienteId = req.cliente.id;
        const { recompensa_id, quantidade = 1 } = req.body;

        if (!recompensa_id || quantidade < 1) {
            return res.status(400).json({ error: 'Dados inválidos para resgate' });
        }

        // Get reward
        const recompensa = await db.queryOne('SELECT * FROM recompensas WHERE id = ? AND ativo = 1', [recompensa_id]);
        if (!recompensa) {
            return res.status(404).json({ error: 'Recompensa não encontrada ou indisponível' });
        }

        // Check stock if applicable
        if (recompensa.estoque !== null && recompensa.estoque !== undefined && recompensa.estoque < quantidade) {
            return res.status(400).json({ error: 'Estoque insuficiente para esta recompensa' });
        }

        // Get client fidelidade
        const fidelidade = await db.queryOne('SELECT * FROM fidelidade WHERE cliente_id = ?', [clienteId]);
        if (!fidelidade) {
            return res.status(400).json({ error: 'Cliente não possui cadastro de fidelidade' });
        }

        const custoTotal = recompensa.pontos_custo * quantidade;
        if (fidelidade.pontos_atuais < custoTotal) {
            return res.status(400).json({ error: 'Pontos insuficientes para este resgate' });
        }

        // Process redemption in transaction
        const resgate = await db.transaction(async () => {
            // Deduct points
            await db.query(`
                UPDATE fidelidade
                SET pontos_atuais = pontos_atuais - ?,
                    total_resgatado = total_resgatado + ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE cliente_id = ?
            `, [custoTotal, custoTotal, clienteId]);

            // Create redemption record
            const resgateResult = await db.query(`
                INSERT INTO fidelidade_resgates (cliente_id, recompensa_id, quantidade, pontos_gastos)
                VALUES (?, ?, ?, ?)
            `, [clienteId, recompensa_id, quantidade, custoTotal]);

            // Update stock if applicable
            if (recompensa.estoque !== null && recompensa.estoque !== undefined) {
                await db.query(`
                    UPDATE recompensas SET estoque = estoque - ? WHERE id = ?
                `, [quantidade, recompensa_id]);
            }

            // Add to history
            await db.query(`
                INSERT INTO fidelidade_historico (cliente_id, tipo, pontos, descricao, recompensa_id, recompensa_nome)
                VALUES (?, 'resgatado', ?, ?, ?, ?)
            `, [clienteId, -custoTotal, `Resgate: ${recompensa.nome} (${quantidade}x)`, recompensa_id, recompensa.nome]);

            return await db.queryOne('SELECT * FROM fidelidade_resgates WHERE id = ?', [resgateResult.lastInsertRowid]);
        });

        res.status(201).json({
            message: 'Resgate realizado com sucesso',
            resgate,
            pontos_restantes: fidelidade.pontos_atuais - custoTotal
        });
    } catch (error) {
        console.error('Error processing resgate:', error);
        res.status(500).json({ error: 'Erro ao processar resgate' });
    }
});

// Admin routes
router.use('/admin', authMiddleware, requireRole('administrador', 'atendente'));

/**
 * GET /api/fidelidade/admin/recompensas
 * Listar todas as recompensas (admin)
 */
router.get('/admin/recompensas', async (req, res) => {
    try {
        const { page = 1, limit = 20, ativo } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE 1=1';
        const params = [];

        if (ativo !== undefined) {
            whereClause += ' AND r.ativo = ?';
            params.push(ativo === 'true' ? 1 : 0);
        }

        const recompensas = await db.query(`
            SELECT r.*, p.nome as produto_nome
            FROM recompensas r
            LEFT JOIN produtos p ON r.produto_id = p.id
            ${whereClause}
            ORDER BY r.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, parseInt(limit), offset]);

        const total = await db.queryOne(`
            SELECT COUNT(*) as count FROM recompensas ${whereClause}
        `, params);

        res.json({
            recompensas,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total.count,
                totalPages: Math.ceil(total.count / limit)
            }
        });
    } catch (error) {
        console.error('Error listing recompensas (admin):', error);
        res.status(500).json({ error: 'Erro ao listar recompensas' });
    }
});

/**
 * POST /api/fidelidade/admin/recompensas
 * Criar recompensa (admin)
 */
router.post('/admin/recompensas', async (req, res) => {
    try {
        const { nome, descricao, pontos_custo, tipo, valor_desconto, produto_id, ativo = true, estoque, imagem_url } = req.body;

        if (!nome || !pontos_custo || !tipo) {
            return res.status(400).json({ error: 'Nome, pontos_custo e tipo são obrigatórios' });
        }

        const validTipos = ['desconto', 'produto', 'frete_gratis', 'outro'];
        if (!validTipos.includes(tipo)) {
            return res.status(400).json({ error: 'Tipo de recompensa inválido' });
        }

        // Validate product exists if produto_id provided
        if (produto_id) {
            const produto = await db.queryOne('SELECT id FROM produtos WHERE id = ?', [produto_id]);
            if (!produto) {
                return res.status(400).json({ error: 'Produto não encontrado' });
            }
        }

        const result = await db.query(`
            INSERT INTO recompensas (nome, descricao, pontos_custo, tipo, valor_desconto, produto_id, ativo, estoque, imagem_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [nome, descricao, pontos_custo, tipo, valor_desconto || null, produto_id || null, ativo ? 1 : 0, estoque || null, imagem_url || null]);

        const recompensa = await db.queryOne('SELECT * FROM recompensas WHERE id = ?', [result.lastInsertRowid]);
        res.status(201).json(recompensa);
    } catch (error) {
        console.error('Error creating recompensa:', error);
        res.status(500).json({ error: 'Erro ao criar recompensa' });
    }
});

/**
 * PUT /api/fidelidade/admin/recompensas/:id
 * Atualizar recompensa (admin)
 */
router.put('/admin/recompensas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, descricao, pontos_custo, tipo, valor_desconto, produto_id, ativo, estoque, imagem_url } = req.body;

        const recompensa = await db.queryOne('SELECT * FROM recompensas WHERE id = ?', [id]);
        if (!recompensa) {
            return res.status(404).json({ error: 'Recompensa não encontrada' });
        }

        if (produto_id) {
            const produto = await db.queryOne('SELECT id FROM produtos WHERE id = ?', [produto_id]);
            if (!produto) {
                return res.status(400).json({ error: 'Produto não encontrado' });
            }
        }

        const updates = [];
        const params = [];

        if (nome !== undefined) { updates.push('nome = ?'); params.push(nome); }
        if (descricao !== undefined) { updates.push('descricao = ?'); params.push(descricao); }
        if (pontos_custo !== undefined) { updates.push('pontos_custo = ?'); params.push(pontos_custo); }
        if (tipo !== undefined) { updates.push('tipo = ?'); params.push(tipo); }
        if (valor_desconto !== undefined) { updates.push('valor_desconto = ?'); params.push(valor_desconto); }
        if (produto_id !== undefined) { updates.push('produto_id = ?'); params.push(produto_id); }
        if (ativo !== undefined) { updates.push('ativo = ?'); params.push(ativo ? 1 : 0); }
        if (estoque !== undefined) { updates.push('estoque = ?'); params.push(estoque); }
        if (imagem_url !== undefined) { updates.push('imagem_url = ?'); params.push(imagem_url); }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nenhum campo para atualizar' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(id);

        await db.query(`UPDATE recompensas SET ${updates.join(', ')} WHERE id = ?`, params);

        const updated = await db.queryOne('SELECT * FROM recompensas WHERE id = ?', [id]);
        res.json(updated);
    } catch (error) {
        console.error('Error updating recompensa:', error);
        res.status(500).json({ error: 'Erro ao atualizar recompensa' });
    }
});

/**
 * DELETE /api/fidelidade/admin/recompensas/:id
 * Excluir recompensa (admin)
 */
router.delete('/admin/recompensas/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const recompensa = await db.queryOne('SELECT * FROM recompensas WHERE id = ?', [id]);
        if (!recompensa) {
            return res.status(404).json({ error: 'Recompensa não encontrada' });
        }

        // Check if used in redemptions
        const resgatesCount = await db.queryOne('SELECT COUNT(*) as count FROM fidelidade_resgates WHERE recompensa_id = ?', [id]);
        if (resgatesCount.count > 0) {
            return res.status(400).json({
                error: 'Não é possível excluir recompensa já resgatada',
                detalhes: `Existem ${resgatesCount.count} resgate(s) usando esta recompensa`
            });
        }

        await db.query('DELETE FROM recompensas WHERE id = ?', [id]);
        res.json({ message: 'Recompensa excluída com sucesso' });
    } catch (error) {
        console.error('Error deleting recompensa:', error);
        res.status(500).json({ error: 'Erro ao excluir recompensa' });
    }
});

/**
 * GET /api/fidelidade/admin/estatisticas
 * Estatísticas de fidelidade (admin)
 */
router.get('/admin/estatisticas', async (req, res) => {
    try {
        const geral = await db.queryOne(`
            SELECT
                COUNT(*) as total_clientes,
                SUM(pontos_atuais) as total_pontos_circulacao,
                SUM(total_acumulado) as total_pontos_gerados,
                SUM(total_resgatado) as total_pontos_resgatados
            FROM fidelidade
        `);

        const porNivel = await db.query(`
            SELECT
                nivel,
                COUNT(*) as quantidade,
                SUM(pontos_atuais) as pontos_totais
            FROM fidelidade
            GROUP BY nivel
        `);

        const topClientes = await db.query(`
            SELECT
                c.id,
                c.nome,
                c.email,
                f.pontos_atuais,
                f.nivel
            FROM fidelidade f
            JOIN clientes c ON f.cliente_id = c.id
            ORDER BY f.pontos_atuais DESC
            LIMIT 10
        `);

        const resgatesRecentes = await db.query(`
            SELECT
                fr.*,
                c.nome as cliente_nome,
                r.nome as recompensa_nome
            FROM fidelidade_resgates fr
            JOIN clientes c ON fr.cliente_id = c.id
            JOIN recompensas r ON fr.recompensa_id = r.id
            ORDER BY fr.created_at DESC
            LIMIT 20
        `);

        res.json({
            geral,
            por_nivel: porNivel,
            top_clientes: topClientes,
            resgates_recentes: resgatesRecentes
        });
    } catch (error) {
        console.error('Error getting fidelidade stats:', error);
        res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
});

export default router;