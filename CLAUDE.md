# labprof21 — guia pro Claude Code

Este arquivo é o primeiro que você lê ao abrir o projeto. Tudo que
precisa pra continuar o trabalho sem perder contexto está aqui.

---

## O que é o projeto

Plataforma de **aulas interativas síncronas** do prof21 (Paulo Vicente,
professor de Física). Aula = pasta com `.md` por slide. Mestre (professor)
avança slides via UI; alunos veem ao vivo via WebSocket. Telemetria
persistida em Postgres.

**Dono:** Paulo. Ele é o maestro; o Claude Code (você) é o executor.
Ele decide produto, você escreve código.

## Stack (decidido, inegociável)

- **Backend:** FastAPI + SQLAlchemy + Postgres 16
- **Frontend:** React 19 + Vite 6 + TypeScript
- **Realtime:** WebSocket nativo (sem Socket.IO — FastAPI é nativo)
- **Infra:** Docker Compose (tudo containerizado)
- **Ports (dev):** `5435` (db), `5105` (api), `5174` (web)

## Paradigma (também inegociável)

**AI-first, file-driven.** Conteúdo em `.md` com frontmatter YAML; animações
em `.tsx` registradas por `missionId`. Paulo pede à IA pra criar/editar
arquivos, revisa, commita. Sem editor WYSIWYG — ele testou e concluiu
que desacelera o fluxo.

Tipos de slide suportados (herdados do `module_lab` do rpgia):
`text` · `video` · `quiz` · `mission` (componente React plugável) · `custom`.

## Estado atual

Veja [docs/ROADMAP.md](docs/ROADMAP.md) como fonte de verdade. Resumo rápido:

- **Fase 1** ✅ concluída (setup Docker + smoke test) — commit `7c5e95f`
- **Fase 2** ✅ concluída (pipeline `.md`, preview em `/lab/preview/:slug`)
- **Fase 3** ✅ concluída (banco de conteúdos + JWT + dashboards `/teacher` e `/teacher/library`)
- **Fase 4** ✅ concluída (runtime ao vivo mínimo; mission TSX + quiz ficam pra 4.1)
- **Fase 5** ✅ concluída (código 6 dígitos + QR + /lab/join público com rate-limit)
- **Fase 6** ⬜ próximo passo: PlanckGo wire (áudio/imagens de Física)
- Demais fases documentadas em `docs/ROADMAP.md`

**Para retomar:** leia `docs/ROADMAP.md`, identifique a Fase ⬜ mais próxima,
execute o primeiro item pendente. Marque `[x]` conforme avança.

## Como rodar

```bash
cd /home/play-prof21/htdocs/labprof21
docker compose up -d                # sobe db + api + web
curl -s http://localhost:5105/health
                                    # esperado: {"status":"ok","db":true}
open http://localhost:5174          # splash de smoke test
docker compose logs -f api          # logs backend
docker compose logs -f web          # logs frontend
docker compose down                 # para (mantém banco)
docker compose down -v              # para e apaga banco
```

## Relação com outros projetos do Paulo

### rpgia (`/home/paulovicente-rpgia/htdocs/rpgia.paulovicente.pro.br/`)

**Projeto separado** — simulador de RPG de mesa com LLM. Dentro dele
existe um módulo chamado **`module_lab`** (em
`backend/modules/module_lab/` e `src/modules/module_lab/`) que é a
**base arquitetural do labprof21**.

Quando for portar código pro labprof21, a fonte é o `module_lab`.
Arquivos-chave a consultar:

- `backend/modules/module_lab/content_loader.py` — parser markdown+YAML
- `backend/modules/module_lab/validate.py` — CLI de validação
- `backend/modules/module_lab/websocket.py` — WebSocket handlers
- `backend/modules/module_lab/runtime/connection_manager.py` — rooms/sessions
- `backend/modules/module_lab/games_content/atlas-v1/` — aula ATLAS de exemplo
- `backend/modules/module_lab/games_content/seminario-tese/` — segunda aula (16 slides)
- `src/modules/module_lab/components/TextSlide.tsx` — renderer markdown + KaTeX
- `src/modules/module_lab/components/SlideShell.tsx` — wrapper comum
- `src/modules/module_lab/styles/helpers.css` — classes CSS (cards, tags, grids)
- `src/modules/module_lab/adapter/` — WebSocket + mock adapter
- `src/modules/module_lab/session/` — SessionProvider + hooks
- `src/modules/module_lab/types/manifest.ts` — schemas TypeScript

Docs do design original em `docs/module_lab/` do rpgia:
`README.md`, `CONTEXT.md`, `ARCHITECTURE.md`, `ADAPTER_CONTRACT.md`,
`DESIGN_TOKENS.md`, `ROADMAP.md`.

O rpgia usa FastAPI também — **os padrões e tipos Python portam direto**.
O frontend React também é igual — **os componentes portam com só adaptar imports**.

### play.prof21.com.br antigo (`/home/play-prof21/htdocs/play.prof21.com.br/`)

**Legado.** Projeto anterior em Express + MySQL + Socket.IO + vanilla TS.
Paulo decidiu não migrar — escreveu do zero aqui no labprof21. Considere
o legado **arquivado** (não toque). Serve só pra referência de features
(lista em `/home/paulovicente-rpgia/htdocs/rpgia.paulovicente.pro.br/docs/FEATURES_PLAY_PROF21_PORT_ANALYSIS.md`).

## Decisões fechadas (não revogar sem Paulo)

1. **Stack FastAPI+Postgres+React** — escolhida pela compatibilidade com
   integração futura de LLMs.
2. **Sem editor WYSIWYG** — AI-first é mais rápido.
3. **Sem LTI** — Paulo não vai integrar com Moodle. Plataforma personalizada.
4. **Docker Compose local** — nada em produção ainda. Deploy vai ser decidido
   na Fase 7 (subdomínio a definir: `aulas.prof21.com.br`? `lab.prof21.com.br`?).
5. **WebSocket nativo, não Socket.IO** — FastAPI fala nativamente; module_lab
   já validou esse caminho; código portável.
6. **Código de sessão visual + QR** pra entrada do aluno (Fase 5) — UX superior
   a UUID opaco.

## Convenções

- **Commits:** lowercase subject (commitlint), ex.: `feat(lab): portar TextSlide`
- **Co-author:** `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
- **Branch default:** `main` (git remote ainda não configurado)
- **Roadmap como fonte de verdade:** editar `docs/ROADMAP.md` quando decisão muda
- **Sem emojis em código ou docs técnicos** a menos que Paulo peça

## Onde Paulo encontra você

Paulo trabalha pelo Claude Code (VS Code extension). Quando ele muda o
diretório raiz (`/home` em vez do projeto), cada projeto tem seu próprio
contexto. Se ele abrir esse projeto diretamente, você lê este arquivo
primeiro — ele tem tudo pra continuar sem perguntar.

Se ele abrir a `/home`, você vai ver vários projetos. Navegue para
`/home/play-prof21/htdocs/labprof21/` e leia este CLAUDE.md.
