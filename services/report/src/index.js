import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config, validateConfig } from '../shared/config/index.js';
import { generalLimiter, sensitiveApiLimiter } from '../shared/middleware/rateLimiter.js';
import { authenticateToken, requireRole } from '../shared/middleware/auth.js';
import { commonValidators, relatorioValidators } from '../shared/middleware/validation.js';
import { query, queryOne } from '../shared/database/connection.js';
import { formatCurrency, formatDate } from '../shared/utils/index.js';

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
    res.json({ status: 'ok', service: 'report', timestamp: new Date().toISOString() });
});

// ============================================
// HELPER: BUILD DATE FILTER
// ============================================

function buildDateFilter(baseTable, alias = '', params) {
    const { data_inicio, data_fim } = params;
    let where = '';
    const filterParams = [];

    if (data_inicio) {
        where += ` AND date(${alias}${alias ? '.' : ''}data_pedido) >= date(?)`;
        filterParams.push(data_inicio);
    }
    if (data_fim) {
        where += ` AND date(${alias}${alias ? '.' : ''}data_pedido) <= date(?)`;
        filterParams.push(data_fim);
    }

    return { where, params: filterParams };
}

// ============================================
// RELATÓRIO DE VENDAS
// ============================================

app.get('/api/relatorios/vendas', authenticateToken, requireRole('administrador', 'atendente'), relatorioValidators.vendas, async (req, res) => {
    try {
        const { data_inicio, data_fim, agrupamento = 'dia' } = req.query;

        const dateFilter = buildDateFilter('p', 'p.', { data_inicio, data_fim });

        let groupBy, selectPeriod;
        switch (agrupamento) {
            case 'semana':
                groupBy = "strftime('%Y-%W', p.data_pedido)";
                selectPeriod = "strftime('%Y-%W', p.data_pedido) as periodo";
                break;
            case 'mes':
                groupBy = "strftime('%Y-%m', p.data_pedido)";
                selectPeriod = "strftime('%Y-%m', p.data_pedido) as periodo";
                break;
            default:
                groupBy = "date(p.data_pedido)";
                selectPeriod = "date(p.data_pedido) as periodo";
        }

        // Resumo geral
        const resumo = await queryOne(`
            SELECT
                COUNT(*) as total_pedidos,
                COALESCE(SUM(valor_total), 0) as valor_total,
                COALESCE(AVG(valor_total), 0) as ticket_medio
            FROM pedidos p
            WHERE p.status NOT IN ('cancelado') ${dateFilter.where}
        `, dateFilter.params);

        // Série temporal
        const series = await query(`
            SELECT
                ${selectPeriod},
                COUNT(*) as total,
                COALESCE(SUM(valor_total), 0) as valor
            FROM pedidos p
            WHERE p.status NOT IN ('cancelado') ${dateFilter.where}
            GROUP BY ${groupBy}
            ORDER BY periodo
        `, dateFilter.params);

        // Por status
        const porStatus = await query(`
            SELECT status, COUNT(*) as total, COALESCE(SUM(valor_total), 0) as valor
            FROM pedidos p
            WHERE p.status NOT IN ('cancelado') ${dateFilter.where}
            GROUP BY status
        `, dateFilter.params);

        // Por forma de pagamento
        const porPagamento = await query(`
            SELECT fp.nome, COUNT(*) as total, COALESCE(SUM(p.valor_total), 0) as valor
            FROM pedidos p
            JOIN formas_pagamento fp ON p.forma_pagamento_id = fp.id
            WHERE p.status NOT IN ('cancelado') ${dateFilter.where}
            GROUP BY fp.id, fp.nome
        `, dateFilter.params);

        res.json({
            resumo: {
                total_pedidos: resumo.total_pedidos,
                valor_total: resumo.valor_total,
                ticket_medio: resumo.ticket_medio
            },
            series: series.map(s => ({
                periodo: s.periodo,
                total: s.total,
                valor: s.valor
            })),
            por_status: porStatus,
            por_pagamento: porPagamento
        });
    } catch (error) {
        console.error('Sales report error:', error);
        res.status(500).json({ error: 'Erro ao gerar relatório de vendas' });
    }
});

// ============================================
// RELATÓRIO DE PRODUTOS
// ============================================

app.get('/api/relatorios/produtos', authenticateToken, requireRole('administrador', 'atendente'), relatorioValidators.produtos, async (req, res) => {
    try {
        const { data_inicio, data_fim, categoria_id, limit = 50 } = req.query;

        const dateFilter = buildDateFilter('p', 'p.', { data_inicio, data_fim });

        let categoriaFilter = '';
        const params = [...dateFilter.params];

        if (categoria_id) {
            categoriaFilter = ' AND pr.categoria_id = ?';
            params.push(categoria_id);
        }

        params.push(parseInt(limit));

        const produtos = await query(`
            SELECT
                pr.id as produto_id,
                pr.nome as produto_nome,
                c.nome as categoria_nome,
                COUNT(pi.id) as quantidade_vendida,
                COALESCE(SUM(pi.quantidade * pi.preco_unitario), 0) as valor_total,
                COALESCE(AVG(a.estrelas), 0) as media_avaliacao
            FROM pedido_itens pi
            JOIN pedidos p ON pi.pedido_id = p.id
            JOIN produtos pr ON pi.produto_id = pr.id
            JOIN categorias c ON pr.categoria_id = c.id
            LEFT JOIN avaliacoes a ON a.pedido_id = p.id
            WHERE p.status NOT IN ('cancelado') ${dateFilter.where} ${categoriaFilter}
            GROUP BY pr.id, pr.nome, c.nome
            ORDER BY quantidade_vendida DESC
            LIMIT ?
        `, params);

        res.json(produtos);
    } catch (error) {
        console.error('Products report error:', error);
        res.status(500).json({ error: 'Erro ao gerar relatório de produtos' });
    }
});

// ============================================
// RELATÓRIO DE HORÁRIOS DE PICO
// ============================================

app.get('/api/relatorios/pico', authenticateToken, requireRole('administrador', 'atendente'), relatorioValidators.pico, async (req, res) => {
    try {
        const { data_inicio, data_fim } = req.query;

        const dateFilter = buildDateFilter('p', 'p.', { data_inicio, data_fim });

        const pico = await query(`
            SELECT
                CAST(strftime('%H', p.data_pedido) AS INTEGER) as hora,
                COUNT(*) as total_pedidos,
                COALESCE(AVG(p.valor_total), 0) as media_valor
            FROM pedidos p
            WHERE p.status NOT IN ('cancelado') ${dateFilter.where}
            GROUP BY hora
            ORDER BY hora
        `, dateFilter.params);

        // Preencher horas vazias
        const resultado = [];
        for (let h = 0; h < 24; h++) {
            const found = pico.find(p => p.hora === h);
            resultado.push({
                hora: h,
                total_pedidos: found ? found.total_pedidos : 0,
                media_valor: found ? found.media_valor : 0
            });
        }

        res.json(resultado);
    } catch (error) {
        console.error('Peak hours report error:', error);
        res.status(500).json({ error: 'Erro ao gerar relatório de pico' });
    }
});

// ============================================
// RELATÓRIO DE ENTREGAS
// ============================================

app.get('/api/relatorios/entregas', authenticateToken, requireRole('administrador', 'atendente'), relatorioValidators.entregas, async (req, res) => {
    try {
        const { data_inicio, data_fim, entregador_id } = req.query;

        const dateFilter = buildDateFilter('e', 'e.', { data_inicio, data_fim });

        let entregadorFilter = '';
        const params = [...dateFilter.params];

        if (entregador_id) {
            entregadorFilter = ' AND e.entregador_id = ?';
            params.push(entregador_id);
        }

        const entregas = await query(`
            SELECT
                u.id as entregador_id,
                u.nome as entregador_nome,
                COUNT(e.id) as total_entregas,
                COUNT(CASE WHEN e.status = 'entregue' THEN 1 END) as entregues,
                COUNT(CASE WHEN e.status = 'falha' THEN 1 END) as falhas,
                AVG(CASE
                    WHEN e.entregue_em IS NOT NULL AND e.saida_em IS NOT NULL
                    THEN (julianday(e.entregue_em) - julianday(e.saida_em)) * 24 * 60
                END) as tempo_medio_minutos
            FROM entregas e
            JOIN usuarios_admin u ON e.entregador_id = u.id
            JOIN pedidos p ON e.pedido_id = p.id
            WHERE p.status NOT IN ('cancelado') ${dateFilter.where} ${entregadorFilter}
            GROUP BY u.id, u.nome
            ORDER BY entregues DESC
        `, params);

        // Tempo médio por status
        const porStatus = await query(`
            SELECT
                e.status,
                COUNT(*) as total,
                AVG(CASE
                    WHEN e.entregue_em IS NOT NULL AND e.saida_em IS NOT NULL
                    THEN (julianday(e.entregue_em) - julianday(e.saida_em)) * 24 * 60
                END) as tempo_medio
            FROM entregas e
            JOIN pedidos p ON e.pedido_id = p.id
            WHERE p.status NOT IN ('cancelado') ${dateFilter.where} ${entregadorFilter}
            GROUP BY e.status
        `, params);

        res.json({ por_entregador: entregas, por_status: porStatus });
    } catch (error) {
        console.error('Deliveries report error:', error);
        res.status(500).json({ error: 'Erro ao gerar relatório de entregas' });
    }
});

// ============================================
// RELATÓRIO DE CLIENTES
// ============================================

app.get('/api/relatorios/clientes', authenticateToken, requireRole('administrador'), relatorioValidators.clientes, async (req, res) => {
    try {
        const { data_inicio, data_fim, limit = 50 } = req.query;

        const dateFilter = buildDateFilter('p', 'p.', { data_inicio, data_fim });

        const params = [...dateFilter.params, parseInt(limit)];

        const clientes = await query(`
            SELECT
                c.id as cliente_id,
                c.nome as cliente_nome,
                c.email as cliente_email,
                COUNT(p.id) as total_pedidos,
                COALESCE(SUM(p.valor_total), 0) as valor_total,
                MAX(p.data_pedido) as ultimo_pedido
            FROM clientes c
            JOIN pedidos p ON c.id = p.cliente_id
            WHERE p.status NOT IN ('cancelado') ${dateFilter.where}
            GROUP BY c.id, c.nome, c.email
            ORDER BY valor_total DESC
            LIMIT ?
        `, params);

        // Top clientes por frequência
        const topFrequencia = await query(`
            SELECT
                c.id, c.nome, c.email,
                COUNT(p.id) as total_pedidos
            FROM clientes c
            JOIN pedidos p ON c.id = p.cliente_id
            WHERE p.status NOT IN ('cancelado') ${dateFilter.where}
            GROUP BY c.id, c.nome, c.email
            ORDER BY total_pedidos DESC
            LIMIT 10
        `, dateFilter.params);

        res.json({ top_valor: clientes, top_frequencia: topFrequencia });
    } catch (error) {
        console.error('Clients report error:', error);
        res.status(500).json({ error: 'Erro ao gerar relatório de clientes' });
    }
});

// ============================================
// DASHBOARD RESUMIDO (para admin home)
// ============================================

app.get('/api/relatorios/dashboard', authenticateToken, requireRole('administrador', 'atendente', 'cozinha'), async (req, res) => {
    try {
        const hoje = new Date().toISOString().split('T')[0];

        // Pedidos hoje
        const pedidosHoje = await queryOne(`
            SELECT COUNT(*) as total, COALESCE(SUM(valor_total), 0) as valor
            FROM pedidos
            WHERE date(data_pedido) = date(?) AND status != 'cancelado'
        `, [hoje]);

        // Pedidos por status
        const porStatus = await query(`
            SELECT status, COUNT(*) as total
            FROM pedidos
            WHERE date(data_pedido) = date(?) AND status != 'cancelado'
            GROUP BY status
        `, [hoje]);

        // Pedidos pendentes (confirmado + preparando)
        const pendentes = await queryOne(`
            SELECT COUNT(*) as total FROM pedidos WHERE status IN ('pendente', 'confirmado', 'preparando')
        `);

        // Em entrega
        const emEntrega = await queryOne(`
            SELECT COUNT(*) as total FROM entregas WHERE status IN ('aceita', 'retirada', 'em_rota')
        `);

        // Avaliação média
        const avaliacao = await queryOne(`
            SELECT AVG(estrelas) as media FROM avaliacoes
        `);

        // Pico horário hoje
        const picoHoje = await query(`
            SELECT CAST(strftime('%H', data_pedido) AS INTEGER) as hora, COUNT(*) as pedidos
            FROM pedidos
            WHERE date(data_pedido) = date(?) AND status != 'cancelado'
            GROUP BY hora ORDER BY hora
        `, [hoje]);

        const picoFormatado = [];
        for (let h = 0; h < 24; h++) {
            const found = picoHoje.find(p => p.hora === h);
            picoFormatado.push({ hora: h, pedidos: found ? found.pedidos : 0 });
        }

        res.json({
            pedidos_hoje: pedidosHoje.total,
            valor_hoje: pedidosHoje.valor,
            pedidos_pendentes: pendentes.total,
            pedidos_preparando: porStatus.find(s => s.status === 'preparando')?.total || 0,
            pedidos_em_entrega: emEntrega.total,
            avaliacao_media: Number(avaliacao.media?.toFixed(1) || 0),
            pico_horario: picoFormatado
        });
    } catch (error) {
        console.error('Dashboard report error:', error);
        res.status(500).json({ error: 'Erro ao gerar dashboard' });
    }
});

// ============================================
// EXPORTAÇÃO CSV
// ============================================

app.get('/api/relatorios/exportar/:tipo', authenticateToken, requireRole('administrador'), async (req, res) => {
    try {
        const { tipo } = req.params;
        const { data_inicio, data_fim } = req.query;

        const dateFilter = buildDateFilter('p', 'p.', { data_inicio, data_fim });

        let data = [];
        let filename = '';
        let headers = [];

        switch (tipo) {
            case 'vendas':
                data = await query(`
                    SELECT p.numero_pedido, p.data_pedido, p.cliente_nome, p.status, p.valor_total, fp.nome as forma_pagamento
                    FROM pedidos p
                    JOIN formas_pagamento fp ON p.forma_pagamento_id = fp.id
                    WHERE p.status != 'cancelado' ${dateFilter.where}
                    ORDER BY p.data_pedido DESC
                `, dateFilter.params);
                filename = `vendas_${data_inicio || 'inicio'}_${data_fim || 'fim'}.csv`;
                headers = ['Número', 'Data', 'Cliente', 'Status', 'Valor', 'Pagamento'];
                break;

            case 'produtos':
                data = await query(`
                    SELECT pr.nome as produto, c.nome as categoria, COUNT(pi.id) as qtd_vendida, SUM(pi.quantidade * pi.preco_unitario) as valor_total
                    FROM pedido_itens pi
                    JOIN pedidos p ON pi.pedido_id = p.id
                    JOIN produtos pr ON pi.produto_id = pr.id
                    JOIN categorias c ON pr.categoria_id = c.id
                    WHERE p.status != 'cancelado' ${dateFilter.where}
                    GROUP BY pr.id, pr.nome, c.nome
                    ORDER BY qtd_vendida DESC
                `, dateFilter.params);
                filename = `produtos_${data_inicio || 'inicio'}_${data_fim || 'fim'}.csv`;
                headers = ['Produto', 'Categoria', 'Qtd Vendida', 'Valor Total'];
                break;

            default:
                return res.status(400).json({ error: 'Tipo de relatório inválido' });
        }

        // Gerar CSV
        const csv = [
            headers.join(','),
            ...data.map(row => Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send('﻿' + csv); // BOM para UTF-8 no Excel
    } catch (error) {
        console.error('Export report error:', error);
        res.status(500).json({ error: 'Erro ao exportar relatório' });
    }
});

const PORT = config.server.port + 6; // 3006
app.listen(PORT, () => {
    console.log(`📊 Report Service rodando na porta ${PORT}`);
});

export default app;