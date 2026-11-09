"""
Shared RabbitMQ messaging utilities for event-driven communication between microservices.
"""
import os
import json
import asyncio
import logging
from typing import Callable, Dict, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime
from enum import Enum
import aio_pika
from aio_pika import ExchangeType, Message, DeliveryMode
from aio_pika.abc import AbstractConnection, AbstractChannel, AbstractQueue, AbstractExchange

logger = logging.getLogger(__name__)

# RabbitMQ Configuration
RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://fraga_user:fraga_pass_2026@localhost:5672")


class EventType(str, Enum):
    # Pedido events
    PEDIDO_CRIADO = "pedido.criado"
    PEDIDO_STATUS_ATUALIZADO = "pedido.status_atualizado"
    PEDIDO_CANCELADO = "pedido.cancelado"
    PEDIDO_CONCLUIDO = "pedido.concluido"

    # Pagamento events
    PAGAMENTO_APROVADO = "pagamento.aprovado"
    PAGAMENTO_RECUSADO = "pagamento.recusado"
    PAGAMENTO_PENDENTE = "pagamento.pendente"

    # Entrega events
    ENTREGA_ATRIBUIDA = "entrega.atribuida"
    ENTREGA_SAIDA = "entrega.saida"
    ENTREGA_EM_ROTA = "entrega.em_rota"
    ENTREGA_CONCLUIDA = "entrega.concluida"
    ENTREGA_FALHOU = "entrega.falhou"

    # Avaliação events
    AVALIACAO_CRIADA = "avaliacao.criada"

    # Notificação events
    NOTIFICACAO_ENVIAR = "notificacao.enviar"
    NOTIFICACAO_PUSH_ENVIAR = "notificacao.push_enviar"

    # Sistema events
    ESTABELECIMENTO_ABERTO = "sistema.estabelecimento_aberto"
    ESTABELECIMENTO_FECHADO = "sistema.estabelecimento_fechado"


@dataclass
class Event:
    """Base event structure."""
    type: EventType
    payload: Dict[str, Any]
    timestamp: str = None
    correlation_id: Optional[str] = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow().isoformat() + "Z"

    def to_json(self) -> str:
        return json.dumps({
            "type": self.type.value,
            "payload": self.payload,
            "timestamp": self.timestamp,
            "correlation_id": self.correlation_id
        })

    @classmethod
    def from_json(cls, data: str) -> "Event":
        obj = json.loads(data)
        return cls(
            type=EventType(obj["type"]),
            payload=obj["payload"],
            timestamp=obj.get("timestamp"),
            correlation_id=obj.get("correlation_id")
        )


class RabbitMQClient:
    """Async RabbitMQ client for publishing and consuming events."""

    def __init__(self, url: str = RABBITMQ_URL):
        self.url = url
        self.connection: Optional[AbstractConnection] = None
        self.channel: Optional[AbstractChannel] = None
        self.exchanges: Dict[str, AbstractExchange] = {}
        self.queues: Dict[str, AbstractQueue] = {}
        self._consumer_tasks: Dict[str, asyncio.Task] = {}

    async def connect(self) -> None:
        """Establish connection to RabbitMQ."""
        if self.connection and not self.connection.is_closed:
            return

        self.connection = await aio_pika.connect_robust(self.url)
        self.channel = await self.connection.channel()
        await self.channel.set_qos(prefetch_count=10)

        # Declare main exchanges
        await self._declare_exchange("fraga.events", ExchangeType.TOPIC)
        await self._declare_exchange("fraga.commands", ExchangeType.DIRECT)
        await self._declare_exchange("fraga.dlx", ExchangeType.TOPIC)  # Dead letter exchange

        logger.info("Connected to RabbitMQ")

    async def _declare_exchange(self, name: str, exchange_type: ExchangeType) -> AbstractExchange:
        if name not in self.exchanges:
            exchange = await self.channel.declare_exchange(
                name, exchange_type, durable=True
            )
            self.exchanges[name] = exchange
        return self.exchanges[name]

    async def declare_queue(
        self,
        name: str,
        durable: bool = True,
        dead_letter: bool = True
    ) -> AbstractQueue:
        """Declare a queue with optional dead letter configuration."""
        if name in self.queues:
            return self.queues[name]

        arguments = {}
        if dead_letter:
            arguments["x-dead-letter-exchange"] = "fraga.dlx"
            arguments["x-dead-letter-routing-key"] = f"dlq.{name}"

        queue = await self.channel.declare_queue(
            name, durable=durable, arguments=arguments
        )
        self.queues[name] = queue
        return queue

    async def bind_queue(
        self,
        queue_name: str,
        exchange_name: str,
        routing_key: str
    ) -> None:
        """Bind queue to exchange with routing key."""
        queue = self.queues.get(queue_name)
        exchange = self.exchanges.get(exchange_name)
        if not queue:
            queue = await self.declare_queue(queue_name)
        if not exchange:
            exchange = await self._declare_exchange(exchange_name, ExchangeType.TOPIC)
        await queue.bind(exchange, routing_key)

    async def publish(
        self,
        event: Event,
        exchange: str = "fraga.events",
        routing_key: Optional[str] = None
    ) -> None:
        """Publish an event to exchange."""
        if not self.channel or self.channel.is_closed:
            await self.connect()

        if routing_key is None:
            routing_key = event.type.value

        exchange_obj = self.exchanges.get(exchange)
        if not exchange_obj:
            exchange_obj = await self._declare_exchange(exchange, ExchangeType.TOPIC)

        message = Message(
            body=event.to_json().encode(),
            content_type="application/json",
            delivery_mode=DeliveryMode.PERSISTENT,
            timestamp=datetime.utcnow(),
            message_id=event.correlation_id or f"{event.type.value}-{datetime.utcnow().timestamp()}",
        )

        await exchange_obj.publish(message, routing_key=routing_key)
        logger.debug(f"Published event: {event.type.value} to {exchange}/{routing_key}")

    async def consume(
        self,
        queue_name: str,
        handler: Callable[[Event], Any],
        exchange: str = "fraga.events",
        routing_keys: list[str] = None
    ) -> None:
        """Start consuming messages from a queue."""
        if not self.channel or self.channel.is_closed:
            await self.connect()

        queue = await self.declare_queue(queue_name)

        if routing_keys:
            for rk in routing_keys:
                await self.bind_queue(queue_name, exchange, rk)

        async def process_message(message: aio_pika.abc.AbstractIncomingMessage):
            async with message.process():
                try:
                    event = Event.from_json(message.body.decode())
                    await handler(event)
                except Exception as e:
                    logger.error(f"Error processing message: {e}", exc_info=True)
                    # Don't requeue - let it go to DLQ
                    raise

        consumer_tag = await queue.consume(process_message)
        logger.info(f"Started consuming from {queue_name} with tag {consumer_tag}")

    async def close(self) -> None:
        """Close connection and cancel consumers."""
        for task in self._consumer_tasks.values():
            task.cancel()
        if self.connection and not self.connection.is_closed:
            await self.connection.close()
        logger.info("RabbitMQ connection closed")


# Global client instance
_rabbitmq_client: Optional[RabbitMQClient] = None


async def get_rabbitmq() -> RabbitMQClient:
    """Get or create global RabbitMQ client."""
    global _rabbitmq_client
    if _rabbitmq_client is None:
        _rabbitmq_client = RabbitMQClient()
        await _rabbitmq_client.connect()
    return _rabbitmq_client


async def close_rabbitmq() -> None:
    """Close global RabbitMQ client."""
    global _rabbitmq_client
    if _rabbitmq_client:
        await _rabbitmq_client.close()
        _rabbitmq_client = None


# Helper functions for common events
async def publish_pedido_criado(pedido_data: Dict[str, Any], correlation_id: str = None) -> None:
    """Publish pedido.criado event."""
    client = await get_rabbitmq()
    event = Event(
        type=EventType.PEDIDO_CRIADO,
        payload=pedido_data,
        correlation_id=correlation_id
    )
    await client.publish(event)


async def publish_pedido_status_atualizado(
    pedido_id: int,
    numero: str,
    status_anterior: str,
    status_novo: str,
    usuario_id: int = None,
    correlation_id: str = None
) -> None:
    """Publish pedido.status_atualizado event."""
    client = await get_rabbitmq()
    event = Event(
        type=EventType.PEDIDO_STATUS_ATUALIZADO,
        payload={
            "pedido_id": pedido_id,
            "numero": numero,
            "status_anterior": status_anterior,
            "status_novo": status_novo,
            "usuario_id": usuario_id,
        },
        correlation_id=correlation_id
    )
    await client.publish(event)


async def publish_pagamento_aprovado(pagamento_data: Dict[str, Any], correlation_id: str = None) -> None:
    """Publish pagamento.aprovado event."""
    client = await get_rabbitmq()
    event = Event(
        type=EventType.PAGAMENTO_APROVADO,
        payload=pagamento_data,
        correlation_id=correlation_id
    )
    await client.publish(event)


async def publish_notificacao_enviar(
    usuario_id: int,
    tipo: str,
    titulo: str,
    mensagem: str,
    dados: Dict[str, Any] = None,
    correlation_id: str = None
) -> None:
    """Publish notificacao.enviar event."""
    client = await get_rabbitmq()
    event = Event(
        type=EventType.NOTIFICACAO_ENVIAR,
        payload={
            "usuario_id": usuario_id,
            "tipo": tipo,
            "titulo": titulo,
            "mensagem": mensagem,
            "dados": dados or {}
        },
        correlation_id=correlation_id
    )
    await client.publish(event)


async def publish_notificacao_push_enviar(
    usuario_id: int,
    titulo: str,
    mensagem: str,
    dados: Dict[str, Any] = None,
    correlation_id: str = None
) -> None:
    """Publish notificacao.push_enviar event."""
    client = await get_rabbitmq()
    event = Event(
        type=EventType.NOTIFICACAO_PUSH_ENVIAR,
        payload={
            "usuario_id": usuario_id,
            "titulo": titulo,
            "mensagem": mensagem,
            "dados": dados or {}
        },
        correlation_id=correlation_id
    )
    await client.publish(event)