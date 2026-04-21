"""
Schemas Pydantic da Fase 4.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


InteractionMode = Literal["free", "master-led"]
SessionStatus = Literal["idle", "live", "ended"]
Role = Literal["master", "player"]


class SessionCreateIn(BaseModel):
    interactive_lesson_id: uuid.UUID


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    interactive_lesson_id: uuid.UUID
    master_user_id: uuid.UUID
    current_slide_index: int
    current_activity_id: str | None
    interaction_mode: str
    status: str
    created_at: datetime
    started_at: datetime | None
    ended_at: datetime | None


class MembershipOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    display_name: str
    role: str


class SessionSnapshot(BaseModel):
    """Estado mandado no handshake do WS e também servido pela rota REST
    GET /api/lab/sessions/{id} (útil pra debug / reconectar)."""
    session: SessionOut
    # gameSlug + title preenchidos do lado server pra evitar 2 round-trips no client.
    game_slug: str
    game_title: str
    participants: list[MembershipOut]
    my_membership: MembershipOut | None = None
    my_role: Role = "player"
