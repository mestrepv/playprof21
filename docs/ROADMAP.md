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

**Status:** ✅ concluída em 2026-04-21 (mínimo viável; quiz/score ficam pra Fase 4.1 junto com mission TSX)

Objetivo: aula síncrona mestre↔alunos. Mestre avança slides, todos veem juntos.

### Backend

- [x] Modelos: `live_sessions`, `live_memberships` (user OR anon_id), `live_events` (append-only telemetria). `quiz_state`/`answers`/`scores` ficam pra 4.1
- [x] WebSocket `/ws/lab/session/{id}?token=<jwt>&anon_id=<uuid>&display_name=<nome>` — auth dupla (JWT ou anônimo)
- [x] Handlers: `setSlide`, `setInteractionMode`, `event`, `ping`, `endSession`. `setActivity`/`quiz.*` entram com missions na 4.1
- [x] `POST /api/lab/sessions` (master cria, exige ownership da InteractiveLesson)
- [x] `GET /api/lab/sessions/{id}` (snapshot público — server envia inicial no handshake, REST é fallback pra reconexão)
- [x] `GET /api/lab/sessions/{id}/manifest` (carrega o manifest em disco do slug da InteractiveLesson)
- [x] `ConnectionManager` singleton in-process (broadcast com `exclude`/`only_role`)

### Frontend

- [x] `SessionAdapter` WebSocket (pending queue, reconexão exponencial 1s→30s cap, emitter por subscribe)
- [x] `SessionPage` (`/lab/session/:sid?role=master|player`): carrega snapshot+manifest, gate de nome pro player, role-check ao receber snapshot
- [x] Reuso do `SlideRenderer` da Fase 2 (text/video já renderizam; mission/quiz/custom continuam placeholder)
- [x] HUD fixo no rodapé com ←/→/encerrar pro master; contador pro player
- [x] Botão "iniciar ao vivo ▶" em cada assignment tipo `interactive_lesson` na `TeacherPage` — cria a sessão e abre como master
- [x] Atalhos de teclado master: ← / → / Space / PgUp/PgDn / Home / End
- [x] `anon_id` persistido em `localStorage` (aluno reconecta mantendo membership)
- [x] Mock adapter: **não** implementado — WebSocket direto funciona local e remoto

### Fora do escopo (4.1 ou depois)

- Mission TSX (precisa registry de componentes por game)
- Quiz live (open/close/answer/distribution)
- Score + master override
- `MasterActivityControls`, `InteractionModeBadge`, `ScoreBoard`
- Mock adapter pra dev offline

**Critério de aceite atingido:** smoke via Python `websockets` com 2 conexões paralelas — master conecta (snapshot), player conecta (snapshot + participantUpdate no master), master `setSlide index=3` → player recebe `slideChange index=3` status=live, `setInteractionMode` propaga, player tentando `setSlide` recebe `error code=forbidden`. No browser: botão "iniciar ao vivo" em assignment de aula interativa cria sessão e abre runtime.

---

## Fase 5 — Entrada de aluno por código + QR

**Status:** ✅ concluída em 2026-04-21

Objetivo: aluno entra na aula sem digitar UUID longo. Código de 6 dígitos
ou QR code escaneado.

### Backend

- [x] Campo `code` (6 dígitos) em `live_sessions`, gerado via `generate_code()` no create. Unique partial index (`status <> 'ended'`) libera reuso após encerramento.
- [x] `POST /api/lab/sessions/{id}/code/rotate` (master-only) regera código
- [x] `POST /api/lab/join {code, display_name}` público → `{session_id, anon_id, display_name}`. Cliente persiste anon_id em localStorage; WS handshake dedupa por `(session_id, anon_id)`.
- [x] Rate-limit in-process (sliding window) — 10 tentativas/IP/minuto no endpoint join. 429 com `Retry-After` header. Interface stateless; se escalar, troca por Redis.

### Frontend

- [x] `CodeOverlay` com código gigante + QR (`qrcode.react`). Auto-abre no master quando sessão em `idle`; botão "código NNNNNN" no HUD reabre; botão "gerar novo código" rotaciona.
- [x] `/lab/join?code=NNNNNN` pré-preenche via QR; aluno só precisa digitar nome. Redireciona pra `/lab/session/:sid?role=player&name=...`.
- [x] Input do código com `inputMode="numeric"` e `autoComplete="one-time-code"` — teclado numérico em mobile + iOS/Android sugerem o código do SMS/Notificação se aplicável.

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
