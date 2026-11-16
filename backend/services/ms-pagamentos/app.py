"""
Pagamentos Microservice - Payment Processing, Gateways, Webhooks
"""
import os
import hmac
import hashlib
import json
import logging
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import FastAPI, Depends, HTTPException, status, Query, Request, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from sqlalchemy.orm import selectinload

# Mercado Pago SDK
import mercadopago

from services.ms_auth.main import create_app
from shared.database import get_db
from shared.models import (
    Pagamento, Pedido, Usuario, Configuracao
)
from shared.schemas import (
    PagamentoResponse, PagamentoCreate, PagamentoWebhook,
    PaginationParams, PaginatedResponse
)
from shared.auth import (
    get_current_user, require_perfis, verify_token_permissions,
    PerfilNome
)
from shared.messaging import (
    publish_pagamento_aprovado, publish_notificacao_enviar, EventType
)

app = create_app("ms-pagamentos", "1.0.0")

logger = logging.getLogger(__name__)

# Mercado Pago Configuration
MERCADO_PAGO_ACCESS_TOKEN = os.getenv("MERCADO_PAGO_ACCESS_TOKEN")
MERCADO_PAGO_WEBHOOK_SECRET = os.getenv("MERCADO_PAGO_WEBHOOK_SECRET")

mp_sdk = mercadopago.SDK(MERCADO_PAGO_ACCESS_TOKEN) if MERCADO_PAGO_ACCESS_TOKEN else None


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

async def create_mercado_pago_pix(pedido: Pedido, cliente: Usuario) -> dict:
    """Create Mercado Pago Pix payment."""
    if not mp_sdk:
        raise HTTPException(status_code=500, detail="Payment gateway not configured")

    # Get Pix config
    config_chave = await db.execute(select(Configuracao).where(Configuracao.chave == "pix_chave"))
    pix_chave = config_chave.scalar_one_or_none()

    payment_data = {
        "transaction_amount": float(pedido.total),
        "description": f"Pedido {pedido.numero} - Fraga Lanches",
        "payment_method_id": "pix",
        "payer": {
            "email": cliente.email,
            "first_name": cliente.nome.split()[0] if cliente.nome else "Cliente",
            "identification": {
                "type": "CPF",
                "number": "00000000000"  # Would need CPF field in user model
            }
        },
        "notification_url": f"{os.getenv('BASE_URL', 'https://api.fragalanches.com')}/pagamentos/webhook/mercado-pago",
        "external_reference": str(pedido.id),
        "metadata": {
            "pedido_id": pedido.id,
            "pedido_numero": pedido.numero
        }
    }

    result = mp_sdk.payment().create(payment_data)
    if result["status"] in [200, 201]:
        return result["response"]
    else:
        logger.error(f"Mercado Pago error: {result}")
        raise HTTPException(status_code=500, detail="Failed to create payment")


def verify_mercado_pago_webhook(payload: bytes, signature: str) -> bool:
    """Verify Mercado Pago webhook signature."""
    if not MERCADO_PAGO_WEBHOOK_SECRET:
        return False
    expected = hmac.new(
        MERCADO_PAGO_WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


# =============================================
# PAGAMENTOS ENDPOINTS
# =============================================

@app.post("/pagamentos", response_model=PagamentoResponse, status_code=201, tags=["pagamentos"])
async def create_pagamento(
    pagamento_data: PagamentoCreate,
    current_user: "Usuario" = Depends(get_current_user_dep),
    db: AsyncSession = Depends(get_db)
):
    """Create payment record for order."""
    # Verify order belongs to user
    result = await db.execute(
        select(Pedido).options(selectinload(Pedido.cliente))
        .where(Pedido.id == pagamento_data.pedido_id)
    )
    pedido = result.scalar_one_or_none()
    if not pedido:
        raise HTTPException(status_code=404, detail="Order not found")

    if pedido.cliente_id != current_user.id and current_user.perfil.nome not in [PerfilNome.ADMINISTRADOR.value, PerfilNome.ATENDENTE.value]:
        raise HTTPException(status_code=403, detail="Access denied")

    # Check if already has pending payment
    existing = await db.execute(
        select(Pagamento).where(
            Pagamento.pedido_id == pedido.id,
            Pagamento.status.in_(["pendente", "aguardando"])
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Order already has pending payment")

    # Create payment record
    pagamento = Pagamento(
        pedido_id=pedido.id,
        gateway=pagamento_data.gateway,
        forma=pagamento_data.forma,
        valor=pagamento_data.valor,
        status="pendente"
    )
    db.add(pagamento)
    await db.commit()
    await db.refresh(pagamento)

    # If Pix, create Mercado Pago payment
    if pagamento_data.forma == "pix" and mp_sdk:
        try:
            mp_response = await create_mercado_pago_pix(pedido, current_user)
            pagamento.gateway_transaction_id = mp_response.get("id")
            pagamento.dados_gateway = mp_response
            pagamento.status = "aguardando"
            await db.commit()
            await db.refresh(pagamento)

            # Return Pix data to frontend
            pix_data = {
                "pagamento": PagamentoResponse.model_validate(pagamento).model_dump(),
                "pix_qr_code": mp_response.get("point_of_interaction", {}).get("transaction_data", {}).get("qr_code"),
                "pix_qr_code_base64": mp_response.get("point_of_interaction", {}).get("transaction_data", {}).get("qr_code_base64"),
                "pix_copia_cola": mp_response.get("point_of_interaction", {}).get("transaction_data", {}).get("ticket_url"),
                "expires_at": mp_response.get("date_of_expiration")
            }
            return pix_data
        except Exception as e:
            logger.error(f"Error creating Pix payment: {e}")
            # Continue with pending status

    return PagamentoResponse.model_validate(pagamento)


@app.get("/pagamentos/pedido/{pedido_id}", response_model=List[PagamentoResponse], tags=["pagamentos"])
async def list_pagamentos_pedido(
    pedido_id: int,
    current_user: "Usuario" = Depends(get_current_user_dep),
    db: AsyncSession = Depends(get_db)
):
    """List payments for an order."""
    result = await db.execute(select(Pedido).where(Pedido.id == pedido_id))
    pedido = result.scalar_one_or_none()
    if not pedido:
        raise HTTPException(status_code=404, detail="Order not found")

    if pedido.cliente_id != current_user.id and current_user.perfil.nome not in [PerfilNome.ADMINISTRADOR.value, PerfilNome.ATENDENTE.value]:
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(Pagamento).where(Pagamento.pedido_id == pedido_id)
        .order_by(Pagamento.created_at.desc())
    )
    return [PagamentoResponse.model_validate(p) for p in result.scalars().all()]


@app.get("/pagamentos/{pagamento_id}", response_model=PagamentoResponse, tags=["pagamentos"])
async def get_pagamento(
    pagamento_id: int,
    current_user: "Usuario" = Depends(get_current_user_dep),
    db: AsyncSession = Depends(get_db)
):
    """Get payment details."""
    result = await db.execute(
        select(Pagamento).options(selectinload(Pagamento.pedido).selectinload(Pedido.cliente))
        .where(Pagamento.id == pagamento_id)
    )
    pagamento = result.scalar_one_or_none()
    if not pagamento:
        raise HTTPException(status_code=404, detail="Payment not found")

    if (pagamento.pedido.cliente_id != current_user.id and
        current_user.perfil.nome not in [PerfilNome.ADMINISTRADOR.value, PerfilNome.ATENDENTE.value]):
        raise HTTPException(status_code=403, detail="Access denied")

    return PagamentoResponse.model_validate(pagamento)


# =============================================
# MERCADO PAGO WEBHOOK
# =============================================

@app.post("/webhook/mercado-pago", tags=["webhook"])
async def mercado_pago_webhook(
    request: Request,
    x_signature: Optional[str] = Header(None),
    x_request_id: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    """Handle Mercado Pago webhook notifications."""
    payload = await request.body()

    # Verify signature
    if x_signature and not verify_mercado_pago_webhook(payload, x_signature):
        logger.warning("Invalid Mercado Pago webhook signature")
        raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        data = json.loads(payload)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    # Mercado Pago sends: {"action": "payment.updated", "data": {"id": "12345"}}
    action = data.get("action")
    if action != "payment.updated":
        return {"status": "ignored"}

    payment_id = data.get("data", {}).get("id")
    if not payment_id:
        return {"status": "ignored"}

    # Fetch payment details from Mercado Pago
    if not mp_sdk:
        raise HTTPException(status_code=500, detail="Payment gateway not configured")

    mp_result = mp_sdk.payment().get(payment_id)
    if mp_result["status"] != 200:
        logger.error(f"Failed to fetch payment {payment_id}: {mp_result}")
        raise HTTPException(status_code=500, detail="Failed to fetch payment")

    mp_payment = mp_result["response"]

    # Find our payment record
    external_ref = mp_payment.get("external_reference")
    if not external_ref:
        logger.warning(f"No external_reference in payment {payment_id}")
        return {"status": "ignored"}

    result = await db.execute(
        select(Pagamento).options(selectinload(Pagamento.pedido).selectinload(Pedido.cliente))
        .where(Pagamento.gateway_transaction_id == str(payment_id))
    )
    pagamento = result.scalar_one_or_none()

    if not pagamento:
        # Try by external_reference (pedido_id)
        result = await db.execute(
            select(Pagamento).options(selectinload(Pagamento.pedido).selectinload(Pedido.cliente))
            .where(Pagamento.pedido_id == int(external_ref))
        )
        pagamento = result.scalar_one_or_none()

    if not pagamento:
        logger.warning(f"Payment not found for Mercado Pago ID {payment_id}")
        return {"status": "ignored"}

    # Map Mercado Pago status to our status
    mp_status = mp_payment.get("status")
    status_map = {
        "approved": "aprovado",
        "rejected": "recusado",
        "cancelled": "cancelado",
        "refunded": "estornado",
        "pending": "pendente",
        "in_process": "aguardando",
        "in_mediation": "aguardando"
    }

    novo_status = status_map.get(mp_status, "pendente")

    if pagamento.status != novo_status:
        pagamento.status = novo_status
        pagamento.dados_gateway = mp_payment
        if novo_status == "aprovado":
            pagamento.pago_em = datetime.now(timezone.utc)

            # Update order status if needed
            if pagamento.pedido.status == "novo":
                from shared.models import HistoricoStatusPedido
                pagamento.pedido.status = "em_preparo"
                historico = HistoricoStatusPedido(
                    pedido_id=pagamento.pedido.id,
                    status_anterior="novo",
                    status_novo="em_preparo",
                    observacao="Pagamento aprovado automaticamente"
                )
                db.add(historico)

        await db.commit()
        await db.refresh(pagamento, ["pedido"])

        # Publish event
        if novo_status == "aprovado":
            await publish_pagamento_aprovado({
                "pagamento_id": pagamento.id,
                "pedido_id": pagamento.pedido_id,
                "pedido_numero": pagamento.pedido.numero,
                "valor": float(pagamento.valor),
                "forma": pagamento.forma,
                "gateway": pagamento.gateway
            }, correlation_id=str(pagamento.id))

            # Notify client
            await publish_notificacao_enviar(
                usuario_id=pagamento.pedido.cliente_id,
                tipo="pagamento",
                titulo="Pagamento aprovado!",
                mensagem=f"Seu pagamento para o pedido {pagamento.pedido.numero} foi aprovado.",
                dados={"pedido_id": pagamento.pedido_id, "pagamento_id": pagamento.id}
            )

        elif novo_status == "recusado":
            await publish_notificacao_enviar(
                usuario_id=pagamento.pedido.cliente_id,
                tipo="pagamento",
                titulo="Pagamento recusado",
                mensagem=f"Seu pagamento para o pedido {pagamento.pedido.numero} foi recusado. Tente novamente.",
                dados={"pedido_id": pagamento.pedido_id, "pagamento_id": pagamento.id}
            )

    return {"status": "processed"}


# =============================================
# ADMIN: MANUAL PAYMENT CONFIRMATION
# =============================================

@app.post("/admin/pagamentos/{pagamento_id}/confirmar", response_model=PagamentoResponse, tags=["admin"])
async def confirmar_pagamento_manual(
    pagamento_id: int,
    current_user: "Usuario" = Depends(require_admin_or_atendente),
    db: AsyncSession = Depends(get_db)
):
    """Manually confirm payment (cash on delivery, etc.)."""
    result = await db.execute(
        select(Pagamento).options(selectinload(Pagamento.pedido).selectinload(Pedido.cliente))
        .where(Pagamento.id == pagamento_id)
    )
    pagamento = result.scalar_one_or_none()
    if not pagamento:
        raise HTTPException(status_code=404, detail="Payment not found")

    if pagamento.status in ["aprovado", "estornado"]:
        raise HTTPException(status_code=400, detail="Payment already processed")

    pagamento.status = "aprovado"
    pagamento.pago_em = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(pagamento, ["pedido"])

    # Update order if needed
    if pagamento.pedido.status == "novo":
        from shared.models import HistoricoStatusPedido
        pagamento.pedido.status = "em_preparo"
        historico = HistoricoStatusPedido(
            pedido_id=pagamento.pedido.id,
            status_anterior="novo",
            status_novo="em_preparo",
            usuario_id=current_user.id,
            observacao="Pagamento confirmado manualmente"
        )
        db.add(historico)
        await db.commit()

    # Publish event
    await publish_pagamento_aprovado({
        "pagamento_id": pagamento.id,
        "pedido_id": pagamento.pedido_id,
        "pedido_numero": pagamento.pedido.numero,
        "valor": float(pagamento.valor),
        "forma": pagamento.forma,
        "gateway": pagamento.gateway
    }, correlation_id=str(pagamento.id))

    return PagamentoResponse.model_validate(pagamento)


@app.post("/admin/pagamentos/{pagamento_id}/recusar", response_model=PagamentoResponse, tags=["admin"])
async def recusar_pagamento_manual(
    pagamento_id: int,
    motivo: str,
    current_user: "Usuario" = Depends(require_admin_or_atendente),
    db: AsyncSession = Depends(get_db)
):
    """Manually reject payment."""
    result = await db.execute(
        select(Pagamento).options(selectinload(Pagamento.pedido).selectinload(Pedido.cliente))
        .where(Pagamento.id == pagamento_id)
    )
    pagamento = result.scalar_one_or_none()
    if not pagamento:
        raise HTTPException(status_code=404, detail="Payment not found")

    pagamento.status = "recusado"
    pagamento.dados_gateway = {"motivo_manual": motivo, "recusado_por": current_user.id}
    await db.commit()
    await db.refresh(pagamento, ["pedido"])

    # Notify client
    await publish_notificacao_enviar(
        usuario_id=pagamento.pedido.cliente_id,
        tipo="pagamento",
        titulo="Pagamento não confirmado",
        mensagem=f"Seu pagamento para o pedido {pagamento.pedido.numero} não pôde ser confirmado: {motivo}",
        dados={"pedido_id": pagamento.pedido_id, "pagamento_id": pagamento.id}
    )

    return PagamentoResponse.model_validate(pagamento)