# Editor de Aulas — Arquitetura e Roadmap

**Data:** 2026-04-23  
**Contexto:** Análise do estado atual e proposta de arquitetura modular para o editor de aulas do labprof21.

---

## 1. O que temos hoje

### 1.1 Infraestrutura sólida (manter intacta)

```
content_loader.py          → parseia .md + frontmatter YAML, valida schema por tipo
validate.py                → CLI de validação (docker compose exec api python -m modules.lab.validate)
SlideRenderer.tsx          → dispatcher por tipo → componente React
TextSlide.tsx              → markdown + KaTeX (robusto)
VideoSlide.tsx             → YouTube/Vimeo embed
QuizSlide.tsx              → múltipla escolha (preview estático + live session)
MissionSlide.tsx           → componente TSX via missionId registry
manifest.ts                → types TypeScript espelhando o schema Python
live_events (table)        → telemetria bruta de sessão ao vivo (já existe)
```

**Nada disso muda.** A proposta acrescenta camadas acima.

### 1.2 Tipos de slide hoje

| Tipo | Renderer | Editor UI | Telemetria |
|------|----------|-----------|-----------|
| `text` | ✅ | ❌ | ❌ |
| `video` | ✅ | ❌ | ❌ |
| `quiz` (MC simples) | ✅ | ❌ parcial | ❌ |
| `mission` (TSX) | ✅ | ❌ | ❌ |
| `custom` | ❌ placeholder | ❌ | ❌ |

### 1.3 O que falta

- **Tipos:** PhET, GeoGebra, quiz com imagens, resposta aberta, completar lacuna
- **Editor:** nenhum UI de criação/edição de slides no browser
- **Telemetria:** sem coleta de eventos de interação dos alunos
- **Registro formal de tipos:** switch/case hardcoded no SlideRenderer — difícil de estender

---

## 2. Princípio central: Slide Type Registry

O problema raiz é que cada novo tipo de slide exige mexer em múltiplos lugares:
`content_loader.py`, `manifest.ts`, `SlideRenderer.tsx`, e qualquer editor que vier.

A solução é um **registro central** onde cada tipo de slide declara tudo que precisa:

```
┌─────────────────────────────────────────────────────────────┐
│                    SlideTypeRegistry                        │
│                                                             │
│  'text'      → { schema, Renderer, Editor, serialize }      │
│  'video'     → { schema, Renderer, Editor, serialize }      │
│  'quiz'      → { schema, Renderer, Editor, serialize }      │
│  'phet'      → { schema, Renderer, Editor, serialize }      │
│  'geogebra'  → { schema, Renderer, Editor, serialize }      │
│  'mission'   → { schema, Renderer, Editor, telemetry }      │
│  'quiz-image'→ { schema, Renderer, Editor, serialize }      │
│  'quiz-open' → { schema, Renderer, Editor, telemetry }      │
│  'quiz-fill' → { schema, Renderer, Editor, serialize }      │
└─────────────────────────────────────────────────────────────┘
         ↑                    ↑                  ↑
    content_loader      SlideRenderer      LessonEditor
```

Adicionar um novo tipo = criar um arquivo, registrar. Zero mudanças no código existente.

---

## 3. Novos tipos de slide — spec completa

### 3.1 `phet` — Simulação PhET

```yaml
---
type: phet
label: "Simulação: Projéteis"
src: "https://phet.colorado.edu/sims/html/projectile-motion/latest/projectile-motion_all.html"
height: 600          # opcional, default 550px
notesForMaster: "Peça aos alunos para ajustar o ângulo e observar o alcance."
---
```

**Renderer:** iframe com sandbox seguro.  
**Telemetria futura:** `phet.launched`, `phet.interaction` (via postMessage da simulação).

---

### 3.2 `geogebra` — Material GeoGebra

```yaml
---
type: geogebra
label: "Gráfico: Cinemática"
materialId: "abc123xyz"    # ID do material em geogebra.org/m/<materialId>
height: 500
showToolbar: false         # opcional
notesForMaster: "Mostre como a inclinação representa a velocidade."
---
```

**Renderer:** iframe `geogebra.org/material/iframe/id/<materialId>`.  
**Telemetria futura:** via GeoGebra API (eventos de manipulação).

---

### 3.3 `quiz-image` — Múltipla escolha com imagens

```yaml
---
type: quiz-image
label: "Identifique a partícula"
questionId: q-particula-01
stem: "Qual rastro corresponde ao elétron?"
options:
  - label: "Trajetória circular curta"
    image: images/rastro-a.png
  - label: "Trajetória helicoidal longa"
    image: images/rastro-b.png
  - label: "Linha reta"
    image: images/rastro-c.png
correctIndex: 0
---
```

**Renderer:** grid de cards com imagem + label, selecionável.  
**Comportamento live:** igual ao `quiz` existente (open/close/reveal via WebSocket).

---

### 3.4 `quiz-open` — Resposta aberta

```yaml
---
type: quiz-open
label: "Reflexão final"
questionId: q-reflexao-01
stem: "O que você aprendeu sobre o detector ATLAS?"
minChars: 50
maxChars: 500
notesForMaster: "Discuta 2-3 respostas dos alunos em voz alta antes de seguir."
---
```

**Renderer:** textarea + contador de caracteres. Não tem "resposta certa" — professor lê ao vivo.  
**Armazenamento:** nova tabela `open_answers` (ver seção 6).  
**Telemetria:** `answer.submit` com texto completo.

---

### 3.5 `quiz-fill` — Completar lacuna

```yaml
---
type: quiz-fill
label: "Complete a equação"
questionId: q-formula-01
template: "A velocidade média é {blank0} dividida pelo {blank1}."
blanks:
  - answer: "deslocamento"
    options: ["deslocamento", "aceleração", "massa"]   # omitir → digitar livremente
  - answer: "intervalo de tempo"
    options: ["intervalo de tempo", "força", "energia"]
---
```

**Renderer:** template com lacunas como dropdowns (se `options`) ou inputs (se sem `options`).  
**Score:** 1 ponto por lacuna correta.

---

## 4. Arquitetura do frontend

### 4.1 Estrutura de pastas proposta

```
frontend/src/modules/editor/
├── registry/
│   ├── index.ts                   ← SlideTypeRegistry (singleton)
│   ├── types.ts                   ← SlideTypeDefinition<T> interface
│   └── entries/
│       ├── text.ts                ← registro do tipo text
│       ├── video.ts               ← registro do tipo video
│       ├── quiz.ts                ← registro do tipo quiz (MC)
│       ├── quiz-image.ts          ← registro do tipo quiz-image
│       ├── quiz-open.ts           ← registro do tipo quiz-open
│       ├── quiz-fill.ts           ← registro do tipo quiz-fill
│       ├── phet.ts                ← registro do tipo phet
│       ├── geogebra.ts            ← registro do tipo geogebra
│       └── mission.ts             ← registro do tipo mission
├── components/
│   ├── LessonEditor.tsx           ← componente raiz do editor
│   ├── SlideList.tsx              ← sidebar com lista + drag-reorder
│   ├── SlideForm.tsx              ← delega para editor do tipo via registry
│   ├── SlidePreview.tsx           ← usa SlideRenderer existente
│   └── AddSlideModal.tsx          ← seleciona o tipo ao criar novo slide
└── renderers/                     ← novos renderers (PhET, GeoGebra, etc.)
    ├── PhetSlide.tsx
    ├── GeoGebraSlide.tsx
    ├── QuizImageSlide.tsx
    ├── QuizOpenSlide.tsx
    └── QuizFillSlide.tsx
```

Os renderers existentes (`TextSlide`, `VideoSlide`, `QuizSlide`, `MissionSlide`) **não se movem** — continuam em `modules/lab/components/`.

### 4.2 Interface SlideTypeDefinition

```typescript
// registry/types.ts

export interface ValidationError {
  field: string
  message: string
}

export interface TelemetryEvent {
  type: string           // "layer.focus", "answer.submit", etc.
  slideId: string
  payload: Record<string, unknown>
}

export interface SlideTypeDefinition<TSlide extends SlideBase = SlideBase> {
  /** Identificador único — deve bater com o `type` no .md */
  type: string

  /** Label legível para o editor (ex: "Vídeo YouTube") */
  label: string

  /** Ícone SVG inline (16×16) */
  icon: React.ReactNode

  /** Valida um objeto qualquer; retorna o slide tipado ou lista de erros */
  validate(raw: unknown): TSlide | ValidationError[]

  /** Renderer de apresentação — reutiliza os existentes quando possível */
  Renderer: React.ComponentType<{
    slide: TSlide
    session?: unknown          // SessionContext (opcional, para live)
    onTelemetry?: (e: TelemetryEvent) => void
  }>

  /** Formulário de edição no LessonEditor */
  Editor: React.ComponentType<{
    value: TSlide
    onChange: (slide: TSlide) => void
    lessonSlug?: string        // para upload de imagens
  }>

  /** Converte slide → conteúdo de arquivo .md (frontmatter + body) */
  serialize(slide: TSlide): string

  /** Parse de .md → slide (wrapper do content_loader para o frontend) */
  deserialize(md: string): TSlide | ValidationError[]
}
```

### 4.3 Registry

```typescript
// registry/index.ts

const _registry = new Map<string, SlideTypeDefinition>()

export const SlideTypeRegistry = {
  register(def: SlideTypeDefinition) {
    _registry.set(def.type, def)
  },
  get(type: string): SlideTypeDefinition | undefined {
    return _registry.get(type)
  },
  all(): SlideTypeDefinition[] {
    return [..._registry.values()]
  },
}
```

```typescript
// entry point (App.tsx ou editor/index.ts)
import './registry/entries/text'
import './registry/entries/video'
import './registry/entries/quiz'
import './registry/entries/quiz-image'
import './registry/entries/quiz-open'
import './registry/entries/quiz-fill'
import './registry/entries/phet'
import './registry/entries/geogebra'
import './registry/entries/mission'
```

**SlideRenderer atualizado** — torna-se uma casca fina sobre o registry:

```typescript
// modules/lab/components/SlideRenderer.tsx (após refactor)

export function SlideRenderer({ slide, ...props }) {
  const def = SlideTypeRegistry.get(slide.type)
  if (!def) return <UnsupportedSlide slide={slide} />
  return <def.Renderer slide={slide} {...props} />
}
```

Resultado: o switch/case hardcoded some. Adicionar um tipo novo = registrar o arquivo.

### 4.4 LessonEditor

```
┌───────────────────────────────────────────────────────────┐
│  LessonEditor                                              │
│                                                           │
│  ┌─────────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │   SlideList     │  │  SlideForm   │  │SlidePreview │ │
│  │  (sidebar)      │  │  (canvas)    │  │(live render)│ │
│  │                 │  │              │  │             │ │
│  │ [01] Capa    ≡  │  │ Tipo: text   │  │ # ATLAS     │ │
│  │ [02] Vídeo   ≡  │  │ Label: Capa  │  │             │ │
│  │ [03] Quiz    ≡  │  │ Body:        │  │ **Recruta** │ │
│  │ [04] PhET    ≡  │  │ ┌──────────┐│  │             │ │
│  │ [+]          │  │  │ │markdown  ││  │ ...         │ │
│  │              │  │  │ │editor    ││  │             │ │
│  └─────────────────┘  │ └──────────┘│  └─────────────┘ │
│                        └──────────────┘                  │
│  [Salvar como .md]  [Salvar no banco]  [Publicar]        │
└───────────────────────────────────────────────────────────┘
```

**Modo de persistência** (configurável por aula):
- `file`: salva como `.md` em `games_content/<slug>/` (via API de arquivo)
- `db`: salva em `lesson_slides` no banco (sem dependência de disco)

---

## 5. Arquitetura do backend

### 5.1 Novos tipos no content_loader.py

Adicionar ao `VALID_SLIDE_TYPES`:

```python
VALID_SLIDE_TYPES = {
    "text", "video", "quiz", "mission", "custom",   # existentes
    "phet", "geogebra",                              # novo: embeds externos
    "quiz-image", "quiz-open", "quiz-fill",          # novo: variantes de quiz
}
```

Adicionar `validate_slide()` para cada novo tipo — mesma estrutura que já existe.

### 5.2 Novos endpoints (API de edição de arquivos)

Para o modo `file` (Passo 1, sem mudança de schema):

```
POST   /api/lab/games/{slug}/slides
       body: { filename: "05-phet.md", content: "<md string>" }
       → cria ou substitui o arquivo; retorna o slide parseado

GET    /api/lab/games/{slug}/slides/{slide_id}
       → lê o .md, parseia, retorna slide dict

PUT    /api/lab/games/{slug}/slides/{slide_id}
       body: { content: "<md string>" }
       → sobrescreve o .md

DELETE /api/lab/games/{slug}/slides/{slide_id}
       → remove o .md

PUT    /api/lab/games/{slug}/slides/reorder
       body: ["01-capa", "03-quiz", "02-video"]  ← nova ordem por slide_id
       → renomeia os arquivos para preservar a ordem (01-, 02-, 03-...)
```

**Segurança:** path validation no slug e filename (sem `..`, sem `/`).

### 5.3 Schema para modo `db` (Passo 2, médio prazo)

```sql
CREATE TABLE lessons (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(200) NOT NULL,
  slug        VARCHAR(120),           -- opcional: games_content/<slug>/ para slides tipo file
  visibility  VARCHAR(16) DEFAULT 'private',
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE lesson_slides (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id   UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  position    INT  NOT NULL,
  -- Origem A: inline (criado no editor)
  slide_type  VARCHAR(40),            -- text, video, quiz, phet, geogebra, ...
  content     JSONB,                  -- campos específicos do tipo
  md_body     TEXT,                   -- body markdown (para tipos text)
  -- Origem B: arquivo .md
  md_file     VARCHAR(200),           -- ex: "03-reconhecimento.md" (null se inline)
  UNIQUE (lesson_id, position)
);
```

**Regra de leitura no endpoint `GET /api/lessons/:id/manifest`:**
```python
for slide_record in lesson_slides:
    if slide_record.md_file:
        # lê do disco com content_loader.parse_file(lesson.slug, md_file)
        slide = parse_md_file(lesson.slug, slide_record.md_file)
    else:
        # monta o dict inline
        slide = build_inline_slide(slide_record)
    manifest_slides.append(slide)
```

---

## 6. Telemetria

### 6.1 Princípio

Missões TSX e quizzes emitem **eventos padronizados** via hook. O sistema de armazenamento é transparente para o componente: não importa se é sessão ao vivo ou trilha assíncrona.

```typescript
// hook: useTelemetry()

interface TelemetryEvent {
  type: string               // "layer.focus", "answer.submit", "quiz.answer", ...
  slideId: string
  payload: Record<string, unknown>
}

function useTelemetry(slideId: string): { emit: (e: Omit<TelemetryEvent, 'slideId'>) => void }
```

### 6.2 Implementação do hook

```typescript
// modules/editor/telemetry/useTelemetry.ts

export function useTelemetry(slideId: string) {
  const session = useSessionOptional()   // live session (pode ser null)
  const lessonSlug = useLessonSlug()     // contexto do lesson atual

  const emit = useCallback((event: Omit<TelemetryEvent, 'slideId'>) => {
    const full: TelemetryEvent = { ...event, slideId }

    if (session) {
      // Sessão ao vivo → WebSocket existente
      session.logEvent({ type: full.type, payload: full.payload })
    } else {
      // Trilha assíncrona → REST API (fire-and-forget)
      fetch('/api/telemetry/events', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ lessonSlug, ...full }),
      }).catch(() => {/* non-blocking */})
    }
  }, [session, slideId, lessonSlug])

  return { emit }
}
```

### 6.3 Uso em MissionSlide (exemplo)

```typescript
// modules/lab/components/MissionSlide.tsx (após adicionar telemetria)

function MissionSlide({ slide }) {
  const { emit } = useTelemetry(slide.id)

  return (
    <MissionComponent
      missionId={slide.missionId}
      onLayerFocus={(layerId) => emit({ type: 'layer.focus', payload: { layerId } })}
      onLayerComplete={(layerId, timeMs) => emit({ type: 'layer.complete', payload: { layerId, timeMs } })}
    />
  )
}
```

### 6.4 Tabela de eventos

```sql
CREATE TABLE slide_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Contexto
  user_id      UUID REFERENCES users(id),
  lesson_slug  VARCHAR(120),
  slide_id     VARCHAR(120),
  session_id   UUID REFERENCES live_sessions(id),  -- null se assíncrono
  -- Evento
  event_type   VARCHAR(80),    -- "layer.focus", "quiz.answer", "phet.interaction"
  payload      JSONB,
  ts           TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ON slide_events (lesson_slug, slide_id);
CREATE INDEX ON slide_events (user_id, ts DESC);
CREATE INDEX ON slide_events (session_id);
```

### 6.5 Vocabulário de eventos por tipo

| Slide | Evento | Payload |
|-------|--------|---------|
| `mission` | `layer.focus` | `{layerId}` |
| `mission` | `layer.complete` | `{layerId, timeMs}` |
| `quiz`, `quiz-image` | `quiz.answer` | `{questionId, answerIndex, correct, timeMs}` |
| `quiz-open` | `answer.submit` | `{questionId, text, charCount}` |
| `quiz-fill` | `fill.answer` | `{questionId, blankIndex, answer, correct}` |
| `phet` | `phet.launched` | `{src}` |
| `geogebra` | `geo.interaction` | `{materialId, eventData}` |
| `text`, `video` | `slide.entered` | `{prevSlideId?}` |
| `text`, `video` | `slide.exited` | `{nextSlideId?, timeMs}` |

`slide.entered` / `slide.exited` são emitidos automaticamente pelo `LessonEditor`/`SessionPage` — os componentes individuais não precisam se preocupar com isso.

---

## 7. Roadmap de implementação

### Fase A — Novos tipos de slide (2 dias)

Sem editor ainda. Apenas suporte para ler e renderizar.

**Backend:**
- [ ] Adicionar `phet`, `geogebra`, `quiz-image`, `quiz-open`, `quiz-fill` ao `content_loader.py`
- [ ] Adicionar validação de schema para cada tipo
- [ ] Atualizar `VALID_SLIDE_TYPES`

**Frontend:**
- [ ] Adicionar types ao `manifest.ts`
- [ ] Criar `PhetSlide.tsx` (iframe sandbox)
- [ ] Criar `GeoGebraSlide.tsx` (iframe GeoGebra)
- [ ] Criar `QuizImageSlide.tsx` (grid de cards com imagem)
- [ ] Criar `QuizOpenSlide.tsx` (textarea + contador)
- [ ] Criar `QuizFillSlide.tsx` (template com lacunas)
- [ ] Atualizar `SlideRenderer.tsx` com os novos tipos

**Critério de aceite:** criar um `.md` com cada novo tipo, `validate.py` passa, preview renderiza.

---

### Fase B — Slide Type Registry (1 dia)

Refatoração interna. Zero mudança para o usuário.

- [ ] Criar `modules/editor/registry/types.ts` (interface `SlideTypeDefinition`)
- [ ] Criar `modules/editor/registry/index.ts` (singleton)
- [ ] Criar `registry/entries/` para cada tipo existente + novos
- [ ] Refatorar `SlideRenderer.tsx` para usar o registry
- [ ] Rodar `tsc --noEmit` dentro do container

**Critério de aceite:** SlideRenderer sem switch/case. Adicionar um tipo novo = criar um arquivo.

---

### Fase C — Lesson Editor (4 dias)

**Backend (APIs de arquivo):**
- [ ] `POST /api/lab/games/{slug}/slides` — cria `.md`
- [ ] `GET /api/lab/games/{slug}/slides/{id}` — lê `.md` parseado
- [ ] `PUT /api/lab/games/{slug}/slides/{id}` — edita `.md`
- [ ] `DELETE /api/lab/games/{slug}/slides/{id}` — remove `.md`
- [ ] `PUT /api/lab/games/{slug}/slides/reorder` — renomeia arquivos para nova ordem
- [ ] Path validation (sem `..` ou `/` no slug/filename)

**Frontend:**
- [ ] `modules/editor/components/LessonEditor.tsx` — componente raiz
- [ ] `modules/editor/components/SlideList.tsx` — lista com drag-reorder (usar `@dnd-kit/core`)
- [ ] `modules/editor/components/SlideForm.tsx` — delega para `def.Editor` do registry
- [ ] `modules/editor/components/SlidePreview.tsx` — iframe do `SlideRenderer` existente
- [ ] `modules/editor/components/AddSlideModal.tsx` — grid de tipos disponíveis
- [ ] Editor forms para cada tipo (um componente `Editor` por tipo no registry)
- [ ] Rota `/teacher/lesson/:slug/edit` → `LessonEditor`
- [ ] Link "editar" na LibraryPage para cada InteractiveLesson

**Critério de aceite:** professor abre a UI, cria uma aula com 4 tipos de slide diferentes, salva, abre preview — funciona.

---

### Fase D — Telemetria (2 dias)

- [ ] Criar tabela `slide_events` no schema
- [ ] Endpoint `POST /api/telemetry/events` (auth student ou teacher)
- [ ] Criar `useTelemetry()` hook no frontend
- [ ] Adicionar telemetria ao `MissionSlide` (`layer.focus`, `layer.complete`)
- [ ] Adicionar telemetria ao `QuizSlide` e novos tipos de quiz (`quiz.answer`, `fill.answer`)
- [ ] Emitir `slide.entered` / `slide.exited` no `SessionPage` e `TrailPage`
- [ ] Endpoint `GET /api/lessons/{slug}/events` — relatório pós-aula para o professor

**Critério de aceite:** depois de uma aula ao vivo, professor vê lista de eventos com quem clicou em qual camada e quando respondeu cada quiz.

---

## 8. Decisões de design

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| Registry singleton vs. import direto | Singleton | Permite extensão sem tocar código existente |
| `.md` vs. banco como fonte | `.md` no Passo 1, banco opcional no Passo 2 | `.md` funciona agora; banco escala melhor |
| Telemetria live vs. async | Mesmo hook, destino diferente | Componentes TSX não conhecem o contexto de execução |
| Reordenação de slides | Renomear arquivos (01-, 02-...) | Preserva a legibilidade dos `.md` no disco |
| Drag-reorder no editor | `@dnd-kit/core` | Acessível, TypeScript-first, sem deps pesadas |
| Preview no editor | Iframe ou componente direto | Componente direto (mesma instância React, sem comunicação cross-frame) |
| Novos tipos de quiz | Tipos separados (`quiz-image`, `quiz-open`, `quiz-fill`) | Schemas distintos no content_loader, renderers distintos |

---

## 9. Resumo visual da arquitetura final

```
                    CRIAÇÃO
                       │
         ┌─────────────┴──────────────┐
         │                            │
    Arquivo .md              Editor no browser
    (IA ou manual)          (LessonEditor)
         │                            │
         └──────────┬─────────────────┘
                    │
             content_loader.py
             (parse + validate)
                    │
              Manifest JSON
                    │
         ┌──────────┴──────────────┐
         │                         │
   SlideRenderer               live_events /
   (SlideTypeRegistry)         slide_events
         │                         │
         ↓                         ↓
   ┌──────────┐             ┌────────────┐
   │ Renderer │             │  Telemetria│
   │ por tipo │ ←emit───── │  (hook)    │
   └──────────┘             └────────────┘

Tipos de slide:
  text · video · phet · geogebra
  quiz · quiz-image · quiz-open · quiz-fill
  mission (TSX) · custom
```

---

## 10. Esforço total estimado

| Fase | Descrição | Esforço |
|------|-----------|---------|
| A | Novos tipos (phet, geogebra, quiz variants) | 2 dias |
| B | Slide Type Registry (refactor) | 1 dia |
| C | Lesson Editor (UI + APIs de arquivo) | 4 dias |
| D | Telemetria | 2 dias |
| **Total** | | **~9 dias** |

As fases A e B não exigem mudança de schema e não quebram nada. Podem ir para produção independentemente.
