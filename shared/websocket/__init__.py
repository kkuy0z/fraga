"""
Shared WebSocket manager for real-time communication.
"""
import asyncio
import json
import logging
from typing import Dict, Set, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime
from fastapi import WebSocket, WebSocketDisconnect
from shared.messaging import Event, EventType, get_rabbitmq

logger = logging.getLogger(__name__)


@dataclass
class ConnectionInfo:
    """Information about a WebSocket connection."""
    websocket: WebSocket
    user_id: int
    perfil: str
    connected_at: datetime = field(default_factory=datetime.utcnow)
    subscriptions: Set[str] = field(default_factory=set)


class WebSocketManager:
    """Manages WebSocket connections and message broadcasting."""

    def __init__(self):
        self.active_connections: Dict[int, ConnectionInfo] = {}
        self.user_connections: Dict[int, Set[WebSocket]] = {}
        self._rabbitmq_consumer_task: Optional[asyncio.Task] = None

    async def connect(self, websocket: WebSocket, user_id: int, perfil: str) -> None:
        """Accept and register a new WebSocket connection."""
        await websocket.accept()
        info = ConnectionInfo(websocket=websocket, user_id=user_id, perfil=perfil)
        self.active_connections[id(websocket)] = info

        if user_id not in self.user_connections:
            self.user_connections[user_id] = set()
        self.user_connections[user_id].add(websocket)

        logger.info(f"WebSocket connected: user_id={user_id}, perfil={perfil}, total={len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket) -> None:
        """Remove a WebSocket connection."""
        ws_id = id(websocket)
        if ws_id in self.active_connections:
            info = self.active_connections.pop(ws_id)
            user_id = info.user_id
            if user_id in self.user_connections:
                self.user_connections[user_id].discard(websocket)
                if not self.user_connections[user_id]:
                    del self.user_connections[user_id]
            logger.info(f"WebSocket disconnected: user_id={user_id}, total={len(self.active_connections)}")

    async def send_personal_message(self, user_id: int, message: Dict[str, Any]) -> bool:
        """Send message to all connections of a specific user."""
        if user_id not in self.user_connections:
            return False

        disconnected = set()
        for websocket in self.user_connections[user_id]:
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.warning(f"Failed to send to user {user_id}: {e}")
                disconnected.add(websocket)

        for ws in disconnected:
            self.disconnect(ws)

        return len(disconnected) < len(self.user_connections.get(user_id, set()))

    async def broadcast(self, message: Dict[str, Any], perfil_filter: Optional[str] = None) -> int:
        """Broadcast message to all connected clients, optionally filtered by perfil."""
        sent = 0
        disconnected = []

        for ws_id, info in self.active_connections.items():
            if perfil_filter and info.perfil != perfil_filter:
                continue
            try:
                await info.websocket.send_json(message)
                sent += 1
            except Exception as e:
                logger.warning(f"Failed to broadcast to {info.user_id}: {e}")
                disconnected.append(info.websocket)

        for ws in disconnected:
            self.disconnect(ws)

        return sent

    async def broadcast_to_perfis(self, message: Dict[str, Any], perfis: list[str]) -> int:
        """Broadcast message to connections with specific perfis."""
        sent = 0
        disconnected = []

        for ws_id, info in self.active_connections.items():
            if info.perfil in perfis:
                try:
                    await info.websocket.send_json(message)
                    sent += 1
                except Exception as e:
                    logger.warning(f"Failed to broadcast to {info.user_id}: {e}")
                    disconnected.append(info.websocket)

        for ws in disconnected:
            self.disconnect(ws)

        return sent

    def get_connection_count(self) -> int:
        """Get total number of active connections."""
        return len(self.active_connections)

    def get_user_connection_count(self, user_id: int) -> int:
        """Get number of connections for a specific user."""
        return len(self.user_connections.get(user_id, set()))

    def is_user_online(self, user_id: int) -> bool:
        """Check if user has any active connections."""
        return user_id in self.user_connections and len(self.user_connections[user_id]) > 0


# Global WebSocket manager
ws_manager = WebSocketManager()


async def handle_websocket(websocket: WebSocket, user_id: int, perfil: str) -> None:
    """Handle WebSocket connection lifecycle."""
    await ws_manager.connect(websocket, user_id, perfil)
    try:
        while True:
            data = await websocket.receive_json()
            # Handle incoming messages (ping, subscriptions, etc.)
            await handle_ws_message(websocket, user_id, perfil, data)
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}", exc_info=True)
        ws_manager.disconnect(websocket)


async def handle_ws_message(websocket: WebSocket, user_id: int, perfil: str, data: Dict[str, Any]) -> None:
    """Handle incoming WebSocket messages from client."""
    msg_type = data.get("type")

    if msg_type == "ping":
        await websocket.send_json({"type": "pong", "timestamp": datetime.utcnow().isoformat() + "Z"})

    elif msg_type == "subscribe":
        # Client wants to subscribe to specific events
        channels = data.get("channels", [])
        ws_id = id(websocket)
        if ws_id in ws_manager.active_connections:
            ws_manager.active_connections[ws_id].subscriptions.update(channels)
        await websocket.send_json({
            "type": "subscribed",
            "channels": list(ws_manager.active_connections[ws_id].subscriptions)
        })

    elif msg_type == "unsubscribe":
        channels = data.get("channels", [])
        ws_id = id(websocket)
        if ws_id in ws_manager.active_connections:
            ws_manager.active_connections[ws_id].subscriptions.difference_update(channels)
        await websocket.send_json({
            "type": "unsubscribed",
            "channels": list(ws_manager.active_connections[ws_id].subscriptions)
        })


async def start_rabbitmq_consumer() -> None:
    """Start consuming events from RabbitMQ and broadcast via WebSocket."""
    rabbitmq = await get_rabbitmq()

    async def handle_event(event: Event) -> None:
        """Process event and broadcast to relevant WebSocket connections."""
        message = {
            "type": "event",
            "event_type": event.type.value,
            "payload": event.payload,
            "timestamp": event.timestamp
        }

        # Route events to appropriate clients
        if event.type in [EventType.PEDIDO_CRIADO, EventType.PEDIDO_STATUS_ATUALIZADO]:
            # Notify cozinha and atendente
            await ws_manager.broadcast_to_perfis(message, ["cozinha", "atendente", "administrador"])

            # If status update, notify the specific client
            if event.type == EventType.PEDIDO_STATUS_ATUALIZADO:
                pedido_id = event.payload.get("pedido_id")
                # We'd need to track which user owns which pedido
                # For now, broadcast to all - frontend filters

        elif event.type in [EventType.PAGAMENTO_APROVADO, EventType.PAGAMENTO_RECUSADO]:
            # Notify client and admin
            await ws_manager.broadcast_to_perfis(message, ["cliente", "administrador", "atendente"])

        elif event.type in [EventType.ENTREGA_ATRIBUIDA, EventType.ENTREGA_SAIDA,
                           EventType.ENTREGA_EM_ROTA, EventType.ENTREGA_CONCLUIDA, EventType.ENTREGA_FALHOU]:
            # Notify client and entregador
            await ws_manager.broadcast_to_perfis(message, ["cliente", "entregador", "administrador", "atendente"])

        elif event.type == EventType.NOTIFICACAO_ENVIAR:
            # Send to specific user
            usuario_id = event.payload.get("usuario_id")
            if usuario_id:
                await ws_manager.send_personal_message(usuario_id, message)

        elif event.type == EventType.NOTIFICACAO_PUSH_ENVIAR:
            # Send push notification to specific user
            usuario_id = event.payload.get("usuario_id")
            if usuario_id:
                await ws_manager.send_personal_message(usuario_id, message)

    # Consume from notification queue
    await rabbitmq.consume(
        queue_name="notificacoes.websocket",
        handler=handle_event,
        routing_keys=[
            "pedido.criado",
            "pedido.status_atualizado",
            "pagamento.aprovado",
            "pagamento.recusado",
            "entrega.atribuida",
            "entrega.saida",
            "entrega.em_rota",
            "entrega.concluida",
            "entrega.falhou",
            "notificacao.enviar",
            "notificacao.push_enviar"
        ]
    )


async def stop_rabbitmq_consumer() -> None:
    """Stop the RabbitMQ consumer."""
    await close_rabbitmq()