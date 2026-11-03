import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config, validateConfig } from '../shared/config/index.js';
import { generalLimiter, sensitiveApiLimiter, createLimiter } from '../shared/middleware/rateLimiter.js';
import { authenticateToken, optionalAuth, requireRole } from '../shared/middleware/auth.js';
import { commonValidators, avaliacaoValidators } from '../shared/middleware/validation.js';
import { query, queryOne, run, transaction } from '../shared/database/connection.js';
import { emitNotification } from '../notification-service/src/index.js';

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
    res.json({ status: 'ok', service: 'review', timestamp: new Date().toISOString() });
});

// ============================================
// CLIENTE - AVALIAÇÕES
// ============================================

// Criar avaliação (apenas para pedidos entregues do cliente)
app.post('/api/avaliacoes', authenticateToken, requireRole('cliente'), createLimiter, avaliacaoValidators.create, async (req, res) => {
    try {
        const { pedido_id, estrelas, comentario } = req.body;

        // Verificar se pedido existe, é do cliente e foi entregue
        const pedido = await queryOne(
            'SELECT * FROM pedidos WHERE id = ? AND cliente_id = ? AND status = "entregue"',
            [pedido_id, req.user.id]
        );
        if (!pedido) {
            return res.status(404).json({ error: 'Pedido não encontrado ou não elegível para avaliação' });
        }

        // Verificar se já avaliou
        const existing = await queryOne('SELECT 1 FROM avaliacoes WHERE pedido_id = ?', [pedido_id]);
        if (existing) {
            return res.status(409).json({ error: 'Este pedido já foi avaliado' });
        }

        const result = await run(
            'INSERT INTO avaliacoes (pedido_id, cliente_id, estrelas, comentario) VALUES (?, ?, ?, ?)',
            [pedido_id, req.user.id, estrelas, comentario || null]
        );

        const avaliacao = await queryOne('SELECT * FROM avaliacoes WHERE id = ?', [result.lastInsertRowid]);

        // Notificar admin
        emitNotification({
            tipo: 'avaliacao_nova',
            titulo: 'Nova Avaliação Recebida',
            mensagem: `Pedido ${pedido.numero_pedido} recebeu ${estrelas} estrela(s)`,
            pedido_id: pedido_id,
            destinatario_perfil: 'administrador',
            dados: JSON.stringify({ numero_pedido: pedido.numero_pedido, estrelas, comentario })
        });

        res.status(201).json(avaliacao);
    } catch (error) {
        console.error('Create review error:', error);
        res.status(500).json({ error: 'Erro ao criar avaliação' });
    }
});

// Listar avaliações do cliente
app.get('/api/avaliacoes/minhas', authenticateToken, requireRole('cliente'), avaliacaoValidators.list, async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;

        const avaliacoes = await query(`
            SELECT a.*, p.numero_pedido, p.data_pedido
            FROM avaliacoes a
            JOIN pedidos p ON a.pedido_id = p.id
            WHERE a.cliente_id = ?
            ORDER BY a.created_at DESC
            LIMIT ? OFFSET ?
        `, [req.user.id, parseInt(limit), (parseInt(page) - 1) * parseInt(limit)]);

        const total = await queryOne('SELECT COUNT(*) as total FROM avaliacoes WHERE cliente_id = ?', [req.user.id]);

        res.json({
            data: avaliacoes,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total.total,
                totalPages: Math.ceil(total.total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('List my reviews error:', error);
        res.status(500).json({ error: 'Erro ao buscar avaliações' });
    }
});

// Verificar se pode avaliar pedido
app.get('/api/avaliacoes/pode-avaliar/:pedidoId', authenticateToken, requireRole('cliente'), commonValidators.idParam, async (req, res) => {
    try {
        const pedido = await queryOne(
            'SELECT * FROM pedidos WHERE id = ? AND cliente_id = ? AND status = "entregue"',
            [req.params.pedidoId, req.user.id]
        );
        if (!pedido) {
            return res.json({ pode: false, motivo: 'Pedido não encontrado ou não entregue' });
        }

        const existing = await queryOne('SELECT 1 FROM avaliacoes WHERE pedido_id = ?', [req.params.pedidoId]);
        if (existing) {
            return res.json({ pode: false, motivo: 'Já avaliado' });
        }

        res.json({ pode: true, pedido: { id: pedido.id, numero_pedido: pedido.numero_pedido } });
    } catch (error) {
        console.error('Check can review error:', error);
        res.status(500).json({ error: 'Erro ao verificar' });
    }
});

// ============================================
// ADMIN - AVALIAÇÕES
// ============================================

// Listar todas as avaliações (com filtros)
app.get('/api/admin/avaliacoes', authenticateToken, requireRole('administrador'), avaliacaoValidators.list, async (req, res) => {
    try {
        const { page = 1, limit = 20, estrelas, respondido, data_inicio, data_fim } = req.query;

        let where = 'WHERE 1=1';
        const params = [];

        if (estrelas) { where += ' AND a.estrelas = ?'; params.push(estrelas); }
        if (respondido !== undefined) { where += ' AND a.respondido = ?'; params.push(respondido === 'true' ? 1 : 0); }
        if (data_inicio) { where += ' AND date(a.created_at) >= date(?)'; params.push(data_inicio); }
        if (data_fim) { where += ' AND date(a.created_at) <= date(?)'; params.push(data_fim); }

        const avaliacoes = await query(`
            SELECT a.*, c.nome as cliente_nome, p.numero_pedido, p.data_pedido,
                   u.nome as respondido_por_nome
            FROM avaliacoes a
            JOIN clientes c ON a.cliente_id = c.id
            JOIN pedidos p ON a.pedido_id = p.id
            LEFT JOIN usuarios_admin u ON a.respondido_por = u.id
            ${where}
            ORDER BY a.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, parseInt(limit), (parseInt(page) - 1) * parseInt(limit)]);

        const total = await queryOne(
            `SELECT COUNT(*) as total FROM avaliacoes a JOIN clientes c ON a.cliente_id = c.id JOIN pedidos p ON a.pedido_id = p.id ${where}`,
            params
        );

        res.json({
            data: avaliacoes,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total.total,
                totalPages: Math.ceil(total.total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Admin list reviews error:', error);
        res.status(500).json({ error: 'Erro ao buscar avaliações' });
    }
});

// Estatísticas de avaliações
app.get('/api/admin/avaliacoes/estatisticas', authenticateToken, requireRole('administrador'), async (req, res) => {
    try {
        const stats = await queryOne(`
            SELECT
                COUNT(*) as total,
                AVG(estrelas) as media,
                COUNT(CASE WHEN estrelas = 5 THEN 1 END) as cinco_estrelas,
                COUNT(CASE WHEN estrelas = 4 THEN 1 END) as quatro_estrelas,
                COUNT(CASE WHEN estrelas = 3 THEN 1 END) as tres_estrelas,
                COUNT(CASE WHEN estrelas = 2 THEN 1 END) as duas_estrelas,
                COUNT(CASE WHEN estrelas = 1 THEN 1 END) as uma_estrela,
                COUNT(CASE WHEN respondido = 1 THEN 1 END) as respondidas
            FROM avaliacoes
        `);

        // Por mês
        const porMes = await query(`
            SELECT strftime('%Y-%m', created_at) as mes, COUNT(*) as total, AVG(estrelas) as media
            FROM avaliacoes
            GROUP BY mes
            ORDER BY mes DESC
            LIMIT 12
        `);

        res.json({ geral: stats, por_mes: porMes });
    } catch (error) {
        console.error('Review stats error:', error);
        res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
});

// Responder avaliação
app.put('/api/admin/avaliacoes/:id/responder', authenticateToken, requireRole('administrador'), commonValidators.idParam, avaliacaoValidators.respond, async (req, res) => {
    try {
        const { resposta } = req.body;

        const avaliacao = await queryOne('SELECT * FROM avaliacoes WHERE id = ?', [req.params.id]);
        if (!avaliacao) return res.status(404).json({ error: 'Avaliação não encontrada' });
        if (avaliacao.respondido) return res.status(400).json({ error: 'Avaliação já respondida' });

        await run(
            'UPDATE avaliacoes SET respondido = 1, resposta_admin = ?, respondido_em = CURRENT_TIMESTAMP, respondido_por = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [resposta, req.user.id, req.params.id]
        );

        const updated = await queryOne('SELECT * FROM avaliacoes WHERE id = ?', [req.params.id]);
        res.json(updated);
    } catch (error) {
        console.error('Respond review error:', error);
        res.status(500).json({ error: 'Erro ao responder avaliação' });
    }
});

// Excluir avaliação (admin)
app.delete('/api/admin/avaliacoes/:id', authenticateToken, requireRole('administrador'), commonValidators.idParam, async (req, res) => {
    try {
        await run('DELETE FROM avaliacoes WHERE id = ?', [req.params.id]);
        res.json({ message: 'Avaliação excluída com sucesso' });
    } catch (error) {
        console.error('Delete review error:', error);
        res.status(500).json({ error: 'Erro ao excluir avaliação' });
    }
});

// ============================================
// PÚBLICO - AVALIAÇÕES DO ESTABELECIMENTO
// ============================================

app.get('/api/avaliacoes/publicas', optionalAuth, async (req, res) => {
    try {
        const { limit = 10, estrelas } = req.query;
        let where = 'WHERE a.respondido = 1';
        const params = [];

        if (estrelas) { where += ' AND a.estrelas = ?'; params.push(estrelas); }

        params.push(parseInt(limit));

        const avaliacoes = await query(`
            SELECT a.estrelas, a.comentario, a.resposta_admin, a.created_at,
                   c.nome as cliente_nome
            FROM avaliacoes a
            JOIN clientes c ON a.cliente_id = c.id
            ${where}
            ORDER BY a.created_at DESC
            LIMIT ?
        `, params);

        // Anonimizar nome do cliente
        const publicas = avaliacoes.map(a => ({
            ...a,
            cliente_nome: a.cliente_nome ? `${a.cliente_nome[0]}.***` : 'Cliente'
        }));

        const stats = await queryOne('SELECT AVG(estrelas) as media, COUNT(*) as total FROM avaliacoes');

        res.json({ avaliacoes: publicas, media: stats.media ? Number(stats.media.toFixed(1)) : 0, total: stats.total });
    } catch (error) {
        console.error('Public reviews error:', error);
        res.status(500).json({ error: 'Erro ao buscar avaliações públicas' });
    }
});

const PORT = config.server.port + 7; // 3007
app.listen(PORT, () => {
    console.log(`⭐ Review Service rodando na porta ${PORT}`);
});

export default app;