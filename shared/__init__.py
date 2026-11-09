"""
Shared modules for Fraga Lanches microservices.
"""
from shared.database import Base, engine, async_session_maker, get_db, init_db, close_db
from shared.models import *
from shared.schemas import *
from shared.auth import *
from shared.messaging import *
from shared.websocket import *

__all__ = [
    # Database
    "Base", "engine", "async_session_maker", "get_db", "init_db", "close_db",
    # Models
    "Perfil", "Usuario", "Endereco", "Categoria", "Produto", "OpcaoPersonalizacao",
    "ItemOpcao", "HorarioFuncionamento", "Configuracao", "TaxaEntrega",
    "Pedido", "ItemPedido", "HistoricoStatusPedido", "Entrega", "Pagamento",
    "Avaliacao", "Notificacao", "PushSubscription",
    # Enums
    "PerfilNome", "StatusPedido", "FormaPagamento", "StatusPagamento",
    "StatusEntrega", "TipoOpcaoPersonalizacao", "TipoNotificacao",
    # Schemas
    "TokenData", "TokenResponse", "LoginRequest", "RegisterRequest",
    "UsuarioResponse", "UsuarioCreate", "UsuarioUpdate", "PerfilResponse",
    "EnderecoResponse", "EnderecoCreate", "EnderecoUpdate",
    "CategoriaResponse", "CategoriaCreate", "CategoriaUpdate",
    "ProdutoResponse", "ProdutoCreate", "ProdutoUpdate", "ProdutoListResponse",
    "OpcaoPersonalizacaoResponse", "OpcaoPersonalizacaoCreate", "OpcaoPersonalizacaoUpdate",
    "ItemOpcaoResponse", "ItemOpcaoCreate", "ItemOpcaoUpdate",
    "HorarioFuncionamentoResponse", "HorarioFuncionamentoUpdate",
    "ConfiguracaoResponse", "ConfiguracaoUpdate",
    "TaxaEntregaResponse", "TaxaEntregaCreate", "TaxaEntregaUpdate",
    "PedidoResponse", "PedidoCreate", "PedidoUpdateStatus", "PedidoListResponse",
    "ItemPedidoResponse", "ItemPedidoCreate",
    "HistoricoStatusResponse",
    "EntregaResponse", "EntregaCreate", "EntregaUpdate",
    "PagamentoResponse", "PagamentoCreate", "PagamentoWebhook",
    "AvaliacaoResponse", "AvaliacaoCreate", "AvaliacaoUpdate", "AvaliacaoAdminUpdate",
    "NotificacaoResponse", "NotificacaoCreate",
    "PushSubscriptionResponse", "PushSubscriptionCreate",
    "RelatorioVendasResponse", "RelatorioProdutosResponse", "RelatorioEntregasResponse",
    "WSMessage", "WSPedidoStatusUpdate", "WSNovoPedido",
    "HealthResponse", "PaginationParams", "PaginatedResponse",
    "ErrorResponse", "ErrorDetail",
    # Auth
    "hash_password", "verify_password", "create_access_token", "create_refresh_token",
    "decode_token", "decode_refresh_token", "create_token_pair", "verify_token_permissions",
    "PERFIS_ADMIN", "PERFIS_ATENDIMENTO", "PERFIS_COZINHA", "PERFIS_ENTREGADOR",
    "PERFIS_INTERNOS", "PERFIS_TODOS",
    # Messaging
    "RabbitMQClient", "Event", "EventType", "get_rabbitmq", "close_rabbitmq",
    "publish_pedido_criado", "publish_pedido_status_atualizado",
    "publish_pagamento_aprovado", "publish_notificacao_enviar",
    "publish_notificacao_push_enviar",
    # WebSocket
    "ws_manager", "handle_websocket", "start_rabbitmq_consumer", "stop_rabbitmq_consumer",
]