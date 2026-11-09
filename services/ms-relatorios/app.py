"""
Relatórios Microservice - Management Reports and Analytics
"""
import os
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from fastapi import FastAPI, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text, and_, or_
from sqlalchemy.orm import selectinload

from services.ms_auth.main import create_app
from shared.database import get_db
from shared.models import (
    Pedido, ItemPedido, Produto, Categoria, Usuario, Entrega, Avaliacao, Pagamento
)
from shared.schemas import (
    RelatorioVendasResponse, RelatorioProdutosResponse, RelatorioEntregasResponse,
    RelatorioPeriodo
)
from shared.auth import (
    get_current_user, require_perfis, PerfilNome
)

app = create_app("ms-relatorios", "1.0.0")


# =============================================
# DEPENDENCIES
# =============================================

async def get_current_user_dep(
    authorization: str = None,
    db: AsyncSession = Depends(get_db)
):
    from shared.auth import decode_token
    from shared.models import Usuario
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization")
    token = authorization.split(" ")[1]
    token_data = decode_token(token)
    if not token_data:
        raise HTTPException(status_code=401, detail="Invalid token")
    result = await db.execute(select(Usuario).where(Usuario.id == int(token_data.sub)))
    usuario = result.scalar_one_or_none()
    if not usuario or not usuario.ativo:
        raise HTTPException(status_code=401, detail="User not found")
    return usuario


async def require_admin(user: "Usuario" = Depends(get_current_user_dep)):
    if user.perfil.nome != PerfilNome.ADMINISTRADOR.value:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# =============================================
# HELPER: Parse period
# =============================================

def parse_period(
    data_inicio: Optional[datetime] = None,
    data_fim: Optional[datetime] = None
) -> tuple[datetime, datetime]:
    """Parse and validate report period."""
    now = datetime.now(timezone.utc)
    if not data_fim:
        data_fim = now
    if not data_inicio:
        data_inicio = data_fim - timedelta(days=30)

    if data_inicio > data_fim:
        raise HTTPException(status_code=400, detail="data_inicio must be before data_fim")

    # Limit to 1 year
    if (data_fim - data_inicio).days > 365:
        raise HTTPException(status_code=400, detail="Period cannot exceed 365 days")

    return data_inicio, data_fim


# =============================================
# RELATÓRIOS ENDPOINTS
# =============================================

@app.get("/relatorios/vendas", response_model=RelatorioVendasResponse, tags=["relatorios"])
async def relatorio_vendas(
    data_inicio: Optional[datetime] = Query(None, description="Start date (ISO format)"),
    data_fim: Optional[datetime] = Query(None, description="End date (ISO format)"),
    current_user: "Usuario" = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Sales report with filters."""
    data_inicio, data_fim = parse_period(data_inicio, data_fim)

    # Base query for period
    base_query = select(Pedido).where(
        Pedido.created_at >= data_inicio,
        Pedido.created_at <= data_fim,
        Pedido.status != "cancelado"
    )

    # Total orders
    total_pedidos = await db.scalar(
        select(func.count()).select_from(base_query.subquery())
    ) or 0

    # Total sales
    total_vendas = await db.scalar(
        select(func.sum(Pedido.total)).select_from(base_query.subquery())
    ) or 0

    # Average ticket
    ticket_medio = float(total_vendas) / total_pedidos if total_pedidos > 0 else 0

    # Orders by status
    status_result = await db.execute(
        select(Pedido.status, func.count(Pedido.id))
        .where(
            Pedido.created_at >= data_inicio,
            Pedido.created_at <= data_fim
        )
        .group_by(Pedido.status)
    )
    pedidos_por_status = {status: count for status, count in status_result.all()}

    # Sales by day
    vendas_dia_result = await db.execute(text("""
        SELECT DATE(created_at) as data, COUNT(*) as pedidos, SUM(total) as total
        FROM pedidos
        WHERE created_at >= :inicio AND created_at <= :fim AND status != 'cancelado'
        GROUP BY DATE(created_at)
        ORDER BY data
    """), {"inicio": data_inicio, "fim": data_fim})
    vendas_por_dia = [
        {"data": str(row.data), "pedidos": row.pedidos, "total": float(row.total)}
        for row in vendas_dia_result.all()
    ]

    # Sales by hour
    vendas_hora_result = await db.execute(text("""
        SELECT HOUR(created_at) as hora, COUNT(*) as pedidos, SUM(total) as total
        FROM pedidos
        WHERE created_at >= :inicio AND created_at <= :fim AND status != 'cancelado'
        GROUP BY HOUR(created_at)
        ORDER BY hora
    """), {"inicio": data_inicio, "fim": data_fim})
    vendas_por_hora = [
        {"hora": row.hora, "pedidos": row.pedidos, "total": float(row.total)}
        for row in vendas_hora_result.all()
    ]

    return RelatorioVendasResponse(
        periodo=RelatorioPeriodo(data_inicio=data_inicio, data_fim=data_fim),
        total_pedidos=total_pedidos,
        total_vendas=total_vendas,
        ticket_medio=ticket_medio,
        pedidos_por_status=pedidos_por_status,
        vendas_por_dia=vendas_por_dia,
        vendas_por_hora=vendas_por_hora
    )


@app.get("/relatorios/produtos", response_model=RelatorioProdutosResponse, tags=["relatorios"])
async def relatorio_produtos(
    data_inicio: Optional[datetime] = Query(None),
    data_fim: Optional[datetime] = Query(None),
    current_user: "Usuario" = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Top selling products report."""
    data_inicio, data_fim = parse_period(data_inicio, data_fim)

    # Top products
    produtos_result = await db.execute(text("""
        SELECT
            p.id, p.nome, p.preco, c.nome as categoria,
            SUM(ip.quantidade) as quantidade_total,
            SUM(ip.subtotal) as receita_total,
            COUNT(DISTINCT ip.pedido_id) as pedidos_count
        FROM itens_pedido ip
        JOIN pedidos pe ON ip.pedido_id = pe.id
        JOIN produtos p ON ip.produto_id = p.id
        JOIN categorias c ON p.categoria_id = c.id
        WHERE pe.created_at >= :inicio AND pe.created_at <= :fim AND pe.status != 'cancelado'
        GROUP BY p.id, p.nome, p.preco, c.nome
        ORDER BY quantidade_total DESC
        LIMIT 20
    """), {"inicio": data_inicio, "fim": data_fim})

    produtos_mais_vendidos = [
        {
            "produto_id": row.id,
            "nome": row.nome,
            "categoria": row.categoria,
            "preco": float(row.preco),
            "quantidade_vendida": row.quantidade_total,
            "receita": float(row.receita_total),
            "pedidos": row.pedidos_count
        }
        for row in produtos_result.all()
    ]

    # Top categories
    categorias_result = await db.execute(text("""
        SELECT
            c.id, c.nome,
            SUM(ip.quantidade) as quantidade_total,
            SUM(ip.subtotal) as receita_total,
            COUNT(DISTINCT ip.pedido_id) as pedidos_count
        FROM itens_pedido ip
        JOIN pedidos pe ON ip.pedido_id = pe.id
        JOIN produtos p ON ip.produto_id = p.id
        JOIN categorias c ON p.categoria_id = c.id
        WHERE pe.created_at >= :inicio AND pe.created_at <= :fim AND pe.status != 'cancelado'
        GROUP BY c.id, c.nome
        ORDER BY quantidade_total DESC
    """), {"inicio": data_inicio, "fim": data_fim})

    categorias_mais_vendidas = [
        {
            "categoria_id": row.id,
            "nome": row.nome,
            "quantidade_vendida": row.quantidade_total,
            "receita": float(row.receita_total),
            "pedidos": row.pedidos_count
        }
        for row in categorias_result.all()
    ]

    return RelatorioProdutosResponse(
        periodo=RelatorioPeriodo(data_inicio=data_inicio, data_fim=data_fim),
        produtos_mais_vendidos=produtos_mais_vendidos,
        categorias_mais_vendidas=categorias_mais_vendidas
    )


@app.get("/relatorios/entregas", response_model=RelatorioEntregasResponse, tags=["relatorios"])
async def relatorio_entregas(
    data_inicio: Optional[datetime] = Query(None),
    data_fim: Optional[datetime] = Query(None),
    current_user: "Usuario" = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Delivery performance report."""
    data_inicio, data_fim = parse_period(data_inicio, data_fim)

    # Total deliveries
    total_entregas = await db.scalar(
        select(func.count(Entrega.id)).where(
            Entrega.created_at >= data_inicio,
            Entrega.created_at <= data_fim
        )
    ) or 0

    # Average delivery time (completed deliveries)
    tempo_result = await db.execute(text("""
        SELECT AVG(TIMESTAMPDIFF(MINUTE, e.saida_em, e.entregue_em)) as tempo_medio
        FROM entregas e
        WHERE e.status = 'entregue'
        AND e.saida_em IS NOT NULL
        AND e.entregue_em IS NOT NULL
        AND e.created_at >= :inicio AND e.created_at <= :fim
    """), {"inicio": data_inicio, "fim": data_fim})
    tempo_medio = tempo_result.scalar()

    # Deliveries by deliverer
    entregadores_result = await db.execute(text("""
        SELECT
            u.id, u.nome,
            COUNT(e.id) as total_entregas,
            SUM(CASE WHEN e.status = 'entregue' THEN 1 ELSE 0 END) as concluidas,
            SUM(CASE WHEN e.status = 'falhou' THEN 1 ELSE 0 END) as falharam,
            AVG(CASE WHEN e.saida_em IS NOT NULL AND e.entregue_em IS NOT NULL
                THEN TIMESTAMPDIFF(MINUTE, e.saida_em, e.entregue_em) END) as tempo_medio
        FROM entregas e
        JOIN usuarios u ON e.entregador_id = u.id
        WHERE e.created_at >= :inicio AND e.created_at <= :fim
        GROUP BY u.id, u.nome
        ORDER BY total_entregas DESC
    """), {"inicio": data_inicio, "fim": data_fim})

    entregas_por_entregador = [
        {
            "entregador_id": row.id,
            "entregador_nome": row.nome,
            "total_entregas": row.total_entregas,
            "concluidas": row.concluidas,
            "falharam": row.falharam,
            "taxa_sucesso": round(row.concluidas / row.total_entregas * 100, 1) if row.total_entregas > 0 else 0,
            "tempo_medio_min": round(row.tempo_medio) if row.tempo_medio else None
        }
        for row in entregadores_result.all()
    ]

    # Deliveries by status
    status_result = await db.execute(
        select(Entrega.status, func.count(Entrega.id))
        .where(
            Entrega.created_at >= data_inicio,
            Entrega.created_at <= data_fim
        )
        .group_by(Entrega.status)
    )
    entregas_por_status = {status: count for status, count in status_result.all()}

    return RelatorioEntregasResponse(
        periodo=RelatorioPeriodo(data_inicio=data_inicio, data_fim=data_fim),
        total_entregas=total_entregas,
        tempo_medio_entrega=round(tempo_medio) if tempo_medio else None,
        entregas_por_entregador=entregas_por_entregador,
        entregas_por_status=entregas_por_status
    )


@app.get("/relatorios/pagamentos", tags=["relatorios"])
async def relatorio_pagamentos(
    data_inicio: Optional[datetime] = Query(None),
    data_fim: Optional[datetime] = Query(None),
    current_user: "Usuario" = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Payment methods report."""
    data_inicio, data_fim = parse_period(data_inicio, data_fim)

    # By payment method
    forma_result = await db.execute(text("""
        SELECT
            pe.forma_pagamento,
            COUNT(*) as total_pedidos,
            SUM(pe.total) as valor_total,
            SUM(CASE WHEN pg.status = 'aprovado' THEN 1 ELSE 0 END) as pagos,
            SUM(CASE WHEN pg.status = 'aprovado' THEN pg.valor ELSE 0 END) as valor_pago
        FROM pedidos pe
        LEFT JOIN pagamentos pg ON pe.id = pg.pedido_id
        WHERE pe.created_at >= :inicio AND pe.created_at <= :fim
        GROUP BY pe.forma_pagamento
    """), {"inicio": data_inicio, "fim": data_fim})

    por_forma = [
        {
            "forma": row.forma_pagamento,
            "total_pedidos": row.total_pedidos,
            "valor_total": float(row.valor_total),
            "pagamentos_aprovados": row.pagos,
            "valor_pago": float(row.valor_pago),
            "taxa_aprovacao": round(row.pagos / row.total_pedidos * 100, 1) if row.total_pedidos > 0 else 0
        }
        for row in forma_result.all()
    ]

    # By gateway
    gateway_result = await db.execute(text("""
        SELECT
            pg.gateway,
            COUNT(*) as total,
            SUM(CASE WHEN pg.status = 'aprovado' THEN 1 ELSE 0 END) as aprovados,
            SUM(CASE WHEN pg.status = 'aprovado' THEN pg.valor ELSE 0 END) as valor_aprovado
        FROM pagamentos pg
        WHERE pg.created_at >= :inicio AND pg.created_at <= :fim
        GROUP BY pg.gateway
    """), {"inicio": data_inicio, "fim": data_fim})

    por_gateway = [
        {
            "gateway": row.gateway,
            "total": row.total,
            "aprovados": row.aprovados,
            "valor_aprovado": float(row.valor_aprovado),
            "taxa_aprovacao": round(row.aprovados / row.total * 100, 1) if row.total > 0 else 0
        }
        for row in gateway_result.all()
    ]

    return {
        "periodo": RelatorioPeriodo(data_inicio=data_inicio, data_fim=data_fim),
        "por_forma_pagamento": por_forma,
        "por_gateway": por_gateway
    }


@app.get("/relatorios/avaliacoes", tags=["relatorios"])
async def relatorio_avaliacoes(
    data_inicio: Optional[datetime] = Query(None),
    data_fim: Optional[datetime] = Query(None),
    current_user: "Usuario" = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Reviews report."""
    data_inicio, data_fim = parse_period(data_inicio, data_fim)

    # Overall
    total = await db.scalar(
        select(func.count(Avaliacao.id)).where(
            Avaliacao.created_at >= data_inicio,
            Avaliacao.created_at <= data_fim
        )
    ) or 0

    media = await db.scalar(
        select(func.avg(Avaliacao.nota)).where(
            Avaliacao.created_at >= data_inicio,
            Avaliacao.created_at <= data_fim
        )
    )

    # By rating
    notas_result = await db.execute(
        select(Avaliacao.nota, func.count(Avaliacao.id))
        .where(
            Avaliacao.created_at >= data_inicio,
            Avaliacao.created_at <= data_fim
        )
        .group_by(Avaliacao.nota)
    )
    distribuicao = {str(nota): count for nota, count in notas_result.all()}

    # By product
    produtos_result = await db.execute(text("""
        SELECT
            p.id, p.nome,
            COUNT(a.id) as total_avaliacoes,
            AVG(a.nota) as media_nota
        FROM avaliacoes a
        JOIN pedidos pe ON a.pedido_id = pe.id
        JOIN itens_pedido ip ON pe.id = ip.pedido_id
        JOIN produtos p ON ip.produto_id = p.id
        WHERE a.created_at >= :inicio AND a.created_at <= :fim
        GROUP BY p.id, p.nome
        HAVING total_avaliacoes >= 2
        ORDER BY media_nota DESC, total_avaliacoes DESC
        LIMIT 10
    """), {"inicio": data_inicio, "fim": data_fim})

    produtos_avaliados = [
        {
            "produto_id": row.id,
            "nome": row.nome,
            "total_avaliacoes": row.total_avaliacoes,
            "media_nota": round(float(row.media_nota), 2)
        }
        for row in produtos_result.all()
    ]

    return {
        "periodo": RelatorioPeriodo(data_inicio=data_inicio, data_fim=data_fim),
        "total_avaliacoes": total,
        "media_geral": round(float(media), 2) if media else 0,
        "distribuicao_notas": distribuicao,
        "produtos_melhor_avaliados": produtos_avaliados
    }


@app.get("/relatorios/dashboard", tags=["relatorios"])
async def dashboard_resumo(
    current_user: "Usuario" = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Dashboard summary for admin panel."""
    from datetime import datetime, timedelta

    hoje = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    semana_atras = hoje - timedelta(days=7)
    mes_atras = hoje - timedelta(days=30)

    # Today
    pedidos_hoje = await db.scalar(
        select(func.count(Pedido.id)).where(Pedido.created_at >= hoje)
    ) or 0
    vendas_hoje = await db.scalar(
        select(func.sum(Pedido.total)).where(
            Pedido.created_at >= hoje,
            Pedido.status != "cancelado"
        )
    ) or 0

    # This week
    pedidos_semana = await db.scalar(
        select(func.count(Pedido.id)).where(Pedido.created_at >= semana_atras)
    ) or 0
    vendas_semana = await db.scalar(
        select(func.sum(Pedido.total)).where(
            Pedido.created_at >= semana_atras,
            Pedido.status != "cancelado"
        )
    ) or 0

    # This month
    pedidos_mes = await db.scalar(
        select(func.count(Pedido.id)).where(Pedido.created_at >= mes_atras)
    ) or 0
    vendas_mes = await db.scalar(
        select(func.sum(Pedido.total)).where(
            Pedido.created_at >= mes_atras,
            Pedido.status != "cancelado"
        )
    ) or 0

    # Pending orders
    pedidos_pendentes = await db.scalar(
        select(func.count(Pedido.id)).where(Pedido.status.in_(["novo", "em_preparo", "pronto"]))
    ) or 0

    # Out for delivery
    entregas_rota = await db.scalar(
        select(func.count(Entrega.id)).where(Entrega.status.in_(["atribuida", "retirada", "em_rota"]))
    ) or 0

    # Pending reviews
    avaliacoes_pendentes = await db.scalar(
        select(func.count(Avaliacao.id)).where(Avaliacao.respondida == False)
    ) or 0

    return {
        "hoje": {
            "pedidos": pedidos_hoje,
            "vendas": float(vendas_hoje)
        },
        "ultima_semana": {
            "pedidos": pedidos_semana,
            "vendas": float(vendas_semana)
        },
        "ultimo_mes": {
            "pedidos": pedidos_mes,
            "vendas": float(vendas_mes)
        },
        "alertas": {
            "pedidos_pendentes": pedidos_pendentes,
            "entregas_em_rota": entregas_rota,
            "avaliacoes_pendentes": avaliacoes_pendentes
        }
    }