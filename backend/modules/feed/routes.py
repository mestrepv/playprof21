"""
Rotas do feed/fórum da turma.

Acesso: dono da turma ou aluno matriculado (via Enrollment). Caller sem
acesso recebe 404 (não vaza existência).
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from database import get_db

from ..auth.deps import get_current_user
from ..auth.models import User
from ..domain.models import Classroom, Enrollment
from .models import FeedComment, FeedPost, FeedPostLike
from .schemas import (
    CommentIn,
    CommentOut,
    LikeToggleOut,
    PostAuthor,
    PostIn,
    PostOut,
    PostsPage,
)


router = APIRouter(tags=["feed"])


# ═══════════════════════════════════════════════════════════════════════════
# Auth helpers — caller precisa ter acesso à turma (dono ou matriculado)
# ═══════════════════════════════════════════════════════════════════════════

def _assert_classroom_access(db: Session, user: User, classroom_id: uuid.UUID) -> Classroom:
    c = db.get(Classroom, classroom_id)
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "turma não encontrada")
    if c.owner_id == user.id:
        return c
    enrolled = db.scalar(
        select(Enrollment.id).where(
            Enrollment.classroom_id == c.id,
            Enrollment.user_id == user.id,
        )
    )
    if enrolled is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "turma não encontrada")
    return c


def _get_post_or_404(db: Session, user: User, post_id: uuid.UUID) -> FeedPost:
    p = db.get(FeedPost, post_id)
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "post não encontrado")
    _assert_classroom_access(db, user, p.classroom_id)
    return p


def _post_out(
    db: Session,
    user: User,
    post: FeedPost,
    *,
    author_cache: dict[uuid.UUID, User] | None = None,
    counts_cache: dict[uuid.UUID, tuple[int, int]] | None = None,
    liked_cache: set[uuid.UUID] | None = None,
) -> PostOut:
    """Monta PostOut. Caches evitam N+1 em listagem (ver `list_posts`)."""
    if author_cache is not None and post.user_id in author_cache:
        author_user = author_cache[post.user_id]
    else:
        author_user = db.get(User, post.user_id)
    display_name = author_user.display_name if author_user else "(desconhecido)"

    if counts_cache is not None and post.id in counts_cache:
        comment_count, like_count = counts_cache[post.id]
    else:
        comment_count = db.scalar(
            select(func.count()).select_from(FeedComment).where(FeedComment.post_id == post.id)
        ) or 0
        like_count = db.scalar(
            select(func.count()).select_from(FeedPostLike).where(FeedPostLike.post_id == post.id)
        ) or 0

    if liked_cache is not None:
        user_liked = post.id in liked_cache
    else:
        user_liked = db.scalar(
            select(FeedPostLike.post_id).where(
                FeedPostLike.post_id == post.id, FeedPostLike.user_id == user.id
            )
        ) is not None

    return PostOut(
        id=post.id,
        classroom_id=post.classroom_id,
        author=PostAuthor(id=post.user_id, display_name=display_name),
        content=post.content,
        created_at=post.created_at,
        updated_at=post.updated_at,
        comment_count=comment_count,
        like_count=like_count,
        user_liked=user_liked,
    )


# ═══════════════════════════════════════════════════════════════════════════
# Posts
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/api/classrooms/{cid}/posts", response_model=PostsPage)
def list_posts(
    cid: uuid.UUID,
    limit: int = 20,
    offset: int = 0,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PostsPage:
    _assert_classroom_access(db, user, cid)
    limit = max(1, min(limit, 50))
    offset = max(0, offset)

    total = db.scalar(
        select(func.count()).select_from(FeedPost).where(FeedPost.classroom_id == cid)
    ) or 0

    posts = list(
        db.scalars(
            select(FeedPost)
            .where(FeedPost.classroom_id == cid)
            .order_by(FeedPost.created_at.desc())
            .offset(offset)
            .limit(limit)
        ).all()
    )

    # Pré-caches pra evitar N+1
    user_ids = {p.user_id for p in posts}
    authors = {u.id: u for u in db.scalars(select(User).where(User.id.in_(user_ids))).all()} if user_ids else {}

    post_ids = [p.id for p in posts]
    counts: dict[uuid.UUID, tuple[int, int]] = {pid: (0, 0) for pid in post_ids}
    if post_ids:
        c_rows = db.execute(
            select(FeedComment.post_id, func.count())
            .where(FeedComment.post_id.in_(post_ids))
            .group_by(FeedComment.post_id)
        ).all()
        for pid, cnt in c_rows:
            counts[pid] = (cnt, counts[pid][1])
        l_rows = db.execute(
            select(FeedPostLike.post_id, func.count())
            .where(FeedPostLike.post_id.in_(post_ids))
            .group_by(FeedPostLike.post_id)
        ).all()
        for pid, cnt in l_rows:
            counts[pid] = (counts[pid][0], cnt)

    liked_by_me: set[uuid.UUID] = set()
    if post_ids:
        rows = db.execute(
            select(FeedPostLike.post_id).where(
                FeedPostLike.post_id.in_(post_ids), FeedPostLike.user_id == user.id
            )
        ).all()
        liked_by_me = {r[0] for r in rows}

    out = [
        _post_out(db, user, p, author_cache=authors, counts_cache=counts, liked_cache=liked_by_me)
        for p in posts
    ]
    return PostsPage(posts=out, total=total, has_more=offset + len(out) < total)


@router.post("/api/classrooms/{cid}/posts", response_model=PostOut, status_code=status.HTTP_201_CREATED)
def create_post(
    cid: uuid.UUID,
    payload: PostIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PostOut:
    _assert_classroom_access(db, user, cid)
    p = FeedPost(classroom_id=cid, user_id=user.id, content=payload.content.strip())
    db.add(p)
    db.commit()
    db.refresh(p)
    return _post_out(db, user, p)


@router.delete("/api/posts/{pid}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_post(
    pid: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    p = _get_post_or_404(db, user, pid)
    classroom = db.get(Classroom, p.classroom_id)
    is_owner_of_classroom = classroom is not None and classroom.owner_id == user.id
    if p.user_id != user.id and not is_owner_of_classroom:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "só o autor ou o professor da turma pode apagar")
    db.delete(p)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ═══════════════════════════════════════════════════════════════════════════
# Comments
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/api/posts/{pid}/comments", response_model=list[CommentOut])
def list_comments(
    pid: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[CommentOut]:
    _get_post_or_404(db, user, pid)
    comments = list(
        db.scalars(
            select(FeedComment)
            .where(FeedComment.post_id == pid)
            .order_by(FeedComment.created_at.asc())
        ).all()
    )
    user_ids = {c.user_id for c in comments}
    authors = (
        {u.id: u for u in db.scalars(select(User).where(User.id.in_(user_ids))).all()}
        if user_ids
        else {}
    )
    return [
        CommentOut(
            id=c.id,
            post_id=c.post_id,
            author=PostAuthor(
                id=c.user_id,
                display_name=authors[c.user_id].display_name if c.user_id in authors else "(desconhecido)",
            ),
            content=c.content,
            created_at=c.created_at,
        )
        for c in comments
    ]


@router.post("/api/posts/{pid}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
def create_comment(
    pid: uuid.UUID,
    payload: CommentIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CommentOut:
    _get_post_or_404(db, user, pid)
    c = FeedComment(post_id=pid, user_id=user.id, content=payload.content.strip())
    db.add(c)
    db.commit()
    db.refresh(c)
    return CommentOut(
        id=c.id,
        post_id=c.post_id,
        author=PostAuthor(id=user.id, display_name=user.display_name),
        content=c.content,
        created_at=c.created_at,
    )


@router.delete(
    "/api/posts/{pid}/comments/{cid}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_comment(
    pid: uuid.UUID,
    cid: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    c = db.get(FeedComment, cid)
    if c is None or c.post_id != pid:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "comentário não encontrado")
    post = _get_post_or_404(db, user, pid)
    classroom = db.get(Classroom, post.classroom_id)
    is_owner_of_classroom = classroom is not None and classroom.owner_id == user.id
    if c.user_id != user.id and not is_owner_of_classroom:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "só o autor do comentário ou o professor pode apagar")
    db.delete(c)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ═══════════════════════════════════════════════════════════════════════════
# Likes — toggle
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/api/posts/{pid}/like", response_model=LikeToggleOut)
def toggle_like(
    pid: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LikeToggleOut:
    _get_post_or_404(db, user, pid)
    existing = db.get(FeedPostLike, (pid, user.id))
    if existing is None:
        db.add(FeedPostLike(post_id=pid, user_id=user.id))
        db.commit()
        liked = True
    else:
        db.delete(existing)
        db.commit()
        liked = False
    like_count = db.scalar(
        select(func.count()).select_from(FeedPostLike).where(FeedPostLike.post_id == pid)
    ) or 0
    return LikeToggleOut(liked=liked, like_count=like_count)
