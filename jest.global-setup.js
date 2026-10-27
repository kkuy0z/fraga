// Global setup - runs once before all test suites
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { join } from 'path';
import { fileURLToPath } from 'url';
import argon2 from 'argon2';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

// Test database path - must match connection.js path: join(__dirname, '..', '..', 'test_fraga_lanches.db')
// connection.js __dirname is src/database, so we need to go up two levels from project root
const testDbPath = join(__dirname, 'test_fraga_lanches.db');

export default async function globalSetup() {
  // Remove existing test database if it exists
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  const db = await open({
    filename: testDbPath,
    driver: sqlite3.Database
  });

  await db.exec('PRAGMA foreign_keys = ON');

  // Run the same schema as init.js
  const schema = `
-- Categorias
CREATE TABLE IF NOT EXISTS categorias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    descricao TEXT,
    ordem_exibicao INTEGER DEFAULT 0,
    ativo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Produtos
CREATE TABLE IF NOT EXISTS produtos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    categoria_id INTEGER NOT NULL,
    nome TEXT NOT NULL,
    descricao TEXT,
    preco_base REAL NOT NULL CHECK (preco_base >= 0),
    imagem_url TEXT,
    disponivel INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE RESTRICT
);

-- Opções de personalização (grupos de opções)
CREATE TABLE IF NOT EXISTS personalizacao_grupos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    produto_id INTEGER NOT NULL,
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('adicional', 'remocao', 'escolha_unica', 'escolha_multipla')),
    obrigatorio INTEGER DEFAULT 0,
    min_selecoes INTEGER DEFAULT 0,
    max_selecoes INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE
);

-- Opções de personalização (itens individuais)
CREATE TABLE IF NOT EXISTS personalizacao_opcoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grupo_id INTEGER NOT NULL,
    nome TEXT NOT NULL,
    preco_adicional REAL DEFAULT 0 CHECK (preco_adicional >= 0),
    ativo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (grupo_id) REFERENCES personalizacao_grupos(id) ON DELETE CASCADE
);

-- Horários de funcionamento
CREATE TABLE IF NOT EXISTS horarios_funcionamento (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
    hora_abertura TEXT NOT NULL,
    hora_fechamento TEXT NOT NULL,
    ativo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(dia_semana, hora_abertura, hora_fechamento)
);

-- Configurações de entrega
CREATE TABLE IF NOT EXISTS configuracoes_entrega (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    taxa_entrega REAL NOT NULL DEFAULT 0 CHECK (taxa_entrega >= 0),
    valor_minimo_pedido REAL DEFAULT 0 CHECK (valor_minimo_pedido >= 0),
    bairro_taxa_extra TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Formas de pagamento
CREATE TABLE IF NOT EXISTS formas_pagamento (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    tipo TEXT NOT NULL CHECK (tipo IN ('pix', 'cartao', 'dinheiro', 'online')),
    ativo INTEGER DEFAULT 1,
    configuracao TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Pedidos
CREATE TABLE IF NOT EXISTS pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_pedido TEXT NOT NULL UNIQUE,
    cliente_nome TEXT NOT NULL,
    cliente_telefone TEXT NOT NULL,
    cliente_email TEXT,
    cep TEXT,
    logradouro TEXT NOT NULL,
    numero_endereco TEXT NOT NULL,
    bairro TEXT NOT NULL,
    complemento TEXT,
    referencia TEXT,
    forma_pagamento_id INTEGER NOT NULL,
    valor_troco REAL DEFAULT 0 CHECK (valor_troco >= 0),
    observacoes_pagamento TEXT,
    subtotal_produtos REAL NOT NULL DEFAULT 0 CHECK (subtotal_produtos >= 0),
    taxa_entrega REAL NOT NULL DEFAULT 0 CHECK (taxa_entrega >= 0),
    taxa_bairro REAL NOT NULL DEFAULT 0 CHECK (taxa_bairro >= 0),
    desconto REAL NOT NULL DEFAULT 0 CHECK (desconto >= 0),
    valor_total REAL NOT NULL DEFAULT 0 CHECK (valor_total >= 0),
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmado', 'preparando', 'saiu_entrega', 'entregue', 'cancelado')),
    data_pedido DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (forma_pagamento_id) REFERENCES formas_pagamento(id) ON DELETE RESTRICT
);

-- Itens do pedido
CREATE TABLE IF NOT EXISTS pedido_itens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id INTEGER NOT NULL,
    produto_id INTEGER NOT NULL,
    produto_nome TEXT NOT NULL,
    preco_base REAL NOT NULL CHECK (preco_base >= 0),
    quantidade INTEGER NOT NULL DEFAULT 1 CHECK (quantidade > 0),
    subtotal REAL NOT NULL CHECK (subtotal >= 0),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
    FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE RESTRICT
);

-- Personalizações dos itens do pedido
CREATE TABLE IF NOT EXISTS pedido_item_personalizacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_item_id INTEGER NOT NULL,
    grupo_id INTEGER NOT NULL,
    grupo_nome TEXT NOT NULL,
    opcao_id INTEGER NOT NULL,
    opcao_nome TEXT NOT NULL,
    preco_adicional REAL NOT NULL DEFAULT 0 CHECK (preco_adicional >= 0),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pedido_item_id) REFERENCES pedido_itens(id) ON DELETE CASCADE,
    FOREIGN KEY (grupo_id) REFERENCES personalizacao_grupos(id) ON DELETE RESTRICT,
    FOREIGN KEY (opcao_id) REFERENCES personalizacao_opcoes(id) ON DELETE RESTRICT
);

-- Usuários administrativos
CREATE TABLE IF NOT EXISTS usuarios_admin (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    nome TEXT NOT NULL,
    perfil TEXT NOT NULL DEFAULT 'atendente' CHECK (perfil IN ('administrador', 'atendente', 'cozinha', 'entregador')),
    ativo INTEGER DEFAULT 1,
    ultimo_login DATETIME,
    forca_troca_senha INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Clientes
CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    telefone TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    cep TEXT,
    logradouro TEXT,
    numero TEXT,
    bairro TEXT,
    complemento TEXT,
    ativo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Endereços do cliente
CREATE TABLE IF NOT EXISTS enderecos_cliente (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER NOT NULL,
    cep TEXT NOT NULL,
    logradouro TEXT NOT NULL,
    numero TEXT NOT NULL,
    bairro TEXT NOT NULL,
    complemento TEXT,
    principal INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON produtos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_produtos_disponivel ON produtos(disponivel);
CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_data ON pedidos(data_pedido);
CREATE INDEX IF NOT EXISTS idx_pedido_itens_pedido ON pedido_itens(pedido_id);
CREATE INDEX IF NOT EXISTS idx_personalizacao_grupos_produto ON personalizacao_grupos(produto_id);
CREATE INDEX IF NOT EXISTS idx_personalizacao_opcoes_grupo ON personalizacao_opcoes(grupo_id);
CREATE INDEX IF NOT EXISTS idx_clientes_email ON clientes(email);
CREATE INDEX IF NOT EXISTS idx_clientes_telefone ON clientes(telefone);
CREATE INDEX IF NOT EXISTS idx_clientes_ativo ON clientes(ativo);
CREATE INDEX IF NOT EXISTS idx_enderecos_cliente ON enderecos_cliente(cliente_id);
`;

  await db.exec(schema);

  // Insert default test data
  const insertCategoria = await db.prepare('INSERT INTO categorias (nome, descricao, ordem_exibicao) VALUES (?, ?, ?)');
  const categorias = [
    ['Hambúrgueres', 'Hambúrgueres artesanais suculentos', 1],
    ['Bebidas', 'Refrigerantes, sucos e água', 2]
  ];
  for (const cat of categorias) {
    await insertCategoria.run(...cat);
  }

  const insertForma = await db.prepare('INSERT INTO formas_pagamento (nome, tipo, configuracao) VALUES (?, ?, ?)');
  const formas = [
    ['PIX', 'pix', JSON.stringify({ chave: 'test@test.com' })],
    ['Cartão de Crédito/Débito', 'cartao', JSON.stringify({})],
    ['Dinheiro na Entrega', 'dinheiro', JSON.stringify({})]
  ];
  for (const forma of formas) {
    await insertForma.run(...forma);
  }

  // Delivery config with bairro taxes
  const insertConfig = await db.prepare('INSERT INTO configuracoes_entrega (taxa_entrega, valor_minimo_pedido, bairro_taxa_extra) VALUES (?, ?, ?)');
  const bairrosTaxa = [
    { bairro: 'Centro', taxa_extra: 0 },
    { bairro: 'Jardim América', taxa_extra: 3.50 },
    { bairro: 'Vila Nova', taxa_extra: 5.00 },
    { bairro: 'Parque Industrial', taxa_extra: 7.50 },
    { bairro: 'Bairro Distante', taxa_extra: 10.00 }
  ];
  await insertConfig.run(5.00, 0, JSON.stringify(bairrosTaxa));

  // Business hours - open 24/7 for testing (00:00 to 23:59)
  const insertHorario = await db.prepare('INSERT INTO horarios_funcionamento (dia_semana, hora_abertura, hora_fechamento, ativo) VALUES (?, ?, ?, ?)');
  for (let dia = 0; dia <= 6; dia++) {
    await insertHorario.run(dia, '00:00', '23:59', 1);
  }

  // Admin user
  const senhaHash = await argon2.hash('admin123', { type: argon2.argon2id });
  const insertAdmin = await db.prepare('INSERT INTO usuarios_admin (email, senha_hash, nome, perfil, forca_troca_senha) VALUES (?, ?, ?, ?, ?)');
  await insertAdmin.run('admin@test.com', senhaHash, 'Admin Test', 'administrador', 0);

  // Test client
  const clientHash = await argon2.hash('client123', { type: argon2.argon2id });
  const insertClient = await db.prepare('INSERT INTO clientes (nome, email, telefone, senha_hash, cep, logradouro, numero, bairro) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  await insertClient.run('Cliente Teste', 'client@test.com', '11999999999', clientHash, '01000-000', 'Rua Teste', '123', 'Centro');

  // Test products
  const insertProduto = await db.prepare(`
    INSERT INTO produtos (categoria_id, nome, descricao, preco_base, imagem_url, disponivel)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = await insertProduto.run(1, 'X-Burger Teste', 'Hambúrguer de teste', 25.00, '', 1);
  const produtoId = result.lastID;
  await insertProduto.finalize();

  const insertGrupo = await db.prepare(`
    INSERT INTO personalizacao_grupos (produto_id, nome, tipo, obrigatorio, min_selecoes, max_selecoes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const grupoResult = await insertGrupo.run(produtoId, 'Ponto da Carne', 'escolha_unica', 1, 1, 1);
  const grupoId = grupoResult.lastID;
  await insertGrupo.finalize();

  const insertOpcao = await db.prepare(`
    INSERT INTO personalizacao_opcoes (grupo_id, nome, preco_adicional, ativo)
    VALUES (?, ?, ?, ?)
  `);
  await insertOpcao.run(grupoId, 'Mal passado', 0, 1);
  await insertOpcao.run(grupoId, 'Ao ponto', 0, 1);
  await insertOpcao.run(grupoId, 'Bem passado', 0, 1);
  await insertOpcao.finalize();

  await insertCategoria.finalize();
  await insertForma.finalize();
  await insertConfig.finalize();
  await insertHorario.finalize();
  await insertAdmin.finalize();
  await insertClient.finalize();

  await db.close();

  console.log('Global test database initialized');
}