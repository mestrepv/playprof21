"""
Content loader — lê aulas (jogos) de pastas com arquivos markdown.

Portado do module_lab do rpgia (commit-fonte: `backend/modules/module_lab/content_loader.py`).
Mudanças:
  - URL prefix de assets: /api/lesson/assets/<slug>/... (antes: /api/modules/module_lab/assets/).
  - KNOWN_MISSION_IDS começa vazio; vai crescer à medida que missions
    TSX forem registradas na Fase 4.

Estrutura esperada em backend/modules/lesson/games_content/:

    games_content/
    ├── atlas-v1/
    │   ├── game.yaml              # metadata do jogo
    │   ├── 01-capa.md             # slide 01 (tipo text)
    │   ├── 02-video.md            # slide 02 (tipo video)
    │   └── images/
    │       └── detector.png
    └── seminario-tese/
        └── ...

Cada arquivo .md tem frontmatter YAML + body:

    ---
    type: text
    label: "Velocidade média"
    ---

    # Velocidade média

    $$v = \\frac{\\Delta s}{\\Delta t}$$

Tipos suportados: text, video, quiz, mission, custom.
Schema validado por tipo; erros reportados e slide inválido é pulado
sem quebrar os outros slides ou jogos.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml


ASSET_URL_PREFIX = "/api/lesson/assets"


# ===========================================================================
# Exceções + erros acumulados
# ===========================================================================

@dataclass
class LoaderError:
    """Erro estruturado — legível por humano e por agente de IA."""
    source: str
    message: str

    def __str__(self) -> str:
        return f"{self.source}: {self.message}"


@dataclass
class LoadReport:
    """Relatório de carga: jogos validados + erros acumulados."""
    games: list[dict[str, Any]] = field(default_factory=list)
    errors: list[LoaderError] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return len(self.errors) == 0


# ===========================================================================
# Parse frontmatter + body
# ===========================================================================

_FRONTMATTER_RE = re.compile(
    r"^---\s*\n(?P<fm>.*?)\n---\s*\n?(?P<body>.*)$",
    re.DOTALL,
)


def parse_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    """
    Separa frontmatter YAML do body markdown.

    Retorna (frontmatter_dict, body_str). Sem frontmatter → ({}, text).

    Raises:
        yaml.YAMLError — frontmatter YAML inválido.
        ValueError     — frontmatter não é um dict.
    """
    m = _FRONTMATTER_RE.match(text)
    if not m:
        return {}, text
    fm_raw = m.group("fm")
    body = m.group("body")
    fm = yaml.safe_load(fm_raw) or {}
    if not isinstance(fm, dict):
        raise ValueError("frontmatter não é um dict YAML")
    return fm, body


# ===========================================================================
# Schema validation por tipo de slide
# ===========================================================================

VALID_SLIDE_TYPES = {"text", "video", "quiz", "mission", "custom",
                     "phet", "geogebra", "quiz-image", "quiz-fill"}


def _require(slide: dict, field_name: str, expected_type: type, source: str) -> LoaderError | None:
    if field_name not in slide:
        return LoaderError(source, f"campo '{field_name}' ausente")
    if not isinstance(slide[field_name], expected_type):
        actual = type(slide[field_name]).__name__
        exp = expected_type.__name__
        return LoaderError(source, f"campo '{field_name}' deve ser {exp}, é {actual}")
    return None


def validate_slide(slide: dict[str, Any], source: str) -> list[LoaderError]:
    """Valida um slide dict contra o schema do seu type. Retorna lista de erros."""
    errors: list[LoaderError] = []

    e = _require(slide, "type", str, source)
    if e:
        return [e]

    slide_type = slide["type"]
    if slide_type not in VALID_SLIDE_TYPES:
        return [LoaderError(
            source,
            f"type '{slide_type}' inválido. Válidos: {sorted(VALID_SLIDE_TYPES)}",
        )]

    for req_field in ("id", "label"):
        e = _require(slide, req_field, str, source)
        if e:
            errors.append(e)

    if slide_type == "text":
        e = _require(slide, "body", str, source)
        if e:
            errors.append(e)
        if "sideImage" in slide and not isinstance(slide["sideImage"], str):
            errors.append(LoaderError(source, "campo 'sideImage' deve ser string"))
        if "sideImageAlt" in slide and not isinstance(slide["sideImageAlt"], str):
            errors.append(LoaderError(source, "campo 'sideImageAlt' deve ser string"))
        if "sidePosition" in slide:
            pos = slide["sidePosition"]
            if pos not in ("left", "right"):
                errors.append(LoaderError(
                    source,
                    f"'sidePosition' deve ser 'left' ou 'right' (foi '{pos}')",
                ))

    elif slide_type == "video":
        e = _require(slide, "src", str, source)
        if e:
            errors.append(e)
        if "startAt" in slide and not isinstance(slide["startAt"], (int, float)):
            errors.append(LoaderError(source, "campo 'startAt' deve ser número"))

    elif slide_type == "quiz":
        for req in ("questionId", "stem"):
            e = _require(slide, req, str, source)
            if e:
                errors.append(e)
        if "options" not in slide:
            errors.append(LoaderError(source, "campo 'options' ausente"))
        else:
            opts = slide["options"]
            if not isinstance(opts, list):
                errors.append(LoaderError(source, "campo 'options' deve ser lista"))
            elif not (2 <= len(opts) <= 6):
                errors.append(LoaderError(source, f"'options' tem {len(opts)} itens — mínimo 2, máximo 6"))
            elif not all(isinstance(o, str) for o in opts):
                errors.append(LoaderError(source, "todas as 'options' devem ser strings"))
        if "correctIndex" not in slide:
            errors.append(LoaderError(source, "campo 'correctIndex' ausente"))
        elif not isinstance(slide["correctIndex"], int):
            errors.append(LoaderError(source, "'correctIndex' deve ser inteiro"))

    elif slide_type == "mission":
        e = _require(slide, "missionId", str, source)
        if e:
            errors.append(e)
        if "interactionMode" in slide:
            mode = slide["interactionMode"]
            if mode not in ("free", "master-led"):
                errors.append(LoaderError(
                    source,
                    f"'interactionMode' deve ser 'free' ou 'master-led' (foi '{mode}')",
                ))
        if "activities" in slide:
            acts = slide["activities"]
            if not isinstance(acts, list):
                errors.append(LoaderError(source, "'activities' deve ser lista"))
            else:
                for i, a in enumerate(acts):
                    if not isinstance(a, dict):
                        errors.append(LoaderError(source, f"activity[{i}] deve ser dict"))
                        continue
                    if "id" not in a or "label" not in a:
                        errors.append(LoaderError(
                            source,
                            f"activity[{i}] precisa de 'id' e 'label'",
                        ))

    elif slide_type == "custom":
        e = _require(slide, "componentId", str, source)
        if e:
            errors.append(e)
        if "props" in slide and not isinstance(slide["props"], dict):
            errors.append(LoaderError(source, "'props' deve ser dict"))

    elif slide_type == "phet":
        e = _require(slide, "simUrl", str, source)
        if e:
            errors.append(e)
        if "height" in slide and not isinstance(slide["height"], (int, float)):
            errors.append(LoaderError(source, "'height' deve ser número"))

    elif slide_type == "geogebra":
        e = _require(slide, "materialId", str, source)
        if e:
            errors.append(e)
        if "height" in slide and not isinstance(slide["height"], (int, float)):
            errors.append(LoaderError(source, "'height' deve ser número"))
        for bool_field in ("showToolbar", "showAlgebraInput"):
            if bool_field in slide and not isinstance(slide[bool_field], bool):
                errors.append(LoaderError(source, f"'{bool_field}' deve ser bool"))

    elif slide_type == "quiz-image":
        for req in ("questionId", "stem", "image"):
            e = _require(slide, req, str, source)
            if e:
                errors.append(e)
        if "options" not in slide:
            errors.append(LoaderError(source, "campo 'options' ausente"))
        else:
            opts = slide["options"]
            if not isinstance(opts, list):
                errors.append(LoaderError(source, "'options' deve ser lista"))
            elif not (2 <= len(opts) <= 6):
                errors.append(LoaderError(source, f"'options' tem {len(opts)} itens — mínimo 2, máximo 6"))
            elif not all(isinstance(o, str) for o in opts):
                errors.append(LoaderError(source, "todas as 'options' devem ser strings"))
        if "correctIndex" not in slide:
            errors.append(LoaderError(source, "campo 'correctIndex' ausente"))
        elif not isinstance(slide["correctIndex"], int):
            errors.append(LoaderError(source, "'correctIndex' deve ser inteiro"))
        if "imageAlt" in slide and not isinstance(slide["imageAlt"], str):
            errors.append(LoaderError(source, "'imageAlt' deve ser string"))

    elif slide_type == "quiz-fill":
        for req in ("questionId", "stem", "answer"):
            e = _require(slide, req, str, source)
            if e:
                errors.append(e)
        if "acceptedAnswers" in slide:
            aa = slide["acceptedAnswers"]
            if not isinstance(aa, list) or not all(isinstance(s, str) for s in aa):
                errors.append(LoaderError(source, "'acceptedAnswers' deve ser lista de strings"))
        if "hint" in slide and not isinstance(slide["hint"], str):
            errors.append(LoaderError(source, "'hint' deve ser string"))

    return errors


# ===========================================================================
# Rewrite de URLs relativas de imagens
# ===========================================================================

# ![alt](./images/foo.png) ou ![alt](images/foo.png)
_MD_IMG_RE = re.compile(
    r"(!\[[^\]]*\]\()(\.?/?images/[^)\s]+)(\))",
)

# <img src="./images/foo.svg" ...>
_HTML_IMG_RE = re.compile(
    r"(<img\b[^>]*?\bsrc=)([\"'])(\.?/?images/[^\"']+)(\2)",
    re.IGNORECASE,
)


def _rewrite_relative_image(url: str, game_slug: str) -> str:
    """Reescreve URL isolada (campo YAML, não markdown body). Absoluta → sem mudança."""
    if url.startswith(("http://", "https://", f"{ASSET_URL_PREFIX}/")):
        return url
    clean = url.lstrip("./")
    return f"{ASSET_URL_PREFIX}/{game_slug}/{clean}"


def rewrite_asset_urls(body: str, game_slug: str) -> str:
    """
    Re-escreve URLs relativas de imagens no body markdown.

    Input:  ![alt](./images/foo.png)
    Output: ![alt](/api/lesson/assets/atlas-v1/images/foo.png)
    """
    def replace_md(m: re.Match) -> str:
        prefix, url, suffix = m.group(1), m.group(2), m.group(3)
        clean = url.lstrip("./")
        new_url = f"{ASSET_URL_PREFIX}/{game_slug}/{clean}"
        return f"{prefix}{new_url}{suffix}"

    def replace_html(m: re.Match) -> str:
        prefix, quote, url, _close = m.group(1), m.group(2), m.group(3), m.group(4)
        clean = url.lstrip("./")
        new_url = f"{ASSET_URL_PREFIX}/{game_slug}/{clean}"
        return f"{prefix}{quote}{new_url}{quote}"

    body = _MD_IMG_RE.sub(replace_md, body)
    body = _HTML_IMG_RE.sub(replace_html, body)
    return body


# ===========================================================================
# Load de um jogo (pasta)
# ===========================================================================

def _slide_id_from_filename(path: Path) -> str:
    """01-capa.md → '01-capa'."""
    return path.stem


def _should_skip(path: Path) -> bool:
    """Ignora README, arquivos com _ ou . no início."""
    name = path.name
    if name.startswith("_") or name.startswith("."):
        return True
    if name.lower() == "readme.md":
        return True
    return False


def load_game_dir(game_dir: Path) -> tuple[dict[str, Any] | None, list[LoaderError]]:
    """Carrega um jogo a partir de uma pasta. Retorna (game_dict | None, errors)."""
    errors: list[LoaderError] = []
    source_prefix = str(game_dir.relative_to(game_dir.parent.parent))

    game_yaml = game_dir / "game.yaml"
    if not game_yaml.exists():
        errors.append(LoaderError(source_prefix, "game.yaml ausente"))
        return None, errors
    try:
        metadata = yaml.safe_load(game_yaml.read_text(encoding="utf-8")) or {}
    except yaml.YAMLError as e:
        errors.append(LoaderError(str(game_yaml), f"YAML inválido: {e}"))
        return None, errors

    for req in ("slug", "title", "version"):
        if req not in metadata:
            errors.append(LoaderError(str(game_yaml), f"campo '{req}' ausente"))
    if errors:
        return None, errors

    slug = metadata["slug"]
    title = metadata["title"]
    subject = metadata.get("subject")
    version = metadata["version"]

    slide_files = sorted(
        p for p in game_dir.glob("*.md") if not _should_skip(p)
    )
    slides: list[dict[str, Any]] = []

    for slide_path in slide_files:
        slide_source = str(slide_path.relative_to(game_dir.parent.parent))
        try:
            text = slide_path.read_text(encoding="utf-8")
            fm, body = parse_frontmatter(text)
        except (yaml.YAMLError, ValueError) as e:
            errors.append(LoaderError(slide_source, f"frontmatter inválido: {e}"))
            continue

        slide_id = _slide_id_from_filename(slide_path)
        slide: dict[str, Any] = {"id": slide_id, **fm}

        if slide.get("type") == "text":
            slide["body"] = rewrite_asset_urls(body.strip(), slug)
            if isinstance(slide.get("sideImage"), str):
                slide["sideImage"] = _rewrite_relative_image(slide["sideImage"], slug)

        if slide.get("type") == "quiz-image":
            if isinstance(slide.get("image"), str):
                slide["image"] = _rewrite_relative_image(slide["image"], slug)

        slide_errors = validate_slide(slide, slide_source)
        if slide_errors:
            errors.extend(slide_errors)
            continue

        slides.append(slide)

    manifest = {
        "version": 1,
        "gameSlug": slug,
        "title": title,
        "subject": subject,
        "slides": slides,
    }

    game_dict = {
        "slug": slug,
        "title": title,
        "subject": subject,
        "version": version,
        "manifest": manifest,
    }
    return game_dict, errors


# ===========================================================================
# Cross-check de missionId contra componentes TSX registrados
# ===========================================================================

# Começa vazio. Cada mission TSX portada na Fase 4 adiciona seu id aqui.
# Se criar uma missão nova no frontend, adicione o missionId aqui também —
# senão o validate CLI acusa que o componente não existe.
KNOWN_MISSION_IDS: set[str] = set()


def check_mission_ids(
    games: list[dict[str, Any]],
    known_ids: set[str] = KNOWN_MISSION_IDS,
) -> list[LoaderError]:
    """Varre slides mission; acusa missionIds sem componente TSX registrado."""
    errors: list[LoaderError] = []
    for game in games:
        slug = game.get("slug", "?")
        for slide in game.get("manifest", {}).get("slides", []):
            if slide.get("type") != "mission":
                continue
            mid = slide.get("missionId")
            if not mid:
                continue
            if mid not in known_ids:
                errors.append(LoaderError(
                    f"{slug}:{slide.get('id', '?')}",
                    f"missionId '{mid}' não tem componente TSX registrado. "
                    f"Esperado em frontend/src/modules/lesson/games/<game>/components.ts",
                ))
    return errors


def load_games_from_dir(root: Path | str) -> LoadReport:
    """Percorre `root` procurando subpastas com game.yaml."""
    root = Path(root)
    report = LoadReport()

    if not root.exists():
        report.errors.append(LoaderError(str(root), "pasta não existe"))
        return report

    if not root.is_dir():
        report.errors.append(LoaderError(str(root), "não é um diretório"))
        return report

    for child in sorted(root.iterdir()):
        if not child.is_dir():
            continue
        if child.name.startswith("_") or child.name.startswith("."):
            continue
        game, errors = load_game_dir(child)
        report.errors.extend(errors)
        if game is not None:
            report.games.append(game)

    return report


# ===========================================================================
# Helpers de caminho
# ===========================================================================

def games_content_root() -> Path:
    """Pasta com os jogos — convenção fixa em labprof21."""
    return Path(__file__).parent / "games_content"
