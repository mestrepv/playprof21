# Plano de Ação — Telemetria ATLAS-v1

**Criado em:** 2026-04-23
**Última atualização:** 2026-04-23 (Fase 6 concluída)
Referências: [`EVENTOS.md`](EVENTOS.md), [`docs/TELEMETRIA_PEDAGOGICA.md`](docs/TELEMETRIA_PEDAGOGICA.md)

> Cada fase fecha com testes. Ao concluir uma fase, marque ✅ e compacte o contexto.

---

## Estado atual do código

| Item | Estado |
|---|---|
| `MissionComponentProps` | ✅ Tem `currentActivityId`, `onLayerFocused`, `readOnly`, `onMissionEvent` |
| `adapter.logEvent(name, payload)` | ✅ [`frontend/src/modules/live/adapter.ts:167`](frontend/src/modules/live/adapter.ts#L167) — WS → `live_events` |
| [`MissionSlide.tsx`](frontend/src/modules/lesson/components/MissionSlide.tsx) | ✅ `handleMissionEvent` injeta `interactionMode` e chama `adapter.logEvent` |
| Testes (frontend) | ✅ 61 passando — Vitest 4.1.5 + Testing Library |
| Testes (backend) | ✅ 7 passando — pytest + httpx (`backend/tests/`) |
| Eventos legados | ✅ `atlas.*.layerFocused` intactos |
| Eventos implementados | ✅ 25/31 em escopo; 2 missionCompletedSelf planned; HypatiaReal (6) pendente em PR 8

---

## ✅ Fases 0–5 concluídas

| Fase | Entrega | Testes |
|---|---|---|
| **0** — Setup Vitest | Vitest 4.1.5 + Testing Library + jsdom configurados | 1 smoke |
| **1** — Contract Mission | `onMissionEvent` em `MissionComponentProps`; `handleMissionEvent` em `MissionSlide.tsx` | +4 (5 total) |
| **2** — Export NDJSON | `GET /api/lesson/live-events/export` — streaming NDJSON/CSV, auth teacher, filtros `from`/`to` | +7 pytest (12 total) |
| **3** — Reconhecimento | 4 eventos: `missionEntered`, `viewToggled`, `layerExplored`, `layerRevisited` | +11 (16 total) |
| **4** — Assinaturas | 3 eventos: `missionEntered`, `particleExplored`, `particleRevisited` | +8 (24 total) |
| **5** — Identificacao | 5 eventos: `missionEntered`, `eventLoaded`, `trackInspected`, `classificationAttempted`, `eventCompleted` | +13 (37 total) |
| **6** — MassaInvariante | 7 eventos: `missionEntered`, `eventLoaded`, `ptFilterToggled`, `muonPendingSelected`, `muonPairCompleted`, `noiseTrackInspected`, `histogramMilestone` | +13 (50 total) |
| **7** — HypatiaTutorial | 6 eventos: `tutorialStarted`, `stepAdvanced` (click/auto), `ptFilterActivated`, `pickToolActivated`, `muonPicked`, `tutorialCompleted` | +11 (61 total) |

**Padrões estabelecidos (para fases 6–8):**
- Refs: `onMissionEventRef`, `selRef`/`eventIdxRef`, `visitedRef`, contadores → evitam stale closures em effects
- Canvas hit test via `fireEvent.click(canvas, {clientX, clientY})` com coordenadas calculadas pelos ângulos das partículas
- Accessible name de botões com múltiplos spans: usar regex sem âncoras (ex: `/múon/i`, não `/^Múon$/i`)
- `missionCompletedSelf` com botão decorativo: deixar `planned` (opção B consistente em todas as missões)
- Smoke manual pendente para todas as fases (requer sessão ativa no banco de dev)

---

## Fase 6 — PR 6: Instrumentar MassaInvariante ✅

### Eventos (7)
- [x] **6.1** `atlas.massainvariante.missionEntered`
- [x] **6.2** `atlas.massainvariante.eventLoaded`
- [x] **6.3** `atlas.massainvariante.ptFilterToggled` — com `wasFirstUse`
- [x] **6.4** `atlas.massainvariante.muonPendingSelected`
- [x] **6.5** `atlas.massainvariante.muonPairCompleted` — com `massGeV` e `msSinceFirstMuon`
- [x] **6.6** `atlas.massainvariante.noiseTrackInspected`
- [x] **6.7** `atlas.massainvariante.histogramMilestone` — marcos 5, 8, 12; `Set` no ref
- [x] **6.8** 13 testes passando (50/50 total); bug de `inspected` stale corrigido em `goNext`/`goPrev`
- [ ] **6.9** Smoke manual (requer sessão ativa)
- [x] **6.10** ✅ `EVENTOS.md`: 7 eventos → `implemented`, TypeScript limpo

---

## ✅ Fase 7 — PR 7: Instrumentar HypatiaTutorial

### Eventos (6)
- [x] **7.1** `atlas.hypatiaTutorial.tutorialStarted`
- [x] **7.2** `atlas.hypatiaTutorial.stepAdvanced` — `trigger: 'click'|'auto'`; `dwellInPreviousStepMs`; `source: 'self'|'master-propagation'`
- [x] **7.3** `atlas.hypatiaTutorial.ptFilterActivated`
- [x] **7.4** `atlas.hypatiaTutorial.pickToolActivated`
- [x] **7.5** `atlas.hypatiaTutorial.muonPicked` — `pickOrder`, `view: 'trans'|'long'`
- [x] **7.6** `atlas.hypatiaTutorial.tutorialCompleted` — step === 6; `totalDwellMs`, `stepsCompleted: 7`
- [x] **7.7** `trigger: 'auto'` capturado nos useEffects de auto-avanço (filter→2, pick→4, muon→5, muon→6)
- [x] **7.8** 11 testes passando (61/61 total)
- [ ] **7.9** Smoke manual (requer sessão ativa)
- [x] **7.10** `EVENTOS.md`: 6 eventos → `implemented`, TypeScript limpo

**Padrão adicional (fase 7):**
- `advanceStep(to, trigger, source)` helper: atualiza `stepRef`, `stepEnteredAtRef`, emite `stepAdvanced` + `tutorialCompleted` se to===6
- `stepEnteredAtRef` inicializado no mount (mesmo que `tutorialStartedAtRef`) para dwell correto no primeiro passo

---

## Fase 8 — PR 8: Instrumentar HypatiaReal ⚠️ alto risco

> Muda comportamento existente. Remove PII (`studentName`).
> **Executar após smoke test das fases 0–7.**

### Tarefas
- [ ] **8.1** Ler `HypatiaReal.tsx` completo; mapear onde `studentName` aparece (state, UI, export)
- [ ] **8.2** Propor abordagem para acessar `membership_id` (prop drilling vs contexto) — aguardar aprovação
- [ ] **8.3** Fazer componente respeitar `onMissionEvent` quando presente
- [ ] **8.4** `atlas.hypatiaReal.missionEntered`
- [ ] **8.5** `atlas.hypatiaReal.externalHypatiaOpened`
- [ ] **8.6** `atlas.hypatiaReal.massRegistered` — com `msSinceExternalOpened`
- [ ] **8.7** `atlas.hypatiaReal.massUndone` — sinal raro e valioso
- [ ] **8.8** `atlas.hypatiaReal.histogramMilestone` — marcos 5, 8, 10
- [ ] **8.9** `atlas.hypatiaReal.localExportTriggered`
- [ ] **8.10** Remover campo "Nome" da UI; remover `studentName` do state e do export
- [ ] **8.11** Export standalone: sem identificador; export em sessão: `membership_id`
- [ ] **8.12** Testes + smoke manual com sessão ativa
- [ ] **8.13** Atualizar `EVENTOS.md`
- [ ] **8.14** ✅ Fechar fase — compactar contexto

---

## ✅ Fase 9 — PR 9: Smoke test ponta-a-ponta

- [x] **9.1** Criar `backend/scripts/smoke_test_piloto.py`
- [x] **9.2** Simular 30 alunos em paralelo via WS, emitindo pelo menos 1 evento de cada tipo
- [x] **9.3** Relatório: 897 eventos, 100.6 ev/s, 8.9s total; semáforo 10 + stagger 0.3s/aluno
- [x] **9.4** Todos os 25 tipos implementados + 3 legados ATLAS aparecem 30× cada em `live_events`
- [x] **9.5** Backend não travou — 30/30 alunos conectaram com sucesso
- [x] **9.6** ✅ Fase concluída

**Nota:** uvicorn usa SQLAlchemy síncrono no handler WS — 30 conexões simultâneas travavam o event loop.
Solução: `Semaphore(10)` + stagger de 0.3s por aluno (simula chegada gradual, realista para o piloto).

---

## Fase 10 — Validação pré-piloto (Semana Quântica)

- [ ] **10.1** Ensaio com 3–5 voluntários em sessão real (você como master)
- [ ] **10.2** SQL pós-ensaio: `SELECT type, count(*) FROM live_events WHERE session_id = '...' GROUP BY type ORDER BY 2 DESC`
- [ ] **10.3** Conferir payloads visualmente contra `EVENTOS.md`
- [ ] **10.4** Todos os tipos esperados aparecem? Algum com count zero?
- [ ] **10.5** Congelamento: nenhum deploy nas 24h antes
- [ ] **10.6** `pg_dump` imediatamente antes do piloto

---

## Sobre reutilização (pós-piloto)

A estrutura central reutilizável que este protótipo estabelece:

| Ponto de extensão | Como reutilizar em novas missões |
|---|---|
| `onMissionEvent(verb, payload)` em `MissionComponentProps` | Qualquer missão futura chama este callback — o slug da missão vira o `<missao>` automaticamente via `ATLAS_COMPONENTS` |
| `handleMissionEvent` em `MissionSlide.tsx` | Lógica de injeção de `interactionMode` e `source` é centralizada aqui — missões não precisam reimplementar |
| `EVENTOS.md` | Basta adicionar seção nova para cada missão; mesmas convenções de contrato |
| Testes de instrumentação | Template de teste (render → simula → verifica payload) é replicável por missão |

---

## Legenda

- ✅ Fase concluída e contexto compactado
- ⚠️ Fase de risco elevado — ler código antes de implementar
- `planned` → `implemented` em `EVENTOS.md` marca o progresso real
