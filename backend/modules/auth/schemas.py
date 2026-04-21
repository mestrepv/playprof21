"""
Pydantic schemas de auth.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=120)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class MePatch(BaseModel):
    """Edição do próprio usuário — apenas display_name no dev-mode.
    Email não é editável por ora (Paulo pode adicionar no futuro);
    password change fica pra quando tiver tela de troca dedicada."""
    display_name: str | None = Field(default=None, min_length=1, max_length=120)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str | None
    display_name: str
    role: str
    created_at: datetime


TokenOut.model_rebuild()
