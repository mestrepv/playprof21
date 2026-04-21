"""
Rotas do aluno autenticado (role='student') — dashboard e visualização
de turmas em que está matriculado.

Escopo da Fase 6: listar turmas, listar assignments. Runtime de trilha
assíncrona (abrir trilha, fazer atividade, gravar resultado) entra na
Fase 7.

Autorização: usa `get_current_user` direto (sem `require_student`) pra
permitir que o professor também acesse essas rotas em modo debug — se
aparecer necessidade real de restrição, endurecemos depois.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db

from ..auth.deps import get_current_user
from ..auth.models import User
from .models import (
    Activity,
    Assignment,
    Classroom,
    Enrollment,
    InteractiveLesson,
    Trail,
)
from .schemas import (
    ActivityOut,
    AssignmentExpanded,
    AssignmentOut,
    ClassroomOut,
    InteractiveLessonOut,
    TrailOut,
)


router = APIRouter(prefix="/api/student", tags=["student"])


def _enrolled_or_404(db: Session, user: User, classroom_id: uuid.UUID) -> Classroom:
    """Aluno: precisa ter enrollment. Professor dono: tem acesso também."""
    c = db.get(Classroom, classroom_id)
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "turma não encontrada")
    if c.owner_id == user.id:
        return c
    enrolled = db.scalar(
        select(Enrollment).where(
            Enrollment.user_id == user.id,
            Enrollment.classroom_id == c.id,
        )
    )
    if enrolled is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "turma não encontrada")
    return c


@router.get("/classrooms", response_model=list[ClassroomOut])
def list_student_classrooms(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[Classroom]:
    stmt = (
        select(Classroom)
        .join(Enrollment, Enrollment.classroom_id == Classroom.id)
        .where(Enrollment.user_id == user.id)
        .order_by(Enrollment.joined_at.desc())
    )
    return list(db.scalars(stmt).all())


@router.get("/classrooms/{cid}/assignments", response_model=list[AssignmentExpanded])
def list_student_assignments(
    cid: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[AssignmentExpanded]:
    _enrolled_or_404(db, user, cid)
    stmt = (
        select(Assignment)
        .where(Assignment.classroom_id == cid)
        .order_by(Assignment.position, Assignment.created_at)
    )
    assigns = list(db.scalars(stmt).all())

    # Reaproveita a expansão do teacher router (mesma lógica de evitar N+1).
    act_ids = {a.content_id for a in assigns if a.content_type == "activity"}
    tr_ids = {a.content_id for a in assigns if a.content_type == "trail"}
    il_ids = {a.content_id for a in assigns if a.content_type == "interactive_lesson"}

    acts = {a.id: a for a in db.scalars(select(Activity).where(Activity.id.in_(act_ids))).all()} if act_ids else {}
    trs = {t.id: t for t in db.scalars(select(Trail).where(Trail.id.in_(tr_ids))).all()} if tr_ids else {}
    ils = {i.id: i for i in db.scalars(select(InteractiveLesson).where(InteractiveLesson.id.in_(il_ids))).all()} if il_ids else {}

    out: list[AssignmentExpanded] = []
    for a in assigns:
        exp = AssignmentExpanded(assignment=AssignmentOut.model_validate(a))
        if a.content_type == "activity":
            act = acts.get(a.content_id)
            if act is not None:
                exp.activity = ActivityOut.model_validate(act)
        elif a.content_type == "trail":
            tr = trs.get(a.content_id)
            if tr is not None:
                exp.trail = TrailOut.model_validate(tr)
        elif a.content_type == "interactive_lesson":
            il = ils.get(a.content_id)
            if il is not None:
                exp.interactive_lesson = InteractiveLessonOut.model_validate(il)
        out.append(exp)
    return out
