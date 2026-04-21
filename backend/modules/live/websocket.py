"""
WebSocket endpoint da sessão ao vivo.

  /ws/lab/session/{sid}?token=<jwt>&anon_id=<uuid>&display_name=<nome>

Auth:
  - Se `token` JWT válido → user logado. Role derivada: master se
    user.id == session.master_user_id, senão player.
  - Senão se `anon_id` (UUID) + `display_name` → player anônimo.
  - Fora disso → fecha com 4401.

Fluxo:
  1. Accept + resolve membership (upsert).
  2. Envia sessionSnapshot pro cliente que conectou.
  3. Broadcast participantUpdate pra todos os outros.
  4. Loop de mensagens até desconectar.

Handlers Fase 4:
  setSlide {index}            — master-only; muda current_slide_index +
                                interaction_mode default do slide no manifest
  setInteractionMode {mode}   — master-only
  event {name, payload}       — qualquer role; persiste em live_events
  ping {}                     — qualquer role; responde pong (keepalive simples)

Fora do escopo da Fase 4 (entram quando missions forem portadas):
  quizOpen/Close/Reset/Answer, adjustScore, setActivity (infra pronta no DB
  mas sem handler).
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect, status
from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from database import SessionLocal

from ..auth.models import User
from ..auth.security import decode_access_token
from ..domain.models import InteractiveLesson
from ..lab.content_loader import games_content_root, load_game_dir
from .connection_manager import manager
from .models import Session, SessionEvent, SessionMembership


log = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _resolve_user(db: DbSession, token: str | None) -> User | None:
    if not token:
        return None
    payload = decode_access_token(token)
    if not payload:
        return None
    sub = payload.get("sub")
    if not sub:
        return None
    try:
        return db.get(User, uuid.UUID(sub))
    except ValueError:
        return None


def _upsert_membership(
    db: DbSession,
    *,
    session: Session,
    user: User | None,
    anon_id: uuid.UUID | None,
    display_name: str,
    role: str,
) -> SessionMembership:
    if user is not None:
        existing = db.scalar(
            select(SessionMembership).where(
                SessionMembership.session_id == session.id,
                SessionMembership.user_id == user.id,
            )
        )
        if existing is not None:
            # Atualiza display_name se mudou
            if existing.display_name != display_name:
                existing.display_name = display_name
                db.commit()
            return existing
        m = SessionMembership(
            session_id=session.id,
            user_id=user.id,
            role=role,
            display_name=display_name,
        )
    else:
        assert anon_id is not None
        existing = db.scalar(
            select(SessionMembership).where(
                SessionMembership.session_id == session.id,
                SessionMembership.anonymous_user_id == anon_id,
            )
        )
        if existing is not None:
            if existing.display_name != display_name:
                existing.display_name = display_name
                db.commit()
            return existing
        m = SessionMembership(
            session_id=session.id,
            anonymous_user_id=anon_id,
            role=role,
            display_name=display_name,
        )
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


def _persist_event(
    db: DbSession,
    *,
    session_id: uuid.UUID,
    membership_id: uuid.UUID | None,
    type_: str,
    payload: dict[str, Any],
    slide_index: int | None = None,
    activity_id: str | None = None,
) -> None:
    try:
        ev = SessionEvent(
            session_id=session_id,
            membership_id=membership_id,
            type=type_,
            payload=payload,
            slide_index=slide_index,
            activity_id=activity_id,
        )
        db.add(ev)
        db.commit()
    except Exception:  # noqa: BLE001
        log.exception("falha ao persistir evento %s", type_)
        db.rollback()


def _load_manifest_slides(slug: str) -> list[dict] | None:
    """Best-effort: carrega os slides pra poder aplicar interaction_mode
    default em setSlide. Em erro, devolve None e segue sem aplicar."""
    game_dir = games_content_root() / slug
    if not game_dir.is_dir():
        return None
    game, _errors = load_game_dir(game_dir)
    if game is None:
        return None
    return game.get("manifest", {}).get("slides", [])


# ═══════════════════════════════════════════════════════════════════════════
# Endpoint
# ═══════════════════════════════════════════════════════════════════════════

async def session_ws(
    ws: WebSocket,
    sid: uuid.UUID,
    token: str | None = None,
    anon_id: str | None = None,
    display_name: str | None = None,
) -> None:
    db = SessionLocal()
    try:
        sess = db.get(Session, sid)
        if sess is None:
            await ws.close(code=4404)
            return

        user = _resolve_user(db, token)
        anon_uuid: uuid.UUID | None = None
        if user is None:
            if not anon_id:
                await ws.close(code=4401)
                return
            try:
                anon_uuid = uuid.UUID(anon_id)
            except ValueError:
                await ws.close(code=4401)
                return
            if not display_name or not display_name.strip():
                await ws.close(code=4400)
                return
            display = display_name.strip()[:120]
            role = "player"
        else:
            display = (display_name or user.display_name).strip()[:120]
            role = "master" if user.id == sess.master_user_id else "player"

        membership = _upsert_membership(
            db,
            session=sess,
            user=user,
            anon_id=anon_uuid,
            display_name=display,
            role=role,
        )

        await manager.connect(
            ws,
            session_id=sess.id,
            membership_id=membership.id,
            role=role,
            display_name=display,
        )

        # Snapshot inicial pro cliente que entrou.
        await manager.send(ws, {
            "type": "sessionSnapshot",
            "session": {
                "id": str(sess.id),
                "interactive_lesson_id": str(sess.interactive_lesson_id),
                "current_slide_index": sess.current_slide_index,
                "current_activity_id": sess.current_activity_id,
                "interaction_mode": sess.interaction_mode,
                "status": sess.status,
            },
            "my_membership": {
                "id": str(membership.id),
                "display_name": membership.display_name,
                "role": membership.role,
            },
            "my_role": role,
            "participants": [
                {"id": str(p.id), "display_name": p.display_name, "role": p.role}
                for p in db.scalars(
                    select(SessionMembership)
                    .where(SessionMembership.session_id == sess.id)
                    .order_by(SessionMembership.joined_at)
                ).all()
            ],
            "ts": _now_iso(),
        })

        # Broadcast participantUpdate pra outros.
        await manager.broadcast(
            sess.id,
            {
                "type": "participantUpdate",
                "action": "joined",
                "participant": {
                    "id": str(membership.id),
                    "display_name": membership.display_name,
                    "role": membership.role,
                },
                "ts": _now_iso(),
            },
            exclude=ws,
        )
        _persist_event(
            db,
            session_id=sess.id,
            membership_id=membership.id,
            type_="participant.joined",
            payload={"role": role, "display_name": display},
        )

        # Loop de mensagens
        while True:
            try:
                msg = await ws.receive_json()
            except WebSocketDisconnect:
                break
            except Exception:  # noqa: BLE001
                log.debug("receive_json falhou", exc_info=True)
                break

            if not isinstance(msg, dict):
                continue
            mtype = msg.get("type")

            if mtype == "ping":
                await manager.send(ws, {"type": "pong", "ts": _now_iso()})
                continue

            if mtype == "event":
                ev = msg.get("event") or {}
                _persist_event(
                    db,
                    session_id=sess.id,
                    membership_id=membership.id,
                    type_=str(ev.get("name", "event"))[:60],
                    payload=ev.get("payload") or {},
                    slide_index=sess.current_slide_index,
                    activity_id=sess.current_activity_id,
                )
                continue

            # Daqui pra frente, master-only
            if role != "master":
                await manager.send(ws, {"type": "error", "code": "forbidden", "message": f"'{mtype}' é master-only"})
                continue

            if mtype == "setSlide":
                try:
                    idx = int(msg.get("index", 0))
                except (TypeError, ValueError):
                    await manager.send(ws, {"type": "error", "code": "bad_index", "message": "index inválido"})
                    continue
                sess.current_slide_index = max(0, idx)
                sess.current_activity_id = None

                # Aplica interaction_mode default do slide, se manifest carregar
                il = db.get(InteractiveLesson, sess.interactive_lesson_id)
                if il is not None:
                    slides = _load_manifest_slides(il.slug) or []
                    if 0 <= sess.current_slide_index < len(slides):
                        mode_default = slides[sess.current_slide_index].get("interactionMode")
                        if mode_default in ("free", "master-led"):
                            sess.interaction_mode = mode_default

                if sess.status == "idle":
                    sess.status = "live"
                    sess.started_at = datetime.now(timezone.utc)
                db.commit()

                await manager.broadcast(sess.id, {
                    "type": "slideChange",
                    "index": sess.current_slide_index,
                    "interaction_mode": sess.interaction_mode,
                    "activity_id": None,
                    "status": sess.status,
                    "ts": _now_iso(),
                })
                _persist_event(
                    db, session_id=sess.id, membership_id=membership.id,
                    type_="slide.changed",
                    payload={"index": sess.current_slide_index, "interaction_mode": sess.interaction_mode},
                    slide_index=sess.current_slide_index,
                )

            elif mtype == "setInteractionMode":
                mode = msg.get("mode")
                if mode not in ("free", "master-led"):
                    await manager.send(ws, {"type": "error", "code": "bad_mode", "message": "mode inválido"})
                    continue
                if sess.interaction_mode == mode:
                    continue
                sess.interaction_mode = mode
                db.commit()
                await manager.broadcast(sess.id, {
                    "type": "interactionModeChange", "mode": mode, "ts": _now_iso(),
                })
                _persist_event(
                    db, session_id=sess.id, membership_id=membership.id,
                    type_="interactionMode.changed", payload={"mode": mode},
                    slide_index=sess.current_slide_index,
                )

            elif mtype == "endSession":
                sess.status = "ended"
                sess.ended_at = datetime.now(timezone.utc)
                db.commit()
                await manager.broadcast(sess.id, {"type": "sessionEnded", "ts": _now_iso()})
                _persist_event(
                    db, session_id=sess.id, membership_id=membership.id,
                    type_="session.ended", payload={},
                )

            else:
                await manager.send(ws, {"type": "error", "code": "unknown_type", "message": f"'{mtype}' desconhecido"})

    finally:
        meta = manager.disconnect(ws)
        if meta is not None:
            try:
                await manager.broadcast(
                    meta.session_id,
                    {
                        "type": "participantUpdate",
                        "action": "left",
                        "membership_id": str(meta.membership_id),
                        "ts": _now_iso(),
                    },
                )
                _persist_event(
                    db,
                    session_id=meta.session_id,
                    membership_id=meta.membership_id,
                    type_="participant.left",
                    payload={},
                )
            except Exception:  # noqa: BLE001
                log.debug("left broadcast falhou", exc_info=True)
        db.close()
