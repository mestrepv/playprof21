# Plano de diagnóstico — Camada de telemetria do labprof21

## Contexto e objetivo

Este é o projeto **labprof21**, plataforma de aulas interativas síncronas para
ensino de Física. Existe uma camada de telemetria que captura interações dos
alunos com slides — em particular, com os componentes do tipo `Mission` da
lição **atlas-v1** (treinamento de recruta do CERN).

O objetivo deste diagnóstico é **mapear o estado atual da telemetria de ponta
a ponta** (frontend → ingest → banco) para fundamentar uma expansão posterior
da instrumentação. Esta tarefa é puramente **exploratória e descritiva** — não
modifica código de aplicação.

## Regras gerais (válidas para todas as fases)

1. **Nenhuma alteração em código de aplicação.** Os únicos arquivos que você
   pode criar são os três relatórios `.md` definidos abaixo. Nada além disso.
2. **Não escreva no banco.** Apenas comandos de leitura (`SELECT`, `\d`,
   `\dt`, `EXPLAIN`).
3. **Honestidade sobre ausências.** Se um arquivo, função, tabela ou
   comportamento esperado não existir, declare explicitamente "NÃO
   ENCONTRADO" / "NÃO IMPLEMENTADO" no relatório. Não invente, não infira, não
   descreva como "deveria" funcionar.
4. **Inclua conteúdo INTEGRAL** dos arquivos pequenos relevantes (hook de
   telemetria, model SQLAlchemy, handler de ingest) em blocos de código nos
   relatórios. Não resuma. Resumir esconde detalhes que importam.
5. **Use busca real (grep/ripgrep), não memória.** Inventários de chamadas,
   listas de arquivos, etc. devem vir de comandos executados, não de inferência.
6. **Execute as fases em sequência.** Cada fase produz um arquivo que serve
   como contexto para a próxima. Não pule fases nem execute em paralelo.
7. **Ao final de cada fase**, sinalize conclusão com uma linha curta no
   chat (ex: *"Fase 1 concluída em DIAGNOSTICO_TELEMETRIA.md"*) — **sem
   resumir o conteúdo**. Aguarde sinal verde do humano antes de iniciar a
   próxima fase.
8. **Se algo te impedir de continuar** (ex: ambiente Docker quebrado, arquivo
   crítico inacessível), pare e reporte ao humano. Não tente consertar
   silenciosamente.

---

## Fase 1 — Mapeamento da camada de telemetria

**Entregável:** `DIAGNOSTICO_TELEMETRIA.md` na raiz do projeto.

### O que fazer

1. Localize e leia o hook/módulo de telemetria no frontend (provavelmente em
   `frontend/src/modules/lesson/runtime/`, possivelmente chamado
   `useTelemetry` ou similar).
2. Localize e leia a rota/handler de ingest de eventos no backend
   (provavelmente em `backend/modules/lesson/` ou `backend/modules/domain/`).
3. Localize e leia o model SQLAlchemy da tabela de eventos e a migração
   Alembic correspondente.
4. Localize e liste **todas** as chamadas atuais ao hook de telemetria nos
   componentes (use grep/ripgrep pelo nome do hook). Para cada chamada,
   registre: arquivo, linha, `event_type` usado, propriedades do payload.
5. Verifique se existe alguma documentação ou tracking plan dos eventos
   (arquivo `EVENTOS.md`, comentários estruturados, ou similar).

### Estrutura do relatório

```markdown
# Diagnóstico da camada de telemetria

## 1. Camada frontend
- Caminho do arquivo
- Conteúdo INTEGRAL do arquivo (em bloco de código)
- Assinatura da função/hook exposta
- Como envia eventos (HTTP? WS? Qual endpoint?)
- Tem batching? Retry? Fila local?

## 2. Camada backend (ingest)
- Caminho do arquivo
- Conteúdo INTEGRAL do handler de ingest (em bloco de código)
- Validação aplicada (Pydantic? Schema explícito? Aceita qualquer coisa?)
- Como grava no banco

## 3. Schema do banco
- Caminho do model SQLAlchemy
- Conteúdo INTEGRAL do model (em bloco de código)
- Caminho da migração Alembic correspondente
- Lista de campos com tipos
- Índices existentes
- Constraints existentes

## 4. Inventário de chamadas atuais
| arquivo | linha | event_type | propriedades do payload | contexto (slide/componente) |
|---|---|---|---|---|

## 5. Documentação existente
- Existe EVENTOS.md ou tracking plan? Se sim, conteúdo INTEGRAL.
- Se não, declare: "Não há tracking plan documentado."

## 6. Lacunas identificadas
Checklist honesto do que NÃO existe hoje:
- [ ] event_id gerado no cliente
- [ ] timestamp_client e timestamp_server separados
- [ ] event_version
- [ ] session_id estável por sessão de usuário
- [ ] Validação de schema por tipo de evento
- [ ] Idempotência por event_id
- [ ] Tabela de quarentena para eventos malformados
- [ ] Enum de event_types ou registro central
- [ ] Endpoint de exportação para análise
```

### Regras específicas da Fase 1

- Se o inventário de chamadas retornar 0, registre "0 chamadas encontradas"
  e investigue se o hook é importado mas não usado em lugar nenhum.
- Não sugira correções nesta fase. Apenas descreva.

**Ao concluir:** diga "*Fase 1 concluída em DIAGNOSTICO_TELEMETRIA.md*" e
aguarde sinal verde.

---

## Fase 2 — Mapeamento dos componentes Mission do ATLAS

**Pré-requisito:** Fase 1 concluída e validada pelo humano.

**Entregável:** `MAPA_COMPONENTES_ATLAS.md` na raiz do projeto.

### O que fazer

1. Liste todos os componentes Mission do ATLAS em
   `frontend/src/modules/lesson/games/atlas/`. Esperados: `Reconhecimento`,
   `Assinaturas`, `Identificacao`, `MassaInvariante`, `HypatiaTutorial`,
   `HypatiaReal`. Confirme quais existem de fato.
2. Para cada componente encontrado, leia o arquivo INTEIRO e registre:
   - Caminho do arquivo
   - Props que aceita (assinatura completa)
   - Estados internos relevantes (`useState`, `useReducer`)
   - **Todos** os eventos de UI que processa (`onClick`, `onChange`, etc.)
   - Callbacks que dispara para o pai (`onLayerFocused`, `onActivityChange`,
     outros)
   - Chamadas de telemetria já presentes (se houver)
3. Para cada evento de UI listado, classifique como **INSTRUMENTADO** ou
   **NÃO INSTRUMENTADO**.
4. Verifique padrões compartilhados entre os componentes (hook comum, HOC,
   contexto). Se existirem, descreva.
5. Verifique como o componente sabe se está em modo `master-led` ou `free`,
   e se o comportamento de telemetria muda em função disso.

### Estrutura do relatório

```markdown
# Mapa dos componentes Mission do ATLAS

## ComponenteX (caminho/do/arquivo.tsx)

### Props
[assinatura TypeScript completa, em bloco de código]

### Estados internos
- nome: tipo — para que serve

### Interações do usuário
| Interação UI | Handler | Instrumentado? | Observações |
|---|---|---|---|

### Callbacks para o pai
- nome(args): quando dispara

### Telemetria atual
[lista de chamadas track() ou equivalente, com event_type e payload]

### Modo master-led vs free
[como o componente trata os dois modos, se trata]

---

(repetir bloco acima para cada componente)

## Resumo geral
- Componentes encontrados: X
- Componentes esperados mas não encontrados: lista
- Total de interações de UI mapeadas: X
- Total instrumentadas: X
- Total NÃO instrumentadas: X
- Padrões compartilhados identificados: lista
```

### Regras específicas da Fase 2

- Se um componente esperado não existir, declare e siga.
- Se uma interação parecer "trivial" (ex: hover decorativo), liste mesmo
  assim — o humano decide o que é trivial.
- Não sugira melhorias. Apenas descreva.

**Ao concluir:** diga "*Fase 2 concluída em MAPA_COMPONENTES_ATLAS.md*" e
aguarde sinal verde.

---

## Fase 3 — Estado real do banco e fluxo ponta-a-ponta

**Pré-requisito:** Fases 1 e 2 concluídas e validadas pelo humano.

**Entregável:** `ESTADO_BANCO_TELEMETRIA.md` na raiz do projeto.

### O que fazer

1. **Verifique se o ambiente Docker está rodando** (`docker compose ps`). Se
   não estiver, suba (`docker compose up -d`) e aguarde os serviços ficarem
   saudáveis. Se algo falhar ao subir, pare e reporte ao humano.

2. **Conecte ao Postgres** e descreva o estado real da tabela de eventos:
   - Schema atual da tabela (`\d+ <nome>`)
   - Quantidade de registros (`SELECT count(*)`)
   - 5 registros de exemplo (`SELECT ... LIMIT 5`), se houver
   - Distribuição de `event_types` (`GROUP BY event_type`)
   - Verificar registros com `payload` nulo, malformado ou inconsistente

3. **Teste de fumaça do fluxo de telemetria:**
   - Liste os `event_types` que o frontend pode disparar (com base na Fase 1)
   - Para cada um, verifique se há pelo menos 1 registro correspondente no
     banco
   - Se não houver, sinalize: *"o evento X é disparável pelo código mas
     nunca foi registrado no banco — possível indício de bug ou de feature
     não exercitada"*

4. **Consistência Alembic:**
   - Liste migrações em `backend/migrations/` (ou caminho equivalente)
   - `alembic current` — qual revisão está aplicada?
   - `alembic heads` — há heads múltiplos?
   - O schema real bate com a última migração?

5. **Erros silenciosos no ingest:**
   - `docker compose logs api | grep -iE "error|exception|warning"` (últimas
     24h se possível)
   - Há erros recorrentes relacionados a eventos, validação ou inserção?

### Estrutura do relatório

```markdown
# Estado real do banco e fluxo de telemetria

## 1. Estado do ambiente
- Containers ativos
- Versões de api e web

## 2. Tabela de eventos no banco
[Output literal do \d+]

### Volume e amostra
- Total de registros: X
- 5 registros de exemplo (em bloco de código)

### Distribuição por event_type
| event_type | count |
|---|---|

### Anomalias detectadas
- Registros com payload nulo: X
- Registros com timestamp ausente: X
- Outras inconsistências: lista

## 3. Cobertura: código vs banco
| event_type disparável pelo código | registros no banco | status |
|---|---|---|

## 4. Consistência Alembic
- Revisão atual: X
- Heads: X
- Schema bate com migração? sim/não/divergências

## 5. Erros nos logs
[blocos relevantes, ou "nenhum erro relacionado encontrado"]

## 6. Perguntas em aberto
Coisas que você tentou verificar mas não conseguiu, ou que parecem
estranhas e merecem atenção humana.
```

### Regras específicas da Fase 3

- Apenas comandos de leitura no banco. Nenhum `INSERT`, `UPDATE`, `DELETE`,
  `ALTER`, `DROP`.
- Se um comando falhar (ex: tabela não existe), registre o erro literal e
  siga para o próximo item.
- Se o ambiente Docker estiver quebrado e você não conseguir subir, pare e
  reporte ao humano. Não tente "consertar" o ambiente.

**Ao concluir:** diga "*Fase 3 concluída em ESTADO_BANCO_TELEMETRIA.md*".

---

## Encerramento

Após as três fases, os três arquivos a seguir devem existir na raiz:

- `DIAGNOSTICO_TELEMETRIA.md`
- `MAPA_COMPONENTES_ATLAS.md`
- `ESTADO_BANCO_TELEMETRIA.md`

Esses arquivos são insumo para o planejamento da próxima etapa (hardening
da camada, registro central de eventos, instrumentação por slide). **Não
inicie nenhuma implementação até instrução explícita do humano.**