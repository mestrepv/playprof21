# Relatório: Criação de Aulas — play.prof21 vs labprof21

**Data:** 2026-04-23  
**Objetivo:** Comparar os dois sistemas de criação de conteúdo e analisar a viabilidade de portar a abordagem simples do play.prof21, admitindo que um slide possa ser carregado a partir de arquivo `.md`.

---

## 1. Como o play.prof21 cria aulas

### 1.1 Entidades de conteúdo

O play.prof21 tem **três camadas** de conteúdo:

| Entidade | Função |
|----------|--------|
| **Activity** | Unidade atômica (quiz, jogo, exercício) |
| **Coleção** | Agrupamento ordenado de atividades (trilha ou apresentação) |
| **Aula Interativa (Lesson)** | Sequência de slides com blocks de texto/mídia/quiz |

As três são independentes. Um professor pode usar só atividades numa coleção, só aulas interativas com slides, ou misturar.

---

### 1.2 Editor de Aula Interativa (Lesson Editor)

O editor vive em `panel/lessons/:id/editor`. É o recurso mais rico do play.prof21.

#### Tipos de step (slides)

| Tipo | Descrição |
|------|-----------|
| `slide` | Block editor (heading, text, formula, image, callout, etc.) |
| `quiz-mc` | Múltipla escolha |
| `quiz-image` | Múltipla escolha com imagens nas opções |
| `open-answer` | Resposta aberta (professor corrige manualmente) |
| `type-word` | Completar lacuna digitando |
| `pick-word` | Completar lacuna escolhendo de lista |
| `youtube` | Vídeo embutido |
| `phet` | Simulação PhET |
| `geogebra` | Material GeoGebra |

**Total: 9 tipos de step.**

#### Block types dentro de um `slide`

| Block | Descrição |
|-------|-----------|
| `heading` | Título com cor (azul/verde/roxo/default) |
| `text` | Parágrafo com markdown simples (**bold**) |
| `formula` | LaTeX com tamanho (small/medium/large) e animação build-up |
| `image` | Foto/diagrama com legenda |
| `callout` | Caixa de info (info/question/warning/example; cores) |
| `divider` | Separador horizontal |
| `variables` | Cards de variáveis físicas (símbolo, nome, unidade, cor) |
| `simulation` | Placeholder para código JS interativo (futuro) |

**Total: 8 tipos de block.**

#### Workflow do editor

```
1. Professor navega para panel/lessons → "Criar nova aula"
2. API cria uma lesson em branco → redireciona para o editor
3. No editor:
   - Sidebar esquerda: lista de steps com ícones e posição (drag para reordenar)
   - Canvas central: formulário de edição do step selecionado
   - Para tipo "slide": sub-editor de blocks (lista + editor + preview ao vivo)
   - Para tipos quiz/media: formulário simples (pergunta, opções, URL, etc.)
4. Botão "Adicionar item" → modal de seleção do tipo
5. Botão Preview → visualização full-screen com navegação
6. Botão Publicar → marca como published; ativa para uso em turmas
```

#### Armazenamento

Tudo em banco de dados MySQL:

```sql
lessons (
  id, professor_id, title, description,
  status (draft/published/archived),
  created_at, updated_at
)

lesson_steps (
  id, lesson_id, position, type, title,
  content JSON,   -- estrutura específica por tipo
  points INT      -- 0 para slides/mídia, 10 para quizzes
)
```

**Conteúdo JSON por tipo:**
```json
// slide
{ "blocks": [
  { "id": "...", "type": "heading", "content": "Título", "props": {...} }
] }

// quiz-mc
{ "question": "...", "options": ["A","B","C"], "correct": 1 }

// youtube
{ "videoId": "abc123", "startAt": 0 }

// open-answer
{ "question": "..." }

// type-word
{ "sentence": "O ___ caiu", "blank": "gato" }
```

---

### 1.3 Editor de Atividades

O play.prof21 tem **11 tipos de atividade** interativa (mais essay custom):

`multiple-choice` · `image-choice` · `fill-blanks` · `drag-blanks` · `matching` · `sort-categories` · `memory-game` · `quark-memory` · `sequencing` · `crossword` · `mark-words` · `essay`

Cada tipo tem um editor específico registrado em `editor-registry.ts`.

**Workflow:**
```
1. panel/activities/new → formulário de metadados (título, tipo, seção, shuffle)
2. "Criar" → API cria metadados → redireciona para content editor específico do tipo
3. Professor preenche as questões/pares/etc no editor
4. "Salvar" → calcula maxScore, salva em activity_content (JSON)
5. "Publicar" → status = 'published'
```

**Armazenamento:**
```sql
activities (id, type, title, max_score, status, owner_id, ...)
activity_content (activity_id, activity_data JSON, version)
```

---

### 1.4 Editor de Coleções

Uma coleção é uma sequência ordenada de atividades.

**Workflow:**
```
1. Criar coleção (nome, tipo: trail/presentation, modo: live/async)
2. Collection editor: canvas visual com nós conectados (estilo Duolingo)
3. Botão "Adicionar atividade" → activity picker (busca, filtros)
4. Drag para reordenar
5. Vincular a turmas
```

**Armazenamento:**
```sql
collections (id, professor_id, name, type, mode, status)
collection_activities (collection_id, activity_id, position)
collection_turmas (collection_id, turma_id)
```

---

## 2. Como o labprof21 cria aulas

### 2.1 Entidades de conteúdo

| Entidade | Função |
|----------|--------|
| **Activity** | Unidade atômica (quiz simples, external-link, simulator stub, animation stub) |
| **Trail** | Sequência ordenada de atividades |
| **InteractiveLesson** | Ponteiro para pasta `.md` no disco |

### 2.2 InteractiveLesson — formato `.md`

O conteúdo fica em `backend/modules/lab/games_content/<slug>/`.  
Cada arquivo `.md` é um slide. O `content_loader.py` parseia frontmatter YAML + corpo markdown.

#### Tipos de slide suportados

| Tipo | Campos YAML | Body |
|------|-------------|------|
| `text` | `type, label, sideImage?, sideImageAlt?, sidePosition?, notesForMaster?` | Markdown + KaTeX |
| `video` | `type, label, src, startAt?` | Ignorado |
| `quiz` | `type, label, questionId, stem, options[], correctIndex` | Ignorado |
| `mission` | `type, label, missionId, interactionMode?, activities[]` | Ignorado |
| `custom` | `type, label, componentId, props?` | Ignorado |

**Total: 5 tipos de slide.**

#### Fluxo atual de criação de uma aula interativa

```
1. Paulo (com IA ou manualmente) escreve os arquivos .md na pasta games_content/
2. Executa o validador: docker compose exec api python -m modules.lab.validate
3. Vai para /teacher/library → aba Aulas Interativas
4. Informa título + slug (nome da pasta)
5. Clica "+" → InteractiveLesson criada no banco
6. "preview →" mostra os slides renderizados
7. Pode atribuir a turma via ClassroomPage
```

**Não há editor de slides no navegador.** O professor precisa editar arquivos no sistema de arquivos.

### 2.3 Activities (Atividades simples)

Tipos suportados via UI: `quiz`, `external-link`.  
Tipos stub (config vazio): `simulator`, `animation`.

**UI de criação (LibraryPage, aba Atividades):**
```
Título | Kind (dropdown) | Max Score (número)

Se quiz:
  Enunciado | Opções (separadas por |) | Index da correta

Se external-link:
  URL
```

Armazenamento: `activities` (Postgres, JSONB para `config`).

### 2.4 Trails

UI de criação simples: formulário inline com nome. Depois, expandir o card e adicionar activities do banco via dropdown.

---

## 3. Comparação lado a lado

| Aspecto | play.prof21 | labprof21 |
|---------|-------------|-----------|
| **Criação de aula** | Editor visual no browser (steps + blocks) | Edição de arquivos `.md` no disco (IA-first) |
| **Tipos de slide** | 9 (slide, 5 quiz, 3 mídia) | 5 (text, video, quiz, mission, custom) |
| **Criação de quiz** | Editor de questões, opções, imagens | Formulário de uma linha com `|` separando opções |
| **Fórmulas** | Block `formula` (LaTeX, tamanho, animação) | KaTeX inline no markdown body (`$...$`, `$$...$$`) |
| **Imagens nos slides** | Block `image` com legenda | `sideImage` YAML + markdown `![](images/...)` |
| **Missões interativas** | Não tem | `missionId` → componente TSX registrado |
| **Armazenamento** | MySQL + JSON por step | Postgres + JSONB (activities/trails) + arquivos .md (lessons) |
| **Versionamento** | Não tem | Não tem |
| **Publicação** | draft → published | Apenas visibility (só private implementado) |
| **Reordenar** | Drag na sidebar | `trail_activities.position` |
| **Live session** | Sim (Socket.IO) | Sim (WebSocket nativo) |
| **Preview** | Botão no editor | `/lab/preview/:slug` |

---

## 4. Análise de viabilidade — Portabilidade com suporte a `.md`

### 4.1 O que significa "abordagem simples do play.prof21"

A abordagem simples do play.prof21 é o **Lesson Editor**: um professor cria slides no browser, escolhe o tipo (texto, quiz, vídeo), preenche um formulário e salva. Sem escrever arquivos manualmente.

A restrição proposta: **admitir que um slide possa ser carregado de um arquivo `.md`**. Ou seja, o sistema deve funcionar tanto com slides criados via UI quanto com slides cujo conteúdo vem de um `.md`.

### 4.2 Arquitetura proposta: Lesson unificado com slides híbridos

A ideia central é criar uma nova entidade `Lesson` (distinta da `InteractiveLesson` atual) com slides que podem ter **duas origens**:

```
Lesson
  └── Slide (1..N, ordenados)
        ├── Origem A: inline (tipo + content JSON no banco)
        └── Origem B: arquivo .md (content_loader parseia na leitura)
```

**Schema proposto:**
```sql
CREATE TABLE lessons (
  id UUID PRIMARY KEY,
  owner_id UUID REFERENCES users,
  title VARCHAR(200),
  slug VARCHAR(120) UNIQUE,  -- opcional; se presente, games_content/<slug>/game.yaml
  visibility VARCHAR(16) DEFAULT 'private',
  created_at TIMESTAMP
);

CREATE TABLE lesson_slides (
  id UUID PRIMARY KEY,
  lesson_id UUID REFERENCES lessons,
  position INT,
  -- Origem A: inline
  slide_type VARCHAR(40),   -- text, video, quiz, mission, custom
  content JSONB,            -- campos específicos do tipo
  md_body TEXT,             -- body markdown (para tipo text; nulo para outros)
  -- Origem B: arquivo .md  
  md_file VARCHAR(200),     -- ex: "03-reconhecimento.md"; nulo se inline
  UNIQUE (lesson_id, position)
);
```

**Regra de leitura:**
- Se `md_file IS NOT NULL`: ler o arquivo `games_content/<lesson.slug>/<md_file>`, parsear com `content_loader`, usar o resultado como o slide.
- Se `md_file IS NULL`: usar `slide_type` + `content` + `md_body` diretamente do banco.

Isso permite **misturar** slides inline e slides de arquivo dentro da mesma aula.

---

### 4.3 O que mudar no backend

**Novo:** tabela `lessons` e `lesson_slides` (acima).

**Novo endpoint:** `GET /api/lessons/:id/manifest`
- Carrega todos os `lesson_slides` em ordem
- Para `md_file IS NOT NULL`: chama `content_loader.parse_file(slug, md_file)`
- Para inline: monta o dict do slide a partir de `slide_type` + `content` + `md_body`
- Retorna o mesmo formato de manifest que o sistema atual usa

**Manter:** `InteractiveLesson` + `content_loader.py` intactos.  
A nova entidade `Lesson` substitui `InteractiveLesson` no médio prazo, mas ambas coexistem durante a transição.

**Reuso do `content_loader.py`:** 100% aproveitável. A função `parse_frontmatter()` e `validate_slide()` já existem. A única adição necessária é uma função `parse_inline(slide_type, content_dict, md_body)` que retorna o mesmo dict que `parse_frontmatter` retornaria para um `.md` equivalente.

---

### 4.4 O que mudar no frontend

**Novo componente: `LessonEditor`**

Modela-se no `lesson-editor.ts` do play.prof21, adaptado para React e para o formato labprof21.

```
LessonEditor
├── SlideList (sidebar)
│   ├── SlideItem (drag handle, ícone do tipo, label, posição)
│   └── Botão "Adicionar slide"
├── SlideForm (canvas central) — muda conforme o tipo selecionado
│   ├── TextSlideForm (label, body markdown, sideImage)
│   ├── VideoSlideForm (label, src, startAt)
│   ├── QuizSlideForm (label, stem, options[], correctIndex)
│   ├── MdFileSlideForm (label, md_file path) — slide que aponta para .md
│   └── MissionSlideForm (label, missionId, activities[])
└── Preview (reutiliza SlideRenderer existente)
```

**Aproveitamento do código existente:**
- `SlideRenderer.tsx` — **100% reusável** para preview. Nenhuma mudança.
- `TextSlide.tsx`, `VideoSlide.tsx`, `QuizSlide.tsx` — **100% reusáveis**.
- `MissionSlide.tsx` — **100% reusável**.
- `content_loader.py` — **100% reusável** para slides de arquivo.

**Novo:** apenas o editor de slides. O renderer permanece intacto.

---

### 4.5 Viabilidade técnica

| Item | Viabilidade | Esforço |
|------|-------------|---------|
| Schema `lessons` + `lesson_slides` | Alta — Postgres já tem JSONB, UUID, ordinal | Baixo (migração simples) |
| Backend: endpoint `/lessons/:id/manifest` híbrido | Alta — content_loader já existe | Baixo–Médio |
| Backend: CRUD de lessons + slides | Alta — padrão FastAPI que já usamos | Médio |
| Frontend: `LessonEditor` React | Média — editor de estado rico, drag-reorder | Alto |
| Reuso de `SlideRenderer` para preview | Alta — zero mudança | Zero |
| Migrar `InteractiveLesson` para `Lesson` | Média — transição gradual | Médio |
| Suporte a `.md` inline (armazenar no banco) | Alta — TEXT column + mesmo parser | Baixo |
| Drag-reorder de slides | Média — precisa de biblioteca (dnd-kit) | Médio |

**Esforço total estimado:** 3–5 dias de desenvolvimento.

---

### 4.6 Variante mais simples: `.md` como fonte, banco como índice

Antes de construir um editor completo, existe uma variante menor que resolve 80% do problema:

**Ideia:** manter os `.md` como fonte de verdade, mas adicionar uma **API de edição de arquivos** que permite criar/editar/reordenar slides via browser sem sair da UI.

```
Professor no browser:
  1. Abre LessonEditor para "atlas-v1"
  2. Vê lista de .md existentes (01-capa.md, 02-video.md, ...)
  3. Clica "Novo slide" → escolhe tipo → preenche formulário
  4. Frontend envia para: POST /api/lab/games/:slug/slides
  5. Backend escreve o .md correspondente no disco
  6. Slide aparece na lista

Para editar:
  1. Clica no slide existente
  2. Backend lê o .md → preenche o formulário
  3. Professor edita → salva → backend sobrescreve o .md
```

**Vantagens:**
- Sem mudança de schema (nenhuma tabela nova por enquanto)
- Os `.md` continuam sendo editáveis manualmente ou via IA
- O `content_loader.py` e `SlideRenderer` não mudam
- Preview existente funciona sem alteração

**Desvantagens:**
- Acoplado ao sistema de arquivos (problema em produção com múltiplas instâncias)
- Sem histórico de versões
- Ordenação via nome de arquivo (01-, 02-, ...) precisa de lógica de renomeação

Esta variante é viável para o ambiente atual (Docker single-node, Paulo é o único professor).

---

### 4.7 Recomendação

**Abordagem em dois passos:**

**Passo 1 (imediato, ~2 dias):** Portar o editor de aulas como **editor de arquivos `.md` via browser**:
- API: `POST/PUT/DELETE /api/lab/games/:slug/slides` (cria/edita/remove `.md` no disco)
- `GET /api/lab/games/:slug/slides/:id` (retorna o conteúdo do `.md` parseado)
- Frontend: `LessonEditor` básico — lista de slides + formulário por tipo (text, video, quiz)
- Reusa 100% do `SlideRenderer` para preview em tempo real
- Sem mudança de schema, sem migração

**Passo 2 (médio prazo, ~3 dias):** Adicionar `lessons` + `lesson_slides` no banco:
- Permite slides inline (sem arquivo)
- Permite lições que não dependem de pasta no disco
- Habilita colaboração e múltiplos ambientes
- Migrar `InteractiveLesson` gradualmente

---

## 5. Tipos de slide: comparação e gap

| Tipo play.prof21 | Equivalente labprof21 | Gap |
|------------------|-----------------------|-----|
| `slide` (com blocks) | `text` (markdown body) | **Parcial** — play tem blocks editáveis; labprof tem markdown livre. Markdown é mais poderoso mas menos estruturado. |
| `quiz-mc` | `quiz` | **Equivalente** — ambos têm stem + options[]. play tem `quiz-image` extra. |
| `quiz-image` | Não tem | **Gap** — opções com imagens. |
| `open-answer` | Não tem | **Gap** — resposta aberta com correção manual. |
| `type-word` | Não tem | **Gap** — completar lacuna digitando. |
| `pick-word` | Não tem | **Gap** — completar lacuna por seleção. |
| `youtube` | `video` | **Equivalente** |
| `phet` | Não tem (mas `mission` pode cobrir) | **Parcial** |
| `geogebra` | Não tem | **Gap** |
| `mission` (TSX interativa) | `mission` | **Equivalente** — labprof tem o conceito, play não |
| `formula` block (no slide) | KaTeX no markdown | **Equivalente** — markdown tem mais flexibilidade |
| `callout` block | `.callout` class no helpers.css | **Equivalente** — via HTML no markdown |
| `variables` block | Não tem direto | **Gap menor** — pode ser feito com tabela markdown |

**Gaps críticos para portabilidade:**
1. `quiz-image` — opções com imagens
2. `open-answer` — resposta aberta (se Paulo precisar corrigir manualmente)
3. `type-word` / `pick-word` — exercícios de lacuna

**Gaps não críticos** para o uso atual do Paulo (aulas de física com missões TSX e quizzes múltipla escolha):
- `phet` / `geogebra` — Paulo usa missões TSX próprias
- `variables` block — faz com tabela markdown

---

## 6. Resumo executivo

| Questão | Resposta |
|---------|----------|
| **É viável portar a criação simples do play.prof21?** | Sim, com esforço de 3–5 dias |
| **O formato `.md` pode coexistir?** | Sim — é a abordagem recomendada (`.md` como fonte, UI como editor) |
| **Precisa mudar o `SlideRenderer`?** | Não — reusa 100% |
| **Precisa mudar o `content_loader.py`?** | Não para o Passo 1. Pequena adição para o Passo 2 |
| **O que é inteiramente novo?** | O `LessonEditor` no frontend + endpoints de escrita de `.md` no backend |
| **Qual o risco maior?** | Reordenação de arquivos `.md` no disco (renomear 01-, 02-, etc.) |
| **Alternativa sem risco?** | Passo 2 direto: schema `lesson_slides` no banco (mais limpo a longo prazo) |
