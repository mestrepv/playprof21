"""
Pydantic schemas de domínio. Todos usam from_attributes=True.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# ── Classroom ───────────────────────────────────────────────────────────────

class ClassroomIn(BaseModel):
    name: str = Field(min_length=1, max_length=160)


class ClassroomOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    owner_id: uuid.UUID
    name: str
    created_at: datetime


# ── Track ───────────────────────────────────────────────────────────────────

class TrackIn(BaseModel):
    classroom_id: uuid.UUID
    name: str = Field(min_length=1, max_length=160)
    order: int = 0


class TrackPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    order: int | None = None


class TrackOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    classroom_id: uuid.UUID
    name: str
    order: int
    created_at: datetime


# ── Collection ──────────────────────────────────────────────────────────────

class CollectionIn(BaseModel):
    track_id: uuid.UUID
    name: str = Field(min_length=1, max_length=160)
    order: int = 0


class CollectionPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    order: int | None = None


class CollectionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    track_id: uuid.UUID
    name: str
    order: int
    created_at: datetime


# ── Lesson ──────────────────────────────────────────────────────────────────

class LessonIn(BaseModel):
    collection_id: uuid.UUID
    slug: str = Field(min_length=1, max_length=120)
    title: str | None = Field(default=None, max_length=200)
    order: int = 0


class LessonPatch(BaseModel):
    slug: str | None = Field(default=None, min_length=1, max_length=120)
    title: str | None = Field(default=None, max_length=200)
    order: int | None = None


class LessonOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    collection_id: uuid.UUID
    slug: str
    title: str | None
    order: int
    created_at: datetime
