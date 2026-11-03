import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import crypto from 'crypto';
import { config, validateConfig } from '../shared/config/index.js';
import { generalLimiter, sensitiveApiLimiter, createLimiter } from '../shared/middleware/rateLimiter.js';
import { authenticateToken, optionalAuth, requireRole } from '../shared/middleware/auth.js';
import { commonValidators } from '../shared/middleware/validation.js';
import { query, queryOne, run, transaction } from '../shared/database/connection.js';
import { generateOrderNumber } from '../shared/utils/index.js';

// Validar configuração
validateConfig();

// Mercado Pago SDK (simulado - usar mercadopago npm package em produção)
// import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

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
    res.json({ status: 'ok', service: 'payment', timestamp: new Date().toISOString() });
});

// ============================================
// MERCADO PAGO - PREFERÊNCIA DE PAGAMENTO
// ============================================

// Criar preferência de pagamento (PIX, Cartão, etc.)
app.post('/api/pagamentos/mercado-pago/preferencia', authenticateToken, requireRole('cliente'), createLimiter, async (req, res) => {
    try {
        const { pedido_id, itens, payer } = req.body;

        // Verificar pedido
        const pedido = await queryOne('SELECT * FROM pedidos WHERE id = ? AND cliente_id = ?', [pedido_id, req.user.id]);
        if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado' });
        if (pedido.status !== 'pendente') return res.status(400).json({ error: 'Pedido não está pendente' });

        if (!config.mercadoPago.accessToken) {
            return res.status(503).json({ error: 'Mercado Pago não configurado' });
        }

        // Em produção, usar SDK oficial:
        // const client = new MercadoPagoConfig({ accessToken: config.mercadoPago.accessToken });
        // const preference = new Preference(client);
        // const result = await preference.create({ body: preferenceData });

        // Simulação para desenvolvimento
        const preferenceData = {
            items: itens.map(item => ({
                title: item.nome,
                quantity: item.quantidade,
                unit_price: item.preco_unitario,
                currency_id: 'BRL'
            })),
            payer: {
                email: payer?.email || req.user.email,
                name: payer?.nome || req.user.nome,
                phone: { area_code: payer?.telefone?.match(/\((\d{2})\)/)?.[1] || '11', number: payer?.telefone?.replace(/\D/g).slice(2) || '' }
            },
            back_urls: {
                success: `${config.frontend.url}/checkout/sucesso`,
                failure: `${config.frontend.url}/checkout/falha`,
                pending: `${config.frontend.url}/checkout/pendente`
            },
            auto_return: 'approved',
            external_reference: pedido.numero_pedido,
            notification_url: `${config.frontend.url.replace('http://', 'https://')}/api/pagamentos/mercado-pago/webhook`
        };

        // Simular resposta do Mercado Pago
        const mockPreference = {
            id: `pref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            init_point: `${config.frontend.url}/checkout/mercado-pago?pref_id=mock_${Date.now()}`,
            sandbox_init_point: `${config.frontend.url}/checkout/mercado-pago?pref_id=mock_${Date.now()}&sandbox=true`
        };

        // Salvar preferência no banco para referência
        await run(
            'INSERT INTO pagamentos_mercado_pago (pedido_id, preference_id, status, dados) VALUES (?, ?, ?, ?)',
            [pedido_id, mockPreference.id, 'pendente', JSON.stringify(preferenceData)]
        );

        res.json({
            preference_id: mockPreference.id,
            init_point: mockPreference.init_point,
            sandbox_init_point: mockPreference.sandbox_init_point
        });
    } catch (error) {
        console.error('Create preference error:', error);
        res.status(500).json({ error: 'Erro ao criar preferência de pagamento' });
    }
});

// ============================================
// MERCADO PAGO - WEBHOOK
// ============================================

app.post('/api/pagamentos/mercado-pago/webhook', async (req, res) => {
    try {
        // Verificar assinatura (em produção)
        // const signature = req.headers['x-signature'];
        // const requestId = req.headers['x-request-id'];
        // Verificar com config.mercadoPago.webhookSecret

        const { type, data } = req.body;

        if (type === 'payment') {
            const paymentId = data.id;

            // Em produção, buscar detalhes do pagamento:
            // const payment = new Payment(client);
            // const paymentInfo = await payment.get({ id: paymentId });

            // Simular processamento
            console.log('Payment webhook received:', paymentId, type);

            // Buscar pedido pela external_reference
            // const externalReference = paymentInfo.external_reference;
            // const pedido = await queryOne('SELECT * FROM pedidos WHERE numero_pedido = ?', [externalReference]);

            // Processar baseado no status
            // if (paymentInfo.status === 'approved') { ... }
        }

        res.status(200).json({ received: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Erro no webhook' });
    }
});

// ============================================
// PIX - GERAR QR CODE (Simulado)
// ============================================

app.post('/api/pagamentos/pix/gerar', authenticateToken, requireRole('cliente'), createLimiter, async (req, res) => {
    try {
        const { pedido_id } = req.body;

        const pedido = await queryOne('SELECT * FROM pedidos WHERE id = ? AND cliente_id = ?', [pedido_id, req.user.id]);
        if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado' });
        if (pedido.status !== 'pendente') return res.status(400).json({ error: 'Pedido não está pendente' });

        // Em produção, usar API do Banco Central ou Mercado Pago PIX
        // Gerar QR Code PIX dinâmico (EMV)

        const pixKey = 'pix@fragalanches.com';
        const merchantName = 'FRAGA LANCHES';
        const merchantCity = 'SAO PAULO';
        const txid = `PED${pedido.numero_pedido}${Date.now().toString().slice(-6)}`;
        const amount = pedido.valor_total.toFixed(2);

        // EMV PIX payload (simplificado)
        const pixPayload = `00020126580014br.gov.bcb.pix0136${pixKey}520458125303986540${amount}5802BR5925${merchantName}6009${merchantCity}62070503***6304`;

        // Gerar QR Code como base64 (em produção usar biblioteca qrcode)
        const qrCodeBase64 = `data:image/png;base64,${Buffer.from(pixPayload).toString('base64')}`;

        // Salvar transação PIX
        await run(
            'INSERT INTO transacoes_pix (pedido_id, txid, payload, status, valor) VALUES (?, ?, ?, ?, ?)',
            [pedido_id, txid, pixPayload, 'pendente', pedido.valor_total]
        );

        res.json({
            txid,
            pix_copia_cola: pixPayload,
            qr_code_base64: qrCodeBase64,
            valor: pedido.valor_total,
            expiracao: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 min
        });
    } catch (error) {
        console.error('Generate PIX error:', error);
        res.status(500).json({ error: 'Erro ao gerar PIX' });
    }
});

// Consultar status PIX
app.get('/api/pagamentos/pix/status/:txid', authenticateToken, requireRole('cliente'), async (req, res) => {
    try {
        const transacao = await queryOne('SELECT * FROM transacoes_pix WHERE txid = ?', [req.params.txid]);
        if (!transacao) return res.status(404).json({ error: 'Transação não encontrada' });

        const pedido = await queryOne('SELECT * FROM pedidos WHERE id = ? AND cliente_id = ?', [transacao.pedido_id, req.user.id]);
        if (!pedido) return res.status(403).json({ error: 'Acesso negado' });

        // Em produção, consultar API do banco/MP
        // Simular status
        const mockStatus = Math.random() > 0.7 ? 'aprovado' : 'pendente';

        if (mockStatus === 'aprovado' && transacao.status === 'pendente') {
            await transaction(() => {
                run('UPDATE transacoes_pix SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['aprovado', transacao.id]);
                run('UPDATE pedidos SET status = "confirmado", data_atualizacao = CURRENT_TIMESTAMP WHERE id = ?', [transacao.pedido_id]);
                run(
                    'INSERT INTO pedido_status_historico (pedido_id, status_anterior, status_novo, motivo) VALUES (?, ?, ?, ?)',
                    [transacao.pedido_id, 'pendente', 'confirmado', 'Pagamento PIX aprovado']
                );
            });
        }

        res.json({ status: mockStatus, txid: transacao.txid, valor: transacao.valor });
    } catch (error) {
        console.error('PIX status error:', error);
        res.status(500).json({ error: 'Erro ao consultar status PIX' });
    }
});

// ============================================
// TOKENIZAÇÃO DE CARTÃO (Mercado Pago)
// ============================================

// Salvar cartão tokenizado
app.post('/api/pagamentos/cartao/tokenizar', authenticateToken, requireRole('cliente'), createLimiter, async (req, res) => {
    try {
        const { token, cardholder_name, cardholder_cpf, installments } = req.body;

        if (!config.mercadoPago.accessToken) {
            return res.status(503).json({ error: 'Mercado Pago não configurado' });
        }

        // Em produção:
        // const client = new MercadoPagoConfig({ accessToken: config.mercadoPago.accessToken });
        // const cardToken = new CardToken(client);
        // const savedCard = await cardToken.save({ body: { token, cardholder_name, cardholder_cpf } });

        // Simular
        const mockCard = {
            id: `card_${Date.now()}`,
            first_six_digits: '450995',
            last_four_digits: '1234',
            expiration_month: 12,
            expiration_year: 2028,
            cardholder: { name: cardholder_name, identification: { CPF: cardholder_cpf } }
        };

        // Salvar referência (não salvar dados sensíveis!)
        await run(
            'INSERT INTO cartoes_tokenizados (cliente_id, mp_card_id, brand, last_four, exp_month, exp_year, cardholder_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [req.user.id, mockCard.id, 'visa', mockCard.last_four_digits, mockCard.expiration_month, mockCard.expiration_year, cardholder_name]
        );

        res.json({
            id: mockCard.id,
            brand: 'visa',
            last_four: mockCard.last_four_digits,
            exp_month: mockCard.expiration_month,
            exp_year: mockCard.expiration_year
        });
    } catch (error) {
        console.error('Tokenize card error:', error);
        res.status(500).json({ error: 'Erro ao tokenizar cartão' });
    }
});

// Listar cartões salvos
app.get('/api/pagamentos/cartao/meus', authenticateToken, requireRole('cliente'), async (req, res) => {
    try {
        const cartoes = await query(
            'SELECT id, brand, last_four, exp_month, exp_year, cardholder_name, created_at FROM cartoes_tokenizados WHERE cliente_id = ? AND ativo = 1 ORDER BY created_at DESC',
            [req.user.id]
        );
        res.json(cartoes);
    } catch (error) {
        console.error('List cards error:', error);
        res.status(500).json({ error: 'Erro ao buscar cartões' });
    }
});

// Remover cartão
app.delete('/api/pagamentos/cartao/:id', authenticateToken, requireRole('cliente'), commonValidators.idParam, async (req, res) => {
    try {
        await run('UPDATE cartoes_tokenizados SET ativo = 0 WHERE id = ? AND cliente_id = ?', [req.params.id, req.user.id]);
        res.json({ message: 'Cartão removido' });
    } catch (error) {
        console.error('Delete card error:', error);
        res.status(500).json({ error: 'Erro ao remover cartão' });
    }
});

// ============================================
// PAGAMENTO COM CARTÃO SALVO
// ============================================

app.post('/api/pagamentos/cartao/pagar', authenticateToken, requireRole('cliente'), createLimiter, async (req, res) => {
    try {
        const { pedido_id, card_id, installments = 1 } = req.body;

        const pedido = await queryOne('SELECT * FROM pedidos WHERE id = ? AND cliente_id = ?', [pedido_id, req.user.id]);
        if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado' });
        if (pedido.status !== 'pendente') return res.status(400).json({ error: 'Pedido não está pendente' });

        const cartao = await queryOne('SELECT * FROM cartoes_tokenizados WHERE id = ? AND cliente_id = ? AND ativo = 1', [card_id, req.user.id]);
        if (!cartao) return res.status(404).json({ error: 'Cartão não encontrado' });

        if (!config.mercadoPago.accessToken) {
            return res.status(503).json({ error: 'Mercado Pago não configurado' });
        }

        // Em produção:
        // const client = new MercadoPagoConfig({ accessToken: config.mercadoPago.accessToken });
        // const payment = new Payment(client);
        // const result = await payment.create({ body: { transaction_amount: pedido.valor_total, token: cartao.mp_card_id, installments, payment_method_id: 'visa', payer: { email: req.user.email } } });

        // Simular aprovação
        const approved = Math.random() > 0.2; // 80% aprovação

        if (approved) {
            await transaction(() => {
                run('UPDATE pedidos SET status = "confirmado", data_atualizacao = CURRENT_TIMESTAMP WHERE id = ?', [pedido_id]);
                run(
                    'INSERT INTO pedido_status_historico (pedido_id, status_anterior, status_novo, motivo) VALUES (?, ?, ?, ?)',
                    [pedido_id, 'pendente', 'confirmado', `Pagamento com cartão ****${cartao.last_four} aprovado`]
                );
                run(
                    'INSERT INTO pagamentos_cartao (pedido_id, card_id, valor, parcelas, status, mp_payment_id) VALUES (?, ?, ?, ?, ?, ?)',
                    [pedido_id, card_id, pedido.valor_total, installments, 'aprovado', `pay_mock_${Date.now()}`]
                );
            });

            res.json({ status: 'aprovado', message: 'Pagamento aprovado com sucesso' });
        } else {
            await run(
                'INSERT INTO pagamentos_cartao (pedido_id, card_id, valor, parcelas, status, mp_payment_id) VALUES (?, ?, ?, ?, ?, ?)',
                [pedido_id, card_id, pedido.valor_total, installments, 'rejeitado', `pay_mock_${Date.now()}`]
            );
            res.status(400).json({ status: 'rejeitado', message: 'Pagamento não autorizado' });
        }
    } catch (error) {
        console.error('Card payment error:', error);
        res.status(500).json({ error: 'Erro ao processar pagamento' });
    }
});

// ============================================
// STATUS DE PAGAMENTO DO PEDIDO
// ============================================

app.get('/api/pedidos/:id/pagamento', authenticateToken, async (req, res) => {
    try {
        const pedido = await queryOne('SELECT * FROM pedidos WHERE id = ?', [req.params.id]);
        if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado' });

        // Verificar permissão
        if (req.user.tipo === 'cliente' && pedido.cliente_id !== req.user.id) {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        // Buscar transações relacionadas
        const [pixTransacoes, cartaoPagamentos, mpPreferencias] = await Promise.all([
            query('SELECT * FROM transacoes_pix WHERE pedido_id = ? ORDER BY created_at DESC', [req.params.id]),
            query('SELECT * FROM pagamentos_cartao WHERE pedido_id = ? ORDER BY created_at DESC', [req.params.id]),
            query('SELECT * FROM pagamentos_mercado_pago WHERE pedido_id = ? ORDER BY created_at DESC', [req.params.id])
        ]);

        res.json({
            pedido_status: pedido.status,
            valor_total: pedido.valor_total,
            forma_pagamento_id: pedido.forma_pagamento_id,
            pix: pixTransacoes,
            cartao: cartaoPagamentos,
            mercado_pago: mpPreferencias
        });
    } catch (error) {
        console.error('Payment status error:', error);
        res.status(500).json({ error: 'Erro ao buscar status de pagamento' });
    }
});

// ============================================
// REEMBOLSO (Admin)
// ============================================

app.post('/api/admin/pagamentos/reembolso', authenticateToken, requireRole('administrador'), async (req, res) => {
    try {
        const { pedido_id, valor, motivo } = req.body;

        const pedido = await queryOne('SELECT * FROM pedidos WHERE id = ?', [pedido_id]);
        if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado' });

        // Em produção, chamar API de reembolso do Mercado Pago ou gateway

        await transaction(() => {
            run('UPDATE pedidos SET status = "cancelado", data_atualizacao = CURRENT_TIMESTAMP WHERE id = ?', [pedido_id]);
            run(
                'INSERT INTO pedido_status_historico (pedido_id, status_anterior, status_novo, usuario_id, usuario_nome, motivo) VALUES (?, ?, ?, ?, ?, ?)',
                [pedido_id, pedido.status, 'cancelado', req.user.id, req.user.nome, `Reembolso: ${motivo}`]
            );
            run(
                'INSERT INTO reembolsos (pedido_id, valor, motivo, status, usuario_id) VALUES (?, ?, ?, ?, ?)',
                [pedido_id, valor || pedido.valor_total, motivo, 'processando', req.user.id]
            );
        });

        res.json({ message: 'Reembolso iniciado', status: 'processando' });
    } catch (error) {
        console.error('Refund error:', error);
        res.status(500).json({ error: 'Erro ao processar reembolso' });
    }
});

const PORT = config.server.port + 8; // 3008
app.listen(PORT, () => {
    console.log(`💳 Payment Service rodando na porta ${PORT}`);
});

export default app;