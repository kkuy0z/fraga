import { body, param, query, validationResult } from 'express-validator';

// Middleware para lidar com erros de validação
export function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Dados inválidos',
            details: errors.array().map(e => ({ field: e.path, message: e.msg }))
        });
    }
    next();
}

// Validadores de autenticação
export const authValidators = {
    login: [
        body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
        body('senha').isLength({ min: 1 }).withMessage('Senha é obrigatória'),
        handleValidationErrors
    ],
    register: [
        body('nome').trim().isLength({ min: 2, max: 100 }).withMessage('Nome deve ter entre 2 e 100 caracteres'),
        body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
        body('telefone').matches(/^\(\d{2}\)\s\d{4,5}-\d{4}$/).withMessage('Telefone deve estar no formato (XX) XXXXX-XXXX'),
        body('senha').isLength({ min: 8 }).withMessage('Senha deve ter no mínimo 8 caracteres')
            .matches(/[A-Z]/).withMessage('Senha deve conter pelo menos uma letra maiúscula')
            .matches(/[a-z]/).withMessage('Senha deve conter pelo menos uma letra minúscula')
            .matches(/[0-9]/).withMessage('Senha deve conter pelo menos um número')
            .matches(/[^A-Za-z0-9]/).withMessage('Senha deve conter pelo menos um caractere especial'),
        handleValidationErrors
    ],
    changePassword: [
        body('senhaAtual').notEmpty().withMessage('Senha atual é obrigatória'),
        body('novaSenha').isLength({ min: 8 }).withMessage('Nova senha deve ter no mínimo 8 caracteres')
            .matches(/[A-Z]/).withMessage('Nova senha deve conter pelo menos uma letra maiúscula')
            .matches(/[a-z]/).withMessage('Nova senha deve conter pelo menos uma letra minúscula')
            .matches(/[0-9]/).withMessage('Nova senha deve conter pelo menos um número')
            .matches(/[^A-Za-z0-9]/).withMessage('Nova senha deve conter pelo menos um caractere especial'),
        handleValidationErrors
    ]
};

// Validadores de cliente
export const clienteValidators = {
    create: [
        body('nome').trim().isLength({ min: 2, max: 100 }).withMessage('Nome deve ter entre 2 e 100 caracteres'),
        body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
        body('telefone').matches(/^\(\d{2}\)\s\d{4,5}-\d{4}$/).withMessage('Telefone deve estar no formato (XX) XXXXX-XXXX'),
        body('senha').isLength({ min: 8 }).withMessage('Senha deve ter no mínimo 8 caracteres'),
        handleValidationErrors
    ],
    update: [
        body('nome').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Nome deve ter entre 2 e 100 caracteres'),
        body('telefone').optional().matches(/^\(\d{2}\)\s\d{4,5}-\d{4}$/).withMessage('Telefone deve estar no formato (XX) XXXXX-XXXX'),
        handleValidationErrors
    ],
    endereco: [
        body('cep').matches(/^\d{5}-?\d{3}$/).withMessage('CEP inválido'),
        body('logradouro').trim().notEmpty().withMessage('Logradouro é obrigatório'),
        body('numero').trim().notEmpty().withMessage('Número é obrigatório'),
        body('bairro').trim().notEmpty().withMessage('Bairro é obrigatório'),
        body('complemento').optional().trim(),
        body('principal').optional().isBoolean().withMessage('Principal deve ser booleano'),
        handleValidationErrors
    ]
};

// Validadores de categoria
export const categoriaValidators = {
    create: [
        body('nome').trim().isLength({ min: 2, max: 50 }).withMessage('Nome deve ter entre 2 e 50 caracteres'),
        body('descricao').optional().trim().isLength({ max: 255 }).withMessage('Descrição muito longa'),
        body('ordem_exibicao').optional().isInt({ min: 0 }).withMessage('Ordem deve ser um número inteiro positivo'),
        handleValidationErrors
    ],
    update: [
        body('nome').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Nome deve ter entre 2 e 50 caracteres'),
        body('descricao').optional().trim().isLength({ max: 255 }).withMessage('Descrição muito longa'),
        body('ordem_exibicao').optional().isInt({ min: 0 }).withMessage('Ordem deve ser um número inteiro positivo'),
        body('ativo').optional().isBoolean().withMessage('Ativo deve ser booleano'),
        handleValidationErrors
    ]
};

// Validadores de produto
export const produtoValidators = {
    create: [
        body('categoria_id').isInt({ min: 1 }).withMessage('Categoria inválida'),
        body('nome').trim().isLength({ min: 2, max: 100 }).withMessage('Nome deve ter entre 2 e 100 caracteres'),
        body('descricao').optional().trim().isLength({ max: 500 }).withMessage('Descrição muito longa'),
        body('preco_base').isFloat({ min: 0 }).withMessage('Preço base deve ser um número positivo'),
        body('imagem_url').optional().isURL().withMessage('URL da imagem inválida'),
        body('disponivel').optional().isBoolean().withMessage('Disponível deve ser booleano'),
        handleValidationErrors
    ],
    update: [
        body('categoria_id').optional().isInt({ min: 1 }).withMessage('Categoria inválida'),
        body('nome').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Nome deve ter entre 2 e 100 caracteres'),
        body('descricao').optional().trim().isLength({ max: 500 }).withMessage('Descrição muito longa'),
        body('preco_base').optional().isFloat({ min: 0 }).withMessage('Preço base deve ser um número positivo'),
        body('imagem_url').optional().isURL().withMessage('URL da imagem inválida'),
        body('disponivel').optional().isBoolean().withMessage('Disponível deve ser booleano'),
        handleValidationErrors
    ]
};

// Validadores de personalização
export const personalizacaoValidators = {
    grupoCreate: [
        body('produto_id').isInt({ min: 1 }).withMessage('Produto inválido'),
        body('nome').trim().isLength({ min: 2, max: 50 }).withMessage('Nome deve ter entre 2 e 50 caracteres'),
        body('tipo').isIn(['adicional', 'remocao', 'escolha_unica', 'escolha_multipla']).withMessage('Tipo inválido'),
        body('obrigatorio').optional().isBoolean().withMessage('Obrigatório deve ser booleano'),
        body('min_selecoes').optional().isInt({ min: 0 }).withMessage('Mínimo de seleções deve ser inteiro positivo'),
        body('max_selecoes').optional().isInt({ min: 1 }).withMessage('Máximo de seleções deve ser inteiro positivo'),
        body('ordem_exibicao').optional().isInt({ min: 0 }).withMessage('Ordem deve ser inteiro positivo'),
        handleValidationErrors
    ],
    opcaoCreate: [
        body('grupo_id').isInt({ min: 1 }).withMessage('Grupo inválido'),
        body('nome').trim().isLength({ min: 2, max: 50 }).withMessage('Nome deve ter entre 2 e 50 caracteres'),
        body('preco_adicional').optional().isFloat({ min: 0 }).withMessage('Preço adicional deve ser positivo'),
        handleValidationErrors
    ]
};

// Validadores de horário
export const horarioValidators = {
    create: [
        body('dia_semana').isInt({ min: 0, max: 6 }).withMessage('Dia da semana deve ser entre 0 e 6'),
        body('hora_abertura').matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('Hora de abertura inválida (HH:MM)'),
        body('hora_fechamento').matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('Hora de fechamento inválida (HH:MM)'),
        body('ativo').optional().isBoolean().withMessage('Ativo deve ser booleano'),
        handleValidationErrors
    ],
    update: [
        body('hora_abertura').optional().matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('Hora de abertura inválida (HH:MM)'),
        body('hora_fechamento').optional().matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('Hora de fechamento inválida (HH:MM)'),
        body('ativo').optional().isBoolean().withMessage('Ativo deve ser booleano'),
        handleValidationErrors
    ]
};

// Validadores de pedido
export const pedidoValidators = {
    create: [
        body('cliente_id').optional().isInt({ min: 1 }).withMessage('Cliente inválido'),
        body('cliente_nome').trim().isLength({ min: 2, max: 100 }).withMessage('Nome do cliente obrigatório'),
        body('cliente_telefone').matches(/^\(\d{2}\)\s\d{4,5}-\d{4}$/).withMessage('Telefone inválido'),
        body('cliente_email').optional().isEmail().normalizeEmail().withMessage('Email inválido'),
        body('cep').optional().matches(/^\d{5}-?\d{3}$/).withMessage('CEP inválido'),
        body('logradouro').optional().trim().notEmpty().withMessage('Logradouro obrigatório se informar endereço'),
        body('numero_endereco').optional().trim().notEmpty().withMessage('Número obrigatório se informar endereço'),
        body('bairro').optional().trim().notEmpty().withMessage('Bairro obrigatório se informar endereço'),
        body('forma_pagamento_id').isInt({ min: 1 }).withMessage('Forma de pagamento inválida'),
        body('valor_subtotal').isFloat({ min: 0 }).withMessage('Subtotal inválido'),
        body('valor_entrega').optional().isFloat({ min: 0 }).withMessage('Valor de entrega inválido'),
        body('valor_desconto').optional().isFloat({ min: 0 }).withMessage('Desconto inválido'),
        body('valor_total').isFloat({ min: 0 }).withMessage('Total inválido'),
        body('itens').isArray({ min: 1 }).withMessage('Pelo menos um item é obrigatório'),
        body('itens.*.produto_id').isInt({ min: 1 }).withMessage('Produto inválido'),
        body('itens.*.quantidade').isInt({ min: 1 }).withMessage('Quantidade inválida'),
        body('itens.*.preco_unitario').isFloat({ min: 0 }).withMessage('Preço unitário inválido'),
        body('itens.*.observacoes').optional().trim(),
        body('itens.*.personalizacoes').optional().isArray(),
        handleValidationErrors
    ],
    updateStatus: [
        body('status').isIn(['pendente', 'confirmado', 'preparando', 'saiu_entrega', 'entregue', 'cancelado']).withMessage('Status inválido'),
        body('motivo').optional().trim().isLength({ max: 255 }).withMessage('Motivo muito longo'),
        handleValidationErrors
    ]
};

// Validadores de forma de pagamento
export const formaPagamentoValidators = {
    create: [
        body('nome').trim().isLength({ min: 2, max: 50 }).withMessage('Nome deve ter entre 2 e 50 caracteres'),
        body('tipo').isIn(['pix', 'cartao', 'dinheiro', 'online']).withMessage('Tipo inválido'),
        body('configuracao').optional().isObject().withMessage('Configuração deve ser objeto'),
        handleValidationErrors
    ],
    update: [
        body('nome').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Nome deve ter entre 2 e 50 caracteres'),
        body('tipo').optional().isIn(['pix', 'cartao', 'dinheiro', 'online']).withMessage('Tipo inválido'),
        body('configuracao').optional().isObject().withMessage('Configuração deve ser objeto'),
        body('ativo').optional().isBoolean().withMessage('Ativo deve ser booleano'),
        handleValidationErrors
    ]
};

// Validadores de configuração de entrega
export const entregaConfigValidators = {
    update: [
        body('taxa_entrega').optional().isFloat({ min: 0 }).withMessage('Taxa de entrega deve ser positiva'),
        body('valor_minimo_pedido').optional().isFloat({ min: 0 }).withMessage('Valor mínimo deve ser positivo'),
        body('bairro_taxa_extra').optional().isArray().withMessage('Bairros com taxa extra deve ser array'),
        handleValidationErrors
    ]
};

// Validadores de avaliação
export const avaliacaoValidators = {
    create: [
        body('estrelas').isInt({ min: 1, max: 5 }).withMessage('Estrelas deve ser entre 1 e 5'),
        body('comentario').optional().trim().isLength({ max: 1000 }).withMessage('Comentário muito longo'),
        handleValidationErrors
    ],
    respond: [
        body('resposta').trim().isLength({ min: 1, max: 500 }).withMessage('Resposta deve ter entre 1 e 500 caracteres'),
        handleValidationErrors
    ],
    list: [
        query('page').optional().isInt({ min: 1 }).withMessage('Página deve ser inteiro positivo'),
        query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limite deve ser entre 1 e 100'),
        query('estrelas').optional().isInt({ min: 1, max: 5 }).withMessage('Estrelas deve ser entre 1 e 5'),
        query('respondido').optional().isBoolean().withMessage('Respondido deve ser booleano'),
        query('data_inicio').optional().isISO8601().withMessage('Data início inválida'),
        query('data_fim').optional().isISO8601().withMessage('Data fim inválida'),
        handleValidationErrors
    ]
};

// Validadores de entrega
export const entregaValidators = {
    updateStatus: [
        body('status').isIn(['pendente', 'aceita', 'retirada', 'em_rota', 'entregue', 'falha']).withMessage('Status inválido'),
        body('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Latitude inválida'),
        body('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Longitude inválida'),
        body('observacoes').optional().trim().isLength({ max: 500 }).withMessage('Observações muito longas'),
        handleValidationErrors
    ],
    updateLocation: [
        body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude inválida'),
        body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Longitude inválida'),
        handleValidationErrors
    ],
    list: [
        query('status').optional().isIn(['pendente', 'aceita', 'retirada', 'em_rota', 'entregue', 'falha']).withMessage('Status inválido'),
        query('page').optional().isInt({ min: 1 }).withMessage('Página deve ser inteiro positivo'),
        query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limite deve ser entre 1 e 100'),
        handleValidationErrors
    ]
};

// Validadores de relatórios
export const relatorioValidators = {
    vendas: [
        query('data_inicio').optional().isISO8601().withMessage('Data início inválida'),
        query('data_fim').optional().isISO8601().withMessage('Data fim inválida'),
        query('agrupamento').optional().isIn(['dia', 'semana', 'mes']).withMessage('Agrupamento inválido'),
        handleValidationErrors
    ],
    produtos: [
        query('data_inicio').optional().isISO8601().withMessage('Data início inválida'),
        query('data_fim').optional().isISO8601().withMessage('Data fim inválida'),
        query('categoria_id').optional().isInt({ min: 1 }).withMessage('Categoria inválida'),
        query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limite deve ser entre 1 e 100'),
        handleValidationErrors
    ],
    pico: [
        query('data_inicio').optional().isISO8601().withMessage('Data início inválida'),
        query('data_fim').optional().isISO8601().withMessage('Data fim inválida'),
        handleValidationErrors
    ],
    entregas: [
        query('data_inicio').optional().isISO8601().withMessage('Data início inválida'),
        query('data_fim').optional().isISO8601().withMessage('Data fim inválida'),
        query('entregador_id').optional().isInt({ min: 1 }).withMessage('Entregador inválido'),
        handleValidationErrors
    ],
    clientes: [
        query('data_inicio').optional().isISO8601().withMessage('Data início inválida'),
        query('data_fim').optional().isISO8601().withMessage('Data fim inválida'),
        query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limite deve ser entre 1 e 100'),
        handleValidationErrors
    ]
};

// Validadores de notificações
export const notificacaoValidators = {
    markRead: [
        body('ids').isArray({ min: 1 }).withMessage('IDs é obrigatório'),
        body('ids.*').isInt({ min: 1 }).withMessage('ID inválido'),
        handleValidationErrors
    ],
    subscribePush: [
        body('endpoint').isURL().withMessage('Endpoint inválido'),
        body('keys.p256dh').notEmpty().withMessage('Chave p256dh obrigatória'),
        body('keys.auth').notEmpty().withMessage('Chave auth obrigatória'),
        handleValidationErrors
    ]
};

// Validadores genéricos
export const commonValidators = {
    idParam: [
        param('id').isInt({ min: 1 }).withMessage('ID inválido'),
        handleValidationErrors
    ],
    pagination: [
        query('page').optional().isInt({ min: 1 }).withMessage('Página deve ser inteiro positivo'),
        query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limite deve ser entre 1 e 100'),
        handleValidationErrors
    ]
};

export default {
    handleValidationErrors,
    authValidators,
    clienteValidators,
    categoriaValidators,
    produtoValidators,
    personalizacaoValidators,
    horarioValidators,
    pedidoValidators,
    formaPagamentoValidators,
    entregaConfigValidators,
    avaliacaoValidators,
    entregaValidators,
    relatorioValidators,
    notificacaoValidators,
    commonValidators
};