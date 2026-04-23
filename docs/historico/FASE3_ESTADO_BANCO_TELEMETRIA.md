# Estado real do banco e fluxo de telemetria

_Gerado em 2026-04-23. Diagnóstico exploratório — apenas comandos de leitura executados._

---

## 1. Estado do ambiente

| Container | Imagem | Status | Uptime |
|---|---|---|---|
| `labprof21-api` | `labprof21-api` | `Up` (healthy) | ~38h |
| `labprof21-db` | `postgres:16-alpine` | `Up` (healthy) | ~46h |
| `labprof21-web` | `labprof21-web` | `Up` | ~45h |

Portas mapeadas:
- API: `0.0.0.0:5105→5105`
- DB: `0.0.0.0:5435→5432`
- Web: `0.0.0.0:5174→5174`

Usuário do banco: `labprof21` (não `postgres` — a tentativa com `-U postgres` falhou com `role "postgres" does not exist`).

---

## 2. Tabelas do banco

Output literal do `\dt`:

```
                List of relations
 Schema |        Name         | Type  |   Owner   
--------+---------------------+-------+-----------
 public | activities          | table | labprof21
 public | activity_results    | table | labprof21
 public | assignments         | table | labprof21
 public | classrooms          | table | labprof21
 public | enrollments         | table | labprof21
 public | feed_comments       | table | labprof21
 public | feed_post_likes     | table | labprof21
 public | feed_posts          | table | labprof21
 public | interactive_lessons | table | labprof21
 public | live_events         | table | labprof21
 public | live_memberships    | table | labprof21
 public | live_quiz_answers   | table | labprof21
 public | live_quiz_states    | table | labprof21
 public | live_scores         | table | labprof21
 public | live_sessions       | table | labprof21
 public | slide_events        | table | labprof21
 public | trail_activities    | table | labprof21
 public | trails              | table | labprof21
 public | users               | table | labprof21
(19 tables)
```

**`live_events` EXISTE** — confirmada a tabela mencionada no comentário do model `SlideEvent`.

---

## 3. Tabela `slide_events`

Output literal do `\d+ slide_events`:

```
                                                  Table "public.slide_events"
   Column    |           Type           | Collation | Nullable | Default | Storage  | Compression | Stats target | Description 
-------------+--------------------------+-----------+----------+---------+----------+-------------+--------------+-------------
 id          | uuid                     |           | not null |         | plain    |             |              | 
 user_id     | uuid                     |           |          |         | plain    |             |              | 
 lesson_slug | character varying(120)   |           | not null |         | extended |             |              | 
 slide_id    | character varying(120)   |           | not null |         | extended |             |              | 
 event_type  | character varying(60)    |           | not null |         | extended |             |              | 
 payload     | jsonb                    |           | not null |         | extended |             |              | 
 ts          | timestamp with time zone |           | not null |         | plain    |             |              | 
Indexes:
    "slide_events_pkey" PRIMARY KEY, btree (id)
    "ix_slide_events_event_type" btree (event_type)
    "ix_slide_events_lesson_slug" btree (lesson_slug)
    "ix_slide_events_ts" btree (ts)
    "ix_slide_events_user_id" btree (user_id)
Foreign-key constraints:
    "slide_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
Access method: heap
```

Schema bate com o model SQLAlchemy declarado na Fase 1 — sem divergências.

### Volume e distribuição por `event_type`

Output literal de `SELECT event_type, count(*), min(ts), max(ts) FROM slide_events GROUP BY event_type`:

```
 event_type | count | min | max 
------------+-------+-----+-----
(0 rows)
```

**A tabela está completamente vazia.** Os dois event_types instrumentados no código (`quiz_fill_submit`, `quiz_image_pick`) nunca foram gravados. Não há nenhum registro em `slide_events`.

---

## 4. Tabela `live_events`

Output literal do `\d+ live_events`:

```
                                                   Table "public.live_events"
    Column     |           Type           | Collation | Nullable | Default | Storage  | Compression | Stats target | Description 
---------------+--------------------------+-----------+----------+---------+----------+-------------+--------------+-------------
 id            | uuid                     |           | not null |         | plain    |             |              | 
 session_id    | uuid                     |           | not null |         | plain    |             |              | 
 membership_id | uuid                     |           |          |         | plain    |             |              | 
 type          | character varying(60)    |           | not null |         | extended |             |              | 
 payload       | jsonb                    |           | not null |         | extended |             |              | 
 slide_index   | integer                  |           |          |         | plain    |             |              | 
 activity_id   | character varying(120)   |           |          |         | extended |             |              | 
 ts            | timestamp with time zone |           | not null |         | plain    |             |              | 
Indexes:
    "live_events_pkey" PRIMARY KEY, btree (id)
    "ix_live_events_session_id" btree (session_id)
    "ix_live_events_ts" btree (ts)
    "ix_live_events_type" btree (type)
Foreign-key constraints:
    "live_events_membership_id_fkey" FOREIGN KEY (membership_id) REFERENCES live_memberships(id) ON DELETE SET NULL
    "live_events_session_id_fkey" FOREIGN KEY (session_id) REFERENCES live_sessions(id) ON DELETE CASCADE
Access method: heap
```

### Volume

**Total de registros: 402**

### 3 registros de exemplo

```
                  id                  |               type                |                      payload                       | slide_index | activity_id |              ts               
--------------------------------------+-----------------------------------+----------------------------------------------------+-------------+-------------+-------------------------------
 49a855ab-def1-4ff7-bf3a-d5634f2148d7 | atlas.reconhecimento.layerFocused | {"layer": "id", "interactionMode": "master-led"}   |           3 |             | 2026-04-22 02:14:11.735005+00
 76c2e803-63f3-4a76-a53a-4c0acfe8ffe9 | atlas.reconhecimento.layerFocused | {"layer": "hcal", "interactionMode": "master-led"} |           3 |             | 2026-04-22 02:14:12.395948+00
 6ca58fa5-ae64-4049-b988-a6e50dc3cc75 | atlas.reconhecimento.layerFocused | {"layer": "ecal", "interactionMode": "master-led"} |           3 |             | 2026-04-22 02:14:13.094743+00
```

### Distribuição por `type`

```
               type                | count 
-----------------------------------+-------
 participant.joined                |   129
 participant.left                  |    97
 slide.changed                     |    74
 atlas.reconhecimento.layerFocused |    42
 atlas.assinaturas.layerFocused    |    21
 activity.changed                  |    20
 interactionMode.changed           |    12
 atlas.identificacao.layerFocused  |     4
 session.ended                     |     3
(9 rows)
```

### Anomalias detectadas

| Anomalia | count |
|---|---|
| Registros com `payload` nulo | 0 |
| `slide_index` NULL | 229 |
| `activity_id` NULL | 354 |

**`slide_index` NULL (229):** todos são `participant.joined`, `participant.left`, `session.ended` — sem contexto de slide. Comportamento esperado.

**`activity_id` NULL (354):** inclui os 229 de ciclo de vida + eventos `atlas.reconhecimento.layerFocused` antigos (antes do campo ser preenchido pelo handler WS). Registros mais recentes já têm `activity_id` populado.

---

## 5. Cobertura: código vs banco

### Caminho `slide_events` (preview/standalone — `POST /api/lesson/events`)

| event_type disparável pelo código | registros em `slide_events` | status |
|---|---|---|
| `quiz_fill_submit` | 0 | **Disparável pelo código, nunca registrado** |
| `quiz_image_pick` | 0 | idem |

### Caminho `live_events` (sessão ao vivo — WebSocket)

| type em `live_events` | registros | observação |
|---|---|---|
| `atlas.reconhecimento.layerFocused` | 42 | Capturado via WS; payload inclui `layer` e `interactionMode` |
| `atlas.assinaturas.layerFocused` | 21 | idem |
| `atlas.identificacao.layerFocused` | 4 | idem |
| `atlas.massainvariante.layerFocused` | 0 | **Disparável mas nunca registrado** — componente nunca exercitado em sessão |
| `atlas.hypatia.tutorial.layerFocused` | 0 | idem |

**Nota:** A telemetria dos componentes ATLAS não passa pelo `useTelemetry` / `POST /api/lesson/events`. Ela é capturada pelo callback `onLayerFocused` → adapter WebSocket → `live_events`. O `useTelemetry` retorna `void` imediatamente quando `session` existe (linha 31 de `useTelemetry.ts`). Os dois caminhos são mutuamente exclusivos.

---

## 6. Consistência Alembic

- **Alembic NÃO EXISTE.** Sem `backend/migrations/`, `backend/alembic/` nem `alembic.ini`.
- Schema criado via `create_all` no lifespan do FastAPI.
- **Schema real bate com os models declarados** — `\d+` acima coincidem com as declarações `Mapped[]` em `models.py`.

---

## 7. Erros nos logs (últimas 24h)

```
ModuleNotFoundError: No module named 'modules.lab'
AssertionError: Status code 204 must not have a response body
AssertionError: Status code 204 must not have a response body
```

Os demais itens são `WARNING: WatchFiles detected changes` — reloads normais do uvicorn.

| Erro | Frequência | Avaliação |
|---|---|---|
| `ModuleNotFoundError: No module named 'modules.lab'` | 1 | Import de módulo inexistente durante desenvolvimento; servidor subiu normalmente depois |
| `AssertionError: Status code 204 must not have a response body` | 2 | Bug de desenvolvimento corrigido no mesmo dia; não presente no código atual |

Não há erros recorrentes relacionados a eventos, validação ou inserção em telemetria.

---

## 8. Perguntas em aberto

1. **`slide_events` vazio:** Os eventos `quiz_fill_submit` e `quiz_image_pick` nunca foram gravados. Não é possível determinar se isso é porque (a) o modo preview nunca foi usado com usuário autenticado, (b) o token JWT estava ausente e o hook abortou silenciosamente, ou (c) há outro impedimento. Requer sessão de teste instrumentada para confirmar.

2. **`atlas.*` sem `activity_id` nos primeiros registros:** Alguns `atlas.reconhecimento.layerFocused` têm `activity_id` vazio. Indica que o campo foi adicionado ao handler WS depois das primeiras sessões. Dado histórico incompleto para correlação com a missão específica.

3. **`atlas.massainvariante` e `atlas.hypatia.*` com 0 registros:** Não é possível distinguir entre "sessão nunca chegou a esses slides" e "callback não está sendo propagado corretamente pelo adapter WS" sem sessão de teste presencial.

4. **`HypatiaReal` ignora todas as props:** Medidas do aluno ficam apenas em `React state` local — nenhuma é persistida no banco. Ao recarregar a página, todos os dados são perdidos.
