"""
Rotas CRUD do domínio pedagógico (só professor).

Isolamento: toda leitura/escrita é filtrada pelo owner_id do professor logado.
Tracks/Collections/Lessons ganham escopo por join ascendente até Classroom.

Endpoints:

  /api/classrooms          GET list / POST create
  /api/classrooms/{id}     GET / PATCH / DELETE

  /api/tracks              GET ?classroom_id / POST
  /api/tracks/{id}         GET / PATCH / DELETE

  /api/collections         GET ?track_id / POST
  /api/collections/{id}    GET / PATCH / DELETE

  /api/lessons             GET ?collection_id / POST
  /api/lessons/{id}        GET / PATCH / DELETE

Validação do slug de Lesson contra o disco (games_content/) fica implícita —
professor pode referenciar slug inexistente; o preview da Fase 2 vai dar 404.
Trade-off consciente: manter o CRUD desacoplado do loader, não cascatear
validação cara em cada insert.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db

from ..auth.deps import require_teacher
from ..auth.models import User
from .models import Classroom, Collection, Lesson, Track
from .schemas import (
    ClassroomIn,
    ClassroomOut,
    CollectionIn,
    CollectionOut,
    CollectionPatch,
    LessonIn,
    LessonOut,
    LessonPatch,
    TrackIn,
    TrackOut,
    TrackPatch,
)


router = APIRouter(tags=["domain"])


# ═══════════════════════════════════════════════════════════════════════════
# Helpers de autorização — cada recurso resolve seu dono transitivamente
# ═══════════════════════════════════════════════════════════════════════════

def _owned_classroom(db: Session, cid: uuid.UUID, user: User) -> Classroom:
    c = db.get(Classroom, cid)
    if c is None or c.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="turma não encontrada")
    return c


def _owned_track(db: Session, tid: uuid.UUID, user: User) -> Track:
    t = db.get(Track, tid)
    if t is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="trilha não encontrada")
    _owned_classroom(db, t.classroom_id, user)
    return t


def _owned_collection(db: Session, cid: uuid.UUID, user: User) -> Collection:
    c = db.get(Collection, cid)
    if c is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="coleção não encontrada")
    _owned_track(db, c.track_id, user)
    return c


def _owned_lesson(db: Session, lid: uuid.UUID, user: User) -> Lesson:
    les = db.get(Lesson, lid)
    if les is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="aula não encontrada")
    _owned_collection(db, les.collection_id, user)
    return les


# ═══════════════════════════════════════════════════════════════════════════
# Classrooms
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/api/classrooms", response_model=list[ClassroomOut])
def list_classrooms(user: User = Depends(require_teacher), db: Session = Depends(get_db)) -> list[Classroom]:
    stmt = select(Classroom).where(Classroom.owner_id == user.id).order_by(Classroom.created_at.desc())
    return list(db.scalars(stmt).all())


@router.post("/api/classrooms", response_model=ClassroomOut, status_code=status.HTTP_201_CREATED)
def create_classroom(
    payload: ClassroomIn,
    user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> Classroom:
    c = Classroom(owner_id=user.id, name=payload.name.strip())
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.get("/api/classrooms/{cid}", response_model=ClassroomOut)
def get_classroom(cid: uuid.UUID, user: User = Depends(require_teacher), db: Session = Depends(get_db)) -> Classroom:
    return _owned_classroom(db, cid, user)


@router.patch("/api/classrooms/{cid}", response_model=ClassroomOut)
def update_classroom(
    cid: uuid.UUID,
    payload: ClassroomIn,
    user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> Classroom:
    c = _owned_classroom(db, cid, user)
    c.name = payload.name.strip()
    db.commit()
    db.refresh(c)
    return c


@router.delete("/api/classrooms/{cid}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_classroom(cid: uuid.UUID, user: User = Depends(require_teacher), db: Session = Depends(get_db)) -> Response:
    c = _owned_classroom(db, cid, user)
    db.delete(c)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ═══════════════════════════════════════════════════════════════════════════
# Tracks
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/api/tracks", response_model=list[TrackOut])
def list_tracks(
    classroom_id: uuid.UUID,
    user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> list[Track]:
    _owned_classroom(db, classroom_id, user)
    stmt = select(Track).where(Track.classroom_id == classroom_id).order_by(Track.order, Track.created_at)
    return list(db.scalars(stmt).all())


@router.post("/api/tracks", response_model=TrackOut, status_code=status.HTTP_201_CREATED)
def create_track(
    payload: TrackIn,
    user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> Track:
    _owned_classroom(db, payload.classroom_id, user)
    t = Track(classroom_id=payload.classroom_id, name=payload.name.strip(), order=payload.order)
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


@router.get("/api/tracks/{tid}", response_model=TrackOut)
def get_track(tid: uuid.UUID, user: User = Depends(require_teacher), db: Session = Depends(get_db)) -> Track:
    return _owned_track(db, tid, user)


@router.patch("/api/tracks/{tid}", response_model=TrackOut)
def update_track(
    tid: uuid.UUID,
    payload: TrackPatch,
    user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> Track:
    t = _owned_track(db, tid, user)
    if payload.name is not None:
        t.name = payload.name.strip()
    if payload.order is not None:
        t.order = payload.order
    db.commit()
    db.refresh(t)
    return t


@router.delete("/api/tracks/{tid}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_track(tid: uuid.UUID, user: User = Depends(require_teacher), db: Session = Depends(get_db)) -> Response:
    t = _owned_track(db, tid, user)
    db.delete(t)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ═══════════════════════════════════════════════════════════════════════════
# Collections
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/api/collections", response_model=list[CollectionOut])
def list_collections(
    track_id: uuid.UUID,
    user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> list[Collection]:
    _owned_track(db, track_id, user)
    stmt = select(Collection).where(Collection.track_id == track_id).order_by(Collection.order, Collection.created_at)
    return list(db.scalars(stmt).all())


@router.post("/api/collections", response_model=CollectionOut, status_code=status.HTTP_201_CREATED)
def create_collection(
    payload: CollectionIn,
    user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> Collection:
    _owned_track(db, payload.track_id, user)
    c = Collection(track_id=payload.track_id, name=payload.name.strip(), order=payload.order)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.get("/api/collections/{cid}", response_model=CollectionOut)
def get_collection(cid: uuid.UUID, user: User = Depends(require_teacher), db: Session = Depends(get_db)) -> Collection:
    return _owned_collection(db, cid, user)


@router.patch("/api/collections/{cid}", response_model=CollectionOut)
def update_collection(
    cid: uuid.UUID,
    payload: CollectionPatch,
    user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> Collection:
    c = _owned_collection(db, cid, user)
    if payload.name is not None:
        c.name = payload.name.strip()
    if payload.order is not None:
        c.order = payload.order
    db.commit()
    db.refresh(c)
    return c


@router.delete("/api/collections/{cid}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_collection(cid: uuid.UUID, user: User = Depends(require_teacher), db: Session = Depends(get_db)) -> Response:
    c = _owned_collection(db, cid, user)
    db.delete(c)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ═══════════════════════════════════════════════════════════════════════════
# Lessons
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/api/lessons", response_model=list[LessonOut])
def list_lessons(
    collection_id: uuid.UUID,
    user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> list[Lesson]:
    _owned_collection(db, collection_id, user)
    stmt = select(Lesson).where(Lesson.collection_id == collection_id).order_by(Lesson.order, Lesson.created_at)
    return list(db.scalars(stmt).all())


@router.post("/api/lessons", response_model=LessonOut, status_code=status.HTTP_201_CREATED)
def create_lesson(
    payload: LessonIn,
    user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> Lesson:
    _owned_collection(db, payload.collection_id, user)
    les = Lesson(
        collection_id=payload.collection_id,
        slug=payload.slug.strip(),
        title=payload.title.strip() if payload.title else None,
        order=payload.order,
    )
    db.add(les)
    db.commit()
    db.refresh(les)
    return les


@router.get("/api/lessons/{lid}", response_model=LessonOut)
def get_lesson(lid: uuid.UUID, user: User = Depends(require_teacher), db: Session = Depends(get_db)) -> Lesson:
    return _owned_lesson(db, lid, user)


@router.patch("/api/lessons/{lid}", response_model=LessonOut)
def update_lesson(
    lid: uuid.UUID,
    payload: LessonPatch,
    user: User = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> Lesson:
    les = _owned_lesson(db, lid, user)
    if payload.slug is not None:
        les.slug = payload.slug.strip()
    if payload.title is not None:
        les.title = payload.title.strip() or None
    if payload.order is not None:
        les.order = payload.order
    db.commit()
    db.refresh(les)
    return les


@router.delete("/api/lessons/{lid}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_lesson(lid: uuid.UUID, user: User = Depends(require_teacher), db: Session = Depends(get_db)) -> Response:
    les = _owned_lesson(db, lid, user)
    db.delete(les)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
