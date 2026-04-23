# labprof21

Plataforma de aulas interativas síncronas do **prof21** — pensada para o ensino de Física no nível médio e técnico.

---

## Proposta pedagógica

O labprof21 parte de uma premissa: **a aula não é uma apresentação, é uma sessão**. O professor conduz slides, mas os alunos interagem em tempo real — respondendo quizzes, explorando simulações e manipulando visualizações científicas — tudo sem sair do navegador.

### Tipos de interação suportados

| Tipo | O que o aluno faz |
|------|-------------------|
| **Quiz múltipla escolha** | Escolhe uma opção; vê resultado após o professor fechar |
| **Quiz com imagem** | Mesmo fluxo, com figura/gráfico como contexto da questão |
| **Completar lacuna** | Digita uma resposta textual; avaliação automática com variações aceitas |
| **Simulação PhET** | Explora livremente uma simulação interativa do PhET Colorado |
| **Applet GeoGebra** | Manipula objetos matemáticos embutidos do GeoGebra |
| **Mission** | Navega por camadas de uma visualização científica (ex: assinaturas de partículas no ATLAS) |

### Modos de interação (sessão ao vivo)

- **`free`** — cada aluno explora no seu ritmo; professor observa
- **`master-led`** — professor sincroniza o que todos veem; alunos ficam em modo leitura

### Papéis na sessão

- **Professor (master)** — abre/fecha quizzes, navega slides, propaga activity para alunos
- **Aluno (player)** — responde, explora, recebe feedback imediato

### Telemetria pedagógica

Eventos de interação são gravados com `user_id`, `lesson_slug`, `slide_id`, `event_type` e payload JSONB. Isso permite ao professor ver, após a aula, quais questões foram mais erradas, quais camadas os alunos exploraram e onde houve dificuldade.

### Autoria de conteúdo

O conteúdo é escrito em `.md` com frontmatter YAML — sem editor WYSIWYG. Esse formato é legível por humanos e por IAs, e permite versionamento em git. Há um editor integrado na plataforma (`/teacher/editor/:slug`) para ajustes rápidos.

---

## Stack técnica

| Camada | Tecnologia |
|--------|-----------|
| Backend | FastAPI + SQLAlchemy + Postgres 16 |
| Frontend | React 19 + TypeScript + Vite 6 |
| Realtime | WebSocket nativo (FastAPI) |
| Auth | JWT HS256 (7 dias) + bcrypt |
| Infra | Docker Compose |

### Arquitetura de slides

Cada tipo de slide segue o ciclo:

```
manifest.ts          → interface TypeScript (SlideBase + campos do tipo)
registry.tsx         → registro central (displayName, icon, Renderer)
SlideRenderer.tsx    → despacha para o Renderer correto via registry
content_loader.py    → validação Python dos campos YAML
games_content/       → arquivos .md com o conteúdo real
```

O `SLIDE_REGISTRY` é o ponto único de registro — adicionar um tipo novo exige apenas criar a interface, o componente e uma linha no registry.

### Sessão ao vivo (WebSocket)

```
professor abre sessão → código de 6 dígitos
alunos entram via /lesson/join
WS /ws/lesson/session/{id} → estado sincronizado (slides, quizzes, activities)
```

O estado da sessão vive em memória no `ConnectionManager`; eventos relevantes são gravados no banco.

---

## Rodando em desenvolvimento

```bash
cp .env.example .env    # opcional — defaults funcionam
docker compose up -d
```

| Serviço | Porta | Descrição |
|---------|-------|-----------|
| `db` | `localhost:5435` | Postgres 16 |
| `api` | `localhost:5105` | FastAPI + uvicorn `--reload` |
| `web` | `localhost:5174` | React + Vite HMR |

```bash
# Verificar que tudo subiu
curl -s http://localhost:5105/health    # → {"status":"ok","db":true}
```

**Importante:** `node_modules` vive dentro do container Docker (volume anônimo). Use sempre `docker compose exec web` para comandos npm/tsc.

```bash
docker compose exec web npx tsc --noEmit    # type check
docker compose exec web npm run build       # build de produção
docker compose logs -f api                  # logs backend
docker compose logs -f web                  # logs frontend
docker compose down -v                      # para e apaga banco
```

---

## Estrutura de pastas

```
labprof21/
├── backend/
│   ├── main.py                        # entry point FastAPI + lifespan
│   ├── database.py                    # SQLAlchemy engine + Session
│   └── modules/
│       ├── auth/                      # JWT, bcrypt, /api/auth/*
│       ├── domain/                    # turmas, trilhas, atividades, telemetria
│       ├── feed/                      # posts e comentários por turma
│       └── lesson/
│           ├── routes.py              # /api/lesson/* + /ws/lesson/*
│           ├── content_loader.py      # parser YAML + validação
│           ├── connection_manager.py  # estado WebSocket em memória
│           └── games_content/        # conteúdo .md das lições
│               └── atlas-v1/         # lição de exemplo (detector ATLAS)
│
└── frontend/src/
    ├── App.tsx                        # rotas
    ├── styles/
    │   ├── theme.css                  # tokens CSS --p21-*
    │   └── dashboard.css             # classes .db-* do dashboard
    └── modules/
        ├── auth/                      # AuthContext, Login, Register
        ├── teacher/                   # dashboard, turmas, biblioteca, editor
        ├── student/                   # dashboard do aluno, trilhas
        ├── live/                      # SessionPage, JoinPage (aula ao vivo)
        ├── lesson/
        │   ├── registry.tsx           # SLIDE_REGISTRY — todos os tipos
        │   ├── components/            # um TSX por tipo de slide
        │   ├── games/atlas/           # componentes interativos do ATLAS
        │   ├── runtime/               # useTelemetry, apiUrl
        │   └── types/manifest.ts     # interfaces TypeScript dos slides
        └── profile/, settings/
```

---

## Documentação interna

| Arquivo | Conteúdo |
|---------|---------|
| [`CLAUDE.md`](CLAUDE.md) | Guia operacional para o Claude Code (ambiente, convenções, armadilhas) |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Fases de desenvolvimento e critérios de aceite |
| [`planner/PROGRESSO.md`](planner/PROGRESSO.md) | Checklist de implementação em andamento |

---

## Lição de referência — atlas-v1

**"ATLAS — Treinamento de Recruta do CERN"**

Narrativa central: o aluno assume o papel de físico recém-contratado pelo CERN e percorre o caminho completo de análise de dados do detector ATLAS.

### Sequência de slides

| # | Arquivo | Tipo | O que acontece |
|---|---------|------|----------------|
| 01 | `01-capa.md` | `text` | Capa com a premissa narrativa |
| 01b | `01b-introducao.md` | `text` | Contextualização filosófica ("do que é feito o pão?") com imagem lateral |
| 02 | `02-video-intro.md` | `video` | YouTube embed com vídeo introdutório do ATLAS |
| 03 | `03-reconhecimento.md` | `mission` | Reconhecimento do detector |
| 04 | `04-assinaturas.md` | `mission` | Assinaturas de partículas |
| 05 | `05-identificacao.md` | `mission` | Identificação de eventos |
| 06 | `06-massa-invariante.md` | `mission` | Massa invariante — redescoberta do Z |
| 07 | `07-hypatia-tutorial.md` | `mission` | Tutorial HYPATIA (7 passos guiados) |
| 08 | `08-hypatia-real.md` | `mission` | HYPATIA real — 10 eventos reais |
| 09 | `09-fechamento.md` | `text` | Fechamento narrativo |
| 10 | `10-phet-demo.md` | `phet` | Simulação Lei de Faraday |
| 11 | `11-geogebra-demo.md` | `geogebra` | Applet de parábola |

### Atividades interativas (Mission slides)

#### 03 — Reconhecimento do detector (`Reconhecimento.tsx`)
Visualização canvas 2D do corte transversal e longitudinal do ATLAS. Cada camada é clicável:
- **Inner Detector** (cinza escuro) — rastreia trajetórias carregadas
- **Calorímetro EM** (verde) — absorve elétrons e fótons
- **Calorímetro Hadrônico** (vermelho) — absorve jatos de hádrons
- **Espectrômetro de Múons** (azul) — detecta múons que atravessam tudo

Em `master-led`, o professor clica e todos os alunos veem a mesma camada em destaque em tempo real. Há duas vistas (transversal e longitudinal) sincronizáveis separadamente.

#### 04 — Assinaturas de partículas (`Assinaturas.tsx`)
Mesmo canvas do detector, mas renderiza a assinatura específica de cada partícula ao clicar na pílula:

| Partícula | O que acende no canvas |
|-----------|----------------------|
| **Múon** (μ) | Track magenta que atravessa todas as camadas, acende espectrômetro azul |
| **Elétron** (e⁻) | Track + torre amarela no ECAL verde |
| **Fóton** (γ) | Só torre no ECAL — sem track (não tem carga) |
| **Jato** (hádron) | Torres tanto no ECAL quanto no HCAL |
| **Neutrino** (ν) | Seta vermelha de MET (energia faltante) — o detector não vê, só infere |

Modo `free` — cada aluno explora independentemente.

#### 05 — Identificação de eventos (`Identificacao.tsx`)
3 eventos sintéticos com partículas "escondidas". O aluno clica em cada trajetória e adivinha qual partícula é, escolhendo uma pílula. O canvas dá feedback visual (verde/vermelho):
- Evento 1: decaimento Z → μμ
- Evento 2: evento misto (múon + elétron + ruído)
- Evento 3: decaimento W → eν

O professor pode forçar qual evento a turma analisa via `master-led`.

#### 06 — Massa invariante (`MassaInvariante.tsx`)
20 eventos pré-gerados com dois múons cada. O aluno:
1. Aplica filtro pT ≥ 10 GeV (remove ruído)
2. Identifica os dois múons no canvas
3. Clica para registrar a massa invariante calculada
4. Vê o histograma sendo construído evento a evento

Após ~8 eventos, um pico em ~91 GeV emerge — a redescoberta do bóson Z, repetindo o experimento original de 1983 (Nobel de Física).

#### 07 — Tutorial HYPATIA (`HypatiaTutorial.tsx`)
7 passos guiados simulando a interface do software real HYPATIA usado por físicos do CERN:
1. Duas vistas do evento (transversal + longitudinal)
2. Aplicar filtro pT
3. Ver resultado do filtro
4. Ativar Pick Tool
5. Selecionar primeiro múon
6. Selecionar segundo múon
7. Ler a massa invariante

O professor pode pular a turma para qualquer passo via `master-led`.

#### 08 — HYPATIA real (`HypatiaReal.tsx`)
O aluno abre o HYPATIA real (`hypatia-app.iasa.gr`) em outra aba e analisa 10 eventos reais do ATLAS. Para cada evento, registra a massa invariante no slide. O slide exibe checklist, constrói histograma local em tempo real e revela o pico do Z após 5+ eventos registrados. Não tem `activities` — é trabalho individual livre, sem sincronização.

### Padrão técnico dos componentes Mission

Todos os 6 componentes seguem o mesmo contrato de props:

```typescript
interface Props {
  currentActivityId?: string | null  // master propaga → todos atualizam
  onLayerFocused?: (subId: string) => void  // aluno clica → sobe pro adapter
  readOnly?: boolean  // true para players em master-led
}
```

A renderização é feita em **Canvas 2D** — desenhado com `useEffect` + `requestAnimationFrame`. Isso permite animações fluidas e controle total do visual sem dependências externas.
