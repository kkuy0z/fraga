import { run } from './connection.js';

export async function initializeDatabase() {
    // Usuários administrativos
    await run(`
        CREATE TABLE IF NOT EXISTS usuarios_admin (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            senha_hash TEXT NOT NULL,
            nome TEXT NOT NULL,
            perfil TEXT NOT NULL CHECK (perfil IN ('administrador', 'atendente', 'cozinha', 'entregador')),
            ativo INTEGER DEFAULT 1,
            forca_troca_senha INTEGER DEFAULT 0,
            ultimo_login DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Categorias
    await run(`
        CREATE TABLE IF NOT EXISTS categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT UNIQUE NOT NULL,
            descricao TEXT,
            ordem_exibicao INTEGER DEFAULT 0,
            ativo INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Produtos
    await run(`
        CREATE TABLE IF NOT EXISTS produtos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            categoria_id INTEGER NOT NULL,
            nome TEXT NOT NULL,
            descricao TEXT,
            preco_base REAL NOT NULL DEFAULT 0,
            imagem_url TEXT,
            disponivel INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE RESTRICT
        )
    `);

    // Grupos de personalização
    await run(`
        CREATE TABLE IF NOT EXISTS personalizacao_grupos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            produto_id INTEGER NOT NULL,
            nome TEXT NOT NULL,
            tipo TEXT NOT NULL CHECK (tipo IN ('adicional', 'remocao', 'escolha_unica', 'escolha_multipla')),
            obrigatorio INTEGER DEFAULT 0,
            min_selecoes INTEGER DEFAULT 0,
            max_selecoes INTEGER DEFAULT 1,
            ordem_exibicao INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE
        )
    `);

    // Opções de personalização
    await run(`
        CREATE TABLE IF NOT EXISTS personalizacao_opcoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            grupo_id INTEGER NOT NULL,
            nome TEXT NOT NULL,
            preco_adicional REAL DEFAULT 0,
            ativo INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (grupo_id) REFERENCES personalizacao_grupos(id) ON DELETE CASCADE
        )
    `);

    // Horários de funcionamento
    await run(`
        CREATE TABLE IF NOT EXISTS horarios_funcionamento (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
            hora_abertura TEXT NOT NULL,
            hora_fechamento TEXT NOT NULL,
            ativo INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(dia_semana, hora_abertura, hora_fechamento)
        )
    `);

    // Formas de pagamento
    await run(`
        CREATE TABLE IF NOT EXISTS formas_pagamento (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            tipo TEXT NOT NULL CHECK (tipo IN ('pix', 'cartao', 'dinheiro', 'online')),
            configuracao TEXT,
            ativo INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Configuração de entrega
    await run(`
        CREATE TABLE IF NOT EXISTS configuracao_entrega (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            taxa_entrega REAL DEFAULT 0,
            valor_minimo_pedido REAL DEFAULT 0,
            bairro_taxa_extra TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Clientes
    await run(`
        CREATE TABLE IF NOT EXISTS clientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            telefone TEXT NOT NULL,
            senha_hash TEXT NOT NULL,
            ativo INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Endereços do cliente
    await run(`
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
        )
    `);

    // Avaliações de pedidos (RF-17, RF-18)
    await run(`
        CREATE TABLE IF NOT EXISTS avaliacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pedido_id INTEGER NOT NULL UNIQUE,
            cliente_id INTEGER NOT NULL,
            estrelas INTEGER NOT NULL CHECK (estrelas BETWEEN 1 AND 5),
            comentario TEXT,
            respondido INTEGER DEFAULT 0,
            resposta_admin TEXT,
            respondido_em DATETIME,
            respondido_por INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
            FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
            FOREIGN KEY (respondido_por) REFERENCES usuarios_admin(id) ON DELETE SET NULL
        )
    `);

    // Entregas (RF-12)
    await run(`
        CREATE TABLE IF NOT EXISTS entregas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pedido_id INTEGER NOT NULL UNIQUE,
            entregador_id INTEGER,
            status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aceita', 'retirada', 'em_rota', 'entregue', 'falha')),
            saida_em DATETIME,
            entregue_em DATETIME,
            latitude REAL,
            longitude REAL,
            observacoes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
            FOREIGN KEY (entregador_id) REFERENCES usuarios_admin(id) ON DELETE SET NULL
        )
    `);

    // Histórico de status dos pedidos (para auditoria e notificações tempo real)
    await run(`
        CREATE TABLE IF NOT EXISTS pedido_status_historico (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pedido_id INTEGER NOT NULL,
            status_anterior TEXT NOT NULL,
            status_novo TEXT NOT NULL,
            usuario_id INTEGER,
            usuario_nome TEXT,
            motivo TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
            FOREIGN KEY (usuario_id) REFERENCES usuarios_admin(id) ON DELETE SET NULL
        )
    `);

    // Notificações internas (RF-09) - para cozinha/atendimento
    await run(`
        CREATE TABLE IF NOT EXISTS notificacoes_internas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo TEXT NOT NULL CHECK (tipo IN ('novo_pedido', 'pedido_atualizado', 'pedido_cancelado', 'entrega_atribuida', 'avaliacao_nova', 'entrega_localizacao')),
            titulo TEXT NOT NULL,
            mensagem TEXT NOT NULL,
            pedido_id INTEGER,
            destinatario_perfil TEXT CHECK (destinatario_perfil IN ('administrador', 'atendente', 'cozinha', 'entregador', 'todos')),
            destinatario_id INTEGER,
            lida INTEGER DEFAULT 0,
            lida_em DATETIME,
            dados TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
            FOREIGN KEY (destinatario_id) REFERENCES usuarios_admin(id) ON DELETE CASCADE
        )
    `);

    // Pedidos
    await run(`
        CREATE TABLE IF NOT EXISTS pedidos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            numero_pedido TEXT UNIQUE NOT NULL,
            cliente_id INTEGER,
            cliente_nome TEXT NOT NULL,
            cliente_telefone TEXT NOT NULL,
            cliente_email TEXT,
            cep TEXT,
            logradouro TEXT,
            numero_endereco TEXT,
            bairro TEXT,
            complemento TEXT,
            referencia TEXT,
            forma_pagamento_id INTEGER NOT NULL,
            valor_subtotal REAL NOT NULL,
            valor_entrega REAL NOT NULL DEFAULT 0,
            valor_desconto REAL NOT NULL DEFAULT 0,
            valor_total REAL NOT NULL,
            valor_troco REAL,
            observacoes_pagamento TEXT,
            status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmado', 'preparando', 'saiu_entrega', 'entregue', 'cancelado')),
            data_pedido DATETIME DEFAULT CURRENT_TIMESTAMP,
            data_atualizacao DATETIME DEFAULT CURRENT_TIMESTAMP,
            endereco_entrega TEXT,
            FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL,
            FOREIGN KEY (forma_pagamento_id) REFERENCES formas_pagamento(id) ON DELETE RESTRICT
        )
    `);

    // Itens do pedido
    await run(`
        CREATE TABLE IF NOT EXISTS pedido_itens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pedido_id INTEGER NOT NULL,
            produto_id INTEGER NOT NULL,
            quantidade INTEGER NOT NULL DEFAULT 1,
            preco_unitario REAL NOT NULL,
            observacoes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
            FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE RESTRICT
        )
    `);

    // Personalizações dos itens do pedido
    await run(`
        CREATE TABLE IF NOT EXISTS pedido_item_personalizacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pedido_item_id INTEGER NOT NULL,
            grupo_id INTEGER NOT NULL,
            opcao_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (pedido_item_id) REFERENCES pedido_itens(id) ON DELETE CASCADE,
            FOREIGN KEY (grupo_id) REFERENCES personalizacao_grupos(id) ON DELETE RESTRICT,
            FOREIGN KEY (opcao_id) REFERENCES personalizacao_opcoes(id) ON DELETE RESTRICT
        )
    `);

    // Push subscriptions
    await run(`
        CREATE TABLE IF NOT EXISTS push_subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_id INTEGER NOT NULL,
            endpoint TEXT NOT NULL UNIQUE,
            p256dh TEXT NOT NULL,
            auth TEXT NOT NULL,
            user_agent TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
        )
    `);

    // Índices
    const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON produtos(categoria_id)',
        'CREATE INDEX IF NOT EXISTS idx_produtos_disponivel ON produtos(disponivel)',
        'CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status)',
        'CREATE INDEX IF NOT EXISTS idx_pedidos_data ON pedidos(data_pedido)',
        'CREATE INDEX IF NOT EXISTS idx_pedido_itens_pedido ON pedido_itens(pedido_id)',
        'CREATE INDEX IF NOT EXISTS idx_personalizacao_grupos_produto ON personalizacao_grupos(produto_id)',
        'CREATE INDEX IF NOT EXISTS idx_personalizacao_opcoes_grupo ON personalizacao_opcoes(grupo_id)',
        'CREATE INDEX IF NOT EXISTS idx_clientes_email ON clientes(email)',
        'CREATE INDEX IF NOT EXISTS idx_clientes_telefone ON clientes(telefone)',
        'CREATE INDEX IF NOT EXISTS idx_clientes_ativo ON clientes(ativo)',
        'CREATE INDEX IF NOT EXISTS idx_enderecos_cliente ON enderecos_cliente(cliente_id)',
        'CREATE INDEX IF NOT EXISTS idx_avaliacoes_pedido ON avaliacoes(pedido_id)',
        'CREATE INDEX IF NOT EXISTS idx_avaliacoes_cliente ON avaliacoes(cliente_id)',
        'CREATE INDEX IF NOT EXISTS idx_entregas_entregador ON entregas(entregador_id)',
        'CREATE INDEX IF NOT EXISTS idx_entregas_status ON entregas(status)',
        'CREATE INDEX IF NOT EXISTS idx_pedido_status_historico_pedido ON pedido_status_historico(pedido_id)',
        'CREATE INDEX IF NOT EXISTS idx_notificacoes_internas_destinatario ON notificacoes_internas(destinatario_perfil, destinatario_id, lida)',
        'CREATE INDEX IF NOT EXISTS idx_push_subscriptions_cliente ON push_subscriptions(cliente_id)'
    ];

    for (const indexSql of indexes) {
        await run(indexSql);
    }

    // Seed admin user
    const adminExists = await run('SELECT 1 FROM usuarios_admin WHERE email = ?', ['admin@fragalanches.com']);
    if (!adminExists) {
        const argon2 = (await import('argon2')).default;
        const hash = await argon2.hash('admin123', { type: argon2.argon2id });
        await run(
            'INSERT INTO usuarios_admin (email, senha_hash, nome, perfil, forca_troca_senha) VALUES (?, ?, ?, ?, ?)',
            ['admin@fragalanches.com', hash, 'Administrador', 'administrador', 1]
        );
    }

    // Seed delivery config
    const deliveryConfig = await run('SELECT 1 FROM configuracao_entrega WHERE id = 1');
    if (!deliveryConfig) {
        await run(
            'INSERT INTO configuracao_entrega (id, taxa_entrega, valor_minimo_pedido, bairro_taxa_extra) VALUES (1, 5.00, 20.00, "[]")'
        );
    }

    // Seed payment methods
    const paymentMethods = [
        { nome: 'Dinheiro', tipo: 'dinheiro', configuracao: '{}' },
        { nome: 'PIX', tipo: 'pix', configuracao: '{"chave": "pix@fragalanches.com"}' },
        { nome: 'Cartão de Crédito/Débito', tipo: 'cartao', configuracao: '{}' },
        { nome: 'Online (Mercado Pago)', tipo: 'online', configuracao: '{}' }
    ];

    for (const pm of paymentMethods) {
        const exists = await run('SELECT 1 FROM formas_pagamento WHERE nome = ?', [pm.nome]);
        if (!exists) {
            await run(
                'INSERT INTO formas_pagamento (nome, tipo, configuracao, ativo) VALUES (?, ?, ?, 1)',
                [pm.nome, pm.tipo, pm.configuracao]
            );
        }
    }

    // Seed business hours (Seg-Sáb 18:00-23:30, Dom fechado)
    for (let dia = 1; dia <= 6; dia++) {
        const exists = await run('SELECT 1 FROM horarios_funcionamento WHERE dia_semana = ?', [dia]);
        if (!exists) {
            await run(
                'INSERT INTO horarios_funcionamento (dia_semana, hora_abertura, hora_fechamento, ativo) VALUES (?, ?, ?, 1)',
                [dia, '18:00', '23:30']
            );
        }
    }

    console.log('✅ Database initialized successfully');
}

initializeDatabase().catch(console.error);