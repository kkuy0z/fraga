-- Fraga Lanches Database Schema
-- MySQL 8.0+

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =============================================
-- USERS & AUTHENTICATION
-- =============================================

CREATE TABLE IF NOT EXISTS `perfis` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(50) NOT NULL COMMENT 'Nome do perfil: administrador, atendente, cozinha, entregador, cliente',
    `descricao` VARCHAR(255) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_perfis_nome` (`nome`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Perfis de usuários';

CREATE TABLE IF NOT EXISTS `usuarios` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `perfil_id` INT UNSIGNED NOT NULL,
    `nome` VARCHAR(100) NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    `telefone` VARCHAR(20) NULL,
    `senha_hash` VARCHAR(255) NOT NULL COMMENT 'Hash Argon2id',
    `ativo` BOOLEAN NOT NULL DEFAULT TRUE,
    `ultimo_login` TIMESTAMP NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_usuarios_email` (`email`),
    KEY `idx_usuarios_perfil` (`perfil_id`),
    KEY `idx_usuarios_ativo` (`ativo`),
    CONSTRAINT `fk_usuarios_perfil` FOREIGN KEY (`perfil_id`) REFERENCES `perfis` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Usuários do sistema (clientes e equipe)';

CREATE TABLE IF NOT EXISTS `enderecos` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `usuario_id` INT UNSIGNED NOT NULL,
    `cep` VARCHAR(9) NOT NULL,
    `logradouro` VARCHAR(200) NOT NULL,
    `numero` VARCHAR(20) NOT NULL,
    `complemento` VARCHAR(100) NULL,
    `bairro` VARCHAR(100) NOT NULL,
    `cidade` VARCHAR(100) NOT NULL DEFAULT 'Sua Cidade',
    `estado` CHAR(2) NOT NULL DEFAULT 'SP',
    `referencia` VARCHAR(255) NULL COMMENT 'Ponto de referência para entrega',
    `principal` BOOLEAN NOT NULL DEFAULT FALSE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_enderecos_usuario` (`usuario_id`),
    CONSTRAINT `fk_enderecos_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Endereços dos clientes';

-- =============================================
-- CATALOG (Categories, Products, Options)
-- =============================================

CREATE TABLE IF NOT EXISTS `categorias` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(100) NOT NULL,
    `descricao` TEXT NULL,
    `imagem_url` VARCHAR(500) NULL,
    `ordem` INT NOT NULL DEFAULT 0,
    `ativo` BOOLEAN NOT NULL DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_categorias_nome` (`nome`),
    KEY `idx_categorias_ativo_ordem` (`ativo`, `ordem`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Categorias de produtos';

CREATE TABLE IF NOT EXISTS `produtos` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `categoria_id` INT UNSIGNED NOT NULL,
    `nome` VARCHAR(150) NOT NULL,
    `descricao` TEXT NULL,
    `imagem_url` VARCHAR(500) NULL,
    `preco` DECIMAL(10,2) NOT NULL,
    `disponivel` BOOLEAN NOT NULL DEFAULT TRUE,
    `destaque` BOOLEAN NOT NULL DEFAULT FALSE,
    `ordem` INT NOT NULL DEFAULT 0,
    `tempo_preparo_min` INT NULL COMMENT 'Tempo estimado de preparo em minutos',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_produtos_categoria` (`categoria_id`),
    KEY `idx_produtos_disponivel` (`disponivel`),
    KEY `idx_produtos_destaque` (`destaque`),
    CONSTRAINT `fk_produtos_categoria` FOREIGN KEY (`categoria_id`) REFERENCES `categorias` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Produtos do cardápio';

CREATE TABLE IF NOT EXISTS `opcoes_personalizacao` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `produto_id` INT UNSIGNED NOT NULL,
    `nome` VARCHAR(100) NOT NULL COMMENT 'Ex: Adicionais, Ponto da carne, Acompanhamentos',
    `tipo` ENUM('adicional', 'remocao', 'escolha_unica', 'escolha_multipla') NOT NULL,
    `obrigatorio` BOOLEAN NOT NULL DEFAULT FALSE,
    `min_selecoes` INT NOT NULL DEFAULT 0,
    `max_selecoes` INT NULL COMMENT 'NULL = ilimitado para multipla',
    `ordem` INT NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_opcoes_produto` (`produto_id`),
    CONSTRAINT `fk_opcoes_produto` FOREIGN KEY (`produto_id`) REFERENCES `produtos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Opções de personalização por produto';

CREATE TABLE IF NOT EXISTS `itens_opcao` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `opcao_id` INT UNSIGNED NOT NULL,
    `nome` VARCHAR(100) NOT NULL,
    `preco_adicional` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `ativo` BOOLEAN NOT NULL DEFAULT TRUE,
    `ordem` INT NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_itens_opcao` (`opcao_id`),
    CONSTRAINT `fk_itens_opcao` FOREIGN KEY (`opcao_id`) REFERENCES `opcoes_personalizacao` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Itens de cada opção de personalização';

-- =============================================
-- HORÁRIOS DE FUNCIONAMENTO
-- =============================================

CREATE TABLE IF NOT EXISTS `horarios_funcionamento` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `dia_semana` TINYINT UNSIGNED NOT NULL COMMENT '0=Domingo, 1=Segunda, ..., 6=Sábado',
    `abre_as` TIME NOT NULL,
    `fecha_as` TIME NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_horarios_dia` (`dia_semana`),
    KEY `idx_horarios_ativo` (`ativo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Horários de funcionamento por dia da semana';

CREATE TABLE IF NOT EXISTS `configuracoes` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `chave` VARCHAR(100) NOT NULL,
    `valor` TEXT NOT NULL,
    `descricao` VARCHAR(255) NULL,
    `tipo` ENUM('string', 'integer', 'decimal', 'boolean', 'json') NOT NULL DEFAULT 'string',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_config_chave` (`chave`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Configurações gerais do sistema';

-- =============================================
-- TAXAS DE ENTREGA
-- =============================================

CREATE TABLE IF NOT EXISTS `taxas_entrega` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(100) NOT NULL COMMENT 'Ex: Centro, Bairro X, Zona Norte',
    `bairros` JSON NOT NULL COMMENT 'Lista de bairros atendidos por esta taxa',
    `valor` DECIMAL(10,2) NOT NULL,
    `tempo_estimado_min` INT NULL COMMENT 'Tempo estimado de entrega em minutos',
    `ativo` BOOLEAN NOT NULL DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_taxas_ativo` (`ativo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Taxas de entrega por região/bairro';

-- =============================================
-- PEDIDOS
-- =============================================

CREATE TABLE IF NOT EXISTS `pedidos` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `numero` VARCHAR(20) NOT NULL COMMENT 'Número legível do pedido (ex: PD-2026-000001)',
    `cliente_id` INT UNSIGNED NOT NULL,
    `endereco_id` INT UNSIGNED NULL,
    `status` ENUM('novo', 'em_preparo', 'pronto', 'saiu_entrega', 'concluido', 'cancelado') NOT NULL DEFAULT 'novo',
    `subtotal` DECIMAL(10,2) NOT NULL,
    `taxa_entrega` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `desconto` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `total` DECIMAL(10,2) NOT NULL,
    `forma_pagamento` ENUM('pix', 'cartao', 'dinheiro', 'online') NOT NULL,
    `troco_para` DECIMAL(10,2) NULL COMMENT 'Para pagamento em dinheiro',
    `observacoes` TEXT NULL,
    `horario_entrega` TIMESTAMP NULL COMMENT 'Agendamento opcional',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `confirmado_at` TIMESTAMP NULL,
    `concluido_at` TIMESTAMP NULL,
    `cancelado_at` TIMESTAMP NULL,
    `motivo_cancelamento` VARCHAR(255) NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_pedidos_numero` (`numero`),
    KEY `idx_pedidos_cliente` (`cliente_id`),
    KEY `idx_pedidos_status` (`status`),
    KEY `idx_pedidos_created` (`created_at`),
    CONSTRAINT `fk_pedidos_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_pedidos_endereco` FOREIGN KEY (`endereco_id`) REFERENCES `enderecos` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Pedidos realizados';

CREATE TABLE IF NOT EXISTS `itens_pedido` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `pedido_id` INT UNSIGNED NOT NULL,
    `produto_id` INT UNSIGNED NOT NULL,
    `quantidade` INT UNSIGNED NOT NULL DEFAULT 1,
    `preco_unitario` DECIMAL(10,2) NOT NULL COMMENT 'Preço no momento do pedido',
    `personalizacoes` JSON NOT NULL COMMENT 'Opções selecionadas com preços',
    `observacoes` TEXT NULL,
    `subtotal` DECIMAL(10,2) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_itens_pedido` (`pedido_id`),
    KEY `idx_itens_produto` (`produto_id`),
    CONSTRAINT `fk_itens_pedido` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_itens_produto` FOREIGN KEY (`produto_id`) REFERENCES `produtos` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Itens de cada pedido';

CREATE TABLE IF NOT EXISTS `historico_status_pedido` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `pedido_id` INT UNSIGNED NOT NULL,
    `status_anterior` ENUM('novo', 'em_preparo', 'pronto', 'saiu_entrega', 'concluido', 'cancelado') NULL,
    `status_novo` ENUM('novo', 'em_preparo', 'pronto', 'saiu_entrega', 'concluido', 'cancelado') NOT NULL,
    `usuario_id` INT UNSIGNED NULL COMMENT 'Quem fez a alteração (interno)',
    `observacao` VARCHAR(255) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_historico_pedido` (`pedido_id`),
    KEY `idx_historico_created` (`created_at`),
    CONSTRAINT `fk_historico_pedido` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_historico_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Histórico de alterações de status dos pedidos';

-- =============================================
-- ENTREGAS
-- =============================================

CREATE TABLE IF NOT EXISTS `entregas` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `pedido_id` INT UNSIGNED NOT NULL,
    `entregador_id` INT UNSIGNED NULL,
    `status` ENUM('pendente', 'atribuida', 'retirada', 'em_rota', 'entregue', 'falhou') NOT NULL DEFAULT 'pendente',
    `saida_em` TIMESTAMP NULL,
    `entregue_em` TIMESTAMP NULL,
    `observacoes` TEXT NULL,
    `comprovante_url` VARCHAR(500) NULL COMMENT 'Foto/assinatura de entrega',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_entregas_pedido` (`pedido_id`),
    KEY `idx_entregas_entregador` (`entregador_id`),
    KEY `idx_entregas_status` (`status`),
    CONSTRAINT `fk_entregas_pedido` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_entregas_entregador` FOREIGN KEY (`entregador_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Entregas dos pedidos';

-- =============================================
-- PAGAMENTOS
-- =============================================

CREATE TABLE IF NOT EXISTS `pagamentos` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `pedido_id` INT UNSIGNED NOT NULL,
    `gateway` VARCHAR(50) NOT NULL COMMENT 'mercado_pago, pagarme, asaas, manual',
    `gateway_transaction_id` VARCHAR(100) NULL,
    `forma` ENUM('pix', 'cartao_credito', 'cartao_debito', 'dinheiro', 'boleto') NOT NULL,
    `valor` DECIMAL(10,2) NOT NULL,
    `status` ENUM('pendente', 'aprovado', 'recusado', 'cancelado', 'estornado', 'aguardando') NOT NULL DEFAULT 'pendente',
    `dados_gateway` JSON NULL COMMENT 'Dados brutos do webhook',
    `pago_em` TIMESTAMP NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_pagamentos_pedido` (`pedido_id`),
    KEY `idx_pagamentos_status` (`status`),
    KEY `idx_pagamentos_gateway_tid` (`gateway_transaction_id`),
    CONSTRAINT `fk_pagamentos_pedido` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Pagamentos dos pedidos';

-- =============================================
-- AVALIAÇÕES
-- =============================================

CREATE TABLE IF NOT EXISTS `avaliacoes` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `pedido_id` INT UNSIGNED NOT NULL,
    `cliente_id` INT UNSIGNED NOT NULL,
    `nota` TINYINT UNSIGNED NOT NULL COMMENT '1 a 5 estrelas',
    `comentario` TEXT NULL,
    `respondida` BOOLEAN NOT NULL DEFAULT FALSE,
    `resposta_admin` TEXT NULL,
    `respondida_em` TIMESTAMP NULL,
    `respondida_por` INT UNSIGNED NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_avaliacoes_pedido` (`pedido_id`),
    KEY `idx_avaliacoes_cliente` (`cliente_id`),
    KEY `idx_avaliacoes_nota` (`nota`),
    CONSTRAINT `fk_avaliacoes_pedido` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_avaliacoes_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_avaliacoes_responsavel` FOREIGN KEY (`respondida_por`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL,
    CONSTRAINT `ck_avaliacoes_nota` CHECK (`nota` BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Avaliações dos pedidos pelos clientes';

-- =============================================
-- NOTIFICAÇÕES
-- =============================================

CREATE TABLE IF NOT EXISTS `notificacoes` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `usuario_id` INT UNSIGNED NOT NULL,
    `tipo` ENUM('status_pedido', 'promocao', 'sistema', 'pagamento', 'entrega') NOT NULL,
    `titulo` VARCHAR(150) NOT NULL,
    `mensagem` TEXT NOT NULL,
    `dados` JSON NULL COMMENT 'Dados extras: pedido_id, url, etc',
    `lida` BOOLEAN NOT NULL DEFAULT FALSE,
    `enviada_push` BOOLEAN NOT NULL DEFAULT FALSE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_notificacoes_usuario` (`usuario_id`),
    KEY `idx_notificacoes_lida` (`lida`),
    KEY `idx_notificacoes_created` (`created_at`),
    CONSTRAINT `fk_notificacoes_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Notificações in-app';

CREATE TABLE IF NOT EXISTS `push_subscriptions` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `usuario_id` INT UNSIGNED NOT NULL,
    `endpoint` TEXT NOT NULL,
    `p256dh` VARCHAR(100) NOT NULL,
    `auth` VARCHAR(50) NOT NULL,
    `user_agent` VARCHAR(500) NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_push_subscription` (`usuario_id`, `endpoint`(255)),
    KEY `idx_push_usuario` (`usuario_id`),
    CONSTRAINT `fk_push_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Subscriptions Web Push para PWA';

-- =============================================
-- DADOS INICIAIS
-- =============================================

INSERT IGNORE INTO `perfis` (`id`, `nome`, `descricao`) VALUES
(1, 'administrador', 'Acesso total ao sistema: gerencia usuários, produtos, configurações, relatórios'),
(2, 'atendente', 'Gerencia pedidos, atendimento ao cliente, status de entrega'),
(3, 'cozinha', 'Visualiza e atualiza status de preparo dos pedidos'),
(4, 'entregador', 'Visualiza entregas atribuídas e atualiza status de entrega'),
(5, 'cliente', 'Consulta cardápio, faz pedidos, acompanha status, avalia');

INSERT IGNORE INTO `configuracoes` (`chave`, `valor`, `descricao`, `tipo`) VALUES
('estabelecimento_nome', 'Fraga Lanches', 'Nome do estabelecimento', 'string'),
('estabelecimento_telefone', '(11) 99999-9999', 'Telefone de contato', 'string'),
('estabelecimento_endereco', 'Rua Exemplo, 123 - Centro', 'Endereço do estabelecimento', 'string'),
('pedido_minimo_valor', '0.00', 'Valor mínimo para pedido', 'decimal'),
('taxa_servico_percentual', '0', 'Percentual de taxa de serviço', 'decimal'),
('tempo_medio_preparo', '30', 'Tempo médio de preparo (minutos)', 'integer'),
('tempo_medio_entrega', '40', 'Tempo médio de entrega (minutos)', 'integer'),
('pix_chave', '', 'Chave Pix para recebimentos', 'string'),
('pix_nome_recebedor', 'Fraga Lanches', 'Nome do recebedor Pix', 'string'),
('pix_cidade', 'Sao Paulo', 'Cidade para Pix', 'string');

-- Inserir horários padrão (aberto todos os dias 18h-23h)
INSERT IGNORE INTO `horarios_funcionamento` (`dia_semana`, `abre_as`, `fecha_as`, `ativo`) VALUES
(0, '18:00:00', '23:00:00', TRUE),  -- Domingo
(1, '18:00:00', '23:00:00', TRUE),  -- Segunda
(2, '18:00:00', '23:00:00', TRUE),  -- Terça
(3, '18:00:00', '23:00:00', TRUE),  -- Quarta
(4, '18:00:00', '23:00:00', TRUE),  -- Quinta
(5, '18:00:00', '23:00:00', TRUE),  -- Sexta
(6, '18:00:00', '23:00:00', TRUE);  -- Sábado

-- Categorias padrão
INSERT IGNORE INTO `categorias` (`id`, `nome`, `descricao`, `ordem`, `ativo`) VALUES
(1, 'Hambúrgueres', 'Hambúrgueres artesanais', 1, TRUE),
(2, 'Marmitas', 'Marmitas completas', 2, TRUE),
(3, 'Porções', 'Porções para compartilhar', 3, TRUE),
(4, 'Bebidas', 'Refrigerantes, sucos, cervejas', 4, TRUE),
(5, 'Sobremesas', 'Doces e sobremesas', 5, TRUE);

SET FOREIGN_KEY_CHECKS = 1;