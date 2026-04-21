"""
Modelos do runtime ao vivo — sessão síncrona mestre↔alunos.

Portado do module_lab do rpgia (db_models.LabSession/Membership/Event),
adaptado pra ancorar em InteractiveLesson (banco de conteúdos) em vez de
game slug solto.

Fase 4 escopo: Session + Membership + Event. Quiz state/answers + scores
chegam numa iteração 4.1 quando mission TSX for portada.

Fluxo:
  1. Professor dono de uma InteractiveLesson atribuída cria Session
     (POST /api/lab/sessions). Status='idle'.
  2. Master abre /lab/session/:id?role=master → WS connect, vira live
     no primeiro setSlide.
  3. Players (alunos anônimos por enquanto) abrem /lab/session/:id?role=player
     &anonymous_user_id=<uuid>&display_name=<nome>.
  4. Master avança slide via WS 'setSlide' → broadcast pra todos.

Reconnect: WS handshake sempre manda sessionSnapshot com estado atual;
cliente tardio entra direto onde a turma está.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Session(Base):
    __tablename__ = "live_sessions"
    # Unique parcial: código só conflita entre sessões ativas. `ended` libera
    # o código pra reuso. Criado via ALTER + CREATE UNIQUE INDEX ... WHERE
    # porque SQLAlchemy pre-2.1 não tem API limpa pra partial unique no
    # __table_args__; o Postgres aceita normalmente.
    __table_args__ = (
        Index(
            "ix_live_sessions_code_active",
            "code",
            unique=True,
            postgresql_where="status <> 'ended' AND code IS NOT NULL",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    interactive_lesson_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("interactive_lessons.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    master_user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    current_slide_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    current_activity_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    # 'free' | 'master-led'. Default vem do slide corrente no manifest (se tiver).
    interaction_mode: Mapped[str] = mapped_column(String(16), nullable=False, default="free")
    # 'idle' | 'live' | 'ended'
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="idle")
    # Código humano-amigável pra join (6 dígitos). NULL em sessão já encerrada.
    code: Mapped[str | None] = mapped_column(String(6), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class SessionMembership(Base):
    """Uma linha por participação (master ou player). UUID anônimo pra
    aluno que entra sem conta — Fase 5 troca por JWT quando o fluxo de
    join por código aterrissar."""

    __tablename__ = "live_memberships"
    __table_args__ = (
        # Um user autenticado só pode ter uma membership por sessão.
        UniqueConstraint("session_id", "user_id", name="uq_live_membership_user"),
        # Mesmo pra anônimo (assumindo que o cliente persiste o anon_id em localStorage).
        UniqueConstraint("session_id", "anonymous_user_id", name="uq_live_membership_anon"),
    )

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("live_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    anonymous_user_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), nullable=True, index=True
    )
    role: Mapped[str] = mapped_column(String(16), nullable=False)  # 'master' | 'player'
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)


class SessionEvent(Base):
    """Log append-only de eventos. Telemetria + auditoria. Não é fonte
    de estado — o estado vive em Session/SessionMembership. Se um dia
    crescer demais, move pra tabela time-partitioned ou external sink."""

    __tablename__ = "live_events"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("live_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    membership_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("live_memberships.id", ondelete="SET NULL"), nullable=True
    )
    type: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    slide_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    activity_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False, index=True)
