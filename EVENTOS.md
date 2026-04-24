# EVENTOS.md — Contrato técnico dos eventos de telemetria

Gerado por engenharia reversa do código em 2026-04-24. A partir deste ponto,
toda mudança em payload de evento exige atualização sincronizada deste arquivo
e do código no mesmo PR.

---

## Convenções gerais

- Canal: WebSocket → tabela `live_events`
- Nome do evento final: `${slide.missionId}.${verb}` — onde `slide.missionId`
  é a chave em `ATLAS_COMPONENTS` (ver `components.ts`). Para as missões atuais
  o padrão resulta em `atlas.<missao>.<verbo>`.
- Pseudonimização: `membership_id` injetado server-side
- Mecanismo de injeção automática: `handleMissionEvent` em `MissionSlide.tsx` (linha 50–54)
  injeta `interactionMode` **apenas se a chave não estiver presente** no payload
  original. Como nenhum componente inclui essa chave, ela é sempre injetada.

**Campos injetados automaticamente pelo MissionSlide em TODOS os eventos
emitidos via `onMissionEvent` (não listar em cada evento abaixo):**

```
interactionMode: 'free' | 'master-led'
  (tipo completo: InteractionMode — ver frontend/src/modules/live/types.ts;
  valores 'free' e 'master-led' confirmados no código)
```

---

## Eventos legados (não mexer)

Emitidos via `handleLayerFocused` em `MissionSlide.tsx` (linha 47), **não** via
`handleMissionEvent`. O `interactionMode` vem do próprio construtor do payload,
**não** da injeção automática descrita acima.

```
atlas.reconhecimento.layerFocused
atlas.assinaturas.layerFocused
atlas.identificacao.layerFocused
atlas.massainvariante.layerFocused
atlas.hypatia.tutorial.layerFocused
```

Payload comum (todos os cinco):
```json
{
  "layer": "string — ver valores por missão abaixo",
  "interactionMode": "'free' | 'master-led'"
}
```

Valores de `layer` por missão:
- `atlas.reconhecimento`: `'id' | 'ecal' | 'hcal' | 'muon'` (camada) ou `'tab-long' | 'tab-trans'` (aba)
- `atlas.assinaturas`: `'muon' | 'electron' | 'photon' | 'jet' | 'neutrino'`
- `atlas.identificacao`: `'event-{i}'` onde `i` = 0, 1 ou 2
- `atlas.massainvariante`: `'event-{i}'` onde `i` = eventIdx ± 1 (0–19)
- `atlas.hypatia.tutorial`: `'step-{n}'` onde `n` = 0–6

Coexistem com os eventos novos abaixo.

---

## Reconhecimento

Arquivo: [frontend/src/modules/lesson/games/atlas/Reconhecimento.tsx](frontend/src/modules/lesson/games/atlas/Reconhecimento.tsx)

---

### atlas.reconhecimento.missionEntered

Gatilho: componente montado (useEffect com `[]`).
Emitido em: Reconhecimento.tsx:996
```json
{
  "clientTs": "number — Date.now()"
}
```

---

### atlas.reconhecimento.layerExplored

Gatilho: usuário clica numa camada (canvas ou chip) que ainda **não foi visitada**
nesta sessão de componente (`visited[layerId] === false`). Também disparado quando
o master propaga via `currentActivityId` uma camada nova (não visitada pelo
player).

Emitido em: Reconhecimento.tsx:1015–1023 (via `emitLayerEvent`) e
Reconhecimento.tsx:805–810 (via `onMissionEventRef.current` no useEffect de
`currentActivityId`).

```json
{
  "layer": "'id' | 'ecal' | 'hcal' | 'muon'",
  "view": "'long' | 'trans'",
  "source": "'self' | 'master-propagation'",
  "explorationOrder": "number — quantas camadas já visitadas + 1 (1–4)",
  "clientTs": "number — Date.now()"
}
```

---

### atlas.reconhecimento.layerRevisited

Gatilho: usuário clica numa camada **já visitada** (`visited[layerId] === true`).
Também disparado quando master propaga via `currentActivityId` uma camada já
visitada pelo player.

Emitido em: Reconhecimento.tsx:1007–1014 (via `emitLayerEvent`) e
Reconhecimento.tsx:797–803 (via `onMissionEventRef.current` no useEffect de
`currentActivityId`).

```json
{
  "layer": "'id' | 'ecal' | 'hcal' | 'muon'",
  "view": "'long' | 'trans'",
  "source": "'self' | 'master-propagation'",
  "previousLayer": "'id' | 'ecal' | 'hcal' | 'muon' | null — null quando nenhuma camada estava selecionada",
  "clientTs": "number — Date.now()"
}
```

---

### atlas.reconhecimento.viewToggled

Gatilho: usuário clica na aba de vista (Corte Longitudinal / Corte Transversal)
diferente da atual (`k !== tab`). Também disparado quando master propaga nova
aba via `currentActivityId` e o valor difere do tab atual (`parsed.value !==
tabRef.current`).

Emitido em: Reconhecimento.tsx:1084–1090 (click na aba) e Reconhecimento.tsx:818–824
(useEffect de `currentActivityId`).

```json
{
  "view": "'long' | 'trans' — novo valor",
  "previousView": "'long' | 'trans'",
  "source": "'self' | 'master-propagation'",
  "clientTs": "number — Date.now()"
}
```

---

## Assinaturas

Arquivo: [frontend/src/modules/lesson/games/atlas/Assinaturas.tsx](frontend/src/modules/lesson/games/atlas/Assinaturas.tsx)

---

### atlas.assinaturas.missionEntered

Gatilho: componente montado (useEffect com `[]`).
Emitido em: Assinaturas.tsx:140
```json
{
  "clientTs": "number — Date.now()"
}
```

---

### atlas.assinaturas.particleExplored

Gatilho: usuário clica em pílula de partícula **ainda não visitada**
(`visitedRef.current[p.id] === false`). Também disparado quando master propaga
via `currentActivityId` uma partícula nova (não visitada).

Emitido em: Assinaturas.tsx:276–280 (click na pílula) e Assinaturas.tsx:154–159
(useEffect de `currentActivityId`).

```json
{
  "particle": "'muon' | 'electron' | 'photon' | 'jet' | 'neutrino'",
  "explorationOrder": "number — valor de explorationOrderRef (incrementado a cada nova partícula, persiste durante a vida do componente)",
  "source": "'self' | 'master-propagation'",
  "clientTs": "number — Date.now()"
}
```

---

### atlas.assinaturas.particleRevisited

Gatilho: usuário clica em pílula de partícula **já visitada**
(`visitedRef.current[p.id] === true`). Também disparado quando master propaga
via `currentActivityId` uma partícula já visitada.

Emitido em: Assinaturas.tsx:283–290 (click na pílula) e Assinaturas.tsx:161–168
(useEffect de `currentActivityId`).

```json
{
  "particle": "'muon' | 'electron' | 'photon' | 'jet' | 'neutrino'",
  "source": "'self' | 'master-propagation'",
  "previousParticle": "'muon' | 'electron' | 'photon' | 'jet' | 'neutrino' | null — valor de selRef.current no momento do clique; null se nenhuma partícula estava selecionada",
  "clientTs": "number — Date.now()"
}
```

---

## Identificacao

Arquivo: [frontend/src/modules/lesson/games/atlas/Identificacao.tsx](frontend/src/modules/lesson/games/atlas/Identificacao.tsx)

---

### atlas.identificacao.missionEntered

Gatilho: componente montado (useEffect com `[]`).
Emitido em: Identificacao.tsx:144
```json
{
  "clientTs": "number — Date.now()"
}
```

---

### atlas.identificacao.eventLoaded

Gatilho (três situações, mesmo payload):
1. Master propaga novo evento via `currentActivityId` (`sub.startsWith('event-')` e idx diferente do atual).
2. Usuário clica num chip de evento diferente do atual (e `!readOnly`).
3. Usuário clica no botão "Próximo evento" em `goNext` (e `!readOnly`).

Emitido em: Identificacao.tsx:156–162 (master), Identificacao.tsx:329–336 (chip),
Identificacao.tsx:292–298 (goNext).

```json
{
  "eventIdx": "number — índice do novo evento (0–2)",
  "previousEventIdx": "number — índice do evento anterior (0–2)",
  "source": "'self' | 'master-propagation'",
  "clientTs": "number — Date.now()"
}
```

---

### atlas.identificacao.trackInspected

Gatilho: usuário clica no canvas em região de hit-test positivo (`hitParticle`
retorna uma partícula **não ainda identificada**).

Emitido em: Identificacao.tsx:232–237

```json
{
  "eventIdx": "number — índice do evento atual (0–2)",
  "trackId": "string — id da partícula clicada ('p1' | 'p2' | 'p3' | 'p4'; disponibilidade depende do evento)",
  "clientTs": "number — Date.now()"
}
```

---

### atlas.identificacao.classificationAttempted

Gatilho: usuário clica numa pílula de classificação quando há `pendingId`
definido (track selecionado aguardando classificação).

Emitido em: Identificacao.tsx:252–260

```json
{
  "eventIdx": "number — índice do evento atual (0–2)",
  "trackId": "string — id da partícula sendo classificada",
  "guessedAs": "'muon' | 'electron' | 'photon' | 'jet' | 'neutrino'",
  "correct": "boolean",
  "msSinceTrackInspected": "number — Date.now() - trackInspectedAtRef.current",
  "attemptNumber": "number — quantidade de tentativas neste trackId×eventId acumuladas desde que o componente montou (chave '${ev.id}::${target.id}' em attemptCountRef; não é resetado em trocas de evento)",
  "clientTs": "number — Date.now()"
}
```

---

### atlas.identificacao.eventCompleted

Gatilho: `correct === true` E `doneCount + 1 === total` (última partícula do
evento identificada corretamente).

Emitido em: Identificacao.tsx:263–270

```json
{
  "eventIdx": "number — índice do evento atual (0–2)",
  "totalAttempts": "number — totalAttemptsRef.current no momento (resetado em troca de evento)",
  "wrongAttempts": "number — wrongAttemptsRef.current no momento (resetado em troca de evento)",
  "dwellMs": "number — Date.now() - eventStartTsRef.current (resetado em troca de evento)",
  "clientTs": "number — Date.now()"
}
```

---

## MassaInvariante

Arquivo: [frontend/src/modules/lesson/games/atlas/MassaInvariante.tsx](frontend/src/modules/lesson/games/atlas/MassaInvariante.tsx)

---

### atlas.massainvariante.missionEntered

Gatilho: componente montado (useEffect com `[]`).
Emitido em: MassaInvariante.tsx:280
```json
{
  "clientTs": "number — Date.now()"
}
```

---

### atlas.massainvariante.eventLoaded

Gatilho (três situações, mesmo payload):
1. Master propaga novo evento via `currentActivityId` (`sub.startsWith('event-')` e idx diferente do atual).
2. Usuário clica em "Próximo →" (`goNext`, apenas `!readOnly`).
3. Usuário clica em "← Anterior" (`goPrev`, apenas `!readOnly`).

Emitido em: MassaInvariante.tsx:290–296 (master), MassaInvariante.tsx:539–544
(goNext), MassaInvariante.tsx:556–561 (goPrev).

```json
{
  "eventIdx": "number — índice do novo evento (0–19)",
  "previousEventIdx": "number — índice do evento anterior (0–19)",
  "source": "'self' | 'master-propagation'",
  "clientTs": "number — Date.now()"
}
```

---

### atlas.massainvariante.ptFilterToggled

Gatilho: usuário clica no botão "pT ≥ 10 GeV" na toolbar. Emitido em AMBAS as
transições (ativar e desativar).

Emitido em: MassaInvariante.tsx:607–612

```json
{
  "filterOn": "boolean — novo estado do filtro após o clique",
  "wasFirstUse": "boolean — true se é a primeira vez que o filtro é usado nesta instância do componente",
  "eventIdx": "number — índice do evento atual no momento do clique (0–19)",
  "clientTs": "number — Date.now()"
}
```

---

### atlas.massainvariante.noiseTrackInspected

Gatilho: usuário clica no canvas em hit-test de track de ruído (não múon), com
filtro **desligado** (ruído não é exibido quando filtro está ligado).

Emitido em: MassaInvariante.tsx:460–465

```json
{
  "eventIdx": "number — índice do evento atual (0–19)",
  "noiseId": "string — id do track de ruído (formato '${eventIdx}n${j}', ex: '0n2')",
  "filterOnAtMoment": "boolean — valor de filterOnRef.current no momento do clique (sempre false neste contexto, pois ruído só é clicável com filtro off)",
  "clientTs": "number — Date.now()"
}
```

---

### atlas.massainvariante.muonPendingSelected

Gatilho: usuário clica em um múon no canvas quando: filtro está ligado
(`filterOn === true`) E não há múon pendente (`pendingMuonId === null`).

Emitido em: MassaInvariante.tsx:479–483

```json
{
  "eventIdx": "number — índice do evento atual (0–19)",
  "muonId": "string — id do múon selecionado (formato '${i}a' ou '${i}b', onde i é o índice do evento)",
  "clientTs": "number — Date.now()"
}
```

---

### atlas.massainvariante.muonPairCompleted

Gatilho: usuário clica no segundo múon quando há `pendingMuonId` definido e o
múon clicado é diferente do pendente. Emitido imediatamente antes de atualizar
`doneEvents` e `hist`.

Emitido em: MassaInvariante.tsx:493–499

```json
{
  "eventIdx": "number — índice do evento atual (0–19)",
  "muonIds": "string[] — array de dois ids: [pendingMuonId, mu.id] (ordem: primeiro selecionado, segundo selecionado)",
  "massGeV": "number — massa invariante calculada em GeV, arredondada para 2 casas decimais via parseFloat(mass.toFixed(2))",
  "msSinceFirstMuon": "number — Date.now() - firstMuonSelectedAtRef.current",
  "clientTs": "number — Date.now()"
}
```

---

### atlas.massainvariante.histogramMilestone

Gatilho: `newAnalyzed` (total de pares completados nesta instância) atinge
exatamente 5, 8 ou 12. Cada marco dispara no máximo uma vez por instância do
componente (controlado por `milestonesFiredRef`).

Emitido em: MassaInvariante.tsx:519–529

```json
{
  "milestone": "5 | 8 | 12",
  "eventsRegistered": "number — igual ao valor de milestone no momento do disparo",
  "peakBinIdx": "number — índice 0-based do bin com maior contagem no histograma (0–14; 15 bins de 4 GeV entre 60–120 GeV)",
  "peakBinCenter": "number — valor em GeV do centro do bin de pico, formato x.x via toFixed(1)",
  "clientTs": "number — Date.now()"
}
```

---

## HypatiaTutorial

Arquivo: [frontend/src/modules/lesson/games/atlas/HypatiaTutorial.tsx](frontend/src/modules/lesson/games/atlas/HypatiaTutorial.tsx)

**Nota:** `slide.missionId = 'atlas.hypatia.tutorial'`, portanto os nomes finais
de evento têm 4 segmentos (ex: `atlas.hypatia.tutorial.stepAdvanced`), diferindo
do padrão 3-segmentos das demais missões.

---

### atlas.hypatia.tutorial.tutorialStarted

Gatilho: componente montado, **primeira vez** (controlado por `enteredOnceRef`
para evitar disparo em re-renders).

Emitido em: HypatiaTutorial.tsx:171

```json
{
  "clientTs": "number — Date.now()"
}
```

---

### atlas.hypatia.tutorial.stepAdvanced

Gatilho: qualquer avanço de passo — manual (botão "Próximo passo" nos steps 0 e
2), automático (filtro ativado avança step 1→2; pick ativado avança step 3→4;
primeiro múon selecionado avança step 4→5; segundo múon selecionado avança
step 5→6), ou propagação do master via `currentActivityId`.

Emitido em: HypatiaTutorial.tsx:145–152 (função `advanceStep`)

```json
{
  "fromStep": "number — step anterior (0–6)",
  "toStep": "number — step novo (0–6)",
  "trigger": "'click' | 'auto'",
  "dwellInPreviousStepMs": "number — Date.now() - stepEnteredAtRef.current no momento do avanço",
  "source": "'self' | 'master-propagation'",
  "clientTs": "number — Date.now()"
}
```

**Nota:** quando `toStep === 6` (último step), `tutorialCompleted` também é
emitido dentro da mesma chamada a `advanceStep`, logo após `stepAdvanced`.

---

### atlas.hypatia.tutorial.tutorialCompleted

Gatilho: `toStep === STEPS.length - 1` (step 6) dentro de `advanceStep`.
Emitido na mesma chamada que o correspondente `stepAdvanced` (fromStep: 5,
toStep: 6).

Emitido em: HypatiaTutorial.tsx:157–161

```json
{
  "totalDwellMs": "number — Date.now() - tutorialStartedAtRef.current (definido no mount junto com tutorialStarted)",
  "stepsCompleted": "number — literal STEPS.length = 7",
  "clientTs": "number — Date.now()"
}
```

---

### atlas.hypatia.tutorial.ptFilterActivated

Gatilho: usuário clica no botão "pT ≥ 10 GeV" quando `canClickFilter === true`
(`step === 1 && !filterOn`). Emitido apenas uma vez (o botão fica desabilitado
após ativação; não há toggle de volta).

Emitido em: HypatiaTutorial.tsx:416–420

```json
{
  "step": "number — sempre 1 neste evento (condição canClickFilter)",
  "msSinceStepEntered": "number — Date.now() - stepEnteredAtRef.current",
  "clientTs": "number — Date.now()"
}
```

---

### atlas.hypatia.tutorial.pickToolActivated

Gatilho: usuário clica no botão "Pick Tool" quando `canClickPick === true`
(`step === 3 && !pickOn`). Emitido apenas uma vez (botão fica desabilitado após
ativação; não há toggle de volta).

Emitido em: HypatiaTutorial.tsx:432–437

```json
{
  "step": "number — sempre 3 neste evento (condição canClickPick)",
  "msSinceStepEntered": "number — Date.now() - stepEnteredAtRef.current",
  "clientTs": "number — Date.now()"
}
```

---

### atlas.hypatia.tutorial.muonPicked

Gatilho: usuário clica em um múon (não já presente em `picked`) no canvas
transversal **ou** longitudinal, quando `canClickTrackFor(t.id) === true`
(pick ativo E step 4 com picked vazio, OU step 5 com picked de tamanho 1 e
id diferente).

Emitido em: HypatiaTutorial.tsx:327–334 (canvas transversal `onTransClick`) e
HypatiaTutorial.tsx:362–370 (canvas longitudinal `onLongClick`).

```json
{
  "step": "number — 4 (primeiro múon) ou 5 (segundo múon)",
  "muonId": "string — 'mu1' ou 'mu2'",
  "view": "'trans' | 'long'",
  "pickOrder": "number — picked.length + 1 no momento do clique (1 ou 2)",
  "clientTs": "number — Date.now()"
}
```

---

## Eventos planned (não implementados)

Eventos mencionados em `TELEMETRIA_PEDAGOGICA.md`, no `PLANO_ACAO.md` ou
implícitos por simetria com outros eventos, mas sem implementação atual no
código:

- `atlas.reconhecimento.missionCompletedSelf` — botão "Próximo passo →" existe
  no JSX (linha ~1201) mas não chama `onMissionEvent`; aguarda funcionalização.
- `atlas.assinaturas.missionCompletedSelf` — idem; botão existe (linha ~365)
  sem emissão de evento.
- `atlas.hypatia.real.*` — `HypatiaReal.tsx` importado em `components.ts` mas
  não foi analisado (pendente por instrução do prompt); 6 eventos mencionados em
  `TELEMETRIA_PEDAGOGICA.md` como "PR 8 pendente".
- `slide.entered` / `slide.exited` — mencionados em `TELEMETRIA_PEDAGOGICA.md`
  como trabalho futuro; não implementados em nenhum componente atual.

---

## Pontos de atenção

1. **HypatiaTutorial usa `tutorialStarted` em vez de `missionEntered`.**
   As outras quatro missões emitem `missionEntered` ao montar; HypatiaTutorial
   emite `tutorialStarted`. Consultas que assumem `missionEntered` como evento
   universal de entrada não cobrem HypatiaTutorial.

2. **HypatiaTutorial gera nomes de evento com 4 segmentos.**
   `slide.missionId = 'atlas.hypatia.tutorial'` resulta em
   `atlas.hypatia.tutorial.<verbo>`, quebrando o padrão `atlas.<missao>.<verbo>`
   das demais missões. O padrão de 3 segmentos descrito em
   `TELEMETRIA_PEDAGOGICA.md` não se aplica a esta missão.

3. **Emissão de `layerExplored`/`particleExplored` em modo readOnly é incorreta.**
   Em readOnly, `setVisited` nunca é chamado. Portanto, cliques repetidos de um
   player readOnly na mesma camada (Reconhecimento) ou partícula (Assinaturas)
   sempre emitem `layerExplored`/`particleExplored` (nunca `layerRevisited`/
   `particleRevisited`), porque `visited[id]` permanece `false`. O campo
   `source: 'self'` neste contexto indica ação do player, não propagação.

4. **`attemptNumber` em `classificationAttempted` (Identificacao) não é
   totalmente resetado em troca de evento.**
   `attemptCountRef` (um `Map`) usa chave composta `${ev.id}::${target.id}`, o
   que impede colisão entre eventos. Mas o Map em si nunca é limpo durante a
   vida do componente. `totalAttempts` e `wrongAttempts` no payload de
   `eventCompleted` são corretamente resetados por `resetEventCounters()`.

5. **`ptFilterToggled` (MassaInvariante) é bidirecional; `ptFilterActivated`
   (HypatiaTutorial) é unidirecional.**
   MassaInvariante emite no toggle on e off; HypatiaTutorial só emite uma vez
   (ativação). Nomes diferentes refletem semântica diferente — documentar
   separadamente em qualquer análise comparativa.

6. **`noiseTrackInspected.filterOnAtMoment` é estruturalmente sempre `false`.**
   Tracks de ruído só são visíveis e clicáveis quando o filtro está desligado
   (`if (!filterOn)` no hit-test). O campo existe mas não carrega informação
   discriminante no estado atual do código.

7. **`histogramMilestone.eventsRegistered` é redundante com `milestone`.**
   No código, `eventsRegistered` é atribuído como `newAnalyzed` que é
   verificado contra `milestone` na mesma linha — portanto sempre igual a
   `milestone`. Os dois campos têm o mesmo valor garantido.

8. **`layerFocused` (legado) é emitido em preview também, caso o componente
   receba `onLayerFocused` diretamente.**
   Em `MissionSlide.tsx`, a função `handleLayerFocused` só é passada ao
   componente no modo sessão ao vivo (não no bloco `if (!session)`). Em preview,
   o componente recebe `currentActivityId={null}` e `readOnly={false}` sem
   callbacks — portanto `layerFocused` só é emitido em sessões ao vivo.

9. **`source` não é um campo injetado pelo MissionSlide — é payload do componente.**
   Diferente de `interactionMode`, o campo `source` ('self' | 'master-propagation')
   é construído pelo próprio componente e passado para `onMissionEvent`. Não é
   adicionado pelo MissionSlide.
