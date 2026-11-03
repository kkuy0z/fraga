import express from 'express';
import db from '../database/connection.js';
import { authMiddleware, clienteAuthMiddleware } from '../middleware/auth.js';
import webpush from 'web-push';

const router = express.Router();

// Configure web-push with VAPID keys
// These should be set in .env file
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@fragalanches.com';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// Helper to ensure push_subscriptions table exists
async function ensurePushSubscriptionsTable() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS push_subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_id INTEGER NOT NULL,
            endpoint TEXT NOT NULL UNIQUE,
            p256dh TEXT NOT NULL,
            auth TEXT NOT NULL,
            user_agent TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
        )
    `);

    // Index for faster lookups
    await db.query(`
        CREATE INDEX IF NOT EXISTS idx_push_subscriptions_cliente ON push_subscriptions(cliente_id)
    `);
}

// Get VAPID public key (public endpoint)
router.get('/vapid-public-key', (req, res) => {
    if (!VAPID_PUBLIC_KEY) {
        return res.status(503).json({ error: 'Push notifications not configured' });
    }
    res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// Subscribe to push notifications (requires client auth)
router.post('/subscribe', clienteAuthMiddleware, async (req, res) => {
    try {
        await ensurePushSubscriptionsTable();

        const { endpoint, keys } = req.body;

        if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
            return res.status(400).json({ error: 'Invalid subscription data' });
        }

        const clienteId = req.cliente.id;
        const userAgent = req.headers['user-agent'] || '';

        // Upsert subscription
        await db.query(`
            INSERT INTO push_subscriptions (cliente_id, endpoint, p256dh, auth, user_agent, updated_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(endpoint) DO UPDATE SET
                cliente_id = excluded.cliente_id,
                p256dh = excluded.p256dh,
                auth = excluded.auth,
                user_agent = excluded.user_agent,
                updated_at = CURRENT_TIMESTAMP
        `, [clienteId, endpoint, keys.p256dh, keys.auth, userAgent]);

        res.json({ success: true, message: 'Subscription saved' });
    } catch (error) {
        console.error('Error saving push subscription:', error);
        res.status(500).json({ error: 'Failed to save subscription' });
    }
});

// Unsubscribe from push notifications (requires client auth)
router.delete('/subscribe', clienteAuthMiddleware, async (req, res) => {
    try {
        await ensurePushSubscriptionsTable();

        const { endpoint } = req.body;

        if (!endpoint) {
            return res.status(400).json({ error: 'Endpoint required' });
        }

        const clienteId = req.cliente.id;

        await db.query(`
            DELETE FROM push_subscriptions
            WHERE endpoint = ? AND cliente_id = ?
        `, [endpoint, clienteId]);

        res.json({ success: true, message: 'Subscription removed' });
    } catch (error) {
        console.error('Error removing push subscription:', error);
        res.status(500).json({ error: 'Failed to remove subscription' });
    }
});

// Get user's subscriptions (requires client auth)
router.get('/subscriptions', clienteAuthMiddleware, async (req, res) => {
    try {
        await ensurePushSubscriptionsTable();

        const clienteId = req.cliente.id;

        const subscriptions = await db.query(`
            SELECT endpoint, p256dh, auth, user_agent, created_at
            FROM push_subscriptions
            WHERE cliente_id = ?
        `, [clienteId]);

        res.json({ subscriptions });
    } catch (error) {
        console.error('Error fetching push subscriptions:', error);
        res.status(500).json({ error: 'Failed to fetch subscriptions' });
    }
});

// Send push notification (admin only)
router.post('/send', authMiddleware, async (req, res) => {
    try {
        if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
            return res.status(503).json({ error: 'Push notifications not configured' });
        }

        await ensurePushSubscriptionsTable();

        const {
            clienteId,
            title,
            body,
            data,
            icon = '/img/icon-192.svg',
            badge = '/img/icon-72.svg',
            actions = [
                { action: 'view', title: 'Ver Pedido' },
                { action: 'dismiss', title: 'Dispensar' }
            ],
            requireInteraction = true
        } = req.body;

        if (!title || !body) {
            return res.status(400).json({ error: 'Title and body are required' });
        }

        let whereClause = 'WHERE 1=1';
        const params = [];

        if (clienteId) {
            whereClause += ' AND cliente_id = ?';
            params.push(clienteId);
        }

        const subscriptions = await db.query(`
            SELECT endpoint, p256dh, auth FROM push_subscriptions ${whereClause}
        `, params);

        if (subscriptions.length === 0) {
            return res.json({ sent: 0, failed: 0, message: 'No subscriptions found' });
        }

        const notificationPayload = JSON.stringify({
            title,
            body,
            data: data || {},
            icon,
            badge,
            vibrate: [200, 100, 200],
            actions,
            requireInteraction
        });

        let sent = 0;
        let failed = 0;

        for (const sub of subscriptions) {
            try {
                await webpush.sendNotification(
                    {
                        endpoint: sub.endpoint,
                        keys: {
                            p256dh: sub.p256dh,
                            auth: sub.auth
                        }
                    },
                    notificationPayload
                );
                sent++;
            } catch (error) {
                console.error('Failed to send push notification:', error);
                // Remove invalid subscriptions (410 Gone)
                if (error.statusCode === 410) {
                    await db.query('DELETE FROM push_subscriptions WHERE endpoint = ?', [sub.endpoint]);
                }
                failed++;
            }
        }

        res.json({ sent, failed, total: subscriptions.length });
    } catch (error) {
        console.error('Error sending push notifications:', error);
        res.status(500).json({ error: 'Failed to send notifications' });
    }
});

// Send order status notification (admin only)
router.post('/send-order-update', authMiddleware, async (req, res) => {
    try {
        if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
            return res.status(503).json({ error: 'Push notifications not configured' });
        }

        await ensurePushSubscriptionsTable();

        const { pedidoId, status, clienteEmail } = req.body;

        if (!pedidoId || !status || !clienteEmail) {
            return res.status(400).json({ error: 'pedidoId, status, and clienteEmail are required' });
        }

        // Find subscription by client email
        const cliente = await db.queryOne('SELECT id FROM clientes WHERE email = ?', [clienteEmail]);
        if (!cliente) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const subscriptions = await db.query(`
            SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE cliente_id = ?
        `, [cliente.id]);

        if (subscriptions.length === 0) {
            return res.json({ sent: 0, failed: 0, message: 'No subscriptions for this client' });
        }

        const statusLabels = {
            'pendente': 'Pendente',
            'confirmado': 'Confirmado',
            'preparando': 'Em Preparo',
            'saiu_entrega': 'Saiu para Entrega',
            'entregue': 'Entregue',
            'cancelado': 'Cancelado'
        };

        const title = 'Atualização do seu pedido';
        const body = `Pedido #${pedidoId}: ${statusLabels[status] || status}`;

        const notificationPayload = JSON.stringify({
            title,
            body,
            data: {
                tipo: 'status_pedido',
                pedidoId,
                status,
                url: '/inicio/meus-pedidos.html'
            },
            icon: '/img/icon-192.svg',
            badge: '/img/icon-72.svg',
            vibrate: [200, 100, 200],
            actions: [
                { action: 'view', title: 'Ver Pedido' },
                { action: 'dismiss', title: 'Dispensar' }
            ],
            requireInteraction: true
        });

        let sent = 0;
        let failed = 0;

        for (const sub of subscriptions) {
            try {
                await webpush.sendNotification(
                    {
                        endpoint: sub.endpoint,
                        keys: {
                            p256dh: sub.p256dh,
                            auth: sub.auth
                        }
                    },
                    notificationPayload
                );
                sent++;
            } catch (error) {
                console.error('Failed to send push notification:', error);
                if (error.statusCode === 410) {
                    await db.query('DELETE FROM push_subscriptions WHERE endpoint = ?', [sub.endpoint]);
                }
                failed++;
            }
        }

        res.json({ sent, failed, total: subscriptions.length });
    } catch (error) {
        console.error('Error sending order update notification:', error);
        res.status(500).json({ error: 'Failed to send notification' });
    }
});

export default router;