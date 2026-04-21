"""
Dependências FastAPI de auth.

`get_current_user` lê o bearer token do Authorization header, decodifica e
devolve o User do banco. Retorna 401 em qualquer falha (ausente, inválido,
user sumiu do banco).

`require_teacher` wrapper: igual a `get_current_user` mas garante role.
"""

from __future__ import annotations

import uuid

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from database import get_db

from .models import User
from .security import decode_access_token


_UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="não autenticado",
    headers={"WWW-Authenticate": "Bearer"},
)


def _extract_token(request: Request) -> str:
    header = request.headers.get("Authorization") or request.headers.get("authorization")
    if not header or not header.lower().startswith("bearer "):
        raise _UNAUTHORIZED
    return header[7:].strip()


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = _extract_token(request)
    payload = decode_access_token(token)
    if payload is None:
        raise _UNAUTHORIZED
    sub = payload.get("sub")
    if not sub:
        raise _UNAUTHORIZED
    try:
        user_id = uuid.UUID(sub)
    except ValueError:
        raise _UNAUTHORIZED
    user = db.get(User, user_id)
    if user is None:
        raise _UNAUTHORIZED
    return user


def require_teacher(user: User = Depends(get_current_user)) -> User:
    if user.role != "teacher":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="rota só pra professor")
    return user
