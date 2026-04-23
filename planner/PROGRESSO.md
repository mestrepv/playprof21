# Progresso — editor de lições interativas

## Pré-requisitos

- [x] Renomear `modules/lab` → `modules/lesson` (frontend + backend + URLs)
- [x] Atualizar `CLAUDE.md` com nova estrutura

---

## Fase A — Novos tipos de slide

- [x] `phet` — interface TS + validação Python + `PhetSlide.tsx`
- [x] `geogebra` — interface TS + validação Python + `GeogebraSlide.tsx`
- [x] `quiz-image` — interface TS + validação Python + `QuizImageSlide.tsx`
- [x] `quiz-fill` — interface TS + validação Python + `QuizFillSlide.tsx`
- [x] Atualizar `SlideRenderer.tsx` (novos cases)
- [x] Slides de exemplo em `atlas-v1` (`10-phet-demo.md`, `11-geogebra-demo.md`)
- [x] TypeScript check limpo
- [x] Smoke test: backend carrega 12 slides sem erros

Detalhes: [fase-a-novos-tipos-de-slide.md](fase-a-novos-tipos-de-slide.md)

---

## Fase B — Slide Type Registry

- [x] Criar `frontend/src/modules/lesson/registry.tsx` com `SlideTypeDef`
- [x] Registrar todos os tipos existentes no registry (displayName, icon, category, Renderer)
- [x] Refatorar `SlideRenderer.tsx` para usar registry (eliminar switch manual)
- [x] TypeScript check limpo

---

## Fase C — Editor UI

- [x] Endpoints de escrita no backend (`POST/PUT/DELETE /api/lesson/games/{slug}/{file}`)
- [x] Upload de assets (`POST /api/lesson/assets/{slug}`)
- [x] `LessonEditorPage.tsx` em `modules/teacher/` (lista de slides + YAML editor + new slide panel)
- [x] Lista de slides com ícone do registry, seleção, apagar
- [x] Painel "novo slide" com picker de tipo e templates YAML
- [x] Ligar `LibraryPage` → `LessonEditorPage` (link "editar →")
- [x] Rota `/teacher/editor/:slug` em `App.tsx`
- [x] TypeScript check limpo

---

## Fase D — Telemetria

- [x] Tabela `slide_events` no banco (SQLAlchemy model em `domain/models.py`)
- [x] Hook `useTelemetry()` em `modules/lesson/runtime/useTelemetry.ts` — no-op dentro de sessão; POST REST fora
- [x] Plugar telemetria em `QuizFillSlide` (submissão + flag correct)
- [x] Plugar telemetria em `QuizImageSlide` (modo preview — pick de opção + flag correct)
- [ ] Plugar telemetria em `MissionSlide` (foco de activity) — deixado pra quando missions forem expandidas
- [x] `POST /api/lesson/events` — grava evento no banco
- [x] `GET /api/lesson/events/{slug}` — relatório para professor (últimos 500)
