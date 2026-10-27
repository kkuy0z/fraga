import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { join } from 'path';
import { fileURLToPath } from 'url';
import argon2 from 'argon2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

const dbPath = join(__dirname, '..', '..', 'fraga_lanches.db');

async function initDatabase() {
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    await db.exec('PRAGMA foreign_keys = ON');

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
    console.log('Schema created successfully');

    // Insert default data
    const categoriasCount = (await db.get('SELECT COUNT(*) as count FROM categorias')).count;
    if (categoriasCount === 0) {
        const insertCategoria = await db.prepare('INSERT INTO categorias (nome, descricao, ordem_exibicao) VALUES (?, ?, ?)');
        const categorias = [
            ['Hambúrgueres', 'Hambúrgueres artesanais suculentos', 1],
            ['Marmitas', 'Pratos completos e bem servidos', 2],
            ['Porções', 'Porções generosas para compartilhar', 3],
            ['Bebidas', 'Refrigerantes, sucos e água', 4],
            ['Sobremesas', 'Doces para finalizar', 5]
        ];
        for (const cat of categorias) {
            await insertCategoria.run(...cat);
        }
        console.log('Default categories inserted');
    }

    const formasPagamentoCount = (await db.get('SELECT COUNT(*) as count FROM formas_pagamento')).count;
    if (formasPagamentoCount === 0) {
        const insertForma = await db.prepare('INSERT INTO formas_pagamento (nome, tipo, configuracao) VALUES (?, ?, ?)');
        const formas = [
            ['PIX', 'pix', JSON.stringify({ chave: 'fraga.lanches@email.com' })],
            ['Cartão de Crédito/Débito', 'cartao', JSON.stringify({})],
            ['Dinheiro na Entrega', 'dinheiro', JSON.stringify({})],
            ['Pagamento Online', 'online', JSON.stringify({ provedor: 'mercado_pago', configurado: false })]
        ];
        for (const forma of formas) {
            await insertForma.run(...forma);
        }
        console.log('Default payment methods inserted');
    }

    const configEntregaCount = (await db.get('SELECT COUNT(*) as count FROM configuracoes_entrega')).count;
    if (configEntregaCount === 0) {
        const insertConfig = await db.prepare('INSERT INTO configuracoes_entrega (taxa_entrega, valor_minimo_pedido) VALUES (?, ?)');
        await insertConfig.run(5.00, 0);
        console.log('Default delivery config inserted');
    }

    const horariosCount = (await db.get('SELECT COUNT(*) as count FROM horarios_funcionamento')).count;
    if (horariosCount === 0) {
        const insertHorario = await db.prepare('INSERT INTO horarios_funcionamento (dia_semana, hora_abertura, hora_fechamento, ativo) VALUES (?, ?, ?, ?)');
        for (let dia = 1; dia <= 6; dia++) {
            await insertHorario.run(dia, '18:00', '23:30', 1);
        }
        await insertHorario.run(0, '00:00', '00:00', 0);
        console.log('Default business hours inserted');
    }

    const adminCount = (await db.get('SELECT COUNT(*) as count FROM usuarios_admin')).count;
    if (adminCount === 0) {
        const senhaHash = await argon2.hash('admin123', { type: argon2.argon2id });
        const insertAdmin = await db.prepare('INSERT INTO usuarios_admin (email, senha_hash, nome, perfil, forca_troca_senha) VALUES (?, ?, ?, ?, ?)');
        await insertAdmin.run('admin@fragalanches.com', senhaHash, 'Administrador', 'administrador', 1);
        console.log('Default admin user inserted (email: admin@fragalanches.com, senha: admin123) - FORÇA TROCA DE SENHA NO PRIMEIRO LOGIN');
    }

    // Insert fictional products if none exist
    const produtosCount = (await db.get('SELECT COUNT(*) as count FROM produtos')).count;
    if (produtosCount === 0) {
        const insertProduto = await db.prepare(`
            INSERT INTO produtos (categoria_id, nome, descricao, preco_base, imagem_url, disponivel)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        const insertGrupo = await db.prepare(`
            INSERT INTO personalizacao_grupos (produto_id, nome, tipo, obrigatorio, min_selecoes, max_selecoes)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        const insertOpcao = await db.prepare(`
            INSERT INTO personalizacao_opcoes (grupo_id, nome, preco_adicional, ativo)
            VALUES (?, ?, ?, ?)
        `);

        const produtos = [
            // Hambúrgueres (categoria_id: 1)
            { categoria_id: 1, nome: 'X-Burger Clássico', descricao: 'Hambúrguer artesanal 180g, queijo cheddar, alface, tomate, cebola e molho especial', preco_base: 24.90, imagem_url: '', disponivel: 1 },
            { categoria_id: 1, nome: 'X-Bacon', descricao: 'Hambúrguer artesanal 180g, queijo cheddar, bacon crocante, alface, tomate e molho barbacue', preco_base: 28.90, imagem_url: '', disponivel: 1 },
            { categoria_id: 1, nome: 'X-Egg', descricao: 'Hambúrguer artesanal 180g, queijo cheddar, ovo frito, bacon, alface, tomate e maionese', preco_base: 29.90, imagem_url: '', disponivel: 1 },
            { categoria_id: 1, nome: 'X-Tudo', descricao: 'Hambúrguer artesanal 180g, queijo cheddar, bacon, ovo, calabresa, alface, tomate, cebola e molho especial', preco_base: 34.90, imagem_url: '', disponivel: 1 },
            { categoria_id: 1, nome: 'Duplo Cheese', descricao: 'Dois hambúrgueres artesanais 180g, queijo cheddar duplo, alface, tomate e molho da casa', preco_base: 32.90, imagem_url: '', disponivel: 1 },
            { categoria_id: 1, nome: 'Vegetariano', descricao: 'Hambúrguer de grão-de-bico e quinoa, queijo cheddar, alface, tomate, cebola caramelizada e molho pesto', preco_base: 26.90, imagem_url: '', disponivel: 1 },

            // Marmitas (categoria_id: 2)
            { categoria_id: 2, nome: 'Marmita Executiva', descricao: 'Arroz, feijão, bife acebolado, batata frita, salada e farofa', preco_base: 22.90, imagem_url: '', disponivel: 1 },
            { categoria_id: 2, nome: 'Marmita Frango', descricao: 'Arroz, feijão, frango grelhado, batata frita, salada e farofa', preco_base: 20.90, imagem_url: '', disponivel: 1 },
            { categoria_id: 2, nome: 'Marmita Carne de Panela', descricao: 'Arroz, feijão, carne de panela com batatas, salada e farofa', preco_base: 24.90, imagem_url: '', disponivel: 1 },

            // Porções (categoria_id: 3)
            { categoria_id: 3, nome: 'Batata Frita', descricao: 'Porção generosa de batatas fritas crocantes', preco_base: 16.90, imagem_url: '', disponivel: 1 },
            { categoria_id: 3, nome: 'Batata Frita c/ Cheddar e Bacon', descricao: 'Batatas fritas cobertas com queijo cheddar cremoso e bacon crocante', preco_base: 24.90, imagem_url: '', disponivel: 1 },
            { categoria_id: 3, nome: 'Onion Rings', descricao: 'Anéis de cebola empanados e fritos', preco_base: 18.90, imagem_url: '', disponivel: 1 },
            { categoria_id: 3, nome: 'Mandioca Frita', descricao: 'Porção de mandioca (aipim) frita na hora', preco_base: 15.90, imagem_url: '', disponivel: 1 },

            // Bebidas (categoria_id: 4)
            { categoria_id: 4, nome: 'Refrigerante Lata 350ml', descricao: 'Coca-Cola, Guaraná, Sprite, Fanta', preco_base: 5.00, imagem_url: '', disponivel: 1 },
            { categoria_id: 4, nome: 'Refrigerante 2L', descricao: 'Coca-Cola, Guaraná, Sprite, Fanta', preco_base: 12.00, imagem_url: '', disponivel: 1 },
            { categoria_id: 4, nome: 'Suco Natural 300ml', descricao: 'Laranja, Maracujá, Abacaxi, Limão', preco_base: 7.00, imagem_url: '', disponivel: 1 },
            { categoria_id: 4, nome: 'Água Mineral 500ml', descricao: 'Água mineral sem gás', preco_base: 3.00, imagem_url: '', disponivel: 1 },

            // Sobremesas (categoria_id: 5)
            { categoria_id: 5, nome: 'Petit Gateau', descricao: 'Bolinho de chocolate com sorvete de creme', preco_base: 18.90, imagem_url: '', disponivel: 1 },
            { categoria_id: 5, nome: 'Sorvete 2 Bolas', descricao: 'Sabores: chocolate, creme, morango, flocos', preco_base: 10.00, imagem_url: '', disponivel: 1 },
        ];

        for (const prod of produtos) {
            const result = await insertProduto.run(prod.categoria_id, prod.nome, prod.descricao, prod.preco_base, prod.imagem_url, prod.disponivel);
            const produtoId = result.lastInsertRowid;

            // Add customization options for hambúrgueres
            if (prod.categoria_id === 1) {
                // Grupo: Ponto da carne
                const grupoPonto = await insertGrupo.run(produtoId, 'Ponto da Carne', 'escolha_unica', 1, 1, 1);
                await insertOpcao.run(grupoPonto.lastInsertRowid, 'Mal passado', 0, 1);
                await insertOpcao.run(grupoPonto.lastInsertRowid, 'Ao ponto', 0, 1);
                await insertOpcao.run(grupoPonto.lastInsertRowid, 'Bem passado', 0, 1);

                // Grupo: Adicionais
                const grupoAdicionais = await insertGrupo.run(produtoId, 'Adicionais', 'escolha_multipla', 0, 0, 3);
                await insertOpcao.run(grupoAdicionais.lastInsertRowid, 'Bacon extra', 4.00, 1);
                await insertOpcao.run(grupoAdicionais.lastInsertRowid, 'Queijo extra', 3.00, 1);
                await insertOpcao.run(grupoAdicionais.lastInsertRowid, 'Ovo', 2.50, 1);
                await insertOpcao.run(grupoAdicionais.lastInsertRowid, 'Cebola caramelizada', 2.00, 1);
                await insertOpcao.run(grupoAdicionais.lastInsertRowid, 'Picles', 1.50, 1);

                // Grupo: Molhos
                const grupoMolhos = await insertGrupo.run(produtoId, 'Molhos', 'escolha_multipla', 0, 0, 2);
                await insertOpcao.run(grupoMolhos.lastInsertRowid, 'Maionese', 0, 1);
                await insertOpcao.run(grupoMolhos.lastInsertRowid, 'Ketchup', 0, 1);
                await insertOpcao.run(grupoMolhos.lastInsertRowid, 'Mostarda', 0, 1);
                await insertOpcao.run(grupoMolhos.lastInsertRowid, 'Barbacue', 0, 1);
                await insertOpcao.run(grupoMolhos.lastInsertRowid, 'Molho da casa', 0, 1);
            }
        }
        console.log('Fictional products inserted successfully!');
    }

    await db.close();
    console.log('Database initialization complete!');
}

initDatabase().catch(console.error);