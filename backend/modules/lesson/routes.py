"""
Rotas HTTP da Fase 2: listar jogos, servir manifest, servir assets.

Nenhuma sessão, auth ou persistência aqui — só leitura do disco.
Fases 3+ plugam auth e persistência em cima.
"""

from __future__ import annotations

import re
import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from ..auth.deps import get_current_user, require_teacher
from ..auth.models import User
from ..domain.models import SlideEvent
from .content_loader import (
    LoadReport,
    games_content_root,
    load_game_dir,
    load_games_from_dir,
    parse_frontmatter,
    validate_slide,
    rewrite_asset_urls,
    _rewrite_relative_image,
)


router = APIRouter(prefix="/api/lesson", tags=["lesson"])


def _list_report() -> LoadReport:
    return load_games_from_dir(games_content_root())


@router.get("/games")
def list_games() -> dict:
    """Lista os jogos disponíveis. Resposta leve (sem slides)."""
    report = _list_report()
    return {
        "games": [
            {
                "slug": g["slug"],
                "title": g["title"],
                "subject": g.get("subject"),
                "version": g["version"],
                "slideCount": len(g["manifest"]["slides"]),
            }
            for g in report.games
        ],
        "errors": [str(e) for e in report.errors],
    }


@router.get("/games/{slug}")
def get_game(slug: str) -> dict:
    """Retorna manifest completo (slides incluídos) do jogo."""
    root = games_content_root()
    game_dir = root / slug
    # Sanity: exige que o dir esteja dentro do root (sem ../).
    try:
        game_dir.resolve().relative_to(root.resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="slug inválido")
    if not game_dir.is_dir():
        raise HTTPException(status_code=404, detail=f"jogo '{slug}' não encontrado")

    game, errors = load_game_dir(game_dir)
    if game is None:
        raise HTTPException(
            status_code=500,
            detail={"message": "falha ao carregar jogo", "errors": [str(e) for e in errors]},
        )
    return {
        "game": game,
        "errors": [str(e) for e in errors],
    }


@router.get("/assets/{slug}/{path:path}")
def get_asset(slug: str, path: str):
    """
    Serve arquivo de asset de um jogo (imagens, SVGs).

    Protegido contra path traversal: o path final precisa estar dentro de
    games_content/<slug>/. Qualquer resolução pra fora → 400.
    """
    root = games_content_root().resolve()
    game_dir = (root / slug).resolve()

    try:
        game_dir.relative_to(root)
    except ValueError:
        raise HTTPException(status_code=400, detail="slug inválido")

    if not game_dir.is_dir():
        raise HTTPException(status_code=404, detail=f"jogo '{slug}' não encontrado")

    target = (game_dir / path).resolve()
    try:
        target.relative_to(game_dir)
    except ValueError:
        raise HTTPException(status_code=400, detail="caminho inválido")

    if not target.is_file():
        raise HTTPException(status_code=404, detail="asset não encontrado")

    return FileResponse(target)


# ── Helpers de validação de slug/filename ────────────────────────────────

_SAFE_NAME = re.compile(r'^[a-zA-Z0-9_\-]+$')
_SAFE_FILENAME = re.compile(r'^[a-zA-Z0-9_\-]+\.md$')
_SAFE_IMG = re.compile(r'^[a-zA-Z0-9_\-]+\.(png|jpg|jpeg|svg|webp|gif)$', re.IGNORECASE)

ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/svg+xml", "image/webp", "image/gif"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5 MB


def _safe_game_dir(slug: str) -> Path:
    if not _SAFE_NAME.match(slug):
        raise HTTPException(status_code=400, detail="slug inválido")
    root = games_content_root().resolve()
    game_dir = (root / slug).resolve()
    try:
        game_dir.relative_to(root)
    except ValueError:
        raise HTTPException(status_code=400, detail="slug inválido")
    return game_dir


def _safe_slide_path(slug: str, filename: str) -> tuple[Path, Path]:
    if not _SAFE_FILENAME.match(filename):
        raise HTTPException(status_code=400, detail="filename inválido (use letras, números, - e _; extensão .md)")
    game_dir = _safe_game_dir(slug)
    slide_path = (game_dir / filename).resolve()
    try:
        slide_path.relative_to(game_dir)
    except ValueError:
        raise HTTPException(status_code=400, detail="caminho inválido")
    return game_dir, slide_path


# ── Endpoints de escrita (requerem teacher autenticado) ──────────────────

class CreateGameBody(BaseModel):
    slug: str
    title: str
    subject: str = ""
    version: int = 1


class SaveSlideBody(BaseModel):
    content: str  # conteúdo raw do arquivo .md


@router.post("/games", status_code=201, dependencies=[Depends(require_teacher)])
def create_game(body: CreateGameBody) -> dict:
    """Cria nova pasta de jogo + game.yaml."""
    if not _SAFE_NAME.match(body.slug):
        raise HTTPException(status_code=400, detail="slug inválido")
    game_dir = _safe_game_dir(body.slug)
    if game_dir.exists():
        raise HTTPException(status_code=409, detail=f"jogo '{body.slug}' já existe")
    game_dir.mkdir(parents=True)
    (game_dir / "images").mkdir()
    yaml_content = (
        f"slug: {body.slug}\n"
        f"title: \"{body.title}\"\n"
    )
    if body.subject:
        yaml_content += f"subject: \"{body.subject}\"\n"
    yaml_content += f"version: {body.version}\n"
    (game_dir / "game.yaml").write_text(yaml_content, encoding="utf-8")
    return {"slug": body.slug, "title": body.title, "subject": body.subject, "version": body.version, "slideCount": 0}


@router.put("/games/{slug}/{filename}", dependencies=[Depends(require_teacher)])
def save_slide(slug: str, filename: str, body: SaveSlideBody) -> dict:
    """Salva (cria ou sobrescreve) um slide .md. Valida antes de gravar."""
    game_dir, slide_path = _safe_slide_path(slug, filename)
    if not game_dir.exists():
        raise HTTPException(status_code=404, detail=f"jogo '{slug}' não encontrado")

    try:
        from yaml import YAMLError
        fm, body_text = parse_frontmatter(body.content)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"frontmatter inválido: {e}")

    slide_id = slide_path.stem
    slide = {"id": slide_id, **fm}

    if slide.get("type") == "text":
        slide["body"] = rewrite_asset_urls(body_text.strip(), slug)
        if isinstance(slide.get("sideImage"), str):
            slide["sideImage"] = _rewrite_relative_image(slide["sideImage"], slug)
    if slide.get("type") == "quiz-image":
        if isinstance(slide.get("image"), str):
            slide["image"] = _rewrite_relative_image(slide["image"], slug)

    errors = validate_slide(slide, filename)
    if errors:
        raise HTTPException(status_code=422, detail=[str(e) for e in errors])

    slide_path.write_text(body.content, encoding="utf-8")
    return {"saved": True, "slide": slide}


@router.delete("/games/{slug}/{filename}", dependencies=[Depends(require_teacher)])
def delete_slide(slug: str, filename: str) -> Response:
    """Remove um slide .md."""
    game_dir, slide_path = _safe_slide_path(slug, filename)
    if not game_dir.exists():
        raise HTTPException(status_code=404, detail=f"jogo '{slug}' não encontrado")
    if not slide_path.exists():
        raise HTTPException(status_code=404, detail="slide não encontrado")
    slide_path.unlink()
    return Response(status_code=204)


@router.post("/assets/{slug}", dependencies=[Depends(require_teacher)])
async def upload_asset(slug: str, file: UploadFile = File(...)) -> dict:
    """Faz upload de imagem para games_content/{slug}/images/."""
    game_dir = _safe_game_dir(slug)
    if not game_dir.exists():
        raise HTTPException(status_code=404, detail=f"jogo '{slug}' não encontrado")
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=415, detail=f"tipo não suportado: {file.content_type}")

    safe_name = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', file.filename or "upload")
    if not _SAFE_IMG.match(safe_name):
        raise HTTPException(status_code=400, detail="nome de arquivo inválido")

    images_dir = game_dir / "images"
    images_dir.mkdir(exist_ok=True)
    dest = images_dir / safe_name

    data = await file.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="arquivo maior que 5 MB")
    dest.write_bytes(data)

    return {"url": f"/api/lesson/assets/{slug}/images/{safe_name}", "filename": safe_name}


# ── Telemetria de slides (interações fora de sessão ao vivo) ─────────────

class SlideEventBody(BaseModel):
    lesson_slug: str
    slide_id: str
    event_type: str
    payload: dict = {}


@router.post("/events", status_code=201)
def record_event(
    body: SlideEventBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Registra evento de interação com slide (fora de sessão ao vivo)."""
    ev = SlideEvent(
        user_id=user.id,
        lesson_slug=body.lesson_slug,
        slide_id=body.slide_id,
        event_type=body.event_type,
        payload=body.payload,
    )
    db.add(ev)
    db.commit()
    return {"recorded": True}


@router.get("/events/{slug}", dependencies=[Depends(require_teacher)])
def list_events(slug: str, db: Session = Depends(get_db)) -> dict:
    """Lista eventos de um slug de aula (somente professor)."""
    from sqlalchemy import select
    rows = db.execute(
        select(SlideEvent)
        .where(SlideEvent.lesson_slug == slug)
        .order_by(SlideEvent.ts.desc())
        .limit(500)
    ).scalars().all()
    return {
        "events": [
            {
                "id": str(r.id),
                "user_id": str(r.user_id) if r.user_id else None,
                "slide_id": r.slide_id,
                "event_type": r.event_type,
                "payload": r.payload,
                "ts": r.ts.isoformat(),
            }
            for r in rows
        ]
    }
