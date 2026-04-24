# labprof21 — guia operacional pro Claude Code

## ⚠️ Ambiente: tudo roda dentro do Docker

`node_modules` **não existe no host** — fica num volume anônimo do container.
Nunca rode `npm` ou `tsc` diretamente no terminal do host. Sempre use `docker compose exec`.

```bash
# TypeScript type check
docker compose exec web npx tsc --noEmit

# Build de produção
docker compose exec web npm run build

# Instalar nova dependência
docker compose exec web npm install <pkg>

# Executar qualquer comando Python no backend
docker compose exec api python -m <modulo>
```

---

## Como rodar

```bash
cd /home/play-prof21/htdocs/labprof21

docker compose up -d                     # sobe db + api + web
curl -s http://localhost:5105/health     # esperado: {"status":"ok","db":true}

docker compose logs -f api               # logs backend (uvicorn --reload)
docker compose logs -f web               # logs frontend (Vite HMR)

docker compose down                      # para (mantém banco)
docker compose down -v                   # para e apaga banco
```

**Portas:**

| Serviço | Host | Container |
|---------|------|-----------|
| Postgres 16 | 5435 | 5432 |
| FastAPI (api) | 5105 | 5105 |
| Vite dev (web) | 5174 | 5174 |

**Hot-reload:** backend via `uvicorn --reload` (volume `./backend:/app`), frontend via Vite HMR (volume `./frontend:/app`, `node_modules` no volume anônimo).

---

## Estado atual

**Foco atual:** portando funcionalidades do play.prof21.com.br para o labprof21.
O deploy (Fase 8 do ROADMAP) fica para depois da paridade de features.

Funcionalidades já portadas do play.prof21:
- Dashboard do professor (estilo visual: stats, turmas, trilhas — `dashboard.css` + `TeacherPage.tsx`)

Para ver o histórico de fases concluídas: [`docs/ROADMAP.md`](docs/ROADMAP.md).

---

## Stack (inegociável)

| Camada | Tecnologia |
|--------|-----------|
| Backend | FastAPI + SQLAlchemy + Postgres 16 |
| Frontend | React 19 + TypeScript + Vite 6 |
| Realtime | WebSocket nativo (FastAPI) |
| Infra | Docker Compose |

---

## Estrutura de pastas

```
labprof21/
├── backend/
│   ├── main.py                    # entry point FastAPI + lifespan (create_all)
│   ├── database.py                # SQLAlchemy engine + Session + Base
│   ├── modules/
│   │   ├── auth/                  # JWT (HS256, 7d), bcrypt, /api/auth/*
│   │   ├── domain/                # turmas, trilhas, atividades, assignments
│   │   │   ├── routes.py          # professor: CRUD classrooms/trails/activities
│   │   │   ├── student_routes.py  # aluno: classrooms, trail progress, results
│   │   │   ├── models.py          # SQLAlchemy ORM
│   │   │   └── schemas.py         # Pydantic schemas
│   │   ├── feed/                  # posts, comments, likes por turma
│   │   └── lesson/                # runtime de lições interativas (slides + WebSocket)
│   │       ├── routes.py          # /api/lesson/* (games, assets)
│   │       ├── connection_manager.py
│   │       └── games_content/     # conteúdo .md das aulas (atlas-v1, etc.)
│
└── frontend/src/
    ├── App.tsx                    # BrowserRouter + rotas
    ├── styles/
    │   ├── theme.css              # tokens globais (--p21-*, paleta, tipografia)
    │   └── dashboard.css          # classes .db-* do dashboard do professor
    ├── components/ui/             # AppShell, Button, Card, Sidebar, Input…
    └── modules/
        ├── auth/                  # AuthContext, LoginPage, RegisterPage
        ├── teacher/               # TeacherPage (dashboard), ClassroomPage, LibraryPage
        ├── student/               # StudentDashboard, TrailPage, StudentJoinPage
        ├── live/                  # SessionPage, JoinPage (aula ao vivo)
        ├── lesson/                # SlideRenderer, componentes TSX de missão, preview
        ├── profile/               # ProfilePage
        └── settings/              # SettingsPage
```

---

## Rotas frontend

| Path | Componente | Auth |
|------|-----------|------|
| `/` | IndexPage | pública |
| `/login`, `/register` | auth | pública |
| `/teacher` | TeacherPage | professor |
| `/teacher/classroom/:id` | ClassroomPage | professor |
| `/teacher/library` | LibraryPage | professor |
| `/student` | StudentDashboard | aluno |
| `/student/trail/:id` | TrailPage | aluno |
| `/student/join` | StudentJoinPage | pública |
| `/lesson/session/:sid` | SessionPage | qualquer |
| `/lesson/join` | JoinPage | pública |
| `/lesson/preview/:slug` | PreviewPage | pública |
| `/profile`, `/settings` | páginas auth | qualquer autenticado |

---

## API endpoints principais

```
# Auth
POST /api/auth/register   {display_name, email, password}
POST /api/auth/login      {email, password} → {token}
GET  /api/auth/me
PATCH /api/auth/me        {display_name}

# Professor — banco de conteúdos
GET/POST          /api/classrooms
GET/PATCH/DELETE  /api/classrooms/{id}
GET               /api/classrooms/{id}/stats
GET/POST          /api/classrooms/{id}/assignments
DELETE            /api/assignments/{id}

GET/POST          /api/activities
GET/DELETE        /api/activities/{id}

GET/POST          /api/trails
GET/PATCH/DELETE  /api/trails/{id}
GET/POST          /api/trails/{id}/activities
DELETE            /api/trails/{id}/activities/{aid}
PUT               /api/trails/{id}/order            # reordena

GET/POST          /api/interactive-lessons
DELETE            /api/interactive-lessons/{id}

GET               /api/teacher/stats               # {classrooms, activities, trails, students}

# Aluno
GET               /api/student/classrooms
GET               /api/student/classrooms/{id}/assignments
GET               /api/student/trails/{id}          # TrailProgress com stars
POST              /api/student/activity-results

# Feed
GET/POST          /api/classrooms/{id}/posts
POST              /api/posts/{pid}/like

# Lições interativas (lesson)
GET               /api/lesson/games
GET               /api/lesson/games/{slug}
GET               /api/lesson/assets/{slug}/{path}

# Aula ao vivo (live)
POST              /api/lesson/sessions
GET               /api/lesson/sessions/{id}
POST              /api/lesson/join           {code, display_name} → {session_id, anon_id}
WS                /ws/lesson/session/{id}?token=&anon_id=&display_name=
```

---

## Design system — tokens CSS

O código usa **somente** tokens `--p21-*` do `theme.css`. Nunca use cores hardcoded.

```css
/* Superfícies */
--p21-bg           /* fundo da página (#f0efed) */
--p21-surface      /* cards, painéis (#fff) */
--p21-border       /* borda leve (rgba 0,0,0,.08) */
--p21-border-strong

/* Texto */
--p21-ink          /* primário (#1a1a1a) */
--p21-ink-2        /* secundário (#424955) */
--p21-ink-3        /* muted (#6b7280) */

/* Ações */
--p21-primary      /* botão verde (#2f6e00) */
--p21-blue         /* links/navegação (#185fa5) */
--p21-purple       /* role teacher (#534ab7) */
--p21-amber        /* avisos/estrelas (#e8a53a) */
--p21-coral        /* perigo (#d4474a) */

/* Tipografia */
--p21-font-sans    /* Inter */
--p21-font-display /* Space Grotesk (headings) */
--p21-font-mono    /* JetBrains Mono */

/* Espaçamento */
--p21-sp-{1..10}   /* 4/8/12/16/20/24/32/40/56/72 px */

/* Raios */
--p21-radius-sm/md/lg/xl/pill
```

**Dashboard:** classes `.db-*` definidas em `src/styles/dashboard.css` (portado do play.prof21.com.br).

---

## Convenções de código

| Elemento | Padrão | Exemplo |
|----------|--------|---------|
| Arquivos React | PascalCase | `TeacherPage.tsx` |
| Funções/variáveis | camelCase | `classroomColor()` |
| Interfaces TS | PascalCase | `Classroom` |
| Classes CSS | BEM-like ou `.db-*` | `.db-turma-row` |
| Tabelas DB | snake_case plural | `trail_activities` |
| Endpoints API | kebab-case REST | `GET /api/classrooms/:id` |

**Frontend sem framework de CSS** — inline styles para componentes isolados, `dashboard.css` para o dashboard, `theme.css` para tokens globais.

**Backend:** SQLAlchemy ORM + Pydantic schemas. `create_all` no lifespan. Sem migrations automáticas — adicionar colunas direto no model e recriar com `docker compose down -v && docker compose up -d`.

---

## Armadilhas conhecidas

1. **`node_modules` no host está vazio** — é um volume anônimo Docker. Qualquer `npm install` ou `tsc` no host vai falhar.
2. **Recriar banco** apaga tudo: `docker compose down -v && docker compose up -d`
3. **`npm run build`** roda `tsc && vite build` — sempre checar erros TS antes do build.
4. **JWT do aluno** é gerado no join (`/api/classrooms/join`), não tem senha — campo `email` e `password_hash` são NULL para alunos.
5. **`visibility`** em activities/trails: só `private` implementado. `public` reservado para futuro.

---

## Telemetria — regras invioláveis

[`EVENTOS.md`](EVENTOS.md) é o contrato formal dos eventos implementados no ATLAS.
As regras abaixo valem para toda sessão de trabalho.

**Canal de telemetria ATLAS:**
```
onMissionEvent (componente Mission)
  → handleMissionEvent (MissionSlide.tsx:50–54)
  → adapter.logEvent
  → WS → tabela live_events
```

1. **`EVENTOS.md` é contrato.** Mudança em payload, nome ou condição de disparo
   exige atualização sincronizada de `EVENTOS.md` e do código no **mesmo** commit/PR.
2. **Eventos novos só existem após entrada em `EVENTOS.md`.** Se não há entrada,
   pare e peça ao humano para adicionar primeiro.
3. **Não use `useTelemetry` em componentes Mission.** Em sessão ativa retorna `void`
   — o evento seria silenciosamente perdido. Use exclusivamente
   `onMissionEvent` → `handleMissionEvent` → `adapter.logEvent`.
4. **Nomenclatura: `atlas.<missao>.<verbo>` (verbo em camelCase).** HypatiaTutorial
   usa 4 segmentos (`atlas.hypatia.tutorial.<verbo>`) — motivo documentado em
   `EVENTOS.md`; não normalizar.
5. **Zero PII nos payloads.** Proibido: email, nome, displayName, studentName, cpf,
   telefone, data de nascimento, IP, user-agent, ou qualquer texto livre digitado
   pelo aluno em campo de identificação. Identificar aluno-na-sessão apenas por
   `membership_id` (injetado server-side).
6. **Não modifique eventos legados (`atlas.*.layerFocused`).** Coexistem com os
   eventos novos em paralelo.
7. **Não suprima emissão por causa de `readOnly`.** Quando a interação acontece,
   o evento é emitido — `source: 'self'` ou `'master-propagation'` indica a origem.
8. **Testes de instrumentação são obrigatórios.** Para cada evento novo ou
   modificado: teste de integração que renderiza o componente, simula a interação
   e verifica o payload completo (não apenas que a função foi chamada).
9. **Antes de modificar telemetria, leia o código atual.** Não presuma estrutura
   de [`adapter.ts`](frontend/src/modules/live/adapter.ts),
   [`MissionSlide.tsx`](frontend/src/modules/lesson/components/MissionSlide.tsx)
   ou dos componentes Mission.
10. **Refatorações fora do escopo do PR são proibidas.** Notar code smell → anotar
    para o humano → seguir. Não refatorar no mesmo PR.
11. **Trabalhos pós-piloto não devem ser antecipados** sem instrução explícita:
    migração para Alembic, discriminated union Pydantic, `event_id` cliente,
    idempotência, `clientTs + serverTs`, `event_version`, tabela de quarentena,
    pseudonimização além de `membership_id`.

---

## Documentação

| Arquivo | Conteúdo |
|---------|---------|
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Todas as fases, critérios de aceite, decisões fechadas |
