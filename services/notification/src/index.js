import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { WebSocketServer } from 'ws';
import { config, validateConfig } from '../shared/config/index.js';
import { generalLimiter, sensitiveApiLimiter, wsConnectionLimiter } from '../shared/middleware/rateLimiter.js';
import { authenticateToken, optionalAuth, verifyToken } from '../shared/middleware/auth.js';
import { commonValidators, notificacaoValidators } from '../shared/middleware/validation.js';
import { query, queryOne, run } from '../shared/database/connection.js';
import webpush from 'web-push';

// Validar configuração
validateConfig();

// Configurar Web Push
if (config.webPush.publicKey && config.webPush.privateKey) {
    webpush.setVapidDetails(
        config.webPush.subject,
        config.webPush.publicKey,
        config.webPush.privateKey
    );
}

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
    res.json({ status: 'ok', service: 'notification', timestamp: new Date().toISOString() });
});

// ============================================
// WEBSOCKET SERVER
// ============================================

const wss = new WebSocketServer({ port: config.server.wsPort });

// Armazenar conexões por perfil e usuário
const connections = new Map(); // userId -> Set<WebSocket>
const profileConnections = new Map(); // perfil -> Set<WebSocket>
const sseConnections = new Map(); // userId -> Set<Response>

function getProfileFromToken(token) {
    try {
        const decoded = verifyToken(token);
        return decoded.perfil || decoded.tipo || 'cliente';
    } catch {
        return null;
    }
}

function addConnection(userId, perfil, ws) {
    if (!connections.has(userId)) connections.set(userId, new Set());
    connections.get(userId).add(ws);

    if (!profileConnections.has(perfil)) profileConnections.set(perfil, new Set());
    profileConnections.get(perfil).add(ws);

    ws.userId = userId;
    ws.perfil = perfil;
}

function removeConnection(userId, perfil, ws) {
    if (connections.has(userId)) {
        connections.get(userId).delete(ws);
        if (connections.get(userId).size === 0) connections.delete(userId);
    }
    if (profileConnections.has(perfil)) {
        profileConnections.get(perfil).delete(ws);
        if (profileConnections.get(perfil).size === 0) profileConnections.delete(perfil);
    }
}

function broadcastToProfile(perfil, message, excludeUserId = null) {
    const conns = profileConnections.get(perfil);
    if (!conns) return 0;

    const data = JSON.stringify(message);
    let sent = 0;
    for (const ws of conns) {
        if (ws.readyState === 1 && ws.userId !== excludeUserId) { // OPEN
            ws.send(data);
            sent++;
        }
    }
    return sent;
}

function sendToUser(userId, message) {
    const conns = connections.get(userId);
    if (!conns) return 0;

    const data = JSON.stringify(message);
    let sent = 0;
    for (const ws of conns) {
        if (ws.readyState === 1) {
            ws.send(data);
            sent++;
        }
    }
    return sent;
}

function sendToAll(message) {
    const data = JSON.stringify(message);
    let sent = 0;
    for (const [, conns] of connections) {
        for (const ws of conns) {
            if (ws.readyState === 1) {
                ws.send(data);
                sent++;
            }
        }
    }
    return sent;
}

wss.on('connection', async (ws, req) => {
    // Autenticação via query param ou header
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token') || req.headers['sec-websocket-protocol']?.split(',')[0]?.trim();

    if (!token) {
        ws.close(4001, 'Token required');
        return;
    }

    try {
        const decoded = verifyToken(token);
        const userId = decoded.id;
        const perfil = decoded.perfil || decoded.tipo || 'cliente';

        addConnection(userId, perfil, ws);

        // Enviar confirmação de conexão
        ws.send(JSON.stringify({ type: 'CONNECTED', userId, perfil }));

        // Enviar notificações não lidas
        const notifications = await query(
            'SELECT * FROM notificacoes_internas WHERE (destinatario_perfil = ? OR destinatario_perfil = "todos") AND (destinatario_id = ? OR destinatario_id IS NULL) AND lida = 0 ORDER BY created_at DESC LIMIT 50',
            [perfil, userId]
        );
        if (notifications.length > 0) {
            ws.send(JSON.stringify({ type: 'NOTIFICATIONS', data: notifications }));
        }

        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data);
                if (msg.type === 'PING') {
                    ws.send(JSON.stringify({ type: 'PONG' }));
                } else if (msg.type === 'MARK_READ') {
                    // Marcar notificações como lidas
                    if (msg.ids && msg.ids.length > 0) {
                        const placeholders = msg.ids.map(() => '?').join(',');
                        run(`UPDATE notificacoes_internas SET lida = 1, lida_em = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`, msg.ids);
                    }
                }
            } catch (e) {
                console.error('WS message error:', e);
            }
        });

        ws.on('close', () => {
            removeConnection(userId, perfil, ws);
        });

        ws.on('error', (err) => {
            console.error('WS error:', err);
            removeConnection(userId, perfil, ws);
        });

    } catch (error) {
        ws.close(4001, 'Invalid token');
    }
});

// Heartbeat
setInterval(() => {
    for (const [, conns] of connections) {
        for (const ws of conns) {
            if (ws.readyState === 1) {
                ws.send(JSON.stringify({ type: 'PING' }));
            }
        }
    }
}, 30000);

console.log(`🔌 WebSocket server rodando na porta ${config.server.wsPort}`);

// ============================================
// SSE ENDPOINT
// ============================================

app.get('/api/notificacoes/stream', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const perfil = req.user.perfil || req.user.tipo || 'cliente';

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Enviar evento inicial
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', userId, perfil })}\n\n`);

    // Enviar notificações não lidas
    const notifications = await query(
        'SELECT * FROM notificacoes_internas WHERE (destinatario_perfil = ? OR destinatario_perfil = "todos") AND (destinatario_id = ? OR destinatario_id IS NULL) AND lida = 0 ORDER BY created_at DESC LIMIT 50',
        [perfil, userId]
    );
    if (notifications.length > 0) {
        res.write(`data: ${JSON.stringify({ type: 'NOTIFICATIONS', data: notifications })}\n\n`);
    }

    // Adicionar à lista de conexões SSE
    if (!sseConnections.has(userId)) sseConnections.set(userId, new Set());
    sseConnections.get(userId).add(res);

    // Heartbeat
    const interval = setInterval(() => {
        res.write(`: heartbeat\n\n`);
    }, 30000);

    req.on('close', () => {
        clearInterval(interval);
        if (sseConnections.has(userId)) {
            sseConnections.get(userId).delete(res);
            if (sseConnections.get(userId).size === 0) sseConnections.delete(userId);
        }
    });
});

function broadcastSSE(perfil, message, excludeUserId = null) {
    for (const [userId, conns] of sseConnections) {
        if (userId !== excludeUserId) {
            for (const res of conns) {
                try {
                    res.write(`data: ${JSON.stringify(message)}\n\n`);
                } catch (e) {
                    // Ignorar erros de escrita
                }
            }
        }
    }
}

// ============================================
// FUNÇÕES EXPORTADAS PARA OUTROS SERVIÇOS
// ============================================

export function emitNotification(notification) {
    // Salvar no banco
    run(
        `INSERT INTO notificacoes_internas (tipo, titulo, mensagem, pedido_id, destinatario_perfil, destinatario_id, dados)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [notification.tipo, notification.titulo, notification.mensagem, notification.pedido_id || null, notification.destinatario_perfil || 'todos', notification.destinatario_id || null, notification.dados || null]
    ).catch(console.error);

    // Broadcast via WebSocket
    if (notification.destinatario_id) {
        sendToUser(notification.destinatario_id, { type: 'NOTIFICATION', data: notification });
    } else if (notification.destinatario_perfil) {
        broadcastToProfile(notification.destinatario_perfil, { type: 'NOTIFICATION', data: notification });
    } else {
        sendToAll({ type: 'NOTIFICATION', data: notification });
    }

    // Broadcast via SSE
    if (notification.destinatario_id) {
        // SSE não tem filtro por ID fácil, enviar para todos do perfil
        broadcastSSE(notification.destinatario_perfil || 'todos', { type: 'NOTIFICATION', data: notification });
    } else {
        broadcastSSE(notification.destinatario_perfil || 'todos', { type: 'NOTIFICATION', data: notification });
    }
}

export function broadcastToProfile(perfil, message, excludeUserId = null) {
    broadcastToProfile(perfil, message, excludeUserId);
    broadcastSSE(perfil, message, excludeUserId);
}

export function sendToUser(userId, message) {
    sendToUser(userId, message);
    // SSE não suporta facilmente envio para userId específico sem manter mapeamento perfil->userId
}

// ============================================
// NOTIFICAÇÕES INTERNAS (ADMIN/ATENDENTE/COZINHA/ENTREGADOR)
// ============================================

app.get('/api/notificacoes/internas', authenticateToken, requireRole('administrador', 'atendente', 'cozinha', 'entregador'), async (req, res) => {
    try {
        const { page = 1, limit = 20, lida, tipo } = req.query;
        const userId = req.user.id;
        const perfil = req.user.perfil;

        let sql = `SELECT * FROM notificacoes_internas WHERE (destinatario_perfil = ? OR destinatario_perfil = 'todos') AND (destinatario_id = ? OR destinatario_id IS NULL)`;
        const params = [perfil, userId];

        if (lida !== undefined) { sql += ' AND lida = ?'; params.push(lida === 'true' ? 1 : 0); }
        if (tipo) { sql += ' AND tipo = ?'; params.push(tipo); }

        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

        const notificacoes = await query(sql, params);

        const total = await queryOne(
            `SELECT COUNT(*) as total FROM notificacoes_internas WHERE (destinatario_perfil = ? OR destinatario_perfil = 'todos') AND (destinatario_id = ? OR destinatario_id IS NULL)` +
            (lida !== undefined ? ' AND lida = ?' : '') +
            (tipo ? ' AND tipo = ?' : ''),
            params.slice(0, -2)
        );

        res.json({
            data: notificacoes,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total.total,
                totalPages: Math.ceil(total.total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('List notifications error:', error);
        res.status(500).json({ error: 'Erro ao buscar notificações' });
    }
});

app.put('/api/notificacoes/internas/ler', authenticateToken, requireRole('administrador', 'atendente', 'cozinha', 'entregador'), notificacaoValidators.markRead, async (req, res) => {
    try {
        const { ids } = req.body;
        const placeholders = ids.map(() => '?').join(',');
        await run(`UPDATE notificacoes_internas SET lida = 1, lida_em = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`, ids);
        res.json({ message: 'Notificações marcadas como lidas' });
    } catch (error) {
        console.error('Mark notifications read error:', error);
        res.status(500).json({ error: 'Erro ao marcar notificações' });
    }
});

app.put('/api/notificacoes/internas/:id/ler', authenticateToken, requireRole('administrador', 'atendente', 'cozinha', 'entregador'), commonValidators.idParam, async (req, res) => {
    try {
        await run('UPDATE notificacoes_internas SET lida = 1, lida_em = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
        res.json({ message: 'Notificação marcada como lida' });
    } catch (error) {
        console.error('Mark notification read error:', error);
        res.status(500).json({ error: 'Erro ao marcar notificação' });
    }
});

// ============================================
// PUSH NOTIFICATIONS (CLIENTE)
// ============================================

// Obter chave pública VAPID
app.get('/api/push/vapid-key', optionalAuth, (req, res) => {
    if (!config.webPush.publicKey) {
        return res.status(503).json({ error: 'Push notifications não configuradas' });
    }
    res.json({ publicKey: config.webPush.publicKey });
});

// Registrar subscription
app.post('/api/push/subscribe', authenticateToken, requireRole('cliente'), notificacaoValidators.subscribePush, async (req, res) => {
    try {
        const { endpoint, keys } = req.body;

        // Verificar se já existe
        const existing = await queryOne('SELECT 1 FROM push_subscriptions WHERE endpoint = ? AND cliente_id = ?', [endpoint, req.user.id]);
        if (existing) {
            return res.json({ message: 'Subscription já registrada' });
        }

        await run(
            'INSERT INTO push_subscriptions (cliente_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)',
            [req.user.id, endpoint, keys.p256dh, keys.auth]
        );

        res.status(201).json({ message: 'Subscription registrada com sucesso' });
    } catch (error) {
        console.error('Push subscribe error:', error);
        res.status(500).json({ error: 'Erro ao registrar subscription' });
    }
});

// Remover subscription
app.delete('/api/push/subscribe', authenticateToken, requireRole('cliente'), async (req, res) => {
    try {
        const { endpoint } = req.body;
        await run('DELETE FROM push_subscriptions WHERE endpoint = ? AND cliente_id = ?', [endpoint, req.user.id]);
        res.json({ message: 'Subscription removida' });
    } catch (error) {
        console.error('Push unsubscribe error:', error);
        res.status(500).json({ error: 'Erro ao remover subscription' });
    }
});

// Enviar push para cliente (admin)
app.post('/api/admin/push/enviar', authenticateToken, requireRole('administrador'), async (req, res) => {
    try {
        const { cliente_ids, titulo, corpo, data } = req.body;

        if (!config.webPush.publicKey || !config.webPush.privateKey) {
            return res.status(503).json({ error: 'Push notifications não configuradas' });
        }

        let where = 'WHERE 1=1';
        const params = [];

        if (cliente_ids && cliente_ids.length > 0) {
            where += ` AND cliente_id IN (${cliente_ids.map(() => '?').join(',')})`;
            params.push(...cliente_ids);
        }

        const subscriptions = await query(`SELECT * FROM push_subscriptions ${where}`, params);

        const payload = JSON.stringify({
            title: titulo,
            body: corpo,
            data: data || {},
            icon: '/img/icon-192.svg',
            badge: '/img/icon-72.svg'
        });

        let sent = 0;
        let failed = 0;

        for (const sub of subscriptions) {
            try {
                await webpush.sendNotification(
                    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                    payload
                );
                sent++;
            } catch (error) {
                if (error.statusCode === 410 || error.statusCode === 404) {
                    // Subscription inválida, remover
                    await run('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
                }
                failed++;
            }
        }

        res.json({ sent, failed, total: subscriptions.length });
    } catch (error) {
        console.error('Send push error:', error);
        res.status(500).json({ error: 'Erro ao enviar push' });
    }
});

// ============================================
// STATUS DAS CONEXÕES
// ============================================

app.get('/api/notificacoes/status', authenticateToken, requireRole('administrador'), (req, res) => {
    const wsStats = {};
    for (const [perfil, conns] of profileConnections) {
        wsStats[perfil] = conns.size;
    }

    const sseStats = {};
    for (const [userId, conns] of sseConnections) {
        sseStats[userId] = conns.size;
    }

    res.json({
        websocket: wsStats,
        sse: sseStats,
        total_ws: Array.from(connections.values()).reduce((sum, s) => sum + s.size, 0),
        total_sse: Array.from(sseConnections.values()).reduce((sum, s) => sum + s.size, 0)
    });
});

const PORT = config.server.port + 5; // 3005
app.listen(PORT, () => {
    console.log(`🔔 Notification Service rodando na porta ${PORT}`);
});

export default app;