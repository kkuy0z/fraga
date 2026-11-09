"""
Shared Pydantic schemas for request/response validation across microservices.
"""
from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator
from typing import Optional, List, Literal, Any, Dict
from datetime import datetime
from decimal import Decimal
import enum


# =============================================
# ENUMS
# =============================================

class PerfilNome(str, enum.Enum):
    ADMINISTRADOR = "administrador"
    ATENDENTE = "atendente"
    COZINHA = "cozinha"
    ENTREGADOR = "entregador"
    CLIENTE = "cliente"


class StatusPedido(str, enum.Enum):
    NOVO = "novo"
    EM_PREPARO = "em_preparo"
    PRONTO = "pronto"
    SAIU_ENTREGA = "saiu_entrega"
    CONCLUIDO = "concluido"
    CANCELADO = "cancelado"


class FormaPagamento(str, enum.Enum):
    PIX = "pix"
    CARTAO = "cartao"
    DINHEIRO = "dinheiro"
    ONLINE = "online"


class StatusPagamento(str, enum.Enum):
    PENDENTE = "pendente"
    APROVADO = "aprovado"
    RECUSADO = "recusado"
    CANCELADO = "cancelado"
    ESTORNADO = "estornado"
    AGUARDANDO = "aguardando"


class StatusEntrega(str, enum.Enum):
    PENDENTE = "pendente"
    ATRIBUIDA = "atribuida"
    RETIRADA = "retirada"
    EM_ROTA = "em_rota"
    ENTREGUE = "entregue"
    FALHOU = "falhou"


class TipoOpcaoPersonalizacao(str, enum.Enum):
    ADICIONAL = "adicional"
    REMOCAO = "remocao"
    ESCOLHA_UNICA = "escolha_unica"
    ESCOLHA_MULTIPLA = "escolha_multipla"


class TipoNotificacao(str, enum.Enum):
    STATUS_PEDIDO = "status_pedido"
    PROMOCAO = "promocao"
    SISTEMA = "sistema"
    PAGAMENTO = "pagamento"
    ENTREGA = "entrega"


# =============================================
# BASE SCHEMAS
# =============================================

class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class TimestampMixin(BaseModel):
    created_at: datetime
    updated_at: Optional[datetime] = None


# =============================================
# AUTH SCHEMAS
# =============================================

class TokenData(BaseModel):
    sub: str  # user id
    email: str
    perfil: PerfilNome
    exp: int


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    usuario: "UsuarioResponse"


class LoginRequest(BaseModel):
    email: EmailStr
    senha: str = Field(..., min_length=6, max_length=128)


class RegisterRequest(BaseModel):
    nome: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    telefone: Optional[str] = Field(None, pattern=r"^\+?[\d\s\-\(\)]{10,20}$")
    senha: str = Field(..., min_length=6, max_length=128)
    perfil: PerfilNome = PerfilNome.CLIENTE


class RefreshTokenRequest(BaseModel):
    refresh_token: str


# =============================================
# USER SCHEMAS
# =============================================

class UsuarioBase(BaseSchema):
    nome: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    telefone: Optional[str] = Field(None, pattern=r"^\+?[\d\s\-\(\)]{10,20}$")
    perfil_id: int
    ativo: bool = True


class UsuarioCreate(UsuarioBase):
    senha: str = Field(..., min_length=6, max_length=128)


class UsuarioUpdate(BaseSchema):
    nome: Optional[str] = Field(None, min_length=2, max_length=100)
    telefone: Optional[str] = Field(None, pattern=r"^\+?[\d\s\-\(\)]{10,20}$")
    perfil_id: Optional[int] = None
    ativo: Optional[bool] = None


class UsuarioResponse(UsuarioBase, TimestampMixin):
    id: int
    ultimo_login: Optional[datetime] = None
    perfil: Optional["PerfilResponse"] = None


class PerfilResponse(BaseSchema):
    id: int
    nome: PerfilNome
    descricao: Optional[str] = None


class EnderecoBase(BaseSchema):
    cep: str = Field(..., pattern=r"^\d{5}-?\d{3}$")
    logradouro: str = Field(..., max_length=200)
    numero: str = Field(..., max_length=20)
    complemento: Optional[str] = Field(None, max_length=100)
    bairro: str = Field(..., max_length=100)
    cidade: str = Field(default="Sua Cidade", max_length=100)
    estado: str = Field(default="SP", max_length=2)
    referencia: Optional[str] = Field(None, max_length=255)
    principal: bool = False


class EnderecoCreate(EnderecoBase):
    pass


class EnderecoUpdate(BaseSchema):
    cep: Optional[str] = Field(None, pattern=r"^\d{5}-?\d{3}$")
    logradouro: Optional[str] = Field(None, max_length=200)
    numero: Optional[str] = Field(None, max_length=20)
    complemento: Optional[str] = Field(None, max_length=100)
    bairro: Optional[str] = Field(None, max_length=100)
    cidade: Optional[str] = Field(None, max_length=100)
    estado: Optional[str] = Field(None, max_length=2)
    referencia: Optional[str] = Field(None, max_length=255)
    principal: Optional[bool] = None


class EnderecoResponse(EnderecoBase, TimestampMixin):
    id: int
    usuario_id: int


# =============================================
# CATALOG SCHEMAS
# =============================================

class CategoriaBase(BaseSchema):
    nome: str = Field(..., max_length=100)
    descricao: Optional[str] = None
    imagem_url: Optional[str] = Field(None, max_length=500)
    ordem: int = 0
    ativo: bool = True


class CategoriaCreate(CategoriaBase):
    pass


class CategoriaUpdate(BaseSchema):
    nome: Optional[str] = Field(None, max_length=100)
    descricao: Optional[str] = None
    imagem_url: Optional[str] = Field(None, max_length=500)
    ordem: Optional[int] = None
    ativo: Optional[bool] = None


class CategoriaResponse(CategoriaBase, TimestampMixin):
    id: int


class ItemOpcaoBase(BaseSchema):
    nome: str = Field(..., max_length=100)
    preco_adicional: Decimal = Field(default=Decimal("0.00"), ge=0)
    ativo: bool = True
    ordem: int = 0


class ItemOpcaoCreate(ItemOpcaoBase):
    pass


class ItemOpcaoUpdate(BaseSchema):
    nome: Optional[str] = Field(None, max_length=100)
    preco_adicional: Optional[Decimal] = Field(None, ge=0)
    ativo: Optional[bool] = None
    ordem: Optional[int] = None


class ItemOpcaoResponse(ItemOpcaoBase, TimestampMixin):
    id: int
    opcao_id: int


class OpcaoPersonalizacaoBase(BaseSchema):
    nome: str = Field(..., max_length=100)
    tipo: TipoOpcaoPersonalizacao
    obrigatorio: bool = False
    min_selecoes: int = Field(default=0, ge=0)
    max_selecoes: Optional[int] = Field(None, ge=1)
    ordem: int = 0


class OpcaoPersonalizacaoCreate(OpcaoPersonalizacaoBase):
    itens: List[ItemOpcaoCreate] = []


class OpcaoPersonalizacaoUpdate(BaseSchema):
    nome: Optional[str] = Field(None, max_length=100)
    tipo: Optional[TipoOpcaoPersonalizacao] = None
    obrigatorio: Optional[bool] = None
    min_selecoes: Optional[int] = Field(None, ge=0)
    max_selecoes: Optional[int] = Field(None, ge=1)
    ordem: Optional[int] = None


class OpcaoPersonalizacaoResponse(OpcaoPersonalizacaoBase, TimestampMixin):
    id: int
    produto_id: int
    itens: List[ItemOpcaoResponse] = []


class ProdutoBase(BaseSchema):
    categoria_id: int
    nome: str = Field(..., max_length=150)
    descricao: Optional[str] = None
    imagem_url: Optional[str] = Field(None, max_length=500)
    preco: Decimal = Field(..., gt=0, decimal_places=2)
    disponivel: bool = True
    destaque: bool = False
    ordem: int = 0
    tempo_preparo_min: Optional[int] = Field(None, ge=0)


class ProdutoCreate(ProdutoBase):
    opcoes: List[OpcaoPersonalizacaoCreate] = []


class ProdutoUpdate(BaseSchema):
    categoria_id: Optional[int] = None
    nome: Optional[str] = Field(None, max_length=150)
    descricao: Optional[str] = None
    imagem_url: Optional[str] = Field(None, max_length=500)
    preco: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    disponivel: Optional[bool] = None
    destaque: Optional[bool] = None
    ordem: Optional[int] = None
    tempo_preparo_min: Optional[int] = Field(None, ge=0)


class ProdutoResponse(ProdutoBase, TimestampMixin):
    id: int
    categoria: Optional[CategoriaResponse] = None
    opcoes: List[OpcaoPersonalizacaoResponse] = []


class ProdutoListResponse(BaseSchema):
    id: int
    categoria_id: int
    nome: str
    descricao: Optional[str] = None
    imagem_url: Optional[str] = None
    preco: Decimal
    disponivel: bool
    destaque: bool
    tempo_preparo_min: Optional[int] = None


class HorarioFuncionamentoBase(BaseSchema):
    dia_semana: int = Field(..., ge=0, le=6)
    abre_as: str = Field(..., pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$")
    fecha_as: str = Field(..., pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$")
    ativo: bool = True


class HorarioFuncionamentoUpdate(BaseSchema):
    abre_as: Optional[str] = Field(None, pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$")
    fecha_as: Optional[str] = Field(None, pattern=r"^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$")
    ativo: Optional[bool] = None


class HorarioFuncionamentoResponse(HorarioFuncionamentoBase, TimestampMixin):
    id: int


class ConfiguracaoBase(BaseSchema):
    chave: str = Field(..., max_length=100)
    valor: str
    descricao: Optional[str] = None
    tipo: Literal["string", "integer", "decimal", "boolean", "json"] = "string"


class ConfiguracaoUpdate(BaseSchema):
    valor: Optional[str] = None
    descricao: Optional[str] = None


class ConfiguracaoResponse(ConfiguracaoBase, TimestampMixin):
    id: int


class TaxaEntregaBase(BaseSchema):
    nome: str = Field(..., max_length=100)
    bairros: List[str]
    valor: Decimal = Field(..., ge=0, decimal_places=2)
    tempo_estimado_min: Optional[int] = Field(None, ge=0)
    ativo: bool = True


class TaxaEntregaCreate(TaxaEntregaBase):
    pass


class TaxaEntregaUpdate(BaseSchema):
    nome: Optional[str] = Field(None, max_length=100)
    bairros: Optional[List[str]] = None
    valor: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    tempo_estimado_min: Optional[int] = Field(None, ge=0)
    ativo: Optional[bool] = None


class TaxaEntregaResponse(TaxaEntregaBase, TimestampMixin):
    id: int


# =============================================
# PEDIDOS SCHEMAS
# =============================================

class ItemPedidoPersonalizacao(BaseSchema):
    opcao_id: int
    item_ids: List[int]


class ItemPedidoCreate(BaseSchema):
    produto_id: int
    quantidade: int = Field(default=1, ge=1)
    personalizacoes: List[ItemPedidoPersonalizacao] = []
    observacoes: Optional[str] = None


class ItemPedidoResponse(BaseSchema):
    id: int
    produto_id: int
    produto_nome: str
    quantidade: int
    preco_unitario: Decimal
    personalizacoes: List[Dict[str, Any]]
    observacoes: Optional[str]
    subtotal: Decimal


class PedidoCreate(BaseSchema):
    endereco_id: Optional[int] = None
    itens: List[ItemPedidoCreate] = Field(..., min_length=1)
    forma_pagamento: FormaPagamento
    troco_para: Optional[Decimal] = Field(None, ge=0)
    observacoes: Optional[str] = None
    horario_entrega: Optional[datetime] = None


class PedidoUpdateStatus(BaseSchema):
    status: StatusPedido
    observacao: Optional[str] = None


class PedidoResponse(BaseSchema):
    id: int
    numero: str
    cliente_id: int
    cliente_nome: Optional[str] = None
    endereco_id: Optional[int] = None
    status: StatusPedido
    subtotal: Decimal
    taxa_entrega: Decimal
    desconto: Decimal
    total: Decimal
    forma_pagamento: FormaPagamento
    troco_para: Optional[Decimal] = None
    observacoes: Optional[str] = None
    horario_entrega: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    confirmado_at: Optional[datetime] = None
    concluido_at: Optional[datetime] = None
    cancelado_at: Optional[datetime] = None
    motivo_cancelamento: Optional[str] = None
    itens: List[ItemPedidoResponse] = []
    endereco: Optional[EnderecoResponse] = None
    entrega: Optional["EntregaResponse"] = None
    pagamentos: List["PagamentoResponse"] = []
    avaliacao: Optional["AvaliacaoResponse"] = None


class HistoricoStatusResponse(BaseSchema):
    id: int
    pedido_id: int
    status_anterior: Optional[StatusPedido] = None
    status_novo: StatusPedido
    usuario_id: Optional[int] = None
    usuario_nome: Optional[str] = None
    observacao: Optional[str] = None
    created_at: datetime


class PedidoListResponse(BaseSchema):
    id: int
    numero: str
    cliente_nome: str
    status: StatusPedido
    total: Decimal
    forma_pagamento: FormaPagamento
    created_at: datetime
    itens_count: int


# =============================================
# ENTREGA SCHEMAS
# =============================================

class EntregaCreate(BaseSchema):
    pedido_id: int
    entregador_id: Optional[int] = None


class EntregaUpdate(BaseSchema):
    entregador_id: Optional[int] = None
    status: Optional[StatusEntrega] = None
    observacoes: Optional[str] = None
    comprovante_url: Optional[str] = Field(None, max_length=500)


class EntregaResponse(BaseSchema):
    id: int
    pedido_id: int
    entregador_id: Optional[int] = None
    entregador_nome: Optional[str] = None
    status: StatusEntrega
    saida_em: Optional[datetime] = None
    entregue_em: Optional[datetime] = None
    observacoes: Optional[str] = None
    comprovante_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# =============================================
# PAGAMENTO SCHEMAS
# =============================================

class PagamentoCreate(BaseSchema):
    pedido_id: int
    gateway: str
    forma: Literal["pix", "cartao_credito", "cartao_debito", "dinheiro", "boleto"]
    valor: Decimal = Field(..., gt=0, decimal_places=2)


class PagamentoWebhook(BaseSchema):
    gateway_transaction_id: str
    status: StatusPagamento
    dados: Dict[str, Any]


class PagamentoResponse(BaseSchema):
    id: int
    pedido_id: int
    gateway: str
    gateway_transaction_id: Optional[str] = None
    forma: str
    valor: Decimal
    status: StatusPagamento
    dados_gateway: Optional[Dict[str, Any]] = None
    pago_em: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


# =============================================
# AVALIAÇÃO SCHEMAS
# =============================================

class AvaliacaoCreate(BaseSchema):
    pedido_id: int
    nota: int = Field(..., ge=1, le=5)
    comentario: Optional[str] = None


class AvaliacaoUpdate(BaseSchema):
    nota: Optional[int] = Field(None, ge=1, le=5)
    comentario: Optional[str] = None


class AvaliacaoAdminUpdate(BaseSchema):
    respondida: Optional[bool] = None
    resposta_admin: Optional[str] = None


class AvaliacaoResponse(BaseSchema):
    id: int
    pedido_id: int
    cliente_id: int
    cliente_nome: Optional[str] = None
    nota: int
    comentario: Optional[str] = None
    respondida: bool
    resposta_admin: Optional[str] = None
    respondida_em: Optional[datetime] = None
    respondida_por: Optional[int] = None
    created_at: datetime
    updated_at: datetime


# =============================================
# NOTIFICAÇÃO SCHEMAS
# =============================================

class NotificacaoCreate(BaseSchema):
    usuario_id: int
    tipo: TipoNotificacao
    titulo: str = Field(..., max_length=150)
    mensagem: str
    dados: Optional[Dict[str, Any]] = None


class NotificacaoResponse(BaseSchema):
    id: int
    usuario_id: int
    tipo: TipoNotificacao
    titulo: str
    mensagem: str
    dados: Optional[Dict[str, Any]] = None
    lida: bool
    enviada_push: bool
    created_at: datetime


class PushSubscriptionCreate(BaseSchema):
    endpoint: str
    p256dh: str
    auth: str
    user_agent: Optional[str] = None


class PushSubscriptionResponse(BaseSchema):
    id: int
    usuario_id: int
    endpoint: str
    ativo: bool
    created_at: datetime


# =============================================
# RELATÓRIOS SCHEMAS
# =============================================

class RelatorioPeriodo(BaseSchema):
    data_inicio: datetime
    data_fim: datetime


class RelatorioVendasResponse(BaseSchema):
    periodo: RelatorioPeriodo
    total_pedidos: int
    total_vendas: Decimal
    ticket_medio: Decimal
    pedidos_por_status: Dict[str, int]
    vendas_por_dia: List[Dict[str, Any]]
    vendas_por_hora: List[Dict[str, Any]]


class RelatorioProdutosResponse(BaseSchema):
    periodo: RelatorioPeriodo
    produtos_mais_vendidos: List[Dict[str, Any]]
    categorias_mais_vendidas: List[Dict[str, Any]]


class RelatorioEntregasResponse(BaseSchema):
    periodo: RelatorioPeriodo
    total_entregas: int
    tempo_medio_entrega: Optional[float] = None
    entregas_por_entregador: List[Dict[str, Any]]
    entregas_por_status: Dict[str, int]


# =============================================
# WEBSOCKET SCHEMAS
# =============================================

class WSMessage(BaseModel):
    type: str
    payload: Dict[str, Any]


class WSPedidoStatusUpdate(BaseModel):
    pedido_id: int
    numero: str
    status: StatusPedido
    updated_at: datetime
    usuario_nome: Optional[str] = None


class WSNovoPedido(BaseModel):
    pedido: PedidoListResponse
    timestamp: datetime


# =============================================
# HEALTH CHECK
# =============================================

class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    timestamp: datetime
    database: str
    rabbitmq: str


# =============================================
# PAGINATION
# =============================================

class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1)
    size: int = Field(default=20, ge=1, le=100)


class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    size: int
    pages: int

    @classmethod
    def create(cls, items: List[Any], total: int, page: int, size: int):
        return cls(
            items=items,
            total=total,
            page=page,
            size=size,
            pages=(total + size - 1) // size
        )


# =============================================
# ERROR RESPONSES
# =============================================

class ErrorDetail(BaseModel):
    field: Optional[str] = None
    message: str
    code: str


class ErrorResponse(BaseModel):
    error: str
    message: str
    details: List[ErrorDetail] = []
    timestamp: datetime = Field(default_factory=datetime.now)


# Forward references resolution
UsuarioResponse.model_rebuild()
PedidoResponse.model_rebuild()
EntregaResponse.model_rebuild()
PagamentoResponse.model_rebuild()
AvaliacaoResponse.model_rebuild()