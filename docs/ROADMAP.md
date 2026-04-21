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

## Fase 6 — Onboarding de aluno + enrollment

**Status:** ✅ concluída em 2026-04-21

Objetivo: aluno consegue entrar numa turma, manter identidade entre visitas
e ver as trilhas/aulas atribuídas. Dev-mode: só nome (sem senha). Login
com Google entra como iteração futura.

### Backend

- [x] Campo `code` em `classrooms` (6 dígitos, único parcial por `code IS NOT NULL`). Gerado no create via `_generate_classroom_code`.
- [x] `POST /api/classrooms/{id}/code/rotate` (owner only)
- [x] `POST /api/classrooms/join {code, display_name}` público, rate-limit sliding (20/IP/min). Cria `User(role=student, email=NULL, password_hash=NULL)` + `Enrollment` + devolve JWT. A lógica de reuso de JWT existente fica pra 6.1 junto com OAuth.
- [x] `GET /api/student/classrooms` e `GET /api/student/classrooms/{id}/assignments` — autorizam via enrollment OR owner (professor pode espiar em modo debug).

### Frontend

- [x] `CodeOverlay` generalizado — aceita `joinPathBase` e `rotatePath` por prop, reusado pra sessão ao vivo (Fase 5) e pra turma (Fase 6).
- [x] Botão "código NNNNNN" em cada card de turma no `/teacher` abre overlay com QR apontando pra `/student/join?code=NNNNNN`.
- [x] `/student/join` com código + nome (pattern/inputMode numérico, autoComplete=one-time-code).
- [x] `/student` — dashboard: lista turmas, expande pra ver assignments. Aula interativa vai direto pro preview da Fase 2; trilha/atividade mostram placeholder "runtime na Fase 7".
- [x] Navegação pública: link "entrar como aluno" no index; card da turma mostra código.

**Smoke backend validado:** join com código válido/inválido (404), rate limit (429), aluno lista suas turmas (só as matriculadas), rotate (200 owner, 401 sem auth), aluno tentando endpoint teacher → 403.

**Nota:** Google OAuth entra numa Fase 6.1 quando o fluxo de nome+cookie for validado em aula real.

---

## Fase 7 — Runtime de trilha assíncrona

**Status:** ✅ MVP concluído em 2026-04-21 (quiz funcional ponta-a-ponta; registry TSX de simulator/animation fica pra 7.1)

Objetivo: aluno abre trilha atribuída e faz as atividades em sequência.
Nós lock/available/completed com estrelas.

### Backend

- [x] `POST /api/student/activity-results {activity_id, score, max_score}` — grava result, recalcula `is_best`
- [x] `GET /api/student/trails/{id}` — retorna `TrailProgress` com activities ordenadas + best result + status + stars
- [x] `GET /api/student/activities/{id}` — resolve uma activity pro aluno (se está em trilha que ele tem acesso)
- [x] Autorização: aluno via enrollment → classroom → assignment → trail; dono da trail passa direto (preview)
- [x] Regras: `completed` = score ≥ 50% do max; `stars` = 3 (≥100%), 2 (≥75%), 1 (>0), 0. Próximo nó desbloqueia quando anterior completou.

### Frontend

- [x] `QuizRenderer` real (`Activity.kind='quiz'`): valida localmente, revela correto/errado, onComplete devolve score
- [x] `ActivityRunner` despacha por kind. `external-link` abre em nova aba; `simulator`/`animation` mostram placeholder "registrar TSX" (7.1)
- [x] Dashboard `/student` com duas tabs: **Trilhas** (árvore sequencial Duolingo-like, estrelas agregadas por trilha) + **Aulas** (aulas interativas atribuídas, link pro preview)
- [x] `/student/trail/:id` vira **runner linear** — execução sequencial sem grid; header com progress bar + estrelas atuais; tela-resumo ao terminar com estrelas finais e botão "refazer"
- [x] Desbloqueio sequencial entre trilhas: próxima abre quando a anterior foi completada (todas atividades com tentativa)
- [x] Estrelas agregadas na trilha (média de `bestScore/maxScore` das atividades, patamares 100%/75%/>0)

### 7.1 — Identidade visual prof21 (concluída 2026-04-21)

- [x] Tokens globais em `frontend/src/styles/theme.css` — paleta prof21 (verde `#58cc02`, azul `#185FA5`), tipografia Inter + Space Grotesk (headings) + JetBrains Mono (código), radius 8/12/16, shadow 3D low-contrast, tap target ≥44px, espaçamento/fontes fluidos com `clamp()`
- [x] `components/ui/`: `Logo` (P21 mark + nome), `Button` (variants primary/secondary/outline/ghost/danger; sizes sm/md/lg), `Card` (padded/interactive), `Input` (label/hint/error, 16px font-size pra evitar zoom iOS), `PageShell` (wrapper com header sticky + logo)
- [x] Refactor das páginas pra nova linguagem visual: Index/Login/Register/StudentJoin/JoinPage/StudentDashboard/TrailPage/QuizRenderer/ActivityRunner/TeacherPage/LibraryPage/SessionPage HUD/CodeOverlay
- [x] Mobile-first: paddings responsivos, tap targets adequados, tabs/cards quebram bem em 375px, HUD da aula ao vivo com `env(safe-area-inset-bottom)` pra notch do iPhone
- [x] Fontes via Google Fonts (`<link preconnect>` em `index.html`) pra evitar FOUT

### 7.2 — fica pra depois

- Registry de componentes TSX por `activityId` pra `kind='animation'` e `'simulator'` virarem executáveis
- Tela em "onda" Duolingo com SVG/curvas; hoje é stacked vertical

### 7.3 — Página dedicada da turma + feed (concluída 2026-04-21)

Inspirada na turma-detail do legado play.prof21. Substitui o expand inline por página dedicada `/teacher/classroom/:id`.

**Backend:**
- [x] Módulo `backend/modules/feed/` com `FeedPost`, `FeedComment`, `FeedPostLike` (PK composta)
- [x] Rotas: `GET/POST /api/classrooms/{cid}/posts`, `DELETE /api/posts/{pid}`, `GET/POST /api/posts/{pid}/comments`, `DELETE /.../{cid}`, `POST /api/posts/{pid}/like` (toggle)
- [x] Acesso: dono ou matriculado; cross-turma → 404
- [x] Novos endpoints em `domain/routes.py`: `GET /api/classrooms/{cid}/stats` (total_students, total_activities, attempts_pct, energy_total), `GET /enrollments`, `GET /stats/students`
- [x] Stats descompõe trilhas em activities alcançáveis pra calcular `attempts_expected = sum(activities_in_trails) + direct_activities × total_students`

**Frontend:**
- [x] `/teacher` vira lista de cards clicáveis (sem expand inline); cada card navega pra página da turma
- [x] `ClassroomPage`: Hero azul gradiente com nome + código copiável + botão voltar
- [x] `StatsRow`: 4 stat cards clicáveis (Alunos/Atividades/Tentativas/Energia Média) com ícones coloridos — azul, roxo, rosa, verde — grid `auto-fit minmax(160px, 1fr)`
- [x] `TabsBar` pillbox com 4 tabs: Feed | Trilhas | Aulas | Desempenho; labels somem <480px
- [x] `FeedTab`: composer, posts com avatar+tempo relativo, curtir (toggle otimístico), comentar, apagar (autor ou dono), paginação "ver mais"
- [x] `AssignmentsTab` compartilhado pras tabs Trilhas/Aulas — botão "+ atribuir" abre picker filtrado; aulas têm "iniciar ao vivo ▶"
- [x] `PerformanceTab` placeholder vazio elegante
- [x] `StatDrawer` lateral (desktop) / bottom-sheet (mobile ≤640px): 4 variantes exibindo lista de alunos / breakdown de atividades / ranking de tentativas / ranking de energia
- [x] `components/ui/icons.tsx` com lib de SVGs inline; `classroom/timeAgo.ts` helper de tempo relativo em PT

**Smoke validado:** stats backend retorna números corretos (3 alunos, 1 assignment, 16.7% tentativas quando 1 de 6 possíveis cumprida); feed CRUD completo; isolamento cross-turma 404; typecheck limpo; navegação `/teacher` → `/teacher/classroom/:id` funciona.

### 7.4 — Chrome de navegação: sidebar + perfil + settings (concluída 2026-04-21)

Portado o layout lateral do play.prof21 (sidebar fixa 240px/72px com tooltips, hamburger mobile) + dropdown do avatar no header. Cria também perfil mínimo e placeholder de configurações.

**Backend:**
- [x] `PATCH /api/auth/me {display_name}` — edição do próprio nome

**Frontend:**
- [x] `components/ui/Sidebar.tsx` — itens filtrados por role; 240px desktop ≥1024, 72px tablet 640-1023 (sempre colapsado), drawer mobile <640 com overlay + X; toggle recolher persistido em `localStorage`
- [x] `components/ui/HeaderDropdown.tsx` — avatar 36px com initials; popup com nome/email/role badge + 3 itens (perfil/config/sair); fecha em click fora ou Esc
- [x] `components/ui/AppShell.tsx` — novo layout (sidebar + header sticky com hamburger + main); variantes narrow/reading/default
- [x] `AuthContext.refresh()` — re-busca `/auth/me` após edições
- [x] `/profile` — avatar XL em initials + card de edição do display_name + card placeholder "conta"
- [x] `/settings` — placeholder com linhas "tema / idioma / notificações" — dark mode e opções reais ficam pra Fase 9
- [x] Páginas autenticadas (`TeacherPage`, `ClassroomPage`, `LibraryPage`, `StudentDashboard`, `TrailPage`) migram pra `AppShell`; públicas (Index/Login/Register/StudentJoin/JoinPage) mantêm `PageShell`

**Decisões Paulo:** sidebar nova (não header fino); perfil básico; dark mode pós-validação.

---

## Fase 8 — Deploy

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

## Fase 9 — Iteração pós-primeira-aula real

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

| Fase | Esforço dev | Status |
|---|---|---|
| 1 setup | 4h | ✅ |
| 2 pipeline `.md` | 1-2d | ✅ |
| 3 schema + banco de conteúdos | 2-3d | ✅ |
| 4 runtime ao vivo | 2-3d | ✅ MVP |
| 5 código + QR | 1-2d | ✅ |
| 6 onboarding aluno | 1-2d | ⬜ |
| 7 runtime de trilha | 2-3d | ⬜ |
| 8 deploy | 1-2d | ⬜ |
| 9 iteração pós-aula real | ~1 semana | ⬜ |

**Alvo de MVP funcionando em produção: 2-3 semanas calendário** com
sessões ativas de conversa/decisão frequentes.
