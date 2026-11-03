import express from 'express';
import db from '../database/connection.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { relatorioValidators } from '../middleware/validation.js';

const router = express.Router();

// All routes require admin authentication
router.use(authMiddleware);
router.use(requireRole('administrador', 'atendente'));

/**
 * GET /api/relatorios/vendas
 * Relatório de vendas por período
 */
router.get('/vendas', relatorioValidators.vendas, async (req, res) => {
    try {
        const { data_inicio, data_fim, periodo } = req.query;

        let whereClause = 'WHERE 1=1';
        const params = [];

        if (data_inicio) {
            whereClause += ' AND date(data_pedido) >= date(?)';
            params.push(data_inicio);
        }
        if (data_fim) {
            whereClause += ' AND date(data_pedido) <= date(?)';
            params.push(data_fim);
        }

        // Only completed orders
        whereClause += " AND status IN ('entregue')";

        // Determine grouping
        let groupBy, selectDate;
        switch (periodo) {
            case 'semana':
                groupBy = "strftime('%Y-%W', data_pedido)";
                selectDate = "strftime('%Y-%W', data_pedido) as periodo";
                break;
            case 'mes':
                groupBy = "strftime('%Y-%m', data_pedido)";
                selectDate = "strftime('%Y-%m', data_pedido) as periodo";
                break;
            case 'ano':
                groupBy = "strftime('%Y', data_pedido)";
                selectDate = "strftime('%Y', data_pedido) as periodo";
                break;
            case 'dia':
            default:
                groupBy = "date(data_pedido)";
                selectDate = "date(data_pedido) as periodo";
                break;
        }

        // Main query - sales by period
        const vendas = await db.query(`
            SELECT
                ${selectDate},
                COUNT(*) as total_pedidos,
                SUM(valor_total) as faturamento_total,
                SUM(valor_entrega) as total_entrega,
                SUM(valor_desconto) as total_desconto,
                AVG(valor_total) as ticket_medio
            FROM pedidos
            ${whereClause}
            GROUP BY ${groupBy}
            ORDER BY periodo DESC
        `, params);

        // Summary totals
        const resumo = await db.queryOne(`
            SELECT
                COUNT(*) as total_pedidos,
                SUM(valor_total) as faturamento_total,
                SUM(valor_entrega) as total_entrega,
                SUM(valor_desconto) as total_desconto,
                AVG(valor_total) as ticket_medio
            FROM pedidos
            ${whereClause}
        `, params);

        // Sales by payment method
        const porPagamento = await db.query(`
            SELECT
                fp.nome as forma_pagamento,
                COUNT(p.id) as quantidade,
                SUM(p.valor_total) as valor_total
            FROM pedidos p
            JOIN formas_pagamento fp ON p.forma_pagamento_id = fp.id
            ${whereClause}
            GROUP BY fp.id, fp.nome
            ORDER BY quantidade DESC
        `, params);

        // Sales by status
        const porStatus = await db.query(`
            SELECT
                status,
                COUNT(*) as quantidade,
                SUM(valor_total) as valor_total
            FROM pedidos
            ${whereClause}
            GROUP BY status
            ORDER BY quantidade DESC
        `, params);

        res.json({
            periodo: periodo || 'dia',
            data_inicio,
            data_fim,
            resumo,
            vendas_por_periodo: vendas,
            por_forma_pagamento: porPagamento,
            por_status: porStatus
        });
    } catch (error) {
        console.error('Error generating sales report:', error);
        res.status(500).json({ error: 'Erro ao gerar relatório de vendas' });
    }
});

/**
 * GET /api/relatorios/produtos
 * Relatório de produtos mais vendidos
 */
router.get('/produtos', relatorioValidators.produtos, async (req, res) => {
    try {
        const { data_inicio, data_fim, categoria_id, limit = 20 } = req.query;

        let whereClause = 'WHERE p.status IN (\'entregue\')';
        const params = [];

        if (data_inicio) {
            whereClause += ' AND date(p.data_pedido) >= date(?)';
            params.push(data_inicio);
        }
        if (data_fim) {
            whereClause += ' AND date(p.data_pedido) <= date(?)';
            params.push(data_fim);
        }
        if (categoria_id) {
            whereClause += ' AND prod.categoria_id = ?';
            params.push(categoria_id);
        }

        // Top selling products
        const produtos = await db.query(`
            SELECT
                prod.id,
                prod.nome,
                prod.preco_base,
                c.nome as categoria,
                SUM(pi.quantidade) as total_vendido,
                SUM(pi.quantidade * pi.preco_unitario) as faturamento,
                COUNT(DISTINCT pi.pedido_id) as pedidos_unicos
            FROM pedido_itens pi
            JOIN pedidos p ON pi.pedido_id = p.id
            JOIN produtos prod ON pi.produto_id = prod.id
            LEFT JOIN categorias c ON prod.categoria_id = c.id
            ${whereClause}
            GROUP BY prod.id, prod.nome, prod.preco_base, c.nome
            ORDER BY total_vendido DESC
            LIMIT ?
        `, [...params, parseInt(limit)]);

        // Products never sold
        const nuncaVendidos = await db.query(`
            SELECT
                prod.id,
                prod.nome,
                prod.preco_base,
                c.nome as categoria
            FROM produtos prod
            LEFT JOIN categorias c ON prod.categoria_id = c.id
            WHERE prod.disponivel = 1
            AND prod.id NOT IN (
                SELECT DISTINCT pi.produto_id
                FROM pedido_itens pi
                JOIN pedidos p ON pi.pedido_id = p.id
                ${whereClause}
            )
            ORDER BY prod.nome
        `, params);

        // Category summary
        const porCategoria = await db.query(`
            SELECT
                c.id,
                c.nome as categoria,
                COUNT(DISTINCT prod.id) as total_produtos,
                SUM(pi.quantidade) as total_vendido,
                SUM(pi.quantidade * pi.preco_unitario) as faturamento
            FROM pedido_itens pi
            JOIN pedidos p ON pi.pedido_id = p.id
            JOIN produtos prod ON pi.produto_id = prod.id
            JOIN categorias c ON prod.categoria_id = c.id
            ${whereClause}
            GROUP BY c.id, c.nome
            ORDER BY faturamento DESC
        `, params);

        res.json({
            data_inicio,
            data_fim,
            categoria_id,
            top_produtos: produtos,
            produtos_nunca_vendidos: nuncaVendidos,
            por_categoria: porCategoria
        });
    } catch (error) {
        console.error('Error generating products report:', error);
        res.status(500).json({ error: 'Erro ao gerar relatório de produtos' });
    }
});

/**
 * GET /api/relatorios/pico
 * Relatório de horários de pico
 */
router.get('/pico', relatorioValidators.pico, async (req, res) => {
    try {
        const { data_inicio, data_fim } = req.query;

        let whereClause = 'WHERE status IN (\'entregue\')';
        const params = [];

        if (data_inicio) {
            whereClause += ' AND date(data_pedido) >= date(?)';
            params.push(data_inicio);
        }
        if (data_fim) {
            whereClause += ' AND date(data_pedido) <= date(?)';
            params.push(data_fim);
        }

        // Orders by hour of day
        const porHora = await db.query(`
            SELECT
                CAST(strftime('%H', data_pedido) AS INTEGER) as hora,
                COUNT(*) as total_pedidos,
                SUM(valor_total) as faturamento
            FROM pedidos
            ${whereClause}
            GROUP BY hora
            ORDER BY hora
        `, params);

        // Orders by day of week
        const porDiaSemana = await db.query(`
            SELECT
                CASE strftime('%w', data_pedido)
                    WHEN '0' THEN 'Domingo'
                    WHEN '1' THEN 'Segunda'
                    WHEN '2' THEN 'Terça'
                    WHEN '3' THEN 'Quarta'
                    WHEN '4' THEN 'Quinta'
                    WHEN '5' THEN 'Sexta'
                    WHEN '6' THEN 'Sábado'
                END as dia_semana,
                CAST(strftime('%w', data_pedido) AS INTEGER) as dia_numero,
                COUNT(*) as total_pedidos,
                SUM(valor_total) as faturamento
            FROM pedidos
            ${whereClause}
            GROUP BY dia_numero
            ORDER BY dia_numero
        `, params);

        // Orders by hour and day of week (heatmap)
        const heatmap = await db.query(`
            SELECT
                CAST(strftime('%w', data_pedido) AS INTEGER) as dia_semana,
                CAST(strftime('%H', data_pedido) AS INTEGER) as hora,
                COUNT(*) as total_pedidos
            FROM pedidos
            ${whereClause}
            GROUP BY dia_semana, hora
            ORDER BY dia_semana, hora
        `, params);

        // Average orders per hour
        const mediaPorHora = await db.query(`
            SELECT
                CAST(strftime('%H', data_pedido) AS INTEGER) as hora,
                AVG(contagem) as media_pedidos
            FROM (
                SELECT
                    date(data_pedido) as dia,
                    CAST(strftime('%H', data_pedido) AS INTEGER) as hora,
                    COUNT(*) as contagem
                FROM pedidos
                ${whereClause}
                GROUP BY dia, hora
            )
            GROUP BY hora
            ORDER BY hora
        `, params);

        res.json({
            data_inicio,
            data_fim,
            por_hora: porHora,
            por_dia_semana: porDiaSemana,
            heatmap,
            media_por_hora: mediaPorHora
        });
    } catch (error) {
        console.error('Error generating peak hours report:', error);
        res.status(500).json({ error: 'Erro ao gerar relatório de horários de pico' });
    }
});

/**
 * GET /api/relatorios/entregas
 * Relatório de entregas
 */
router.get('/entregas', relatorioValidators.entregas, async (req, res) => {
    try {
        const { data_inicio, data_fim, entregador_id } = req.query;

        let whereClause = 'WHERE 1=1';
        const params = [];

        if (data_inicio) {
            whereClause += ' AND date(e.created_at) >= date(?)';
            params.push(data_inicio);
        }
        if (data_fim) {
            whereClause += ' AND date(e.created_at) <= date(?)';
            params.push(data_fim);
        }
        if (entregador_id) {
            whereClause += ' AND e.entregador_id = ?';
            params.push(entregador_id);
        }

        // Delivery summary
        const resumo = await db.queryOne(`
            SELECT
                COUNT(*) as total_entregas,
                SUM(CASE WHEN status = 'entregue' THEN 1 ELSE 0 END) as entregues,
                SUM(CASE WHEN status = 'falha' THEN 1 ELSE 0 END) as falhas,
                SUM(CASE WHEN status IN ('pendente', 'aceita', 'retirada', 'em_rota') THEN 1 ELSE 0 END) as em_andamento,
                AVG(
                    CASE
                        WHEN entregue_em IS NOT NULL AND saida_em IS NOT NULL
                        THEN (julianday(entregue_em) - julianday(saida_em)) * 24 * 60
                    END
                ) as tempo_medio_minutos
            FROM entregas e
            ${whereClause}
        `, params);

        // Deliveries by status
        const porStatus = await db.query(`
            SELECT
                status,
                COUNT(*) as quantidade
            FROM entregas
            ${whereClause}
            GROUP BY status
            ORDER BY
                CASE status
                    WHEN 'pendente' THEN 1
                    WHEN 'aceita' THEN 2
                    WHEN 'retirada' THEN 3
                    WHEN 'em_rota' THEN 4
                    WHEN 'entregue' THEN 5
                    WHEN 'falha' THEN 6
                END
        `, params);

        // Deliveries by deliverer
        const porEntregador = await db.query(`
            SELECT
                e.entregador_id,
                u.nome as entregador_nome,
                COUNT(*) as total,
                SUM(CASE WHEN e.status = 'entregue' THEN 1 ELSE 0 END) as entregues,
                SUM(CASE WHEN e.status = 'falha' THEN 1 ELSE 0 END) as falhas,
                AVG(
                    CASE
                        WHEN e.entregue_em IS NOT NULL AND e.saida_em IS NOT NULL
                        THEN (julianday(e.entregue_em) - julianday(e.saida_em)) * 24 * 60
                    END
                ) as tempo_medio_minutos
            FROM entregas e
            LEFT JOIN usuarios_admin u ON e.entregador_id = u.id
            ${whereClause}
            GROUP BY e.entregador_id, u.nome
            ORDER BY total DESC
        `, params);

        // Daily deliveries
        const porDia = await db.query(`
            SELECT
                date(created_at) as dia,
                COUNT(*) as total,
                SUM(CASE WHEN status = 'entregue' THEN 1 ELSE 0 END) as entregues,
                SUM(CASE WHEN status = 'falha' THEN 1 ELSE 0 END) as falhas
            FROM entregas
            ${whereClause}
            GROUP BY date(created_at)
            ORDER BY dia DESC
        `, params);

        res.json({
            data_inicio,
            data_fim,
            entregador_id,
            resumo,
            por_status: porStatus,
            por_entregador: porEntregador,
            por_dia: porDia
        });
    } catch (error) {
        console.error('Error generating deliveries report:', error);
        res.status(500).json({ error: 'Erro ao gerar relatório de entregas' });
    }
});

/**
 * GET /api/relatorios/clientes
 * Relatório de clientes
 */
router.get('/clientes', async (req, res) => {
    try {
        const { data_inicio, data_fim, limit = 20 } = req.query;

        let whereClause = 'WHERE 1=1';
        const params = [];

        if (data_inicio) {
            whereClause += ' AND date(c.created_at) >= date(?)';
            params.push(data_inicio);
        }
        if (data_fim) {
            whereClause += ' AND date(c.created_at) <= date(?)';
            params.push(data_fim);
        }

        // Top clients by orders
        const topClientes = await db.query(`
            SELECT
                c.id,
                c.nome,
                c.email,
                c.telefone,
                COUNT(p.id) as total_pedidos,
                SUM(p.valor_total) as total_gasto,
                AVG(p.valor_total) as ticket_medio,
                MAX(p.data_pedido) as ultimo_pedido
            FROM clientes c
            JOIN pedidos p ON c.id = p.cliente_id
            ${whereClause}
            GROUP BY c.id, c.nome, c.email, c.telefone
            ORDER BY total_gasto DESC
            LIMIT ?
        `, [...params, parseInt(limit)]);

        // New clients
        const novosClientes = await db.query(`
            SELECT
                date(created_at) as dia,
                COUNT(*) as total
            FROM clientes
            ${whereClause}
            GROUP BY date(created_at)
            ORDER BY dia DESC
        `, params);

        // Client summary
        const resumo = await db.queryOne(`
            SELECT
                COUNT(*) as total_clientes,
                SUM(CASE WHEN ativo = 1 THEN 1 ELSE 0 END) as ativos,
                SUM(CASE WHEN ativo = 0 THEN 1 ELSE 0 END) as inativos
            FROM clientes
        `, []);

        res.json({
            data_inicio,
            data_fim,
            resumo,
            top_clientes: topClientes,
            novos_clientes_por_dia: novosClientes
        });
    } catch (error) {
        console.error('Error generating clients report:', error);
        res.status(500).json({ error: 'Erro ao gerar relatório de clientes' });
    }
});

/**
 * GET /api/relatorios/dashboard
 * Resumo geral para dashboard
 */
router.get('/dashboard', async (req, res) => {
    try {
        const hoje = new Date().toISOString().split('T')[0];
        const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

        // Today's stats
        const hojeStats = await db.queryOne(`
            SELECT
                COUNT(*) as pedidos_hoje,
                SUM(CASE WHEN status = 'entregue' THEN 1 ELSE 0 END) as entregues_hoje,
                SUM(CASE WHEN status = 'cancelado' THEN 1 ELSE 0 END) as cancelados_hoje,
                SUM(valor_total) as faturamento_hoje
            FROM pedidos
            WHERE date(data_pedido) = date(?)
        `, [hoje]);

        // Month stats
        const mesStats = await db.queryOne(`
            SELECT
                COUNT(*) as pedidos_mes,
                SUM(CASE WHEN status = 'entregue' THEN 1 ELSE 0 END) as entregues_mes,
                SUM(CASE WHEN status = 'cancelado' THEN 1 ELSE 0 END) as cancelados_mes,
                SUM(valor_total) as faturamento_mes
            FROM pedidos
            WHERE date(data_pedido) >= date(?)
        `, [inicioMes]);

        // Pending orders
        const pendentes = await db.queryOne(`
            SELECT COUNT(*) as total
            FROM pedidos
            WHERE status IN ('pendente', 'confirmado', 'preparando')
        `, []);

        // Out for delivery
        const emEntrega = await db.queryOne(`
            SELECT COUNT(*) as total
            FROM pedidos
            WHERE status = 'saiu_entrega'
        `, []);

        // Low stock products (if we had stock control - placeholder)
        // Products not available
        const indisponiveis = await db.queryOne(`
            SELECT COUNT(*) as total
            FROM produtos
            WHERE disponivel = 0
        `, []);

        // Recent orders
        const pedidosRecentes = await db.query(`
            SELECT
                p.id,
                p.cliente_nome,
                p.status,
                p.valor_total,
                p.data_pedido,
                c.nome as cliente_cadastrado
            FROM pedidos p
            LEFT JOIN clientes c ON p.cliente_id = c.id
            ORDER BY p.data_pedido DESC
            LIMIT 10
        `, []);

        // Active deliverers
        const entregadoresAtivos = await db.query(`
            SELECT
                u.id,
                u.nome,
                COUNT(e.id) as entregas_hoje
            FROM usuarios_admin u
            LEFT JOIN entregas e ON u.id = e.entregador_id AND date(e.created_at) = date(?)
            WHERE u.perfil = 'entregador' AND u.ativo = 1
            GROUP BY u.id, u.nome
            ORDER BY entregas_hoje DESC
        `, [hoje]);

        res.json({
            hoje: hojeStats,
            mes: mesStats,
            pedidos_pendentes: pendentes.total,
            pedidos_em_entrega: emEntrega.total,
            produtos_indisponiveis: indisponiveis.total,
            pedidos_recentes: pedidosRecentes,
            entregadores_ativos: entregadoresAtivos
        });
    } catch (error) {
        console.error('Error generating dashboard:', error);
        res.status(500).json({ error: 'Erro ao gerar dashboard' });
    }
});

export default router;