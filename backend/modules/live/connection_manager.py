"""
ConnectionManager — registro de WebSockets vivos por sessão.

Portado do module_lab do rpgia (runtime/connection_manager.py). In-process
singleton; pra múltiplas réplicas futuras, troca por Redis pub/sub sem
mudar a interface.

Thread-safety: FastAPI + asyncio é single-thread por event loop; não
precisamos de lock. Se promovermos pra multi-worker, cada worker tem seu
manager — os clientes de um worker não enxergam os do outro sem um bus
externo.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from typing import Any

from fastapi import WebSocket


log = logging.getLogger(__name__)


@dataclass
class ConnectionMeta:
    session_id: uuid.UUID
    membership_id: uuid.UUID
    role: str  # 'master' | 'player'
    display_name: str


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[uuid.UUID, set[WebSocket]] = {}
        self._meta: dict[WebSocket, ConnectionMeta] = {}

    async def connect(
        self,
        ws: WebSocket,
        *,
        session_id: uuid.UUID,
        membership_id: uuid.UUID,
        role: str,
        display_name: str,
    ) -> None:
        await ws.accept()
        self._connections.setdefault(session_id, set()).add(ws)
        self._meta[ws] = ConnectionMeta(session_id, membership_id, role, display_name)

    def disconnect(self, ws: WebSocket) -> ConnectionMeta | None:
        meta = self._meta.pop(ws, None)
        if meta is None:
            return None
        conns = self._connections.get(meta.session_id)
        if conns is not None:
            conns.discard(ws)
            if not conns:
                self._connections.pop(meta.session_id, None)
        return meta

    def meta_for(self, ws: WebSocket) -> ConnectionMeta | None:
        return self._meta.get(ws)

    async def send(self, ws: WebSocket, payload: dict[str, Any]) -> None:
        try:
            await ws.send_json(payload)
        except Exception:  # noqa: BLE001
            # Conexão quebrou; remove silenciosamente. O disconnect final
            # vem do loop principal quando a exceção propaga.
            log.debug("send failed; dropping ws", exc_info=True)
            self.disconnect(ws)

    async def broadcast(
        self,
        session_id: uuid.UUID,
        payload: dict[str, Any],
        *,
        exclude: WebSocket | None = None,
        only_role: str | None = None,
    ) -> None:
        for ws in list(self._connections.get(session_id, set())):
            if ws is exclude:
                continue
            if only_role is not None:
                meta = self._meta.get(ws)
                if meta is None or meta.role != only_role:
                    continue
            await self.send(ws, payload)

    def participants(self, session_id: uuid.UUID) -> list[ConnectionMeta]:
        return [
            self._meta[ws]
            for ws in self._connections.get(session_id, set())
            if ws in self._meta
        ]


manager = ConnectionManager()
