// Tipos compartilhados (documentação JSDoc para IDE)

// ============================================
// TIPOS DE USUÁRIO/ADMIN
// ============================================

/**
 * @typedef {Object} UsuarioAdmin
 * @property {number} id
 * @property {string} email
 * @property {string} senha_hash
 * @property {string} nome
 * @property {'administrador'|'atendente'|'cozinha'|'entregador'} perfil
 * @property {number} ativo
 * @property {number} forca_troca_senha
 * @property {string|null} ultimo_login
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} JWTPayload
 * @property {number} id
 * @property {string} email
 * @property {string} nome
 * @property {'administrador'|'atendente'|'cozinha'|'entregador'} perfil
 * @property {number} iat
 * @property {number} exp
 */

// ============================================
// TIPOS DE CLIENTE
// ============================================

/**
 * @typedef {Object} Cliente
 * @property {number} id
 * @property {string} nome
 * @property {string} email
 * @property {string} telefone
 * @property {string} senha_hash
 * @property {number} ativo
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} EnderecoCliente
 * @property {number} id
 * @property {number} cliente_id
 * @property {string} cep
 * @property {string} logradouro
 * @property {string} numero
 * @property {string} bairro
 * @property {string|null} complemento
 * @property {number} principal
 * @property {string} created_at
 * @property {string} updated_at
 */

// ============================================
// TIPOS DE CARDÁPIO
// ============================================

/**
 * @typedef {Object} Categoria
 * @property {number} id
 * @property {string} nome
 * @property {string|null} descricao
 * @property {number} ordem_exibicao
 * @property {number} ativo
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} Produto
 * @property {number} id
 * @property {number} categoria_id
 * @property {string} nome
 * @property {string|null} descricao
 * @property {number} preco_base
 * @property {string|null} imagem_url
 * @property {number} disponivel
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} PersonalizacaoGrupo
 * @property {number} id
 * @property {number} produto_id
 * @property {string} nome
 * @property {'adicional'|'remocao'|'escolha_unica'|'escolha_multipla'} tipo
 * @property {number} obrigatorio
 * @property {number} min_selecoes
 * @property {number} max_selecoes
 * @property {number} ordem_exibicao
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} PersonalizacaoOpcao
 * @property {number} id
 * @property {number} grupo_id
 * @property {string} nome
 * @property {number} preco_adicional
 * @property {number} ativo
 * @property {string} created_at
 * @property {string} updated_at
 */

// ============================================
// TIPOS DE PEDIDO
// ============================================

/**
 * @typedef {Object} Pedido
 * @property {number} id
 * @property {string} numero_pedido
 * @property {number|null} cliente_id
 * @property {string} cliente_nome
 * @property {string} cliente_telefone
 * @property {string|null} cliente_email
 * @property {string|null} cep
 * @property {string|null} logradouro
 * @property {string|null} numero_endereco
 * @property {string|null} bairro
 * @property {string|null} complemento
 * @property {string|null} referencia
 * @property {number} forma_pagamento_id
 * @property {number} valor_subtotal
 * @property {number} valor_entrega
 * @property {number} valor_desconto
 * @property {number} valor_total
 * @property {number|null} valor_troco
 * @property {string|null} observacoes_pagamento
 * @property {'pendente'|'confirmado'|'preparando'|'saiu_entrega'|'entregue'|'cancelado'} status
 * @property {string} data_pedido
 * @property {string} data_atualizacao
 * @property {string|null} endereco_entrega
 */

/**
 * @typedef {Object} PedidoItem
 * @property {number} id
 * @property {number} pedido_id
 * @property {number} produto_id
 * @property {number} quantidade
 * @property {number} preco_unitario
 * @property {string|null} observacoes
 * @property {string} created_at
 */

/**
 * @typedef {Object} PedidoItemPersonalizacao
 * @property {number} id
 * @property {number} pedido_item_id
 * @property {number} grupo_id
 * @property {number} opcao_id
 * @property {string} created_at
 */

// ============================================
// TIPOS DE ENTREGA
// ============================================

/**
 * @typedef {Object} Entrega
 * @property {number} id
 * @property {number} pedido_id
 * @property {number|null} entregador_id
 * @property {'pendente'|'aceita'|'retirada'|'em_rota'|'entregue'|'falha'} status
 * @property {string|null} saida_em
 * @property {string|null} entregue_em
 * @property {number|null} latitude
 * @property {number|null} longitude
 * @property {string|null} observacoes
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} PedidoStatusHistorico
 * @property {number} id
 * @property {number} pedido_id
 * @property {string} status_anterior
 * @property {string} status_novo
 * @property {number|null} usuario_id
 * @property {string|null} usuario_nome
 * @property {string|null} motivo
 * @property {string} created_at
 */

// ============================================
// TIPOS DE AVALIAÇÃO
// ============================================

/**
 * @typedef {Object} Avaliacao
 * @property {number} id
 * @property {number} pedido_id
 * @property {number} cliente_id
 * @property {number} estrelas
 * @property {string|null} comentario
 * @property {number} respondido
 * @property {string|null} resposta_admin
 * @property {string|null} respondido_em
 * @property {number|null} respondido_por
 * @property {string} created_at
 * @property {string} updated_at
 */

// ============================================
// TIPOS DE NOTIFICAÇÃO
// ============================================

/**
 * @typedef {Object} NotificacaoInterna
 * @property {number} id
 * @property {'novo_pedido'|'pedido_atualizado'|'pedido_cancelado'|'entrega_atribuida'|'avaliacao_nova'|'entrega_localizacao'} tipo
 * @property {string} titulo
 * @property {string} mensagem
 * @property {number|null} pedido_id
 * @property {'administrador'|'atendente'|'cozinha'|'entregador'|'todos'|null} destinatario_perfil
 * @property {number|null} destinatario_id
 * @property {number} lida
 * @property {string|null} lida_em
 * @property {string|null} dados
 * @property {string} created_at
 */

/**
 * @typedef {Object} PushSubscription
 * @property {number} id
 * @property {number} cliente_id
 * @property {string} endpoint
 * @property {string} p256dh
 * @property {string} auth
 * @property {string|null} user_agent
 * @property {string} created_at
 * @property {string} updated_at
 */

// ============================================
// TIPOS DE CONFIGURAÇÃO
// ============================================

/**
 * @typedef {Object} HorarioFuncionamento
 * @property {number} id
 * @property {number} dia_semana
 * @property {string} hora_abertura
 * @property {string} hora_fechamento
 * @property {number} ativo
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} FormaPagamento
 * @property {number} id
 * @property {string} nome
 * @property {'pix'|'cartao'|'dinheiro'|'online'} tipo
 * @property {string|null} configuracao
 * @property {number} ativo
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} ConfiguracaoEntrega
 * @property {number} id
 * @property {number} taxa_entrega
 * @property {number} valor_minimo_pedido
 * @property {string|null} bairro_taxa_extra
 * @property {string} updated_at
 */

// ============================================
// TIPOS DE RELATÓRIO
// ============================================

/**
 * @typedef {Object} RelatorioVendas
 * @property {string} periodo
 * @property {number} total_pedidos
 * @property {number} valor_total
 * @property {number} ticket_medio
 * @property {Array<{periodo: string, total: number, valor: number}>} series
 */

/**
 * @typedef {Object} RelatorioProdutos
 * @property {number} produto_id
 * @property {string} produto_nome
 * @property {string} categoria_nome
 * @property {number} quantidade_vendida
 * @property {number} valor_total
 * @property {number} media_avaliacao
 */

/**
 * @typedef {Object} RelatorioPico
 * @property {number} hora
 * @property {number} total_pedidos
 * @property {number} media_valor
 */

/**
 * @typedef {Object} RelatorioEntregas
 * @property {number} entregador_id
 * @property {string} entregador_nome
 * @property {number} total_entregas
 * @property {number} entregas_no_prazo
 * @property {number} tempo_medio_minutos
 */

/**
 * @typedef {Object} RelatorioClientes
 * @property {number} cliente_id
 * @property {string} cliente_nome
 * @property {string} cliente_email
 * @property {number} total_pedidos
 * @property {number} valor_total
 * @property {string} ultimo_pedido
 */

/**
 * @typedef {Object} RelatorioDashboard
 * @property {number} pedidos_hoje
 * @property {number} valor_hoje
 * @property {number} pedidos_pendentes
 * @property {number} pedidos_preparando
 * @property {number} pedidos_entrega
 * @property {number} avaliacao_media
 * @property {Array<{hora: number, pedidos: number}>} pico_horario
 */

export {};