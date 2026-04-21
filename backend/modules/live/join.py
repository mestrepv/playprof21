"""
Utilidades da entrada-por-código (Fase 5).

- `generate_code()` cria código de 6 dígitos com retry (evita colisão com
  outra sessão ativa).
- `random_code()` gera sem dedupe (útil pra outros domínios que checam
  colisão por conta própria).
- `RateLimiter` in-process, limita tentativas de join por IP.
"""

from __future__ import annotations

import random
import time
from collections import defaultdict, deque
from dataclasses import dataclass

from fastapi import HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession


CODE_LEN = 6
CODE_ALPHABET = "0123456789"
MAX_ATTEMPTS = 25


def random_code() -> str:
    return "".join(random.choice(CODE_ALPHABET) for _ in range(CODE_LEN))


def generate_code(db: DbSession) -> str:
    """Gera código único entre sessões ativas (status != 'ended'). Retry até
    `MAX_ATTEMPTS`; espaço de busca é 10^6, colisão com ~1000 sessões
    simultâneas é virtualmente zero."""
    from .models import Session  # local import evita ciclo

    for _ in range(MAX_ATTEMPTS):
        code = random_code()
        existing = db.scalar(
            select(Session.id).where(Session.code == code, Session.status != "ended")
        )
        if existing is None:
            return code
    raise RuntimeError("falha ao gerar código único após múltiplas tentativas")


# ═══════════════════════════════════════════════════════════════════════════
# Rate limiter in-process: sliding window por IP.
# Se promovermos pra multi-worker, trocar por Redis — interface stateless.
# ═══════════════════════════════════════════════════════════════════════════

@dataclass
class _Window:
    """Limite X eventos em Y segundos — sliding window com deque de timestamps."""
    max_events: int
    window_seconds: float


class RateLimiter:
    def __init__(self, *, max_events: int, window_seconds: float) -> None:
        self._cfg = _Window(max_events=max_events, window_seconds=window_seconds)
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str) -> None:
        """Registra hit. Raise 429 se passar do limite."""
        now = time.monotonic()
        hits = self._hits[key]
        cutoff = now - self._cfg.window_seconds
        while hits and hits[0] < cutoff:
            hits.popleft()
        if len(hits) >= self._cfg.max_events:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="muitas tentativas — aguarde alguns segundos",
                headers={"Retry-After": str(int(self._cfg.window_seconds))},
            )
        hits.append(now)


# Limite pro endpoint público de join: 10 tentativas por IP por minuto.
# Conservador o suficiente pra brute-force não ser prático (10M tentativas/IP/dia).
join_limiter = RateLimiter(max_events=10, window_seconds=60)


def client_ip(request: Request) -> str:
    # Em dev atrás do Docker, o IP direto serve. Se virmos Nginx na frente
    # em produção (Fase 7), lemos X-Forwarded-For primeiro.
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
