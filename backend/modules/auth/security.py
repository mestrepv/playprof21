"""
Utilitários de segurança: hash de senha + JWT.

Secret vem de LABPROF21_JWT_SECRET (env). Em dev cai num default inseguro
(com warning no stderr) — produção tem que setar.

Algoritmo JWT: HS256. Access token expira em 7 dias (dev; apertamos em prod).
Não há refresh token — professor re-autentica quando expira. Simples e
suficiente pro caso de uso.
"""

from __future__ import annotations

import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
from jose import JWTError, jwt


_JWT_ALG = "HS256"
_JWT_TTL = timedelta(days=7)

_DEV_SECRET_DEFAULT = "dev-insecure-change-me-in-production"
_SECRET = os.environ.get("LABPROF21_JWT_SECRET") or _DEV_SECRET_DEFAULT
if _SECRET == _DEV_SECRET_DEFAULT:
    print(
        "[auth] WARN: usando JWT secret default (dev). "
        "Defina LABPROF21_JWT_SECRET em produção.",
        file=sys.stderr,
    )


# bcrypt tem limite de 72 bytes na senha. Pré-hash com SHA-256 hex (<72 ASCII
# chars) dá suporte a senhas longas sem truncamento silencioso. Trade-off:
# hashes ficam incompatíveis com `htpasswd` puro — aceitável, o banco é nosso.
import hashlib


def _prehash(plain: str) -> bytes:
    return hashlib.sha256(plain.encode("utf-8")).hexdigest().encode("ascii")


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(_prehash(plain), bcrypt.gensalt()).decode("ascii")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(_prehash(plain), hashed.encode("ascii"))
    except (ValueError, TypeError):
        return False


def create_access_token(*, user_id: uuid.UUID, role: str, extra: dict[str, Any] | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int((now + _JWT_TTL).timestamp()),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, _SECRET, algorithm=_JWT_ALG)


def decode_access_token(token: str) -> dict[str, Any] | None:
    try:
        return jwt.decode(token, _SECRET, algorithms=[_JWT_ALG])
    except JWTError:
        return None
