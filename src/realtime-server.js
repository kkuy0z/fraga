/**
 * Real-time Notification Server (WebSocket + SSE)
 * RF-09: Notificações tempo real para cozinha/atendimento
 * RF-11: Rastreamento de entrega em tempo real
 *
 * This server handles real-time communication for:
 * - New order alerts for kitchen/attendance
 * - Order status updates
 * - Delivery tracking (GPS location updates)
 * - Internal notifications
 */

import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import jwt from 'jsonwebtoken';
import db from './database/connection.js';

const JWT_SECRET = process.env.JWT_SECRET;
const WS_PORT = process.env.WS_PORT || 3001;

// HTTP server for SSE fallback
const server = createServer();
const wss = new WebSocketServer({ server });

// Connected clients map: userId -> Set of WebSocket connections
const clients = new Map();
// Profile-based rooms: perfil -> Set of WebSocket connections
const profileRooms = new Map();

// Initialize profile rooms
['administrador', 'atendente', 'cozinha', 'entregador', 'cliente'].forEach(perfil => {
    profileRooms.set(perfil, new Set());
});

// Heartbeat interval
const HEARTBEAT_INTERVAL = 30000;

function heartbeat() {
    this.isAlive = true;
}

function startHeartbeat(ws) {
    ws.isAlive = true;
    ws.on('pong', heartbeat);

    const interval = setInterval(() => {
        if (ws.isAlive === false) {
            clearInterval(interval);
            removeClient(ws);
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
    }, HEARTBEAT_INTERVAL);

    ws._heartbeatInterval = interval;
}

function removeClient(ws) {
    if (ws.userId) {
        const userConnections = clients.get(ws.userId);
        if (userConnections) {
            userConnections.delete(ws);
            if (userConnections.size === 0) {
                clients.delete(ws.userId);
            }
        }
    }

    if (ws.perfil && profileRooms.has(ws.perfil)) {
        profileRooms.get(ws.perfil).delete(ws);
    }

    if (ws._heartbeatInterval) {
        clearInterval(ws._heartbeatInterval);
    }
}

function authenticateToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

// Verify user and get profile
async function verifyUser(decoded) {
    if (!decoded) {
        return null;
    }

    // Support both admin users and clientes
    if (decoded.tipo === 'cliente') {
        const cliente = await db.queryOne(
            'SELECT id, email, nome, telefone, ativo FROM clientes WHERE id = ?',
            [decoded.id]
        );

        if (!cliente || !cliente.ativo) {
            return null;
        }

        return {
            id: cliente.id,
            nome: cliente.nome,
            email: cliente.email,
            perfil: 'cliente',
            tipo: 'cliente'
        };
    }

    // Admin users
    const user = await db.queryOne(
        'SELECT id, email, nome, perfil, ativo FROM usuarios_admin WHERE id = ?',
        [decoded.id]
    );

    if (!user || !user.ativo) {
        return null;
    }

    return {
        ...user,
        tipo: 'admin'
    };
}

// Broadcast to specific user
function sendToUser(userId, message) {
    const userConnections = clients.get(userId);
    if (userConnections) {
        const data = JSON.stringify(message);
        userConnections.forEach(ws => {
            if (ws.readyState === 1) { // OPEN
                ws.send(data);
            }
        });
    }
}

// Broadcast to profile room
function sendToProfile(perfil, message) {
    const room = profileRooms.get(perfil);
    if (room) {
        const data = JSON.stringify(message);
        room.forEach(ws => {
            if (ws.readyState === 1) {
                ws.send(data);
            }
        });
    }
}

// Broadcast to all connected clients
function broadcast(message) {
    const data = JSON.stringify(message);
    clients.forEach(userConnections => {
        userConnections.forEach(ws => {
            if (ws.readyState === 1) {
                ws.send(data);
            }
        });
    });
}

// Handle incoming WebSocket messages
async function handleMessage(ws, message) {
    try {
        const data = JSON.parse(message);

        switch (data.type) {
            case 'subscribe':
                // Subscribe to specific events
                if (data.events && Array.isArray(data.events)) {
                    ws.subscriptions = data.events;
                }
                break;

            case 'unsubscribe':
                if (data.events && Array.isArray(data.events)) {
                    ws.subscriptions = ws.subscriptions?.filter(e => !data.events.includes(e)) || [];
                }
                break;

            case 'location':
                // Delivery person sending GPS location
                if (ws.perfil === 'entregador' && data.pedido_id && data.latitude && data.longitude) {
                    // Broadcast to admin/attendance tracking this delivery
                    sendToProfile('administrador', {
                        type: 'delivery_location',
                        pedido_id: data.pedido_id,
                        entregador_id: ws.userId,
                        entregador_nome: ws.userNome,
                        latitude: data.latitude,
                        longitude: data.longitude,
                        timestamp: new Date().toISOString()
                    });

                    // Also save to database
                    await db.query(`
                        UPDATE entregas
                        SET latitude = ?, longitude = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE entregador_id = ? AND status IN ('aceita', 'retirada', 'em_rota')
                    `, [data.latitude, data.longitude, ws.userId]);
                }
                break;

            case 'ping':
                ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
                break;

            default:
                console.log('Unknown message type:', data.type);
        }
    } catch (error) {
        console.error('Error handling message:', error);
    }
}

// WebSocket connection handler
wss.on('connection', async (ws, req) => {
    console.log('New WebSocket connection from:', req.socket.remoteAddress);

    // Extract token from query string
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
        ws.close(4001, 'Authentication required');
        return;
    }

    const decoded = authenticateToken(token);
    const user = await verifyUser(decoded);

    if (!user) {
        ws.close(4001, 'Invalid or expired token');
        return;
    }

    // Attach user info to WebSocket
    ws.userId = user.id;
    ws.userNome = user.nome;
    ws.perfil = user.perfil;
    ws.tipo = user.tipo;

    // Add to clients map
    if (!clients.has(user.id)) {
        clients.set(user.id, new Set());
    }
    clients.get(user.id).add(ws);

    // Add to profile room
    if (profileRooms.has(user.perfil)) {
        profileRooms.get(user.perfil).add(ws);
    }

    // Start heartbeat
    startHeartbeat(ws);

    // Send welcome message
    ws.send(JSON.stringify({
        type: 'connected',
        user: {
            id: user.id,
            nome: user.nome,
            perfil: user.perfil
        },
        timestamp: new Date().toISOString()
    }));

    // Send unread notifications count (only for admin users)
    if (user.tipo === 'admin') {
        const unreadCount = await db.queryOne(`
            SELECT COUNT(*) as count
            FROM notificacoes_internas
            WHERE lida = 0
            AND (destinatario_perfil = ? OR destinatario_perfil = 'todos' OR destinatario_id = ?)
        `, [user.perfil, user.id]);

        ws.send(JSON.stringify({
            type: 'unread_count',
            count: unreadCount?.count || 0,
            timestamp: new Date().toISOString()
        }));
    }

    // Handle messages
    ws.on('message', (message) => handleMessage(ws, message.toString()));

    // Handle close
    ws.on('close', () => {
        console.log(`WebSocket closed for user ${user.nome} (${user.perfil})`);
        removeClient(ws);
    });

    // Handle errors
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        removeClient(ws);
    });
});

// SSE endpoint for fallback
server.on('request', async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === '/sse' && req.method === 'GET') {
        const token = url.searchParams.get('token');

        if (!token) {
            res.writeHead(401, { 'Content-Type': 'text/plain' });
            res.end('Authentication required');
            return;
        }

        const decoded = authenticateToken(token);
        const user = await verifyUser(decoded);

        if (!user) {
            res.writeHead(401, { 'Content-Type': 'text/plain' });
            res.end('Invalid or expired token');
            return;
        }

        // Set SSE headers
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': process.env.FRONTEND_URL || '*'
        });

        // Send initial connection event
        res.write(`data: ${JSON.stringify({ type: 'connected', user: { id: user.id, nome: user.nome, perfil: user.perfil } })}\n\n`);

        // Create a pseudo-WebSocket for SSE
        const sseClient = {
            userId: user.id,
            userNome: user.nome,
            perfil: user.perfil,
            send: (data) => {
                res.write(`data: ${JSON.stringify(data)}\n\n`);
            },
            readyState: 1
        };

        // Add to clients map
        if (!clients.has(user.id)) {
            clients.set(user.id, new Set());
        }
        clients.get(user.id).add(sseClient);

        // Add to profile room
        if (profileRooms.has(user.perfil)) {
            profileRooms.get(user.perfil).add(sseClient);
        }

        // Heartbeat for SSE
        const sseHeartbeat = setInterval(() => {
            if (sseClient.readyState === 1) {
                res.write(`: heartbeat\n\n`);
            }
        }, HEARTBEAT_INTERVAL);

        // Handle client disconnect
        req.on('close', () => {
            clearInterval(sseHeartbeat);
            removeClient(sseClient);
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
    }
});

// Poll database for new notifications and broadcast
async function pollNotifications() {
    try {
        // Get unread notifications that haven't been broadcast yet
        // We'll use a simple approach: check for new notifications every few seconds
        const notifications = await db.query(`
            SELECT ni.*,
                   u.nome as destinatario_nome
            FROM notificacoes_internas ni
            LEFT JOIN usuarios_admin u ON ni.destinatario_id = u.id
            WHERE ni.lida = 0
            AND ni.created_at >= datetime('now', '-10 seconds')
            ORDER BY ni.created_at DESC
        `);

        for (const notif of notifications) {
            const baseMessage = {
                tipo: notif.tipo,
                titulo: notif.titulo,
                mensagem: notif.mensagem,
                pedido_id: notif.pedido_id,
                dados: notif.dados ? JSON.parse(notif.dados) : null,
                created_at: notif.created_at
            };

            // Map notification types to frontend event types
            let eventType = 'notification';
            switch (notif.tipo) {
                case 'novo_pedido':
                    eventType = 'pedido_novo';
                    break;
                case 'pedido_atualizado':
                case 'pedido_status':
                    eventType = 'pedido_atualizado';
                    break;
                case 'entrega_atribuida':
                    eventType = 'entrega_atribuida';
                    break;
                case 'entrega_atualizada':
                    eventType = 'entrega_atualizada';
                    break;
                case 'entrega_localizacao':
                    eventType = 'entrega_localizacao';
                    break;
                case 'pedido_entregue':
                    eventType = 'pedido_entregue';
                    break;
                case 'avaliacao_nova':
                    eventType = 'avaliacao_nova';
                    break;
            }

            const message = {
                type: eventType,
                ...baseMessage
            };

            // Send to specific user if destinatario_id
            if (notif.destinatario_id) {
                sendToUser(notif.destinatario_id, message);
            }

            // Send to profile room
            if (notif.destinatario_perfil) {
                sendToProfile(notif.destinatario_perfil, message);
            }

            // Also send to cliente if this is their order
            if (notif.pedido_id && notif.destinatario_perfil === 'cliente') {
                // The cliente will receive it via their own connection if they're subscribed
                // Or we could send to specific cliente room
            }
        }
    } catch (error) {
        console.error('Error polling notifications:', error);
    }
}

// Start polling for notifications (every 5 seconds)
setInterval(pollNotifications, 5000);

// Also poll for delivery location updates
async function pollDeliveryLocations() {
    try {
        // Get active deliveries with recent location updates
        const deliveries = await db.query(`
            SELECT e.*, u.nome as entregador_nome, p.cliente_id
            FROM entregas e
            JOIN usuarios_admin u ON e.entregador_id = u.id
            JOIN pedidos p ON e.pedido_id = p.id
            WHERE e.status IN ('aceita', 'retirada', 'em_rota')
            AND e.latitude IS NOT NULL
            AND e.longitude IS NOT NULL
            AND e.updated_at >= datetime('now', '-10 seconds')
        `);

        for (const delivery of deliveries) {
            const message = {
                type: 'entrega_localizacao',
                pedido_id: delivery.pedido_id,
                entregador_id: delivery.entregador_id,
                entregador_nome: delivery.entregador_nome,
                latitude: delivery.latitude,
                longitude: delivery.longitude,
                timestamp: delivery.updated_at
            };

            // Send to admin profile
            sendToProfile('administrador', message);

            // Send to specific client if they're connected
            if (delivery.cliente_id) {
                sendToUser(delivery.cliente_id, message);
            }
        }
    } catch (error) {
        console.error('Error polling delivery locations:', error);
    }
}

setInterval(pollDeliveryLocations, 5000);

// Start server
server.listen(WS_PORT, () => {
    console.log(`🚀 Real-time server running on port ${WS_PORT}`);
    console.log(`📡 WebSocket: ws://localhost:${WS_PORT}`);
    console.log(`📡 SSE: http://localhost:${WS_PORT}/sse`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Shutting down real-time server...');

    // Close all WebSocket connections
    wss.clients.forEach(ws => {
        ws.close(1001, 'Server shutting down');
    });

    server.close(() => {
        console.log('Real-time server closed');
        process.exit(0);
    });
});

export { server, wss, sendToUser, sendToProfile, broadcast };