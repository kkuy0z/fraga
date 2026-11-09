import express from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { db, generateId, hashPassword, verifyPassword } from '../db/database.js';

const router = express.Router();

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'fraga-super-secret-change-in-production';
const JWT_EXPIRES_IN = '7d';

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  senha: z.string().min(1, 'Senha é obrigatória'),
  lembrar: z.boolean().optional()
});

const registerSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  email: z.string().email('Email inválido'),
  telefone: z.string().min(10, 'Telefone inválido').max(15),
  senha: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').max(64),
  confirmarSenha: z.string()
}).refine(data => data.senha === data.confirmarSenha, {
  message: 'As senhas não conferem',
  path: ['confirmarSenha']
});

// Helper: Generate JWT token
function generateToken(payload, expiresIn = JWT_EXPIRES_IN) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

// Helper: Verify JWT token
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// POST /api/auth/cliente/login - Cliente login
router.post('/cliente/login', async (req, res) => {
  try {
    const { email, senha, lembrar } = loginSchema.parse(req.body);

    const cliente = db.prepare('SELECT * FROM clientes WHERE email = ? AND ativo = 1').get(email.toLowerCase());
    if (!cliente) {
      return res.status(401).json({ error: 'Email ou senha incorretos', field: 'email' });
    }

    const valid = verifyPassword(senha, cliente.senha_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Email ou senha incorretos', field: 'senha' });
    }

    const token = generateToken({ id: cliente.id, tipo: 'cliente', email: cliente.email });
    const expiresIn = lembrar ? '30d' : '7d';
    const longToken = generateToken({ id: cliente.id, tipo: 'cliente', email: cliente.email }, expiresIn);

    // Update last login
    db.prepare('UPDATE clientes SET atualizado_em = ? WHERE id = ?').run(new Date().toISOString(), cliente.id);

    res.json({
      token: longToken,
      cliente: {
        id: cliente.id,
        nome: cliente.nome,
        email: cliente.email,
        telefone: cliente.telefone
      }
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message, field: err.errors[0].path[0] });
    }
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/auth/cliente/register - Cliente register
router.post('/cliente/register', async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);

    // Check if email exists
    const emailExists = db.prepare('SELECT 1 FROM clientes WHERE email = ?').get(data.email.toLowerCase());
    if (emailExists) {
      return res.status(409).json({ error: 'Este email já está cadastrado', field: 'email' });
    }

    // Check if phone exists
    const phoneExists = db.prepare('SELECT 1 FROM clientes WHERE telefone = ?').get(data.telefone);
    if (phoneExists) {
      return res.status(409).json({ error: 'Este WhatsApp já está cadastrado', field: 'telefone' });
    }

    const id = generateId();
    const senha_hash = hashPassword(data.senha);
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO clientes (id, nome, email, telefone, senha_hash, criado_em, atualizado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.nome, data.email.toLowerCase(), data.telefone, senha_hash, now, now);

    const token = generateToken({ id, tipo: 'cliente', email: data.email });

    res.status(201).json({
      token,
      cliente: {
        id,
        nome: data.nome,
        email: data.email.toLowerCase(),
        telefone: data.telefone
      }
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message, field: err.errors[0].path[0] });
    }
    console.error('Register error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/auth/cliente/verify - Verify client token
router.post('/cliente/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  const token = authHeader.slice(7);
  const decoded = verifyToken(token);

  if (!decoded || decoded.tipo !== 'cliente') {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }

  const cliente = db.prepare('SELECT id, nome, email, telefone, ativo FROM clientes WHERE id = ? AND ativo = 1').get(decoded.id);
  if (!cliente) {
    return res.status(401).json({ error: 'Cliente não encontrado' });
  }

  res.json({ valid: true, cliente });
});

// POST /api/auth/admin/login - Admin login
router.post('/admin/login', async (req, res) => {
  try {
    const { email, senha } = loginSchema.parse(req.body);

    const user = db.prepare('SELECT * FROM users WHERE email = ? AND ativo = 1').get(email.toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Email ou senha incorretos', field: 'email' });
    }

    const valid = verifyPassword(senha, user.senha_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Email ou senha incorretos', field: 'senha' });
    }

    const token = generateToken({ id: user.id, tipo: 'admin', email: user.email, role: user.role });

    db.prepare('UPDATE users SET atualizado_em = ? WHERE id = ?').run(new Date().toISOString(), user.id);

    res.json({
      token,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message, field: err.errors[0].path[0] });
    }
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/auth/admin/verify - Verify admin token
router.post('/admin/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  const token = authHeader.slice(7);
  const decoded = verifyToken(token);

  if (!decoded || decoded.tipo !== 'admin') {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }

  const user = db.prepare('SELECT id, nome, email, role, ativo FROM users WHERE id = ? AND ativo = 1').get(decoded.id);
  if (!user) {
    return res.status(401).json({ error: 'Usuário não encontrado' });
  }

  res.json({ valid: true, user });
});

// GET /api/auth/me - Get current user info (works for both client and admin)
router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  const token = authHeader.slice(7);
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }

  if (decoded.tipo === 'cliente') {
    const cliente = db.prepare('SELECT id, nome, email, telefone, ativo FROM clientes WHERE id = ? AND ativo = 1').get(decoded.id);
    if (!cliente) return res.status(401).json({ error: 'Cliente não encontrado' });
    return res.json({ tipo: 'cliente', ...cliente });
  }

  if (decoded.tipo === 'admin') {
    const user = db.prepare('SELECT id, nome, email, role, ativo FROM users WHERE id = ? AND ativo = 1').get(decoded.id);
    if (!user) return res.status(401).json({ error: 'Usuário não encontrado' });
    return res.json({ tipo: 'admin', ...user });
  }

  res.status(401).json({ error: 'Token inválido' });
});

export { router as authRouter };
export { verifyToken, JWT_SECRET };