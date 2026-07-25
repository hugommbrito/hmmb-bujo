# Test Automation Summary — Story 14.1 (Ciclos de vida de Weekly e Monthly, backend)

**Data:** 2026-07-25 · **Rito:** `bmad-qa-generate-e2e-tests` · **Baseline da story:** 1086 passed
(pytest) · **Escopo:** fechar lacunas de automação, sem code review e sem redecidir domínio.

## Frameworks detectados (usados, nenhum novo introduzido)

- **API/unit:** `pytest` + `pytest-django` + DRF `APIClient` (Postgres local via docker-compose).
- **E2E:** `Playwright` (`frontend/e2e`, `workers: 1`, backend real `config.settings.e2e` na branch
  Neon `e2e` com a migration `0007` aplicada).

## Lacunas encontradas e fechadas

A story entregou cobertura densa de serviço (matriz exaustiva, gates, idempotência) e o caminho
weekly por HTTP. As lacunas abaixo foram identificadas por varredura AC×camada e **todas aplicadas**.

### Testes de API — `backend/bujo/tests/test_views.py` (+7 funções → 8 testes coletados)

| Teste | Lacuna que fecha | AC |
|---|---|---|
| `test_post_cycle_sem_autenticacao_retorna_401` (parametrizado ×2) | nenhum dos 2 endpoints novos tinha teste de autenticação | AC8 |
| `test_post_weekly_cycle_escopado_por_tenant` | isolamento multi-tenant dos endpoints novos (§6.7) — dois usuários com alvo na MESMA semana, Bearer real nos dois clientes | AC1, AC8 |
| `test_post_monthly_cycle_ciclo_de_vida_completo_via_http` | o monthly só tinha abertura e 400 de payload; o ciclo completo por HTTP existia só no weekly | AC2, AC3, AC8 |
| `test_post_monthly_cycle_gate_de_iniciar_retorna_409` | gate de Iniciar do monthly no nível do fio | AC2 |
| `test_post_monthly_cycle_finalizar_sem_proximo_mes_em_planejamento_retorna_409` | predicado "sem lacuna" do monthly por HTTP + ciclo permanece `active` | AC2, AC3 |
| `test_post_weekly_cycle_reexecutar_iniciar_e_no_op_com_o_mesmo_corpo` | idempotência no fio (caso-âncora AD-28) **e** a fronteira "revisitável ATÉ Iniciar" | AC2 |
| `test_post_task_em_mes_futuro_nao_cria_ciclo_operacional` | AC4 no caminho de **gravação** em mês futuro (Future Log como armazenamento); o teste existente só cobria o mês corrente | AC4 |

### Testes E2E — `frontend/e2e/weekly-monthly-cycle.spec.ts` (NEW, 3 testes) + `seedFinalizedEmptyCycle.ts` (NEW)

A story é backend puro, então o spec **não** reexercita regras de transição (o pytest já as cobre).
Cobre só o que **apenas** o ambiente real prova:

| Teste | Por que só aqui | AC |
|---|---|---|
| `navegar o app real não cria nem altera ciclo operacional` | a navegação real (Hoje → Semana → Mês → Futuro) dispara os `get_or_create_*` com prefetch/refetch do TanStack Query — sequência que nenhum DRF client reproduz. Duas fases: usuário novo (tudo `NULL`) e regime já conquistado (`active`/`planning` intocados, timestamp idêntico) | AC4 |
| `unicidade de alvo e irreversibilidade de finalizar valem no banco real` | as uniques **parciais** e o CHECK só existem se a `0007` aplicou constraints na branch `e2e`; o 409 aqui é evidência do índice no banco de verdade, não do Postgres efêmero do pytest. Inclui `closed: true` num ciclo `finalized` **vazio** | AC1, AC2, AC6 |
| `ciclo finalized VAZIO entra no Arquivo e a semana fica readonly` | único efeito da story visível ao usuário hoje: o buraco que a derivação não representava, na UI real (Arquivo lista, "Fechada", zero affordance de escrita) + 409 do domínio | AC6 |

Nenhum locator de campo sem escopo é usado — desde a 13.3 o `BrainDumpCaptureSheet` monta um
`Título *` oculto e portalizado em toda rota (causa das falhas pré-existentes de
`weekly-monthly-task-crud.spec.ts`).

## Achados do passo (nenhum defeito de produção)

1. **Suposição do QA corrigida, não o código:** o primeiro rascunho esperava `complete_planning`
   como no-op depois de Iniciar. É 409 por decisão — "revisitável **até** Iniciar". O teste passou a
   afirmar a fronteira real, nos dois lados.
2. **`finalize` re-executado é 200 (no-op), não 409:** idempotência é checada **antes** da matriz, de
   propósito (AD-28 "re-executar é no-op"). As outras 3 ações sobre `finalized` são 409. O E2E
   afirma exatamente essa distinção, espelhando `test_ciclo_weekly_finalizado_e_terminal_nenhuma_saida`.
3. **Gate `ruff check` estava VERMELHO** (a story reportava verde): `F841` em
   `test_services.py:1854` — `log` atribuído e nunca usado em
   `test_ciclo_weekly_finalizar_aceita_semana_pulada_como_proxima`. Corrigido **fortalecendo** o
   teste (`refresh_from_db` + assert de persistência) em vez de apagar a variável: o teste afirmava
   só o valor de retorno, não a persistência.

## Provas de não-vacuidade (experimentos separados)

- **AC6:** `is_cycle_closed` revertida para só a derivação **e** `_CLOSED_BY_EITHER` reduzida a
  `Q(total__gt=0, undisposed=0)` → o E2E de AC6 **falhou** nas 3 tentativas em
  `getByRole('link', { name: 'Semana de <weekStart>' })` (o ciclo vazio desaparece do Arquivo).
- **AC4:** injetada em `get_or_create_weekly_log` a atribuição de estado que a AC4 proíbe → o E2E de
  AC4 **falhou** nas 3 tentativas na fase 1 (`status: null` recebido como `planning`).
- Em ambos: produção restaurada e verificada (`grep` de resíduo = 0; `git diff --stat` de volta ao
  estado pré-experimento; `bujo/`+`core/` = 539 passed).

## Gates executados após as adições

| Gate | Resultado |
|---|---|
| `uv run pytest` (full-suite, sem escopo) | **1094 passed em 297.74s** (1086 da story + 8 coletados aqui, derivado de `git diff -U0`) |
| `npx playwright test e2e/weekly-monthly-cycle.spec.ts` (`CI=1`, Node 22.15.1) | **3 passed em 1.5m** |
| `uv run ruff check` | **All checks passed!** (era 1 erro antes desta sessão) |
| `npx tsc --noEmit` | limpo |
| `npx eslint` nos 3 arquivos de E2E tocados | limpo |
| `ruff format --check` | 48 arquivos fora de formato, **todos pré-existentes** — dívida global, inalterada por este passo |

## Cobertura

- **Endpoints de ciclo (2/2):** ambos com happy path completo, 400 de payload, 409 de gate, 409 de
  disputa de alvo, 401 sem token e isolamento por tenant.
- **ACs com automação nova neste passo:** AC1, AC2, AC3, AC4, AC6, AC8 (AC5 e AC7 seguem cobertos
  pelos testes de caracterização e pela saída do `migrate`, respectivamente — o backfill sobre dados
  reais continua não testável pelo pytest, ver Questão aberta 4 da story).
- **Specs E2E do épico:** 1 novo (`weekly-monthly-cycle.spec.ts`); os 6 de regressão do contrato
  legado seguem como na story (4 falhas pré-existentes em `weekly-monthly-task-crud.spec.ts`,
  diagnosticadas e fora do escopo).

## Próximos passos (fora deste passo)

- Escopar os locators de `weekly-monthly-task-crud.spec.ts` (`getByLabel('Título')` sem escopo colide
  com o `BrainDumpCaptureSheet` portalizado desde a 13.3) — dívida de E2E de frontend, já registrada.
- Quando as Stories 14.5/14.6 derem UI ao ritual, migrar as chamadas HTTP deste spec para interação
  real de UI, mantendo o spec como contrato do fluxo.
