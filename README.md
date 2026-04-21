# labprof21

Aulas interativas síncronas — plataforma pedagógica do prof21.

**Stack:** FastAPI + Postgres + React 19 + Vite, tudo em Docker Compose.
**Paradigma:** AI-first. Conteúdo em `.md` + frontmatter YAML; animações em
`.tsx` registradas por `missionId`. Sem editor WYSIWYG.

## Rodando em dev

```bash
cp .env.example .env         # opcional; defaults funcionam
docker compose up
```

Sobe 3 serviços:

| Serviço | Porta | Descrição |
|---|---|---|
| `db` | `localhost:5435` | Postgres 16 |
| `api` | `localhost:5105` | FastAPI com uvicorn `--reload` |
| `web` | `localhost:5174` | React + Vite dev server com HMR |

Abra <http://localhost:5174> — deve mostrar API, Postgres e WebSocket todos ✓.

## Comandos úteis

```bash
docker compose logs -f api       # logs do backend
docker compose logs -f web       # logs do Vite
docker compose exec db psql -U labprof21  # psql dentro do container
docker compose down              # para tudo, mantém volume
docker compose down -v           # para tudo e apaga banco
```

## Estrutura

```
labprof21/
├── docker-compose.yml
├── .env.example
├── backend/                  FastAPI
│   ├── main.py
│   ├── database.py
│   ├── requirements.txt
│   └── modules/
│       └── lab/              módulo de aulas (a portar do module_lab)
│           └── games_content/
└── frontend/                 React + Vite
    └── src/
        └── modules/
            └── lab/          runtime de aulas (a portar)
```

## Roadmap

- **Fase 1** ✅ setup Docker + FastAPI `/health` + WebSocket echo + React splash
- **Fase 2** porta `content_loader.py` + `TextSlide.tsx` + schemas do module_lab
- **Fase 3** schema de domínio (turmas/trilhas/coleções) + auth
- **Fase 4** runtime de aulas (TextSlide, MissionSlide, SlideRouter)
- **Fase 5** sessão com código + QR code (entrada do aluno)
- **Fase 6** PlanckGo wire (áudio/imagens de Física)
- **Fase 7** deploy em produção
