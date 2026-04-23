# Diagnóstico da camada de telemetria

_Gerado em 2026-04-23. Diagnóstico exploratório — nenhum código foi alterado._

---

## 1. Camada frontend

### Caminho do arquivo

`frontend/src/modules/lesson/runtime/useTelemetry.ts`

### Conteúdo integral

```typescript
/**
 * useTelemetry — roteia eventos de interação com slides.
 *
 * Dentro de uma sessão ao vivo: envia via WebSocket (já tratado pelo adapter).
 * Fora de sessão (preview / standalone): POST /api/lesson/events com JWT.
 *
 * Uso:
 *   const track = useTelemetry({ lessonSlug: slug, slideId: slide.id })
 *   track('quiz_fill_submit', { answer: 'mc²', correct: true })
 */

import { useCallback } from 'react'

import { useSessionOptional } from '../../live/SessionContext'
import { useAuth } from '../../auth/AuthContext'
import { apiUrl } from './apiUrl'

type Payload = Record<string, unknown>

function slugFromUrl(): string {
  const m = window.location.pathname.match(/\/lesson\/preview\/([^/?]+)/)
  return m ? decodeURIComponent(m[1]) : ''
}

export function useTelemetry({ lessonSlug, slideId }: { lessonSlug?: string; slideId: string }) {
  const session = useSessionOptional()
  const { token } = useAuth()

  const track = useCallback(
    (eventType: string, payload: Payload = {}) => {
      if (session) {
        return
      }

      if (!token) return

      fetch(`${apiUrl()}/api/lesson/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ lesson_slug: lessonSlug ?? slugFromUrl(), slide_id: slideId, event_type: eventType, payload }),
      }).catch(() => {})
    },
    [session, token, lessonSlug, slideId]
  )

  return track
}
```

Arquivo auxiliar `frontend/src/modules/lesson/runtime/apiUrl.ts`:

```typescript
/**
 * Resolve a URL base da API em runtime.
 *
 * Prioridade:
 *   1. VITE_API_URL — útil quando web e api rodam em hostnames distintos
 *      (ex.: produção com `api.prof21.com.br`). Wins se definido em build/dev.
 *   2. window.location.hostname + porta 5105 — default em dev: o browser
 *      acessa tanto a web (5174) quanto a api (5105) no mesmo VPS, então
 *      reaproveitar o hostname funciona pra localhost, 127.0.0.1, IP público
 *      e subdomínios sem reconfigurar.
 *
 * SSR-safe: se `window` não existir, cai no localhost (só afeta testes).
 */

const API_PORT_DEV = 5105

export function apiUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL
  if (typeof envUrl === 'string' && envUrl.length > 0) return envUrl.replace(/\/$/, '')
  if (typeof window === 'undefined') return `http://localhost:${API_PORT_DEV}`
  const { protocol, hostname } = window.location
  return `${protocol}//${hostname}:${API_PORT_DEV}`
}
```

### Assinatura da função/hook exposta

```typescript
export function useTelemetry({ lessonSlug, slideId }: { lessonSlug?: string; slideId: string }): (eventType: string, payload?: Record<string, unknown>) => void
```

Retorna a função `track(eventType, payload?)`.

### Como envia eventos

- **Protocolo:** HTTP `POST` para `${apiUrl()}/api/lesson/events`
- **Auth:** `Authorization: Bearer <JWT>`
- **Body JSON:**
  ```json
  {
    "lesson_slug": "string",
    "slide_id": "string",
    "event_type": "string",
    "payload": {}
  }
  ```
- **Dentro de sessão ao vivo (`session` existe):** retorna imediatamente sem enviar nada. Os eventos de sessão ao vivo são tratados pelo adapter do WebSocket — esta camada não os captura.

### Tem batching? Retry? Fila local?

- **Batching:** NÃO. Cada chamada a `track()` dispara um `fetch` imediato.
- **Retry:** NÃO. O `.catch(() => {})` descarta silenciosamente qualquer erro de rede.
- **Fila local:** NÃO. Se a request falhar (rede, 401, 500), o evento é perdido.

---

## 2. Camada backend (ingest)

### Caminho do arquivo

`backend/modules/lesson/routes.py` (linhas 254–304)

### Conteúdo integral do handler de ingest

```python
# ── Telemetria de slides (interações fora de sessão ao vivo) ─────────────

class SlideEventBody(BaseModel):
    lesson_slug: str
    slide_id: str
    event_type: str
    payload: dict = {}


@router.post("/events", status_code=201)
def record_event(
    body: SlideEventBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Registra evento de interação com slide (fora de sessão ao vivo)."""
    ev = SlideEvent(
        user_id=user.id,
        lesson_slug=body.lesson_slug,
        slide_id=body.slide_id,
        event_type=body.event_type,
        payload=body.payload,
    )
    db.add(ev)
    db.commit()
    return {"recorded": True}


@router.get("/events/{slug}", dependencies=[Depends(require_teacher)])
def list_events(slug: str, db: Session = Depends(get_db)) -> dict:
    """Lista eventos de um slug de aula (somente professor)."""
    from sqlalchemy import select
    rows = db.execute(
        select(SlideEvent)
        .where(SlideEvent.lesson_slug == slug)
        .order_by(SlideEvent.ts.desc())
        .limit(500)
    ).scalars().all()
    return {
        "events": [
            {
                "id": str(r.id),
                "user_id": str(r.user_id) if r.user_id else None,
                "slide_id": r.slide_id,
                "event_type": r.event_type,
                "payload": r.payload,
                "ts": r.ts.isoformat(),
            }
            for r in rows
        ]
    }
```

### Validação aplicada

- **Pydantic (`SlideEventBody`):** valida presença de `lesson_slug` (str), `slide_id` (str), `event_type` (str). `payload` é `dict` com default `{}`.
- **Sem validação por tipo de evento:** qualquer string em `event_type` é aceita. Qualquer dicionário arbitrário em `payload` é aceita.
- **Sem enum de event_types:** não existe checagem se `event_type` pertence a um conjunto válido.

### Como grava no banco

Instancia `SlideEvent` diretamente do body, faz `db.add(ev)` + `db.commit()`. `user_id` vem do JWT validado (`get_current_user`). `ts` é definido pelo default do model (server-side, `datetime.now(UTC)`).

---

## 3. Schema do banco

### Caminho do model SQLAlchemy

`backend/modules/domain/models.py` (linhas 221–239)

### Conteúdo integral do model

```python
class SlideEvent(Base):
    """Evento de interação com um slide fora de sessão ao vivo.

    Eventos dentro de sessão ficam em live_events (módulo live).
    Aqui registramos quiz-fill, quiz-image e mission no modo preview/standalone.
    """

    __tablename__ = "slide_events"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    lesson_slug: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    slide_id: Mapped[str] = mapped_column(String(120), nullable=False)
    event_type: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False, index=True)
```

### Caminho da migração Alembic correspondente

NÃO EXISTE. O projeto não usa Alembic. O schema é criado via `create_all` no lifespan do FastAPI (`backend/main.py`). Não há diretório `backend/migrations/` nem `backend/alembic/`.

### Lista de campos com tipos

| Campo | Tipo SQLAlchemy | Tipo Postgres | Nullable | Default |
|-------|----------------|---------------|----------|---------|
| `id` | `UUID` | `uuid` | NOT NULL | `uuid.uuid4()` (server) |
| `user_id` | `UUID` FK → `users.id` | `uuid` | NULL | — |
| `lesson_slug` | `String(120)` | `varchar(120)` | NOT NULL | — |
| `slide_id` | `String(120)` | `varchar(120)` | NOT NULL | — |
| `event_type` | `String(60)` | `varchar(60)` | NOT NULL | — |
| `payload` | `JSONB` | `jsonb` | NOT NULL | `{}` |
| `ts` | `DateTime(timezone=True)` | `timestamptz` | NOT NULL | `datetime.now(UTC)` (server) |

### Índices existentes

Inferidos da declaração do model (criados via `create_all`):

| Índice | Campo(s) |
|--------|----------|
| PK | `id` |
| `ix_slide_events_user_id` | `user_id` |
| `ix_slide_events_lesson_slug` | `lesson_slug` |
| `ix_slide_events_event_type` | `event_type` |
| `ix_slide_events_ts` | `ts` |

Não há índice composto.

### Constraints existentes

| Constraint | Tipo | Detalhe |
|-----------|------|---------|
| PK | PRIMARY KEY | `id` |
| FK | FOREIGN KEY | `user_id` → `users.id` ON DELETE SET NULL |
| — | NOT NULL | `lesson_slug`, `slide_id`, `event_type`, `payload`, `ts` |

Não há UNIQUE constraint, CHECK constraint, nem EXCLUDE.

---

## 4. Inventário de chamadas atuais

_Comando executado: `grep -rn "useTelemetry" frontend/src --include="*.tsx" --include="*.ts"` + `grep -rn "track(" frontend/src --include="*.tsx" --include="*.ts"`_

| arquivo | linha | event_type | propriedades do payload | contexto (slide/componente) |
|---------|-------|------------|-------------------------|-----------------------------|
| `frontend/src/modules/lesson/components/QuizFillSlide.tsx` | 65 | `quiz_fill_submit` | `{ answer: string, correct: boolean, question_id: string }` | Slide de quiz dissertativo — ao submeter resposta |
| `frontend/src/modules/lesson/components/QuizImageSlide.tsx` | 43 | `quiz_image_pick` | `{ option_index: number, correct: boolean, question_id: string }` | Slide de quiz com imagens — ao clicar em opção |

**Total de chamadas encontradas: 2**

Componentes ATLAS (`frontend/src/modules/lesson/games/atlas/*.tsx`) — **0 chamadas** a `useTelemetry` ou `track()`. O hook está importado apenas nos dois componentes de quiz acima.

---

## 5. Documentação existente

`find . -name "EVENTOS.md" -o -name "tracking*.md" -o -name "events*.md"` — **nenhum resultado**.

Não há tracking plan documentado. Não existe `EVENTOS.md`, `tracking_plan.md`, nem equivalente. Os únicos registros dos event_types são os comentários inline no próprio código.

---

## 6. Lacunas identificadas

Checklist honesto do que NÃO existe hoje:

- [x] `event_id` gerado no cliente — **NÃO IMPLEMENTADO.** O `id` (UUID) é gerado server-side no model. O cliente não envia identificador próprio; não há como deduplicar no ingress.
- [x] `timestamp_client` e `timestamp_server` separados — **NÃO IMPLEMENTADO.** Existe apenas `ts`, gerado server-side. O momento real da interação no browser não é capturado.
- [x] `event_version` — **NÃO IMPLEMENTADO.** Sem versionamento do schema de payload por tipo de evento.
- [x] `session_id` estável por sessão de usuário — **NÃO IMPLEMENTADO.** Não existe identificador de sessão de browser. Não é possível agrupar eventos de uma mesma visita.
- [x] Validação de schema por tipo de evento — **NÃO IMPLEMENTADO.** `event_type` é uma string livre; `payload` é um dict arbitrário. Qualquer combinação é aceita e gravada.
- [x] Idempotência por `event_id` — **NÃO IMPLEMENTADO.** Não há mecanismo de deduplicação. Re-envios (ex.: retry no cliente) gerariam registros duplicados.
- [x] Tabela de quarentena para eventos malformados — **NÃO IMPLEMENTADO.** Não existe tabela separada; erros de validação Pydantic resultam em HTTP 422 sem persistência.
- [x] Enum de `event_types` ou registro central — **NÃO IMPLEMENTADO.** Os tipos `quiz_fill_submit` e `quiz_image_pick` existem apenas como string literals no código do cliente. Sem enum, sem lista canônica.
- [x] Endpoint de exportação para análise — **PARCIALMENTE IMPLEMENTADO.** Existe `GET /api/lesson/events/{slug}` (teacher-only), mas limita a 500 registros sem paginação, sem filtros por data/event_type, sem formato CSV/NDJSON. Não serve como endpoint de análise em escala.
