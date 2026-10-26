import { body, param, query, validationResult } from 'express-validator';

export function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Dados inválidos',
            details: errors.array().map(e => ({
                field: e.path,
                message: e.msg,
                value: e.value
            }))
        });
    }
    next();
}

// Category validators
export const categoriaValidators = {
    create: [
        body('nome').trim().notEmpty().withMessage('Nome é obrigatório')
            .isLength({ max: 100 }).withMessage('Nome deve ter no máximo 100 caracteres'),
        body('descricao').optional().trim().isLength({ max: 500 }).withMessage('Descrição deve ter no máximo 500 caracteres'),
        body('ordem_exibicao').optional().isInt({ min: 0 }).withMessage('Ordem de exibição deve ser um número inteiro não negativo'),
        handleValidationErrors
    ],
    update: [
        param('id').isInt({ min: 1 }).withMessage('ID inválido'),
        body('nome').optional().trim().notEmpty().withMessage('Nome não pode ser vazio')
            .isLength({ max: 100 }).withMessage('Nome deve ter no máximo 100 caracteres'),
        body('descricao').optional().trim().isLength({ max: 500 }).withMessage('Descrição deve ter no máximo 500 caracteres'),
        body('ordem_exibicao').optional().isInt({ min: 0 }).withMessage('Ordem de exibição deve ser um número inteiro não negativo'),
        body('ativo').optional().isBoolean().withMessage('Ativo deve ser verdadeiro ou falso'),
        handleValidationErrors
    ],
    delete: [
        param('id').isInt({ min: 1 }).withMessage('ID inválido'),
        handleValidationErrors
    ]
};

// Product validators
export const produtoValidators = {
    create: [
        body('categoria_id').isInt({ min: 1 }).withMessage('Categoria ID inválido'),
        body('nome').trim().notEmpty().withMessage('Nome é obrigatório')
            .isLength({ max: 150 }).withMessage('Nome deve ter no máximo 150 caracteres'),
        body('descricao').optional().trim().isLength({ max: 1000 }).withMessage('Descrição deve ter no máximo 1000 caracteres'),
        body('preco_base').isFloat({ min: 0 }).withMessage('Preço base deve ser um número não negativo'),
        body('imagem_url').optional().trim().isURL().withMessage('URL da imagem inválida'),
        body('disponivel').optional().isBoolean().withMessage('Disponível deve ser verdadeiro ou falso'),
        handleValidationErrors
    ],
    update: [
        param('id').isInt({ min: 1 }).withMessage('ID inválido'),
        body('categoria_id').optional().isInt({ min: 1 }).withMessage('Categoria ID inválido'),
        body('nome').optional().trim().notEmpty().withMessage('Nome não pode ser vazio')
            .isLength({ max: 150 }).withMessage('Nome deve ter no máximo 150 caracteres'),
        body('descricao').optional().trim().isLength({ max: 1000 }).withMessage('Descrição deve ter no máximo 1000 caracteres'),
        body('preco_base').optional().isFloat({ min: 0 }).withMessage('Preço base deve ser um número não negativo'),
        body('imagem_url').optional().trim().isURL().withMessage('URL da imagem inválida'),
        body('disponivel').optional().isBoolean().withMessage('Disponível deve ser verdadeiro ou falso'),
        handleValidationErrors
    ],
    delete: [
        param('id').isInt({ min: 1 }).withMessage('ID inválido'),
        handleValidationErrors
    ],
    list: [
        query('categoria_id').optional().isInt({ min: 1 }).withMessage('Categoria ID inválido'),
        query('disponivel').optional().isBoolean().withMessage('Disponível deve ser verdadeiro ou falso'),
        query('search').optional().trim().isLength({ max: 100 }).withMessage('Busca deve ter no máximo 100 caracteres'),
        query('page').optional().isInt({ min: 1 }).withMessage('Página deve ser um número inteiro positivo'),
        query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limite deve ser entre 1 e 100'),
        handleValidationErrors
    ]
};

// Personalization validators
export const personalizacaoValidators = {
    grupoCreate: [
        body('produto_id').isInt({ min: 1 }).withMessage('Produto ID inválido'),
        body('nome').trim().notEmpty().withMessage('Nome é obrigatório')
            .isLength({ max: 100 }).withMessage('Nome deve ter no máximo 100 caracteres'),
        body('tipo').isIn(['adicional', 'remocao', 'escolha_unica', 'escolha_multipla']).withMessage('Tipo inválido'),
        body('obrigatorio').optional().isBoolean().withMessage('Obrigatório deve ser verdadeiro ou falso'),
        body('min_selecoes').optional().isInt({ min: 0 }).withMessage('Mínimo de seleções deve ser um número inteiro não negativo'),
        body('max_selecoes').optional().isInt({ min: 1 }).withMessage('Máximo de seleções deve ser um número inteiro positivo'),
        handleValidationErrors
    ],
    grupoUpdate: [
        param('id').isInt({ min: 1 }).withMessage('ID inválido'),
        body('nome').optional().trim().notEmpty().withMessage('Nome não pode ser vazio')
            .isLength({ max: 100 }).withMessage('Nome deve ter no máximo 100 caracteres'),
        body('tipo').optional().isIn(['adicional', 'remocao', 'escolha_unica', 'escolha_multipla']).withMessage('Tipo inválido'),
        body('obrigatorio').optional().isBoolean().withMessage('Obrigatório deve ser verdadeiro ou falso'),
        body('min_selecoes').optional().isInt({ min: 0 }).withMessage('Mínimo de seleções deve ser um número inteiro não negativo'),
        body('max_selecoes').optional().isInt({ min: 1 }).withMessage('Máximo de seleções deve ser um número inteiro positivo'),
        handleValidationErrors
    ],
    grupoDelete: [
        param('id').isInt({ min: 1 }).withMessage('ID inválido'),
        handleValidationErrors
    ],
    opcaoCreate: [
        body('grupo_id').isInt({ min: 1 }).withMessage('Grupo ID inválido'),
        body('nome').trim().notEmpty().withMessage('Nome é obrigatório')
            .isLength({ max: 100 }).withMessage('Nome deve ter no máximo 100 caracteres'),
        body('preco_adicional').optional().isFloat({ min: 0 }).withMessage('Preço adicional deve ser um número não negativo'),
        body('ativo').optional().isBoolean().withMessage('Ativo deve ser verdadeiro ou falso'),
        handleValidationErrors
    ],
    opcaoUpdate: [
        param('id').isInt({ min: 1 }).withMessage('ID inválido'),
        body('nome').optional().trim().notEmpty().withMessage('Nome não pode ser vazio')
            .isLength({ max: 100 }).withMessage('Nome deve ter no máximo 100 caracteres'),
        body('preco_adicional').optional().isFloat({ min: 0 }).withMessage('Preço adicional deve ser um número não negativo'),
        body('ativo').optional().isBoolean().withMessage('Ativo deve ser verdadeiro ou falso'),
        handleValidationErrors
    ],
    opcaoDelete: [
        param('id').isInt({ min: 1 }).withMessage('ID inválido'),
        handleValidationErrors
    ]
};

// Business hours validators
export const horarioValidators = {
    create: [
        body('dia_semana').isInt({ min: 0, max: 6 }).withMessage('Dia da semana deve ser entre 0 (domingo) e 6 (sábado)'),
        body('hora_abertura').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Hora de abertura inválida (formato HH:MM)'),
        body('hora_fechamento').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Hora de fechamento inválida (formato HH:MM)'),
        body('ativo').optional().isBoolean().withMessage('Ativo deve ser verdadeiro ou falso'),
        handleValidationErrors
    ],
    update: [
        param('id').isInt({ min: 1 }).withMessage('ID inválido'),
        body('hora_abertura').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Hora de abertura inválida (formato HH:MM)'),
        body('hora_fechamento').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Hora de fechamento inválida (formato HH:MM)'),
        body('ativo').optional().isBoolean().withMessage('Ativo deve ser verdadeiro ou falso'),
        handleValidationErrors
    ],
    delete: [
        param('id').isInt({ min: 1 }).withMessage('ID inválido'),
        handleValidationErrors
    ]
};

// Delivery config validators
export const configuracaoEntregaValidators = {
    update: [
        body('taxa_entrega').optional().isFloat({ min: 0 }).withMessage('Taxa de entrega deve ser um número não negativo'),
        body('valor_minimo_pedido').optional().isFloat({ min: 0 }).withMessage('Valor mínimo do pedido deve ser um número não negativo'),
        body('bairro_taxa_extra').optional().isArray().withMessage('Bairros com taxa extra deve ser um array'),
        handleValidationErrors
    ]
};

// Payment method validators
export const formaPagamentoValidators = {
    create: [
        body('nome').trim().notEmpty().withMessage('Nome é obrigatório')
            .isLength({ max: 100 }).withMessage('Nome deve ter no máximo 100 caracteres'),
        body('tipo').isIn(['pix', 'cartao', 'dinheiro', 'online']).withMessage('Tipo inválido'),
        body('configuracao').optional().isObject().withMessage('Configuração deve ser um objeto JSON'),
        body('ativo').optional().isBoolean().withMessage('Ativo deve ser verdadeiro ou falso'),
        handleValidationErrors
    ],
    update: [
        param('id').isInt({ min: 1 }).withMessage('ID inválido'),
        body('nome').optional().trim().notEmpty().withMessage('Nome não pode ser vazio')
            .isLength({ max: 100 }).withMessage('Nome deve ter no máximo 100 caracteres'),
        body('tipo').optional().isIn(['pix', 'cartao', 'dinheiro', 'online']).withMessage('Tipo inválido'),
        body('configuracao').optional().isObject().withMessage('Configuração deve ser um objeto JSON'),
        body('ativo').optional().isBoolean().withMessage('Ativo deve ser verdadeiro ou falso'),
        handleValidationErrors
    ],
    delete: [
        param('id').isInt({ min: 1 }).withMessage('ID inválido'),
        handleValidationErrors
    ]
};

// Order validators
export const pedidoValidators = {
    create: [
        body('cliente_nome').trim().notEmpty().withMessage('Nome do cliente é obrigatório')
            .isLength({ max: 150 }).withMessage('Nome deve ter no máximo 150 caracteres'),
        body('cliente_telefone').trim().notEmpty().withMessage('Telefone é obrigatório')
            .matches(/^[\d\s\(\)\-\+]{10,}$/).withMessage('Telefone inválido'),
        body('cliente_email').optional().trim().isEmail().withMessage('E-mail inválido'),
        body('cep').optional().trim().matches(/^\d{5}-?\d{3}$/).withMessage('CEP inválido (formato: 00000-000)'),
        body('logradouro').trim().notEmpty().withMessage('Logradouro é obrigatório')
            .isLength({ max: 200 }).withMessage('Logradouro deve ter no máximo 200 caracteres'),
        body('numero_endereco').trim().notEmpty().withMessage('Número é obrigatório')
            .isLength({ max: 20 }).withMessage('Número deve ter no máximo 20 caracteres'),
        body('bairro').trim().notEmpty().withMessage('Bairro é obrigatório')
            .isLength({ max: 100 }).withMessage('Bairro deve ter no máximo 100 caracteres'),
        body('complemento').optional().trim().isLength({ max: 100 }).withMessage('Complemento deve ter no máximo 100 caracteres'),
        body('referencia').optional().trim().isLength({ max: 200 }).withMessage('Referência deve ter no máximo 200 caracteres'),
        body('forma_pagamento_id').isInt({ min: 1 }).withMessage('Forma de pagamento inválida'),
        body('valor_troco').optional().isFloat({ min: 0 }).withMessage('Valor do troco deve ser um número não negativo'),
        body('observacoes_pagamento').optional().trim().isLength({ max: 500 }).withMessage('Observações devem ter no máximo 500 caracteres'),
        body('itens').isArray({ min: 1 }).withMessage('Pelo menos um item é obrigatório'),
        body('itens.*.produto_id').isInt({ min: 1 }).withMessage('Produto ID inválido'),
        body('itens.*.quantidade').isInt({ min: 1 }).withMessage('Quantidade deve ser um número inteiro positivo'),
        body('itens.*.personalizacoes').optional().isArray().withMessage('Personalizações deve ser um array'),
        body('itens.*.personalizacoes.*.grupo_id').isInt({ min: 1 }).withMessage('Grupo de personalização ID inválido'),
        body('itens.*.personalizacoes.*.opcao_id').isInt({ min: 1 }).withMessage('Opção de personalização ID inválido'),
        handleValidationErrors
    ],
    updateStatus: [
        param('id').isInt({ min: 1 }).withMessage('ID inválido'),
        body('status').isIn(['pendente', 'confirmado', 'preparando', 'saiu_entrega', 'entregue', 'cancelado']).withMessage('Status inválido'),
        handleValidationErrors
    ]
};

// Auth validators
export const authValidators = {
    login: [
        body('email').trim().notEmpty().withMessage('E-mail é obrigatório')
            .isEmail().withMessage('E-mail inválido'),
        body('senha').notEmpty().withMessage('Senha é obrigatória')
            .isLength({ min: 6 }).withMessage('Senha deve ter no mínimo 6 caracteres'),
        handleValidationErrors
    ],
    register: [
        body('email').trim().notEmpty().withMessage('E-mail é obrigatório')
            .isEmail().withMessage('E-mail inválido'),
        body('senha').notEmpty().withMessage('Senha é obrigatória')
            .isLength({ min: 6 }).withMessage('Senha deve ter no mínimo 6 caracteres'),
        body('nome').trim().notEmpty().withMessage('Nome é obrigatório')
            .isLength({ max: 100 }).withMessage('Nome deve ter no máximo 100 caracteres'),
        handleValidationErrors
    ]
};