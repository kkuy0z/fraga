"""
Catalogo Microservice - Categories, Products, Options, Business Hours
"""
import os
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, update
from sqlalchemy.orm import selectinload

from services.ms_auth.main import create_app
from shared.database import get_db
from shared.models import (
    Categoria, Produto, OpcaoPersonalizacao, ItemOpcao,
    HorarioFuncionamento, Configuracao, TaxaEntrega
)
from shared.schemas import (
    CategoriaResponse, CategoriaCreate, CategoriaUpdate,
    ProdutoResponse, ProdutoCreate, ProdutoUpdate, ProdutoListResponse,
    OpcaoPersonalizacaoResponse, OpcaoPersonalizacaoCreate, OpcaoPersonalizacaoUpdate,
    ItemOpcaoResponse, ItemOpcaoCreate, ItemOpcaoUpdate,
    HorarioFuncionamentoResponse, HorarioFuncionamentoUpdate,
    ConfiguracaoResponse, ConfiguracaoUpdate,
    TaxaEntregaResponse, TaxaEntregaCreate, TaxaEntregaUpdate,
    PaginationParams, PaginatedResponse
)
from shared.auth import (
    get_current_user, require_perfis, verify_token_permissions,
    PERFIS_ADMIN, PERFIS_ATENDIMENTO, PERFIS_COZINHA, PERFIS_INTERNOS, PerfilNome
)
from shared.messaging import publish_notificacao_enviar, EventType

app = create_app("ms-catalogo", "1.0.0")


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


# =============================================
# CATEGORIAS ENDPOINTS
# =============================================

@app.get("/categorias", response_model=List[CategoriaResponse], tags=["categorias"])
async def list_categorias(
    ativo: Optional[bool] = None,
    current_user: "Usuario" = Depends(get_current_user_dep),
    db: AsyncSession = Depends(get_db)
):
    """List categories (public for clients, filtered for staff)."""
    query = select(Categoria)
    if ativo is not None:
        query = query.where(Categoria.ativo == ativo)
    elif current_user.perfil.nome == PerfilNome.CLIENTE.value:
        query = query.where(Categoria.ativo == True)

    query = query.order_by(Categoria.ordem, Categoria.nome)
    result = await db.execute(query)
    return [CategoriaResponse.model_validate(c) for c in result.scalars().all()]


@app.get("/categorias/{categoria_id}", response_model=CategoriaResponse, tags=["categorias"])
async def get_categoria(
    categoria_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get category by ID."""
    result = await db.execute(select(Categoria).where(Categoria.id == categoria_id))
    categoria = result.scalar_one_or_none()
    if not categoria:
        raise HTTPException(status_code=404, detail="Category not found")
    return CategoriaResponse.model_validate(categoria)


@app.post("/categorias", response_model=CategoriaResponse, status_code=201, tags=["categorias"])
async def create_categoria(
    categoria_data: CategoriaCreate,
    current_user: "Usuario" = Depends(require_perfis(PerfilNome.ADMINISTRADOR)),
    db: AsyncSession = Depends(get_db)
):
    """Create category (admin only)."""
    existing = await db.execute(select(Categoria).where(Categoria.nome == categoria_data.nome))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Category name already exists")

    categoria = Categoria(**categoria_data.model_dump())
    db.add(categoria)
    await db.commit()
    await db.refresh(categoria)
    return CategoriaResponse.model_validate(categoria)


@app.put("/categorias/{categoria_id}", response_model=CategoriaResponse, tags=["categorias"])
async def update_categoria(
    categoria_id: int,
    update_data: CategoriaUpdate,
    current_user: "Usuario" = Depends(require_perfis(PerfilNome.ADMINISTRADOR)),
    db: AsyncSession = Depends(get_db)
):
    """Update category (admin only)."""
    result = await db.execute(select(Categoria).where(Categoria.id == categoria_id))
    categoria = result.scalar_one_or_none()
    if not categoria:
        raise HTTPException(status_code=404, detail="Category not found")

    # Check name uniqueness if changing
    if update_data.nome and update_data.nome != categoria.nome:
        existing = await db.execute(
            select(Categoria).where(Categoria.nome == update_data.nome, Categoria.id != categoria_id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Category name already exists")

    for field, value in update_data.model_dump(exclude_unset=True).items():
        setattr(categoria, field, value)

    await db.commit()
    await db.refresh(categoria)
    return CategoriaResponse.model_validate(categoria)


@app.delete("/categorias/{categoria_id}", status_code=204, tags=["categorias"])
async def delete_categoria(
    categoria_id: int,
    current_user: "Usuario" = Depends(require_perfis(PerfilNome.ADMINISTRADOR)),
    db: AsyncSession = Depends(get_db)
):
    """Delete category (admin only) - only if no products."""
    result = await db.execute(select(Categoria).where(Categoria.id == categoria_id))
    categoria = result.scalar_one_or_none()
    if not categoria:
        raise HTTPException(status_code=404, detail="Category not found")

    # Check for products
    prod_count = await db.scalar(
        select(func.count(Produto.id)).where(Produto.categoria_id == categoria_id)
    )
    if prod_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete category with {prod_count} associated products"
        )

    await db.delete(categoria)
    await db.commit()


# =============================================
# PRODUTOS ENDPOINTS
# =============================================

@app.get("/produtos", response_model=List[ProdutoListResponse], tags=["produtos"])
async def list_produtos(
    categoria_id: Optional[int] = None,
    disponivel: Optional[bool] = None,
    destaque: Optional[bool] = None,
    search: Optional[str] = None,
    current_user: "Usuario" = Depends(get_current_user_dep),
    db: AsyncSession = Depends(get_db)
):
    """List products with filters."""
    query = select(Produto).options(selectinload(Produto.categoria))

    if current_user.perfil.nome == PerfilNome.CLIENTE.value:
        query = query.where(Produto.disponivel == True)
        # Also filter by category active
        query = query.join(Categoria).where(Categoria.ativo == True)
    elif disponivel is not None:
        query = query.where(Produto.disponivel == disponivel)

    if categoria_id:
        query = query.where(Produto.categoria_id == categoria_id)
    if destaque is not None:
        query = query.where(Produto.destaque == destaque)
    if search:
        query = query.where(or_(
            Produto.nome.ilike(f"%{search}%"),
            Produto.descricao.ilike(f"%{search}%")
        ))

    query = query.order_by(Produto.destaque.desc(), Produto.ordem, Produto.nome)
    result = await db.execute(query)
    return [ProdutoListResponse.model_validate(p) for p in result.scalars().all()]


@app.get("/produtos/{produto_id}", response_model=ProdutoResponse, tags=["produtos"])
async def get_produto(
    produto_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get product with options."""
    result = await db.execute(
        select(Produto)
        .options(
            selectinload(Produto.categoria),
            selectinload(Produto.opcoes).selectinload(OpcaoPersonalizacao.itens)
        )
        .where(Produto.id == produto_id)
    )
    produto = result.scalar_one_or_none()
    if not produto:
        raise HTTPException(status_code=404, detail="Product not found")
    return ProdutoResponse.model_validate(produto)


@app.post("/produtos", response_model=ProdutoResponse, status_code=201, tags=["produtos"])
async def create_produto(
    produto_data: ProdutoCreate,
    current_user: "Usuario" = Depends(require_perfis(PerfilNome.ADMINISTRADOR)),
    db: AsyncSession = Depends(get_db)
):
    """Create product with options (admin only)."""
    # Verify category exists
    cat_result = await db.execute(select(Categoria).where(Categoria.id == produto_data.categoria_id))
    if not cat_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Invalid category_id")

    # Create product
    opcoes_data = produto_data.opcoes
    produto_dict = produto_data.model_dump(exclude={"opcoes"})
    produto = Produto(**produto_dict)
    db.add(produto)
    await db.flush()

    # Create options and items
    for opcao_data in opcoes_data:
        itens_data = opcao_data.itens
        opcao_dict = opcao_data.model_dump(exclude={"itens"})
        opcao = OpcaoPersonalizacao(produto_id=produto.id, **opcao_dict)
        db.add(opcao)
        await db.flush()

        for item_data in itens_data:
            item = ItemOpcao(opcao_id=opcao.id, **item_data.model_dump())
            db.add(item)

    await db.commit()
    await db.refresh(produto, ["categoria", "opcoes"])
    return ProdutoResponse.model_validate(produto)


@app.put("/produtos/{produto_id}", response_model=ProdutoResponse, tags=["produtos"])
async def update_produto(
    produto_id: int,
    update_data: ProdutoUpdate,
    current_user: "Usuario" = Depends(require_perfis(PerfilNome.ADMINISTRADOR)),
    db: AsyncSession = Depends(get_db)
):
    """Update product (admin only)."""
    result = await db.execute(
        select(Produto).options(selectinload(Produto.opcoes).selectinload(OpcaoPersonalizacao.itens))
        .where(Produto.id == produto_id)
    )
    produto = result.scalar_one_or_none()
    if not produto:
        raise HTTPException(status_code=404, detail="Product not found")

    if update_data.categoria_id:
        cat_result = await db.execute(select(Categoria).where(Categoria.id == update_data.categoria_id))
        if not cat_result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Invalid category_id")

    for field, value in update_data.model_dump(exclude_unset=True).items():
        setattr(produto, field, value)

    await db.commit()
    await db.refresh(produto, ["categoria", "opcoes"])
    return ProdutoResponse.model_validate(produto)


@app.delete("/produtos/{produto_id}", status_code=204, tags=["produtos"])
async def delete_produto(
    produto_id: int,
    current_user: "Usuario" = Depends(require_perfis(PerfilNome.ADMINISTRADOR)),
    db: AsyncSession = Depends(get_db)
):
    """Delete product (admin only)."""
    result = await db.execute(select(Produto).where(Produto.id == produto_id))
    produto = result.scalar_one_or_none()
    if not produto:
        raise HTTPException(status_code=404, detail="Product not found")

    await db.delete(produto)
    await db.commit()


# =============================================
# OPÇÕES DE PERSONALIZAÇÃO ENDPOINTS
# =============================================

@app.post("/produtos/{produto_id}/opcoes", response_model=OpcaoPersonalizacaoResponse, status_code=201, tags=["opcoes"])
async def create_opcao(
    produto_id: int,
    opcao_data: OpcaoPersonalizacaoCreate,
    current_user: "Usuario" = Depends(require_perfis(PerfilNome.ADMINISTRADOR)),
    db: AsyncSession = Depends(get_db)
):
    """Add personalization option to product."""
    result = await db.execute(select(Produto).where(Produto.id == produto_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Product not found")

    itens_data = opcao_data.itens
    opcao = OpcaoPersonalizacao(produto_id=produto_id, **opcao_data.model_dump(exclude={"itens"}))
    db.add(opcao)
    await db.flush()

    for item_data in itens_data:
        item = ItemOpcao(opcao_id=opcao.id, **item_data.model_dump())
        db.add(item)

    await db.commit()
    await db.refresh(opcao, ["itens"])
    return OpcaoPersonalizacaoResponse.model_validate(opcao)


@app.put("/opcoes/{opcao_id}", response_model=OpcaoPersonalizacaoResponse, tags=["opcoes"])
async def update_opcao(
    opcao_id: int,
    update_data: OpcaoPersonalizacaoUpdate,
    current_user: "Usuario" = Depends(require_perfis(PerfilNome.ADMINISTRADOR)),
    db: AsyncSession = Depends(get_db)
):
    """Update personalization option."""
    result = await db.execute(
        select(OpcaoPersonalizacao).options(selectinload(OpcaoPersonalizacao.itens))
        .where(OpcaoPersonalizacao.id == opcao_id)
    )
    opcao = result.scalar_one_or_none()
    if not opcao:
        raise HTTPException(status_code=404, detail="Option not found")

    for field, value in update_data.model_dump(exclude_unset=True).items():
        setattr(opcao, field, value)

    await db.commit()
    await db.refresh(opcao, ["itens"])
    return OpcaoPersonalizacaoResponse.model_validate(opcao)


@app.delete("/opcoes/{opcao_id}", status_code=204, tags=["opcoes"])
async def delete_opcao(
    opcao_id: int,
    current_user: "Usuario" = Depends(require_perfis(PerfilNome.ADMINISTRADOR)),
    db: AsyncSession = Depends(get_db)
):
    """Delete personalization option."""
    result = await db.execute(select(OpcaoPersonalizacao).where(OpcaoPersonalizacao.id == opcao_id))
    opcao = result.scalar_one_or_none()
    if not opcao:
        raise HTTPException(status_code=404, detail="Option not found")

    await db.delete(opcao)
    await db.commit()


# =============================================
# ITENS DE OPÇÃO ENDPOINTS
# =============================================

@app.post("/opcoes/{opcao_id}/itens", response_model=ItemOpcaoResponse, status_code=201, tags=["itens-opcao"])
async def create_item_opcao(
    opcao_id: int,
    item_data: ItemOpcaoCreate,
    current_user: "Usuario" = Depends(require_perfis(PerfilNome.ADMINISTRADOR)),
    db: AsyncSession = Depends(get_db)
):
    """Add item to personalization option."""
    result = await db.execute(select(OpcaoPersonalizacao).where(OpcaoPersonalizacao.id == opcao_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Option not found")

    item = ItemOpcao(opcao_id=opcao_id, **item_data.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return ItemOpcaoResponse.model_validate(item)


@app.put("/itens-opcao/{item_id}", response_model=ItemOpcaoResponse, tags=["itens-opcao"])
async def update_item_opcao(
    item_id: int,
    update_data: ItemOpcaoUpdate,
    current_user: "Usuario" = Depends(require_perfis(PerfilNome.ADMINISTRADOR)),
    db: AsyncSession = Depends(get_db)
):
    """Update option item."""
    result = await db.execute(select(ItemOpcao).where(ItemOpcao.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    for field, value in update_data.model_dump(exclude_unset=True).items():
        setattr(item, field, value)

    await db.commit()
    await db.refresh(item)
    return ItemOpcaoResponse.model_validate(item)


@app.delete("/itens-opcao/{item_id}", status_code=204, tags=["itens-opcao"])
async def delete_item_opcao(
    item_id: int,
    current_user: "Usuario" = Depends(require_perfis(PerfilNome.ADMINISTRADOR)),
    db: AsyncSession = Depends(get_db)
):
    """Delete option item."""
    result = await db.execute(select(ItemOpcao).where(ItemOpcao.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    await db.delete(item)
    await db.commit()


# =============================================
# HORÁRIOS DE FUNCIONAMENTO ENDPOINTS
# =============================================

@app.get("/horarios", response_model=List[HorarioFuncionamentoResponse], tags=["horarios"])
async def list_horarios(
    db: AsyncSession = Depends(get_db)
):
    """List business hours (public)."""
    result = await db.execute(
        select(HorarioFuncionamento).order_by(HorarioFuncionamento.dia_semana)
    )
    return [HorarioFuncionamentoResponse.model_validate(h) for h in result.scalars().all()]


@app.put("/horarios/{dia_semana}", response_model=HorarioFuncionamentoResponse, tags=["horarios"])
async def update_horario(
    dia_semana: int,
    update_data: HorarioFuncionamentoUpdate,
    current_user: "Usuario" = Depends(require_perfis(PerfilNome.ADMINISTRADOR)),
    db: AsyncSession = Depends(get_db)
):
    """Update business hours for a day (admin only)."""
    if not 0 <= dia_semana <= 6:
        raise HTTPException(status_code=400, detail="Invalid day of week (0-6)")

    result = await db.execute(
        select(HorarioFuncionamento).where(HorarioFuncionamento.dia_semana == dia_semana)
    )
    horario = result.scalar_one_or_none()
    if not horario:
        raise HTTPException(status_code=404, detail="Schedule not found")

    for field, value in update_data.model_dump(exclude_unset=True).items():
        setattr(horario, field, value)

    await db.commit()
    await db.refresh(horario)
    return HorarioFuncionamentoResponse.model_validate(horario)


@app.get("/horarios/status", tags=["horarios"])
async def check_status_aberto(
    db: AsyncSession = Depends(get_db)
):
    """Check if establishment is currently open."""
    from datetime import datetime
    now = datetime.now()
    dia_semana = now.weekday()  # 0=Monday, 6=Sunday
    # Convert to our format (0=Sunday)
    dia_semana = (dia_semana + 1) % 7
    hora_atual = now.time()

    result = await db.execute(
        select(HorarioFuncionamento).where(
            HorarioFuncionamento.dia_semana == dia_semana,
            HorarioFuncionamento.ativo == True
        )
    )
    horario = result.scalar_one_or_none()

    if not horario:
        return {"aberto": False, "mensagem": "Fechado hoje"}

    from datetime import time
    abre = time.fromisoformat(horario.abre_as)
    fecha = time.fromisoformat(horario.fecha_as)

    # Handle overnight hours (e.g., 18:00 - 02:00)
    if abre <= fecha:
        aberto = abre <= hora_atual <= fecha
    else:
        aberto = hora_atual >= abre or hora_atual <= fecha

    return {
        "aberto": aberto,
        "abre_as": horario.abre_as,
        "fecha_as": horario.fecha_as,
        "mensagem": "Aberto" if aberto else "Fechado"
    }


# =============================================
# CONFIGURAÇÕES ENDPOINTS
# =============================================

@app.get("/configuracoes", response_model=List[ConfiguracaoResponse], tags=["configuracoes"])
async def list_configuracoes(
    current_user: "Usuario" = Depends(require_perfis(PerfilNome.ADMINISTRADOR)),
    db: AsyncSession = Depends(get_db)
):
    """List all configurations (admin only)."""
    result = await db.execute(select(Configuracao).order_by(Configuracao.chave))
    return [ConfiguracaoResponse.model_validate(c) for c in result.scalars().all()]


@app.get("/configuracoes/{chave}", response_model=ConfiguracaoResponse, tags=["configuracoes"])
async def get_configuracao(
    chave: str,
    db: AsyncSession = Depends(get_db)
):
    """Get configuration by key (public for some keys)."""
    result = await db.execute(select(Configuracao).where(Configuracao.chave == chave))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    return ConfiguracaoResponse.model_validate(config)


@app.put("/configuracoes/{chave}", response_model=ConfiguracaoResponse, tags=["configuracoes"])
async def update_configuracao(
    chave: str,
    update_data: ConfiguracaoUpdate,
    current_user: "Usuario" = Depends(require_perfis(PerfilNome.ADMINISTRADOR)),
    db: AsyncSession = Depends(get_db)
):
    """Update configuration (admin only)."""
    result = await db.execute(select(Configuracao).where(Configuracao.chave == chave))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")

    if update_data.valor is not None:
        config.valor = update_data.valor
    if update_data.descricao is not None:
        config.descricao = update_data.descricao

    await db.commit()
    await db.refresh(config)
    return ConfiguracaoResponse.model_validate(config)


# =============================================
# TAXAS DE ENTREGA ENDPOINTS
# =============================================

@app.get("/taxas-entrega", response_model=List[TaxaEntregaResponse], tags=["taxas-entrega"])
async def list_taxas_entrega(
    ativo: Optional[bool] = None,
    current_user: "Usuario" = Depends(get_current_user_dep),
    db: AsyncSession = Depends(get_db)
):
    """List delivery fees."""
    query = select(TaxaEntrega)
    if ativo is not None:
        query = query.where(TaxaEntrega.ativo == ativo)
    elif current_user.perfil.nome == PerfilNome.CLIENTE.value:
        query = query.where(TaxaEntrega.ativo == True)

    query = query.order_by(TaxaEntrega.nome)
    result = await db.execute(query)
    return [TaxaEntregaResponse.model_validate(t) for t in result.scalars().all()]


@app.get("/taxas-entrega/calcular", tags=["taxas-entrega"])
async def calcular_taxa_entrega(
    bairro: str,
    db: AsyncSession = Depends(get_db)
):
    """Calculate delivery fee for a neighborhood."""
    result = await db.execute(
        select(TaxaEntrega).where(TaxaEntrega.ativo == True)
    )
    taxas = result.scalars().all()

    for taxa in taxas:
        if bairro.upper() in [b.upper() for b in taxa.bairros]:
            return {"taxa_id": taxa.id, "valor": taxa.valor, "tempo_estimado_min": taxa.tempo_estimado_min}

    # Default fee if no match
    config_result = await db.execute(
        select(Configuracao).where(Configuracao.chave == "taxa_entrega_padrao")
    )
    config = config_result.scalar_one_or_none()
    valor_padrao = float(config.valor) if config else 5.00

    return {"taxa_id": None, "valor": valor_padrao, "tempo_estimado_min": 40}


@app.post("/taxas-entrega", response_model=TaxaEntregaResponse, status_code=201, tags=["taxas-entrega"])
async def create_taxa_entrega(
    taxa_data: TaxaEntregaCreate,
    current_user: "Usuario" = Depends(require_perfis(PerfilNome.ADMINISTRADOR)),
    db: AsyncSession = Depends(get_db)
):
    """Create delivery fee (admin only)."""
    taxa = TaxaEntrega(**taxa_data.model_dump())
    db.add(taxa)
    await db.commit()
    await db.refresh(taxa)
    return TaxaEntregaResponse.model_validate(taxa)


@app.put("/taxas-entrega/{taxa_id}", response_model=TaxaEntregaResponse, tags=["taxas-entrega"])
async def update_taxa_entrega(
    taxa_id: int,
    update_data: TaxaEntregaUpdate,
    current_user: "Usuario" = Depends(require_perfis(PerfilNome.ADMINISTRADOR)),
    db: AsyncSession = Depends(get_db)
):
    """Update delivery fee (admin only)."""
    result = await db.execute(select(TaxaEntrega).where(TaxaEntrega.id == taxa_id))
    taxa = result.scalar_one_or_none()
    if not taxa:
        raise HTTPException(status_code=404, detail="Delivery fee not found")

    for field, value in update_data.model_dump(exclude_unset=True).items():
        setattr(taxa, field, value)

    await db.commit()
    await db.refresh(taxa)
    return TaxaEntregaResponse.model_validate(taxa)


@app.delete("/taxas-entrega/{taxa_id}", status_code=204, tags=["taxas-entrega"])
async def delete_taxa_entrega(
    taxa_id: int,
    current_user: "Usuario" = Depends(require_perfis(PerfilNome.ADMINISTRADOR)),
    db: AsyncSession = Depends(get_db)
):
    """Delete delivery fee (admin only)."""
    result = await db.execute(select(TaxaEntrega).where(TaxaEntrega.id == taxa_id))
    taxa = result.scalar_one_or_none()
    if not taxa:
        raise HTTPException(status_code=404, detail="Delivery fee not found")

    await db.delete(taxa)
    await db.commit()