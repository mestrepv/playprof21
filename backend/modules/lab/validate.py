"""
CLI de validação de aulas.

Uso (fora do container):
    cd /home/play-prof21/htdocs/labprof21
    docker compose exec api python -m modules.lab.validate [caminho/da/pasta]

Dentro do container:
    python -m modules.lab.validate

Default: backend/modules/lab/games_content/.

Exit codes:
  0 — todas as aulas válidas
  1 — erros encontrados (listados no stdout)
  2 — pasta não existe

Agentes de IA chamam isso antes de considerar uma edição concluída.
"""

from __future__ import annotations

import sys
from pathlib import Path

from .content_loader import check_mission_ids, games_content_root, load_games_from_dir


def main(argv: list[str] | None = None) -> int:
    argv = argv if argv is not None else sys.argv[1:]

    target = Path(argv[0]) if argv else games_content_root()

    if not target.exists():
        print(f"ERRO: pasta não existe: {target}", file=sys.stderr)
        return 2

    report = load_games_from_dir(target)
    mission_errors = check_mission_ids(report.games)

    print(f"Pasta analisada: {target}")
    print(f"Jogos carregados: {len(report.games)}")
    for g in report.games:
        slides = g["manifest"]["slides"]
        types: dict[str, int] = {}
        for s in slides:
            t = s.get("type", "?")
            types[t] = types.get(t, 0) + 1
        breakdown = ", ".join(f"{n} {t}" for t, n in sorted(types.items()))
        print(f"  OK {g['slug']:30s} v{g['version']}  ({len(slides)} slides: {breakdown})")

    if report.errors:
        print(f"\nERROS ({len(report.errors)}):")
        for err in report.errors:
            print(f"  x {err}")

    if mission_errors:
        print(f"\nMISSION IDS SEM COMPONENTE ({len(mission_errors)}):")
        for err in mission_errors:
            print(f"  x {err}")

    if report.errors or mission_errors:
        return 1

    print("\nTudo OK.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
