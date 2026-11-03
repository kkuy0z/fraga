import express from 'express';
import db from '../database/connection.js';
import { authMiddleware, requireRole, clienteAuthMiddleware } from '../middleware/auth.js';
import { entregaValidators } from '../middleware/validation.js';
import { emitNotification } from './notificacoes.js';

const router = express.Router();

/**
 * GET /api/entregas/pedido/:pedidoId
 * Ver entrega de um pedido específico
 */
router.get('/pedido/:pedidoId', async (req, res) => {
    try {
        const { pedidoId } = req.params;

        const entrega = await db.queryOne(`
            SELECT
                e.*,
                u.nome as entregador_nome,
                u.telefone as entregador_telefone
            FROM entregas e
            LEFT JOIN usuarios_admin u ON e.entregador_id = u.id
            WHERE e.pedido_id = ?
        `, [pedidoId]);

        if (!entrega) {
            return res.status(404).json({ error: 'Entrega não encontrada' });
        }

        res.json(entrega);
    } catch (error) {
        console.error('Error getting delivery:', error);
        res.status(500).json({ error: 'Erro ao buscar entrega' });
    }
});

// Client routes - client can track their own delivery
router.use('/minhas', clienteAuthMiddleware);

/**
 * GET /api/entregas/minhas/pedido/:pedidoId
 * Cliente rastrear sua entrega
 */
router.get('/minhas/pedido/:pedidoId', async (req, res) => {
    try {
        const { pedidoId } = req.params;
        const clienteId = req.cliente.id;

        // Verify order belongs to client
        const pedido = await db.queryOne(`
            SELECT id, status, cliente_nome, cliente_telefone, endereco_entrega, valor_total
            FROM pedidos
            WHERE id = ? AND cliente_id = ?
        `, [pedidoId, clienteId]);

        if (!pedido) {
            return res.status(404).json({ error: 'Pedido não encontrado' });
        }

        const entrega = await db.queryOne(`
            SELECT
                e.*,
                u.nome as entregador_nome,
                u.telefone as entregador_telefone
            FROM entregas e
            LEFT JOIN usuarios_admin u ON e.entregador_id = u.id
            WHERE e.pedido_id = ?
        `, [pedidoId]);

        if (!entrega) {
            return res.status(404).json({ error: 'Entrega não iniciada' });
        }

        // Return delivery info with order info
        res.json({
            pedido: {
                id: pedido.id,
                status: pedido.status,
                endereco_entrega: pedido.endereco_entrega,
                valor_total: pedido.valor_total
            },
            entrega: {
                status: entrega.status,
                entregador_nome: entrega.entregador_nome,
                entregador_telefone: entrega.entregador_telefone,
                saida_em: entrega.saida_em,
                entregue_em: entrega.entregue_em,
                latitude: entrega.latitude,
                longitude: entrega.longitude,
                observacoes: entrega.observacoes
            }
        });
    } catch (error) {
        console.error('Error tracking delivery:', error);
        res.status(500).json({ error: 'Erro ao rastrear entrega' });
    }
});

// Admin/Delivery routes - require admin authentication
router.use(authMiddleware);
router.use(requireRole('administrador', 'atendente', 'entregador'));

/**
 * POST /api/entregas
 * Criar entrega para um pedido (quando pedido sai para entrega)
 */
router.post('/', entregaValidators.create, async (req, res) => {
    try {
        const { pedido_id, entregador_id } = req.body;

        // Verify order exists and is ready for delivery
        const pedido = await db.queryOne(`
            SELECT id, status, cliente_nome, cliente_telefone, endereco_entrega
            FROM pedidos
            WHERE id = ?
        `, [pedido_id]);

        if (!pedido) {
            return res.status(404).json({ error: 'Pedido não encontrado' });
        }

        if (pedido.status !== 'saiu_entrega') {
            return res.status(400).json({
                error: 'Pedido não está pronto para entrega',
                status_atual: pedido.status
            });
        }

        // Check if delivery already exists
        const existing = await db.queryOne('SELECT id FROM entregas WHERE pedido_id = ?', [pedido_id]);
        if (existing) {
            return res.status(400).json({ error: 'Entrega já existe para este pedido' });
        }

        // If entregador_id not provided, try to assign automatically
        let finalEntregadorId = entregador_id;
        if (!finalEntregadorId) {
            // Find available deliverer with least active deliveries
            const disponivel = await db.queryOne(`
                SELECT u.id
                FROM usuarios_admin u
                WHERE u.perfil = 'entregador'
                AND u.ativo = 1
                AND (
                    SELECT COUNT(*)
                    FROM entregas e
                    WHERE e.entregador_id = u.id
                    AND e.status IN ('aceita', 'retirada', 'em_rota')
                ) < 5
                ORDER BY (
                    SELECT COUNT(*)
                    FROM entregas e
                    WHERE e.entregador_id = u.id
                    AND e.status IN ('aceita', 'retirada', 'em_rota')
                ) ASC
                LIMIT 1
            `);
            if (disponivel) {
                finalEntregadorId = disponivel.id;
            }
        }

        const result = await db.query(`
            INSERT INTO entregas (pedido_id, entregador_id, status, saida_em)
            VALUES (?, ?, 'aceita', CURRENT_TIMESTAMP)
        `, [pedido_id, finalEntregadorId || null]);

        // Update order status to saiu_entrega if not already
        await db.query('UPDATE pedidos SET status = ? WHERE id = ?', ['saiu_entrega', pedido_id]);

        // Record status history
        await db.query(`
            INSERT INTO pedido_status_historico (pedido_id, status_anterior, status_novo, usuario_id, usuario_nome, motivo)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [pedido_id, 'preparando', 'saiu_entrega', req.user.id, req.user.nome, 'Pedido saiu para entrega']);

        const entrega = await db.queryOne(`
            SELECT e.*, u.nome as entregador_nome, u.telefone as entregador_telefone
            FROM entregas e
            LEFT JOIN usuarios_admin u ON e.entregador_id = u.id
            WHERE e.id = ?
        `, [result.lastInsertRowid]);

        // Notify deliverer if assigned
        if (finalEntregadorId) {
            await emitNotification({
                tipo: 'entrega_atribuida',
                titulo: 'Nova entrega atribuída',
                mensagem: `Pedido #${pedido_id} atribuído a você`,
                pedido_id: pedido_id,
                destinatario_id: finalEntregadorId
            });
        }

        // Notify kitchen/attendance
        await emitNotification({
            tipo: 'pedido_atualizado',
            titulo: 'Pedido saiu para entrega',
            mensagem: `Pedido #${pedido_id} saiu para entrega`,
            pedido_id: pedido_id,
            destinatario_perfil: 'cozinha'
        });

        res.status(201).json({
            message: 'Entrega criada com sucesso',
            entrega
        });
    } catch (error) {
        console.error('Error creating delivery:', error);
        res.status(500).json({ error: 'Erro ao criar entrega' });
    }
});

/**
 * GET /api/entregas
 * Listar entregas (admin/atendente)
 */
router.get('/', entregaValidators.list, async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            entregador_id,
            status,
            data_inicio,
            data_fim
        } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE 1=1';
        const params = [];

        if (entregador_id) {
            whereClause += ' AND e.entregador_id = ?';
            params.push(entregador_id);
        }
        if (status) {
            whereClause += ' AND e.status = ?';
            params.push(status);
        }
        if (data_inicio) {
            whereClause += ' AND date(e.created_at) >= date(?)';
            params.push(data_inicio);
        }
        if (data_fim) {
            whereClause += ' AND date(e.created_at) <= date(?)';
            params.push(data_fim);
        }

        // If user is deliverer, only show their deliveries
        if (req.user.perfil === 'entregador') {
            whereClause += ' AND e.entregador_id = ?';
            params.push(req.user.id);
        }

        const entregas = await db.query(`
            SELECT
                e.*,
                u.nome as entregador_nome,
                p.cliente_nome,
                p.endereco_entrega,
                p.valor_total,
                p.forma_pagamento_id,
                fp.nome as forma_pagamento
            FROM entregas e
            LEFT JOIN usuarios_admin u ON e.entregador_id = u.id
            JOIN pedidos p ON e.pedido_id = p.id
            LEFT JOIN formas_pagamento fp ON p.forma_pagamento_id = fp.id
            ${whereClause}
            ORDER BY e.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, parseInt(limit), offset]);

        const total = await db.queryOne(`
            SELECT COUNT(*) as count
            FROM entregas e
            JOIN pedidos p ON e.pedido_id = p.id
            ${whereClause}
        `, params);

        res.json({
            entregas,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total.count,
                totalPages: Math.ceil(total.count / limit)
            }
        });
    } catch (error) {
        console.error('Error listing deliveries:', error);
        res.status(500).json({ error: 'Erro ao listar entregas' });
    }
});

/**
 * GET /api/entregas/entregador/:entregadorId/ativas
 * Entregas ativas de um entregador
 */
router.get('/entregador/:entregadorId/ativas', async (req, res) => {
    try {
        const { entregadorId } = req.params;

        // Verify access - deliverer can only see their own
        if (req.user.perfil === 'entregador' && req.user.id !== parseInt(entregadorId)) {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const entregas = await db.query(`
            SELECT
                e.*,
                p.cliente_nome,
                p.cliente_telefone,
                p.endereco_entrega,
                p.valor_total,
                p.observacoes_pagamento,
                fp.nome as forma_pagamento,
                (
                    SELECT json_group_array(
                        json_object(
                            'nome', prod.nome,
                            'quantidade', pi.quantidade,
                            'preco_unitario', pi.preco_unitario,
                            'observacoes', pi.observacoes
                        )
                    )
                    FROM pedido_itens pi
                    JOIN produtos prod ON pi.produto_id = prod.id
                    WHERE pi.pedido_id = p.id
                ) as itens
            FROM entregas e
            JOIN pedidos p ON e.pedido_id = p.id
            LEFT JOIN formas_pagamento fp ON p.forma_pagamento_id = fp.id
            WHERE e.entregador_id = ?
            AND e.status IN ('aceita', 'retirada', 'em_rota')
            ORDER BY
                CASE e.status
                    WHEN 'retirada' THEN 1
                    WHEN 'aceita' THEN 2
                    WHEN 'em_rota' THEN 3
                END,
                e.saida_em ASC
        `, [entregadorId]);

        // Parse itens JSON
        const entregasFormatadas = entregas.map(e => ({
            ...e,
            itens: e.itens ? JSON.parse(e.itens) : []
        }));

        res.json(entregasFormatadas);
    } catch (error) {
        console.error('Error getting active deliveries:', error);
        res.status(500).json({ error: 'Erro ao buscar entregas ativas' });
    }
});

/**
 * PUT /api/entregas/:id
 * Atualizar entrega (status, localização, etc)
 */
router.put('/:id', entregaValidators.update, async (req, res) => {
    try {
        const { id } = req.params;
        const { entregador_id, status, latitude, longitude, observacoes } = req.body;

        const entrega = await db.queryOne('SELECT * FROM entregas WHERE id = ?', [id]);
        if (!entrega) {
            return res.status(404).json({ error: 'Entrega não encontrada' });
        }

        // Verify access - deliverer can only update their own
        if (req.user.perfil === 'entregador' && entrega.entregador_id !== req.user.id) {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const updates = [];
        const params = [];
        const statusAnterior = entrega.status;

        if (entregador_id !== undefined) {
            // Only admin can reassign
            if (req.user.perfil !== 'administrador') {
                return res.status(403).json({ error: 'Apenas administradores podem reatribuir entregas' });
            }
            updates.push('entregador_id = ?');
            params.push(entregador_id);
        }

        if (status !== undefined) {
            updates.push('status = ?');
            params.push(status);

            // Set timestamps based on status
            if (status === 'retirada' && !entrega.saida_em) {
                updates.push('saida_em = COALESCE(saida_em, CURRENT_TIMESTAMP)');
            }
            if (status === 'entregue') {
                updates.push('entregue_em = CURRENT_TIMESTAMP');
            }
        }

        if (latitude !== undefined) {
            updates.push('latitude = ?');
            params.push(latitude);
        }
        if (longitude !== undefined) {
            updates.push('longitude = ?');
            params.push(longitude);
        }
        if (observacoes !== undefined) {
            updates.push('observacoes = ?');
            params.push(observacoes);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nenhum campo para atualizar' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(id);

        await db.query(`UPDATE entregas SET ${updates.join(', ')} WHERE id = ?`, params);

        // If status changed, record history and notify
        if (status !== undefined && status !== statusAnterior) {
            await db.query(`
                INSERT INTO pedido_status_historico (pedido_id, status_anterior, status_novo, usuario_id, usuario_nome, motivo)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [entrega.pedido_id, statusAnterior, status, req.user.id, req.user.nome, 'Atualização de entrega']);

            // Update order status
            let novoStatusPedido = statusAnterior;
            if (status === 'retirada') novoStatusPedido = 'saiu_entrega';
            else if (status === 'entregue') novoStatusPedido = 'entregue';
            else if (status === 'falha') novoStatusPedido = 'cancelado';

            if (novoStatusPedido !== statusAnterior) {
                await db.query('UPDATE pedidos SET status = ? WHERE id = ?', [novoStatusPedido, entrega.pedido_id]);
            }

            // Notify relevant parties
            await emitNotification({
                tipo: 'pedido_atualizado',
                titulo: `Entrega ${status}`,
                mensagem: `Pedido #${entrega.pedido_id}: ${getStatusMessage(status)}`,
                pedido_id: entrega.pedido_id,
                destinatario_perfil: 'administrador'
            });

            // Notify client via push (if implemented)
            if (status === 'entregue') {
                await emitNotification({
                    tipo: 'pedido_entregue',
                    titulo: 'Pedido entregue',
                    mensagem: `Seu pedido #${entrega.pedido_id} foi entregue!`,
                    pedido_id: entrega.pedido_id,
                    destinatario_perfil: 'cliente'
                });
            }
        }

        const updated = await db.queryOne(`
            SELECT e.*, u.nome as entregador_nome
            FROM entregas e
            LEFT JOIN usuarios_admin u ON e.entregador_id = u.id
            WHERE e.id = ?
        `, [id]);

        res.json({
            message: 'Entrega atualizada com sucesso',
            entrega: updated
        });
    } catch (error) {
        console.error('Error updating delivery:', error);
        res.status(500).json({ error: 'Erro ao atualizar entrega' });
    }
});

/**
 * PUT /api/entregas/:id/localizacao
 * Atualizar localização do entregador (GPS)
 */
router.put('/:id/localizacao', entregaValidators.updateLocation, async (req, res) => {
    try {
        const { id } = req.params;
        const { latitude, longitude } = req.body;

        const entrega = await db.queryOne('SELECT * FROM entregas WHERE id = ?', [id]);
        if (!entrega) {
            return res.status(404).json({ error: 'Entrega não encontrada' });
        }

        // Verify access - deliverer can only update their own
        if (req.user.perfil === 'entregador' && entrega.entregador_id !== req.user.id) {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        if (entrega.status === 'entregue' || entrega.status === 'falha') {
            return res.status(400).json({ error: 'Entrega finalizada, não é possível atualizar localização' });
        }

        await db.query(`
            UPDATE entregas
            SET latitude = ?, longitude = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [latitude, longitude, id]);

        const updated = await db.queryOne('SELECT * FROM entregas WHERE id = ?', [id]);

        // Emit real-time location update (will be consumed by WebSocket/SSE)
        await emitNotification({
            tipo: 'entrega_localizacao',
            titulo: 'Localização atualizada',
            mensagem: `Entregador do pedido #${entrega.pedido_id} atualizou posição`,
            pedido_id: entrega.pedido_id,
            dados: { latitude, longitude },
            destinatario_perfil: 'administrador'
        });

        res.json({
            message: 'Localização atualizada',
            entrega: updated
        });
    } catch (error) {
        console.error('Error updating location:', error);
        res.status(500).json({ error: 'Erro ao atualizar localização' });
    }
});

/**
 * DELETE /api/entregas/:id
 * Cancelar/excluir entrega (admin)
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const entrega = await db.queryOne('SELECT * FROM entregas WHERE id = ?', [id]);
        if (!entrega) {
            return res.status(404).json({ error: 'Entrega não encontrada' });
        }

        if (entrega.status === 'entregue') {
            return res.status(400).json({ error: 'Não é possível excluir entrega já realizada' });
        }

        await db.query('DELETE FROM entregas WHERE id = ?', [id]);

        // Revert order status if needed
        if (entrega.status === 'aceita' || entrega.status === 'retirada' || entrega.status === 'em_rota') {
            await db.query('UPDATE pedidos SET status = ? WHERE id = ?', ['preparando', entrega.pedido_id]);
        }

        res.json({ message: 'Entrega cancelada com sucesso' });
    } catch (error) {
        console.error('Error deleting delivery:', error);
        res.status(500).json({ error: 'Erro ao cancelar entrega' });
    }
});

/**
 * GET /api/entregas/entregadores
 * Listar entregadores disponíveis
 */
router.get('/entregadores', async (req, res) => {
    try {
        const entregadores = await db.query(`
            SELECT
                u.id,
                u.nome,
                u.telefone,
                u.ativo,
                COUNT(e.id) as entregas_ativas,
                COUNT(CASE WHEN e.status = 'entregue' AND date(e.entregue_em) = date('now') THEN 1 END) as entregues_hoje
            FROM usuarios_admin u
            LEFT JOIN entregas e ON u.id = e.entregador_id AND e.status IN ('aceita', 'retirada', 'em_rota')
            WHERE u.perfil = 'entregador'
            GROUP BY u.id, u.nome, u.telefone, u.ativo
            ORDER BY u.nome
        `, []);

        res.json(entregadores);
    } catch (error) {
        console.error('Error listing deliverers:', error);
        res.status(500).json({ error: 'Erro ao listar entregadores' });
    }
});

function getStatusMessage(status) {
    const messages = {
        'pendente': 'Aguardando entregador',
        'aceita': 'Entregador aceitou',
        'retirada': 'Pedido retirado',
        'em_rota': 'Em rota de entrega',
        'entregue': 'Entregue com sucesso',
        'falha': 'Falha na entrega'
    };
    return messages[status] || status;
}

export default router;