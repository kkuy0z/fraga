import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config, validateConfig } from '../shared/config/index.js';
import { generalLimiter, sensitiveApiLimiter, createLimiter } from '../shared/middleware/rateLimiter.js';
import { authenticateToken, optionalAuth, requireRole } from '../shared/middleware/auth.js';
import { commonValidators, categoriaValidators, produtoValidators, personalizacaoValidators, horarioValidators, formaPagamentoValidators, entregaConfigValidators } from '../shared/middleware/validation.js';
import { query, queryOne, run, transaction } from '../shared/database/connection.js';

// Validar configuração
validateConfig();

const app = express();

// Middlewares globais
app.use(helmet({
    contentSecurityPolicy: config.server.env === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false
}));
app.use(cors({
    origin: config.server.env === 'production' ? config.frontend.url : true,
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(generalLimiter);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'menu', timestamp: new Date().toISOString() });
});

// ============================================
// CATEGORIAS
// ============================================

// Listar categorias (público)
app.get('/api/categorias', optionalAuth, async (req, res) => {
    try {
        const apenasAtivas = req.query.ativas !== 'false';
        const sql = apenasAtivas
            ? 'SELECT * FROM categorias WHERE ativo = 1 ORDER BY ordem_exibicao, nome'
            : 'SELECT * FROM categorias ORDER BY ordem_exibicao, nome';
        const categorias = await query(sql);
        res.json(categorias);
    } catch (error) {
        console.error('List categories error:', error);
        res.status(500).json({ error: 'Erro ao buscar categorias' });
    }
});

// Obter categoria por ID
app.get('/api/categorias/:id', optionalAuth, commonValidators.idParam, async (req, res) => {
    try {
        const categoria = await queryOne('SELECT * FROM categorias WHERE id = ?', [req.params.id]);
        if (!categoria) return res.status(404).json({ error: 'Categoria não encontrada' });
        res.json(categoria);
    } catch (error) {
        console.error('Get category error:', error);
        res.status(500).json({ error: 'Erro ao buscar categoria' });
    }
});

// Criar categoria (admin)
app.post('/api/categorias', authenticateToken, requireRole('administrador'), createLimiter, categoriaValidators.create, async (req, res) => {
    try {
        const { nome, descricao, ordem_exibicao } = req.body;
        const result = await run(
            'INSERT INTO categorias (nome, descricao, ordem_exibicao) VALUES (?, ?, ?)',
            [nome, descricao || null, ordem_exibicao || 0]
        );
        const categoria = await queryOne('SELECT * FROM categorias WHERE id = ?', [result.lastInsertRowid]);
        res.status(201).json(categoria);
    } catch (error) {
        console.error('Create category error:', error);
        res.status(500).json({ error: 'Erro ao criar categoria' });
    }
});

// Atualizar categoria (admin)
app.put('/api/categorias/:id', authenticateToken, requireRole('administrador'), commonValidators.idParam, categoriaValidators.update, async (req, res) => {
    try {
        const { nome, descricao, ordem_exibicao, ativo } = req.body;
        const updates = [];
        const params = [];

        if (nome !== undefined) { updates.push('nome = ?'); params.push(nome); }
        if (descricao !== undefined) { updates.push('descricao = ?'); params.push(descricao); }
        if (ordem_exibicao !== undefined) { updates.push('ordem_exibicao = ?'); params.push(ordem_exibicao); }
        if (ativo !== undefined) { updates.push('ativo = ?'); params.push(ativo ? 1 : 0); }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nenhum campo para atualizar' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(req.params.id);

        await run(`UPDATE categorias SET ${updates.join(', ')} WHERE id = ?`, params);
        const categoria = await queryOne('SELECT * FROM categorias WHERE id = ?', [req.params.id]);
        if (!categoria) return res.status(404).json({ error: 'Categoria não encontrada' });
        res.json(categoria);
    } catch (error) {
        console.error('Update category error:', error);
        res.status(500).json({ error: 'Erro ao atualizar categoria' });
    }
});

// Excluir categoria (admin)
app.delete('/api/categorias/:id', authenticateToken, requireRole('administrador'), commonValidators.idParam, async (req, res) => {
    try {
        const hasProducts = await queryOne('SELECT 1 FROM produtos WHERE categoria_id = ?', [req.params.id]);
        if (hasProducts) {
            return res.status(400).json({ error: 'Não é possível excluir categoria com produtos vinculados' });
        }

        await run('DELETE FROM categorias WHERE id = ?', [req.params.id]);
        res.json({ message: 'Categoria excluída com sucesso' });
    } catch (error) {
        console.error('Delete category error:', error);
        res.status(500).json({ error: 'Erro ao excluir categoria' });
    }
});

// ============================================
// PRODUTOS
// ============================================

// Listar produtos (público)
app.get('/api/produtos', optionalAuth, async (req, res) => {
    try {
        const { categoria_id, disponivel, busca, page = 1, limit = 20 } = req.query;
        let sql = 'SELECT p.*, c.nome as categoria_nome FROM produtos p LEFT JOIN categorias c ON p.categoria_id = c.id WHERE 1=1';
        const params = [];

        if (categoria_id) { sql += ' AND p.categoria_id = ?'; params.push(categoria_id); }
        if (disponivel !== undefined) { sql += ' AND p.disponivel = ?'; params.push(disponivel === 'true' ? 1 : 0); }
        if (busca) { sql += ' AND p.nome LIKE ?'; params.push(`%${busca}%`); }

        sql += ' ORDER BY c.ordem_exibicao, p.nome LIMIT ? OFFSET ?';
        params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

        const produtos = await query(sql, params);

        // Buscar personalizações para cada produto
        for (const produto of produtos) {
            const grupos = await query(
                `SELECT pg.*,
                    (SELECT json_group_array(json_object('id', po.id, 'nome', po.nome, 'preco_adicional', po.preco_adicional, 'ativo', po.ativo))
                     FROM personalizacao_opcoes po WHERE po.grupo_id = pg.id AND po.ativo = 1) as opcoes
                 FROM personalizacao_grupos pg WHERE pg.produto_id = ? ORDER BY pg.ordem_exibicao`,
                [produto.id]
            );
            produto.personalizacoes = grupos.map(g => ({
                ...g,
                opcoes: g.opcoes ? JSON.parse(g.opcoes) : []
            }));
        }

        const total = await queryOne('SELECT COUNT(*) as total FROM produtos WHERE 1=1' +
            (categoria_id ? ' AND categoria_id = ?' : '') +
            (disponivel !== undefined ? ' AND disponivel = ?' : '') +
            (busca ? ' AND nome LIKE ?' : ''),
            params.slice(0, -2)
        );

        res.json({
            data: produtos,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total.total,
                totalPages: Math.ceil(total.total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('List products error:', error);
        res.status(500).json({ error: 'Erro ao buscar produtos' });
    }
});

// Obter produto por ID
app.get('/api/produtos/:id', optionalAuth, commonValidators.idParam, async (req, res) => {
    try {
        const produto = await queryOne(
            'SELECT p.*, c.nome as categoria_nome FROM produtos p LEFT JOIN categorias c ON p.categoria_id = c.id WHERE p.id = ?',
            [req.params.id]
        );
        if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });

        const grupos = await query(
            `SELECT pg.*,
                (SELECT json_group_array(json_object('id', po.id, 'nome', po.nome, 'preco_adicional', po.preco_adicional, 'ativo', po.ativo))
                 FROM personalizacao_opcoes po WHERE po.grupo_id = pg.id AND po.ativo = 1) as opcoes
             FROM personalizacao_grupos pg WHERE pg.produto_id = ? ORDER BY pg.ordem_exibicao`,
            [produto.id]
        );
        produto.personalizacoes = grupos.map(g => ({
            ...g,
            opcoes: g.opcoes ? JSON.parse(g.opcoes) : []
        }));

        res.json(produto);
    } catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({ error: 'Erro ao buscar produto' });
    }
});

// Criar produto (admin)
app.post('/api/produtos', authenticateToken, requireRole('administrador'), createLimiter, produtoValidators.create, async (req, res) => {
    try {
        const { categoria_id, nome, descricao, preco_base, imagem_url, disponivel, personalizacoes } = req.body;

        const result = await transaction(() => {
            const prodResult = run(
                'INSERT INTO produtos (categoria_id, nome, descricao, preco_base, imagem_url, disponivel) VALUES (?, ?, ?, ?, ?, ?)',
                [categoria_id, nome, descricao || null, preco_base, imagem_url || null, disponivel !== undefined ? (disponivel ? 1 : 0) : 1]
            );

            if (personalizacoes && personalizacoes.length > 0) {
                for (const grupo of personalizacoes) {
                    const grupoResult = run(
                        'INSERT INTO personalizacao_grupos (produto_id, nome, tipo, obrigatorio, min_selecoes, max_selecoes, ordem_exibicao) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [prodResult.lastInsertRowid, grupo.nome, grupo.tipo, grupo.obrigatorio ? 1 : 0, grupo.min_selecoes || 0, grupo.max_selecoes || 1, grupo.ordem_exibicao || 0]
                    );

                    if (grupo.opcoes && grupo.opcoes.length > 0) {
                        for (const opcao of grupo.opcoes) {
                            run(
                                'INSERT INTO personalizacao_opcoes (grupo_id, nome, preco_adicional) VALUES (?, ?, ?)',
                                [grupoResult.lastInsertRowid, opcao.nome, opcao.preco_adicional || 0]
                            );
                        }
                    }
                }
            }

            return prodResult;
        });

        const produto = await queryOne('SELECT * FROM produtos WHERE id = ?', [result.lastInsertRowid]);
        res.status(201).json(produto);
    } catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({ error: 'Erro ao criar produto' });
    }
});

// Atualizar produto (admin)
app.put('/api/produtos/:id', authenticateToken, requireRole('administrador'), commonValidators.idParam, produtoValidators.update, async (req, res) => {
    try {
        const { categoria_id, nome, descricao, preco_base, imagem_url, disponivel } = req.body;
        const updates = [];
        const params = [];

        if (categoria_id !== undefined) { updates.push('categoria_id = ?'); params.push(categoria_id); }
        if (nome !== undefined) { updates.push('nome = ?'); params.push(nome); }
        if (descricao !== undefined) { updates.push('descricao = ?'); params.push(descricao); }
        if (preco_base !== undefined) { updates.push('preco_base = ?'); params.push(preco_base); }
        if (imagem_url !== undefined) { updates.push('imagem_url = ?'); params.push(imagem_url); }
        if (disponivel !== undefined) { updates.push('disponivel = ?'); params.push(disponivel ? 1 : 0); }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nenhum campo para atualizar' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(req.params.id);

        await run(`UPDATE produtos SET ${updates.join(', ')} WHERE id = ?`, params);
        const produto = await queryOne('SELECT * FROM produtos WHERE id = ?', [req.params.id]);
        if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });
        res.json(produto);
    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ error: 'Erro ao atualizar produto' });
    }
});

// Excluir produto (admin)
app.delete('/api/produtos/:id', authenticateToken, requireRole('administrador'), commonValidators.idParam, async (req, res) => {
    try {
        await run('DELETE FROM produtos WHERE id = ?', [req.params.id]);
        res.json({ message: 'Produto excluído com sucesso' });
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ error: 'Erro ao excluir produto' });
    }
});

// ============================================
// PERSONALIZAÇÕES - GRUPOS
// ============================================

// Adicionar grupo de personalização
app.post('/api/produtos/:produtoId/personalizacoes/grupos', authenticateToken, requireRole('administrador'), createLimiter, personalizacaoValidators.grupoCreate, async (req, res) => {
    try {
        const { produtoId } = req.params;
        const { nome, tipo, obrigatorio, min_selecoes, max_selecoes, ordem_exibicao } = req.body;

        const produto = await queryOne('SELECT 1 FROM produtos WHERE id = ?', [produtoId]);
        if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });

        const result = await run(
            'INSERT INTO personalizacao_grupos (produto_id, nome, tipo, obrigatorio, min_selecoes, max_selecoes, ordem_exibicao) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [produtoId, nome, tipo, obrigatorio ? 1 : 0, min_selecoes || 0, max_selecoes || 1, ordem_exibicao || 0]
        );

        const grupo = await queryOne('SELECT * FROM personalizacao_grupos WHERE id = ?', [result.lastInsertRowid]);
        res.status(201).json(grupo);
    } catch (error) {
        console.error('Create personalization group error:', error);
        res.status(500).json({ error: 'Erro ao criar grupo de personalização' });
    }
});

// Atualizar grupo
app.put('/api/personalizacoes/grupos/:id', authenticateToken, requireRole('administrador'), commonValidators.idParam, async (req, res) => {
    try {
        const { nome, tipo, obrigatorio, min_selecoes, max_selecoes, ordem_exibicao } = req.body;
        const updates = [];
        const params = [];

        if (nome !== undefined) { updates.push('nome = ?'); params.push(nome); }
        if (tipo !== undefined) { updates.push('tipo = ?'); params.push(tipo); }
        if (obrigatorio !== undefined) { updates.push('obrigatorio = ?'); params.push(obrigatorio ? 1 : 0); }
        if (min_selecoes !== undefined) { updates.push('min_selecoes = ?'); params.push(min_selecoes); }
        if (max_selecoes !== undefined) { updates.push('max_selecoes = ?'); params.push(max_selecoes); }
        if (ordem_exibicao !== undefined) { updates.push('ordem_exibicao = ?'); params.push(ordem_exibicao); }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nenhum campo para atualizar' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(req.params.id);

        await run(`UPDATE personalizacao_grupos SET ${updates.join(', ')} WHERE id = ?`, params);
        const grupo = await queryOne('SELECT * FROM personalizacao_grupos WHERE id = ?', [req.params.id]);
        if (!grupo) return res.status(404).json({ error: 'Grupo não encontrado' });
        res.json(grupo);
    } catch (error) {
        console.error('Update personalization group error:', error);
        res.status(500).json({ error: 'Erro ao atualizar grupo' });
    }
});

// Excluir grupo
app.delete('/api/personalizacoes/grupos/:id', authenticateToken, requireRole('administrador'), commonValidators.idParam, async (req, res) => {
    try {
        await run('DELETE FROM personalizacao_grupos WHERE id = ?', [req.params.id]);
        res.json({ message: 'Grupo excluído com sucesso' });
    } catch (error) {
        console.error('Delete personalization group error:', error);
        res.status(500).json({ error: 'Erro ao excluir grupo' });
    }
});

// ============================================
// PERSONALIZAÇÕES - OPÇÕES
// ============================================

// Adicionar opção
app.post('/api/personalizacoes/grupos/:grupoId/opcoes', authenticateToken, requireRole('administrador'), createLimiter, personalizacaoValidators.opcaoCreate, async (req, res) => {
    try {
        const { grupoId } = req.params;
        const { nome, preco_adicional } = req.body;

        const grupo = await queryOne('SELECT 1 FROM personalizacao_grupos WHERE id = ?', [grupoId]);
        if (!grupo) return res.status(404).json({ error: 'Grupo não encontrado' });

        const result = await run(
            'INSERT INTO personalizacao_opcoes (grupo_id, nome, preco_adicional) VALUES (?, ?, ?)',
            [grupoId, nome, preco_adicional || 0]
        );

        const opcao = await queryOne('SELECT * FROM personalizacao_opcoes WHERE id = ?', [result.lastInsertRowid]);
        res.status(201).json(opcao);
    } catch (error) {
        console.error('Create personalization option error:', error);
        res.status(500).json({ error: 'Erro ao criar opção' });
    }
});

// Atualizar opção
app.put('/api/personalizacoes/opcoes/:id', authenticateToken, requireRole('administrador'), commonValidators.idParam, async (req, res) => {
    try {
        const { nome, preco_adicional, ativo } = req.body;
        const updates = [];
        const params = [];

        if (nome !== undefined) { updates.push('nome = ?'); params.push(nome); }
        if (preco_adicional !== undefined) { updates.push('preco_adicional = ?'); params.push(preco_adicional); }
        if (ativo !== undefined) { updates.push('ativo = ?'); params.push(ativo ? 1 : 0); }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nenhum campo para atualizar' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(req.params.id);

        await run(`UPDATE personalizacao_opcoes SET ${updates.join(', ')} WHERE id = ?`, params);
        const opcao = await queryOne('SELECT * FROM personalizacao_opcoes WHERE id = ?', [req.params.id]);
        if (!opcao) return res.status(404).json({ error: 'Opção não encontrada' });
        res.json(opcao);
    } catch (error) {
        console.error('Update personalization option error:', error);
        res.status(500).json({ error: 'Erro ao atualizar opção' });
    }
});

// Excluir opção
app.delete('/api/personalizacoes/opcoes/:id', authenticateToken, requireRole('administrador'), commonValidators.idParam, async (req, res) => {
    try {
        await run('DELETE FROM personalizacao_opcoes WHERE id = ?', [req.params.id]);
        res.json({ message: 'Opção excluída com sucesso' });
    } catch (error) {
        console.error('Delete personalization option error:', error);
        res.status(500).json({ error: 'Erro ao excluir opção' });
    }
});

// ============================================
// HORÁRIOS DE FUNCIONAMENTO
// ============================================

app.get('/api/horarios', optionalAuth, async (req, res) => {
    try {
        const horarios = await query('SELECT * FROM horarios_funcionamento ORDER BY dia_semana, hora_abertura');
        res.json(horarios);
    } catch (error) {
        console.error('List hours error:', error);
        res.status(500).json({ error: 'Erro ao buscar horários' });
    }
});

app.post('/api/horarios', authenticateToken, requireRole('administrador'), createLimiter, horarioValidators.create, async (req, res) => {
    try {
        const { dia_semana, hora_abertura, hora_fechamento, ativo } = req.body;
        const result = await run(
            'INSERT INTO horarios_funcionamento (dia_semana, hora_abertura, hora_fechamento, ativo) VALUES (?, ?, ?, ?)',
            [dia_semana, hora_abertura, hora_fechamento, ativo ? 1 : 0]
        );
        const horario = await queryOne('SELECT * FROM horarios_funcionamento WHERE id = ?', [result.lastInsertRowid]);
        res.status(201).json(horario);
    } catch (error) {
        console.error('Create hours error:', error);
        res.status(500).json({ error: 'Erro ao criar horário' });
    }
});

app.put('/api/horarios/:id', authenticateToken, requireRole('administrador'), commonValidators.idParam, horarioValidators.update, async (req, res) => {
    try {
        const { hora_abertura, hora_fechamento, ativo } = req.body;
        const updates = [];
        const params = [];

        if (hora_abertura !== undefined) { updates.push('hora_abertura = ?'); params.push(hora_abertura); }
        if (hora_fechamento !== undefined) { updates.push('hora_fechamento = ?'); params.push(hora_fechamento); }
        if (ativo !== undefined) { updates.push('ativo = ?'); params.push(ativo ? 1 : 0); }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nenhum campo para atualizar' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(req.params.id);

        await run(`UPDATE horarios_funcionamento SET ${updates.join(', ')} WHERE id = ?`, params);
        const horario = await queryOne('SELECT * FROM horarios_funcionamento WHERE id = ?', [req.params.id]);
        if (!horario) return res.status(404).json({ error: 'Horário não encontrado' });
        res.json(horario);
    } catch (error) {
        console.error('Update hours error:', error);
        res.status(500).json({ error: 'Erro ao atualizar horário' });
    }
});

app.delete('/api/horarios/:id', authenticateToken, requireRole('administrador'), commonValidators.idParam, async (req, res) => {
    try {
        await run('DELETE FROM horarios_funcionamento WHERE id = ?', [req.params.id]);
        res.json({ message: 'Horário excluído com sucesso' });
    } catch (error) {
        console.error('Delete hours error:', error);
        res.status(500).json({ error: 'Erro ao excluir horário' });
    }
});

// ============================================
// FORMAS DE PAGAMENTO
// ============================================

app.get('/api/formas-pagamento', optionalAuth, async (req, res) => {
    try {
        const apenasAtivas = req.query.ativas !== 'false';
        const sql = apenasAtivas
            ? 'SELECT * FROM formas_pagamento WHERE ativo = 1 ORDER BY nome'
            : 'SELECT * FROM formas_pagamento ORDER BY nome';
        const formas = await query(sql);
        res.json(formas);
    } catch (error) {
        console.error('List payment methods error:', error);
        res.status(500).json({ error: 'Erro ao buscar formas de pagamento' });
    }
});

app.post('/api/formas-pagamento', authenticateToken, requireRole('administrador'), createLimiter, formaPagamentoValidators.create, async (req, res) => {
    try {
        const { nome, tipo, configuracao } = req.body;
        const result = await run(
            'INSERT INTO formas_pagamento (nome, tipo, configuracao) VALUES (?, ?, ?)',
            [nome, tipo, JSON.stringify(configuracao || {})]
        );
        const forma = await queryOne('SELECT * FROM formas_pagamento WHERE id = ?', [result.lastInsertRowid]);
        res.status(201).json(forma);
    } catch (error) {
        console.error('Create payment method error:', error);
        res.status(500).json({ error: 'Erro ao criar forma de pagamento' });
    }
});

app.put('/api/formas-pagamento/:id', authenticateToken, requireRole('administrador'), commonValidators.idParam, formaPagamentoValidators.update, async (req, res) => {
    try {
        const { nome, tipo, configuracao, ativo } = req.body;
        const updates = [];
        const params = [];

        if (nome !== undefined) { updates.push('nome = ?'); params.push(nome); }
        if (tipo !== undefined) { updates.push('tipo = ?'); params.push(tipo); }
        if (configuracao !== undefined) { updates.push('configuracao = ?'); params.push(JSON.stringify(configuracao)); }
        if (ativo !== undefined) { updates.push('ativo = ?'); params.push(ativo ? 1 : 0); }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nenhum campo para atualizar' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(req.params.id);

        await run(`UPDATE formas_pagamento SET ${updates.join(', ')} WHERE id = ?`, params);
        const forma = await queryOne('SELECT * FROM formas_pagamento WHERE id = ?', [req.params.id]);
        if (!forma) return res.status(404).json({ error: 'Forma de pagamento não encontrada' });
        res.json(forma);
    } catch (error) {
        console.error('Update payment method error:', error);
        res.status(500).json({ error: 'Erro ao atualizar forma de pagamento' });
    }
});

app.delete('/api/formas-pagamento/:id', authenticateToken, requireRole('administrador'), commonValidators.idParam, async (req, res) => {
    try {
        const hasOrders = await queryOne('SELECT 1 FROM pedidos WHERE forma_pagamento_id = ?', [req.params.id]);
        if (hasOrders) {
            return res.status(400).json({ error: 'Não é possível excluir forma de pagamento com pedidos vinculados' });
        }
        await run('DELETE FROM formas_pagamento WHERE id = ?', [req.params.id]);
        res.json({ message: 'Forma de pagamento excluída com sucesso' });
    } catch (error) {
        console.error('Delete payment method error:', error);
        res.status(500).json({ error: 'Erro ao excluir forma de pagamento' });
    }
});

// ============================================
// CONFIGURAÇÃO DE ENTREGA
// ============================================

app.get('/api/config-entrega', optionalAuth, async (req, res) => {
    try {
        const config = await queryOne('SELECT * FROM configuracao_entrega WHERE id = 1');
        if (config) {
            config.bairro_taxa_extra = config.bairro_taxa_extra ? JSON.parse(config.bairro_taxa_extra) : [];
        }
        res.json(config || { taxa_entrega: 0, valor_minimo_pedido: 0, bairro_taxa_extra: [] });
    } catch (error) {
        console.error('Get delivery config error:', error);
        res.status(500).json({ error: 'Erro ao buscar configuração de entrega' });
    }
});

app.put('/api/config-entrega', authenticateToken, requireRole('administrador'), entregaConfigValidators.update, async (req, res) => {
    try {
        const { taxa_entrega, valor_minimo_pedido, bairro_taxa_extra } = req.body;
        const updates = [];
        const params = [];

        if (taxa_entrega !== undefined) { updates.push('taxa_entrega = ?'); params.push(taxa_entrega); }
        if (valor_minimo_pedido !== undefined) { updates.push('valor_minimo_pedido = ?'); params.push(valor_minimo_pedido); }
        if (bairro_taxa_extra !== undefined) { updates.push('bairro_taxa_extra = ?'); params.push(JSON.stringify(bairro_taxa_extra)); }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nenhum campo para atualizar' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(1);

        await run(`UPDATE configuracao_entrega SET ${updates.join(', ')} WHERE id = ?`, params);
        const config = await queryOne('SELECT * FROM configuracao_entrega WHERE id = 1');
        if (config) config.bairro_taxa_extra = config.bairro_taxa_extra ? JSON.parse(config.bairro_taxa_extra) : [];
        res.json(config);
    } catch (error) {
        console.error('Update delivery config error:', error);
        res.status(500).json({ error: 'Erro ao atualizar configuração de entrega' });
    }
});

const PORT = config.server.port + 1; // 3001
app.listen(PORT, () => {
    console.log(`🍔 Menu Service rodando na porta ${PORT}`);
});

export default app;