"""
Shared SQLAlchemy models for all microservices.
"""
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, Enum, ForeignKey,
    DECIMAL, JSON, TIMESTAMP, CheckConstraint, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.sql import func
import enum

Base = declarative_base()


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
# MODELS
# =============================================

class Perfil(Base):
    __tablename__ = "perfis"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nome = Column(String(50), unique=True, nullable=False)
    descricao = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    usuarios = relationship("Usuario", back_populates="perfil")


class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, autoincrement=True)
    perfil_id = Column(Integer, ForeignKey("perfis.id", ondelete="RESTRICT"), nullable=False)
    nome = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False)
    telefone = Column(String(20), nullable=True)
    senha_hash = Column(String(255), nullable=False)
    ativo = Column(Boolean, default=True, nullable=False)
    ultimo_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    perfil = relationship("Perfil", back_populates="usuarios")
    enderecos = relationship("Endereco", back_populates="usuario", cascade="all, delete-orphan")
    pedidos = relationship("Pedido", back_populates="cliente", foreign_keys="Pedido.cliente_id")
    entregas = relationship("Entrega", back_populates="entregador")
    avaliacoes = relationship("Avaliacao", back_populates="cliente")
    notificacoes = relationship("Notificacao", back_populates="usuario")
    push_subscriptions = relationship("PushSubscription", back_populates="usuario", cascade="all, delete-orphan")


class Endereco(Base):
    __tablename__ = "enderecos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    cep = Column(String(9), nullable=False)
    logradouro = Column(String(200), nullable=False)
    numero = Column(String(20), nullable=False)
    complemento = Column(String(100), nullable=True)
    bairro = Column(String(100), nullable=False)
    cidade = Column(String(100), default="Sua Cidade", nullable=False)
    estado = Column(String(2), default="SP", nullable=False)
    referencia = Column(String(255), nullable=True)
    principal = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    usuario = relationship("Usuario", back_populates="enderecos")


class Categoria(Base):
    __tablename__ = "categorias"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nome = Column(String(100), unique=True, nullable=False)
    descricao = Column(Text, nullable=True)
    imagem_url = Column(String(500), nullable=True)
    ordem = Column(Integer, default=0, nullable=False)
    ativo = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    produtos = relationship("Produto", back_populates="categoria")


class Produto(Base):
    __tablename__ = "produtos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    categoria_id = Column(Integer, ForeignKey("categorias.id", ondelete="RESTRICT"), nullable=False)
    nome = Column(String(150), nullable=False)
    descricao = Column(Text, nullable=True)
    imagem_url = Column(String(500), nullable=True)
    preco = Column(DECIMAL(10, 2), nullable=False)
    disponivel = Column(Boolean, default=True, nullable=False)
    destaque = Column(Boolean, default=False, nullable=False)
    ordem = Column(Integer, default=0, nullable=False)
    tempo_preparo_min = Column(Integer, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    categoria = relationship("Categoria", back_populates="produtos")
    opcoes = relationship("OpcaoPersonalizacao", back_populates="produto", cascade="all, delete-orphan")
    itens_pedido = relationship("ItemPedido", back_populates="produto")


class OpcaoPersonalizacao(Base):
    __tablename__ = "opcoes_personalizacao"

    id = Column(Integer, primary_key=True, autoincrement=True)
    produto_id = Column(Integer, ForeignKey("produtos.id", ondelete="CASCADE"), nullable=False)
    nome = Column(String(100), nullable=False)
    tipo = Column(Enum(TipoOpcaoPersonalizacao), nullable=False)
    obrigatorio = Column(Boolean, default=False, nullable=False)
    min_selecoes = Column(Integer, default=0, nullable=False)
    max_selecoes = Column(Integer, nullable=True)
    ordem = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    produto = relationship("Produto", back_populates="opcoes")
    itens = relationship("ItemOpcao", back_populates="opcao", cascade="all, delete-orphan")


class ItemOpcao(Base):
    __tablename__ = "itens_opcao"

    id = Column(Integer, primary_key=True, autoincrement=True)
    opcao_id = Column(Integer, ForeignKey("opcoes_personalizacao.id", ondelete="CASCADE"), nullable=False)
    nome = Column(String(100), nullable=False)
    preco_adicional = Column(DECIMAL(10, 2), default=0.00, nullable=False)
    ativo = Column(Boolean, default=True, nullable=False)
    ordem = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    opcao = relationship("OpcaoPersonalizacao", back_populates="itens")


class HorarioFuncionamento(Base):
    __tablename__ = "horarios_funcionamento"

    id = Column(Integer, primary_key=True, autoincrement=True)
    dia_semana = Column(Integer, unique=True, nullable=False)  # 0=Domingo...6=Sábado
    abre_as = Column(String(8), nullable=False)  # TIME as string
    fecha_as = Column(String(8), nullable=False)
    ativo = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Configuracao(Base):
    __tablename__ = "configuracoes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    chave = Column(String(100), unique=True, nullable=False)
    valor = Column(Text, nullable=False)
    descricao = Column(String(255), nullable=True)
    tipo = Column(Enum("string", "integer", "decimal", "boolean", "json", name="config_tipo"), default="string", nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class TaxaEntrega(Base):
    __tablename__ = "taxas_entrega"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nome = Column(String(100), nullable=False)
    bairros = Column(JSON, nullable=False)
    valor = Column(DECIMAL(10, 2), nullable=False)
    tempo_estimado_min = Column(Integer, nullable=True)
    ativo = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Pedido(Base):
    __tablename__ = "pedidos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    numero = Column(String(20), unique=True, nullable=False)
    cliente_id = Column(Integer, ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=False)
    endereco_id = Column(Integer, ForeignKey("enderecos.id", ondelete="SET NULL"), nullable=True)
    status = Column(Enum(StatusPedido), default=StatusPedido.NOVO, nullable=False)
    subtotal = Column(DECIMAL(10, 2), nullable=False)
    taxa_entrega = Column(DECIMAL(10, 2), default=0.00, nullable=False)
    desconto = Column(DECIMAL(10, 2), default=0.00, nullable=False)
    total = Column(DECIMAL(10, 2), nullable=False)
    forma_pagamento = Column(Enum(FormaPagamento), nullable=False)
    troco_para = Column(DECIMAL(10, 2), nullable=True)
    observacoes = Column(Text, nullable=True)
    horario_entrega = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    confirmado_at = Column(DateTime, nullable=True)
    concluido_at = Column(DateTime, nullable=True)
    cancelado_at = Column(DateTime, nullable=True)
    motivo_cancelamento = Column(String(255), nullable=True)

    cliente = relationship("Usuario", back_populates="pedidos", foreign_keys=[cliente_id])
    endereco = relationship("Endereco")
    itens = relationship("ItemPedido", back_populates="pedido", cascade="all, delete-orphan")
    historico_status = relationship("HistoricoStatusPedido", back_populates="pedido", cascade="all, delete-orphan")
    entrega = relationship("Entrega", back_populates="pedido", uselist=False, cascade="all, delete-orphan")
    pagamentos = relationship("Pagamento", back_populates="pedido", cascade="all, delete-orphan")
    avaliacao = relationship("Avaliacao", back_populates="pedido", uselist=False, cascade="all, delete-orphan")


class ItemPedido(Base):
    __tablename__ = "itens_pedido"

    id = Column(Integer, primary_key=True, autoincrement=True)
    pedido_id = Column(Integer, ForeignKey("pedidos.id", ondelete="CASCADE"), nullable=False)
    produto_id = Column(Integer, ForeignKey("produtos.id", ondelete="RESTRICT"), nullable=False)
    quantidade = Column(Integer, default=1, nullable=False)
    preco_unitario = Column(DECIMAL(10, 2), nullable=False)
    personalizacoes = Column(JSON, nullable=False)
    observacoes = Column(Text, nullable=True)
    subtotal = Column(DECIMAL(10, 2), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    pedido = relationship("Pedido", back_populates="itens")
    produto = relationship("Produto", back_populates="itens_pedido")


class HistoricoStatusPedido(Base):
    __tablename__ = "historico_status_pedido"

    id = Column(Integer, primary_key=True, autoincrement=True)
    pedido_id = Column(Integer, ForeignKey("pedidos.id", ondelete="CASCADE"), nullable=False)
    status_anterior = Column(Enum(StatusPedido), nullable=True)
    status_novo = Column(Enum(StatusPedido), nullable=False)
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    observacao = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    pedido = relationship("Pedido", back_populates="historico_status")
    usuario = relationship("Usuario")


class Entrega(Base):
    __tablename__ = "entregas"

    id = Column(Integer, primary_key=True, autoincrement=True)
    pedido_id = Column(Integer, ForeignKey("pedidos.id", ondelete="CASCADE"), unique=True, nullable=False)
    entregador_id = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    status = Column(Enum(StatusEntrega), default=StatusEntrega.PENDENTE, nullable=False)
    saida_em = Column(DateTime, nullable=True)
    entregue_em = Column(DateTime, nullable=True)
    observacoes = Column(Text, nullable=True)
    comprovante_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    pedido = relationship("Pedido", back_populates="entrega")
    entregador = relationship("Usuario", back_populates="entregas")


class Pagamento(Base):
    __tablename__ = "pagamentos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    pedido_id = Column(Integer, ForeignKey("pedidos.id", ondelete="CASCADE"), nullable=False)
    gateway = Column(String(50), nullable=False)
    gateway_transaction_id = Column(String(100), nullable=True)
    forma = Column(Enum("pix", "cartao_credito", "cartao_debito", "dinheiro", "boleto", name="pagamento_forma"), nullable=False)
    valor = Column(DECIMAL(10, 2), nullable=False)
    status = Column(Enum(StatusPagamento), default=StatusPagamento.PENDENTE, nullable=False)
    dados_gateway = Column(JSON, nullable=True)
    pago_em = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    pedido = relationship("Pedido", back_populates="pagamentos")


class Avaliacao(Base):
    __tablename__ = "avaliacoes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    pedido_id = Column(Integer, ForeignKey("pedidos.id", ondelete="CASCADE"), unique=True, nullable=False)
    cliente_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    nota = Column(Integer, nullable=False)
    comentario = Column(Text, nullable=True)
    respondida = Column(Boolean, default=False, nullable=False)
    resposta_admin = Column(Text, nullable=True)
    respondida_em = Column(DateTime, nullable=True)
    respondida_por = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("nota BETWEEN 1 AND 5", name="ck_avaliacoes_nota"),
    )

    pedido = relationship("Pedido", back_populates="avaliacao")
    cliente = relationship("Usuario", back_populates="avaliacoes", foreign_keys=[cliente_id])
    responsavel = relationship("Usuario", foreign_keys=[respondida_por])


class Notificacao(Base):
    __tablename__ = "notificacoes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    tipo = Column(Enum(TipoNotificacao), nullable=False)
    titulo = Column(String(150), nullable=False)
    mensagem = Column(Text, nullable=False)
    dados = Column(JSON, nullable=True)
    lida = Column(Boolean, default=False, nullable=False)
    enviada_push = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    usuario = relationship("Usuario", back_populates="notificacoes")


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    endpoint = Column(Text, nullable=False)
    p256dh = Column(String(100), nullable=False)
    auth = Column(String(50), nullable=False)
    user_agent = Column(String(500), nullable=True)
    ativo = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("usuario_id", "endpoint", name="uk_push_subscription"),
    )

    usuario = relationship("Usuario", back_populates="push_subscriptions")