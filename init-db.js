// Simple database initialization script
// Run with: node init-db.js

import Database from 'better-sqlite3';
import { join } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

const dbPath = join(__dirname, 'fraga_lanches.db');
const db = new Database(dbPath);

db.pragma('foreign_keys = ON');

console.log('Database initialized at:', dbPath);

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
    ativo INTEGER DEFAULT 1,
    ultimo_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON produtos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_produtos_disponivel ON produtos(disponivel);
CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_data ON pedidos(data_pedido);
CREATE INDEX IF NOT EXISTS idx_pedido_itens_pedido ON pedido_itens(pedido_id);
CREATE INDEX IF NOT EXISTS idx_personalizacao_grupos_produto ON personalizacao_grupos(produto_id);
CREATE INDEX IF NOT EXISTS idx_personalizacao_opcoes_grupo ON personalizacao_opcoes(grupo_id);
`;

db.exec(schema);
console.log('Schema created successfully');

// Insert default data
const categoriasCount = db.prepare('SELECT COUNT(*) as count FROM categorias').get().count;
if (categoriasCount === 0) {
    const insertCategoria = db.prepare('INSERT INTO categorias (nome, descricao, ordem_exibicao) VALUES (?, ?, ?)');
    const categorias = [
        ['Hambúrgueres', 'Hambúrgueres artesanais suculentos', 1],
        ['Marmitas', 'Pratos completos e bem servidos', 2],
        ['Porções', 'Porções generosas para compartilhar', 3],
        ['Bebidas', 'Refrigerantes, sucos e água', 4],
        ['Sobremesas', 'Doces para finalizar', 5]
    ];
    for (const cat of categorias) {
        insertCategoria.run(...cat);
    }
    console.log('Default categories inserted');
}

const formasPagamentoCount = db.prepare('SELECT COUNT(*) as count FROM formas_pagamento').get().count;
if (formasPagamentoCount === 0) {
    const insertForma = db.prepare('INSERT INTO formas_pagamento (nome, tipo, configuracao) VALUES (?, ?, ?)');
    const formas = [
        ['PIX', 'pix', JSON.stringify({ chave: 'fraga.lanches@email.com' })],
        ['Cartão de Crédito/Débito', 'cartao', JSON.stringify({})],
        ['Dinheiro na Entrega', 'dinheiro', JSON.stringify({})],
        ['Pagamento Online', 'online', JSON.stringify({ provedor: 'mercado_pago', configurado: false })]
    ];
    for (const forma of formas) {
        insertForma.run(...forma);
    }
    console.log('Default payment methods inserted');
}

const configEntregaCount = db.prepare('SELECT COUNT(*) as count FROM configuracoes_entrega').get().count;
if (configEntregaCount === 0) {
    const insertConfig = db.prepare('INSERT INTO configuracoes_entrega (taxa_entrega, valor_minimo_pedido) VALUES (?, ?)');
    insertConfig.run(5.00, 0);
    console.log('Default delivery config inserted');
}

const horariosCount = db.prepare('SELECT COUNT(*) as count FROM horarios_funcionamento').get().count;
if (horariosCount === 0) {
    const insertHorario = db.prepare('INSERT INTO horarios_funcionamento (dia_semana, hora_abertura, hora_fechamento, ativo) VALUES (?, ?, ?, ?)');
    for (let dia = 1; dia <= 6; dia++) {
        insertHorario.run(dia, '18:00', '23:30', 1);
    }
    insertHorario.run(0, '00:00', '00:00', 0);
    console.log('Default business hours inserted');
}

const adminCount = db.prepare('SELECT COUNT(*) as count FROM usuarios_admin').get().count;
if (adminCount === 0) {
    const senhaHash = await bcrypt.hash('admin123', 10);
    const insertAdmin = db.prepare('INSERT INTO usuarios_admin (email, senha_hash, nome) VALUES (?, ?, ?)');
    insertAdmin.run('admin@fragalanches.com', senhaHash, 'Administrador');
    console.log('Default admin user inserted (email: admin@fragalanches.com, senha: admin123)');
}

db.close();
console.log('Database initialization complete!');