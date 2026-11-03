import express from 'express';
import db from '../database/connection.js';
import { authMiddleware, requireRole, clienteAuthMiddleware } from '../middleware/auth.js';
import { avaliacaoValidators } from '../middleware/validation.js';
import { emitNotification } from './notificacoes.js';

const router = express.Router();

/**
 * POST /api/avaliacoes
 * Criar avaliação de um pedido (cliente autenticado)
 * RF-17: Cliente pode avaliar pedido após entrega
 */
router.post('/', clienteAuthMiddleware, avaliacaoValidators.create, async (req, res) => {
    try {
        const clienteId = req.cliente.id;
        const { estrelas, comentario } = req.body;

        // Get the last delivered order for this client that doesn't have an evaluation yet
        const pedido = await db.queryOne(`
            SELECT p.id
            FROM pedidos p
            WHERE p.cliente_id = ?
            AND p.status = 'entregue'
            AND NOT EXISTS (
                SELECT 1 FROM avaliacoes a WHERE a.pedido_id = p.id
            )
            ORDER BY p.data_pedido DESC
            LIMIT 1
        `, [clienteId]);

        if (!pedido) {
            return res.status(400).json({
                error: 'Nenhum pedido elegível para avaliação encontrado',
                code: 'NO_ELIGIBLE_ORDER'
            });
        }

        // Check if order is recent (within 30 days)
        const pedidoRecente = await db.queryOne(`
            SELECT 1 FROM pedidos
            WHERE id = ?
            AND date(data_pedido) >= date('now', '-30 days')
        `, [pedido.id]);

        if (!pedidoRecente) {
            return res.status(400).json({
                error: 'Pedido muito antigo para avaliação (máximo 30 dias)',
                code: 'ORDER_TOO_OLD'
            });
        }

        // Create evaluation
        const result = await db.query(`
            INSERT INTO avaliacoes (pedido_id, cliente_id, estrelas, comentario)
            VALUES (?, ?, ?, ?)
        `, [pedido.id, clienteId, estrelas, comentario || null]);

        const avaliacao = await db.queryOne(`
            SELECT a.*, p.valor_total, p.data_pedido
            FROM avaliacoes a
            JOIN pedidos p ON a.pedido_id = p.id
            WHERE a.id = ?
        `, [result.lastInsertRowid]);

        // Send notification to admins
        await emitNotification({
            tipo: 'avaliacao_nova',
            titulo: 'Nova avaliação recebida',
            mensagem: `Pedido #${pedido.id} recebeu ${estrelas} estrela(s)`,
            pedido_id: pedido.id,
            destinatario_perfil: 'administrador'
        });

        res.status(201).json({
            message: 'Avaliação enviada com sucesso',
            avaliacao
        });
    } catch (error) {
        console.error('Error creating evaluation:', error);
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(400).json({ error: 'Este pedido já foi avaliado' });
        }
        res.status(500).json({ error: 'Erro ao criar avaliação' });
    }
});

/**
 * GET /api/avaliacoes/pedido/:pedidoId
 * Ver avaliação de um pedido específico
 */
router.get('/pedido/:pedidoId', async (req, res) => {
    try {
        const { pedidoId } = req.params;

        const avaliacao = await db.queryOne(`
            SELECT a.*, c.nome as cliente_nome
            FROM avaliacoes a
            JOIN clientes c ON a.cliente_id = c.id
            WHERE a.pedido_id = ?
        `, [pedidoId]);

        if (!avaliacao) {
            return res.status(404).json({ error: 'Avaliação não encontrada' });
        }

        res.json(avaliacao);
    } catch (error) {
        console.error('Error getting evaluation:', error);
        res.status(500).json({ error: 'Erro ao buscar avaliação' });
    }
});

/**
 * GET /api/avaliacoes/minhas
 * Listar minhas avaliações (cliente autenticado)
 */
router.get('/minhas', clienteAuthMiddleware, avaliacaoValidators.list, async (req, res) => {
    try {
        const clienteId = req.cliente.id;
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        const avaliacoes = await db.query(`
            SELECT a.*, p.valor_total, p.data_pedido
            FROM avaliacoes a
            JOIN pedidos p ON a.pedido_id = p.id
            WHERE a.cliente_id = ?
            ORDER BY a.created_at DESC
            LIMIT ? OFFSET ?
        `, [clienteId, parseInt(limit), offset]);

        const total = await db.queryOne(`
            SELECT COUNT(*) as count
            FROM avaliacoes
            WHERE cliente_id = ?
        `, [clienteId]);

        res.json({
            avaliacoes,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total.count,
                totalPages: Math.ceil(total.count / limit)
            }
        });
    } catch (error) {
        console.error('Error listing my evaluations:', error);
        res.status(500).json({ error: 'Erro ao listar avaliações' });
    }
});

// Admin routes - require admin authentication
router.use('/admin', authMiddleware, requireRole('administrador', 'atendente'));

/**
 * GET /api/avaliacoes/admin
 * Listar todas as avaliações (admin)
 */
router.get('/admin', avaliacaoValidators.list, async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            cliente_id,
            respondido,
            estrelas_min,
            estrelas_max,
            data_inicio,
            data_fim
        } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE 1=1';
        const params = [];

        if (cliente_id) {
            whereClause += ' AND a.cliente_id = ?';
            params.push(cliente_id);
        }
        if (respondido !== undefined) {
            whereClause += ' AND a.respondido = ?';
            params.push(respondido === 'true' ? 1 : 0);
        }
        if (estrelas_min) {
            whereClause += ' AND a.estrelas >= ?';
            params.push(estrelas_min);
        }
        if (estrelas_max) {
            whereClause += ' AND a.estrelas <= ?';
            params.push(estrelas_max);
        }
        if (data_inicio) {
            whereClause += ' AND date(a.created_at) >= date(?)';
            params.push(data_inicio);
        }
        if (data_fim) {
            whereClause += ' AND date(a.created_at) <= date(?)';
            params.push(data_fim);
        }

        const avaliacoes = await db.query(`
            SELECT
                a.*,
                c.nome as cliente_nome,
                c.email as cliente_email,
                p.valor_total,
                p.data_pedido,
                u.nome as respondido_por_nome
            FROM avaliacoes a
            JOIN clientes c ON a.cliente_id = c.id
            JOIN pedidos p ON a.pedido_id = p.id
            LEFT JOIN usuarios_admin u ON a.respondido_por = u.id
            ${whereClause}
            ORDER BY a.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, parseInt(limit), offset]);

        const total = await db.queryOne(`
            SELECT COUNT(*) as count
            FROM avaliacoes a
            ${whereClause}
        `, params);

        res.json({
            avaliacoes,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total.count,
                totalPages: Math.ceil(total.count / limit)
            }
        });
    } catch (error) {
        console.error('Error listing evaluations (admin):', error);
        res.status(500).json({ error: 'Erro ao listar avaliações' });
    }
});

/**
 * GET /api/avaliacoes/admin/estatisticas
 * Estatísticas de avaliações (admin)
 */
router.get('/admin/estatisticas', async (req, res) => {
    try {
        const { data_inicio, data_fim } = req.query;

        let whereClause = 'WHERE 1=1';
        const params = [];

        if (data_inicio) {
            whereClause += ' AND date(created_at) >= date(?)';
            params.push(data_inicio);
        }
        if (data_fim) {
            whereClause += ' AND date(created_at) <= date(?)';
            params.push(data_fim);
        }

        // Overall stats
        const geral = await db.queryOne(`
            SELECT
                COUNT(*) as total,
                AVG(estrelas) as media_estrelas,
                SUM(CASE WHEN respondido = 1 THEN 1 ELSE 0 END) as respondidas,
                SUM(CASE WHEN respondido = 0 THEN 1 ELSE 0 END) as pendentes
            FROM avaliacoes
            ${whereClause}
        `, params);

        // Distribution by stars
        const porEstrelas = await db.query(`
            SELECT
                estrelas,
                COUNT(*) as quantidade
            FROM avaliacoes
            ${whereClause}
            GROUP BY estrelas
            ORDER BY estrelas DESC
        `, params);

        // Average by month
        const porMes = await db.query(`
            SELECT
                strftime('%Y-%m', created_at) as mes,
                COUNT(*) as total,
                AVG(estrelas) as media_estrelas
            FROM avaliacoes
            ${whereClause}
            GROUP BY mes
            ORDER BY mes DESC
            LIMIT 12
        `, params);

        // Recent unresponded
        const naoRespondidas = await db.query(`
            SELECT a.*, c.nome as cliente_nome, p.id as pedido_id
            FROM avaliacoes a
            JOIN clientes c ON a.cliente_id = c.id
            JOIN pedidos p ON a.pedido_id = p.id
            WHERE a.respondido = 0
            ORDER BY a.created_at DESC
            LIMIT 10
        `, []);

        res.json({
            geral,
            por_estrelas: porEstrelas,
            por_mes: porMes,
            nao_respondidas: naoRespondidas
        });
    } catch (error) {
        console.error('Error getting evaluation stats:', error);
        res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
});

/**
 * PUT /api/avaliacoes/admin/:id
 * Responder avaliação (admin)
 */
router.put('/admin/:id', avaliacaoValidators.update, async (req, res) => {
    try {
        const { id } = req.params;
        const { respondido, resposta_admin } = req.body;
        const adminId = req.user.id;

        const avaliacao = await db.queryOne('SELECT * FROM avaliacoes WHERE id = ?', [id]);
        if (!avaliacao) {
            return res.status(404).json({ error: 'Avaliação não encontrada' });
        }

        const updates = [];
        const params = [];

        if (respondido !== undefined) {
            updates.push('respondido = ?');
            params.push(respondido ? 1 : 0);
            if (respondido) {
                updates.push('respondido_em = CURRENT_TIMESTAMP');
                updates.push('respondido_por = ?');
                params.push(adminId);
            }
        }
        if (resposta_admin !== undefined) {
            updates.push('resposta_admin = ?');
            params.push(resposta_admin);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nenhum campo para atualizar' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(id);

        await db.query(`UPDATE avaliacoes SET ${updates.join(', ')} WHERE id = ?`, params);

        const updated = await db.queryOne(`
            SELECT a.*, u.nome as respondido_por_nome
            FROM avaliacoes a
            LEFT JOIN usuarios_admin u ON a.respondido_por = u.id
            WHERE a.id = ?
        `, [id]);

        res.json({
            message: 'Avaliação atualizada com sucesso',
            avaliacao: updated
        });
    } catch (error) {
        console.error('Error updating evaluation:', error);
        res.status(500).json({ error: 'Erro ao atualizar avaliação' });
    }
});

/**
 * DELETE /api/avaliacoes/admin/:id
 * Excluir avaliação (admin)
 */
router.delete('/admin/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const avaliacao = await db.queryOne('SELECT * FROM avaliacoes WHERE id = ?', [id]);
        if (!avaliacao) {
            return res.status(404).json({ error: 'Avaliação não encontrada' });
        }

        await db.query('DELETE FROM avaliacoes WHERE id = ?', [id]);
        res.json({ message: 'Avaliação excluída com sucesso' });
    } catch (error) {
        console.error('Error deleting evaluation:', error);
        res.status(500).json({ error: 'Erro ao excluir avaliação' });
    }
});

export default router;