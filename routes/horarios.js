import { Router } from 'express';
import { db, generateId } from '../db/database.js';
import { verifyToken } from './auth.js';

export const horariosRouter = Router();

function autenticarAdmin(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = token ? verifyToken(token) : null;

    if (!user || user.tipo !== 'admin') {
        return res.status(401).json({ erro: 'Acesso não autorizado.' });
    }

    next();
}

horariosRouter.get('/', (req, res) => {
    try {
        const horarios = db.prepare(
            'SELECT * FROM horarios ORDER BY dia_semana'
        ).all();

        res.json({ horarios });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao buscar horários.' });
    }
});

horariosRouter.put('/', autenticarAdmin, (req, res) => {
    try {
        const horarios = req.body.horarios;

        if (!Array.isArray(horarios)) {
            return res.status(400).json({ erro: 'Informe uma lista de horários.' });
        }

        const atualizar = db.transaction((lista) => {
            for (const h of lista) {
                if (h.dia_semana < 0 || h.dia_semana > 6) continue;

                db.prepare(`
                    INSERT INTO horarios
                    (id, dia_semana, hora_abertura, hora_fechamento, ativo)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(dia_semana) DO UPDATE SET
                        hora_abertura = excluded.hora_abertura,
                        hora_fechamento = excluded.hora_fechamento,
                        ativo = excluded.ativo
                `).run(
                    generateId(),
                    h.dia_semana,
                    h.hora_abertura || '18:00',
                    h.hora_fechamento || '23:30',
                    h.ativo ? 1 : 0
                );
            }
        });

        atualizar(horarios);
        res.json({ mensagem: 'Horários atualizados.' });
    } catch (error) {
        res.status(500).json({ erro: 'Erro ao atualizar horários.' });
    }
});