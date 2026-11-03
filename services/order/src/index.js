import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config, validateConfig } from '../shared/config/index.js';
import { generalLimiter, sensitiveApiLimiter, createLimiter } from '../shared/middleware/rateLimiter.js';
import { authenticateToken, optionalAuth, requireRole } from '../shared/middleware/auth.js';
import { commonValidators, pedidoValidators, clienteValidators } from '../shared/middleware/validation.js';
import { query, queryOne, run, transaction } from '../shared/database/connection.js';
import { generateOrderNumber, formatCurrency } from '../shared/utils/index.js';
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
    res.json({ status: 'ok', service: 'order', timestamp: new Date().toISOString() });
});

// ============================================
// PEDIDOS - CLIENTE
// ============================================

// Criar pedido (cliente autenticado ou não)
app.post('/api/pedidos', optionalAuth, createLimiter, pedidoValidators.create, async (req, res) => {
    try {
        const {
            cliente_id, cliente_nome, cliente_telefone, cliente_email,
            cep, logradouro, numero_endereco, bairro, complemento, referencia,
            forma_pagamento_id, valor_subtotal, valor_entrega, valor_desconto, valor_total,
            valor_troco, observacoes_pagamento, itens
        } = req.body;

        // Se cliente logado, usar seus dados
        let finalClienteId = cliente_id;
        let finalClienteNome = cliente_nome;
        let finalClienteTelefone = cliente_telefone;
        let finalClienteEmail = cliente_email;

        if (req.user && req.user.tipo === 'cliente') {
            const client = await queryOne('SELECT * FROM clientes WHERE id = ?', [req.user.id]);
            if (client) {
                finalClienteId = client.id;
                finalClienteNome = client.nome;
                finalClienteTelefone = client.telefone;
                finalClienteEmail = client.email;
            }
        }

        const numero_pedido = generateOrderNumber();

        const pedidoId = await transaction(() => {
            // Inserir pedido
            const pedidoResult = run(
                `INSERT INTO pedidos (
                    numero_pedido, cliente_id, cliente_nome, cliente_telefone, cliente_email,
                    cep, logradouro, numero_endereco, bairro, complemento, referencia,
                    forma_pagamento_id, valor_subtotal, valor_entrega, valor_desconto, valor_total,
                    valor_troco, observacoes_pagamento, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente')`,
                [
                    numero_pedido, finalClienteId, finalClienteNome, finalClienteTelefone, finalClienteEmail,
                    cep || null, logradouro || null, numero_endereco || null, bairro || null,
                    complemento || null, referencia || null,
                    forma_pagamento_id, valor_subtotal, valor_entrega || 0, valor_desconto || 0, valor_total,
                    valor_troco || null, observacoes_pagamento || null
                ]
            );

            // Inserir itens
            for (const item of itens) {
                const itemResult = run(
                    'INSERT INTO pedido_itens (pedido_id, produto_id, quantidade, preco_unitario, observacoes) VALUES (?, ?, ?, ?, ?)',
                    [pedidoResult.lastInsertRowid, item.produto_id, item.quantidade, item.preco_unitario, item.observacoes || null]
                );

                // Inserir personalizações do item
                if (item.personalizacoes && item.personalizacoes.length > 0) {
                    for (const pers of item.personalizacoes) {
                        run(
                            'INSERT INTO pedido_item_personalizacoes (pedido_item_id, grupo_id, opcao_id) VALUES (?, ?, ?)',
                            [itemResult.lastInsertRowid, pers.grupo_id, pers.opcao_id]
                        );
                    }
                }
            }

            // Registrar histórico de status
            run(
                'INSERT INTO pedido_status_historico (pedido_id, status_anterior, status_novo, usuario_nome, motivo) VALUES (?, ?, ?, ?, ?)',
                [pedidoResult.lastInsertRowid, '', 'pendente', 'Sistema', 'Pedido criado']
            );

            return pedidoResult.lastInsertRowid;
        });

        // Buscar pedido completo para retorno
        const pedido = await queryOne('SELECT * FROM pedidos WHERE id = ?', [pedidoId]);
        const itensPedido = await query(`
            SELECT pi.*, p.nome as produto_nome, p.imagem_url
            FROM pedido_itens pi
            JOIN produtos p ON pi.produto_id = p.id
            WHERE pi.pedido_id = ?
        `, [pedidoId]);

        for (const item of itensPedido) {
            item.personalizacoes = await query(`
                SELECT pip.*, pg.nome as grupo_nome, po.nome as opcao_nome, po.preco_adicional
                FROM pedido_item_personalizacoes pip
                JOIN personalizacao_grupos pg ON pip.grupo_id = pg.id
                JOIN personalizacao_opcoes po ON pip.opcao_id = po.id
                WHERE pip.pedido_item_id = ?
            `, [item.id]);
        }

        pedido.itens = itensPedido;

        // Emitir notificação tempo real para cozinha/atendimento
        emitNotification({
            tipo: 'novo_pedido',
            titulo: 'Novo Pedido Recebido',
            mensagem: `Pedido ${numero_pedido} - ${finalClienteNome}`,
            pedido_id: pedidoId,
            destinatario_perfil: 'todos',
            dados: JSON.stringify({ numero_pedido, cliente_nome: finalClienteNome, valor_total })
        });

        res.status(201).json(pedido);
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ error: 'Erro ao criar pedido' });
    }
});

// Listar pedidos do cliente logado
app.get('/api/pedidos/meus', authenticateToken, requireRole('cliente'), commonValidators.pagination, async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        let sql = 'SELECT * FROM pedidos WHERE cliente_id = ?';
        const params = [req.user.id];

        if (status) { sql += ' AND status = ?'; params.push(status); }

        sql += ' ORDER BY data_pedido DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

        const pedidos = await query(sql, params);

        for (const pedido of pedidos) {
            pedido.itens = await query(`
                SELECT pi.*, p.nome as produto_nome
                FROM pedido_itens pi
                JOIN produtos p ON pi.produto_id = p.id
                WHERE pi.pedido_id = ?
            `, [pedido.id]);
        }

        const total = await queryOne(
            'SELECT COUNT(*) as total FROM pedidos WHERE cliente_id = ?' + (status ? ' AND status = ?' : ''),
            params.slice(0, -2)
        );

        res.json({
            data: pedidos,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total.total,
                totalPages: Math.ceil(total.total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('List my orders error:', error);
        res.status(500).json({ error: 'Erro ao buscar pedidos' });
    }
});

// Obter pedido por ID (cliente dono ou admin)
app.get('/api/pedidos/:id', authenticateToken, commonValidators.idParam, async (req, res) => {
    try {
        const pedido = await queryOne('SELECT * FROM pedidos WHERE id = ?', [req.params.id]);
        if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado' });

        // Verificar permissão
        if (req.user.tipo === 'cliente' && pedido.cliente_id !== req.user.id) {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        pedido.itens = await query(`
            SELECT pi.*, p.nome as produto_nome, p.imagem_url
            FROM pedido_itens pi
            JOIN produtos p ON pi.produto_id = p.id
            WHERE pi.pedido_id = ?
        `, [pedido.id]);

        for (const item of pedido.itens) {
            item.personalizacoes = await query(`
                SELECT pip.*, pg.nome as grupo_nome, po.nome as opcao_nome, po.preco_adicional
                FROM pedido_item_personalizacoes pip
                JOIN personalizacao_grupos pg ON pip.grupo_id = pg.id
                JOIN personalizacao_opcoes po ON pip.opcao_id = po.id
                WHERE pip.pedido_item_id = ?
            `, [item.id]);
        }

        // Histórico de status
        pedido.historico = await query(
            'SELECT * FROM pedido_status_historico WHERE pedido_id = ? ORDER BY created_at',
            [pedido.id]
        );

        res.json(pedido);
    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({ error: 'Erro ao buscar pedido' });
    }
});

// ============================================
// PEDIDOS - ADMIN/ATENDENTE/COZINHA
// ============================================

// Listar todos os pedidos (admin/atendente/cozinha)
app.get('/api/admin/pedidos', authenticateToken, requireRole('administrador', 'atendente', 'cozinha'), async (req, res) => {
    try {
        const { page = 1, limit = 20, status, data_inicio, data_fim, cliente_nome } = req.query;
        let sql = 'SELECT p.*, c.nome as cliente_nome_cadastrado FROM pedidos p LEFT JOIN clientes c ON p.cliente_id = c.id WHERE 1=1';
        const params = [];

        if (status) { sql += ' AND p.status = ?'; params.push(status); }
        if (data_inicio) { sql += ' AND date(p.data_pedido) >= date(?)'; params.push(data_inicio); }
        if (data_fim) { sql += ' AND date(p.data_pedido) <= date(?)'; params.push(data_fim); }
        if (cliente_nome) { sql += ' AND (p.cliente_nome LIKE ? OR c.nome LIKE ?)'; params.push(`%${cliente_nome}%`, `%${cliente_nome}%`); }

        sql += ' ORDER BY p.data_pedido DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

        const pedidos = await query(sql, params);

        const total = await queryOne(
            'SELECT COUNT(*) as total FROM pedidos p LEFT JOIN clientes c ON p.cliente_id = c.id WHERE 1=1' +
            (status ? ' AND p.status = ?' : '') +
            (data_inicio ? ' AND date(p.data_pedido) >= date(?)' : '') +
            (data_fim ? ' AND date(p.data_pedido) <= date(?)' : '') +
            (cliente_nome ? ' AND (p.cliente_nome LIKE ? OR c.nome LIKE ?)' : ''),
            params.slice(0, -2)
        );

        res.json({
            data: pedidos,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total.total,
                totalPages: Math.ceil(total.total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Admin list orders error:', error);
        res.status(500).json({ error: 'Erro ao buscar pedidos' });
    }
});

// Atualizar status do pedido
app.put('/api/admin/pedidos/:id/status', authenticateToken, requireRole('administrador', 'atendente', 'cozinha'), commonValidators.idParam, pedidoValidators.updateStatus, async (req, res) => {
    try {
        const { status, motivo } = req.body;
        const pedido = await queryOne('SELECT * FROM pedidos WHERE id = ?', [req.params.id]);
        if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado' });

        const statusAnterior = pedido.status;

        await transaction(() => {
            run('UPDATE pedidos SET status = ?, data_atualizacao = CURRENT_TIMESTAMP WHERE id = ?', [status, req.params.id]);
            run(
                'INSERT INTO pedido_status_historico (pedido_id, status_anterior, status_novo, usuario_id, usuario_nome, motivo) VALUES (?, ?, ?, ?, ?, ?)',
                [req.params.id, statusAnterior, status, req.user.id, req.user.nome, motivo || null]
            );
        });

        // Emitir notificação tempo real
        emitNotification({
            tipo: 'pedido_atualizado',
            titulo: 'Status do Pedido Atualizado',
            mensagem: `Pedido ${pedido.numero_pedido}: ${statusAnterior} → ${status}`,
            pedido_id: req.params.id,
            destinatario_perfil: 'todos',
            dados: JSON.stringify({ numero_pedido: pedido.numero_pedido, status_anterior: statusAnterior, status_novo: status })
        });

        // Se mudou para "saiu_entrega", criar entrega automaticamente
        if (status === 'saiu_entrega' && statusAnterior !== 'saiu_entrega') {
            const existingDelivery = await queryOne('SELECT 1 FROM entregas WHERE pedido_id = ?', [req.params.id]);
            if (!existingDelivery) {
                await run(
                    'INSERT INTO entregas (pedido_id, status) VALUES (?, "pendente")',
                    [req.params.id]
                );

                emitNotification({
                    tipo: 'entrega_atribuida',
                    titulo: 'Nova Entrega Disponível',
                    mensagem: `Pedido ${pedido.numero_pedido} pronto para entrega`,
                    pedido_id: req.params.id,
                    destinatario_perfil: 'entregador',
                    dados: JSON.stringify({ numero_pedido: pedido.numero_pedido })
                });
            }
        }

        const updated = await queryOne('SELECT * FROM pedidos WHERE id = ?', [req.params.id]);
        res.json(updated);
    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({ error: 'Erro ao atualizar status' });
    }
});

// Cancelar pedido
app.put('/api/admin/pedidos/:id/cancelar', authenticateToken, requireRole('administrador', 'atendente'), commonValidators.idParam, async (req, res) => {
    try {
        const { motivo } = req.body;
        const pedido = await queryOne('SELECT * FROM pedidos WHERE id = ?', [req.params.id]);
        if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado' });

        if (['entregue', 'cancelado'].includes(pedido.status)) {
            return res.status(400).json({ error: 'Não é possível cancelar pedido neste status' });
        }

        await transaction(() => {
            run('UPDATE pedidos SET status = "cancelado", data_atualizacao = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
            run(
                'INSERT INTO pedido_status_historico (pedido_id, status_anterior, status_novo, usuario_id, usuario_nome, motivo) VALUES (?, ?, ?, ?, ?, ?)',
                [req.params.id, pedido.status, 'cancelado', req.user.id, req.user.nome, motivo || 'Cancelado pela administração']
            );
        });

        emitNotification({
            tipo: 'pedido_cancelado',
            titulo: 'Pedido Cancelado',
            mensagem: `Pedido ${pedido.numero_pedido} foi cancelado`,
            pedido_id: req.params.id,
            destinatario_perfil: 'todos',
            dados: JSON.stringify({ numero_pedido: pedido.numero_pedido, motivo })
        });

        res.json({ message: 'Pedido cancelado com sucesso' });
    } catch (error) {
        console.error('Cancel order error:', error);
        res.status(500).json({ error: 'Erro ao cancelar pedido' });
    }
});

// ============================================
// ENDEREÇOS DO CLIENTE
// ============================================

app.get('/api/cliente/enderecos', authenticateToken, requireRole('cliente'), async (req, res) => {
    try {
        const enderecos = await query('SELECT * FROM enderecos_cliente WHERE cliente_id = ? ORDER BY principal DESC', [req.user.id]);
        res.json(enderecos);
    } catch (error) {
        console.error('List addresses error:', error);
        res.status(500).json({ error: 'Erro ao buscar endereços' });
    }
});

app.post('/api/cliente/enderecos', authenticateToken, requireRole('cliente'), createLimiter, clienteValidators.endereco, async (req, res) => {
    try {
        const { cep, logradouro, numero, bairro, complemento, principal } = req.body;

        // Se for principal, remover principal dos outros
        if (principal) {
            await run('UPDATE enderecos_cliente SET principal = 0 WHERE cliente_id = ?', [req.user.id]);
        }

        const result = await run(
            'INSERT INTO enderecos_cliente (cliente_id, cep, logradouro, numero, bairro, complemento, principal) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [req.user.id, cep, logradouro, numero, bairro, complemento || null, principal ? 1 : 0]
        );

        const endereco = await queryOne('SELECT * FROM enderecos_cliente WHERE id = ?', [result.lastInsertRowid]);
        res.status(201).json(endereco);
    } catch (error) {
        console.error('Create address error:', error);
        res.status(500).json({ error: 'Erro ao criar endereço' });
    }
});

app.put('/api/cliente/enderecos/:id', authenticateToken, requireRole('cliente'), commonValidators.idParam, clienteValidators.endereco, async (req, res) => {
    try {
        const { cep, logradouro, numero, bairro, complemento, principal } = req.body;

        const endereco = await queryOne('SELECT * FROM enderecos_cliente WHERE id = ? AND cliente_id = ?', [req.params.id, req.user.id]);
        if (!endereco) return res.status(404).json({ error: 'Endereço não encontrado' });

        if (principal) {
            await run('UPDATE enderecos_cliente SET principal = 0 WHERE cliente_id = ?', [req.user.id]);
        }

        await run(
            'UPDATE enderecos_cliente SET cep = ?, logradouro = ?, numero = ?, bairro = ?, complemento = ?, principal = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [cep, logradouro, numero, bairro, complemento || null, principal ? 1 : 0, req.params.id]
        );

        const updated = await queryOne('SELECT * FROM enderecos_cliente WHERE id = ?', [req.params.id]);
        res.json(updated);
    } catch (error) {
        console.error('Update address error:', error);
        res.status(500).json({ error: 'Erro ao atualizar endereço' });
    }
});

app.delete('/api/cliente/enderecos/:id', authenticateToken, requireRole('cliente'), commonValidators.idParam, async (req, res) => {
    try {
        await run('DELETE FROM enderecos_cliente WHERE id = ? AND cliente_id = ?', [req.params.id, req.user.id]);
        res.json({ message: 'Endereço excluído com sucesso' });
    } catch (error) {
        console.error('Delete address error:', error);
        res.status(500).json({ error: 'Erro ao excluir endereço' });
    }
});

const PORT = config.server.port + 2; // 3002
app.listen(PORT, () => {
    console.log(`📦 Order Service rodando na porta ${PORT}`);
});

export default app;