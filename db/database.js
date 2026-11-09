import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, '..', 'data', 'fraga.db');

// Ensure data directory exists
import { mkdirSync, existsSync } from 'fs';
const dataDir = join(__dirname, '..', 'data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  // Users table (admins)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      senha_hash TEXT NOT NULL,
      role TEXT DEFAULT 'atendente',
      ativo INTEGER DEFAULT 1,
      criado_em TEXT DEFAULT (datetime('now')),
      atualizado_em TEXT DEFAULT (datetime('now'))
    )
  `);

  // Clientes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS clientes (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      telefone TEXT UNIQUE NOT NULL,
      senha_hash TEXT NOT NULL,
      ativo INTEGER DEFAULT 1,
      email_verificado INTEGER DEFAULT 0,
      criado_em TEXT DEFAULT (datetime('now')),
      atualizado_em TEXT DEFAULT (datetime('now'))
    )
  `);

  // Categorias table
  db.exec(`
    CREATE TABLE IF NOT EXISTS categorias (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      descricao TEXT,
      ordem INTEGER DEFAULT 0,
      ativo INTEGER DEFAULT 1,
      imagem_url TEXT,
      criado_em TEXT DEFAULT (datetime('now'))
    )
  `);

  // Produtos table
  db.exec(`
    CREATE TABLE IF NOT EXISTS produtos (
      id TEXT PRIMARY KEY,
      categoria_id TEXT NOT NULL,
      nome TEXT NOT NULL,
      descricao TEXT,
      preco_base REAL NOT NULL,
      imagem_url TEXT,
      disponivel INTEGER DEFAULT 1,
      destaque INTEGER DEFAULT 0,
      ordem INTEGER DEFAULT 0,
      criado_em TEXT DEFAULT (datetime('now')),
      atualizado_em TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (categoria_id) REFERENCES categorias(id)
    )
  `);

  // Personalizacoes (groups)
  db.exec(`
    CREATE TABLE IF NOT EXISTS personalizacao_grupos (
      id TEXT PRIMARY KEY,
      produto_id TEXT NOT NULL,
      nome TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK (tipo IN ('escolha_unica', 'escolha_multipla')),
      obrigatorio INTEGER DEFAULT 0,
      min_selecoes INTEGER DEFAULT 0,
      max_selecoes INTEGER DEFAULT 1,
      ordem INTEGER DEFAULT 0,
      FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE
    )
  `);

  // Personalizacao opcoes
  db.exec(`
    CREATE TABLE IF NOT EXISTS personalizacao_opcoes (
      id TEXT PRIMARY KEY,
      grupo_id TEXT NOT NULL,
      nome TEXT NOT NULL,
      preco_adicional REAL DEFAULT 0,
      ativo INTEGER DEFAULT 1,
      ordem INTEGER DEFAULT 0,
      FOREIGN KEY (grupo_id) REFERENCES personalizacao_grupos(id) ON DELETE CASCADE
    )
  `);

  // Horarios table
  db.exec(`
    CREATE TABLE IF NOT EXISTS horarios (
      id TEXT PRIMARY KEY,
      dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
      hora_abertura TEXT NOT NULL,
      hora_fechamento TEXT NOT NULL,
      ativo INTEGER DEFAULT 1
    )
  `);

  // Enderecos table
  db.exec(`
    CREATE TABLE IF NOT EXISTS enderecos (
      id TEXT PRIMARY KEY,
      cliente_id TEXT NOT NULL,
      cep TEXT NOT NULL,
      logradouro TEXT NOT NULL,
      numero TEXT NOT NULL,
      complemento TEXT,
      bairro TEXT NOT NULL,
      cidade TEXT NOT NULL,
      estado TEXT NOT NULL,
      referencia TEXT,
      principal INTEGER DEFAULT 0,
      criado_em TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
    )
  `);

  // Pedidos table
  db.exec(`
    CREATE TABLE IF NOT EXISTS pedidos (
      id TEXT PRIMARY KEY,
      numero INTEGER NOT NULL UNIQUE,
      cliente_id TEXT NOT NULL,
      status TEXT DEFAULT 'pendente',
      subtotal REAL NOT NULL,
      taxa_entrega REAL DEFAULT 0,
      desconto REAL DEFAULT 0,
      total REAL NOT NULL,
      forma_pagamento TEXT,
      endereco_entrega TEXT,
      observacoes TEXT,
      criado_em TEXT DEFAULT (datetime('now')),
      atualizado_em TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (cliente_id) REFERENCES clientes(id)
    )
  `);

  // Pedido itens
  db.exec(`
    CREATE TABLE IF NOT EXISTS pedido_itens (
      id TEXT PRIMARY KEY,
      pedido_id TEXT NOT NULL,
      produto_id TEXT NOT NULL,
      nome_produto TEXT NOT NULL,
      preco_unitario REAL NOT NULL,
      quantidade INTEGER NOT NULL,
      observacoes TEXT,
      personalizacoes TEXT,
      criado_em TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE
    )
  `);

  // Formas de pagamento
  db.exec(`
    CREATE TABLE IF NOT EXISTS formas_pagamento (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      tipo TEXT NOT NULL,
      ativo INTEGER DEFAULT 1,
      ordem INTEGER DEFAULT 0
    )
  `);

  // Config entrega
  db.exec(`
    CREATE TABLE IF NOT EXISTS config_entrega (
      id TEXT PRIMARY KEY DEFAULT '1',
      taxa_entrega REAL DEFAULT 0,
      valor_minimo_pedido REAL DEFAULT 0,
      tempo_medio_entrega INTEGER DEFAULT 45,
      raio_entrega_km REAL DEFAULT 10,
      atualizado_em TEXT DEFAULT (datetime('now'))
    )
  `);

  // Insert default data
  insertDefaults();

  console.log('Database schema created');
}

function insertDefaults() {
  const now = new Date().toISOString();

  // Default admin user (password: admin123)
  const adminExists = db.prepare('SELECT 1 FROM users WHERE email = ?').get('admin@fraga.com');
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(`
      INSERT INTO users (id, nome, email, senha_hash, role, ativo, criado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), 'Administrador', 'admin@fraga.com', hash, 'administrador', 1, now);
  }

  // Default categories
  const catCount = db.prepare('SELECT COUNT(*) as c FROM categorias').get();
  if (catCount.c === 0) {
    const categorias = [
      { id: uuidv4(), nome: 'Hambúrgueres', descricao: 'Hambúrgueres artesanais', ordem: 1 },
      { id: uuidv4(), nome: 'Marmitas', descricao: 'Marmitas caseiras', ordem: 2 },
      { id: uuidv4(), nome: 'Porções', descricao: 'Porções para compartilhar', ordem: 3 },
      { id: uuidv4(), nome: 'Bebidas', descricao: 'Refrigerantes, sucos e cervejas', ordem: 4 },
    ];
    const stmt = db.prepare('INSERT INTO categorias (id, nome, descricao, ordem, ativo) VALUES (?, ?, ?, ?, 1)');
    for (const c of categorias) stmt.run(c.id, c.nome, c.descricao, c.ordem);
  }

  // Default produtos
  const prodCount = db.prepare('SELECT COUNT(*) as c FROM produtos').get();
  if (prodCount.c === 0) {
    const catIds = db.prepare('SELECT id FROM categorias').all().map(r => r.id);
    const [catHamburguer, catMarmita, catPorcao, catBebida] = catIds;

    const produtos = [
      { id: uuidv4(), categoria_id: catHamburguer, nome: 'X-Burger Clássico', descricao: 'Hambúrguer 180g, queijo, alface, tomate, maionese caseira', preco_base: 28.90, destaque: 1 },
      { id: uuidv4(), categoria_id: catHamburguer, nome: 'X-Bacon', descricao: 'Hambúrguer 180g, queijo, bacon crocante, alface, tomate, maionese', preco_base: 32.90, destaque: 1 },
      { id: uuidv4(), categoria_id: catHamburguer, nome: 'X-Salada', descricao: 'Hambúrguer 180g, queijo, alface, tomate, cebola, picles, maionese', preco_base: 29.90 },
      { id: uuidv4(), categoria_id: catMarmita, nome: 'Marmita Completa', descricao: 'Arroz, feijão, carne, salada, batata frita, farofa', preco_base: 35.00 },
      { id: uuidv4(), categoria_id: catPorcao, nome: 'Batata Frita Grande', descricao: 'Porção generosa de batatas fritas crocantes', preco_base: 18.00 },
      { id: uuidv4(), categoria_id: catPorcao, nome: 'Onion Rings', descricao: 'Anéis de cebola empanados', preco_base: 22.00 },
      { id: uuidv4(), categoria_id: catBebida, nome: 'Coca-Cola 350ml', descricao: 'Refrigerante gelado', preco_base: 6.00 },
      { id: uuidv4(), categoria_id: catBebida, nome: 'Suco Natural 300ml', descricao: 'Laranja, maracujá ou limão', preco_base: 8.00 },
    ];
    const stmt = db.prepare(`
      INSERT INTO produtos (id, categoria_id, nome, descricao, preco_base, disponivel, destaque)
      VALUES (?, ?, ?, ?, ?, 1, ?)
    `);
    for (const p of produtos) stmt.run(p.id, p.categoria_id, p.nome, p.descricao, p.preco_base, p.destaque || 0);
  }

  // Default horarios (Seg-Sex 18:00-23:30, Sab 18:00-23:30)
  const horCount = db.prepare('SELECT COUNT(*) as c FROM horarios').get();
  if (horCount.c === 0) {
    const dias = [
      { dia: 1, abre: '18:00', fecha: '23:30' }, // Segunda
      { dia: 2, abre: '18:00', fecha: '23:30' }, // Terça
      { dia: 3, abre: '18:00', fecha: '23:30' }, // Quarta
      { dia: 4, abre: '18:00', fecha: '23:30' }, // Quinta
      { dia: 5, abre: '18:00', fecha: '23:30' }, // Sexta
      { dia: 6, abre: '18:00', fecha: '23:30' }, // Sábado
      // Domingo fechado (não insere)
    ];
    const stmt = db.prepare('INSERT INTO horarios (id, dia_semana, hora_abertura, hora_fechamento, ativo) VALUES (?, ?, ?, ?, 1)');
    for (const h of dias) stmt.run(uuidv4(), h.dia, h.abre, h.fecha);
  }

  // Default formas de pagamento
  const pagCount = db.prepare('SELECT COUNT(*) as c FROM formas_pagamento').get();
  if (pagCount.c === 0) {
    const formas = [
      { id: uuidv4(), nome: 'Dinheiro', tipo: 'dinheiro', ordem: 1 },
      { id: uuidv4(), nome: 'PIX', tipo: 'pix', ordem: 2 },
      { id: uuidv4(), nome: 'Cartão Débito', tipo: 'debito', ordem: 3 },
      { id: uuidv4(), nome: 'Cartão Crédito', tipo: 'credito', ordem: 4 },
    ];
    const stmt = db.prepare('INSERT INTO formas_pagamento (id, nome, tipo, ativo, ordem) VALUES (?, ?, ?, 1, ?)');
    for (const f of formas) stmt.run(f.id, f.nome, f.tipo, f.ordem);
  }

  // Config entrega
  const cfgCount = db.prepare('SELECT COUNT(*) as c FROM config_entrega').get();
  if (cfgCount.c === 0) {
    db.prepare(`
      INSERT INTO config_entrega (id, taxa_entrega, valor_minimo_pedido, tempo_medio_entrega, raio_entrega_km)
      VALUES ('1', 5.00, 20.00, 45, 10)
    `).run();
  }
}

// Helper functions
export function generateId() {
  return uuidv4();
}

export function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}