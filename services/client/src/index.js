import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config, validateConfig } from '../shared/config/index.js';
import { generalLimiter, sensitiveApiLimiter, createLimiter, authLimiter } from '../shared/middleware/rateLimiter.js';
import { authenticateToken, requireRole } from '../shared/middleware/auth.js';
import { commonValidators, clienteValidators, authValidators } from '../shared/middleware/validation.js';
import { query, queryOne, run } from '../shared/database/connection.js';
import argon2 from 'argon2';

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
    res.json({ status: 'ok', service: 'client', timestamp: new Date().toISOString() });
});

// ============================================
// PERFIL DO CLIENTE
// ============================================

// Obter perfil do cliente logado
app.get('/api/cliente/perfil', authenticateToken, requireRole('cliente'), async (req, res) => {
    try {
        const cliente = await queryOne(
            'SELECT id, nome, email, telefone, ativo, created_at FROM clientes WHERE id = ?',
            [req.user.id]
        );
        if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado' });

        const enderecos = await query('SELECT * FROM enderecos_cliente WHERE cliente_id = ? ORDER BY principal DESC', [req.user.id]);
        cliente.enderecos = enderecos;

        // Estatísticas
        const stats = await queryOne(`
            SELECT
                COUNT(*) as total_pedidos,
                COALESCE(SUM(valor_total), 0) as total_gasto,
                MAX(data_pedido) as ultimo_pedido
            FROM pedidos WHERE cliente_id = ? AND status != 'cancelado'
        `, [req.user.id]);

        cliente.estatisticas = stats;
        res.json(cliente);
    } catch (error) {
        console.error('Get client profile error:', error);
        res.status(500).json({ error: 'Erro ao buscar perfil' });
    }
});

// Atualizar perfil
app.put('/api/cliente/perfil', authenticateToken, requireRole('cliente'), clienteValidators.update, async (req, res) => {
    try {
        const { nome, telefone } = req.body;
        const updates = [];
        const params = [];

        if (nome !== undefined) { updates.push('nome = ?'); params.push(nome); }
        if (telefone !== undefined) { updates.push('telefone = ?'); params.push(telefone); }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nenhum campo para atualizar' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(req.user.id);

        await run(`UPDATE clientes SET ${updates.join(', ')} WHERE id = ?`, params);

        const cliente = await queryOne(
            'SELECT id, nome, email, telefone, ativo, created_at FROM clientes WHERE id = ?',
            [req.user.id]
        );
        res.json(cliente);
    } catch (error) {
        console.error('Update client profile error:', error);
        res.status(500).json({ error: 'Erro ao atualizar perfil' });
    }
});

// Alterar senha do cliente
app.put('/api/cliente/senha', authenticateToken, requireRole('cliente'), authValidators.changePassword, async (req, res) => {
    try {
        const { senhaAtual, novaSenha } = req.body;
        const cliente = await queryOne('SELECT senha_hash FROM clientes WHERE id = ?', [req.user.id]);

        const valid = await argon2.verify(cliente.senha_hash, senhaAtual);
        if (!valid) {
            return res.status(400).json({ error: 'Senha atual incorreta' });
        }

        const hash = await argon2.hash(novaSenha, { type: argon2.argon2id });
        await run('UPDATE clientes SET senha_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [hash, req.user.id]);

        res.json({ message: 'Senha alterada com sucesso' });
    } catch (error) {
        console.error('Change client password error:', error);
        res.status(500).json({ error: 'Erro ao alterar senha' });
    }
});

// ============================================
// ENDEREÇOS (já estão no order service, mas duplicando aqui para serviço completo)
// ============================================

app.get('/api/cliente/enderecos', authenticateToken, requireRole('cliente'), async (req, res) => {
    try {
        const enderecos = await query('SELECT * FROM enderecos_cliente WHERE cliente_id = ? ORDER BY principal DESC', [req.user.id]);
        res.json(enderecos);
    } catch (error) {
        console.error('List client addresses error:', error);
        res.status(500).json({ error: 'Erro ao buscar endereços' });
    }
});

app.post('/api/cliente/enderecos', authenticateToken, requireRole('cliente'), createLimiter, clienteValidators.endereco, async (req, res) => {
    try {
        const { cep, logradouro, numero, bairro, complemento, principal } = req.body;

        if (principal) {
            await run('UPDATE enderecos_cliente SET principal = 0 WHERE cliente_id = ?', [req.user.id]);
        }

        const result = await run(
            'INSERT INTO enderecos_cliente (cliente_id, cep, logradouro, numero, bairro, complemento, principal) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [req.user.id, cep, logradouro, numero, bairro, complemento || null, principal ? 1 : 0]
        );

        const endereco = await queryOne('SELECT * FROM enderecos_cliente WHERE id = ?', [result.lastInsertRowid]);
        res.status(201).json(endereco);
    } catch (error) {
        console.error('Create client address error:', error);
        res.status(500).json({ error: 'Erro ao criar endereço' });
    }
});

app.put('/api/cliente/enderecos/:id', authenticateToken, requireRole('cliente'), commonValidators.idParam, clienteValidators.endereco, async (req, res) => {
    try {
        const { cep, logradouro, numero, bairro, complemento, principal } = req.body;

        const endereco = await queryOne('SELECT * FROM enderecos_cliente WHERE id = ? AND cliente_id = ?', [req.params.id, req.user.id]);
        if (!endereco) return res.status(404).json({ error: 'Endereço não encontrado' });

        if (principal) {
            await run('UPDATE enderecos_cliente SET principal = 0 WHERE cliente_id = ?', [req.user.id]);
        }

        await run(
            'UPDATE enderecos_cliente SET cep = ?, logradouro = ?, numero = ?, bairro = ?, complemento = ?, principal = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [cep, logradouro, numero, bairro, complemento || null, principal ? 1 : 0, req.params.id]
        );

        const updated = await queryOne('SELECT * FROM enderecos_cliente WHERE id = ?', [req.params.id]);
        res.json(updated);
    } catch (error) {
        console.error('Update client address error:', error);
        res.status(500).json({ error: 'Erro ao atualizar endereço' });
    }
});

app.delete('/api/cliente/enderecos/:id', authenticateToken, requireRole('cliente'), commonValidators.idParam, async (req, res) => {
    try {
        await run('DELETE FROM enderecos_cliente WHERE id = ? AND cliente_id = ?', [req.params.id, req.user.id]);
        res.json({ message: 'Endereço excluído com sucesso' });
    } catch (error) {
        console.error('Delete client address error:', error);
        res.status(500).json({ error: 'Erro ao excluir endereço' });
    }
});

// ============================================
// PEDIDOS DO CLIENTE (proxy para order service)
// ============================================

app.get('/api/cliente/pedidos', authenticateToken, requireRole('cliente'), commonValidators.pagination, async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        let sql = 'SELECT * FROM pedidos WHERE cliente_id = ?';
        const params = [req.user.id];

        if (status) { sql += ' AND status = ?'; params.push(status); }

        sql += ' ORDER BY data_pedido DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

        const pedidos = await query(sql, params);

        for (const pedido of pedidos) {
            pedido.itens = await query(`
                SELECT pi.*, p.nome as produto_nome
                FROM pedido_itens pi
                JOIN produtos p ON pi.produto_id = p.id
                WHERE pi.pedido_id = ?
            `, [pedido.id]);
        }

        const total = await queryOne(
            'SELECT COUNT(*) as total FROM pedidos WHERE cliente_id = ?' + (status ? ' AND status = ?' : ''),
            params.slice(0, -2)
        );

        res.json({
            data: pedidos,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total.total,
                totalPages: Math.ceil(total.total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('List client orders error:', error);
        res.status(500).json({ error: 'Erro ao buscar pedidos' });
    }
});

app.get('/api/cliente/pedidos/:id', authenticateToken, requireRole('cliente'), commonValidators.idParam, async (req, res) => {
    try {
        const pedido = await queryOne('SELECT * FROM pedidos WHERE id = ? AND cliente_id = ?', [req.params.id, req.user.id]);
        if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado' });

        pedido.itens = await query(`
            SELECT pi.*, p.nome as produto_nome, p.imagem_url
            FROM pedido_itens pi
            JOIN produtos p ON pi.produto_id = p.id
            WHERE pi.pedido_id = ?
        `, [pedido.id]);

        for (const item of pedido.itens) {
            item.personalizacoes = await query(`
                SELECT pip.*, pg.nome as grupo_nome, po.nome as opcao_nome, po.preco_adicional
                FROM pedido_item_personalizacoes pip
                JOIN personalizacao_grupos pg ON pip.grupo_id = pg.id
                JOIN personalizacao_opcoes po ON pip.opcao_id = po.id
                WHERE pip.pedido_item_id = ?
            `, [item.id]);
        }

        res.json(pedido);
    } catch (error) {
        console.error('Get client order error:', error);
        res.status(500).json({ error: 'Erro ao buscar pedido' });
    }
});

// ============================================
// ADMIN - GERENCIAR CLIENTES
// ============================================

app.get('/api/admin/clientes', authenticateToken, requireRole('administrador'), commonValidators.pagination, async (req, res) => {
    try {
        const { page = 1, limit = 20, busca, ativo } = req.query;
        let sql = 'SELECT id, nome, email, telefone, ativo, created_at FROM clientes WHERE 1=1';
        const params = [];

        if (busca) { sql += ' AND (nome LIKE ? OR email LIKE ? OR telefone LIKE ?)'; params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`); }
        if (ativo !== undefined) { sql += ' AND ativo = ?'; params.push(ativo === 'true' ? 1 : 0); }

        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

        const clientes = await query(sql, params);

        const total = await queryOne(
            'SELECT COUNT(*) as total FROM clientes WHERE 1=1' +
            (busca ? ' AND (nome LIKE ? OR email LIKE ? OR telefone LIKE ?)' : '') +
            (ativo !== undefined ? ' AND ativo = ?' : ''),
            params.slice(0, -2)
        );

        res.json({
            data: clientes,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total.total,
                totalPages: Math.ceil(total.total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Admin list clients error:', error);
        res.status(500).json({ error: 'Erro ao buscar clientes' });
    }
});

app.get('/api/admin/clientes/:id', authenticateToken, requireRole('administrador'), commonValidators.idParam, async (req, res) => {
    try {
        const cliente = await queryOne(
            'SELECT id, nome, email, telefone, ativo, created_at FROM clientes WHERE id = ?',
            [req.params.id]
        );
        if (!cliente) return res.status(404).json({ error: 'Cliente não encontrado' });

        const enderecos = await query('SELECT * FROM enderecos_cliente WHERE cliente_id = ?', [req.params.id]);
        const pedidos = await query('SELECT * FROM pedidos WHERE cliente_id = ? ORDER BY data_pedido DESC LIMIT 10', [req.params.id]);

        const stats = await queryOne(`
            SELECT
                COUNT(*) as total_pedidos,
                COALESCE(SUM(valor_total), 0) as total_gasto,
                MAX(data_pedido) as ultimo_pedido
            FROM pedidos WHERE cliente_id = ? AND status != 'cancelado'
        `, [req.params.id]);

        res.json({ ...cliente, enderecos, pedidos_recentes: pedidos, estatisticas: stats });
    } catch (error) {
        console.error('Admin get client error:', error);
        res.status(500).json({ error: 'Erro ao buscar cliente' });
    }
});

app.put('/api/admin/clientes/:id', authenticateToken, requireRole('administrador'), commonValidators.idParam, async (req, res) => {
    try {
        const { nome, email, telefone, ativo } = req.body;
        const updates = [];
        const params = [];

        if (nome !== undefined) { updates.push('nome = ?'); params.push(nome); }
        if (email !== undefined) { updates.push('email = ?'); params.push(email); }
        if (telefone !== undefined) { updates.push('telefone = ?'); params.push(telefone); }
        if (ativo !== undefined) { updates.push('ativo = ?'); params.push(ativo ? 1 : 0); }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nenhum campo para atualizar' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(req.params.id);

        await run(`UPDATE clientes SET ${updates.join(', ')} WHERE id = ?`, params);

        const cliente = await queryOne(
            'SELECT id, nome, email, telefone, ativo, created_at FROM clientes WHERE id = ?',
            [req.params.id]
        );
        res.json(cliente);
    } catch (error) {
        console.error('Admin update client error:', error);
        res.status(500).json({ error: 'Erro ao atualizar cliente' });
    }
});

app.delete('/api/admin/clientes/:id', authenticateToken, requireRole('administrador'), commonValidators.idParam, async (req, res) => {
    try {
        await run('DELETE FROM clientes WHERE id = ?', [req.params.id]);
        res.json({ message: 'Cliente excluído com sucesso' });
    } catch (error) {
        console.error('Admin delete client error:', error);
        res.status(500).json({ error: 'Erro ao excluir cliente' });
    }
});

const PORT = config.server.port + 3; // 3003
app.listen(PORT, () => {
    console.log(`👤 Client Service rodando na porta ${PORT}`);
});

export default app;