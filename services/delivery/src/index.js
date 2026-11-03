import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config, validateConfig } from '../shared/config/index.js';
import { generalLimiter, sensitiveApiLimiter, createLimiter } from '../shared/middleware/rateLimiter.js';
import { authenticateToken, requireRole } from '../shared/middleware/auth.js';
import { commonValidators, entregaValidators } from '../shared/middleware/validation.js';
import { query, queryOne, run, transaction } from '../shared/database/connection.js';
import { emitNotification, broadcastToProfile } from '../notification-service/src/index.js';
import { calculateDistance, formatCurrency } from '../shared/utils/index.js';

// Validar configuração
validateConfig();

const app = express();

// Middlewares globais
app.use(helmet({
    contentSecurityPolicy: config.server.env === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false
}));
app.use(cors({
    origin: config.server.env === 'production' ? config.frontend.url : true,
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(generalLimiter);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'delivery', timestamp: new Date().toISOString() });
});

// ============================================
// ENTREGAS - ENTREGADOR
// ============================================

// Listar entregas disponíveis (pendentes)
app.get('/api/entregas/disponiveis', authenticateToken, requireRole('entregador'), async (req, res) => {
    try {
        const entregas = await query(`
            SELECT e.*, p.numero_pedido, p.cliente_nome, p.cliente_telefone,
                   p.cep, p.logradouro, p.numero_endereco, p.bairro, p.complemento, p.referencia,
                   p.valor_total, p.forma_pagamento_id, fp.nome as forma_pagamento_nome,
                   (SELECT COUNT(*) FROM entregas WHERE entregador_id = ? AND status IN ('aceita', 'retirada', 'em_rota')) as entregas_ativas
            FROM entregas e
            JOIN pedidos p ON e.pedido_id = p.id
            JOIN formas_pagamento fp ON p.forma_pagamento_id = fp.id
            WHERE e.status = 'pendente' AND e.entregador_id IS NULL
            ORDER BY p.data_pedido ASC
        `, [req.user.id]);

        res.json(entregas);
    } catch (error) {
        console.error('List available deliveries error:', error);
        res.status(500).json({ error: 'Erro ao buscar entregas disponíveis' });
    }
});

// Listar minhas entregas
app.get('/api/entregas/minhas', authenticateToken, requireRole('entregador'), entregaValidators.list, async (req, res) => {
    try {
        const { page = 1, limit = 20, status } = req.query;
        let sql = `
            SELECT e.*, p.numero_pedido, p.cliente_nome, p.cliente_telefone,
                   p.cep, p.logradouro, p.numero_endereco, p.bairro, p.complemento, p.referencia,
                   p.valor_total
            FROM entregas e
            JOIN pedidos p ON e.pedido_id = p.id
            WHERE e.entregador_id = ?
        `;
        const params = [req.user.id];

        if (status) { sql += ' AND e.status = ?'; params.push(status); }

        sql += ' ORDER BY e.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

        const entregas = await query(sql, params);

        const total = await queryOne(
            'SELECT COUNT(*) as total FROM entregas WHERE entregador_id = ?' + (status ? ' AND status = ?' : ''),
            params.slice(0, -2)
        );

        res.json({
            data: entregas,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total.total,
                totalPages: Math.ceil(total.total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('List my deliveries error:', error);
        res.status(500).json({ error: 'Erro ao buscar minhas entregas' });
    }
});

// Aceitar entrega
app.post('/api/entregas/:id/aceitar', authenticateToken, requireRole('entregador'), commonValidators.idParam, async (req, res) => {
    try {
        const entrega = await queryOne('SELECT * FROM entregas WHERE id = ?', [req.params.id]);
        if (!entrega) return res.status(404).json({ error: 'Entrega não encontrada' });
        if (entrega.status !== 'pendente') return res.status(400).json({ error: 'Entrega não está disponível' });
        if (entrega.entregador_id) return res.status(400).json({ error: 'Entrega já foi aceita por outro entregador' });

        // Verificar limite de entregas ativas
        const ativas = await queryOne(
            'SELECT COUNT(*) as total FROM entregas WHERE entregador_id = ? AND status IN ("aceita", "retirada", "em_rota")',
            [req.user.id]
        );
        if (ativas.total >= 3) {
            return res.status(400).json({ error: 'Você já tem 3 entregas ativas. Conclua uma antes de aceitar outra.' });
        }

        await transaction(() => {
            run('UPDATE entregas SET entregador_id = ?, status = "aceita", saida_em = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.user.id, req.params.id]);
            run(
                'INSERT INTO pedido_status_historico (pedido_id, status_anterior, status_novo, usuario_id, usuario_nome, motivo) VALUES (?, ?, ?, ?, ?, ?)',
                [entrega.pedido_id, 'pendente', 'aceita', req.user.id, req.user.nome, 'Entrega aceita pelo entregador']
            );
        });

        const pedido = await queryOne('SELECT * FROM pedidos WHERE id = ?', [entrega.pedido_id]);

        emitNotification({
            tipo: 'entrega_atribuida',
            titulo: 'Entrega Aceita',
            mensagem: `Entregador ${req.user.nome} aceitou o pedido ${pedido.numero_pedido}`,
            pedido_id: entrega.pedido_id,
            destinatario_perfil: 'todos',
            dados: JSON.stringify({ numero_pedido: pedido.numero_pedido, entregador: req.user.nome })
        });

        // Notificar cliente via push se tiver subscription
        broadcastToProfile('cliente', {
            type: 'DELIVERY_ACCEPTED',
            data: { pedidoId: entrega.pedido_id, numero_pedido: pedido.numero_pedido, entregador: req.user.nome }
        });

        const updated = await queryOne('SELECT * FROM entregas WHERE id = ?', [req.params.id]);
        res.json(updated);
    } catch (error) {
        console.error('Accept delivery error:', error);
        res.status(500).json({ error: 'Erro ao aceitar entrega' });
    }
});

// Atualizar status da entrega (entregador)
app.put('/api/entregas/:id/status', authenticateToken, requireRole('entregador'), commonValidators.idParam, entregaValidators.updateStatus, async (req, res) => {
    try {
        const { status, latitude, longitude, observacoes } = req.body;
        const entrega = await queryOne('SELECT * FROM entregas WHERE id = ? AND entregador_id = ?', [req.params.id, req.user.id]);
        if (!entrega) return res.status(404).json({ error: 'Entrega não encontrada' });

        const validTransitions = {
            'aceita': ['retirada'],
            'retirada': ['em_rota'],
            'em_rota': ['entregue', 'falha'],
            'entregue': [],
            'falha': []
        };

        if (!validTransitions[entrega.status]?.includes(status)) {
            return res.status(400).json({ error: `Transição inválida de ${entrega.status} para ${status}` });
        }

        const updates = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
        const params = [status];

        if (status === 'retirada') updates.push('saida_em = CURRENT_TIMESTAMP');
        if (status === 'entregue') updates.push('entregue_em = CURRENT_TIMESTAMP');
        if (latitude !== undefined) { updates.push('latitude = ?'); params.push(latitude); }
        if (longitude !== undefined) { updates.push('longitude = ?'); params.push(longitude); }
        if (observacoes !== undefined) { updates.push('observacoes = ?'); params.push(observacoes); }

        params.push(req.params.id);

        await transaction(() => {
            run(`UPDATE entregas SET ${updates.join(', ')} WHERE id = ?`, params);
            run(
                'INSERT INTO pedido_status_historico (pedido_id, status_anterior, status_novo, usuario_id, usuario_nome, motivo) VALUES (?, ?, ?, ?, ?, ?)',
                [entrega.pedido_id, entrega.status, status, req.user.id, req.user.nome, observacoes || null]
            );
        });

        const pedido = await queryOne('SELECT * FROM pedidos WHERE id = ?', [entrega.pedido_id]);

        // Se entregue, atualizar pedido
        if (status === 'entregue') {
            await run('UPDATE pedidos SET status = "entregue", data_atualizacao = CURRENT_TIMESTAMP WHERE id = ?', [entrega.pedido_id]);

            emitNotification({
                tipo: 'pedido_atualizado',
                titulo: 'Pedido Entregue',
                mensagem: `Pedido ${pedido.numero_pedido} foi entregue`,
                pedido_id: entrega.pedido_id,
                destinatario_perfil: 'todos',
                dados: JSON.stringify({ numero_pedido: pedido.numero_pedido })
            });

            broadcastToProfile('cliente', {
                type: 'DELIVERY_COMPLETED',
                data: { pedidoId: entrega.pedido_id, numero_pedido: pedido.numero_pedido }
            });
        }

        const updated = await queryOne('SELECT * FROM entregas WHERE id = ?', [req.params.id]);
        res.json(updated);
    } catch (error) {
        console.error('Update delivery status error:', error);
        res.status(500).json({ error: 'Erro ao atualizar status da entrega' });
    }
});

// Atualizar localização (GPS)
app.put('/api/entregas/:id/localizacao', authenticateToken, requireRole('entregador'), commonValidators.idParam, entregaValidators.updateLocation, async (req, res) => {
    try {
        const { latitude, longitude } = req.body;
        const entrega = await queryOne('SELECT * FROM entregas WHERE id = ? AND entregador_id = ?', [req.params.id, req.user.id]);
        if (!entrega) return res.status(404).json({ error: 'Entrega não encontrada' });
        if (!['aceita', 'retirada', 'em_rota'].includes(entrega.status)) {
            return res.status(400).json({ error: 'Não é possível atualizar localização neste status' });
        }

        await run('UPDATE entregas SET latitude = ?, longitude = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [latitude, longitude, req.params.id]);

        // Emitir localização tempo real para cliente e admin
        broadcastToProfile('cliente', {
            type: 'DELIVERY_LOCATION',
            data: { pedidoId: entrega.pedido_id, latitude, longitude, entregadorId: req.user.id }
        });

        broadcastToProfile('administrador', {
            type: 'DELIVERY_LOCATION',
            data: { pedidoId: entrega.pedido_id, latitude, longitude, entregadorId: req.user.id }
        });

        broadcastToProfile('atendente', {
            type: 'DELIVERY_LOCATION',
            data: { pedidoId: entrega.pedido_id, latitude, longitude, entregadorId: req.user.id }
        });

        res.json({ message: 'Localização atualizada', latitude, longitude });
    } catch (error) {
        console.error('Update delivery location error:', error);
        res.status(500).json({ error: 'Erro ao atualizar localização' });
    }
});

// ============================================
// ENTREGAS - ADMIN/ATENDENTE
// ============================================

// Listar todas as entregas (admin/atendente)
app.get('/api/admin/entregas', authenticateToken, requireRole('administrador', 'atendente'), entregaValidators.list, async (req, res) => {
    try {
        const { page = 1, limit = 20, status, entregador_id, data_inicio, data_fim } = req.query;
        let sql = `
            SELECT e.*, p.numero_pedido, p.cliente_nome, p.valor_total,
                   u.nome as entregador_nome
            FROM entregas e
            JOIN pedidos p ON e.pedido_id = p.id
            LEFT JOIN usuarios_admin u ON e.entregador_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (status) { sql += ' AND e.status = ?'; params.push(status); }
        if (entregador_id) { sql += ' AND e.entregador_id = ?'; params.push(entregador_id); }
        if (data_inicio) { sql += ' AND date(e.created_at) >= date(?)'; params.push(data_inicio); }
        if (data_fim) { sql += ' AND date(e.created_at) <= date(?)'; params.push(data_fim); }

        sql += ' ORDER BY e.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

        const entregas = await query(sql, params);

        const total = await queryOne(
            'SELECT COUNT(*) as total FROM entregas e JOIN pedidos p ON e.pedido_id = p.id WHERE 1=1' +
            (status ? ' AND e.status = ?' : '') +
            (entregador_id ? ' AND e.entregador_id = ?' : '') +
            (data_inicio ? ' AND date(e.created_at) >= date(?)' : '') +
            (data_fim ? ' AND date(e.created_at) <= date(?)' : ''),
            params.slice(0, -2)
        );

        res.json({
            data: entregas,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total.total,
                totalPages: Math.ceil(total.total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Admin list deliveries error:', error);
        res.status(500).json({ error: 'Erro ao buscar entregas' });
    }
});

// Atribuir entrega a entregador (admin/atendente)
app.post('/api/admin/entregas/:id/atribuir', authenticateToken, requireRole('administrador', 'atendente'), commonValidators.idParam, async (req, res) => {
    try {
        const { entregador_id } = req.body;
        const entrega = await queryOne('SELECT * FROM entregas WHERE id = ?', [req.params.id]);
        if (!entrega) return res.status(404).json({ error: 'Entrega não encontrada' });
        if (entrega.entregador_id) return res.status(400).json({ error: 'Entrega já atribuída' });

        const entregador = await queryOne('SELECT * FROM usuarios_admin WHERE id = ? AND perfil = "entregador" AND ativo = 1', [entregador_id]);
        if (!entregador) return res.status(404).json({ error: 'Entregador não encontrado ou inativo' });

        // Verificar limite
        const ativas = await queryOne(
            'SELECT COUNT(*) as total FROM entregas WHERE entregador_id = ? AND status IN ("aceita", "retirada", "em_rota")',
            [entregador_id]
        );
        if (ativas.total >= 3) {
            return res.status(400).json({ error: 'Entregador já tem 3 entregas ativas' });
        }

        await transaction(() => {
            run('UPDATE entregas SET entregador_id = ?, status = "aceita", saida_em = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [entregador_id, req.params.id]);
            run(
                'INSERT INTO pedido_status_historico (pedido_id, status_anterior, status_novo, usuario_id, usuario_nome, motivo) VALUES (?, ?, ?, ?, ?, ?)',
                [entrega.pedido_id, 'pendente', 'aceita', req.user.id, req.user.nome, `Entrega atribuída a ${entregador.nome}`]
            );
        });

        const pedido = await queryOne('SELECT * FROM pedidos WHERE id = ?', [entrega.pedido_id]);

        emitNotification({
            tipo: 'entrega_atribuida',
            titulo: 'Entrega Atribuída',
            mensagem: `Entrega do pedido ${pedido.numero_pedido} atribuída a ${entregador.nome}`,
            pedido_id: entrega.pedido_id,
            destinatario_id: entregador_id,
            destinatario_perfil: 'entregador',
            dados: JSON.stringify({ numero_pedido: pedido.numero_pedido })
        });

        broadcastToProfile('entregador', {
            type: 'DELIVERY_ASSIGNED',
            data: { pedidoId: entrega.pedido_id, numero_pedido: pedido.numero_pedido }
        }, entregador_id);

        const updated = await queryOne('SELECT * FROM entregas WHERE id = ?', [req.params.id]);
        res.json(updated);
    } catch (error) {
        console.error('Assign delivery error:', error);
        res.status(500).json({ error: 'Erro ao atribuir entrega' });
    }
});

// Auto-atribuir entrega (algoritmo de proximidade)
app.post('/api/admin/entregas/:id/auto-atribuir', authenticateToken, requireRole('administrador', 'atendente'), commonValidators.idParam, async (req, res) => {
    try {
        const entrega = await queryOne('SELECT * FROM entregas WHERE id = ?', [req.params.id]);
        if (!entrega) return res.status(404).json({ error: 'Entrega não encontrada' });
        if (entrega.entregador_id) return res.status(400).json({ error: 'Entrega já atribuída' });

        const pedido = await queryOne('SELECT * FROM pedidos WHERE id = ?', [entrega.pedido_id]);
        if (!pedido || !pedido.latitude || !pedido.longitude) {
            return res.status(400).json({ error: 'Pedido não possui coordenadas para auto-atribuição' });
        }

        // Buscar entregadores disponíveis com última localização conhecida
        const entregadores = await query(`
            SELECT u.id, u.nome, e.latitude, e.longitude,
                   (SELECT COUNT(*) FROM entregas WHERE entregador_id = u.id AND status IN ("aceita", "retirada", "em_rota")) as ativas
            FROM usuarios_admin u
            LEFT JOIN (
                SELECT DISTINCT ON (entregador_id) entregador_id, latitude, longitude
                FROM entregas
                WHERE entregador_id IS NOT NULL AND latitude IS NOT NULL AND longitude IS NOT NULL
                ORDER BY entregador_id, updated_at DESC
            ) e ON u.id = e.entregador_id
            WHERE u.perfil = 'entregador' AND u.ativo = 1
        `);

        if (entregadores.length === 0) {
            return res.status(400).json({ error: 'Nenhum entregador disponível' });
        }

        // Calcular distâncias e encontrar o mais próximo com menos de 3 entregas ativas
        let bestEntregador = null;
        let bestDistance = Infinity;

        for (const ent of entregadores) {
            if (ent.ativas >= 3) continue;
            if (ent.latitude && ent.longitude) {
                const dist = calculateDistance(pedido.latitude, pedido.longitude, ent.latitude, ent.longitude);
                if (dist < bestDistance) {
                    bestDistance = dist;
                    bestEntregador = ent;
                }
            } else if (!bestEntregador) {
                // Fallback: primeiro disponível sem localização
                bestEntregador = ent;
            }
        }

        if (!bestEntregador) {
            return res.status(400).json({ error: 'Todos os entregadores estão com carga máxima' });
        }

        await transaction(() => {
            run('UPDATE entregas SET entregador_id = ?, status = "aceita", saida_em = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [bestEntregador.id, req.params.id]);
            run(
                'INSERT INTO pedido_status_historico (pedido_id, status_anterior, status_novo, usuario_id, usuario_nome, motivo) VALUES (?, ?, ?, ?, ?, ?)',
                [entrega.pedido_id, 'pendente', 'aceita', req.user.id, req.user.nome, `Auto-atribuído a ${bestEntregador.nome} (distância: ${bestDistance.toFixed(1)}km)`]
            );
        });

        emitNotification({
            tipo: 'entrega_atribuida',
            titulo: 'Entrega Auto-Atribuída',
            mensagem: `Entrega do pedido ${pedido.numero_pedido} atribuída a ${bestEntregador.nome}`,
            pedido_id: entrega.pedido_id,
            destinatario_id: bestEntregador.id,
            destinatario_perfil: 'entregador',
            dados: JSON.stringify({ numero_pedido: pedido.numero_pedido, distancia_km: bestDistance.toFixed(1) })
        });

        broadcastToProfile('entregador', {
            type: 'DELIVERY_ASSIGNED',
            data: { pedidoId: entrega.pedido_id, numero_pedido: pedido.numero_pedido }
        }, bestEntregador.id);

        const updated = await queryOne('SELECT * FROM entregas WHERE id = ?', [req.params.id]);
        res.json({ ...updated, auto_atribuido: true, distancia_km: bestDistance });
    } catch (error) {
        console.error('Auto-assign delivery error:', error);
        res.status(500).json({ error: 'Erro na auto-atribuição' });
    }
});

// Estatísticas de entregas
app.get('/api/admin/entregas/estatisticas', authenticateToken, requireRole('administrador', 'atendente'), async (req, res) => {
    try {
        const { data_inicio, data_fim, entregador_id } = req.query;
        let where = 'WHERE 1=1';
        const params = [];

        if (data_inicio) { where += ' AND date(created_at) >= date(?)'; params.push(data_inicio); }
        if (data_fim) { where += ' AND date(created_at) <= date(?)'; params.push(data_fim); }
        if (entregador_id) { where += ' AND entregador_id = ?'; params.push(entregador_id); }

        const stats = await queryOne(`
            SELECT
                COUNT(*) as total_entregas,
                COUNT(CASE WHEN status = 'entregue' THEN 1 END) as entregues,
                COUNT(CASE WHEN status = 'falha' THEN 1 END) as falhas,
                COUNT(CASE WHEN status IN ('aceita', 'retirada', 'em_rota') THEN 1 END) as em_andamento,
                AVG(CASE
                    WHEN entregue_em IS NOT NULL AND saida_em IS NOT NULL
                    THEN (julianday(entregue_em) - julianday(saida_em)) * 24 * 60
                END) as tempo_medio_minutos
            FROM entregas ${where}
        `, params);

        // Por entregador
        const porEntregador = await query(`
            SELECT u.id, u.nome,
                   COUNT(*) as total,
                   COUNT(CASE WHEN status = 'entregue' THEN 1 END) as entregues,
                   AVG(CASE
                       WHEN entregue_em IS NOT NULL AND saida_em IS NOT NULL
                       THEN (julianday(entregue_em) - julianday(saida_em)) * 24 * 60
                   END) as tempo_medio
            FROM entregas e
            JOIN usuarios_admin u ON e.entregador_id = u.id
            ${where}
            GROUP BY u.id, u.nome
            ORDER BY entregues DESC
        `, params);

        res.json({ geral: stats, por_entregador: porEntregador });
    } catch (error) {
        console.error('Delivery stats error:', error);
        res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
});

// ============================================
// RASTREAMENTO PARA CLIENTE
// ============================================

app.get('/api/cliente/entregas/:pedidoId', authenticateToken, requireRole('cliente'), async (req, res) => {
    try {
        const entrega = await queryOne(`
            SELECT e.*, u.nome as entregador_nome, u.telefone as entregador_telefone
            FROM entregas e
            LEFT JOIN usuarios_admin u ON e.entregador_id = u.id
            JOIN pedidos p ON e.pedido_id = p.id
            WHERE e.pedido_id = ? AND p.cliente_id = ?
        `, [req.params.pedidoId, req.user.id]);

        if (!entrega) return res.status(404).json({ error: 'Entrega não encontrada' });

        res.json(entrega);
    } catch (error) {
        console.error('Client delivery tracking error:', error);
        res.status(500).json({ error: 'Erro ao buscar entrega' });
    }
});

const PORT = config.server.port + 4; // 3004
app.listen(PORT, () => {
    console.log(`🚚 Delivery Service rodando na porta ${PORT}`);
});

export default app;