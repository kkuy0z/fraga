"""
Auth Microservice - Authentication, Users, and Permissions
"""
import os
from contextlib import asynccontextmanager
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload

from services.ms_auth.main import create_app
from shared.database import get_db, init_db, close_db
from shared.models import Usuario, Perfil, Endereco
from shared.schemas import (
    UsuarioResponse, UsuarioCreate, UsuarioUpdate, PerfilResponse,
    EnderecoResponse, EnderecoCreate, EnderecoUpdate,
    LoginRequest, TokenResponse, RegisterRequest,
    PaginationParams, PaginatedResponse, ErrorDetail
)
from pydantic import BaseModel
from typing import Optional


# Frontend-compatible response models
class ClienteTokenResponse(BaseModel):
    """Response format expected by frontend (cadastro.js, login.js)"""
    token: str
    cliente: UsuarioResponse


class ClienteLoginRequest(BaseModel):
    email: str
    senha: str


class ClienteRegisterRequest(BaseModel):
    nome: str
    email: str
    telefone: Optional[str] = None
    senha: str
    termosAceitos: bool = True
from shared.auth import (
    hash_password, verify_password, create_token_pair,
    decode_token, verify_token_permissions,
    PERFIS_ADMIN, PERFIS_ATENDIMENTO, PERFIS_INTERNOS
)

app = create_app("ms-auth", "1.0.0")


# =============================================
# DEPENDENCIES
# =============================================

async def get_current_user(
    authorization: str = None,
    db: AsyncSession = Depends(get_db)
) -> Usuario:
    """Get current authenticated user from JWT token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header"
        )

    token = authorization.split(" ")[1]
    token_data = decode_token(token)
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

    result = await db.execute(
        select(Usuario).options(selectinload(Usuario.perfil))
        .where(Usuario.id == int(token_data.sub))
    )
    usuario = result.scalar_one_or_none()
    if not usuario or not usuario.ativo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    return usuario


async def require_perfis(*perfis_permitidos) -> Usuario:
    """Dependency to require specific perfis."""
    async def _check(user: Usuario = Depends(get_current_user)) -> Usuario:
        if not verify_token_permissions(
            type('TokenData', (), {'perfil': user.perfil.nome})(),
            list(perfis_permitidos)
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        return user
    return _check


# =============================================
# AUTH ENDPOINTS
# =============================================

@app.post("/auth/login", response_model=TokenResponse, tags=["auth"])
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate user and return JWT tokens."""
    result = await db.execute(
        select(Usuario).options(selectinload(Usuario.perfil))
        .where(Usuario.email == request.email)
    )
    usuario = result.scalar_one_or_none()

    if not usuario or not verify_password(request.senha, usuario.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    if not usuario.ativo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )

    # Update last login
    from datetime import datetime, timezone
    usuario.ultimo_login = datetime.now(timezone.utc)
    await db.commit()

    tokens = create_token_pair(usuario.id, usuario.email, usuario.perfil.nome)

    return TokenResponse(
        access_token=tokens["access_token"],
        token_type=tokens["token_type"],
        expires_in=tokens["expires_in"],
        usuario=UsuarioResponse.model_validate(usuario)
    )


@app.post("/auth/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED, tags=["auth"])
async def register(request: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new client user."""
    # Check if email exists
    existing = await db.execute(select(Usuario).where(Usuario.email == request.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )

    # Get cliente perfil
    perfil_result = await db.execute(select(Perfil).where(Perfil.nome == "cliente"))
    perfil = perfil_result.scalar_one_or_none()
    if not perfil:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Default perfil not configured"
        )

    # Create user
    usuario = Usuario(
        perfil_id=perfil.id,
        nome=request.nome,
        email=request.email,
        telefone=request.telefone,
        senha_hash=hash_password(request.senha),
        ativo=True
    )
    db.add(usuario)
    await db.commit()
    await db.refresh(usuario)
    await db.refresh(usuario, ["perfil"])

    tokens = create_token_pair(usuario.id, usuario.email, usuario.perfil.nome)

    return TokenResponse(
        access_token=tokens["access_token"],
        token_type=tokens["token_type"],
        expires_in=tokens["expires_in"],
        usuario=UsuarioResponse.model_validate(usuario)
    )


@app.post("/auth/refresh", response_model=TokenResponse, tags=["auth"])
async def refresh_token(refresh_token: str, db: AsyncSession = Depends(get_db)):
    """Refresh access token using refresh token."""
    from shared.auth import decode_refresh_token
    payload = decode_refresh_token(refresh_token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )

    user_id = payload.get("sub")
    result = await db.execute(
        select(Usuario).options(selectinload(Usuario.perfil))
        .where(Usuario.id == int(user_id))
    )
    usuario = result.scalar_one_or_none()
    if not usuario or not usuario.ativo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )

    tokens = create_token_pair(usuario.id, usuario.email, usuario.perfil.nome)

    return TokenResponse(
        access_token=tokens["access_token"],
        token_type=tokens["token_type"],
        expires_in=tokens["expires_in"],
        usuario=UsuarioResponse.model_validate(usuario)
    )


@app.get("/auth/me", response_model=UsuarioResponse, tags=["auth"])
async def get_current_user_info(current_user: Usuario = Depends(get_current_user)):
    """Get current user profile."""
    return UsuarioResponse.model_validate(current_user)


@app.put("/auth/me", response_model=UsuarioResponse, tags=["auth"])
async def update_current_user(
    update_data: UsuarioUpdate,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update current user profile."""
    if update_data.nome is not None:
        current_user.nome = update_data.nome
    if update_data.telefone is not None:
        current_user.telefone = update_data.telefone

    await db.commit()
    await db.refresh(current_user, ["perfil"])
    return UsuarioResponse.model_validate(current_user)


@app.post("/auth/change-password", tags=["auth"])
async def change_password(
    current_password: str,
    new_password: str,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Change user password."""
    if not verify_password(current_password, current_user.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )

    if len(new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters"
        )

    current_user.senha_hash = hash_password(new_password)
    await db.commit()

    return {"message": "Password changed successfully"}


# =============================================
# USUÁRIOS (ADMIN) ENDPOINTS
# =============================================

@app.get("/usuarios", response_model=PaginatedResponse, tags=["usuarios"])
async def list_usuarios(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    perfil_id: Optional[int] = None,
    ativo: Optional[bool] = None,
    current_user: Usuario = Depends(require_perfis(PerfilNome.ADMINISTRADOR)),
    db: AsyncSession = Depends(get_db)
):
    """List all users (admin only)."""
    query = select(Usuario).options(selectinload(Usuario.perfil))

    if search:
        query = query.where(
            or_(
                Usuario.nome.ilike(f"%{search}%"),
                Usuario.email.ilike(f"%{search}%"),
                Usuario.telefone.ilike(f"%{search}%")
            )
        )
    if perfil_id:
        query = query.where(Usuario.perfil_id == perfil_id)
    if ativo is not None:
        query = query.where(Usuario.ativo == ativo)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)

    # Paginate
    query = query.order_by(Usuario.created_at.desc())
    query = query.offset((page - 1) * size).limit(size)

    result = await db.execute(query)
    usuarios = result.scalars().all()

    items = [UsuarioResponse.model_validate(u) for u in usuarios]
    return PaginatedResponse.create(items, total, page, size)


@app.get("/usuarios/{usuario_id}", response_model=UsuarioResponse, tags=["usuarios"])
async def get_usuario(
    usuario_id: int,
    current_user: Usuario = Depends(require_perfis(PerfilNome.ADMINISTRADOR)),
    db: AsyncSession = Depends(get_db)
):
    """Get user by ID (admin only)."""
    result = await db.execute(
        select(Usuario).options(selectinload(Usuario.perfil))
        .where(Usuario.id == usuario_id)
    )
    usuario = result.scalar_one_or_none()
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return UsuarioResponse.model_validate(usuario)


@app.post("/usuarios", response_model=UsuarioResponse, status_code=status.HTTP_201_CREATED, tags=["usuarios"])
async def create_usuario(
    usuario_data: UsuarioCreate,
    current_user: Usuario = Depends(require_perfis(PerfilNome.ADMINISTRADOR)),
    db: AsyncSession = Depends(get_db)
):
    """Create new user (admin only)."""
    # Check email uniqueness
    existing = await db.execute(select(Usuario).where(Usuario.email == usuario_data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )

    # Verify perfil exists
    perfil_result = await db.execute(select(Perfil).where(Perfil.id == usuario_data.perfil_id))
    if not perfil_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid perfil_id"
        )

    usuario = Usuario(
        perfil_id=usuario_data.perfil_id,
        nome=usuario_data.nome,
        email=usuario_data.email,
        telefone=usuario_data.telefone,
        senha_hash=hash_password(usuario_data.senha),
        ativo=usuario_data.ativo
    )
    db.add(usuario)
    await db.commit()
    await db.refresh(usuario, ["perfil"])

    return UsuarioResponse.model_validate(usuario)


@app.put("/usuarios/{usuario_id}", response_model=UsuarioResponse, tags=["usuarios"])
async def update_usuario(
    usuario_id: int,
    update_data: UsuarioUpdate,
    current_user: Usuario = Depends(require_perfis(PerfilNome.ADMINISTRADOR)),
    db: AsyncSession = Depends(get_db)
):
    """Update user (admin only)."""
    result = await db.execute(select(Usuario).where(Usuario.id == usuario_id))
    usuario = result.scalar_one_or_none()
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Prevent self-deactivation
    if usuario.id == current_user.id and update_data.ativo is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate yourself"
        )

    if update_data.nome is not None:
        usuario.nome = update_data.nome
    if update_data.telefone is not None:
        usuario.telefone = update_data.telefone
    if update_data.perfil_id is not None:
        # Verify perfil exists
        perfil_result = await db.execute(select(Perfil).where(Perfil.id == update_data.perfil_id))
        if not perfil_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid perfil_id"
            )
        usuario.perfil_id = update_data.perfil_id
    if update_data.ativo is not None:
        usuario.ativo = update_data.ativo

    await db.commit()
    await db.refresh(usuario, ["perfil"])
    return UsuarioResponse.model_validate(usuario)


@app.delete("/usuarios/{usuario_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["usuarios"])
async def delete_usuario(
    usuario_id: int,
    current_user: Usuario = Depends(require_perfis(PerfilNome.ADMINISTRADOR)),
    db: AsyncSession = Depends(get_db)
):
    """Delete user (admin only)."""
    if usuario_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete yourself"
        )

    result = await db.execute(select(Usuario).where(Usuario.id == usuario_id))
    usuario = result.scalar_one_or_none()
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Soft delete - just deactivate
    usuario.ativo = False
    await db.commit()


# =============================================
# PERFIS ENDPOINTS
# =============================================

@app.get("/perfis", response_model=List[PerfilResponse], tags=["perfis"])
async def list_perfis(
    current_user: Usuario = Depends(require_perfis(PerfilNome.ADMINISTRADOR)),
    db: AsyncSession = Depends(get_db)
):
    """List all perfis (admin only)."""
    result = await db.execute(select(Perfil).order_by(Perfil.id))
    perfis = result.scalars().all()
    return [PerfilResponse.model_validate(p) for p in perfis]


# =============================================
# ENDEREÇOS ENDPOINTS
# =============================================

@app.get("/usuarios/{usuario_id}/enderecos", response_model=List[EnderecoResponse], tags=["enderecos"])
async def list_enderecos(
    usuario_id: int,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List user addresses (own or admin)."""
    if current_user.id != usuario_id and current_user.perfil.nome not in [p.value for p in PERFIS_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    result = await db.execute(
        select(Endereco).where(Endereco.usuario_id == usuario_id)
        .order_by(Endereco.principal.desc(), Endereco.created_at.desc())
    )
    enderecos = result.scalars().all()
    return [EnderecoResponse.model_validate(e) for e in enderecos]


@app.post("/usuarios/{usuario_id}/enderecos", response_model=EnderecoResponse, status_code=status.HTTP_201_CREATED, tags=["enderecos"])
async def create_endereco(
    usuario_id: int,
    endereco_data: EnderecoCreate,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create address for user."""
    if current_user.id != usuario_id and current_user.perfil.nome not in [p.value for p in PERFIS_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # If this is principal, unset others
    if endereco_data.principal:
        await db.execute(
            select(Endereco).where(
                Endereco.usuario_id == usuario_id,
                Endereco.principal == True
            )
        )
        # Actually update them
        from sqlalchemy import update
        await db.execute(
            update(Endereco)
            .where(Endereco.usuario_id == usuario_id, Endereco.principal == True)
            .values(principal=False)
        )

    endereco = Endereco(
        usuario_id=usuario_id,
        **endereco_data.model_dump()
    )
    db.add(endereco)
    await db.commit()
    await db.refresh(endereco)

    return EnderecoResponse.model_validate(endereco)


@app.put("/enderecos/{endereco_id}", response_model=EnderecoResponse, tags=["enderecos"])
async def update_endereco(
    endereco_id: int,
    update_data: EnderecoUpdate,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update address."""
    result = await db.execute(select(Endereco).where(Endereco.id == endereco_id))
    endereco = result.scalar_one_or_none()
    if not endereco:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Address not found"
        )

    if current_user.id != endereco.usuario_id and current_user.perfil.nome not in [p.value for p in PERFIS_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Handle principal flag
    if update_data.principal is True:
        from sqlalchemy import update
        await db.execute(
            update(Endereco)
            .where(Endereco.usuario_id == endereco.usuario_id, Endereco.principal == True)
            .values(principal=False)
        )

    for field, value in update_data.model_dump(exclude_unset=True).items():
        setattr(endereco, field, value)

    await db.commit()
    await db.refresh(endereco)
    return EnderecoResponse.model_validate(endereco)


@app.delete("/enderecos/{endereco_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["enderecos"])
async def delete_endereco(
    endereco_id: int,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete address."""
    result = await db.execute(select(Endereco).where(Endereco.id == endereco_id))
    endereco = result.scalar_one_or_none()
    if not endereco:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Address not found"
        )

    if current_user.id != endereco.usuario_id and current_user.perfil.nome not in [p.value for p in PERFIS_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    await db.delete(endereco)
    await db.commit()


# =============================================
# CLIENTE ENDPOINTS (Frontend Compatibility)
# =============================================

@app.post("/clientes/register", response_model=ClienteTokenResponse, status_code=status.HTTP_201_CREATED, tags=["clientes"])
async def cliente_register(request: ClienteRegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new client user (frontend compatible)."""
    # Check if email exists
    existing = await db.execute(select(Usuario).where(Usuario.email == request.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )

    # Check if telefone exists (if provided)
    if request.telefone:
        existing_tel = await db.execute(select(Usuario).where(Usuario.telefone == request.telefone))
        if existing_tel.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Telefone already registered"
            )

    # Get cliente perfil
    perfil_result = await db.execute(select(Perfil).where(Perfil.nome == "cliente"))
    perfil = perfil_result.scalar_one_or_none()
    if not perfil:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Default perfil not configured"
        )

    # Create user
    usuario = Usuario(
        perfil_id=perfil.id,
        nome=request.nome,
        email=request.email,
        telefone=request.telefone,
        senha_hash=hash_password(request.senha),
        ativo=True
    )
    db.add(usuario)
    await db.commit()
    await db.refresh(usuario)
    await db.refresh(usuario, ["perfil"])

    tokens = create_token_pair(usuario.id, usuario.email, usuario.perfil.nome)

    return ClienteTokenResponse(
        token=tokens["access_token"],
        cliente=UsuarioResponse.model_validate(usuario)
    )


@app.post("/clientes/login", response_model=ClienteTokenResponse, tags=["clientes"])
async def cliente_login(request: ClienteLoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate client user and return JWT tokens (frontend compatible)."""
    result = await db.execute(
        select(Usuario).options(selectinload(Usuario.perfil))
        .where(Usuario.email == request.email)
    )
    usuario = result.scalar_one_or_none()

    if not usuario or not verify_password(request.senha, usuario.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    if not usuario.ativo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )

    # Only allow cliente perfil for this endpoint
    if usuario.perfil.nome != PerfilNome.CLIENTE.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Use admin login for staff accounts."
        )

    # Update last login
    from datetime import datetime, timezone
    usuario.ultimo_login = datetime.now(timezone.utc)
    await db.commit()

    tokens = create_token_pair(usuario.id, usuario.email, usuario.perfil.nome)

    return ClienteTokenResponse(
        token=tokens["access_token"],
        cliente=UsuarioResponse.model_validate(usuario)
    )


@app.get("/clientes/verify", response_model=UsuarioResponse, tags=["clientes"])
async def cliente_verify(current_user: Usuario = Depends(get_current_user)):
    """Verify client token and return user info (alias for /auth/me)."""
    if current_user.perfil.nome != PerfilNome.CLIENTE.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    return UsuarioResponse.model_validate(current_user)


@app.get("/clientes/perfil", response_model=UsuarioResponse, tags=["clientes"])
async def get_cliente_perfil(current_user: Usuario = Depends(get_current_user)):
    """Get client profile (alias for /auth/me)."""
    if current_user.perfil.nome != PerfilNome.CLIENTE.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    return UsuarioResponse.model_validate(current_user)


@app.put("/clientes/perfil", response_model=UsuarioResponse, tags=["clientes"])
async def update_cliente_perfil(
    update_data: UsuarioUpdate,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update client profile (alias for /auth/me PUT)."""
    if current_user.perfil.nome != PerfilNome.CLIENTE.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    if update_data.nome is not None:
        current_user.nome = update_data.nome
    if update_data.telefone is not None:
        current_user.telefone = update_data.telefone

    await db.commit()
    await db.refresh(current_user, ["perfil"])
    return UsuarioResponse.model_validate(current_user)


@app.put("/clientes/senha", tags=["clientes"])
async def alterar_cliente_senha(
    current_password: str,
    new_password: str,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Change client password (alias for /auth/change-password)."""
    if current_user.perfil.nome != PerfilNome.CLIENTE.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    if not verify_password(current_password, current_user.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )

    if len(new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters"
        )

    current_user.senha_hash = hash_password(new_password)
    await db.commit()

    return {"message": "Password changed successfully"}


@app.get("/clientes/enderecos", response_model=List[EnderecoResponse], tags=["clientes"])
async def get_cliente_enderecos(
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List client addresses (alias for /usuarios/{id}/enderecos)."""
    if current_user.perfil.nome != PerfilNome.CLIENTE.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    result = await db.execute(
        select(Endereco).where(Endereco.usuario_id == current_user.id)
        .order_by(Endereco.principal.desc(), Endereco.created_at.desc())
    )
    enderecos = result.scalars().all()
    return [EnderecoResponse.model_validate(e) for e in enderecos]


@app.post("/clientes/enderecos", response_model=EnderecoResponse, status_code=status.HTTP_201_CREATED, tags=["clientes"])
async def criar_cliente_endereco(
    endereco_data: EnderecoCreate,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create address for client (alias for /usuarios/{id}/enderecos POST)."""
    if current_user.perfil.nome != PerfilNome.CLIENTE.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # If this is principal, unset others
    if endereco_data.principal:
        from sqlalchemy import update
        await db.execute(
            update(Endereco)
            .where(Endereco.usuario_id == current_user.id, Endereco.principal == True)
            .values(principal=False)
        )

    endereco = Endereco(
        usuario_id=current_user.id,
        **endereco_data.model_dump()
    )
    db.add(endereco)
    await db.commit()
    await db.refresh(endereco)

    return EnderecoResponse.model_validate(endereco)


@app.put("/clientes/enderecos/{endereco_id}", response_model=EnderecoResponse, tags=["clientes"])
async def atualizar_cliente_endereco(
    endereco_id: int,
    update_data: EnderecoUpdate,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update client address (alias for /enderecos/{id} PUT)."""
    if current_user.perfil.nome != PerfilNome.CLIENTE.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    result = await db.execute(select(Endereco).where(Endereco.id == endereco_id))
    endereco = result.scalar_one_or_none()
    if not endereco:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Address not found"
        )

    if endereco.usuario_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Handle principal flag
    if update_data.principal is True:
        from sqlalchemy import update
        await db.execute(
            update(Endereco)
            .where(Endereco.usuario_id == current_user.id, Endereco.principal == True)
            .values(principal=False)
        )

    for field, value in update_data.model_dump(exclude_unset=True).items():
        setattr(endereco, field, value)

    await db.commit()
    await db.refresh(endereco)
    return EnderecoResponse.model_validate(endereco)


@app.delete("/clientes/enderecos/{endereco_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["clientes"])
async def excluir_cliente_endereco(
    endereco_id: int,
    current_user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete client address (alias for /enderecos/{id} DELETE)."""
    if current_user.perfil.nome != PerfilNome.CLIENTE.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    result = await db.execute(select(Endereco).where(Endereco.id == endereco_id))
    endereco = result.scalar_one_or_none()
    if not endereco:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Address not found"
        )

    if endereco.usuario_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    await db.delete(endereco)
    await db.commit()