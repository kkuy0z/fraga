import express from 'express';
import db from '../database/connection.js';
import { authMiddleware } from '../middleware/auth.js';
import { configuracaoEntregaValidators } from '../middleware/validation.js';

const router = express.Router();

// Get delivery configuration (public)
router.get('/config', async (req, res) => {
    try {
        const config = await db.queryOne('SELECT * FROM configuracoes_entrega ORDER BY id DESC LIMIT 1');
        if (!config) {
            return res.json({ taxa_entrega: 0, valor_minimo_pedido: 0, bairro_taxa_extra: [] });
        }
        res.json({
            ...config,
            bairro_taxa_extra: config.bairro_taxa_extra ? JSON.parse(config.bairro_taxa_extra) : []
        });
    } catch (error) {
        console.error('Error getting delivery config:', error);
        res.status(500).json({ error: 'Erro ao buscar configuração de entrega' });
    }
});

// Update delivery configuration (admin only)
router.put('/config', authMiddleware, configuracaoEntregaValidators.update, async (req, res) => {
    try {
        const { taxa_entrega, valor_minimo_pedido, bairro_taxa_extra } = req.body;

        const config = await db.queryOne('SELECT * FROM configuracoes_entrega ORDER BY id DESC LIMIT 1');

        if (!config) {
            // Create new config
            const result = await db.query(
                'INSERT INTO configuracoes_entrega (taxa_entrega, valor_minimo_pedido, bairro_taxa_extra) VALUES (?, ?, ?)',
                [taxa_entrega ?? 0, valor_minimo_pedido ?? 0, bairro_taxa_extra ? JSON.stringify(bairro_taxa_extra) : null]
            );
            const newConfig = await db.queryOne('SELECT * FROM configuracoes_entrega WHERE id = ?', [result.lastInsertRowid]);
            return res.json({
                ...newConfig,
                bairro_taxa_extra: newConfig.bairro_taxa_extra ? JSON.parse(newConfig.bairro_taxa_extra) : []
            });
        }

        const updates = [];
        const params = [];

        if (taxa_entrega !== undefined) { updates.push('taxa_entrega = ?'); params.push(taxa_entrega); }
        if (valor_minimo_pedido !== undefined) { updates.push('valor_minimo_pedido = ?'); params.push(valor_minimo_pedido); }
        if (bairro_taxa_extra !== undefined) { updates.push('bairro_taxa_extra = ?'); params.push(JSON.stringify(bairro_taxa_extra)); }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nenhum campo para atualizar' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(config.id);

        await db.query(`UPDATE configuracoes_entrega SET ${updates.join(', ')} WHERE id = ?`, params);

        const updated = await db.queryOne('SELECT * FROM configuracoes_entrega WHERE id = ?', [config.id]);
        res.json({
            ...updated,
            bairro_taxa_extra: updated.bairro_taxa_extra ? JSON.parse(updated.bairro_taxa_extra) : []
        });
    } catch (error) {
        console.error('Error updating delivery config:', error);
        res.status(500).json({ error: 'Erro ao atualizar configuração de entrega' });
    }
});

export default router;