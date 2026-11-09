import { Router } from 'express';
import { db } from '../db/database.js';
import { verifyToken } from './auth.js';

export const entregaRouter = Router();

function autenticarAdmin(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = token ? verifyToken(token) : null;

    if (!user || user.tipo !== 'admin') {
        return res.status(401).json({ erro: 'Acesso não autorizado.' });
    }

    next();
}

entregaRouter.get('/config', (req, res) => {
    try {
        const config = db.prepare(
            "SELECT * FROM config_entrega WHERE id = '1'"
        ).get();

        res.json(config || {});
    } catch {
        res.status(500).json({ erro: 'Erro ao buscar configuração.' });
    }
});

entregaRouter.put('/config', autenticarAdmin, (req, res) => {
    try {
        const {
            taxa_entrega,
            valor_minimo_pedido,
            tempo_medio_entrega,
            raio_entrega_km
        } = req.body;

        db.prepare(`
            UPDATE config_entrega SET
                taxa_entrega = ?,
                valor_minimo_pedido = ?,
                tempo_medio_entrega = ?,
                raio_entrega_km = ?,
                atualizado_em = CURRENT_TIMESTAMP
            WHERE id = '1'
        `).run(
            Number(taxa_entrega) || 0,
            Number(valor_minimo_pedido) || 0,
            Number(tempo_medio_entrega) || 0,
            Number(raio_entrega_km) || 0
        );

        res.json({ mensagem: 'Configuração atualizada.' });
    } catch {
        res.status(500).json({ erro: 'Erro ao atualizar entrega.' });
    }
});