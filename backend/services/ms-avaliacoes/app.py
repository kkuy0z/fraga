"""
Avaliações Microservice - Order Reviews and Ratings
"""
import os
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import FastAPI, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from services.ms_auth.main import create_app
from shared.database import get_db
from shared.models import (
    Avaliacao, Pedido, Usuario
)
from shared.schemas import (
    AvaliacaoResponse, AvaliacaoCreate, AvaliacaoUpdate, AvaliacaoAdminUpdate,
    PaginationParams, PaginatedResponse
)
from shared.auth import (
    get_current_user, require_perfis, verify_token_permissions,
    PerfilNome
)
from shared.messaging import (
    publish_notificacao_enviar, EventType
)

app = create_app("ms-avaliacoes", "1.0.0")


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
    from shared.auth import PerfilNome
    if user.perfil.nome != PerfilNome.ADMINISTRADOR.value:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# =============================================
# AVALIAÇÕES ENDPOINTS
# =============================================

@app.post("/avaliacoes", response_model=AvaliacaoResponse, status_code=201, tags=["avaliacoes"])
async def create_avaliacao(
    avaliacao_data: AvaliacaoCreate,
    current_user: "Usuario" = Depends(get_current_user_dep),
    db: AsyncSession = Depends(get_db)
):
    """Create review for completed order (client only)."""
    # Verify order exists and belongs to user
    result = await db.execute(
        select(Pedido).where(Pedido.id == avaliacao_data.pedido_id)
    )
    pedido = result.scalar_one_or_none()
    if not pedido:
        raise HTTPException(status_code=404, detail="Order not found")

    if pedido.cliente_id != current_user.id:
        raise HTTPException(status_code=403, detail="Can only review your own orders")

    if pedido.status != "concluido":
        raise HTTPException(status_code=400, detail="Can only review completed orders")

    # Check if already reviewed
    existing = await db.execute(
        select(Avaliacao).where(Avaliacao.pedido_id == avaliacao_data.pedido_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Order already reviewed")

    # Create review
    avaliacao = Avaliacao(
        pedido_id=avaliacao_data.pedido_id,
        cliente_id=current_user.id,
        nota=avaliacao_data.nota,
        comentario=avaliacao_data.comentario
    )
    db.add(avaliacao)
    await db.commit()
    await db.refresh(avaliacao, ["pedido", "cliente"])

    # Notify admin
    await publish_notificacao_enviar(
        usuario_id=1,  # Admin user (assuming ID 1)
        tipo="avaliacao",
        titulo="Nova avaliação recebida",
        mensagem=f"Pedido {pedido.numero} recebeu {avaliacao_data.nota} estrelas",
        dados={"pedido_id": pedido.id, "avaliacao_id": avaliacao.id}
    )

    return AvaliacaoResponse.model_validate(avaliacao)


@app.get("/avaliacoes", response_model=PaginatedResponse, tags=["avaliacoes"])
async def list_avaliacoes(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    nota: Optional[int] = Query(None, ge=1, le=5),
    respondida: Optional[bool] = None,
    data_inicio: Optional[datetime] = None,
    data_fim: Optional[datetime] = None,
    current_user: "Usuario" = Depends(get_current_user_dep),
    db: AsyncSession = Depends(get_db)
):
    """List reviews (admin sees all, client sees own)."""
    query = select(Avaliacao).options(
        selectinload(Avaliacao.pedido).selectinload(Pedido.cliente),
        selectinload(Avaliacao.cliente)
    )

    if current_user.perfil.nome == PerfilNome.CLIENTE.value:
        query = query.where(Avaliacao.cliente_id == current_user.id)

    if nota:
        query = query.where(Avaliacao.nota == nota)
    if respondida is not None:
        query = query.where(Avaliacao.respondida == respondida)
    if data_inicio:
        query = query.where(Avaliacao.created_at >= data_inicio)
    if data_fim:
        query = query.where(Avaliacao.created_at <= data_fim)

    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)

    query = query.order_by(Avaliacao.created_at.desc())
    query = query.offset((page - 1) * size).limit(size)

    result = await db.execute(query)
    avaliacoes = result.scalars().all()

    items = [AvaliacaoResponse.model_validate(a) for a in avaliacoes]
    return PaginatedResponse.create(items, total, page, size)


@app.get("/avaliacoes/{avaliacao_id}", response_model=AvaliacaoResponse, tags=["avaliacoes"])
async def get_avaliacao(
    avaliacao_id: int,
    current_user: "Usuario" = Depends(get_current_user_dep),
    db: AsyncSession = Depends(get_db)
):
    """Get review by ID."""
    result = await db.execute(
        select(Avaliacao)
        .options(
            selectinload(Avaliacao.pedido).selectinload(Pedido.cliente),
            selectinload(Avaliacao.cliente),
            selectinload(Avaliacao.responsavel)
        )
        .where(Avaliacao.id == avaliacao_id)
    )
    avaliacao = result.scalar_one_or_none()
    if not avaliacao:
        raise HTTPException(status_code=404, detail="Review not found")

    # Check permissions
    if (current_user.perfil.nome == PerfilNome.CLIENTE.value and
        avaliacao.cliente_id != current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")

    return AvaliacaoResponse.model_validate(avaliacao)


@app.put("/avaliacoes/{avaliacao_id}", response_model=AvaliacaoResponse, tags=["avaliacoes"])
async def update_avaliacao(
    avaliacao_id: int,
    update_data: AvaliacaoUpdate,
    current_user: "Usuario" = Depends(get_current_user_dep),
    db: AsyncSession = Depends(get_db)
):
    """Update review (client can update own within time limit)."""
    result = await db.execute(
        select(Avaliacao).where(Avaliacao.id == avaliacao_id)
    )
    avaliacao = result.scalar_one_or_none()
    if not avaliacao:
        raise HTTPException(status_code=404, detail="Review not found")

    if current_user.perfil.nome == PerfilNome.CLIENTE.value:
        if avaliacao.cliente_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
        # Client can only update within 24 hours
        from datetime import timedelta
        if datetime.now(timezone.utc) - avaliacao.created_at > timedelta(hours=24):
            raise HTTPException(status_code=400, detail="Review can only be updated within 24 hours")

    if update_data.nota is not None:
        avaliacao.nota = update_data.nota
    if update_data.comentario is not None:
        avaliacao.comentario = update_data.comentario

    await db.commit()
    await db.refresh(avaliacao, ["pedido", "cliente"])
    return AvaliacaoResponse.model_validate(avaliacao)


@app.put("/admin/avaliacoes/{avaliacao_id}", response_model=AvaliacaoResponse, tags=["admin"])
async def admin_update_avaliacao(
    avaliacao_id: int,
    update_data: AvaliacaoAdminUpdate,
    current_user: "Usuario" = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Admin response to review."""
    result = await db.execute(
        select(Avaliacao).where(Avaliacao.id == avaliacao_id)
    )
    avaliacao = result.scalar_one_or_none()
    if not avaliacao:
        raise HTTPException(status_code=404, detail="Review not found")

    if update_data.respondida is not None:
        avaliacao.respondida = update_data.respondida
    if update_data.resposta_admin is not None:
        avaliacao.resposta_admin = update_data.resposta_admin
        avaliacao.respondida_em = datetime.now(timezone.utc)
        avaliacao.respondida_por = current_user.id

    await db.commit()
    await db.refresh(avaliacao, ["pedido", "cliente", "responsavel"])
    return AvaliacaoResponse.model_validate(avaliacao)


@app.get("/estatisticas/avaliacoes", tags=["estatisticas"])
async def get_estatisticas_avaliacoes(
    current_user: "Usuario" = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get review statistics (admin only)."""
    from datetime import datetime, timedelta

    # Overall stats
    total = await db.scalar(select(func.count(Avaliacao.id)))
    media = await db.scalar(select(func.avg(Avaliacao.nota)))

    # By rating
    notas_dist = {}
    for i in range(1, 6):
        count = await db.scalar(
            select(func.count(Avaliacao.id)).where(Avaliacao.nota == i)
        )
        notas_dist[str(i)] = count or 0

    # Last 30 days
    trinta_dias_atras = datetime.now(timezone.utc) - timedelta(days=30)
    recentes = await db.scalar(
        select(func.count(Avaliacao.id)).where(Avaliacao.created_at >= trinta_dias_atras)
    )
    media_recente = await db.scalar(
        select(func.avg(Avaliacao.nota)).where(Avaliacao.created_at >= trinta_dias_atras)
    )

    # Pending responses
    pendentes = await db.scalar(
        select(func.count(Avaliacao.id)).where(Avaliacao.respondida == False)
    )

    return {
        "total_avaliacoes": total or 0,
        "media_geral": round(float(media), 2) if media else 0,
        "distribuicao_notas": notas_dist,
        "ultimos_30_dias": {
            "total": recentes or 0,
            "media": round(float(media_recente), 2) if media_recente else 0
        },
        "pendentes_resposta": pendentes or 0
    }