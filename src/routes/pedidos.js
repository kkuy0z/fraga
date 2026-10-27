import express from 'express';
import db from '../database/connection.js';
import { authMiddleware, optionalAuth, clienteAuthMiddleware } from '../middleware/auth.js';
import { pedidoValidators } from '../middleware/validation.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Generate order number
function gerarNumeroPedido() {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `FRG${dateStr}${random}`;
}

// Calculate order totals
async function calcularTotaisPedido(itens, formaPagamentoId, bairro = null) {
    let subtotal = 0;

    for (const item of itens) {
        // Get product with current price
        const produto = await db.queryOne('SELECT preco_base FROM produtos WHERE id = ? AND disponivel = 1', [item.produto_id]);
        if (!produto) {
            throw new Error(`Produto ${item.produto_id} não encontrado ou indisponível`);
        }

        let itemSubtotal = produto.preco_base * item.quantidade;

        // Calculate personalization prices
        if (item.personalizacoes && item.personalizacoes.length > 0) {
            for (const pers of item.personalizacoes) {
                const opcao = await db.queryOne('SELECT preco_adicional FROM personalizacao_opcoes WHERE id = ? AND ativo = 1', [pers.opcao_id]);
                if (opcao) {
                    itemSubtotal += opcao.preco_adicional * item.quantidade;
                }
            }
        }

        subtotal += itemSubtotal;
    }

    // Get delivery fee and extra neighborhood fee
    const configEntrega = await db.queryOne('SELECT taxa_entrega, valor_minimo_pedido, bairro_taxa_extra FROM configuracoes_entrega ORDER BY id DESC LIMIT 1');
    const taxaEntrega = configEntrega?.taxa_entrega || 0;

    // Calculate extra neighborhood fee
    let taxaBairro = 0;
    if (bairro && configEntrega?.bairro_taxa_extra) {
        try {
            const bairrosExtra = JSON.parse(configEntrega.bairro_taxa_extra);
            const bairroNormalizado = bairro.trim().toLowerCase();
            // bairrosExtra is an array of objects: [{bairro: "...", taxa_extra: ...}]
            for (const item of bairrosExtra) {
                if (item.bairro && item.bairro.trim().toLowerCase() === bairroNormalizado) {
                    taxaBairro = parseFloat(item.taxa_extra) || 0;
                    break;
                }
            }
        } catch (e) {
            console.warn('Erro ao parsear bairro_taxa_extra:', e);
        }
    }

    // Check minimum order value
    if (configEntrega && subtotal < configEntrega.valor_minimo_pedido) {
        throw new Error(`Valor mínimo do pedido é R$ ${configEntrega.valor_minimo_pedido.toFixed(2)}`);
    }

    const valorTotal = subtotal + taxaEntrega + taxaBairro;

    return {
        subtotal_produtos: subtotal,
        taxa_entrega: taxaEntrega,
        taxa_bairro: taxaBairro,
        desconto: 0,
        valor_total: valorTotal
    };
}

// Create order (requires client authentication)
router.post('/', clienteAuthMiddleware, pedidoValidators.create, async (req, res) => {
    try {
        const {
            cliente_nome, cliente_telefone, cliente_email,
            cep, logradouro, numero_endereco, bairro, complemento, referencia,
            forma_pagamento_id, valor_troco = 0, observacoes_pagamento,
            itens
        } = req.body;

        // Check if establishment is open
        const now = new Date();
        const diaSemana = now.getDay();
        const horaAtual = now.toTimeString().slice(0, 5);

        const horario = await db.queryOne(`
            SELECT * FROM horarios_funcionamento
            WHERE dia_semana = ? AND ativo = 1
            AND hora_abertura <= ? AND hora_fechamento > ?
        `, [diaSemana, horaAtual, horaAtual]);

        if (!horario) {
            throw new Error('Estabelecimento está fechado no momento');
        }

        // Verify payment method exists and is active
        const formaPagamento = await db.queryOne('SELECT * FROM formas_pagamento WHERE id = ? AND ativo = 1', [forma_pagamento_id]);
        if (!formaPagamento) {
            throw new Error('Forma de pagamento inválida ou inativa');
        }

        // Calculate totals (validates product availability and prices)
        const totais = await calcularTotaisPedido(itens, forma_pagamento_id, bairro);

        // Validate troco for cash payments
        if (formaPagamento.tipo === 'dinheiro' && valor_troco > 0) {
            if (valor_troco < totais.valor_total) {
                throw new Error('Valor para troco deve ser maior ou igual ao total do pedido');
            }
        }

        // Generate order number
        const numeroPedido = gerarNumeroPedido();

        // Use transaction for atomic order creation
        const pedido = await db.transaction(async () => {
            // Create order
            const result = await db.query(`
                INSERT INTO pedidos (
                    numero_pedido, cliente_nome, cliente_telefone, cliente_email,
                    cep, logradouro, numero_endereco, bairro, complemento, referencia,
                    forma_pagamento_id, valor_troco, observacoes_pagamento,
                    subtotal_produtos, taxa_entrega, taxa_bairro, desconto, valor_total, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente')
            `, [
                numeroPedido, cliente_nome, cliente_telefone, cliente_email,
                cep, logradouro, numero_endereco, bairro, complemento, referencia,
                forma_pagamento_id, valor_troco, observacoes_pagamento,
                totais.subtotal_produtos, totais.taxa_entrega, totais.taxa_bairro, totais.desconto, totais.valor_total
            ]);

            const pedidoId = result.lastInsertRowid;

            // Create order items and personalizations
            for (const item of itens) {
                const produto = await db.queryOne('SELECT nome, preco_base FROM produtos WHERE id = ?', [item.produto_id]);

                let itemSubtotal = produto.preco_base * item.quantidade;

                const itemResult = await db.query(`
                    INSERT INTO pedido_itens (pedido_id, produto_id, produto_nome, preco_base, quantidade, subtotal)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [pedidoId, item.produto_id, produto.nome, produto.preco_base, item.quantidade, itemSubtotal]);

                const pedidoItemId = itemResult.lastInsertRowid;

                // Save personalizations
                if (item.personalizacoes && item.personalizacoes.length > 0) {
                    for (const pers of item.personalizacoes) {
                        const grupo = await db.queryOne('SELECT nome FROM personalizacao_grupos WHERE id = ?', [pers.grupo_id]);
                        const opcao = await db.queryOne('SELECT nome, preco_adicional FROM personalizacao_opcoes WHERE id = ?', [pers.opcao_id]);

                        if (grupo && opcao) {
                            await db.query(`
                                INSERT INTO pedido_item_personalizacoes (pedido_item_id, grupo_id, grupo_nome, opcao_id, opcao_nome, preco_adicional)
                                VALUES (?, ?, ?, ?, ?, ?)
                            `, [pedidoItemId, pers.grupo_id, grupo.nome, pers.opcao_id, opcao.nome, opcao.preco_adicional]);

                            itemSubtotal += opcao.preco_adicional * item.quantidade;
                        }
                    }
                }

                // Update item subtotal with personalizations
                await db.query('UPDATE pedido_itens SET subtotal = ? WHERE id = ?', [itemSubtotal, pedidoItemId]);
            }

            // Recalculate total to ensure consistency
            const itensSalvos = await db.queryOne('SELECT SUM(subtotal) as total FROM pedido_itens WHERE pedido_id = ?', [pedidoId]);
            const subtotalReal = itensSalvos.total || 0;
            const valorTotalReal = subtotalReal + totais.taxa_entrega + totais.taxa_bairro;

            await db.query('UPDATE pedidos SET subtotal_produtos = ?, taxa_bairro = ?, valor_total = ? WHERE id = ?', [subtotalReal, totais.taxa_bairro, valorTotalReal, pedidoId]);

            // Get complete order for response
            const pedidoCompleto = await db.queryOne('SELECT * FROM pedidos WHERE id = ?', [pedidoId]);
            const itensCompletos = await db.query(`
                SELECT pi.*,
                    (SELECT json_group_array(json_object(
                        'grupo_id', pip.grupo_id,
                        'grupo_nome', pip.grupo_nome,
                        'opcao_id', pip.opcao_id,
                        'opcao_nome', pip.opcao_nome,
                        'preco_adicional', pip.preco_adicional
                    )) FROM pedido_item_personalizacoes pip WHERE pip.pedido_item_id = pi.id) as personalizacoes
                FROM pedido_itens pi
                WHERE pi.pedido_id = ?
            `, [pedidoId]);

            pedidoCompleto.itens = itensCompletos.map(item => ({
                ...item,
                personalizacoes: item.personalizacoes ? JSON.parse(item.personalizacoes) : []
            }));
            pedidoCompleto.forma_pagamento = formaPagamento;
            pedidoCompleto.troco = formaPagamento.tipo === 'dinheiro' && valor_troco > 0
                ? (valor_troco - valorTotalReal).toFixed(2)
                : 0;

            return pedidoCompleto;
        });

        res.status(201).json(pedido);
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(400).json({ error: error.message });
    }
});

// List client's own orders (client authenticated)
router.get('/minhas', clienteAuthMiddleware, async (req, res) => {
    try {
        const { status, page = 1, limit = 20, data_inicio, data_fim } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE p.cliente_email = ?';
        const params = [req.cliente.email];

        if (status) {
            whereClause += ' AND p.status = ?';
            params.push(status);
        }

        if (data_inicio) {
            whereClause += ' AND date(p.data_pedido) >= date(?)';
            params.push(data_inicio);
        }

        if (data_fim) {
            whereClause += ' AND date(p.data_pedido) <= date(?)';
            params.push(data_fim);
        }

        const countSql = `SELECT COUNT(*) as total FROM pedidos p ${whereClause}`;
        const totalResult = await db.queryOne(countSql, params);
        const total = totalResult.total;

        const sql = `
            SELECT p.*, fp.nome as forma_pagamento_nome, fp.tipo as forma_pagamento_tipo
            FROM pedidos p
            LEFT JOIN formas_pagamento fp ON p.forma_pagamento_id = fp.id
            ${whereClause}
            ORDER BY p.data_pedido DESC
            LIMIT ? OFFSET ?
        `;
        params.push(limit, offset);

        const pedidos = await db.query(sql, params);

        // Get items for each order
        for (const pedido of pedidos) {
            const itens = await db.query(`
                SELECT pi.*,
                    (SELECT json_group_array(json_object(
                        'grupo_id', pip.grupo_id,
                        'grupo_nome', pip.grupo_nome,
                        'opcao_id', pip.opcao_id,
                        'opcao_nome', pip.opcao_nome,
                        'preco_adicional', pip.preco_adicional
                    )) FROM pedido_item_personalizacoes pip WHERE pip.pedido_item_id = pi.id) as personalizacoes
                FROM pedido_itens pi
                WHERE pi.pedido_id = ?
            `, [pedido.id]);

            pedido.itens = itens.map(item => ({
                ...item,
                personalizacoes: item.personalizacoes ? JSON.parse(item.personalizacoes) : []
            }));
        }

        res.json({
            data: pedidos,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error listing client orders:', error);
        res.status(500).json({ error: 'Erro ao listar pedidos' });
    }
});

// List orders (admin only)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { status, page = 1, limit = 20, data_inicio, data_fim } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE 1=1';
        const params = [];

        if (status) {
            whereClause += ' AND status = ?';
            params.push(status);
        }

        if (data_inicio) {
            whereClause += ' AND date(data_pedido) >= date(?)';
            params.push(data_inicio);
        }

        if (data_fim) {
            whereClause += ' AND date(data_pedido) <= date(?)';
            params.push(data_fim);
        }

        const countSql = `SELECT COUNT(*) as total FROM pedidos ${whereClause}`;
        const totalResult = await db.queryOne(countSql, params);
        const total = totalResult.total;

        const sql = `
            SELECT p.*, fp.nome as forma_pagamento_nome, fp.tipo as forma_pagamento_tipo
            FROM pedidos p
            LEFT JOIN formas_pagamento fp ON p.forma_pagamento_id = fp.id
            ${whereClause}
            ORDER BY p.data_pedido DESC
            LIMIT ? OFFSET ?
        `;
        params.push(limit, offset);

        const pedidos = await db.query(sql, params);

        // Get items for each order
        for (const pedido of pedidos) {
            const itens = await db.query(`
                SELECT pi.*,
                    (SELECT json_group_array(json_object(
                        'grupo_id', pip.grupo_id,
                        'grupo_nome', pip.grupo_nome,
                        'opcao_id', pip.opcao_id,
                        'opcao_nome', pip.opcao_nome,
                        'preco_adicional', pip.preco_adicional
                    )) FROM pedido_item_personalizacoes pip WHERE pip.pedido_item_id = pi.id) as personalizacoes
                FROM pedido_itens pi
                WHERE pi.pedido_id = ?
            `, [pedido.id]);

            pedido.itens = itens.map(item => ({
                ...item,
                personalizacoes: item.personalizacoes ? JSON.parse(item.personalizacoes) : []
            }));
        }

        res.json({
            data: pedidos,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error listing orders:', error);
        res.status(500).json({ error: 'Erro ao listar pedidos' });
    }
});

// List orders for admin (admin only) - alias for /
router.get('/admin', authMiddleware, async (req, res) => {
    try {
        const { status, page = 1, limit = 20, data_inicio, data_fim, search } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE 1=1';
        const params = [];

        if (status) {
            whereClause += ' AND status = ?';
            params.push(status);
        }

        if (data_inicio) {
            whereClause += ' AND date(data_pedido) >= date(?)';
            params.push(data_inicio);
        }

        if (data_fim) {
            whereClause += ' AND date(data_pedido) <= date(?)';
            params.push(data_fim);
        }

        if (search) {
            whereClause += ' AND (numero_pedido LIKE ? OR cliente_nome LIKE ? OR cliente_telefone LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        const countSql = `SELECT COUNT(*) as total FROM pedidos ${whereClause}`;
        const totalResult = await db.queryOne(countSql, params);
        const total = totalResult.total;

        const sql = `
            SELECT p.*, fp.nome as forma_pagamento_nome, fp.tipo as forma_pagamento_tipo
            FROM pedidos p
            LEFT JOIN formas_pagamento fp ON p.forma_pagamento_id = fp.id
            ${whereClause}
            ORDER BY p.data_pedido DESC
            LIMIT ? OFFSET ?
        `;
        params.push(limit, offset);

        const pedidos = await db.query(sql, params);

        // Get items for each order
        for (const pedido of pedidos) {
            const itens = await db.query(`
                SELECT pi.*,
                    (SELECT json_group_array(json_object(
                        'grupo_id', pip.grupo_id,
                        'grupo_nome', pip.grupo_nome,
                        'opcao_id', pip.opcao_id,
                        'opcao_nome', pip.opcao_nome,
                        'preco_adicional', pip.preco_adicional
                    )) FROM pedido_item_personalizacoes pip WHERE pip.pedido_item_id = pi.id) as personalizacoes
                FROM pedido_itens pi
                WHERE pi.pedido_id = ?
            `, [pedido.id]);

            pedido.itens = itens.map(item => ({
                ...item,
                personalizacoes: item.personalizacoes ? JSON.parse(item.personalizacoes) : []
            }));
        }

        res.json({
            data: pedidos,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error listing orders for admin:', error);
        res.status(500).json({ error: 'Erro ao listar pedidos' });
    }
});

// Get single order (admin or order owner)
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const pedido = await db.queryOne(`
            SELECT p.*, fp.nome as forma_pagamento_nome, fp.tipo as forma_pagamento_tipo, fp.configuracao as forma_pagamento_config
            FROM pedidos p
            LEFT JOIN formas_pagamento fp ON p.forma_pagamento_id = fp.id
            WHERE p.id = ?
        `, [id]);

        if (!pedido) {
            return res.status(404).json({ error: 'Pedido não encontrado' });
        }

        // Verify access: admin can see all, client can only see their own orders
        if (req.cliente && pedido.cliente_email !== req.cliente.email) {
            return res.status(403).json({ error: 'Acesso negado: você não tem permissão para ver este pedido' });
        }

        // If neither admin nor client, deny access
        if (!req.user && !req.cliente) {
            return res.status(401).json({ error: 'Autenticação necessária' });
        }

        const itens = await db.query(`
            SELECT pi.*,
                (SELECT json_group_array(json_object(
                    'grupo_id', pip.grupo_id,
                    'grupo_nome', pip.grupo_nome,
                    'opcao_id', pip.opcao_id,
                    'opcao_nome', pip.opcao_nome,
                    'preco_adicional', pip.preco_adicional
                )) FROM pedido_item_personalizacoes pip WHERE pip.pedido_item_id = pi.id) as personalizacoes
            FROM pedido_itens pi
            WHERE pi.pedido_id = ?
        `, [id]);

        pedido.itens = itens.map(item => ({
            ...item,
            personalizacoes: item.personalizacoes ? JSON.parse(item.personalizacoes) : []
        }));

        if (pedido.forma_pagamento_config) {
            pedido.forma_pagamento_config = JSON.parse(pedido.forma_pagamento_config);
        }

        res.json(pedido);
    } catch (error) {
        console.error('Error getting order:', error);
        res.status(500).json({ error: 'Erro ao buscar pedido' });
    }
});

// Update order status (admin only)
router.put('/:id/status', authMiddleware, pedidoValidators.updateStatus, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const pedido = await db.queryOne('SELECT * FROM pedidos WHERE id = ?', [id]);
        if (!pedido) {
            return res.status(404).json({ error: 'Pedido não encontrado' });
        }

        // Validate status transitions
        const validTransitions = {
            'pendente': ['confirmado', 'cancelado'],
            'confirmado': ['preparando', 'cancelado'],
            'preparando': ['saiu_entrega', 'cancelado'],
            'saiu_entrega': ['entregue', 'cancelado'],
            'entregue': [],
            'cancelado': []
        };

        if (!validTransitions[pedido.status]?.includes(status)) {
            return res.status(400).json({
                error: `Não é possível alterar status de '${pedido.status}' para '${status}'`
            });
        }

        await db.query('UPDATE pedidos SET status = ?, data_atualizacao = CURRENT_TIMESTAMP WHERE id = ?', [status, id]);

        const updated = await db.queryOne('SELECT * FROM pedidos WHERE id = ?', [id]);
        res.json(updated);
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ error: 'Erro ao atualizar status do pedido' });
    }
});

// Get order by number (public - for tracking)
router.get('/numero/:numero', async (req, res) => {
    try {
        const { numero } = req.params;

        const pedido = await db.queryOne(`
            SELECT p.*, fp.nome as forma_pagamento_nome, fp.tipo as forma_pagamento_tipo
            FROM pedidos p
            LEFT JOIN formas_pagamento fp ON p.forma_pagamento_id = fp.id
            WHERE p.numero_pedido = ?
        `, [numero]);

        if (!pedido) {
            return res.status(404).json({ error: 'Pedido não encontrado' });
        }

        const itens = await db.query(`
            SELECT pi.*,
                (SELECT json_group_array(json_object(
                    'grupo_id', pip.grupo_id,
                    'grupo_nome', pip.grupo_nome,
                    'opcao_id', pip.opcao_id,
                    'opcao_nome', pip.opcao_nome,
                    'preco_adicional', pip.preco_adicional
                )) FROM pedido_item_personalizacoes pip WHERE pip.pedido_item_id = pi.id) as personalizacoes
            FROM pedido_itens pi
            WHERE pi.pedido_id = ?
        `, [pedido.id]);

        pedido.itens = itens.map(item => ({
            ...item,
            personalizacoes: item.personalizacoes ? JSON.parse(item.personalizacoes) : []
        }));

        res.json(pedido);
    } catch (error) {
        console.error('Error getting order by number:', error);
        res.status(500).json({ error: 'Erro ao buscar pedido' });
    }
});

export default router;