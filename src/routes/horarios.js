import express from 'express';
import db from '../database/connection.js';
import { authMiddleware } from '../middleware/auth.js';
import { horarioValidators } from '../middleware/validation.js';

const router = express.Router();

// Get all business hours (public)
router.get('/', async (req, res) => {
    try {
        const horarios = await db.query(`
            SELECT * FROM horarios_funcionamento
            ORDER BY dia_semana, hora_abertura
        `);

        // Map day numbers to names
        const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

        const result = horarios.map(h => ({
            ...h,
            dia_nome: diasSemana[h.dia_semana]
        }));

        res.json(result);
    } catch (error) {
        console.error('Error listing business hours:', error);
        res.status(500).json({ error: 'Erro ao listar horários de funcionamento' });
    }
});

// Check if establishment is open (public)
router.get('/status', async (req, res) => {
    try {
        const now = new Date();
        const diaSemana = now.getDay(); // 0 = Sunday
        const horaAtual = now.toTimeString().slice(0, 5); // HH:MM

        const horario = await db.queryOne(`
            SELECT * FROM horarios_funcionamento
            WHERE dia_semana = ? AND ativo = 1
            AND hora_abertura <= ? AND hora_fechamento > ?
        `, [diaSemana, horaAtual, horaAtual]);

        const aberto = !!horario;

        res.json({
            aberto,
            dia_semana: diaSemana,
            hora_atual: horaAtual,
            horario_atual: horario || null
        });
    } catch (error) {
        console.error('Error checking business status:', error);
        res.status(500).json({ error: 'Erro ao verificar status do estabelecimento' });
    }
});

// Create business hours (admin only)
router.post('/', authMiddleware, horarioValidators.create, async (req, res) => {
    try {
        const { dia_semana, hora_abertura, hora_fechamento, ativo = true } = req.body;

        // Validate that closing time is after opening time
        if (hora_fechamento <= hora_abertura) {
            return res.status(400).json({ error: 'Hora de fechamento deve ser posterior à hora de abertura' });
        }

        const result = await db.query(
            'INSERT INTO horarios_funcionamento (dia_semana, hora_abertura, hora_fechamento, ativo) VALUES (?, ?, ?, ?)',
            [dia_semana, hora_abertura, hora_fechamento, ativo ? 1 : 0]
        );

        const horario = await db.queryOne('SELECT * FROM horarios_funcionamento WHERE id = ?', [result.lastInsertRowid]);
        res.status(201).json(horario);
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(400).json({ error: 'Já existe um horário cadastrado para este dia e período' });
        }
        console.error('Error creating business hours:', error);
        res.status(500).json({ error: 'Erro ao criar horário de funcionamento' });
    }
});

// Update business hours (admin only)
router.put('/:id', authMiddleware, horarioValidators.update, async (req, res) => {
    try {
        const { id } = req.params;
        const { hora_abertura, hora_fechamento, ativo } = req.body;

        const horario = await db.queryOne('SELECT * FROM horarios_funcionamento WHERE id = ?', [id]);
        if (!horario) {
            return res.status(404).json({ error: 'Horário não encontrado' });
        }

        const novaAbertura = hora_abertura || horario.hora_abertura;
        const novoFechamento = hora_fechamento || horario.hora_fechamento;

        if (novoFechamento <= novaAbertura) {
            return res.status(400).json({ error: 'Hora de fechamento deve ser posterior à hora de abertura' });
        }

        const updates = [];
        const params = [];

        if (hora_abertura !== undefined) { updates.push('hora_abertura = ?'); params.push(hora_abertura); }
        if (hora_fechamento !== undefined) { updates.push('hora_fechamento = ?'); params.push(hora_fechamento); }
        if (ativo !== undefined) { updates.push('ativo = ?'); params.push(ativo ? 1 : 0); }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nenhum campo para atualizar' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(id);

        await db.query(`UPDATE horarios_funcionamento SET ${updates.join(', ')} WHERE id = ?`, params);

        const updated = await db.queryOne('SELECT * FROM horarios_funcionamento WHERE id = ?', [id]);
        res.json(updated);
    } catch (error) {
        console.error('Error updating business hours:', error);
        res.status(500).json({ error: 'Erro ao atualizar horário de funcionamento' });
    }
});

// Delete business hours (admin only)
router.delete('/:id', authMiddleware, horarioValidators.delete, async (req, res) => {
    try {
        const { id } = req.params;

        const horario = await db.queryOne('SELECT * FROM horarios_funcionamento WHERE id = ?', [id]);
        if (!horario) {
            return res.status(404).json({ error: 'Horário não encontrado' });
        }

        await db.query('DELETE FROM horarios_funcionamento WHERE id = ?', [id]);
        res.json({ message: 'Horário de funcionamento excluído com sucesso' });
    } catch (error) {
        console.error('Error deleting business hours:', error);
        res.status(500).json({ error: 'Erro ao excluir horário de funcionamento' });
    }
});

export default router;