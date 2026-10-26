import express from 'express';
import db from '../database/connection.js';
import { generateToken, verifyToken, verifyPassword, hashPassword } from '../middleware/auth.js';
import { clienteValidators } from '../middleware/validation.js';

const router = express.Router();

// Customer auth middleware
async function clienteAuthMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token de autenticação não fornecido' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded || decoded.tipo !== 'cliente') {
        return res.status(401).json({ error: 'Token inválido ou expirado' });
    }

    // Verify client still exists and is active
    const cliente = await db.queryOne(
        'SELECT id, nome, email, telefone, ativo FROM clientes WHERE id = ?',
        [decoded.id]
    );

    if (!cliente || !cliente.ativo) {
        return res.status(401).json({ error: 'Cliente não encontrado ou inativo' });
    }

    req.cliente = cliente;
    next();
}

// Generate client token
function generateClienteToken(cliente) {
    return generateToken({ ...cliente, tipo: 'cliente' });
}

// Register new client
router.post('/register', clienteValidators.register, async (req, res) => {
    try {
        const { nome, email, telefone, senha, cep, logradouro, numero, bairro, complemento } = req.body;

        // Check if email already exists
        const existingEmail = await db.queryOne('SELECT id FROM clientes WHERE email = ?', [email]);
        if (existingEmail) {
            return res.status(400).json({ error: 'E-mail já cadastrado' });
        }

        // Check if phone already exists
        const existingPhone = await db.queryOne('SELECT id FROM clientes WHERE telefone = ?', [telefone]);
        if (existingPhone) {
            return res.status(400).json({ error: 'Telefone já cadastrado' });
        }

        const senhaHash = await hashPassword(senha);

        const result = await db.query(
            `INSERT INTO clientes (nome, email, telefone, senha_hash, cep, logradouro, numero, bairro, complemento)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [nome, email, telefone, senhaHash, cep || null, logradouro || null, numero || null, bairro || null, complemento || null]
        );

        const cliente = await db.queryOne(
            'SELECT id, nome, email, telefone, cep, logradouro, numero, bairro, complemento, created_at FROM clientes WHERE id = ?',
            [result.lastInsertRowid]
        );

        const token = generateClienteToken(cliente);

        res.status(201).json({
            token,
            cliente: {
                id: cliente.id,
                nome: cliente.nome,
                email: cliente.email,
                telefone: cliente.telefone,
                cep: cliente.cep,
                logradouro: cliente.logradouro,
                numero: cliente.numero,
                bairro: cliente.bairro,
                complemento: cliente.complemento
            }
        });
    } catch (error) {
        console.error('Error registering client:', error);
        res.status(500).json({ error: 'Erro ao cadastrar cliente' });
    }
});

// Client login
router.post('/login', clienteValidators.login, async (req, res) => {
    try {
        const { email, senha } = req.body;

        const cliente = await db.queryOne('SELECT * FROM clientes WHERE email = ?', [email]);
        if (!cliente) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        if (!cliente.ativo) {
            return res.status(401).json({ error: 'Conta desativada' });
        }

        const validPassword = await verifyPassword(senha, cliente.senha_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        const token = generateClienteToken(cliente);

        res.json({
            token,
            cliente: {
                id: cliente.id,
                nome: cliente.nome,
                email: cliente.email,
                telefone: cliente.telefone,
                cep: cliente.cep,
                logradouro: cliente.logradouro,
                numero: cliente.numero,
                bairro: cliente.bairro,
                complemento: cliente.complemento
            }
        });
    } catch (error) {
        console.error('Error during client login:', error);
        res.status(500).json({ error: 'Erro ao fazer login' });
    }
});

// Verify token / get profile
router.get('/perfil', clienteAuthMiddleware, async (req, res) => {
    res.json({
        cliente: {
            id: req.cliente.id,
            nome: req.cliente.nome,
            email: req.cliente.email,
            telefone: req.cliente.telefone,
            cep: req.cliente.cep,
            logradouro: req.cliente.logradouro,
            numero: req.cliente.numero,
            bairro: req.cliente.bairro,
            complemento: req.cliente.complemento
        }
    });
});

// Update profile
router.put('/perfil', clienteAuthMiddleware, clienteValidators.update, async (req, res) => {
    try {
        const { nome, telefone, cep, logradouro, numero, bairro, complemento } = req.body;

        // Check if phone already exists for another client
        if (telefone && telefone !== req.cliente.telefone) {
            const existingPhone = await db.queryOne('SELECT id FROM clientes WHERE telefone = ? AND id != ?', [telefone, req.cliente.id]);
            if (existingPhone) {
                return res.status(400).json({ error: 'Telefone já cadastrado' });
            }
        }

        await db.query(
            `UPDATE clientes SET
                nome = COALESCE(?, nome),
                telefone = COALESCE(?, telefone),
                cep = COALESCE(?, cep),
                logradouro = COALESCE(?, logradouro),
                numero = COALESCE(?, numero),
                bairro = COALESCE(?, bairro),
                complemento = COALESCE(?, complemento),
                updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [nome, telefone, cep, logradouro, numero, bairro, complemento, req.cliente.id]
        );

        const cliente = await db.queryOne(
            'SELECT id, nome, email, telefone, cep, logradouro, numero, bairro, complemento FROM clientes WHERE id = ?',
            [req.cliente.id]
        );

        res.json({ cliente });
    } catch (error) {
        console.error('Error updating client profile:', error);
        res.status(500).json({ error: 'Erro ao atualizar perfil' });
    }
});

// Change password
router.put('/senha', clienteAuthMiddleware, clienteValidators.changePassword, async (req, res) => {
    try {
        const { senha_atual, nova_senha } = req.body;

        const cliente = await db.queryOne('SELECT senha_hash FROM clientes WHERE id = ?', [req.cliente.id]);
        const validPassword = await verifyPassword(senha_atual, cliente.senha_hash);

        if (!validPassword) {
            return res.status(401).json({ error: 'Senha atual incorreta' });
        }

        const novaSenhaHash = await hashPassword(nova_senha);
        await db.query('UPDATE clientes SET senha_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [novaSenhaHash, req.cliente.id]);

        res.json({ message: 'Senha alterada com sucesso' });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ error: 'Erro ao alterar senha' });
    }
});

// Get client addresses (for checkout)
router.get('/enderecos', clienteAuthMiddleware, async (req, res) => {
    const enderecos = await db.query(
        'SELECT id, cep, logradouro, numero, bairro, complemento, principal FROM enderecos_cliente WHERE cliente_id = ? ORDER BY principal DESC, created_at DESC',
        [req.cliente.id]
    );
    res.json({ enderecos });
});

// Add address
router.post('/enderecos', clienteAuthMiddleware, clienteValidators.enderecoCreate, async (req, res) => {
    try {
        const { cep, logradouro, numero, bairro, complemento, principal } = req.body;

        // If this is set as principal, unset others
        if (principal) {
            await db.query('UPDATE enderecos_cliente SET principal = 0 WHERE cliente_id = ?', [req.cliente.id]);
        }

        const result = await db.query(
            `INSERT INTO enderecos_cliente (cliente_id, cep, logradouro, numero, bairro, complemento, principal)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [req.cliente.id, cep, logradouro, numero, bairro, complemento || null, principal ? 1 : 0]
        );

        const endereco = await db.queryOne('SELECT * FROM enderecos_cliente WHERE id = ?', [result.lastInsertRowid]);
        res.status(201).json({ endereco });
    } catch (error) {
        console.error('Error adding address:', error);
        res.status(500).json({ error: 'Erro ao adicionar endereço' });
    }
});

// Update address
router.put('/enderecos/:id', clienteAuthMiddleware, clienteValidators.enderecoUpdate, async (req, res) => {
    try {
        const { cep, logradouro, numero, bairro, complemento, principal } = req.body;
        const enderecoId = req.params.id;

        const existing = await db.queryOne('SELECT id FROM enderecos_cliente WHERE id = ? AND cliente_id = ?', [enderecoId, req.cliente.id]);
        if (!existing) {
            return res.status(404).json({ error: 'Endereço não encontrado' });
        }

        // If this is set as principal, unset others
        if (principal) {
            await db.query('UPDATE enderecos_cliente SET principal = 0 WHERE cliente_id = ?', [req.cliente.id]);
        }

        await db.query(
            `UPDATE enderecos_cliente SET
                cep = COALESCE(?, cep),
                logradouro = COALESCE(?, logradouro),
                numero = COALESCE(?, numero),
                bairro = COALESCE(?, bairro),
                complemento = COALESCE(?, complemento),
                principal = COALESCE(?, principal),
                updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND cliente_id = ?`,
            [cep, logradouro, numero, bairro, complemento, principal ? 1 : 0, enderecoId, req.cliente.id]
        );

        const endereco = await db.queryOne('SELECT * FROM enderecos_cliente WHERE id = ?', [enderecoId]);
        res.json({ endereco });
    } catch (error) {
        console.error('Error updating address:', error);
        res.status(500).json({ error: 'Erro ao atualizar endereço' });
    }
});

// Delete address
router.delete('/enderecos/:id', clienteAuthMiddleware, async (req, res) => {
    try {
        const enderecoId = req.params.id;

        const result = await db.query(
            'DELETE FROM enderecos_cliente WHERE id = ? AND cliente_id = ?',
            [enderecoId, req.cliente.id]
        );

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Endereço não encontrado' });
        }

        res.json({ message: 'Endereço removido com sucesso' });
    } catch (error) {
        console.error('Error deleting address:', error);
        res.status(500).json({ error: 'Erro ao remover endereço' });
    }
});

export default router;