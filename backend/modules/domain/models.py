"""
Modelos de domínio — banco de conteúdos + turma + atribuições.

Inspirado no Moodle Content Bank + H5P: conteúdo vive separado da turma;
atribuições são "links" banco→turma. Editar no banco propaga pra todas as
turmas que referenciam (single source of truth).

Hierarquia:

    User (teacher)
      └ owns → {Activity, Trail, InteractiveLesson}   [banco de conteúdos]
      └ owns → Classroom
                 └ Assignment ─polimorfismo─→ {Activity | Trail | InteractiveLesson}
                 └ Enrollment ←→ User (student)
                 └ ActivityResult   [progresso por aluno por activity]

Trail é sequência de Activities via trail_activities (N:N com position).

Visibility start em 'private' (coluna pronta pra 'shared'/'public' depois).

Polimorfismo de Assignment: evitamos FK formal pra 3 tabelas (CHECK constraint
genérico em Postgres é chato) — valido em aplicação via content_type, que
casa com content_id. Quebras são detectadas no CRUD (404 se content_id não
existe na tabela apontada por content_type).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ═══════════════════════════════════════════════════════════════════════════
# Turma + enrollment
# ═══════════════════════════════════════════════════════════════════════════

class Classroom(Base):
    __tablename__ = "classrooms"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)


class Enrollment(Base):
    __tablename__ = "enrollments"
    __table_args__ = (
        UniqueConstraint("user_id", "classroom_id", name="uq_enrollments_user_classroom"),
    )

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    classroom_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("classrooms.id", ondelete="CASCADE"), nullable=False, index=True
    )
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)


# ═══════════════════════════════════════════════════════════════════════════
# Banco de conteúdos — Activity
# ═══════════════════════════════════════════════════════════════════════════
#
# Kinds iniciais (Fase 3):
#   quiz            — opções + resposta correta em config
#   external-link   — URL pra PlanckGo ou recurso externo
#   simulator       — stub (Fase 6+ com PlanckGo)
#   animation       — stub
#
# Kinds expandem sem migration (é só string). Frontend trata renderer por kind.

class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    kind: Mapped[str] = mapped_column(String(40), nullable=False)
    config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    max_score: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    visibility: Mapped[str] = mapped_column(String(16), nullable=False, default="private")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)


# ═══════════════════════════════════════════════════════════════════════════
# Banco de conteúdos — Trail + join ordenado com Activity
# ═══════════════════════════════════════════════════════════════════════════

class Trail(Base):
    __tablename__ = "trails"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    visibility: Mapped[str] = mapped_column(String(16), nullable=False, default="private")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)


class TrailActivity(Base):
    __tablename__ = "trail_activities"
    __table_args__ = (
        UniqueConstraint("trail_id", "activity_id", name="uq_trail_activities_pair"),
    )

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trail_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("trails.id", ondelete="CASCADE"), nullable=False, index=True
    )
    activity_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("activities.id", ondelete="CASCADE"), nullable=False, index=True
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


# ═══════════════════════════════════════════════════════════════════════════
# Banco de conteúdos — InteractiveLesson (referencia games_content/<slug>/)
# ═══════════════════════════════════════════════════════════════════════════

class InteractiveLesson(Base):
    __tablename__ = "interactive_lessons"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), nullable=False)
    visibility: Mapped[str] = mapped_column(String(16), nullable=False, default="private")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)


# ═══════════════════════════════════════════════════════════════════════════
# Atribuição — link polimórfico do banco pra turma
# ═══════════════════════════════════════════════════════════════════════════

ASSIGNMENT_CONTENT_TYPES = {"activity", "trail", "interactive_lesson"}


class Assignment(Base):
    __tablename__ = "assignments"
    __table_args__ = (
        UniqueConstraint(
            "classroom_id", "content_type", "content_id",
            name="uq_assignments_classroom_content",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    classroom_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("classrooms.id", ondelete="CASCADE"), nullable=False, index=True
    )
    content_type: Mapped[str] = mapped_column(String(30), nullable=False)
    content_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False, index=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)


# ═══════════════════════════════════════════════════════════════════════════
# Progresso do aluno — ActivityResult
# ═══════════════════════════════════════════════════════════════════════════

class ActivityResult(Base):
    __tablename__ = "activity_results"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    activity_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("activities.id", ondelete="CASCADE"), nullable=False, index=True
    )
    score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_best: Mapped[bool] = mapped_column(nullable=False, default=True)
    attempted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
