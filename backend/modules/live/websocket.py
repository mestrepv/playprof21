"""
WebSocket endpoint da sessão ao vivo.

  /ws/lesson/session/{sid}?token=<jwt>&anon_id=<uuid>&display_name=<nome>

Auth:
  - Se `token` JWT válido → user logado. Role derivada: master se
    user.id == session.master_user_id, senão player.
  - Senão se `anon_id` (UUID) + `display_name` → player anônimo.
  - Fora disso → fecha com 4401.

Handlers Fase 4:
  setSlide {index}            — master-only
  setInteractionMode {mode}   — master-only
  event {name, payload}       — qualquer role; persiste em live_events
  ping {}                     — qualquer role; responde pong

Handlers Fase 4.1:
  setActivity {activityId}    — master-only; sincroniza atividade ativa
  quizOpen {questionId, options, correctIndex}  — master-only
  quizAnswer {questionId, answerIndex}          — qualquer role
  quizClose {questionId}      — master-only; revela gabarito + auto-score
  quizReset {questionId}      — master-only; apaga respostas
  adjustScore {membershipId, delta, reason?}    — master-only
  endSession {}               — master-only
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DbSession

from database import SessionLocal

from ..auth.models import User
from ..auth.security import decode_access_token
from ..domain.models import InteractiveLesson
from ..lesson.content_loader import games_content_root, load_game_dir
from .connection_manager import manager
from .models import QuizAnswer, QuizState, Score, Session, SessionEvent, SessionMembership

QUIZ_CORRECT_POINTS = 10

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
    game_dir = games_content_root() / slug
    if not game_dir.is_dir():
        return None
    game, _errors = load_game_dir(game_dir)
    if game is None:
        return None
    return game.get("manifest", {}).get("slides", [])


def _quiz_state_dict(qs: QuizState, *, reveal_answer: bool) -> dict:
    return {
        "questionId": qs.question_id,
        "status": qs.status,
        "distribution": qs.distribution or [],
        "responses": qs.responses,
        "correctIndex": qs.correct_index if reveal_answer else None,
    }


def _scores_dict(db: DbSession, session_id: uuid.UUID) -> dict[str, int]:
    """Retorna {membership_id_str: total} para a sessão."""
    rows = db.execute(
        select(Score.membership_id, func.sum(Score.delta).label("total"))
        .where(Score.session_id == session_id)
        .group_by(Score.membership_id)
    ).all()
    return {str(r.membership_id): int(r.total) for r in rows}


def _build_snapshot_extra(db: DbSession, sess: Session) -> tuple[list[dict], list[dict]]:
    """Retorna (quizzes_list, scores_list) para incluir no sessionSnapshot."""
    quiz_states = db.scalars(
        select(QuizState).where(QuizState.session_id == sess.id)
    ).all()
    quizzes = [_quiz_state_dict(qs, reveal_answer=(qs.status == "closed")) for qs in quiz_states]

    scores_map = _scores_dict(db, sess.id)
    scores = [{"membershipId": mid, "total": total} for mid, total in scores_map.items()]

    return quizzes, scores


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

        quizzes, scores = _build_snapshot_extra(db, sess)

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
            "quizzes": quizzes,
            "scores": scores,
            "ts": _now_iso(),
        })

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

        # ── Loop de mensagens ────────────────────────────────────────────
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

            # ── Handlers qualquer role ──────────────────────────────────

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

            if mtype == "quizAnswer":
                question_id = str(msg.get("questionId") or "")
                try:
                    answer_index = int(msg.get("answerIndex", -1))
                except (TypeError, ValueError):
                    answer_index = -1

                qs = db.scalar(
                    select(QuizState).where(
                        QuizState.session_id == sess.id,
                        QuizState.question_id == question_id,
                    )
                )
                if qs is None or qs.status != "open":
                    await manager.send(ws, {"type": "error", "code": "quiz_not_open", "message": "quiz não está aberto"})
                    continue
                if answer_index < 0 or (qs.options_count is not None and answer_index >= qs.options_count):
                    await manager.send(ws, {"type": "error", "code": "bad_answer", "message": "answerIndex inválido"})
                    continue

                try:
                    ans = QuizAnswer(
                        quiz_state_id=qs.id,
                        membership_id=membership.id,
                        answer_index=answer_index,
                    )
                    db.add(ans)
                    db.flush()
                    dist = list(qs.distribution or [])
                    while len(dist) <= answer_index:
                        dist.append(0)
                    dist[answer_index] += 1
                    qs.distribution = dist
                    qs.responses = (qs.responses or 0) + 1
                    db.commit()
                    await manager.broadcast(sess.id, {
                        "type": "quizState",
                        "questionId": qs.question_id,
                        "status": "open",
                        "distribution": qs.distribution,
                        "responses": qs.responses,
                        "correctIndex": None,
                        "ts": _now_iso(),
                    })
                except IntegrityError:
                    db.rollback()
                    # Segundo voto — ignora silenciosamente
                continue

            # ── Master-only abaixo ──────────────────────────────────────

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

            elif mtype == "setActivity":
                activity_id = msg.get("activityId")
                if activity_id is not None:
                    activity_id = str(activity_id)[:120]
                sess.current_activity_id = activity_id
                db.commit()
                await manager.broadcast(sess.id, {
                    "type": "activityChange",
                    "activityId": activity_id,
                    "ts": _now_iso(),
                })
                _persist_event(
                    db, session_id=sess.id, membership_id=membership.id,
                    type_="activity.changed",
                    payload={"activityId": activity_id},
                    slide_index=sess.current_slide_index,
                    activity_id=activity_id,
                )

            elif mtype == "quizOpen":
                question_id = str(msg.get("questionId") or "")[:120]
                options = msg.get("options") or []
                try:
                    correct_index = int(msg.get("correctIndex", 0))
                except (TypeError, ValueError):
                    correct_index = 0
                if not question_id or len(options) < 2 or len(options) > 6:
                    await manager.send(ws, {"type": "error", "code": "bad_quiz", "message": "questionId obrigatório e 2-6 opções"})
                    continue
                if correct_index < 0 or correct_index >= len(options):
                    await manager.send(ws, {"type": "error", "code": "bad_correct", "message": "correctIndex fora do range"})
                    continue

                # Upsert: se já existe, limpa respostas e reabre
                qs = db.scalar(
                    select(QuizState).where(
                        QuizState.session_id == sess.id,
                        QuizState.question_id == question_id,
                    )
                )
                if qs is None:
                    qs = QuizState(
                        session_id=sess.id,
                        question_id=question_id,
                    )
                    db.add(qs)
                else:
                    # Limpa respostas anteriores
                    db.query(QuizAnswer).filter(QuizAnswer.quiz_state_id == qs.id).delete()
                qs.status = "open"
                qs.distribution = [0] * len(options)
                qs.responses = 0
                qs.correct_index = correct_index
                qs.options_count = len(options)
                qs.opened_at = datetime.now(timezone.utc)
                qs.closed_at = None
                db.commit()

                await manager.broadcast(sess.id, {
                    "type": "quizState",
                    "questionId": qs.question_id,
                    "status": "open",
                    "distribution": qs.distribution,
                    "responses": 0,
                    "correctIndex": None,
                    "ts": _now_iso(),
                })

            elif mtype == "quizClose":
                question_id = str(msg.get("questionId") or "")[:120]
                qs = db.scalar(
                    select(QuizState).where(
                        QuizState.session_id == sess.id,
                        QuizState.question_id == question_id,
                    )
                )
                if qs is None or qs.status != "open":
                    await manager.send(ws, {"type": "error", "code": "quiz_not_open", "message": "quiz não está aberto"})
                    continue
                qs.status = "closed"
                qs.closed_at = datetime.now(timezone.utc)
                db.commit()

                # Auto-scoring: 10 pts pra quem acertou
                deltas: list[dict] = []
                if qs.correct_index is not None:
                    correct_answers = db.scalars(
                        select(QuizAnswer).where(
                            QuizAnswer.quiz_state_id == qs.id,
                            QuizAnswer.answer_index == qs.correct_index,
                        )
                    ).all()
                    reason = f"quiz-{qs.question_id}-correct"
                    for ans in correct_answers:
                        s = Score(
                            session_id=sess.id,
                            membership_id=ans.membership_id,
                            source="auto",
                            reason=reason,
                            delta=QUIZ_CORRECT_POINTS,
                        )
                        db.add(s)
                        deltas.append({
                            "membershipId": str(ans.membership_id),
                            "delta": QUIZ_CORRECT_POINTS,
                            "reason": reason,
                            "source": "auto",
                        })
                    if deltas:
                        db.commit()

                # Broadcast: revela gabarito
                await manager.broadcast(sess.id, {
                    "type": "quizState",
                    "questionId": qs.question_id,
                    "status": "closed",
                    "distribution": qs.distribution,
                    "responses": qs.responses,
                    "correctIndex": qs.correct_index,
                    "ts": _now_iso(),
                })
                if deltas:
                    await manager.broadcast(sess.id, {
                        "type": "scoreUpdate",
                        "deltas": deltas,
                        "ts": _now_iso(),
                    })

            elif mtype == "quizReset":
                question_id = str(msg.get("questionId") or "")[:120]
                qs = db.scalar(
                    select(QuizState).where(
                        QuizState.session_id == sess.id,
                        QuizState.question_id == question_id,
                    )
                )
                if qs is not None:
                    db.query(QuizAnswer).filter(QuizAnswer.quiz_state_id == qs.id).delete()
                    db.delete(qs)
                    db.commit()
                await manager.broadcast(sess.id, {
                    "type": "quizState",
                    "questionId": question_id,
                    "status": "idle",
                    "distribution": [],
                    "responses": 0,
                    "correctIndex": None,
                    "ts": _now_iso(),
                })

            elif mtype == "adjustScore":
                target_mid_str = str(msg.get("membershipId") or "")
                try:
                    target_mid = uuid.UUID(target_mid_str)
                except ValueError:
                    await manager.send(ws, {"type": "error", "code": "bad_membership", "message": "membershipId inválido"})
                    continue
                try:
                    delta = int(msg.get("delta", 0))
                except (TypeError, ValueError):
                    delta = 0
                reason = str(msg.get("reason") or "ajuste manual")[:200]

                # Verifica que membership pertence à sessão
                target = db.scalar(
                    select(SessionMembership).where(
                        SessionMembership.id == target_mid,
                        SessionMembership.session_id == sess.id,
                    )
                )
                if target is None:
                    await manager.send(ws, {"type": "error", "code": "not_found", "message": "membership não encontrado"})
                    continue

                s = Score(
                    session_id=sess.id,
                    membership_id=target_mid,
                    source="master_override",
                    reason=reason,
                    delta=delta,
                )
                db.add(s)
                db.commit()
                await manager.broadcast(sess.id, {
                    "type": "scoreUpdate",
                    "deltas": [{
                        "membershipId": target_mid_str,
                        "delta": delta,
                        "reason": reason,
                        "source": "master_override",
                    }],
                    "ts": _now_iso(),
                })

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
