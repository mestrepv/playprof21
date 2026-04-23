# Fase A — Novos tipos de slide (concluída)

## O que foi implementado

4 novos tipos de slide adicionados ao módulo `lesson`:

| Tipo | Componente | Descrição |
|------|-----------|-----------|
| `phet` | `PhetSlide.tsx` | Embed iframe de simulação PhET Colorado |
| `geogebra` | `GeogebraSlide.tsx` | Embed iframe de applet GeoGebra |
| `quiz-image` | `QuizImageSlide.tsx` | Múltipla escolha com imagem na pergunta |
| `quiz-fill` | `QuizFillSlide.tsx` | Completar lacuna — resposta textual |

---

## Arquivos modificados/criados

| Ação | Arquivo |
|------|---------|
| Modificado | `frontend/src/modules/lesson/types/manifest.ts` |
| Modificado | `frontend/src/modules/lesson/components/SlideRenderer.tsx` |
| Modificado | `backend/modules/lesson/content_loader.py` |
| Criado | `frontend/src/modules/lesson/components/PhetSlide.tsx` |
| Criado | `frontend/src/modules/lesson/components/GeogebraSlide.tsx` |
| Criado | `frontend/src/modules/lesson/components/QuizImageSlide.tsx` |
| Criado | `frontend/src/modules/lesson/components/QuizFillSlide.tsx` |
| Criado | `backend/modules/lesson/games_content/atlas-v1/10-phet-demo.md` |
| Criado | `backend/modules/lesson/games_content/atlas-v1/11-geogebra-demo.md` |

---

## Formato YAML de cada tipo

### `phet`
```yaml
---
type: phet
label: "Simulação — Lei de Faraday"
simUrl: "https://phet.colorado.edu/sims/html/faradays-law/latest/faradays-law_pt_BR.html"
height: 560                    # opcional, padrão 560
notesForMaster: "..."
---
```

### `geogebra`
```yaml
---
type: geogebra
label: "GeoGebra — Explore a parábola"
materialId: "ekgypreh"         # ID público em geogebra.org
height: 500                    # opcional, padrão 500
showToolbar: false             # opcional, padrão false
showAlgebraInput: false        # opcional, padrão false
notesForMaster: "..."
---
```

### `quiz-image`
```yaml
---
type: quiz-image
label: "Quiz — identifique o detector"
questionId: "atlas-q-detector"
stem: "Qual camada do detector está destacada em amarelo?"
image: "./images/detector-destaque.png"   # relativa ou absoluta
imageAlt: "Diagrama do detector ATLAS"    # opcional
options:
  - "Inner Detector"
  - "Calorímetro EM"
  - "Calorímetro Hadrônico"
  - "Espectrômetro de Múons"
correctIndex: 1
notesForMaster: "..."
---
```

### `quiz-fill`
```yaml
---
type: quiz-fill
label: "Complete a equação"
questionId: "atlas-q-energia"
stem: "A energia em repouso de uma partícula é dada por E = ___"
answer: "mc²"
acceptedAnswers:              # opcional — variações aceitas
  - "mc^2"
  - "m·c²"
hint: "Lembre da equação de Einstein"   # opcional
notesForMaster: "..."
---
```

---

## Comportamento de `quiz-fill`

- Enunciado com `___` → lacuna é renderizada inline como sublinhado
- Enunciado sem `___` → campo de texto aparece abaixo
- Comparação: case-insensitive + trim em `answer` + `acceptedAnswers`
- Modo preview (sem sessão ao vivo): totalmente interativo localmente
- Modo ao vivo: por ora funciona como preview — integração com SessionContext é Fase D

---

## Próximas fases

- **Fase B** — Slide Type Registry (`modules/lesson/registry.ts`): centraliza Renderer + validação por tipo para evitar o switch manual
- **Fase C** — Editor UI (`modules/teacher/LessonEditorPage.tsx`): cria/edita slides via browser
- **Fase D** — Telemetria (`useTelemetry()` hook + `slide_events` table)
