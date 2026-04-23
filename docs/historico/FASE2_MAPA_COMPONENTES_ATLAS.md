# Mapa dos componentes Mission do ATLAS

_Gerado em 2026-04-23. Diagnóstico exploratório — nenhum código foi alterado._

---

## Reconhecimento (`frontend/src/modules/lesson/games/atlas/Reconhecimento.tsx`)

### Props

```typescript
export interface ReconhecimentoProps {
  /** Activity id ditada pelo master via setActivity (null = sem destaque). */
  currentActivityId?: string | null
  /** Callback ao clicar numa camada ou aba. Recebe subId local:
   *  "id"|"ecal"|"hcal"|"muon" (camada) ou "tab-long"|"tab-trans" (aba). */
  onLayerFocused?: (subId: string) => void
  /** Se true, clique do usuário não altera state local (só master propaga). */
  readOnly?: boolean
}
```

### Estados internos

- `sel: LayerId | null` — camada selecionada (`'id' | 'ecal' | 'hcal' | 'muon'`)
- `hov: LayerId | null` — camada em hover (canvas mouse tracking)
- `visited: Record<string, boolean>` — quais camadas o aluno já explorou
- `tab: TabId ('trans' | 'long')` — vista ativa (transversal ou longitudinal)

### Interações do usuário

| Interação UI | Handler | Instrumentado? | Observações |
|---|---|---|---|
| `canvas.onMouseMove` | `onMove` → `setHov` | NÃO | Hover para highlight de camada |
| `canvas.onMouseLeave` | `setHov(null)` | NÃO | Limpa hover |
| `canvas.onClick` | `onClick` → `setSel`, `setVisited`, `onLayerFocused?.()` | NÃO | Seleciona camada pelo hit-test radial |
| Tab button `onClick` (Longitudinal / Transversal) | `setTab(k)`, `onLayerFocused?.('tab-'+k)` | NÃO | Troca vista; readOnly bloqueia `setTab` mas deixa chamar callback |
| Layer chip button `onClick` | `setSel`, `setVisited`, `onLayerFocused?.(L.id)` | NÃO | Alternativa textual ao clique no canvas |
| "Próximo passo →" button `onClick` | sem handler | NÃO | Botão decorativo — sem `onClick` definido |

### Callbacks para o pai

- `onLayerFocused(subId)`: chamado com `'id'|'ecal'|'hcal'|'muon'` (clique em camada no canvas ou chip) ou `'tab-long'|'tab-trans'` (clique em aba)

### Telemetria atual

Nenhuma. 0 chamadas a `useTelemetry` ou `track()`.

### Modo master-led vs free

- `readOnly=true`: bloqueia `setSel` (canvas click e chips) e `setTab` (tab buttons) — interações do aluno não alteram state local; callbacks continuam sendo chamados.
- `currentActivityId`: parseado por `parseTabOrLayer(activityId)` — distingue se o sufixo após `"atlas.reconhecimento."` é uma camada (`id/ecal/hcal/muon`) ou uma aba (`tab-long/tab-trans`). Atualiza apenas a dimensão correspondente (layer ou tab), preservando o state local da outra dimensão.
- Animação de colisão (canvas) é independente de modo — roda sempre.

---

## Assinaturas (`frontend/src/modules/lesson/games/atlas/Assinaturas.tsx`)

### Props

```typescript
export interface AssinaturasProps {
  currentActivityId?: string | null
  onLayerFocused?: (subId: string) => void
  readOnly?: boolean
}
```

### Estados internos

- `sel: ParticleId | null` — partícula selecionada (`'muon' | 'electron' | 'photon' | 'jet' | 'neutrino'`)
- `visited: Record<string, boolean>` — quais partículas o aluno já explorou

### Interações do usuário

| Interação UI | Handler | Instrumentado? | Observações |
|---|---|---|---|
| Particle pill button `onClick` | `setSel`, `setVisited`, `onLayerFocused?.(p.id)` | NÃO | Seleciona partícula e redesenha canvas |
| "Próximo passo →" button `onClick` | sem handler | NÃO | Botão decorativo — sem `onClick` definido |

### Callbacks para o pai

- `onLayerFocused(subId)`: chamado com `'muon'|'electron'|'photon'|'jet'|'neutrino'` ao clicar em pill

### Telemetria atual

Nenhuma. 0 chamadas a `useTelemetry` ou `track()`.

### Modo master-led vs free

- `readOnly=true`: bloqueia `setSel` e `setVisited`; callback `onLayerFocused` ainda é chamado.
- `currentActivityId`: parseado por `parseSubActivity` — se o sufixo for um dos 5 `ParticleId` válidos, força `sel` para esse valor. Idempotente (só atualiza se diferente do state atual).

---

## Identificacao (`frontend/src/modules/lesson/games/atlas/Identificacao.tsx`)

### Props

```typescript
export interface IdentificacaoProps {
  currentActivityId?: string | null
  onLayerFocused?: (subId: string) => void
  readOnly?: boolean
}
```

### Estados internos

- `eventIdx: number` — índice do evento ATLAS ativo (0..2)
- `identifiedByEvent: Record<string, Record<string, boolean>>` — partículas identificadas por evento
- `wrongFlash: string | null` — ID de partícula que piscou em vermelho (flash 500ms)
- `wrongMsg: { particleId, guessed } | null` — última resposta errada para feedback textual
- `pendingId: string | null` — ID da partícula selecionada no canvas aguardando classificação

### Interações do usuário

| Interação UI | Handler | Instrumentado? | Observações |
|---|---|---|---|
| Event chip button `onClick` | `setEventIdx(i)`, `onLayerFocused?.('event-'+i)` | NÃO | readOnly bloqueia `setEventIdx` |
| Canvas `onClick` | `onCanvasClick` → `setPendingId` | NÃO | Hit-test angular (~12°) nas trajetórias do evento |
| Particle pill button `onClick` | `onPillClick(kind)` → `setIdentified` ou `setWrongFlash` | NÃO | Só ativo quando `pendingId` existe |
| "Próximo evento →" button `onClick` | `goNext` → `setEventIdx`, `onLayerFocused?.('event-'+n)` | NÃO | Aparece quando evento está concluído; readOnly bloqueia `setEventIdx` |

### Callbacks para o pai

- `onLayerFocused(subId)`: chamado com `'event-0'|'event-1'|'event-2'` ao trocar evento (chip ou "Próximo evento →")

### Telemetria atual

Nenhuma. 0 chamadas a `useTelemetry` ou `track()`.

### Modo master-led vs free

- `readOnly=true`: bloqueia `setEventIdx` (event chip e `goNext`); identificação de partículas (`onPillClick`, `onCanvasClick`) **não é bloqueada** pelo `readOnly` — aluno pode identificar mesmo em modo leitura.
- `currentActivityId`: parseado por `parseSubActivity` — se o sufixo for `'event-{n}'`, força `eventIdx` para `n`.

---

## MassaInvariante (`frontend/src/modules/lesson/games/atlas/MassaInvariante.tsx`)

### Props

```typescript
export interface MassaInvarianteProps {
  currentActivityId?: string | null
  onLayerFocused?: (subId: string) => void
  readOnly?: boolean
}
```

### Estados internos

- `eventIdx: number` — índice do evento ativo (0..19, gerados deterministicamente com `mulberry32(42)`)
- `filterOn: boolean` — filtro de energia pT ≥ 10 GeV ativo
- `filterEverUsed: boolean` — controla o highlight de "glow" no botão (one-shot)
- `pendingMuonId: string | null` — primeiro múon selecionado para cálculo do par
- `doneEvents: Record<string, number>` — massa calculada por evento ID
- `hist: number[]` — histograma de massa invariante (15 bins, 60–120 GeV)
- `lastMass: number | null` — última massa calculada (para highlight no histograma)
- `inspected: { kind: 'muon'; muonId: string } | { kind: 'noise'; noiseId: string } | null` — track inspecionado no painel lateral

### Interações do usuário

| Interação UI | Handler | Instrumentado? | Observações |
|---|---|---|---|
| "pT ≥ {PT_CUT} GeV" filter button `onClick` | `setFilterOn(f => !f)`, `setFilterEverUsed(true)` | NÃO | Toggle; PT_CUT = 10 GeV |
| Canvas `onClick` | `onCanvasClick` → `setInspected`, `setPendingMuonId`, calcula `invariantMass`, `setHist`, `setDoneEvents` | NÃO | Hit-test angular para múons e tracks de ruído |
| "← Anterior" button `onClick` | `goPrev` → `setEventIdx`, `onLayerFocused?.('event-'+n)` | NÃO | readOnly bloqueia `setEventIdx` |
| "Próximo →" button `onClick` | `goNext` → `setEventIdx`, `onLayerFocused?.('event-'+n)` | NÃO | readOnly bloqueia `setEventIdx` |

### Callbacks para o pai

- `onLayerFocused(subId)`: chamado com `'event-{n}'` apenas ao navegar via `goNext`/`goPrev`

### Telemetria atual

Nenhuma. 0 chamadas a `useTelemetry` ou `track()`.

### Modo master-led vs free

- `readOnly=true`: bloqueia `setEventIdx` (navegação); filtro e seleção de múons **não são bloqueados** — aluno opera o filtro e pick independentemente.
- `currentActivityId`: parseado por `parseSubActivity` — se o sufixo for `'event-{n}'`, força `eventIdx`.
- Filtro, picking de múons e histograma são **sempre locais** — nunca propagam para o master.

---

## HypatiaTutorial (`frontend/src/modules/lesson/games/atlas/HypatiaTutorial.tsx`)

### Props

```typescript
export interface HypatiaTutorialProps {
  currentActivityId?: string | null
  onLayerFocused?: (subId: string) => void
  readOnly?: boolean
}
```

### Estados internos

- `step: number (0..6)` — passo atual do tutorial
- `filterOn: boolean` — filtro pT ≥ 10 GeV ativo
- `pickOn: boolean` — ferramenta Pick ativa
- `picked: string[]` — IDs dos múons selecionados ('mu1', 'mu2')

Valores derivados: `muon1Picked`, `muon2Picked`, `bothPicked`, `mass: number | null` (calculado quando ambos estão picked).

### Interações do usuário

| Interação UI | Handler | Instrumentado? | Observações |
|---|---|---|---|
| "pT ≥ 10 GeV" button `onClick` | `setFilterOn(true)` | NÃO | Só funciona no step 1 e filtro não ativo; disabled nos demais |
| "Pick Tool" button `onClick` | `setPickOn(true)` | NÃO | Só funciona no step 3 e pick não ativo |
| Canvas transversal `onClick` | `onTransClick` → `setPicked` | NÃO | Hit-test angular; só funciona nos steps 4/5 com `pickOn` |
| Canvas longitudinal `onClick` | `onLongClick` → `setPicked` | NÃO | Hit-test por posição x aproximada; idem steps 4/5 |
| "Próximo passo →" button `onClick` (step 0) | `setStep(1)`, `onLayerFocused?.('step-1')` | NÃO | readOnly bloqueia `setStep` mas deixa callback |
| "Próximo passo →" button `onClick` (step 2) | `setStep(3)`, `onLayerFocused?.('step-3')` | NÃO | idem |

Auto-avance por useEffect (sem interação explícita do usuário):
- step 1 + `filterOn` → step 2
- step 3 + `pickOn` → step 4
- step 4 + 1 picked → step 5
- step 5 + 2 picked → step 6

### Callbacks para o pai

- `onLayerFocused(subId)`: chamado com `'step-1'` e `'step-3'` ao clicar em "Próximo passo →"

### Telemetria atual

Nenhuma. 0 chamadas a `useTelemetry` ou `track()`.

### Modo master-led vs free

- `readOnly=true`: bloqueia `setStep` (botões "Próximo passo →"); ferramentas e picking **não são bloqueados**.
- `currentActivityId`: parseado por `parseSubActivity` — se o sufixo for `'step-{n}'`, força `step`.
- Auto-avanço por useEffect opera mesmo em `readOnly`.

---

## HypatiaReal (`frontend/src/modules/lesson/games/atlas/HypatiaReal.tsx`)

### Props

```typescript
export interface HypatiaRealProps {
  currentActivityId?: string | null
  onLayerFocused?: (subId: string) => void
  readOnly?: boolean
}
```

Nota do código: _"Props aceitas por compatibilidade com o contrato de SlideProps mas não usadas."_

### Estados internos

- `studentName: string` — nome do aluno para export
- `massInput: string` — campo de entrada de massa invariante
- `logged: LoggedEvent[]` — medidas registradas (`{ n, mass }`)
- `hist: number[]` — histograma ao vivo (15 bins, 60–120 GeV)
- `err: string | null` — mensagem de validação do input

### Interações do usuário

| Interação UI | Handler | Instrumentado? | Observações |
|---|---|---|---|
| Nome input `onChange` | `setStudentName(e.target.value)` | NÃO | Usado apenas no export JSON |
| Massa input `onChange` | `setMassInput(e.target.value)` | NÃO | — |
| Massa input `onKeyDown` (Enter) | `addEvent()` | NÃO | Atalho de teclado |
| "Adicionar" button `onClick` | `addEvent()` | NÃO | Valida e insere no histograma |
| "Desfazer último" button `onClick` | `removeLast()` | NÃO | Remove último log e ajusta histograma |
| "Exportar JSON →" button `onClick` | `exportJSON()` | NÃO | Aparece ao atingir 10 eventos |
| "Exportar parcial (JSON)" button `onClick` | `exportJSON()` | NÃO | Aparece antes de completar 10 eventos |
| "Abrir HYPATIA em nova janela →" link | navegação externa (`target="_blank"`) | NÃO | Link simples, não é interação capturada |

### Callbacks para o pai

`onLayerFocused`: **NÃO chamado em nenhuma interação**. A prop é recebida mas nunca invocada.

### Telemetria atual

Nenhuma. 0 chamadas a `useTelemetry` ou `track()`.

### Modo master-led vs free

**NÃO implementado.** As três props (`currentActivityId`, `onLayerFocused`, `readOnly`) são aceitas pela assinatura mas ignoradas pelo código. O componente opera sempre em modo independente/local.

---

## Resumo geral

- **Componentes encontrados: 6/6** (Reconhecimento, Assinaturas, Identificacao, MassaInvariante, HypatiaTutorial, HypatiaReal)
- **Componentes esperados mas não encontrados:** nenhum
- **Total de interações de UI mapeadas: 25**
- **Total instrumentadas: 0**
- **Total NÃO instrumentadas: 25**

### Padrões compartilhados identificados

| Padrão | Onde |
|--------|------|
| Contrato `MissionComponentProps` (`currentActivityId`, `onLayerFocused`, `readOnly`) | `components.ts` — interface formal; todos os 6 componentes a implementam |
| Registry `ATLAS_COMPONENTS` | `components.ts` — mapeia slug `'atlas.xxx'` → `ComponentType<MissionComponentProps>` |
| Função `parseSubActivity(activityId)` | Duplicada em 4 componentes (Assinaturas, Identificacao, MassaInvariante, HypatiaTutorial) — mesma lógica, sem extração para módulo compartilhado |
| Bloco de desenho do detector Canvas (4 camadas concêntricas) | Cada componente tem sua própria cópia local de `drawDetector()` com parâmetros ligeiramente diferentes — sem abstração compartilhada |
| Sem HOC, sem contexto React, sem hook compartilhado | Cada componente é auto-contido |

### Inventário total de interações

| Componente | Total interações | Instrumentadas | Não instrumentadas |
|---|---|---|---|
| Reconhecimento | 6 | 0 | 6 |
| Assinaturas | 2 | 0 | 2 |
| Identificacao | 4 | 0 | 4 |
| MassaInvariante | 4 | 0 | 4 |
| HypatiaTutorial | 6 | 0 | 6 |
| HypatiaReal | 7 | 0 | 7 |
| **Total** | **29** | **0** | **29** |

_Nota: "Abrir HYPATIA em nova janela →" (link externo) não foi contado acima por ser `<a>` sem handler — totalizando 29 interações capturáveis._
