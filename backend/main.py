"""
labprof21 — entry point do backend.

Em Fase 1 temos apenas /health e um WebSocket echo em /ws/echo — suficiente
pra validar que uvicorn, Postgres e WS estão falando. Fases seguintes
plugam o content_loader do modules/lesson + WebSocket de sessão de aula.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from database import Base, engine

# Importa os modelos pro Base.metadata conhecer as tabelas antes de create_all.
# noqa: F401 — side-effect-only imports
from modules.auth import models as _auth_models  # noqa: F401
from modules.auth.routes import router as auth_router
from modules.domain import models as _domain_models  # noqa: F401
from modules.domain.routes import router as domain_router
from modules.domain.student_routes import router as student_router
from modules.feed import models as _feed_models  # noqa: F401
from modules.feed.routes import router as feed_router
from modules.lesson.routes import router as lesson_router
from modules.live import models as _live_models  # noqa: F401
from modules.live.routes import router as live_router
from modules.live.websocket import session_ws


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Cria tabelas que já existirem nos modelos. Em fase inicial há zero
    # tabelas; serve só de smoke test da conexão.
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="labprof21 API",
    version="0.0.1",
    description="Aulas interativas síncronas — pipeline AI-first (.md + TSX por missionId).",
    lifespan=lifespan,
)

# CORS liberal em dev. Produção vai fechar por domínio.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(lesson_router)
app.include_router(auth_router)
app.include_router(domain_router)
app.include_router(student_router)
app.include_router(feed_router)
app.include_router(live_router)


@app.websocket("/ws/lesson/session/{sid}")
async def _ws_session(ws: WebSocket, sid: str, token: str | None = None, anon_id: str | None = None, display_name: str | None = None):
    """Wrapper — FastAPI precisa do decorator aqui; delega pra session_ws."""
    import uuid as _uuid
    try:
        sid_uuid = _uuid.UUID(sid)
    except ValueError:
        await ws.close(code=4400)
        return
    await session_ws(ws, sid_uuid, token=token, anon_id=anon_id, display_name=display_name)


@app.get("/health")
def health():
    """Health check — confirma que a API sobe e o Postgres responde."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_ok = True
    except Exception as e:  # noqa: BLE001 — reporta o erro direto
        db_ok = False
        db_error = str(e)
    payload = {"status": "ok", "db": db_ok}
    if not db_ok:
        payload["db_error"] = db_error  # type: ignore[assignment]
    return payload


@app.websocket("/ws/echo")
async def ws_echo(ws: WebSocket):
    """Echo trivial — recebe texto, devolve `echo: <texto>`. Smoke test."""
    await ws.accept()
    try:
        while True:
            msg = await ws.receive_text()
            await ws.send_text(f"echo: {msg}")
    except WebSocketDisconnect:
        pass
