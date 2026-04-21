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


class ClassroomStats(BaseModel):
    """Stats agregadas pra página da turma (4 cards)."""
    total_students: int
    total_activities: int  # total de assignments (qualquer content_type)
    assignments_by_type: dict[str, int]  # breakdown: activity/trail/interactive_lesson
    attempts_total: int  # activity_results is_best=true dos alunos matriculados nas activities alcançáveis
    attempts_expected: int  # sum(activities_in_trail_assignments) * total_students + activity_assignments_diretos * total_students
    attempts_pct: float  # attempts_total / attempts_expected × 100, 0 se denominador zero
    energy_total: int  # sum(score) dos activity_results is_best filtrados


class StudentStat(BaseModel):
    user_id: uuid.UUID
    display_name: str
    attempts_count: int
    attempts_expected: int
    attempts_pct: float
    energy: int


class EnrollmentMember(BaseModel):
    user_id: uuid.UUID
    display_name: str
    joined_at: datetime


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


# ── Activity results (Fase 7) ───────────────────────────────────────────────

class ActivityResultIn(BaseModel):
    activity_id: uuid.UUID
    score: int = Field(ge=0)
    max_score: int = Field(ge=0)
    payload: dict[str, Any] = Field(default_factory=dict)


class ActivityResultOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    activity_id: uuid.UUID
    user_id: uuid.UUID
    score: int
    max_score: int
    is_best: bool
    attempted_at: datetime


class TrailNode(BaseModel):
    """Activity dentro de uma trilha + melhor resultado do aluno.
    Não tem status lock/available — dentro da trilha a execução é linear.
    A UI usa isso só pra saber qual é a próxima (primeira sem best_score)
    e pra construir o resumo final."""
    activity: ActivityOut
    position: int
    best_score: int | None
    best_max_score: int | None


class TrailProgress(BaseModel):
    trail: TrailOut
    nodes: list[TrailNode]
    stars: int  # 0..3 agregado da trilha (média de best/max)
    activities_total: int
    activities_attempted: int
    completed: bool  # todas as activities têm ActivityResult


class TrailSummary(BaseModel):
    """Item da lista de trilhas do aluno — nó da árvore Duolingo."""
    trail: TrailOut
    classroom_id: uuid.UUID
    classroom_name: str
    position: int  # do assignment, pra ordenar
    activities_total: int
    activities_attempted: int
    stars: int  # 0..3
    status: Literal["locked", "available", "completed"]


class StudentInteractiveLessonItem(BaseModel):
    """Item da aba Aulas: aula interativa atribuída a uma turma do aluno."""
    interactive_lesson: InteractiveLessonOut
    classroom_id: uuid.UUID
    classroom_name: str


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
