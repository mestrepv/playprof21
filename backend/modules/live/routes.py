"""
Rotas REST da Fase 4.

  POST /api/lab/sessions              — master cria sessão ancorada numa
                                        InteractiveLesson própria
  GET  /api/lab/sessions/{id}         — snapshot (público; player acessa
                                        antes de subir WS)
  GET  /api/lab/sessions/{id}/manifest — devolve o manifest já com URLs de
                                        asset reescritas (usa content_loader)

Join de aluno por código/QR fica pra Fase 5.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from database import get_db

from ..auth.deps import require_teacher
from ..auth.models import User
from ..domain.models import InteractiveLesson
from ..lab.content_loader import games_content_root, load_game_dir
from .join import client_ip, generate_code, join_limiter
from .models import Session, SessionMembership
from .schemas import (
    CodeOut,
    JoinIn,
    JoinOut,
    MembershipOut,
    SessionCreateIn,
    SessionOut,
    SessionSnapshot,
)


router = APIRouter(prefix="/api/lab", tags=["live"])


def _build_snapshot(db: DbSession, sess: Session, *, my_membership: SessionMembership | None = None) -> SessionSnapshot:
    il = db.get(InteractiveLesson, sess.interactive_lesson_id)
    if il is None:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "interactive_lesson apagada — sessão órfã")
    parts = list(
        db.scalars(
            select(SessionMembership).where(SessionMembership.session_id == sess.id).order_by(SessionMembership.joined_at)
        ).all()
    )
    return SessionSnapshot(
        session=SessionOut.model_validate(sess),
        game_slug=il.slug,
        game_title=il.title,
        participants=[MembershipOut.model_validate(m) for m in parts],
        my_membership=MembershipOut.model_validate(my_membership) if my_membership else None,
        my_role="master" if (my_membership and my_membership.role == "master") else "player",
    )


@router.post("/sessions", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
def create_session(
    payload: SessionCreateIn,
    user: User = Depends(require_teacher),
    db: DbSession = Depends(get_db),
) -> Session:
    il = db.get(InteractiveLesson, payload.interactive_lesson_id)
    if il is None or il.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "aula interativa não encontrada")

    s = Session(
        interactive_lesson_id=il.id,
        master_user_id=user.id,
        current_slide_index=0,
        interaction_mode="free",
        status="idle",
        code=generate_code(db),
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.get("/sessions/{sid}", response_model=SessionSnapshot)
def get_session(sid: uuid.UUID, db: DbSession = Depends(get_db)) -> SessionSnapshot:
    sess = db.get(Session, sid)
    if sess is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "sessão não encontrada")
    return _build_snapshot(db, sess)


@router.post("/sessions/{sid}/code/rotate", response_model=CodeOut)
def rotate_code(
    sid: uuid.UUID,
    user: User = Depends(require_teacher),
    db: DbSession = Depends(get_db),
) -> CodeOut:
    sess = db.get(Session, sid)
    if sess is None or sess.master_user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "sessão não encontrada")
    if sess.status == "ended":
        raise HTTPException(status.HTTP_409_CONFLICT, "sessão encerrada — não rotaciona")
    sess.code = generate_code(db)
    db.commit()
    return CodeOut(code=sess.code)


@router.post("/join", response_model=JoinOut)
def join_by_code(payload: JoinIn, request: Request, db: DbSession = Depends(get_db)) -> JoinOut:
    """Rota pública — aluno digita código + nome. Devolve session_id + anon_id
    pra o cliente abrir o WS. Rate-limited por IP."""
    join_limiter.check(client_ip(request))

    sess = db.scalar(
        select(Session).where(Session.code == payload.code, Session.status != "ended")
    )
    if sess is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "código inválido ou sessão encerrada")

    # O anon_id é gerado server-side e devolvido pro cliente guardar. O cliente
    # vai usar esse mesmo anon_id ao abrir o WS. Não persiste membership aqui —
    # isso acontece no handshake do WS (upsert idempotente).
    anon_id = uuid.uuid4()
    return JoinOut(session_id=sess.id, anon_id=anon_id, display_name=payload.display_name.strip())


@router.get("/sessions/{sid}/manifest")
def get_session_manifest(sid: uuid.UUID, db: DbSession = Depends(get_db)) -> dict:
    sess = db.get(Session, sid)
    if sess is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "sessão não encontrada")
    il = db.get(InteractiveLesson, sess.interactive_lesson_id)
    if il is None:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "aula referenciada sumiu")

    game_dir = games_content_root() / il.slug
    if not game_dir.is_dir():
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            f"conteúdo em disco '{il.slug}' não existe — crie games_content/{il.slug}/ ou edite a aula no banco",
        )
    game, errors = load_game_dir(game_dir)
    if game is None:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            {"message": "falha ao carregar manifest", "errors": [str(e) for e in errors]},
        )
    return {"game": game, "errors": [str(e) for e in errors]}
