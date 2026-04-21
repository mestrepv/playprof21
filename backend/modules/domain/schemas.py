"""
Pydantic schemas do banco de conteúdos + turma + atribuições.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


Visibility = Literal["private", "shared", "public"]
ContentType = Literal["activity", "trail", "interactive_lesson"]


# ── Classroom ───────────────────────────────────────────────────────────────

class ClassroomIn(BaseModel):
    name: str = Field(min_length=1, max_length=160)


class ClassroomOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    owner_id: uuid.UUID
    name: str
    code: str | None
    created_at: datetime


class ClassroomCodeOut(BaseModel):
    code: str


class ClassroomJoinIn(BaseModel):
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    display_name: str = Field(min_length=1, max_length=120)


class ClassroomJoinOut(BaseModel):
    classroom_id: uuid.UUID
    classroom_name: str
    access_token: str
    token_type: str = "bearer"
    user_id: uuid.UUID
    display_name: str


# ── Activity ────────────────────────────────────────────────────────────────

ACTIVITY_KINDS = {"quiz", "external-link", "simulator", "animation"}


class ActivityIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    kind: str = Field(min_length=1, max_length=40)
    config: dict[str, Any] = Field(default_factory=dict)
    max_score: int = Field(default=10, ge=0, le=1000)


class ActivityPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    kind: str | None = Field(default=None, min_length=1, max_length=40)
    config: dict[str, Any] | None = None
    max_score: int | None = Field(default=None, ge=0, le=1000)


class ActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    owner_id: uuid.UUID
    title: str
    kind: str
    config: dict[str, Any]
    max_score: int
    visibility: str
    created_at: datetime


# ── Trail ───────────────────────────────────────────────────────────────────

class TrailIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)


class TrailPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)


class TrailOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    owner_id: uuid.UUID
    title: str
    description: str | None
    visibility: str
    created_at: datetime


class TrailActivityIn(BaseModel):
    activity_id: uuid.UUID
    position: int = 0


class TrailActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    trail_id: uuid.UUID
    activity_id: uuid.UUID
    position: int


class TrailWithActivities(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    trail: TrailOut
    activities: list[ActivityOut]  # na ordem de position


# ── InteractiveLesson ───────────────────────────────────────────────────────

class InteractiveLessonIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=120)


class InteractiveLessonPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    slug: str | None = Field(default=None, min_length=1, max_length=120)


class InteractiveLessonOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    owner_id: uuid.UUID
    title: str
    slug: str
    visibility: str
    created_at: datetime


# ── Assignment ──────────────────────────────────────────────────────────────

class AssignmentIn(BaseModel):
    content_type: ContentType
    content_id: uuid.UUID
    position: int = 0
    due_at: datetime | None = None


class AssignmentPatch(BaseModel):
    position: int | None = None
    due_at: datetime | None = None


class AssignmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    classroom_id: uuid.UUID
    content_type: str
    content_id: uuid.UUID
    position: int
    due_at: datetime | None
    created_at: datetime


class AssignmentExpanded(BaseModel):
    """Assignment + snapshot do content referenciado. Pré-resolvido na listagem
    pra evitar N+1 calls do frontend."""
    assignment: AssignmentOut
    activity: ActivityOut | None = None
    trail: TrailOut | None = None
    interactive_lesson: InteractiveLessonOut | None = None
