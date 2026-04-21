# labprof21 — Roadmap

Este arquivo rastreia as fases de construção do labprof21 e serve como fonte
de verdade quando o desenvolvimento ficar ambíguo. Ao concluir um item,
trocar `[ ]` por `[x]`. Ao fechar uma fase, trocar `Status: ⬜` por
`Status: ✅ YYYY-MM-DD`.

**Paradigma inegociável:** conteúdo em `.md` + frontmatter YAML; animações
em `.tsx` registradas por `missionId`. IA cria arquivos, humano revisa.
Sem editor WYSIWYG.

**Stack inegociável:** FastAPI + Postgres + React 19 + Vite.

---

## Fase 1 — Setup Docker + smoke test

**Status:** ✅ concluída em 2026-04-21 (commit `7c5e95f`)

Objetivo: provar que os 3 serviços sobem, conversam e respondem.

- [x] `docker-compose.yml` com `db` (Postgres 16), `api` (FastAPI),
      `web` (Vite)
- [x] Backend FastAPI com `/health` + `/ws/echo`
- [x] Frontend React 19 + Vite com splash de smoke test
- [x] Hot-reload de backend e frontend funcionando via volumes
- [x] `README.md` com instruções
- [x] Git init + commit inicial

**Portas:** 5435 (db), 5105 (api), 5174 (web).

---

## Fase 2 — Portar pipeline de conteúdo do module_lab

**Status:** ✅ concluída em 2026-04-21

Objetivo: renderizar uma aula `.md` do disco. Nada de sessão, auth ou
banco ainda — só leitura de arquivos e render markdown.

### Backend

- [x] Portar `content_loader.py` do module_lab (parse frontmatter + YAML + validação de schema por tipo: text/video/quiz/mission/custom)
- [x] Portar `validate.py` CLI (`docker compose exec api python -m modules.lab.validate`)
- [x] Adaptar `rewrite_asset_urls` (markdown `![]()` + HTML `<img>`) — novo prefix `/api/lab/assets/`
- [x] Rota `GET /api/lab/games` — lista aulas
- [x] Rota `GET /api/lab/games/{slug}` — retorna manifest
- [x] Rota `GET /api/lab/assets/{slug}/{path:path}` — serve imagens/SVGs com path traversal protection

### Frontend

- [x] Portar `TextSlide.tsx` (remark-gfm + rehype-raw + KaTeX)
- [x] Portar `VideoSlide.tsx` (YouTube + Vimeo embed)
- [x] Portar `SlideShell.tsx` + tokens CSS + helpers.css (escopo `[data-lab-root]`)
- [x] Portar `Math` component (KaTeX)
- [x] Página de preview `/lab/preview/:slug` (sem sessão, adapter mock, atalhos ←/→/Space/Home/End)
- [x] `SlideRenderer` despacha por `type`; mission/quiz/custom ficam como placeholder pra Fase 3-4

### Conteúdo

- [x] Copiar `atlas-v1` e `seminario-tese` do module_lab como seeds
- [x] `validate.py` carrega os 2 jogos (10 + 16 slides). 6 erros esperados de `missionId` — componentes TSX só chegam na Fase 4

**Critério de aceite atingido:** `/api/lab/games/seminario-tese` devolve os 16 slides, asset rewrite funciona, path traversal bloqueado. Preview em `http://localhost:5174/lab/preview/seminario-tese` com navegação por teclado (←/→/Space/Home/End).

---

## Fase 3 — Schema de domínio + auth

**Status:** ✅ concluída em 2026-04-21

Objetivo: modelar como aulas se organizam pedagogicamente (turmas,
trilhas, coleções) e quem é quem (professor, aluno).

### Modelagem

Refatorada no mesmo dia pra adotar modelo **banco-de-conteúdos** (estilo Moodle Content Bank + H5P) — extinguindo os nomes `track`/`collection`/`lesson` como ficaram no play.prof21 legado.

**Tabelas:**
- `users`, `classrooms` (turma), `enrollments` (N:N `users` × `classrooms`)
- **Banco (por `owner_id`, `visibility='private'`):**
  - `activities` (kind: `quiz` · `external-link` · `simulator` · `animation`; `config` JSONB)
  - `trails` + `trail_activities` (N:N ordenado por `position`)
  - `interactive_lessons` (referencia `games_content/<slug>/`)
- `assignments` — link polimórfico banco→turma (`content_type` + `content_id`, unique por par)
- `activity_results` — progresso do aluno (pra Fase 4-5)

**Relações:** cascade on delete preserva integridade. Editar content no banco propaga (single source of truth). `visibility` coluna fica pronta; só `private` implementada.

Schema via `create_all` no lifespan. Sync de colunas fica pra quando aparecer necessidade.

### Auth

- [x] JWT próprio minimal (HS256, TTL 7 dias); hash com `bcrypt` direto (sha256 prehash pra passar de 72 bytes); sem `fastapi-users`/`passlib` — 1.7 quebrou com bcrypt 5
- [x] Login professor (email + senha) — `POST /api/auth/login`
- [x] Registro de professor — `POST /api/auth/register`; aluno anônimo fica pra Fase 5 (só o modelo User com role=student e campos nullable)
- [x] Dependency `get_current_user` + `require_teacher`

### CRUD do banco + atribuições

- [x] `/api/classrooms` GET/POST, `/api/classrooms/{id}` GET/PATCH/DELETE
- [x] `/api/classrooms/{id}/assignments` GET (expandido com o content referenciado)
- [x] `/api/activities` CRUD; `/api/trails` CRUD + `/{id}/activities` + `/{id}/order`; `/api/interactive-lessons` CRUD
- [x] `/api/classrooms/{id}/assignments` POST · `/api/assignments/{id}` PATCH/DELETE
- [x] Isolamento por `owner_id`; cross-user → 404
- [x] UI frontend: `/login`, `/register`, `/teacher` (turmas + atribuições expandidas), `/teacher/library` (três abas: Atividades · Trilhas · Aulas Interativas, com create/delete/reorder)

**Decisões fechadas:**
- Multi-tenancy: **isolamento por `owner_id`** em todo o banco de conteúdos
- Banco de conteúdos: Moodle Content Bank + H5P (conteúdo separado de turma, atribuído via link)
- Aluno em múltiplas turmas: **sim** (`enrollments` N:N)
- Auth: **bcrypt direto + python-jose**, sem `fastapi-users` nem `passlib`
- Nomes: `Trail` (assíncrona), `InteractiveLesson` (síncrona), `Activity` (unidade atômica). `collection`/`track` extintos.
- `Activity.kind` inicial: `quiz`, `external-link`, `simulator` (stub), `animation` (stub)

**Critério de aceite atingido:** register + login + CRUD completo smoke-testado (create activity+trail, add trail-activity, reorder, criar classroom, atribuir trail+interactive_lesson, listar expandido, duplicar assignment → 409). Typecheck passa. Rotas frontend 200.

---

## Fase 4 — Runtime de aula ao vivo

**Status:** ⬜ pendente

Objetivo: aula síncrona mestre↔alunos. Mestre avança slides, todos veem juntos.

### Backend

- [ ] Modelos: `session` (sessão de aula), `membership` (quem entrou), `event` (telemetria), `score`
- [ ] WebSocket `/ws/lab/session/{session_id}` (port do `connection_manager.py` do module_lab)
- [ ] Handlers: `setSlide`, `setActivity`, `setInteractionMode`, `quiz.*`, `event`
- [ ] Rota `POST /api/lab/sessions` — criar sessão (retorna session_id + código)
- [ ] Rota `GET /api/lab/sessions/{id}` — snapshot pra reconectar

### Frontend

- [ ] Portar adapter (mock + websocket) e `AdapterProvider`
- [ ] Portar `SessionProvider` e hooks (`useSessionState`, `useSession`)
- [ ] Portar `SlideRouter`, `MasterActivityControls`, `InteractionModeBadge`, `ScoreBoard`
- [ ] Portar `MissionSlide` + stub de registry de missões por game
- [ ] Role gate: `master` vs `player` via URL param ou JWT

**Estimativa:** 2-3 dias.

**Critério de aceite:** professor abre sessão em duas abas (master + player), avança slide no master, player sincroniza em tempo real.

---

## Fase 5 — Entrada de aluno por código + QR

**Status:** ⬜ pendente

Objetivo: aluno entra na aula sem digitar UUID longo. Código de 6 dígitos
ou QR code escaneado.

### Backend

- [ ] Campo `code` (6 dígitos únicos por sessão ativa) na tabela `session`
- [ ] Rota `POST /api/lab/sessions/{id}/code/rotate` (professor regenera se vazar)
- [ ] Rota `POST /api/lab/join` com `{code, display_name}` → retorna session_id + JWT/UUID anônimo
- [ ] Rate limit na rota de join (anti-brute-force)

### Frontend

- [ ] Tela do professor: destacar código grande + QR code renderizado com lib leve (`qrcode.react`)
- [ ] Tela de entrada do aluno (`/lab/join`): input do código + nome, submit → redireciona pra sessão
- [ ] QR aponta pra `/lab/join?code=XXXXXX` (pré-preenche)

**Estimativa:** 1-2 dias.

---

## Fase 6 — PlanckGo wire (áudio/imagens de Física)

**Status:** ⬜ pendente

Objetivo: acessar biblioteca de assets de Física já montada no servidor
de origem (`planckgo.getupscience.com`).

- [ ] Decidir: symlink, proxy HTTP ou copy-on-demand
- [ ] Se symlink: montar volume Docker apontando pra origem
- [ ] Se proxy: rota `/api/lab/planckgo/{path:path}` que fetcha e cacheia
- [ ] Documentar no README.md
- [ ] Testar em 1 slide real (ex.: aula de cinemática usando imagem PlanckGo)

**Estimativa:** 0,5-1 dia.

---

## Fase 7 — Deploy

**Status:** ⬜ pendente

Objetivo: publicar em domínio público. Decisão de domínio pode ficar
pro final desta fase (`aulas.prof21.com.br`, `lab.prof21.com.br`,
ou substituir `play.prof21.com.br` — Paulo decide).

- [ ] `docker-compose.prod.yml` sem volumes de código (usa `dist/`)
- [ ] Nginx reverse proxy com SSL via Let's Encrypt
- [ ] `npm run build` servido pelo container `web` com Nginx
- [ ] Variáveis de produção via `.env.production` (senhas fortes)
- [ ] Backup automatizado do Postgres (cron + `pg_dump`)
- [ ] Smoke test em produção
- [ ] Primeiro aluno entra em sessão real via celular

**Estimativa:** 1-2 dias.

**Pré-requisito:** acesso SSH ao servidor de destino (já disponível aqui
mesmo, mas precisa confirmar se é `labprof21.prof21.com.br` ou outro subdomínio).

---

## Fase 8 — Iteração pós-primeira-aula real

**Status:** ⬜ pendente

Objetivo: dar uma aula real com alunos e corrigir o que aparecer.

Esta fase não tem lista pré-definida — depende do que quebrar ou
ficar desconfortável no uso real. Reservar ~1 semana calendário.

Candidatos conhecidos:
- UX de navegação de slides (mestre vai querer atalhos)
- Performance com muitos alunos simultâneos (se >50)
- Telemetria: dashboards de engajamento
- Reconexão de aluno que perdeu WiFi
- Export JSON agregado da sessão (já existe no module_lab — portar)

---

## Resumo de prazos

| Fase | Esforço dev | Acumulado |
|---|---|---|
| 1 setup | ✅ 4h | — |
| 2 pipeline `.md` | 1-2 dias | 1-2 dias |
| 3 schema + auth | 2-3 dias | 3-5 dias |
| 4 runtime ao vivo | 2-3 dias | 5-8 dias |
| 5 código + QR | 1-2 dias | 6-10 dias |
| 6 PlanckGo | 0,5-1 dia | 7-11 dias |
| 7 deploy | 1-2 dias | 8-13 dias |
| 8 iteração real | ~1 semana | 13-18 dias |

**Alvo de MVP funcionando em produção: 2-3 semanas calendário** com
sessões ativas de conversa/decisão frequentes.
