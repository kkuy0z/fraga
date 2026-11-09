import express from 'express';
import { z } from 'zod';
import { db, generateId } from '../db/database.js';
import { verifyToken } from './auth.js';

const router = express.Router();

// Middleware: authenticate client
function authCliente(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  const token = authHeader.slice(7);
  const decoded = verifyToken(token);

  if (!decoded || decoded.tipo !== 'cliente') {
    return res.status(401).json({ error: 'Token inválido' });
  }

  const cliente = db.prepare('SELECT id, nome, email, telefone, ativo FROM clientes WHERE id = ? AND ativo = 1').get(decoded.id);
  if (!cliente) {
    return res.status(401).json({ error: 'Cliente não encontrado' });
  }

  req.cliente = cliente;
  next();
}

// Middleware: authenticate admin
function authAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  const token = authHeader.slice(7);
  const decoded = verifyToken(token);

  if (!decoded || decoded.tipo !== 'admin') {
    return res.status(401).json({ error: 'Token inválido' });
  }

  const user = db.prepare('SELECT id, nome, email, role, ativo FROM users WHERE id = ? AND ativo = 1').get(decoded.id);
  if (!user) {
    return res.status(401).json({ error: 'Usuário não encontrado' });
  }

  req.user = user;
  next();
}

// Validation schemas
const pedidoSchema = z.object({
  itens: z.array(z.object({
    produto_id: z.string().uuid(),
    quantidade: z.number().int().positive(),
    observacoes: z.string().max(500).optional(),
    personalizacoes: z.record(z.array(z.string())).optional() // grupo_id -> opcao_ids[]
  })).min(1, 'Pelo menos um item é obrigatório'),
  forma_pagamento: z.string().min(1, 'Forma de pagamento obrigatória'),
  endereco_entrega: z.string().optional(), // JSON string do endereço ou ID
  observacoes: z.string().max(1000).optional()
});

// POST /api/pedidos - Create new order (client)
router.post('/', authCliente, (req, res) => {
  try {
    const data = pedidoSchema.parse(req.body);
    const cliente = req.cliente;

    // Verify products exist and are available
    let subtotal = 0;
    const itensData = [];

    for (const item of data.itens) {
      const produto = db.prepare('SELECT * FROM produtos WHERE id = ? AND disponivel = 1').get(item.produto_id);
      if (!produto) {
        return res.status(400).json({ error: `Produto ${item.produto_id} não encontrado ou indisponível` });
      }

      let precoUnitario = produto.preco_base;

      // Calculate personalizacoes price
      if (item.personalizacoes) {
        for (const [grupoId, opcaoIds] of Object.entries(item.personalizacoes)) {
          const opcoes = db.prepare('SELECT * FROM personalizacao_opcoes WHERE id IN (' + opcaoIds.map(() => '?').join(',') + ')').all(...opcaoIds);
          for (const opcao of opcoes) {
            precoUnitario += opcao.preco_adicional;
          }
        }
      }

      subtotal += precoUnitario * item.quantidade;
      itensData.push({ produto, precoUnitario, item });
    }

    // Get delivery config
    const configEntrega = db.prepare('SELECT * FROM config_entrega WHERE id = ?').get('1');
    const taxaEntrega = configEntrega?.taxa_entrega || 0;
    const valorMinimo = configEntrega?.valor_minimo_pedido || 0;

    // Check minimum order value
    if (subtotal < valorMinimo) {
      return res.status(400).json({ error: `Valor mínimo do pedido é R$ ${valorMinimo.toFixed(2)}` });
    }

    const total = subtotal + taxaEntrega;
    const now = new Date().toISOString();

    // Get next order number
    const lastPedido = db.prepare('SELECT MAX(numero) as max FROM pedidos').get();
    const numero = (lastPedido.max || 0) + 1;

    const pedidoId = generateId();

    // Create pedido
    db.prepare(`
      INSERT INTO pedidos (id, numero, cliente_id, status, subtotal, taxa_entrega, desconto, total, forma_pagamento, endereco_entrega, observacoes, criado_em, atualizado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(pedidoId, numero, cliente.id, 'pendente', subtotal, taxaEntrega, 0, total, data.forma_pagamento, data.endereco_entrega || '', data.observacoes || '', now, now);

    // Create pedido itens
    for (const { produto, precoUnitario, item } of itensData) {
      const itemId = generateId();
      const personalizacoesJson = item.personalizacoes ? JSON.stringify(item.personalizacoes) : null;

      db.prepare(`
        INSERT INTO pedido_itens (id, pedido_id, produto_id, nome_produto, preco_unitario, quantidade, observacoes, personalizacoes, criado_em)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(itemId, pedidoId, produto.id, produto.nome, precoUnitario, item.quantidade, item.observacoes || '', personalizacoesJson, now);
    }

    // Return created order
    const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(pedidoId);
    const itens = db.prepare('SELECT * FROM pedido_itens WHERE pedido_id = ?').all(pedidoId);

    res.status(201).json({ ...pedido, itens });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message, field: err.errors[0].path[0] });
    }
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/pedidos/me - Get my orders (client)
router.get('/me', authCliente, (req, res) => {
  const pedidos = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM pedido_itens WHERE pedido_id = p.id) as itens_count
    FROM pedidos p
    WHERE p.cliente_id = ?
    ORDER BY p.criado_em DESC
  `).all(req.cliente.id);

  res.json(pedidos);
});

// GET /api/pedidos/me/:id - Get order details (client)
router.get('/me/:id', authCliente, (req, res) => {
  const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ? AND cliente_id = ?').get(req.params.id, req.cliente.id);
  if (!pedido) {
    return res.status(404).json({ error: 'Pedido não encontrado' });
  }

  const itens = db.prepare('SELECT * FROM pedido_itens WHERE pedido_id = ?').all(req.params.id);
  res.json({ ...pedido, itens });
});

// ===== ADMIN ROUTES =====

// GET /api/admin/pedidos - List all orders (admin)
router.get('/admin', authAdmin, (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let sql = `
    SELECT p.*, c.nome as cliente_nome, c.telefone as cliente_telefone,
      (SELECT COUNT(*) FROM pedido_itens WHERE pedido_id = p.id) as itens_count
    FROM pedidos p
    JOIN clientes c ON p.cliente_id = c.id
  `;
  const params = [];

  if (status) {
    sql += ' WHERE p.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY p.criado_em DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), offset);

  const pedidos = db.prepare(sql).all(...params);

  // Get total count
  let countSql = 'SELECT COUNT(*) as total FROM pedidos';
  const countParams = [];
  if (status) {
    countSql += ' WHERE status = ?';
    countParams.push(status);
  }
  const total = db.prepare(countSql).get(...countParams).total;

  res.json({ pedidos, total, page: Number(page), limit: Number(limit) });
});

// GET /api/admin/pedidos/:id - Get order details (admin)
router.get('/admin/:id', authAdmin, (req, res) => {
  const pedido = db.prepare(`
    SELECT p.*, c.nome as cliente_nome, c.email as cliente_email, c.telefone as cliente_telefone
    FROM pedidos p
    JOIN clientes c ON p.cliente_id = c.id
    WHERE p.id = ?
  `).get(req.params.id);

  if (!pedido) {
    return res.status(404).json({ error: 'Pedido não encontrado' });
  }

  const itens = db.prepare('SELECT * FROM pedido_itens WHERE pedido_id = ?').all(req.params.id);
  res.json({ ...pedido, itens });
});

// PUT /api/admin/pedidos/:id/status - Update order status (admin)
router.put('/admin/:id/status', authAdmin, (req, res) => {
  try {
    const schema = z.object({
      status: z.enum(['pendente', 'confirmado', 'preparando', 'pronto', 'saiu_entrega', 'entregue', 'cancelado'])
    });
    const { status } = schema.parse(req.body);

    const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(req.params.id);
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE pedidos SET status = ?, atualizado_em = ? WHERE id = ?').run(status, now, req.params.id);

    const updated = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message, field: err.errors[0].path[0] });
    }
    console.error('Update order status error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/admin/pedidos/stats/dashboard - Get dashboard stats (admin)
router.get('/admin/stats/dashboard', authAdmin, (req, res) => {
  const hoje = new Date().toISOString().split('T')[0];

  const stats = {
    pedidosHoje: db.prepare('SELECT COUNT(*) as c FROM pedidos WHERE date(criado_em) = ?').get(hoje).c,
    pedidosPendentes: db.prepare('SELECT COUNT(*) as c FROM pedidos WHERE status IN (?, ?)').get('pendente', 'confirmado').c,
    pedidosPreparando: db.prepare('SELECT COUNT(*) as c FROM pedidos WHERE status = ?').get('preparando').c,
    pedidosEntregues: db.prepare('SELECT COUNT(*) as c FROM pedidos WHERE status = ?').get('entregue').c,
    faturamentoHoje: db.prepare('SELECT COALESCE(SUM(total), 0) as total FROM pedidos WHERE date(criado_em) = ? AND status != ?').get(hoje, 'cancelado').total,
    faturamentoMes: db.prepare('SELECT COALESCE(SUM(total), 0) as total FROM pedidos WHERE strftime("%Y-%m", criado_em) = strftime("%Y-%m", "now") AND status != ?').get('cancelado').total,
    ticketMedio: db.prepare('SELECT COALESCE(AVG(total), 0) as media FROM pedidos WHERE status = ?').get('entregue').media
  };

  res.json(stats);
});

export { router as pedidosRouter };