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
    ActivityResult,
    Assignment,
    Classroom,
    Enrollment,
    InteractiveLesson,
    Trail,
    TrailActivity,
)
from .schemas import (
    ActivityOut,
    ActivityResultIn,
    ActivityResultOut,
    AssignmentExpanded,
    AssignmentOut,
    ClassroomOut,
    InteractiveLessonOut,
    TrailNode,
    TrailOut,
    TrailProgress,
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


# ═══════════════════════════════════════════════════════════════════════════
# Progresso de trilha (Fase 7)
# ═══════════════════════════════════════════════════════════════════════════

def _stars(score: int, max_score: int) -> int:
    """3 estrelas se ≥100%, 2 se ≥75%, 1 se >0, 0 caso contrário. Espelha o
    cálculo do play.prof21 legado pra manter familiaridade."""
    if max_score <= 0 or score <= 0:
        return 0
    ratio = score / max_score
    if ratio >= 1.0:
        return 3
    if ratio >= 0.75:
        return 2
    return 1


def _user_has_access_to_trail(db: Session, user: User, trail: Trail) -> bool:
    """Aluno vê a trilha se estiver matriculado numa turma que a atribui.
    Dono da trilha (professor) sempre vê (modo preview)."""
    if trail.owner_id == user.id:
        return True
    # Existe algum assignment(content=trail) numa classroom em que user está enrolled?
    from .models import Assignment as A  # local import pra legibilidade
    stmt = (
        select(A.id)
        .join(Enrollment, Enrollment.classroom_id == A.classroom_id)
        .where(
            A.content_type == "trail",
            A.content_id == trail.id,
            Enrollment.user_id == user.id,
        )
        .limit(1)
    )
    return db.scalar(stmt) is not None


def _load_trail_progress(db: Session, user: User, trail: Trail) -> TrailProgress:
    """Monta TrailProgress: activities ordenadas + melhor resultado por activity
    + status lock/available/completed."""
    # activities ordenadas por trail_activities.position
    pairs = list(
        db.execute(
            select(Activity, TrailActivity.position)
            .join(TrailActivity, TrailActivity.activity_id == Activity.id)
            .where(TrailActivity.trail_id == trail.id)
            .order_by(TrailActivity.position, TrailActivity.id)
        ).all()
    )

    # melhores resultados por activity
    act_ids = [a.id for a, _pos in pairs]
    bests: dict[uuid.UUID, ActivityResult] = {}
    if act_ids:
        rows = db.scalars(
            select(ActivityResult).where(
                ActivityResult.user_id == user.id,
                ActivityResult.activity_id.in_(act_ids),
                ActivityResult.is_best == True,  # noqa: E712 — SQL boolean literal
            )
        ).all()
        for r in rows:
            bests[r.activity_id] = r

    nodes: list[TrailNode] = []
    prev_completed = True  # primeiro é sempre available
    for activity, position in pairs:
        best = bests.get(activity.id)
        completed = best is not None and best.score >= activity.max_score * 0.5
        # "completed" pra efeito de desbloqueio = ≥50% do max. Estrelas são 3-patamar
        # separado. Trade-off pragmático: aluno que tirou 0 não completou, mas quem
        # tirou metade libera o próximo. Rever na Fase 9 se aluno real achar estranho.
        if completed:
            status_ = "completed"
        elif prev_completed:
            status_ = "available"
        else:
            status_ = "locked"
        nodes.append(
            TrailNode(
                activity=ActivityOut.model_validate(activity),
                position=position,
                status=status_,
                best_score=best.score if best else None,
                best_max_score=best.max_score if best else None,
                stars=_stars(best.score, best.max_score) if best else 0,
            )
        )
        prev_completed = completed

    return TrailProgress(trail=TrailOut.model_validate(trail), nodes=nodes)


@router.get("/trails/{tid}", response_model=TrailProgress)
def get_trail_progress(
    tid: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TrailProgress:
    trail = db.get(Trail, tid)
    if trail is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "trilha não encontrada")
    if not _user_has_access_to_trail(db, user, trail):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "trilha não encontrada")
    return _load_trail_progress(db, user, trail)


@router.get("/activities/{aid}", response_model=ActivityOut)
def get_activity_for_play(
    aid: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Activity:
    """Resolve uma activity pelo id. Aluno só vê se alguma trilha à qual ele
    tem acesso referencia essa activity; professor dono passa direto."""
    a = db.get(Activity, aid)
    if a is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "atividade não encontrada")
    if a.owner_id == user.id:
        return a
    # aluno: precisa de trilha em que ele tem acesso que contenha essa activity
    stmt = (
        select(TrailActivity.trail_id)
        .join(Trail, Trail.id == TrailActivity.trail_id)
        .where(TrailActivity.activity_id == aid)
    )
    candidate_trails = list(db.scalars(stmt).all())
    if any(_user_has_access_to_trail(db, user, db.get(Trail, tid)) for tid in candidate_trails if db.get(Trail, tid) is not None):
        return a
    raise HTTPException(status.HTTP_404_NOT_FOUND, "atividade não encontrada")


@router.post("/activity-results", response_model=ActivityResultOut, status_code=status.HTTP_201_CREATED)
def record_activity_result(
    payload: ActivityResultIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ActivityResult:
    activity = db.get(Activity, payload.activity_id)
    if activity is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "atividade não encontrada")
    # Autorização: aluno precisa ter acesso via trilha; dono passa
    if activity.owner_id != user.id:
        stmt = (
            select(TrailActivity.trail_id)
            .where(TrailActivity.activity_id == activity.id)
        )
        trail_ids = list(db.scalars(stmt).all())
        authorized = False
        for tid in trail_ids:
            tr = db.get(Trail, tid)
            if tr is not None and _user_has_access_to_trail(db, user, tr):
                authorized = True
                break
        if not authorized:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "atividade não encontrada")

    # is_best: se não existe nenhum ou se este score é >= do anterior melhor
    prev_best = db.scalar(
        select(ActivityResult)
        .where(
            ActivityResult.user_id == user.id,
            ActivityResult.activity_id == activity.id,
            ActivityResult.is_best == True,  # noqa: E712
        )
    )
    is_best = prev_best is None or payload.score > prev_best.score
    if is_best and prev_best is not None:
        prev_best.is_best = False

    row = ActivityResult(
        user_id=user.id,
        activity_id=activity.id,
        score=payload.score,
        max_score=payload.max_score or activity.max_score,
        is_best=is_best,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
