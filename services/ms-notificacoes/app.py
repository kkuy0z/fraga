"""
Notificações Microservice - Push Notifications, In-app Notifications
"""
import os
import json
import logging
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import FastAPI, Depends, HTTPException, status, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from sqlalchemy.orm import selectinload

# Web Push
from pywebpush import webpush, WebPushException

from services.ms_auth.main import create_app
from shared.database import get_db
from shared.models import (
    Notificacao, PushSubscription, Usuario, Pedido
)
from shared.schemas import (
    NotificacaoResponse, NotificacaoCreate,
    PushSubscriptionResponse, PushSubscriptionCreate,
    PaginationParams, PaginatedResponse
)
from shared.auth import (
    get_current_user, require_perfis, verify_token_permissions,
    PerfilNome
)
from shared.messaging import (
    get_rabbitmq, EventType, Event
)
from shared.websocket import ws_manager, handle_websocket

app = create_app("ms-notificacoes", "1.0.0")

logger = logging.getLogger(__name__)

# VAPID Keys for Web Push
VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY")
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY")
VAPID_EMAIL = os.getenv("VAPID_EMAIL", "mailto:admin@fragalanches.com")


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
# WEBSOCKET ENDPOINT
# =============================================

@app.websocket("/ws/notificacoes")
async def websocket_notificacoes(websocket: WebSocket, token: str = Query(...)):
    """WebSocket for real-time notifications."""
    from shared.auth import decode_token
    from shared.models import Usuario
    from shared.database import async_session_maker

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

        await handle_websocket(websocket, usuario.id, usuario.perfil.nome)


# =============================================
# PUSH SUBSCRIPTION ENDPOINTS
# =============================================

@app.post("/push/subscribe", response_model=PushSubscriptionResponse, status_code=201, tags=["push"])
async def subscribe_push(
    subscription: PushSubscriptionCreate,
    current_user: "Usuario" = Depends(get_current_user_dep),
    db: AsyncSession = Depends(get_db)
):
    """Register push subscription for PWA."""
    # Check if already exists
    result = await db.execute(
        select(PushSubscription).where(
            PushSubscription.usuario_id == current_user.id,
            PushSubscription.endpoint == subscription.endpoint
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        # Update existing
        existing.p256dh = subscription.p256dh
        existing.auth = subscription.auth
        existing.user_agent = subscription.user_agent
        existing.ativo = True
        await db.commit()
        await db.refresh(existing)
        return PushSubscriptionResponse.model_validate(existing)

    # Create new
    push_sub = PushSubscription(
        usuario_id=current_user.id,
        **subscription.model_dump()
    )
    db.add(push_sub)
    await db.commit()
    await db.refresh(push_sub)
    return PushSubscriptionResponse.model_validate(push_sub)


@app.delete("/push/subscribe", status_code=204, tags=["push"])
async def unsubscribe_push(
    endpoint: str,
    current_user: "Usuario" = Depends(get_current_user_dep),
    db: AsyncSession = Depends(get_db)
):
    """Unregister push subscription."""
    result = await db.execute(
        select(PushSubscription).where(
            PushSubscription.usuario_id == current_user.id,
            PushSubscription.endpoint == endpoint
        )
    )
    subscription = result.scalar_one_or_none()
    if subscription:
        subscription.ativo = False
        await db.commit()


@app.get("/push/vapid-public-key", tags=["push"])
async def get_vapid_public_key():
    """Get VAPID public key for client subscription."""
    if not VAPID_PUBLIC_KEY:
        raise HTTPException(status_code=500, detail="VAPID keys not configured")
    return {"public_key": VAPID_PUBLIC_KEY}


# =============================================
# NOTIFICAÇÕES IN-APP ENDPOINTS
# =============================================

@app.get("/notificacoes", response_model=PaginatedResponse, tags=["notificacoes"])
async def list_notificacoes(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    lida: Optional[bool] = None,
    current_user: "Usuario" = Depends(get_current_user_dep),
    db: AsyncSession = Depends(get_db)
):
    """List user notifications."""
    query = select(Notificacao).where(Notificacao.usuario_id == current_user.id)

    if lida is not None:
        query = query.where(Notificacao.lida == lida)

    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)

    query = query.order_by(Notificacao.created_at.desc())
    query = query.offset((page - 1) * size).limit(size)

    result = await db.execute(query)
    notificacoes = result.scalars().all()

    items = [NotificacaoResponse.model_validate(n) for n in notificacoes]
    return PaginatedResponse.create(items, total, page, size)


@app.get("/notificacoes/nao-lidas/count", tags=["notificacoes"])
async def count_nao_lidas(
    current_user: "Usuario" = Depends(get_current_user_dep),
    db: AsyncSession = Depends(get_db)
):
    """Count unread notifications."""
    count = await db.scalar(
        select(func.count(Notificacao.id)).where(
            Notificacao.usuario_id == current_user.id,
            Notificacao.lida == False
        )
    )
    return {"count": count or 0}


@app.put("/notificacoes/{notificacao_id}/ler", response_model=NotificacaoResponse, tags=["notificacoes"])
async def marcar_como_lida(
    notificacao_id: int,
    current_user: "Usuario" = Depends(get_current_user_dep),
    db: AsyncSession = Depends(get_db)
):
    """Mark notification as read."""
    result = await db.execute(
        select(Notificacao).where(
            Notificacao.id == notificacao_id,
            Notificacao.usuario_id == current_user.id
        )
    )
    notificacao = result.scalar_one_or_none()
    if not notificacao:
        raise HTTPException(status_code=404, detail="Notification not found")

    notificacao.lida = True
    await db.commit()
    await db.refresh(notificacao)
    return NotificacaoResponse.model_validate(notificacao)


@app.put("/notificacoes/ler-todas", tags=["notificacoes"])
async def marcar_todas_como_lidas(
    current_user: "Usuario" = Depends(get_current_user_dep),
    db: AsyncSession = Depends(get_db)
):
    """Mark all notifications as read."""
    await db.execute(
        update(Notificacao)
        .where(Notificacao.usuario_id == current_user.id, Notificacao.lida == False)
        .values(lida=True)
    )
    await db.commit()
    return {"message": "All notifications marked as read"}


# Admin: Send notification
@app.post("/admin/notificacoes", response_model=NotificacaoResponse, status_code=201, tags=["admin"])
async def create_notificacao_admin(
    notificacao_data: NotificacaoCreate,
    current_user: "Usuario" = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Create notification for user (admin only)."""
    # Verify user exists
    result = await db.execute(select(Usuario).where(Usuario.id == notificacao_data.usuario_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="User not found")

    notificacao = Notificacao(**notificacao_data.model_dump())
    db.add(notificacao)
    await db.commit()
    await db.refresh(notificacao)

    # Send via WebSocket if user is online
    await ws_manager.send_personal_message(notificacao_data.usuario_id, {
        "type": "notification",
        "notification": NotificacaoResponse.model_validate(notificacao).model_dump()
    })

    # Send push if user has subscription
    await send_push_to_user(notificacao_data.usuario_id, notificacao.titulo, notificacao.mensagem, notificacao.dados)

    return NotificacaoResponse.model_validate(notificacao)


# Admin: Broadcast notification
@app.post("/admin/notificacoes/broadcast", tags=["admin"])
async def broadcast_notificacao(
    titulo: str,
    mensagem: str,
    tipo: str = "sistema",
    perfis: List[str] = None,
    current_user: "Usuario" = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Broadcast notification to multiple users (admin only)."""
    from shared.models import Perfil

    query = select(Usuario).where(Usuario.ativo == True)
    if perfis:
        query = query.join(Perfil).where(Perfil.nome.in_(perfis))

    result = await db.execute(query)
    usuarios = result.scalars().all()

    notifications = []
    for usuario in usuarios:
        notificacao = Notificacao(
            usuario_id=usuario.id,
            tipo=tipo,
            titulo=titulo,
            mensagem=mensagem
        )
        db.add(notificacao)
        notifications.append(notificacao)

    await db.commit()

    # Send via WebSocket
    for notif in notifications:
        await ws_manager.send_personal_message(notif.usuario_id, {
            "type": "notification",
            "notification": NotificacaoResponse.model_validate(notif).model_dump()
        })

        # Send push
        await send_push_to_user(notif.usuario_id, titulo, mensagem)

    return {"sent": len(notifications)}


# =============================================
# RABBITMQ EVENT HANDLERS
# =============================================

async def handle_notification_event(event: Event):
    """Handle notification events from RabbitMQ."""
    try:
        if event.type == EventType.NOTIFICACAO_ENVIAR:
            payload = event.payload
            usuario_id = payload.get("usuario_id")
            if usuario_id:
                # Create in-app notification
                from shared.database import async_session_maker
                async with async_session_maker() as db:
                    notificacao = Notificacao(
                        usuario_id=usuario_id,
                        tipo=payload.get("tipo", "sistema"),
                        titulo=payload.get("titulo", "Notificação"),
                        mensagem=payload.get("mensagem", ""),
                        dados=payload.get("dados")
                    )
                    db.add(notificacao)
                    await db.commit()
                    await db.refresh(notificacao)

                    # Send via WebSocket
                    await ws_manager.send_personal_message(usuario_id, {
                        "type": "notification",
                        "notification": NotificacaoResponse.model_validate(notificacao).model_dump()
                    })

        elif event.type == EventType.NOTIFICACAO_PUSH_ENVIAR:
            payload = event.payload
            usuario_id = payload.get("usuario_id")
            if usuario_id:
                await send_push_to_user(
                    usuario_id,
                    payload.get("titulo", "Notificação"),
                    payload.get("mensagem", ""),
                    payload.get("dados")
                )
    except Exception as e:
        logger.error(f"Error handling notification event: {e}", exc_info=True)


async def send_push_to_user(usuario_id: int, titulo: str, mensagem: str, dados: dict = None):
    """Send Web Push notification to user."""
    if not VAPID_PRIVATE_KEY or not VAPID_PUBLIC_KEY:
        logger.warning("VAPID keys not configured, skipping push")
        return

    from shared.database import async_session_maker
    async with async_session_maker() as db:
        result = await db.execute(
            select(PushSubscription).where(
                PushSubscription.usuario_id == usuario_id,
                PushSubscription.ativo == True
            )
        )
        subscriptions = result.scalars().all()

        for sub in subscriptions:
            try:
                push_data = {
                    "title": titulo,
                    "body": mensagem,
                    "icon": "/img/icon-192.png",
                    "badge": "/img/icon-72.png",
                    "data": dados or {},
                    "actions": [
                        {"action": "open", "title": "Abrir"},
                        {"action": "close", "title": "Fechar"}
                    ]
                }

                webpush(
                    subscription_info={
                        "endpoint": sub.endpoint,
                        "keys": {
                            "p256dh": sub.p256dh,
                            "auth": sub.auth
                        }
                    },
                    data=json.dumps(push_data),
                    vapid_private_key=VAPID_PRIVATE_KEY,
                    vapid_claims={
                        "sub": VAPID_EMAIL,
                        "aud": "https://fragalanches.com"
                    }
                )
                logger.info(f"Push sent to user {usuario_id}")

                # Mark notification as push sent
                await db.execute(
                    update(Notificacao)
                    .where(Notificacao.usuario_id == usuario_id, Notificacao.enviada_push == False)
                    .values(enviada_push=True)
                )
                await db.commit()

            except WebPushException as e:
                logger.error(f"WebPush error for user {usuario_id}: {e}")
                # If subscription expired, mark as inactive
                if e.response and e.response.status_code in [404, 410]:
                    sub.ativo = False
                    await db.commit()
            except Exception as e:
                logger.error(f"Error sending push to user {usuario_id}: {e}")


# Startup: Register RabbitMQ consumer
@app.on_event("startup")
async def startup_notifications():
    """Start RabbitMQ consumer for notifications."""
    rabbitmq = await get_rabbitmq()
    await rabbitmq.consume(
        queue_name="notificacoes.processar",
        handler=handle_notification_event,
        routing_keys=[
            "notificacao.enviar",
            "notificacao.push_enviar",
            "pedido.criado",
            "pedido.status_atualizado",
            "pagamento.aprovado",
            "pagamento.recusado",
            "entrega.atribuida",
            "entrega.saida",
            "entrega.em_rota",
            "entrega.concluida",
            "entrega.falhou"
        ]
    )
    logger.info("Notification service started consuming events")


@app.on_event("shutdown")
async def shutdown_notifications():
    """Stop RabbitMQ consumer."""
    await close_rabbitmq()