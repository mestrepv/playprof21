"""
Rotas CRUD do domínio — banco de conteúdos + turmas + atribuições.

Isolamento: toda leitura/escrita é filtrada pelo owner_id do teacher logado.
Acesso cross-user devolve 404 (não vaza existência).

Endpoints (todos sob /api, exigem teacher):

  # Turmas
  GET/POST   /api/classrooms
  GET/PATCH/DELETE /api/classrooms/{id}
  GET        /api/classrooms/{id}/assignments   — lista expandida

  # Banco de conteúdos
  GET/POST   /api/activities
  GET/PATCH/DELETE /api/activities/{id}

  GET/POST   /api/trails
  GET/PATCH/DELETE /api/trails/{id}
  GET        /api/trails/{id}/activities        — lista ordenada (activities completas)
  POST       /api/trails/{id}/activities        — adiciona activity na trilha
  DELETE     /api/trails/{id}/activities/{aid}  — remove da trilha (não apaga activity)
  PUT        /api/trails/{id}/order             — reordena (body: [activity_ids])

  GET/POST   /api/interactive-lessons
  GET/PATCH/DELETE /api/interactive-lessons/{id}

  # Atribuições
  POST       /api/assignments
  PATCH      /api/assignments/{id}
  DELETE     /api/assignments/{id}
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db

from ..auth.deps import require_teacher
from ..auth.models import User
from ..auth.security import create_access_token
from ..live.join import RateLimiter, client_ip, random_code
from .models import (
    ASSIGNMENT_CONTENT_TYPES,
    Activity,
    ActivityResult,  # noqa: F401 — declarada pro create_all
    Assignment,
    Classroom,
    Enrollment,
    InteractiveLesson,
    Trail,
    TrailActivity,
)
from .schemas import (
    ACTIVITY_KINDS,
    ActivityIn,
    ActivityOut,
    ActivityPatch,
    AssignmentExpanded,
    AssignmentIn,
    AssignmentOut,
    AssignmentPatch,
    ClassroomCodeOut,
    ClassroomIn,
    ClassroomJoinIn,
    ClassroomJoinOut,
    ClassroomOut,
    InteractiveLessonIn,
    InteractiveLessonOut,
    InteractiveLessonPatch,
    TrailActivityIn,
    TrailIn,
    TrailOut,
    TrailPatch,
)


# Gerador de código de turma — análogo ao de sessão mas escopado em classrooms.
_CODE_MAX_ATTEMPTS = 25


def _generate_classroom_code(db: Session) -> str:
    for _ in range(_CODE_MAX_ATTEMPTS):
        c = random_code()
        existing = db.scalar(select(Classroom.id).where(Classroom.code == c))
        if existing is None:
            return c
    raise RuntimeError("falha ao gerar código único da turma")


# Rate-limit do join público — mais generoso que sessões (aluno pode estar
# numa aula buscando vários códigos antigos), mas protege contra brute-force.
classroom_join_limiter = RateLimiter(max_events=20, window_seconds=60)


router = APIRouter(tags=["domain"])


# ═══════════════════════════════════════════════════════════════════════════
# Helpers de ownership — cada tabela do banco filtra por owner_id
# ═══════════════════════════════════════════════════════════════════════════

def _own_classroom(db: Session, cid: uuid.UUID, user: User) -> Classroom:
    c = db.get(Classroom, cid)
    if c is None or c.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "turma não encontrada")
    return c


def _own_activity(db: Session, aid: uuid.UUID, user: User) -> Activity:
    a = db.get(Activity, aid)
    if a is None or a.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "atividade não encontrada")
    return a


def _own_trail(db: Session, tid: uuid.UUID, user: User) -> Trail:
    t = db.get(Trail, tid)
    if t is None or t.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "trilha não encontrada")
    return t


def _own_interactive_lesson(db: Session, lid: uuid.UUID, user: User) -> InteractiveLesson:
    i = db.get(InteractiveLesson, lid)
    if i is None or i.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "aula interativa não encontrada")
    return i


def _own_assignment(db: Session, aid: uuid.UUID, user: User) -> Assignment:
    a = db.get(Assignment, aid)
    if a is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "atribuição não encontrada")
    _own_classroom(db, a.classroom_id, user)
    return a


def _resolve_content(db: Session, content_type: str, content_id: uuid.UUID, user: User) -> Activity | Trail | InteractiveLesson:
    if content_type == "activity":
        return _own_activity(db, content_id, user)
    if content_type == "trail":
        return _own_trail(db, content_id, user)
    if content_type == "interactive_lesson":
        return _own_interactive_lesson(db, content_id, user)
    raise HTTPException(status.HTTP_400_BAD_REQUEST, f"content_type '{content_type}' inválido")


# ═══════════════════════════════════════════════════════════════════════════
# Classrooms
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/api/classrooms", response_model=list[ClassroomOut])
def list_classrooms(user: User = Depends(require_teacher), db: Session = Depends(get_db)) -> list[Classroom]:
    stmt = select(Classroom).where(Classroom.owner_id == user.id).order_by(Classroom.created_at.desc())
    return list(db.scalars(stmt).all())


@router.post("/api/classrooms", response_model=ClassroomOut, status_code=status.HTTP_201_CREATED)
def create_classroom(payload: ClassroomIn, user: User = Depends(require_teacher), db: Session = Depends(get_db)) -> Classroom:
    c = Classroom(owner_id=user.id, name=payload.name.strip(), code=_generate_classroom_code(db))
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.post("/api/classrooms/{cid}/code/rotate", response_model=ClassroomCodeOut)
def rotate_classroom_code(
    cid: uuid.UUID,
    user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> ClassroomCodeOut:
    c = _own_classroom(db, cid, user)
    c.code = _generate_classroom_code(db)
    db.commit()
    return ClassroomCodeOut(code=c.code)


@router.post("/api/classrooms/join", response_model=ClassroomJoinOut)
def join_classroom(
    payload: ClassroomJoinIn,
    request: Request,
    db: Session = Depends(get_db),
) -> ClassroomJoinOut:
    """Público. Cria (ou reutiliza via cookie/token se chegar isso depois) um
    User anônimo de role='student' + Enrollment. Devolve JWT pro cliente
    persistir. Fase 6 mantém sempre anonimo-new; integrar OAuth na 6.1."""
    classroom_join_limiter.check(client_ip(request))

    c = db.scalar(select(Classroom).where(Classroom.code == payload.code))
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "código inválido")

    name = payload.display_name.strip()[:120]
    # Cria um novo usuário student cada vez. Cliente que já tem JWT e só quer
    # adicionar enrollment chama um endpoint separado (a criar quando precisar).
    student = User(
        email=None,
        password_hash=None,
        display_name=name,
        role="student",
    )
    db.add(student)
    db.flush()  # pega o id

    # Idempotente via uq_enrollments_user_classroom — mas user é novo então
    # não haverá colisão aqui. Só passamos direto.
    e = Enrollment(user_id=student.id, classroom_id=c.id)
    db.add(e)
    db.commit()
    db.refresh(student)

    token = create_access_token(user_id=student.id, role=student.role)
    return ClassroomJoinOut(
        classroom_id=c.id,
        classroom_name=c.name,
        access_token=token,
        user_id=student.id,
        display_name=student.display_name,
    )


@router.get("/api/classrooms/{cid}", response_model=ClassroomOut)
def get_classroom(cid: uuid.UUID, user: User = Depends(require_teacher), db: Session = Depends(get_db)) -> Classroom:
    return _own_classroom(db, cid, user)


@router.patch("/api/classrooms/{cid}", response_model=ClassroomOut)
def update_classroom(cid: uuid.UUID, payload: ClassroomIn, user: User = Depends(require_teacher), db: Session = Depends(get_db)) -> Classroom:
    c = _own_classroom(db, cid, user)
    c.name = payload.name.strip()
    db.commit()
    db.refresh(c)
    return c


@router.delete("/api/classrooms/{cid}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_classroom(cid: uuid.UUID, user: User = Depends(require_teacher), db: Session = Depends(get_db)) -> Response:
    c = _own_classroom(db, cid, user)
    db.delete(c)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/api/classrooms/{cid}/assignments", response_model=list[AssignmentExpanded])
def list_classroom_assignments(
    cid: uuid.UUID,
    user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> list[AssignmentExpanded]:
    _own_classroom(db, cid, user)
    stmt = (
        select(Assignment)
        .where(Assignment.classroom_id == cid)
        .order_by(Assignment.position, Assignment.created_at)
    )
    assigns = list(db.scalars(stmt).all())

    # Pré-resolve content pra evitar N+1.
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
# Activities (banco)
# ═══════════════════════════════════════════════════════════════════════════

def _validate_kind(kind: str) -> None:
    if kind not in ACTIVITY_KINDS:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"kind '{kind}' inválido. Válidos: {sorted(ACTIVITY_KINDS)}",
        )


@router.get("/api/activities", response_model=list[ActivityOut])
def list_activities(user: User = Depends(require_teacher), db: Session = Depends(get_db)) -> list[Activity]:
    stmt = select(Activity).where(Activity.owner_id == user.id).order_by(Activity.created_at.desc())
    return list(db.scalars(stmt).all())


@router.post("/api/activities", response_model=ActivityOut, status_code=status.HTTP_201_CREATED)
def create_activity(payload: ActivityIn, user: User = Depends(require_teacher), db: Session = Depends(get_db)) -> Activity:
    _validate_kind(payload.kind)
    a = Activity(
        owner_id=user.id,
        title=payload.title.strip(),
        kind=payload.kind,
        config=payload.config,
        max_score=payload.max_score,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


@router.get("/api/activities/{aid}", response_model=ActivityOut)
def get_activity(aid: uuid.UUID, user: User = Depends(require_teacher), db: Session = Depends(get_db)) -> Activity:
    return _own_activity(db, aid, user)


@router.patch("/api/activities/{aid}", response_model=ActivityOut)
def update_activity(aid: uuid.UUID, payload: ActivityPatch, user: User = Depends(require_teacher), db: Session = Depends(get_db)) -> Activity:
    a = _own_activity(db, aid, user)
    if payload.title is not None:
        a.title = payload.title.strip()
    if payload.kind is not None:
        _validate_kind(payload.kind)
        a.kind = payload.kind
    if payload.config is not None:
        a.config = payload.config
    if payload.max_score is not None:
        a.max_score = payload.max_score
    db.commit()
    db.refresh(a)
    return a


@router.delete("/api/activities/{aid}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_activity(aid: uuid.UUID, user: User = Depends(require_teacher), db: Session = Depends(get_db)) -> Response:
    a = _own_activity(db, aid, user)
    db.delete(a)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ═══════════════════════════════════════════════════════════════════════════
# Trails (banco) + trail_activities
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/api/trails", response_model=list[TrailOut])
def list_trails(user: User = Depends(require_teacher), db: Session = Depends(get_db)) -> list[Trail]:
    stmt = select(Trail).where(Trail.owner_id == user.id).order_by(Trail.created_at.desc())
    return list(db.scalars(stmt).all())


@router.post("/api/trails", response_model=TrailOut, status_code=status.HTTP_201_CREATED)
def create_trail(payload: TrailIn, user: User = Depends(require_teacher), db: Session = Depends(get_db)) -> Trail:
    t = Trail(
        owner_id=user.id,
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


@router.get("/api/trails/{tid}", response_model=TrailOut)
def get_trail(tid: uuid.UUID, user: User = Depends(require_teacher), db: Session = Depends(get_db)) -> Trail:
    return _own_trail(db, tid, user)


@router.patch("/api/trails/{tid}", response_model=TrailOut)
def update_trail(tid: uuid.UUID, payload: TrailPatch, user: User = Depends(require_teacher), db: Session = Depends(get_db)) -> Trail:
    t = _own_trail(db, tid, user)
    if payload.title is not None:
        t.title = payload.title.strip()
    if payload.description is not None:
        t.description = payload.description.strip() or None
    db.commit()
    db.refresh(t)
    return t


@router.delete("/api/trails/{tid}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_trail(tid: uuid.UUID, user: User = Depends(require_teacher), db: Session = Depends(get_db)) -> Response:
    t = _own_trail(db, tid, user)
    db.delete(t)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/api/trails/{tid}/activities", response_model=list[ActivityOut])
def list_trail_activities(tid: uuid.UUID, user: User = Depends(require_teacher), db: Session = Depends(get_db)) -> list[Activity]:
    _own_trail(db, tid, user)
    stmt = (
        select(Activity)
        .join(TrailActivity, TrailActivity.activity_id == Activity.id)
        .where(TrailActivity.trail_id == tid)
        .order_by(TrailActivity.position, TrailActivity.id)
    )
    return list(db.scalars(stmt).all())


@router.post("/api/trails/{tid}/activities", status_code=status.HTTP_201_CREATED)
def add_trail_activity(tid: uuid.UUID, payload: TrailActivityIn, user: User = Depends(require_teacher), db: Session = Depends(get_db)) -> dict:
    _own_trail(db, tid, user)
    _own_activity(db, payload.activity_id, user)  # só pode adicionar activities próprias
    existing = db.scalar(
        select(TrailActivity).where(
            TrailActivity.trail_id == tid,
            TrailActivity.activity_id == payload.activity_id,
        )
    )
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "atividade já está na trilha")
    ta = TrailActivity(trail_id=tid, activity_id=payload.activity_id, position=payload.position)
    db.add(ta)
    db.commit()
    db.refresh(ta)
    return {"trail_id": str(tid), "activity_id": str(payload.activity_id), "position": ta.position}


@router.delete("/api/trails/{tid}/activities/{aid}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def remove_trail_activity(tid: uuid.UUID, aid: uuid.UUID, user: User = Depends(require_teacher), db: Session = Depends(get_db)) -> Response:
    _own_trail(db, tid, user)
    ta = db.scalar(select(TrailActivity).where(TrailActivity.trail_id == tid, TrailActivity.activity_id == aid))
    if ta is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "ligação trilha↔atividade não encontrada")
    db.delete(ta)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/api/trails/{tid}/order", response_model=list[ActivityOut])
def reorder_trail(tid: uuid.UUID, activity_ids: list[uuid.UUID], user: User = Depends(require_teacher), db: Session = Depends(get_db)) -> list[Activity]:
    """Body: lista de activity_ids na ordem desejada. Activities não listadas ficam no fim."""
    _own_trail(db, tid, user)
    tas = list(db.scalars(select(TrailActivity).where(TrailActivity.trail_id == tid)).all())
    by_act = {ta.activity_id: ta for ta in tas}
    next_pos = 0
    seen: set[uuid.UUID] = set()
    for act_id in activity_ids:
        ta = by_act.get(act_id)
        if ta is None:
            continue
        ta.position = next_pos
        next_pos += 1
        seen.add(act_id)
    # Activities que não vieram no payload mantêm ordem relativa mas ficam no fim.
    for ta in sorted(tas, key=lambda x: (x.position, x.id)):
        if ta.activity_id in seen:
            continue
        ta.position = next_pos
        next_pos += 1
    db.commit()
    return list_trail_activities(tid, user, db)


# ═══════════════════════════════════════════════════════════════════════════
# Interactive Lessons (banco)
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/api/interactive-lessons", response_model=list[InteractiveLessonOut])
def list_interactive_lessons(user: User = Depends(require_teacher), db: Session = Depends(get_db)) -> list[InteractiveLesson]:
    stmt = select(InteractiveLesson).where(InteractiveLesson.owner_id == user.id).order_by(InteractiveLesson.created_at.desc())
    return list(db.scalars(stmt).all())


@router.post("/api/interactive-lessons", response_model=InteractiveLessonOut, status_code=status.HTTP_201_CREATED)
def create_interactive_lesson(payload: InteractiveLessonIn, user: User = Depends(require_teacher), db: Session = Depends(get_db)) -> InteractiveLesson:
    il = InteractiveLesson(owner_id=user.id, title=payload.title.strip(), slug=payload.slug.strip())
    db.add(il)
    db.commit()
    db.refresh(il)
    return il


@router.get("/api/interactive-lessons/{lid}", response_model=InteractiveLessonOut)
def get_interactive_lesson(lid: uuid.UUID, user: User = Depends(require_teacher), db: Session = Depends(get_db)) -> InteractiveLesson:
    return _own_interactive_lesson(db, lid, user)


@router.patch("/api/interactive-lessons/{lid}", response_model=InteractiveLessonOut)
def update_interactive_lesson(lid: uuid.UUID, payload: InteractiveLessonPatch, user: User = Depends(require_teacher), db: Session = Depends(get_db)) -> InteractiveLesson:
    il = _own_interactive_lesson(db, lid, user)
    if payload.title is not None:
        il.title = payload.title.strip()
    if payload.slug is not None:
        il.slug = payload.slug.strip()
    db.commit()
    db.refresh(il)
    return il


@router.delete("/api/interactive-lessons/{lid}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_interactive_lesson(lid: uuid.UUID, user: User = Depends(require_teacher), db: Session = Depends(get_db)) -> Response:
    il = _own_interactive_lesson(db, lid, user)
    db.delete(il)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ═══════════════════════════════════════════════════════════════════════════
# Assignments — link banco→turma
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/api/classrooms/{cid}/assignments", response_model=AssignmentOut, status_code=status.HTTP_201_CREATED)
def create_assignment(cid: uuid.UUID, payload: AssignmentIn, user: User = Depends(require_teacher), db: Session = Depends(get_db)) -> Assignment:
    _own_classroom(db, cid, user)
    if payload.content_type not in ASSIGNMENT_CONTENT_TYPES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"content_type '{payload.content_type}' inválido")
    # Valida que o content referenciado existe e é do professor.
    _resolve_content(db, payload.content_type, payload.content_id, user)

    existing = db.scalar(
        select(Assignment).where(
            Assignment.classroom_id == cid,
            Assignment.content_type == payload.content_type,
            Assignment.content_id == payload.content_id,
        )
    )
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "conteúdo já atribuído a essa turma")

    a = Assignment(
        classroom_id=cid,
        content_type=payload.content_type,
        content_id=payload.content_id,
        position=payload.position,
        due_at=payload.due_at,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


@router.patch("/api/assignments/{aid}", response_model=AssignmentOut)
def update_assignment(aid: uuid.UUID, payload: AssignmentPatch, user: User = Depends(require_teacher), db: Session = Depends(get_db)) -> Assignment:
    a = _own_assignment(db, aid, user)
    if payload.position is not None:
        a.position = payload.position
    if payload.due_at is not None:
        a.due_at = payload.due_at
    db.commit()
    db.refresh(a)
    return a


@router.delete("/api/assignments/{aid}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_assignment(aid: uuid.UUID, user: User = Depends(require_teacher), db: Session = Depends(get_db)) -> Response:
    a = _own_assignment(db, aid, user)
    db.delete(a)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
