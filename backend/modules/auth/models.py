"""
Modelo User — compartilhado entre professor e aluno.

Professor:
  - role = "teacher"
  - email + password_hash obrigatórios
  - pode possuir turmas, trilhas, coleções, aulas (FK owner_id)

Aluno anônimo (criado na Fase 5 via código de sessão):
  - role = "student"
  - email = NULL, password_hash = NULL
  - display_name é a única identificação

Único nível de permissão na Fase 3: teacher vê só o que criou. Admin/staff
roles ficam pra quando aparecer necessidade real.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="teacher")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
