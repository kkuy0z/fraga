import express from 'express';
import { z } from 'zod';
import { db, generateId } from '../db/database.js';
import { verifyToken } from './auth.js';

const router = express.Router();

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

// Public: GET /api/categorias - List all active categories
router.get('/categorias', (req, res) => {
  const categorias = db.prepare('SELECT * FROM categorias WHERE ativo = 1 ORDER BY ordem, nome').all();
  res.json(categorias);
});

// Public: GET /api/categorias/:id - Get category with products
router.get('/categorias/:id', (req, res) => {
  const categoria = db.prepare('SELECT * FROM categorias WHERE id = ? AND ativo = 1').get(req.params.id);
  if (!categoria) {
    return res.status(404).json({ error: 'Categoria não encontrada' });
  }

  const produtos = db.prepare('SELECT * FROM produtos WHERE categoria_id = ? AND disponivel = 1 ORDER BY destaque DESC, ordem, nome').all(req.params.id);

  // Get personalizacoes for each produto
  for (const p of produtos) {
    const grupos = db.prepare('SELECT * FROM personalizacao_grupos WHERE produto_id = ? ORDER BY ordem').all(p.id);
    for (const g of grupos) {
      g.opcoes = db.prepare('SELECT * FROM personalizacao_opcoes WHERE grupo_id = ? AND ativo = 1 ORDER BY ordem').all(g.id);
    }
    p.personalizacoes = grupos;
  }

  res.json({ ...categoria, produtos });
});

// Public: GET /api/produtos - List products (with optional filters)
router.get('/produtos', (req, res) => {
  const { categoria, destaque, busca } = req.query;

  let sql = 'SELECT p.*, c.nome as categoria_nome FROM produtos p JOIN categorias c ON p.categoria_id = c.id WHERE p.disponivel = 1 AND c.ativo = 1';
  const params = [];

  if (categoria) {
    sql += ' AND p.categoria_id = ?';
    params.push(categoria);
  }
  if (destaque === 'true') {
    sql += ' AND p.destaque = 1';
  }
  if (busca) {
    sql += ' AND (p.nome LIKE ? OR p.descricao LIKE ?)';
    params.push(`%${busca}%`, `%${busca}%`);
  }

  sql += ' ORDER BY p.destaque DESC, p.ordem, p.nome';

  const produtos = db.prepare(sql).all(...params);

  // Get personalizacoes for each
  for (const p of produtos) {
    const grupos = db.prepare('SELECT * FROM personalizacao_grupos WHERE produto_id = ? ORDER BY ordem').all(p.id);
    for (const g of grupos) {
      g.opcoes = db.prepare('SELECT * FROM personalizacao_opcoes WHERE grupo_id = ? AND ativo = 1 ORDER BY ordem').all(g.id);
    }
    p.personalizacoes = grupos;
  }

  res.json(produtos);
});

// Public: GET /api/produtos/:id - Get product details
router.get('/produtos/:id', (req, res) => {
  const produto = db.prepare(`
    SELECT p.*, c.nome as categoria_nome
    FROM produtos p
    JOIN categorias c ON p.categoria_id = c.id
    WHERE p.id = ? AND p.disponivel = 1 AND c.ativo = 1
  `).get(req.params.id);

  if (!produto) {
    return res.status(404).json({ error: 'Produto não encontrado' });
  }

  const grupos = db.prepare('SELECT * FROM personalizacao_grupos WHERE produto_id = ? ORDER BY ordem').all(produto.id);
  for (const g of grupos) {
    g.opcoes = db.prepare('SELECT * FROM personalizacao_opcoes WHERE grupo_id = ? AND ativo = 1 ORDER BY ordem').all(g.id);
  }
  produto.personalizacoes = grupos;

  res.json(produto);
});

// ===== ADMIN ROUTES FOR CATEGORIAS =====

// Admin: GET /api/admin/categorias - List all categories (including inactive)
router.get('/admin/categorias', authAdmin, (req, res) => {
  const categorias = db.prepare('SELECT * FROM categorias ORDER BY ordem, nome').all();
  res.json(categorias);
});

// Admin: POST /api/admin/categorias - Create category
router.post('/admin/categorias', authAdmin, (req, res) => {
  try {
    const schema = z.object({
      nome: z.string().min(1).max(100),
      descricao: z.string().max(500).optional(),
      ordem: z.number().int().default(0),
      ativo: z.boolean().default(true),
      imagem_url: z.string().url().optional().or(z.literal(''))
    });
    const data = schema.parse(req.body);

    const id = generateId();
    const now = new Date().toISOString();

    db.prepare('INSERT INTO categorias (id, nome, descricao, ordem, ativo, imagem_url, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, data.nome, data.descricao || '', data.ordem, data.ativo ? 1 : 0, data.imagem_url || '', now);

    const categoria = db.prepare('SELECT * FROM categorias WHERE id = ?').get(id);
    res.status(201).json(categoria);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message, field: err.errors[0].path[0] });
    }
    console.error('Create category error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Admin: PUT /api/admin/categorias/:id - Update category
router.put('/admin/categorias/:id', authAdmin, (req, res) => {
  try {
    const schema = z.object({
      nome: z.string().min(1).max(100).optional(),
      descricao: z.string().max(500).optional(),
      ordem: z.number().int().optional(),
      ativo: z.boolean().optional(),
      imagem_url: z.string().url().optional().or(z.literal(''))
    });
    const data = schema.parse(req.body);

    const categoria = db.prepare('SELECT * FROM categorias WHERE id = ?').get(req.params.id);
    if (!categoria) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }

    const fields = [];
    const params = [];

    if (data.nome !== undefined) { fields.push('nome = ?'); params.push(data.nome); }
    if (data.descricao !== undefined) { fields.push('descricao = ?'); params.push(data.descricao); }
    if (data.ordem !== undefined) { fields.push('ordem = ?'); params.push(data.ordem); }
    if (data.ativo !== undefined) { fields.push('ativo = ?'); params.push(data.ativo ? 1 : 0); }
    if (data.imagem_url !== undefined) { fields.push('imagem_url = ?'); params.push(data.imagem_url); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    params.push(req.params.id);
    db.prepare(`UPDATE categorias SET ${fields.join(', ')} WHERE id = ?`).run(...params);

    const updated = db.prepare('SELECT * FROM categorias WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message, field: err.errors[0].path[0] });
    }
    console.error('Update category error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Admin: DELETE /api/admin/categorias/:id - Delete category
router.delete('/admin/categorias/:id', authAdmin, (req, res) => {
  const categoria = db.prepare('SELECT * FROM categorias WHERE id = ?').get(req.params.id);
  if (!categoria) {
    return res.status(404).json({ error: 'Categoria não encontrada' });
  }

  // Check if has products
  const hasProducts = db.prepare('SELECT 1 FROM produtos WHERE categoria_id = ?').get(req.params.id);
  if (hasProducts) {
    return res.status(400).json({ error: 'Não é possível excluir categoria com produtos. Mova ou exclua os produtos primeiro.' });
  }

  db.prepare('DELETE FROM categorias WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ===== ADMIN ROUTES FOR PRODUTOS =====

// Admin: GET /api/admin/produtos - List all products
router.get('/admin/produtos', authAdmin, (req, res) => {
  const { categoria } = req.query;

  let sql = 'SELECT p.*, c.nome as categoria_nome FROM produtos p LEFT JOIN categorias c ON p.categoria_id = c.id';
  const params = [];

  if (categoria) {
    sql += ' WHERE p.categoria_id = ?';
    params.push(categoria);
  }

  sql += ' ORDER BY p.criado_em DESC';

  const produtos = db.prepare(sql).all(...params);
  res.json(produtos);
});

// Admin: GET /api/admin/produtos/:id - Get product details
router.get('/admin/produtos/:id', authAdmin, (req, res) => {
  const produto = db.prepare('SELECT * FROM produtos WHERE id = ?').get(req.params.id);
  if (!produto) {
    return res.status(404).json({ error: 'Produto não encontrado' });
  }

  const grupos = db.prepare('SELECT * FROM personalizacao_grupos WHERE produto_id = ? ORDER BY ordem').all(produto.id);
  for (const g of grupos) {
    g.opcoes = db.prepare('SELECT * FROM personalizacao_opcoes WHERE grupo_id = ? ORDER BY ordem').all(g.id);
  }
  produto.personalizacoes = grupos;

  res.json(produto);
});

// Admin: POST /api/admin/produtos - Create product
router.post('/admin/produtos', authAdmin, (req, res) => {
  try {
    const schema = z.object({
      categoria_id: z.string().uuid(),
      nome: z.string().min(1).max(200),
      descricao: z.string().max(1000).optional(),
      preco_base: z.number().positive(),
      imagem_url: z.string().url().optional().or(z.literal('')),
      disponivel: z.boolean().default(true),
      destaque: z.boolean().default(false),
      ordem: z.number().int().default(0),
      personalizacoes: z.array(z.object({
        nome: z.string().min(1).max(100),
        tipo: z.enum(['escolha_unica', 'escolha_multipla']),
        obrigatorio: z.boolean().default(false),
        min_selecoes: z.number().int().min(0).default(0),
        max_selecoes: z.number().int().min(1).default(1),
        ordem: z.number().int().default(0),
        opcoes: z.array(z.object({
          nome: z.string().min(1).max(100),
          preco_adicional: z.number().min(0).default(0),
          ativo: z.boolean().default(true),
          ordem: z.number().int().default(0)
        })).optional()
      })).optional()
    });
    const data = schema.parse(req.body);

    // Verify categoria exists
    const categoria = db.prepare('SELECT 1 FROM categorias WHERE id = ? AND ativo = 1').get(data.categoria_id);
    if (!categoria) {
      return res.status(400).json({ error: 'Categoria inválida', field: 'categoria_id' });
    }

    const id = generateId();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO produtos (id, categoria_id, nome, descricao, preco_base, imagem_url, disponivel, destaque, ordem, criado_em, atualizado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.categoria_id, data.nome, data.descricao || '', data.preco_base, data.imagem_url || '', data.disponivel ? 1 : 0, data.destaque ? 1 : 0, data.ordem, now, now);

    // Create personalizacoes if provided
    if (data.personalizacoes?.length) {
      for (const grupo of data.personalizacoes) {
        const grupoId = generateId();
        db.prepare(`
          INSERT INTO personalizacao_grupos (id, produto_id, nome, tipo, obrigatorio, min_selecoes, max_selecoes, ordem)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(grupoId, id, grupo.nome, grupo.tipo, grupo.obrigatorio ? 1 : 0, grupo.min_selecoes, grupo.max_selecoes, grupo.ordem);

        if (grupo.opcoes?.length) {
          for (const opcao of grupo.opcoes) {
            const opcaoId = generateId();
            db.prepare(`
              INSERT INTO personalizacao_opcoes (id, grupo_id, nome, preco_adicional, ativo, ordem)
              VALUES (?, ?, ?, ?, ?, ?)
            `).run(opcaoId, grupoId, opcao.nome, opcao.preco_adicional, opcao.ativo ? 1 : 0, opcao.ordem);
          }
        }
      }
    }

    const produto = db.prepare('SELECT * FROM produtos WHERE id = ?').get(id);
    res.status(201).json(produto);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message, field: err.errors[0].path[0] });
    }
    console.error('Create product error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Admin: PUT /api/admin/produtos/:id - Update product
router.put('/admin/produtos/:id', authAdmin, (req, res) => {
  try {
    const schema = z.object({
      categoria_id: z.string().uuid().optional(),
      nome: z.string().min(1).max(200).optional(),
      descricao: z.string().max(1000).optional(),
      preco_base: z.number().positive().optional(),
      imagem_url: z.string().url().optional().or(z.literal('')),
      disponivel: z.boolean().optional(),
      destaque: z.boolean().optional(),
      ordem: z.number().int().optional()
    });
    const data = schema.parse(req.body);

    const produto = db.prepare('SELECT * FROM produtos WHERE id = ?').get(req.params.id);
    if (!produto) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    if (data.categoria_id) {
      const categoria = db.prepare('SELECT 1 FROM categorias WHERE id = ? AND ativo = 1').get(data.categoria_id);
      if (!categoria) {
        return res.status(400).json({ error: 'Categoria inválida', field: 'categoria_id' });
      }
    }

    const fields = [];
    const params = [];

    if (data.categoria_id !== undefined) { fields.push('categoria_id = ?'); params.push(data.categoria_id); }
    if (data.nome !== undefined) { fields.push('nome = ?'); params.push(data.nome); }
    if (data.descricao !== undefined) { fields.push('descricao = ?'); params.push(data.descricao); }
    if (data.preco_base !== undefined) { fields.push('preco_base = ?'); params.push(data.preco_base); }
    if (data.imagem_url !== undefined) { fields.push('imagem_url = ?'); params.push(data.imagem_url); }
    if (data.disponivel !== undefined) { fields.push('disponivel = ?'); params.push(data.disponivel ? 1 : 0); }
    if (data.destaque !== undefined) { fields.push('destaque = ?'); params.push(data.destaque ? 1 : 0); }
    if (data.ordem !== undefined) { fields.push('ordem = ?'); params.push(data.ordem); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    fields.push('atualizado_em = ?');
    params.push(new Date().toISOString());
    params.push(req.params.id);

    db.prepare(`UPDATE produtos SET ${fields.join(', ')} WHERE id = ?`).run(...params);

    const updated = db.prepare('SELECT * FROM produtos WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message, field: err.errors[0].path[0] });
    }
    console.error('Update product error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Admin: DELETE /api/admin/produtos/:id - Delete product
router.delete('/admin/produtos/:id', authAdmin, (req, res) => {
  const produto = db.prepare('SELECT * FROM produtos WHERE id = ?').get(req.params.id);
  if (!produto) {
    return res.status(404).json({ error: 'Produto não encontrado' });
  }

  db.prepare('DELETE FROM produtos WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Admin: PUT /api/admin/produtos/:id/personalizacoes - Update product personalizacoes
router.put('/admin/produtos/:id/personalizacoes', authAdmin, (req, res) => {
  try {
    const schema = z.array(z.object({
      id: z.string().optional(), // if provided, update; if not, create new
      nome: z.string().min(1).max(100),
      tipo: z.enum(['escolha_unica', 'escolha_multipla']),
      obrigatorio: z.boolean().default(false),
      min_selecoes: z.number().int().min(0).default(0),
      max_selecoes: z.number().int().min(1).default(1),
      ordem: z.number().int().default(0),
      opcoes: z.array(z.object({
        id: z.string().optional(),
        nome: z.string().min(1).max(100),
        preco_adicional: z.number().min(0).default(0),
        ativo: z.boolean().default(true),
        ordem: z.number().int().default(0)
      }))
    }));
    const data = schema.parse(req.body);

    const produto = db.prepare('SELECT * FROM produtos WHERE id = ?').get(req.params.id);
    if (!produto) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    const existingGrupos = db.prepare('SELECT id FROM personalizacao_grupos WHERE produto_id = ?').all(req.params.id);
    const existingGrupoIds = new Set(existingGrupos.map(g => g.id));
    const incomingGrupoIds = new Set(data.filter(g => g.id).map(g => g.id));

    // Delete grupos not in incoming data
    for (const grupoId of existingGrupoIds) {
      if (!incomingGrupoIds.has(grupoId)) {
        db.prepare('DELETE FROM personalizacao_grupos WHERE id = ?').run(grupoId);
      }
    }

    // Upsert grupos and opcoes
    for (const grupo of data) {
      let grupoId = grupo.id;
      if (grupoId && existingGrupoIds.has(grupoId)) {
        // Update existing grupo
        db.prepare(`
          UPDATE personalizacao_grupos SET nome = ?, tipo = ?, obrigatorio = ?, min_selecoes = ?, max_selecoes = ?, ordem = ?
          WHERE id = ?
        `).run(grupo.nome, grupo.tipo, grupo.obrigatorio ? 1 : 0, grupo.min_selecoes, grupo.max_selecoes, grupo.ordem, grupoId);

        // Handle opcoes
        const existingOpcoes = db.prepare('SELECT id FROM personalizacao_opcoes WHERE grupo_id = ?').all(grupoId);
        const existingOpcaoIds = new Set(existingOpcoes.map(o => o.id));
        const incomingOpcaoIds = new Set(grupo.opcoes.filter(o => o.id).map(o => o.id));

        for (const opcaoId of existingOpcaoIds) {
          if (!incomingOpcaoIds.has(opcaoId)) {
            db.prepare('DELETE FROM personalizacao_opcoes WHERE id = ?').run(opcaoId);
          }
        }

        for (const opcao of grupo.opcoes) {
          if (opcao.id && existingOpcaoIds.has(opcao.id)) {
            db.prepare(`
              UPDATE personalizacao_opcoes SET nome = ?, preco_adicional = ?, ativo = ?, ordem = ?
              WHERE id = ?
            `).run(opcao.nome, opcao.preco_adicional, opcao.ativo ? 1 : 0, opcao.ordem, opcao.id);
          } else {
            const newOpcaoId = generateId();
            db.prepare(`
              INSERT INTO personalizacao_opcoes (id, grupo_id, nome, preco_adicional, ativo, ordem)
              VALUES (?, ?, ?, ?, ?, ?)
            `).run(newOpcaoId, grupoId, opcao.nome, opcao.preco_adicional, opcao.ativo ? 1 : 0, opcao.ordem);
          }
        }
      } else {
        // Create new grupo
        grupoId = generateId();
        db.prepare(`
          INSERT INTO personalizacao_grupos (id, produto_id, nome, tipo, obrigatorio, min_selecoes, max_selecoes, ordem)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(grupoId, req.params.id, grupo.nome, grupo.tipo, grupo.obrigatorio ? 1 : 0, grupo.min_selecoes, grupo.max_selecoes, grupo.ordem);

        for (const opcao of grupo.opcoes) {
          const opcaoId = generateId();
          db.prepare(`
            INSERT INTO personalizacao_opcoes (id, grupo_id, nome, preco_adicional, ativo, ordem)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(opcaoId, grupoId, opcao.nome, opcao.preco_adicional, opcao.ativo ? 1 : 0, opcao.ordem);
        }
      }
    }

    // Return updated product with personalizacoes
    const updated = db.prepare('SELECT * FROM produtos WHERE id = ?').get(req.params.id);
    const grupos = db.prepare('SELECT * FROM personalizacao_grupos WHERE produto_id = ? ORDER BY ordem').all(req.params.id);
    for (const g of grupos) {
      g.opcoes = db.prepare('SELECT * FROM personalizacao_opcoes WHERE grupo_id = ? ORDER BY ordem').all(g.id);
    }
    updated.personalizacoes = grupos;

    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message, field: err.errors[0].path[0] });
    }
    console.error('Update personalizacoes error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export { router as catalogoRouter };