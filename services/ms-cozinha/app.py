"""
Cozinha Microservice - Kitchen Panel, Real-time Order Status, Alerts
"""
import os
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import FastAPI, Depends, HTTPException, status, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_
from sqlalchemy.orm import selectinload

from services.ms_auth.main import create_app
from shared.database import get_db
from shared.models import (
    Pedido, ItemPedido, HistoricoStatusPedido, Usuario, Produto
)
from shared.schemas import (
    PedidoResponse, PedidoListResponse, PedidoUpdateStatus,
    HistoricoStatusResponse
)
from shared.auth import (
    get_current_user, require_perfis, verify_token_permissions,
    PerfilNome
)
from shared.messaging import (
    publish_pedido_status_atualizado, get_rabbitmq, EventType
)
from shared.websocket import ws_manager, handle_websocket

app = create_app("ms-cozinha", "1.0.0")


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


async def require_cozinha_access(user: "Usuario" = Depends(get_current_user_dep)):
    from shared.auth import PerfilNome
    if user.perfil.nome not in [PerfilNome.ADMINISTRADOR.value, PerfilNome.ATENDENTE.value, PerfilNome.COZINHA.value]:
        raise HTTPException(status_code=403, detail="Insufficient permissions - kitchen access required")
    return user


# =============================================
# WEBSOCKET ENDPOINT
# =============================================

@app.websocket("/ws/cozinha")
async def websocket_cozinha(websocket: WebSocket, token: str = Query(...)):
    """WebSocket for real-time kitchen updates."""
    from shared.auth import decode_token
    from shared.models import Usuario
    from shared.database import async_session_maker

    # Validate token
    token_data = decode_token(token)
    if not token_data:
        await websocket.close(code=4001, reason="Invalid token")
        return

    async with async_session_maker() as db:
        result = await db.execute(select(Usuario).where(Usuario.id == int(token_data.sub)))
        usuario = result.scalar_one_or_none()
        if not usuario or not usuario.ativo:
            await websocket.close(code=4001, reason="User not found")
            return

        if usuario.perfil.nome not in [PerfilNome.ADMINISTRADOR.value, PerfilNome.ATENDENTE.value, PerfilNome.COZINHA.value]:
            await websocket.close(code=4003, reason="Insufficient permissions")
            return

        await handle_websocket(websocket, usuario.id, usuario.perfil.nome)


# =============================================
# PEDIDOS ENDPOINTS (Kitchen View)
# =============================================

@app.get("/pedidos", response_model=List[PedidoListResponse], tags=["pedidos"])
async def list_pedidos_cozinha(
    status: Optional[str] = Query(None, description="Filter by status"),
    current_user: "Usuario" = Depends(require_cozinha_access),
    db: AsyncSession = Depends(get_db)
):
    """List orders for kitchen panel."""
    query = select(Pedido).options(
        selectinload(Pedido.itens).selectinload(ItemPedido.produto),
        selectinload(Pedido.cliente)
    )

    # Kitchen sees: novo, em_preparo, pronto
    # Atendente sees all
    if current_user.perfil.nome == PerfilNome.COZINHA.value:
        query = query.where(Pedido.status.in_(["novo", "em_preparo", "pronto"]))
    elif status:
        query = query.where(Pedido.status == status)

    # Order by priority: novo first, then by creation time
    from sqlalchemy import case
    query = query.order_by(
        case(
            (Pedido.status == "novo", 0),
            (Pedido.status == "em_preparo", 1),
            (Pedido.status == "pronto", 2),
            else_=3
        ),
        Pedido.created_at
    )

    result = await db.execute(query)
    pedidos = result.scalars().all()

    return [
        PedidoListResponse(
            id=p.id,
            numero=p.numero,
            cliente_nome=p.cliente.nome,
            status=p.status,
            total=p.total,
            forma_pagamento=p.forma_pagamento,
            created_at=p.created_at,
            itens_count=len(p.itens)
        )
        for p in pedidos
    ]


@app.get("/pedidos/{pedido_id}", response_model=PedidoResponse, tags=["pedidos"])
async def get_pedido_cozinha(
    pedido_id: int,
    current_user: "Usuario" = Depends(require_cozinha_access),
    db: AsyncSession = Depends(get_db)
):
    """Get order details for kitchen."""
    result = await db.execute(
        select(Pedido)
        .options(
            selectinload(Pedido.itens).selectinload(ItemPedido.produto),
            selectinload(Pedido.cliente),
            selectinload(Pedido.endereco)
        )
        .where(Pedido.id == pedido_id)
    )
    pedido = result.scalar_one_or_none()
    if not pedido:
        raise HTTPException(status_code=404, detail="Order not found")

    return PedidoResponse.model_validate(pedido)


@app.put("/pedidos/{pedido_id}/status", response_model=PedidoResponse, tags=["pedidos"])
async def update_pedido_status_cozinha(
    pedido_id: int,
    update_data: PedidoUpdateStatus,
    current_user: "Usuario" = Depends(require_cozinha_access),
    db: AsyncSession = Depends(get_db)
):
    """Update order status from kitchen panel."""
    from shared.models import StatusPedido

    # Kitchen can only: novo -> em_preparo, em_preparo -> pronto
    # Atendente/Admin: all transitions
    valid_transitions = {
        "novo": ["em_preparo", "cancelado"],
        "em_preparo": ["pronto", "cancelado"],
        "pronto": ["saiu_entrega", "cancelado"],
        "saiu_entrega": ["concluido", "cancelado"],
        "concluido": [],
        "cancelado": []
    }

    if current_user.perfil.nome == PerfilNome.COZINHA.value:
        valid_transitions = {
            "novo": ["em_preparo"],
            "em_preparo": ["pronto"],
            "pronto": [],
            "saiu_entrega": [],
            "concluido": [],
            "cancelado": []
        }

    result = await db.execute(
        select(Pedido).options(selectinload(Pedido.cliente))
        .where(Pedido.id == pedido_id)
    )
    pedido = result.scalar_one_or_none()
    if not pedido:
        raise HTTPException(status_code=404, detail="Order not found")

    if update_data.status not in valid_transitions.get(pedido.status, []):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status transition from {pedido.status} to {update_data.status}"
        )

    status_anterior = pedido.status
    pedido.status = update_data.status

    now = datetime.now(timezone.utc)

    # Create history
    historico = HistoricoStatusPedido(
        pedido_id=pedido.id,
        status_anterior=status_anterior,
        status_novo=update_data.status,
        usuario_id=current_user.id,
        observacao=update_data.observacao
    )
    db.add(historico)

    await db.commit()
    await db.refresh(pedido, ["itens", "cliente", "endereco"])

    # Publish event
    await publish_pedido_status_atualizado(
        pedido_id=pedido.id,
        numero=pedido.numero,
        status_anterior=status_anterior,
        status_novo=update_data.status,
        usuario_id=current_user.id,
        correlation_id=str(pedido.id)
    )

    # Notify via WebSocket
    await ws_manager.broadcast_to_perfis({
        "type": "event",
        "event_type": "pedido.status_atualizado",
        "payload": {
            "pedido_id": pedido.id,
            "numero": pedido.numero,
            "status_anterior": status_anterior,
            "status_novo": update_data.status,
            "updated_at": now.isoformat() + "Z",
            "updated_by": current_user.nome
        },
        "timestamp": now.isoformat() + "Z"
    }, ["cozinha", "atendente", "administrador"])

    # Notify client
    await ws_manager.send_personal_message(pedido.cliente_id, {
        "type": "event",
        "event_type": "pedido.status_atualizado",
        "payload": {
            "pedido_id": pedido.id,
            "numero": pedido.numero,
            "status_anterior": status_anterior,
            "status_novo": update_data.status,
            "updated_at": now.isoformat() + "Z"
        },
        "timestamp": now.isoformat() + "Z"
    })

    return PedidoResponse.model_validate(pedido)


@app.get("/pedidos/{pedido_id}/historico", response_model=List[HistoricoStatusResponse], tags=["pedidos"])
async def get_pedido_historico_cozinha(
    pedido_id: int,
    current_user: "Usuario" = Depends(require_cozinha_access),
    db: AsyncSession = Depends(get_db)
):
    """Get order status history."""
    result = await db.execute(select(Pedido).where(Pedido.id == pedido_id))
    pedido = result.scalar_one_or_none()
    if not pedido:
        raise HTTPException(status_code=404, detail="Order not found")

    result = await db.execute(
        select(HistoricoStatusPedido)
        .options(selectinload(HistoricoStatusPedido.usuario))
        .where(HistoricoStatusPedido.pedido_id == pedido_id)
        .order_by(HistoricoStatusPedido.created_at)
    )
    historico = result.scalars().all()

    return [
        HistoricoStatusResponse(
            id=h.id,
            pedido_id=h.pedido_id,
            status_anterior=h.status_anterior,
            status_novo=h.status_novo,
            usuario_id=h.usuario_id,
            usuario_nome=h.usuario.nome if h.usuario else None,
            observacao=h.observacao,
            created_at=h.created_at
        )
        for h in historico
    ]


# =============================================
# ALERTAS / ESTATÍSTICAS
# =============================================

@app.get("/estatisticas", tags=["estatisticas"])
async def get_estatisticas_cozinha(
    current_user: "Usuario" = Depends(require_cozinha_access),
    db: AsyncSession = Depends(get_db)
):
    """Get kitchen statistics."""
    from datetime import datetime, timedelta

    hoje_inicio = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    # Count by status
    stats = {}
    for status in ["novo", "em_preparo", "pronto", "saiu_entrega", "concluido", "cancelado"]:
        count = await db.scalar(
            select(func.count(Pedido.id)).where(
                Pedido.status == status,
                Pedido.created_at >= hoje_inicio
            )
        )
        stats[status] = count or 0

    # Average prep time for completed orders today
    from sqlalchemy import text
    result = await db.execute(text("""
        SELECT AVG(TIMESTAMPDIFF(MINUTE, created_at, concluido_at)) as tempo_medio
        FROM pedidos
        WHERE status = 'concluido' AND DATE(created_at) = CURDATE() AND concluido_at IS NOT NULL
    """))
    tempo_medio = result.scalar()

    return {
        "pedidos_por_status": stats,
        "total_hoje": sum(stats.values()),
        "tempo_medio_preparo_min": round(tempo_medio) if tempo_medio else None,
        "atualizado_em": datetime.now(timezone.utc).isoformat() + "Z"
    }


@app.get("/alertas/novo-pedido", tags=["alertas"])
async def check_novo_pedido_alert(
    current_user: "Usuario" = Depends(require_cozinha_access),
    db: AsyncSession = Depends(get_db)
):
    """Check for new orders since last check (for polling fallback)."""
    # This is a fallback for when WebSocket is not available
    # Frontend should use WebSocket for real-time alerts

    count = await db.scalar(
        select(func.count(Pedido.id)).where(
            Pedido.status == "novo",
            Pedido.created_at >= datetime.now(timezone.utc) - timedelta(minutes=5)
        )
    )

    return {
        "tem_novos": (count or 0) > 0,
        "count": count or 0
    }