"""
Conexão SQLAlchemy com Postgres. Em labprof21 o banco é sempre Postgres
(sem fallback SQLite). DATABASE_URL vem do compose via env.
"""

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://labprof21:labprof21_dev@localhost:5435/labprof21",
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
