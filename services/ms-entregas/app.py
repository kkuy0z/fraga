"""
Entregas Microservice - Delivery Management
"""
import os
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import FastAPI, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from sqlalchemy.orm import selectinload

from services.ms_auth.main import create_app
from shared.database import get_db
from shared.models import (
    Entrega, Pedido, Usuario
)
from shared.schemas import (
    EntregaResponse, EntregaCreate, EntregaUpdate,
    PaginationParams, PaginatedResponse
)
from shared.auth import (
    get_current_user, require_perfis, PerfilNome
)
from shared.messaging import (
    publish_notificacao_enviar, EventType
)

app = create_app("ms-entregas", "1.0.0")


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


async def require_entregador_or_admin(user: "Usuario" = Depends(get_current_user_dep)):
    from shared.auth import PerfilNome
    if user.perfil.nome not in [PerfilNome.ADMINISTRADOR.value, PerfilNome.ATENDENTE.value, PerfilNome.ENTREGADOR.value]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return user


# =============================================
# ENTREGAS ENDPOINTS
# =============================================

@app.post("/entregas", response_model=EntregaResponse, status_code=201, tags=["entregas"])
async def create_entrega(
    entrega_data: EntregaCreate,
    current_user: "Usuario" = Depends(require_entregador_or_admin),
    db: AsyncSession = Depends(get_db)
):
    """Create delivery for order (auto-called when order is ready)."""
    result = await db.execute(
        select(Pedido).options(selectinload(Pedido.cliente))
        .where(Pedido.id == entrega_data.pedido_id)
    )
    pedido = result.scalar_one_or_none()
    if not pedido:
        raise HTTPException(status_code=404, detail="Order not found")

    # Check if delivery already exists
    existing = await db.execute(
        select(Entrega).where(Entrega.pedido_id == pedido.id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Delivery already exists for this order")

    # Verify entregador if provided
    if entrega_data.entregador_id:
        result = await db.execute(
            select(Usuario).where(
                Usuario.id == entrega_data.entregador_id,
                Usuario.perfil.has(nome="entregador")
            )
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Invalid entregador_id")

    entrega = Entrega(
        pedido_id=pedido.id,
        entregador_id=entrega_data.entregador_id,
        status="pendente" if not entrega_data.entregador_id else "atribuida"
    )
    db.add(entrega)
    await db.commit()
    await db.refresh(entrega, ["pedido", "entregador"])

    # Notify client
    await publish_notificacao_enviar(
        usuario_id=pedido.cliente_id,
        tipo="entrega",
        titulo="Entrega criada",
        mensagem=f"Seu pedido {pedido.numero} está sendo preparado para entrega.",
        dados={"pedido_id": pedido.id, "entrega_id": entrega.id}
    )

    return EntregaResponse.model_validate(entrega)


@app.get("/entregas", response_model=PaginatedResponse, tags=["entregas"])
async def list_entregas(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    entregador_id: Optional[int] = None,
    current_user: "Usuario" = Depends(get_current_user_dep),
    db: AsyncSession = Depends(get_db)
):
    """List deliveries."""
    from shared.auth import PerfilNome

    query = select(Entrega).options(
        selectinload(Entrega.pedido).selectinload(Pedido.cliente),
        selectinload(Entrega.entregador)
    )

    # Filter by user role
    if current_user.perfil.nome == PerfilNome.ENTREGADOR.value:
        query = query.where(Entrega.entregador_id == current_user.id)
    elif current_user.perfil.nome == PerfilNome.CLIENTE.value:
        query = query.join(Pedido).where(Pedido.cliente_id == current_user.id)
    elif entregador_id:
        query = query.where(Entrega.entregador_id == entregador_id)

    if status:
        query = query.where(Entrega.status == status)

    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)

    query = query.order_by(Entrega.created_at.desc())
    query = query.offset((page - 1) * size).limit(size)

    result = await db.execute(query)
    entregas = result.scalars().all()

    items = [EntregaResponse.model_validate(e) for e in entregas]
    return PaginatedResponse.create(items, total, page, size)


@app.get("/entregas/{entrega_id}", response_model=EntregaResponse, tags=["entregas"])
async def get_entrega(
    entrega_id: int,
    current_user: "Usuario" = Depends(get_current_user_dep),
    db: AsyncSession = Depends(get_db)
):
    """Get delivery details."""
    from shared.auth import PerfilNome

    result = await db.execute(
        select(Entrega).options(
            selectinload(Entrega.pedido).selectinload(Pedido.cliente),
            selectinload(Entrega.entregador)
        ).where(Entrega.id == entrega_id)
    )
    entrega = result.scalar_one_or_none()
    if not entrega:
        raise HTTPException(status_code=404, detail="Delivery not found")

    # Check permissions
    if current_user.perfil.nome == PerfilNome.ENTREGADOR.value and entrega.entregador_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user.perfil.nome == PerfilNome.CLIENTE.value and entrega.pedido.cliente_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return EntregaResponse.model_validate(entrega)


@app.put("/entregas/{entrega_id}", response_model=EntregaResponse, tags=["entregas"])
async def update_entrega(
    entrega_id: int,
    update_data: EntregaUpdate,
    current_user: "Usuario" = Depends(require_entregador_or_admin),
    db: AsyncSession = Depends(get_db)
):
    """Update delivery status."""
    from shared.models import StatusEntrega

    result = await db.execute(
        select(Entrega).options(
            selectinload(Entrega.pedido).selectinload(Pedido.cliente),
            selectinload(Entrega.entregador)
        ).where(Entrega.id == entrega_id)
    )
    entrega = result.scalar_one_or_none()
    if not entrega:
        raise HTTPException(status_code=404, detail="Delivery not found")

    # Entregador can only update status
    if current_user.perfil.nome == PerfilNome.ENTREGADOR.value:
        if entrega.entregador_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
        allowed_fields = {"status", "observacoes", "comprovante_url"}
        update_dict = update_data.model_dump(exclude_unset=True)
        for field in list(update_dict.keys()):
            if field not in allowed_fields:
                del update_dict[field]
    else:
        update_dict = update_data.model_dump(exclude_unset=True)

    # Validate status transitions
    if "status" in update_dict:
        valid_transitions = {
            "pendente": ["atribuida"],
            "atribuida": ["retirada", "falhou"],
            "retirada": ["em_rota", "falhou"],
            "em_rota": ["entregue", "falhou"],
            "entregue": [],
            "falhou": ["atribuida"]
        }
        if update_dict["status"] not in valid_transitions.get(entrega.status, []):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status transition from {entrega.status} to {update_dict['status']}"
            )

    # Update timestamps
    now = datetime.now(timezone.utc)
    if update_dict.get("status") == "retirada" and not entrega.saida_em:
        entrega.saida_em = now
    if update_dict.get("status") == "entregue":
        entrega.entregue_em = now

    for field, value in update_dict.items():
        setattr(entrega, field, value)

    await db.commit()
    await db.refresh(entrega, ["pedido", "entregador"])

    # Notify client
    await publish_notificacao_enviar(
        usuario_id=entrega.pedido.cliente_id,
        tipo="entrega",
        titulo=f"Entrega {entrega.status.replace('_', ' ')}",
        mensagem=f"Seu pedido {entrega.pedido.numero} - {entrega.status.replace('_', ' ')}",
        dados={"pedido_id": entrega.pedido_id, "entrega_id": entrega.id, "status": entrega.status}
    )

    return EntregaResponse.model_validate(entrega)


@app.get("/entregas/minhas/pendentes", response_model=List[EntregaResponse], tags=["entregas"])
async def minhas_entregas_pendentes(
    current_user: "Usuario" = Depends(get_current_user_dep),
    db: AsyncSession = Depends(get_db)
):
    """Get deliveries assigned to current entregador."""
    from shared.auth import PerfilNome
    if current_user.perfil.nome != PerfilNome.ENTREGADOR.value:
        raise HTTPException(status_code=403, detail="Only for deliverers")

    result = await db.execute(
        select(Entrega).options(
            selectinload(Entrega.pedido).selectinload(Pedido.cliente)
        ).where(
            Entrega.entregador_id == current_user.id,
            Entrega.status.in_(["atribuida", "retirada", "em_rota"])
        ).order_by(Entrega.created_at)
    )
    return [EntregaResponse.model_validate(e) for e in result.scalars().all()]


@app.post("/entregas/{entrega_id}/atribuir/{entregador_id}", response_model=EntregaResponse, tags=["entregas"])
async def atribuir_entregador(
    entrega_id: int,
    entregador_id: int,
    current_user: "Usuario" = Depends(require_entregador_or_admin),
    db: AsyncSession = Depends(get_db)
):
    """Assign deliverer to delivery."""
    from shared.auth import PerfilNome

    result = await db.execute(
        select(Entrega).options(
            selectinload(Entrega.pedido).selectinload(Pedido.cliente)
        ).where(Entrega.id == entrega_id)
    )
    entrega = result.scalar_one_or_none()
    if not entrega:
        raise HTTPException(status_code=404, detail="Delivery not found")

    # Verify entregador
    result = await db.execute(
        select(Usuario).where(
            Usuario.id == entregador_id,
            Usuario.perfil.has(nome="entregador"),
            Usuario.ativo == True
        )
    )
    entregador = result.scalar_one_or_none()
    if not entregador:
        raise HTTPException(status_code=400, detail="Invalid or inactive deliverer")

    entrega.entregador_id = entregador_id
    entrega.status = "atribuida"

    await db.commit()
    await db.refresh(entrega, ["pedido", "entregador"])

    # Notify deliverer
    await publish_notificacao_enviar(
        usuario_id=entregador_id,
        tipo="entrega",
        titulo="Nova entrega atribuída",
        mensagem=f"Você tem uma nova entrega: Pedido {entrega.pedido.numero}",
        dados={"pedido_id": entrega.pedido_id, "entrega_id": entrega.id}
    )

    return EntregaResponse.model_validate(entrega)