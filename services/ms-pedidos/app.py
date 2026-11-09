"""
Pedidos Microservice - Cart, Orders, Order History
"""
import os
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import FastAPI, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, update
from sqlalchemy.orm import selectinload

from services.ms_auth.main import create_app
from shared.database import get_db
from shared.models import (
    Pedido, ItemPedido, HistoricoStatusPedido, Usuario, Endereco,
    Produto, TaxaEntrega, Configuracao
)
from shared.schemas import (
    PedidoResponse, PedidoCreate, PedidoUpdateStatus, PedidoListResponse,
    ItemPedidoResponse, ItemPedidoCreate,
    HistoricoStatusResponse,
    PaginationParams, PaginatedResponse
)
from shared.auth import (
    get_current_user, require_perfis, verify_token_permissions,
    PerfilNome
)
from shared.messaging import (
    publish_pedido_criado, publish_pedido_status_atualizado,
    publish_notificacao_enviar, EventType, get_rabbitmq
)
from shared.websocket import ws_manager

app = create_app("ms-pedidos", "1.0.0")


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


async def require_admin_or_atendente(user: "Usuario" = Depends(get_current_user_dep)):
    from shared.auth import PerfilNome
    if user.perfil.nome not in [PerfilNome.ADMINISTRADOR.value, PerfilNome.ATENDENTE.value]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return user


# =============================================
# HELPER FUNCTIONS
# =============================================

async def generate_pedido_numero(db: AsyncSession) -> str:
    """Generate unique order number."""
    year = datetime.now().year
    count = await db.scalar(
        select(func.count(Pedido.id)).where(Pedido.numero.like(f"PD-{year}-%"))
    )
    return f"PD-{year}-{count + 1:06d}"


async def calculate_taxa_entrega(db: AsyncSession, bairro: str) -> float:
    """Calculate delivery fee for neighborhood."""
    result = await db.execute(select(TaxaEntrega).where(TaxaEntrega.ativo == True))
    taxas = result.scalars().all()

    for taxa in taxas:
        if bairro.upper() in [b.upper() for b in taxa.bairros]:
            return float(taxa.valor)

    # Default
    config = await db.execute(select(Configuracao).where(Configuracao.chave == "taxa_entrega_padrao"))
    cfg = config.scalar_one_or_none()
    return float(cfg.valor) if cfg else 5.00


async def validate_and_calculate_order(db: AsyncSession, pedido_data: PedidoCreate, cliente_id: int) -> dict:
    """Validate order items and calculate totals."""
    subtotal = 0.0
    itens_validados = []

    for item_data in pedido_data.itens:
        # Get product with options
        result = await db.execute(
            select(Produto)
            .options(selectinload(Produto.opcoes).selectinload(OpcaoPersonalizacao.itens))
            .where(Produto.id == item_data.produto_id)
        )
        produto = result.scalar_one_or_none()
        if not produto:
            raise HTTPException(status_code=400, detail=f"Product {item_data.produto_id} not found")
        if not produto.disponivel:
            raise HTTPException(status_code=400, detail=f"Product {produto.nome} is not available")

        # Calculate item price with personalizations
        preco_item = float(produto.preco)
        personalizacoes_calculadas = []

        for pers in item_data.personalizacoes:
            opcao = next((o for o in produto.opcoes if o.id == pers.opcao_id), None)
            if not opcao:
                raise HTTPException(status_code=400, detail=f"Option {pers.opcao_id} not found for product")

            # Validate selection rules
            if opcao.obrigatorio and len(pers.item_ids) < opcao.min_selecoes:
                raise HTTPException(status_code=400, detail=f"Option {opcao.nome} requires at least {opcao.min_selecoes} selections")

            if opcao.max_selecoes and len(pers.item_ids) > opcao.max_selecoes:
                raise HTTPException(status_code=400, detail=f"Option {opcao.nome} allows maximum {opcao.max_selecoes} selections")

            # Calculate additional price
            for item_id in pers.item_ids:
                item_opcao = next((i for i in opcao.itens if i.id == item_id and i.ativo), None)
                if not item_opcao:
                    raise HTTPException(status_code=400, detail=f"Option item {item_id} not found or inactive")
                preco_item += float(item_opcao.preco_adicional)
                personalizacoes_calculadas.append({
                    "opcao_id": opcao.id,
                    "opcao_nome": opcao.nome,
                    "item_id": item_opcao.id,
                    "item_nome": item_opcao.nome,
                    "preco_adicional": float(item_opcao.preco_adicional)
                })

        item_subtotal = preco_item * item_data.quantidade
        subtotal += item_subtotal

        itens_validados.append({
            "produto_id": produto.id,
            "produto_nome": produto.nome,
            "quantidade": item_data.quantidade,
            "preco_unitario": preco_item,
            "personalizacoes": personalizacoes_calculadas,
            "observacoes": item_data.observacoes,
            "subtotal": item_subtotal
        })

    # Calculate delivery fee
    taxa_entrega = 0.0
    if pedido_data.endereco_id:
        result = await db.execute(select(Endereco).where(Endereco.id == pedido_data.endereco_id))
        endereco = result.scalar_one_or_none()
        if endereco:
            taxa_entrega = await calculate_taxa_entrega(db, endereco.bairro)

    total = subtotal + taxa_entrega

    return {
        "subtotal": subtotal,
        "taxa_entrega": taxa_entrega,
        "total": total,
        "itens": itens_validados
    }


# =============================================
# PEDIDOS ENDPOINTS
# =============================================

@app.post("/pedidos", response_model=PedidoResponse, status_code=201, tags=["pedidos"])
async def create_pedido(
    pedido_data: PedidoCreate,
    current_user: "Usuario" = Depends(get_current_user_dep),
    db: AsyncSession = Depends(get_db)
):
    """Create new order."""
    from shared.models import OpcaoPersonalizacao

    # Validate and calculate
    calc = await validate_and_calculate_order(db, pedido_data, current_user.id)

    # Verify endereco belongs to user
    if pedido_data.endereco_id:
        result = await db.execute(
            select(Endereco).where(Endereco.id == pedido_data.endereco_id, Endereco.usuario_id == current_user.id)
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Invalid address")

    # Check if establishment is open
    from datetime import datetime
    now = datetime.now()
    dia_semana = (now.weekday() + 1) % 7
    hora_atual = now.time()

    from shared.models import HorarioFuncionamento
    result = await db.execute(
        select(HorarioFuncionamento).where(
            HorarioFuncionamento.dia_semana == dia_semana,
            HorarioFuncionamento.ativo == True
        )
    )
    horario = result.scalar_one_or_none()
    if horario:
        from datetime import time
        abre = time.fromisoformat(horario.abre_as)
        fecha = time.fromisoformat(horario.fecha_as)
        if abre <= fecha:
            aberto = abre <= hora_atual <= fecha
        else:
            aberto = hora_atual >= abre or hora_atual <= fecha
        if not aberto:
            raise HTTPException(status_code=400, detail="Establishment is closed")

    # Create order
    numero = await generate_pedido_numero(db)
    pedido = Pedido(
        numero=numero,
        cliente_id=current_user.id,
        endereco_id=pedido_data.endereco_id,
        status="novo",
        subtotal=calc["subtotal"],
        taxa_entrega=calc["taxa_entrega"],
        desconto=0.0,
        total=calc["total"],
        forma_pagamento=pedido_data.forma_pagamento.value,
        troco_para=pedido_data.troco_para,
        observacoes=pedido_data.observacoes,
        horario_entrega=pedido_data.horario_entrega,
        confirmado_at=datetime.now(timezone.utc)
    )
    db.add(pedido)
    await db.flush()

    # Create items
    for item_data in calc["itens"]:
        item = ItemPedido(
            pedido_id=pedido.id,
            produto_id=item_data["produto_id"],
            quantidade=item_data["quantidade"],
            preco_unitario=item_data["preco_unitario"],
            personalizacoes=item_data["personalizacoes"],
            observacoes=item_data["observacoes"],
            subtotal=item_data["subtotal"]
        )
        db.add(item)

    # Create status history
    historico = HistoricoStatusPedido(
        pedido_id=pedido.id,
        status_anterior=None,
        status_novo="novo",
        usuario_id=current_user.id,
        observacao="Pedido criado pelo cliente"
    )
    db.add(historico)

    await db.commit()
    await db.refresh(pedido, ["itens", "endereco", "cliente"])

    # Publish event
    await publish_pedido_criado({
        "pedido_id": pedido.id,
        "numero": pedido.numero,
        "cliente_id": current_user.id,
        "cliente_nome": current_user.nome,
        "total": float(pedido.total),
        "status": pedido.status,
        "created_at": pedido.created_at.isoformat()
    }, correlation_id=str(pedido.id))

    # Notify via WebSocket
    await ws_manager.broadcast_to_perfis({
        "type": "event",
        "event_type": "pedido.criado",
        "payload": {
            "pedido_id": pedido.id,
            "numero": pedido.numero,
            "cliente_nome": current_user.nome,
            "total": float(pedido.total),
            "itens_count": len(pedido.itens)
        },
        "timestamp": datetime.now(timezone.utc).isoformat() + "Z"
    }, ["cozinha", "atendente", "administrador"])

    return PedidoResponse.model_validate(pedido)


@app.get("/pedidos", response_model=PaginatedResponse, tags=["pedidos"])
async def list_pedidos(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    cliente_id: Optional[int] = None,
    data_inicio: Optional[datetime] = None,
    data_fim: Optional[datetime] = None,
    current_user: "Usuario" = Depends(get_current_user_dep),
    db: AsyncSession = Depends(get_db)
):
    """List orders with filters."""
    from shared.models import Pedido as PedidoModel

    query = select(PedidoModel).options(
        selectinload(PedidoModel.itens).selectinload(ItemPedido.produto),
        selectinload(PedidoModel.endereco),
        selectinload(PedidoModel.cliente)
    )

    # Clients can only see their own orders
    if current_user.perfil.nome == PerfilNome.CLIENTE.value:
        query = query.where(PedidoModel.cliente_id == current_user.id)
    elif cliente_id:
        query = query.where(PedidoModel.cliente_id == cliente_id)

    if status:
        query = query.where(PedidoModel.status == status)
    if data_inicio:
        query = query.where(PedidoModel.created_at >= data_inicio)
    if data_fim:
        query = query.where(PedidoModel.created_at <= data_fim)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)

    # Paginate
    query = query.order_by(PedidoModel.created_at.desc())
    query = query.offset((page - 1) * size).limit(size)

    result = await db.execute(query)
    pedidos = result.scalars().all()

    items = []
    for p in pedidos:
        items.append(PedidoListResponse(
            id=p.id,
            numero=p.numero,
            cliente_nome=p.cliente.nome,
            status=p.status,
            total=p.total,
            forma_pagamento=p.forma_pagamento,
            created_at=p.created_at,
            itens_count=len(p.itens)
        ))

    return PaginatedResponse.create(items, total, page, size)


@app.get("/pedidos/{pedido_id}", response_model=PedidoResponse, tags=["pedidos"])
async def get_pedido(
    pedido_id: int,
    current_user: "Usuario" = Depends(get_current_user_dep),
    db: AsyncSession = Depends(get_db)
):
    """Get order details."""
    result = await db.execute(
        select(Pedido)
        .options(
            selectinload(Pedido.itens).selectinload(ItemPedido.produto),
            selectinload(Pedido.endereco),
            selectinload(Pedido.cliente),
            selectinload(Pedido.entrega),
            selectinload(Pedido.pagamentos),
            selectinload(Pedido.avaliacao),
            selectinload(Pedido.historico_status)
        )
        .where(Pedido.id == pedido_id)
    )
    pedido = result.scalar_one_or_none()
    if not pedido:
        raise HTTPException(status_code=404, detail="Order not found")

    # Check permissions
    if (current_user.perfil.nome == PerfilNome.CLIENTE.value and
        pedido.cliente_id != current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")

    return PedidoResponse.model_validate(pedido)


@app.get("/pedidos/{pedido_id}/historico", response_model=List[HistoricoStatusResponse], tags=["pedidos"])
async def get_pedido_historico(
    pedido_id: int,
    current_user: "Usuario" = Depends(get_current_user_dep),
    db: AsyncSession = Depends(get_db)
):
    """Get order status history."""
    # Verify order exists and permissions
    result = await db.execute(select(Pedido).where(Pedido.id == pedido_id))
    pedido = result.scalar_one_or_none()
    if not pedido:
        raise HTTPException(status_code=404, detail="Order not found")

    if (current_user.perfil.nome == PerfilNome.CLIENTE.value and
        pedido.cliente_id != current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")

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


@app.put("/pedidos/{pedido_id}/status", response_model=PedidoResponse, tags=["pedidos"])
async def update_pedido_status(
    pedido_id: int,
    update_data: PedidoUpdateStatus,
    current_user: "Usuario" = Depends(require_admin_or_atendente),
    db: AsyncSession = Depends(get_db)
):
    """Update order status (admin/atendente only)."""
    from shared.models import StatusPedido

    # Validate status transition
    valid_transitions = {
        "novo": ["em_preparo", "cancelado"],
        "em_preparo": ["pronto", "cancelado"],
        "pronto": ["saiu_entrega", "cancelado"],
        "saiu_entrega": ["concluido", "cancelado"],
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

    # Update timestamps
    now = datetime.now(timezone.utc)
    if update_data.status == "concluido":
        pedido.concluido_at = now
    elif update_data.status == "cancelado":
        pedido.cancelado_at = now
        pedido.motivo_cancelamento = update_data.observacao

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
    await db.refresh(pedido, ["itens", "endereco", "cliente", "entrega", "pagamentos", "avaliacao"])

    # Publish event
    await publish_pedido_status_atualizado(
        pedido_id=pedido.id,
        numero=pedido.numero,
        status_anterior=status_anterior,
        status_novo=update_data.status,
        usuario_id=current_user.id,
        correlation_id=str(pedido.id)
    )

    # Notify client via WebSocket
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

    # Notify kitchen/staff
    await ws_manager.broadcast_to_perfis({
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
    }, ["cozinha", "atendente", "administrador"])

    return PedidoResponse.model_validate(pedido)


@app.post("/pedidos/{pedido_id}/cancelar", response_model=PedidoResponse, tags=["pedidos"])
async def cancel_pedido(
    pedido_id: int,
    motivo: str,
    current_user: "Usuario" = Depends(get_current_user_dep),
    db: AsyncSession = Depends(get_db)
):
    """Cancel order (client can cancel own if novo, admin/atendente anytime)."""
    from shared.models import StatusPedido

    result = await db.execute(
        select(Pedido).options(selectinload(Pedido.cliente))
        .where(Pedido.id == pedido_id)
    )
    pedido = result.scalar_one_or_none()
    if not pedido:
        raise HTTPException(status_code=404, detail="Order not found")

    # Check permissions
    is_owner = pedido.cliente_id == current_user.id
    is_staff = current_user.perfil.nome in [PerfilNome.ADMINISTRADOR.value, PerfilNome.ATENDENTE.value]

    if not is_owner and not is_staff:
        raise HTTPException(status_code=403, detail="Access denied")

    # Client can only cancel if status is 'novo'
    if is_owner and not is_staff and pedido.status != "novo":
        raise HTTPException(status_code=400, detail="Can only cancel new orders")

    if pedido.status in ["concluido", "cancelado"]:
        raise HTTPException(status_code=400, detail="Order cannot be cancelled")

    status_anterior = pedido.status
    pedido.status = "cancelado"
    pedido.cancelado_at = datetime.now(timezone.utc)
    pedido.motivo_cancelamento = motivo

    historico = HistoricoStatusPedido(
        pedido_id=pedido.id,
        status_anterior=status_anterior,
        status_novo="cancelado",
        usuario_id=current_user.id,
        observacao=motivo
    )
    db.add(historico)

    await db.commit()
    await db.refresh(pedido, ["itens", "endereco", "cliente", "entrega", "pagamentos", "avaliacao"])

    # Publish event
    await publish_pedido_status_atualizado(
        pedido_id=pedido.id,
        numero=pedido.numero,
        status_anterior=status_anterior,
        status_novo="cancelado",
        usuario_id=current_user.id,
        correlation_id=str(pedido.id)
    )

    return PedidoResponse.model_validate(pedido)