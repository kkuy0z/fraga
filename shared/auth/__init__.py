"""
Shared authentication utilities: JWT tokens, Argon2id password hashing.
"""
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from jose import jwt, JWTError
from passlib.context import CryptContext
from shared.schemas import TokenData, PerfilNome

# JWT Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "fraga-super-secret-jwt-key-2026-change-in-production")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))
JWT_REFRESH_EXPIRE_DAYS = int(os.getenv("JWT_REFRESH_EXPIRE_DAYS", "30"))

# Argon2id Configuration
ARGON2_TIME_COST = int(os.getenv("ARGON2_TIME_COST", "3"))
ARGON2_MEMORY_COST = int(os.getenv("ARGON2_MEMORY_COST", "65536"))
ARGON2_PARALLELISM = int(os.getenv("ARGON2_PARALLELISM", "4"))

# Password hashing context with Argon2id
pwd_context = CryptContext(
    schemes=["argon2"],
    default="argon2",
    argon2__time_cost=ARGON2_TIME_COST,
    argon2__memory_cost=ARGON2_MEMORY_COST,
    argon2__parallelism=ARGON2_PARALLELISM,
    argon2__hash_len=32,
    argon2__salt_size=16,
)


def hash_password(password: str) -> str:
    """Hash a password using Argon2id."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its Argon2id hash."""
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False


def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None
) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: Dict[str, Any]) -> str:
    """Create a JWT refresh token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=JWT_REFRESH_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> Optional[TokenData]:
    """Decode and validate a JWT token."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            return None
        user_id = payload.get("sub")
        email = payload.get("email")
        perfil = payload.get("perfil")
        exp = payload.get("exp")
        if user_id is None or email is None or perfil is None:
            return None
        return TokenData(sub=str(user_id), email=email, perfil=PerfilNome(perfil), exp=exp)
    except JWTError:
        return None


def decode_refresh_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate a refresh token."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            return None
        return payload
    except JWTError:
        return None


def create_token_pair(user_id: int, email: str, perfil: PerfilNome) -> Dict[str, str]:
    """Create access and refresh token pair."""
    data = {"sub": str(user_id), "email": email, "perfil": perfil.value}
    access_token = create_access_token(data)
    refresh_token = create_refresh_token(data)
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": JWT_EXPIRE_MINUTES * 60,
    }


def verify_token_permissions(token_data: TokenData, required_perfis: list[PerfilNome]) -> bool:
    """Verify if token has required permissions."""
    return token_data.perfil in required_perfis


# Permission constants
PERFIS_ADMIN = [PerfilNome.ADMINISTRADOR]
PERFIS_ATENDIMENTO = [PerfilNome.ADMINISTRADOR, PerfilNome.ATENDENTE]
PERFIS_COZINHA = [PerfilNome.ADMINISTRADOR, PerfilNome.ATENDENTE, PerfilNome.COZINHA]
PERFIS_ENTREGADOR = [PerfilNome.ADMINISTRADOR, PerfilNome.ENTREGADOR]
PERFIS_INTERNOS = [PerfilNome.ADMINISTRADOR, PerfilNome.ATENDENTE, PerfilNome.COZINHA, PerfilNome.ENTREGADOR]
PERFIS_TODOS = [PerfilNome.ADMINISTRADOR, PerfilNome.ATENDENTE, PerfilNome.COZINHA, PerfilNome.ENTREGADOR, PerfilNome.CLIENTE]