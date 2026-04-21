"""Schemas do feed."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PostAuthor(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    display_name: str


class PostIn(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


class PostOut(BaseModel):
    id: uuid.UUID
    classroom_id: uuid.UUID
    author: PostAuthor
    content: str
    created_at: datetime
    updated_at: datetime
    comment_count: int
    like_count: int
    user_liked: bool


class PostsPage(BaseModel):
    posts: list[PostOut]
    total: int
    has_more: bool


class CommentIn(BaseModel):
    content: str = Field(min_length=1, max_length=1000)


class CommentOut(BaseModel):
    id: uuid.UUID
    post_id: uuid.UUID
    author: PostAuthor
    content: str
    created_at: datetime


class LikeToggleOut(BaseModel):
    liked: bool
    like_count: int
