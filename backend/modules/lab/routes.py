"""
Rotas HTTP da Fase 2: listar jogos, servir manifest, servir assets.

Nenhuma sessão, auth ou persistência aqui — só leitura do disco.
Fases 3+ plugam auth e persistência em cima.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from .content_loader import (
    LoadReport,
    games_content_root,
    load_game_dir,
    load_games_from_dir,
)


router = APIRouter(prefix="/api/lab", tags=["lab"])


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
