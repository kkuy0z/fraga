import express from 'express';
import { z } from 'zod';
import { db, generateId, verifyPassword, hashPassword } from '../db/database.js';
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

// Validation schemas
const updateProfileSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100).optional(),
  telefone: z.string().min(10, 'Telefone inválido').max(15).optional(),
  senhaAtual: z.string().optional(),
  novaSenha: z.string().min(6, 'Nova senha deve ter pelo menos 6 caracteres').max(64).optional(),
  confirmarNovaSenha: z.string().optional()
}).refine(data => {
  if (data.novaSenha && data.senhaAtual) {
    return data.novaSenha === data.confirmarNovaSenha;
  }
  return true;
}, {
  message: 'As novas senhas não conferem',
  path: ['confirmarNovaSenha']
});

const enderecoSchema = z.object({
  cep: z.string().min(8, 'CEP inválido').max(9),
  logradouro: z.string().min(2, 'Logradouro obrigatório').max(200),
  numero: z.string().min(1, 'Número obrigatório').max(20),
  complemento: z.string().max(100).optional(),
  bairro: z.string().min(2, 'Bairro obrigatório').max(100),
  cidade: z.string().min(2, 'Cidade obrigatória').max(100),
  estado: z.string().length(2, 'Estado deve ter 2 letras'),
  referencia: z.string().max(200).optional(),
  principal: z.boolean().optional()
});

// GET /api/clientes/me - Get current client profile
router.get('/me', authCliente, (req, res) => {
  res.json(req.cliente);
});

// PUT /api/clientes/me - Update profile
router.put('/me', authCliente, (req, res) => {
  try {
    const data = updateProfileSchema.parse(req.body);
    const cliente = req.cliente;
    const now = new Date().toISOString();

    // Update name
    if (data.nome) {
      db.prepare('UPDATE clientes SET nome = ?, atualizado_em = ? WHERE id = ?').run(data.nome, now, cliente.id);
    }

    // Update phone
    if (data.telefone) {
      const phoneExists = db.prepare('SELECT 1 FROM clientes WHERE telefone = ? AND id != ?').get(data.telefone, cliente.id);
      if (phoneExists) {
        return res.status(409).json({ error: 'Este WhatsApp já está cadastrado', field: 'telefone' });
      }
      db.prepare('UPDATE clientes SET telefone = ?, atualizado_em = ? WHERE id = ?').run(data.telefone, now, cliente.id);
    }

    // Update password
    if (data.senhaAtual && data.novaSenha) {
      const clienteFull = db.prepare('SELECT senha_hash FROM clientes WHERE id = ?').get(cliente.id);
      const valid = verifyPassword(data.senhaAtual, clienteFull.senha_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Senha atual incorreta', field: 'senhaAtual' });
      }
      const novaHash = hashPassword(data.novaSenha);
      db.prepare('UPDATE clientes SET senha_hash = ?, atualizado_em = ? WHERE id = ?').run(novaHash, now, cliente.id);
    }

    // Return updated client
    const updated = db.prepare('SELECT id, nome, email, telefone FROM clientes WHERE id = ?').get(cliente.id);
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message, field: err.errors[0].path[0] });
    }
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/clientes/me/enderecos - Get client addresses
router.get('/me/enderecos', authCliente, (req, res) => {
  const enderecos = db.prepare('SELECT * FROM enderecos WHERE cliente_id = ? ORDER BY principal DESC, criado_em DESC').all(req.cliente.id);
  res.json(enderecos);
});

// POST /api/clientes/me/enderecos - Add address
router.post('/me/enderecos', authCliente, (req, res) => {
  try {
    const data = enderecoSchema.parse(req.body);
    const id = generateId();
    const now = new Date().toISOString();

    // If this is principal, unset others
    if (data.principal) {
      db.prepare('UPDATE enderecos SET principal = 0 WHERE cliente_id = ?').run(req.cliente.id);
    }

    db.prepare(`
      INSERT INTO enderecos (id, cliente_id, cep, logradouro, numero, complemento, bairro, cidade, estado, referencia, principal, criado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.cliente.id, data.cep, data.logradouro, data.numero, data.complemento || '', data.bairro, data.cidade, data.estado.toUpperCase(), data.referencia || '', data.principal ? 1 : 0, now);

    const endereco = db.prepare('SELECT * FROM enderecos WHERE id = ?').get(id);
    res.status(201).json(endereco);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message, field: err.errors[0].path[0] });
    }
    console.error('Add address error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/clientes/me/enderecos/:id - Update address
router.put('/me/enderecos/:id', authCliente, (req, res) => {
  try {
    const data = enderecoSchema.parse(req.body);
    const endereco = db.prepare('SELECT * FROM enderecos WHERE id = ? AND cliente_id = ?').get(req.params.id, req.cliente.id);

    if (!endereco) {
      return res.status(404).json({ error: 'Endereço não encontrado' });
    }

    // If this is principal, unset others
    if (data.principal) {
      db.prepare('UPDATE enderecos SET principal = 0 WHERE cliente_id = ? AND id != ?').run(req.cliente.id, req.params.id);
    }

    db.prepare(`
      UPDATE enderecos SET cep = ?, logradouro = ?, numero = ?, complemento = ?, bairro = ?, cidade = ?, estado = ?, referencia = ?, principal = ?
      WHERE id = ?
    `).run(data.cep, data.logradouro, data.numero, data.complemento || '', data.bairro, data.cidade, data.estado.toUpperCase(), data.referencia || '', data.principal ? 1 : 0, req.params.id);

    const updated = db.prepare('SELECT * FROM enderecos WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message, field: err.errors[0].path[0] });
    }
    console.error('Update address error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/clientes/me/enderecos/:id - Delete address
router.delete('/me/enderecos/:id', authCliente, (req, res) => {
  const endereco = db.prepare('SELECT * FROM enderecos WHERE id = ? AND cliente_id = ?').get(req.params.id, req.cliente.id);
  if (!endereco) {
    return res.status(404).json({ error: 'Endereço não encontrado' });
  }

  db.prepare('DELETE FROM enderecos WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// GET /api/clientes/me/pedidos - Get client orders
router.get('/me/pedidos', authCliente, (req, res) => {
  const pedidos = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM pedido_itens WHERE pedido_id = p.id) as itens_count
    FROM pedidos p
    WHERE p.cliente_id = ?
    ORDER BY p.criado_em DESC
  `).all(req.cliente.id);

  res.json(pedidos);
});

// GET /api/clientes/me/pedidos/:id - Get order details
router.get('/me/pedidos/:id', authCliente, (req, res) => {
  const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ? AND cliente_id = ?').get(req.params.id, req.cliente.id);
  if (!pedido) {
    return res.status(404).json({ error: 'Pedido não encontrado' });
  }

  const itens = db.prepare('SELECT * FROM pedido_itens WHERE pedido_id = ?').all(req.params.id);
  res.json({ ...pedido, itens });
});

export { router as clientesRouter };