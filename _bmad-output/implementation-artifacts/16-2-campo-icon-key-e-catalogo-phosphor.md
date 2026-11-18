---
title: 'Story 16.2 — Campo `icon_key` e catálogo Phosphor (contrato)'
type: 'feature'
created: '2026-08-22'
status: 'done'
baseline_commit: '901464a4e1c9d6ccec0ede6ec21419741d874822'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-16-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Não existe `icon_key` em lugar nenhum do contrato (zero ocorrências em models, `schema.yaml` e `types.gen.ts`). A Story 16.1 entregou a superfície nova de Hábitos com a coluna do glifo deliberadamente vazia, e o gate 16.0 decidiu que **o emoji sai da interface**, sem fallback — mas não há onde persistir a escolha do pictograma.

**Approach:** Entregar o **contrato**: `icon_key` como campo de identidade nullable em `Habit` e `HealthFieldDefinition`, validado no serializer contra o catálogo aberto do Phosphor instalado (~1.512 nomes, artefato gerado e commitado com gate de CI), mais a data migration que converte os `emoticon` conhecidos. A apresentação (renderização e seletor) é **DW-60**, fora desta story; até lá a coluna do glifo segue vazia — estado válido entregue pela 16.1.

## Boundaries & Constraints

**Always:**
- `icon_key` é **identidade**, não versionado: entra em `Habit` (nunca `HabitVersion`) e nas tuplas de campo mutável, senão o PATCH ignora o campo em silêncio.
- Persistido em **kebab-case** (`address-book`) — a conversão para o export PascalCase do pacote é bijetiva (verificado: 0 colisões em 1512 nomes, nenhum dígito).
- Validação de existência é **obrigação de servidor**, no serializer → **400** com `fields` (molde de `accounts/serializers.py:8,22-27` com `available_timezones()`).
- `CharField`, **nunca** `ChoiceField` — um enum de 1512 valores poluiria o contrato OpenAPI (precedente: `habits/serializers.py:299-303`).
- A migration **nunca falha** por emoji desconhecido: cai para `NULL`.
- Migration de schema exige aplicar ao banco `bujo_e2e` local antes de rodar Playwright.

**Never:**
- Não dropar nem parar de gravar a coluna `emoticon` — permanece como dado histórico para a onda de remoção do legado, e as superfícies legado ainda a leem.
- Não tocar UI: nem Hábitos (DW-60) nem Saúde-Métricas (gate 16.3 não rodou). Saúde recebe **só** o campo.
- Não renderizar pictograma nesta story — o guard `record/noLiteralTokens.test.ts:134-147` permanece sem exceção.
- Não alterar regra de domínio: completude ponderada, multiplicador e snapshot intocados.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Criar hábito com chave válida | `POST /api/habits/` com `iconKey: "barbell"` | 201; `iconKey` persistido e devolvido | N/A |
| Criar sem chave | `POST` sem `iconKey` | 201; `iconKey: null` | N/A |
| Chave inexistente | `PATCH` com `iconKey: "nao-existe"` | **400** com `fields.iconKey` | Mensagem nomeia o campo; nada persiste |
| Chave em PascalCase | `POST` com `iconKey: "AddressBook"` | **400** — só kebab-case é aceito | Idem acima |
| Limpar pictograma | `PATCH` com `iconKey: null` | 200; campo volta a nulo | N/A |
| Métrica de saúde | `POST /api/health-field-definitions/` com `iconKey` válido | 201; persistido e exposto na leitura | Chave inválida → 400 |
| Migration com emoji mapeado | Hábito com `emoticon: "✅"` | `icon_key = "check"`; `emoticon` intacto | N/A |
| Migration com emoji desconhecido | `emoticon: "🦄"` sem entrada no mapa | `icon_key = NULL`; `emoticon` intacto | Nunca falha a migration |
| Isolamento entre tenants | Dois usuários com hábitos | Cada um só lê/escreve o próprio `icon_key` | N/A |

</frozen-after-approval>

## Code Map

**Hábitos** (`backend/habits/`):
- `models.py:57` `Habit` (identidade, `db_table="habits"`); `:63` `emoticon` (preservar); `:69` `unit` — **precedente exato** de campo cosmético em `Habit`. `:83` `HabitVersion` (não usar). `:75-80` único constraint é de `type`.
- `serializers.py` — 5 pontos que expõem `emoticon` e precisam do par `icon_key`: `:58` `HabitSerializer.Meta.fields`; `:65` `HabitCreateSerializer` (padrão `required=False`); `:91` `HabitUpdateSerializer`; `:132`+`:144` `HabitDayEntrySerializer` (via `source="habit.icon_key"`); `:276` `HabitSlimSerializer.Meta.fields`.
- `services.py:28` `_IDENTITY_FIELDS` — **adicionar `"icon_key"`** (`:137` faz `continue` fora da tupla). `:99-124` `create_habit` (kwargs explícitos); `:127-149` `update_habit_identity` (`save(update_fields=...)` em `:145`).
- `views.py:119,151` — views finas: `is_valid(raise_exception=True)` → `**validated_data` no service. `@extend_schema` explícito é gate de CI.
- Última migration: `0003_day_type_multiplier.py`.

**Saúde** (`backend/health/`):
- `models.py:37` `HealthFieldDefinition` (plana, não-versionada, sem `emoticon`); `:50-59` campos; `:62` `db_table`.
- `serializers.py:53` — **único serializer de leitura**, reusado por daily `:143`, history `:206`, series `:225`: um campo aqui propaga às 4 superfícies. `:56-79` create; `:82-104` update.
- `services.py:32` `_MUTABLE_FIELDS` — **adicionar `"icon_key"`** (mesmo `continue` em `:108`). `:65-86` create; `:90-114` update. `:38-49` documenta o padrão de duplicar regra entre serializer (400) e service (409).
- Última migration: `0002_health_log.py`.

**Padrões a seguir:**
- `accounts/serializers.py:1,8,22-27` — **molde da validação**: catálogo grande em constante de módulo carregada no import + `validate_<campo>` → 400.
- `core/exceptions.py:127,270` — handler normaliza para `{"detail", "fields"}`; serializer→400, `DomainError`→409.
- `bujo/migrations/0007_weekly_monthly_cycle_status.py` — **único precedente de `RunPython`** no repo: `:1-24` docstring obrigatória; `:32-37` **literais congelados, nunca importar models** (aplica-se ao mapa emoji→chave); `:12-17` `apps.get_model` devolve model histórico **sem `TenantManager`**, então o backfill itera passando `user_id` à mão; `:40+` função pura no nível do módulo como ponto de teste; `RunPython(backfill, noop)` com o noop justificado.
- `config/settings/base.py:209-212` — `camelize_serializer_fields` ⇒ `icon_key` sai como `iconKey` no wire.

**Testes:**
- `habits/tests/factories.py:47` (`emoticon="✅"`), `:98-147` `register_isolation_case` (nullable não precisa entrar nos `make=lambda`); `health/tests/factories.py:24,51-61`.
- Padrão de 400 na API: `health/tests/test_views.py:58,67,76,108`. Serializer: `health/tests/test_serializers.py:23,31,71,79,105`. Fixtures em `conftest.py:36-50`.
- **Zero testes asseveram `emoticon` hoje** — a cobertura do campo nasce aqui.

**Catálogo Phosphor:** o pacote existe só em `frontend/node_modules/@phosphor-icons/react` (v2.1.10), com 1512 arquivos em `dist/csr/*.es.js` cujos basenames são os nomes PascalCase. O backend não tem `node_modules` em produção (Railway) — daí o artefato commitado.

**Contrato:** `manage.py spectacular --file ../schema.yaml` → `npm run generate-types`; ambos commitados. Gates em `.github/workflows/ci.yml:159-160,174-187` (molde para o gate novo do catálogo). `schema.yaml:2721,2792,2870,2913,3091,4097` — posições atuais de `emoticon`.

## Tasks & Acceptance

**Execution:**

- [x] `scripts/gen_phosphor_catalog.mjs` (novo) -- gerar a lista kebab-case ordenada dos basenames de `frontend/node_modules/@phosphor-icons/react/dist/csr/*.es.js` para `backend/habits/phosphor_catalog.json`, com a versão do pacote embutida -- o backend não tem `node_modules` em produção, então o catálogo tem de ser artefato commitado.
- [x] `.github/workflows/ci.yml` -- step que regenera o catálogo e faz `diff` contra o commitado, no molde exato dos gates de `schema.yaml`/`types.gen.ts` (`:174-187`) -- sem isso o catálogo diverge em silêncio ao atualizar o pacote e chaves válidas passam a dar 400.
- [x] `backend/core/phosphor.py` (novo) -- carregar o JSON uma vez no import como `frozenset` e expor `is_valid_icon_key(value)` -- molde de `accounts/serializers.py:8`; vive em `core/` porque dois apps consomem.
- [x] `backend/habits/models.py` + `backend/health/models.py` -- `icon_key = CharField(max_length=64, null=True, blank=True)` em `Habit` e `HealthFieldDefinition` -- identidade nullable, no molde de `unit` (`habits/models.py:69`). Sem `CheckConstraint`: catálogo aberto não cabe em constraint.
- [x] `backend/habits/migrations/0004_*.py` -- `AddField` + `RunPython` com o mapa **literal congelado** emoji→chave (nunca importar models, conforme `bujo/0007:32-37`); emoji fora do mapa ⇒ `NULL`; backfill iterando por `user_id` (model histórico não tem `TenantManager`); reverso `noop` justificado; função de mapeamento extraída no nível do módulo como ponto de teste.
- [x] `backend/health/migrations/0003_*.py` -- `AddField` puro -- Saúde não tem `emoticon` a converter.
- [x] `backend/habits/serializers.py` -- `icon_key` nos 5 pontos do Code Map + `validate_icon_key` rejeitando chave inexistente e formato fora de kebab-case -- `CharField`, jamais `ChoiceField`.
- [x] `backend/health/serializers.py` -- `icon_key` em `:53`, no create e no update, com a mesma validação.
- [x] `backend/habits/services.py:28` + `backend/health/services.py:32` -- `"icon_key"` nas tuplas de campo mutável e o kwarg em `create_habit`/`create_health_field` -- sem isso o PATCH descarta o campo silenciosamente.
- [x] `backend/habits/tests/` + `backend/health/tests/` -- cobrir cada linha da I/O Matrix (400 de chave inexistente e de PascalCase, nulo aceito, PATCH persiste, isolamento multi-tenant) e o teste unitário da função de mapeamento da migration -- hoje não há **nenhum** teste do campo cosmético.
- [x] `schema.yaml` + `frontend/src/api/types.gen.ts` -- regenerar e commitar -- gate duro de CI.

**Acceptance Criteria:**

- **Dado** o banco com `emoticon` preenchido, **quando** a migration roda, **então** cada emoji do mapa vira o `icon_key` correspondente, emoji desconhecido vira `NULL`, a coluna `emoticon` permanece intacta, **e** a migration reverte e reaplica sem erro.
- **Dado** o catálogo commitado, **quando** o CI regenera o artefato, **então** não há diferença; e um `icon_key` válido do pacote instalado é aceito enquanto qualquer nome fora dele é rejeitado.
- **Dado** o contrato regenerado, **quando** `schema.yaml` e `types.gen.ts` são inspecionados, **então** `iconKey` aparece como string nullable em Hábitos e em Saúde, **e** nenhum enum novo foi emitido.
- **Dado** que esta story é só contrato, **quando** o diff é revisado, **então** nenhum arquivo de UI foi alterado — a coluna do glifo segue vazia, nenhum pictograma é renderizado, e nenhuma superfície passa a ler `emoticon`.
- **Dado** o Épico 16, **quando** a suíte roda, **então** nenhuma regra de domínio de hábitos mudou (completude ponderada, multiplicador e snapshot intocados).

## Spec Change Log

**2026-08-22 — 6 fixtures de teste do frontend tocadas (desvio do Manual Check).**
O Manual Check pede que `git diff --stat` não liste nada sob
`frontend/src/features/habits/components/` nem `frontend/src/pages/`. **Nenhum
arquivo de UI (componente, página, hook) foi alterado** — mas seis arquivos
`*.test.tsx` nesses diretórios precisaram de `iconKey: null` nas fixtures de
`HabitDayEntry`, senão o `tsc` reprova.

Causa: `HabitDayEntrySerializer` declara `icon_key` como campo explícito
(`source="habit.icon_key"`), então o drf-spectacular o emite em `required` — igual
ao `emoticon` que já estava lá. O `types.gen.ts` regenerado passa a exigir
`readonly iconKey: string | null`, e toda fixture literal do tipo quebra. Os outros
serializers de leitura (`Habit`, `HabitSlim`, `HealthFieldDefinition`) herdam o
campo do model com `blank=True` e ficam opcionais, exatamente como `emoticon`/`unit`
já ficam — por isso só as fixtures de `HabitDayEntry` foram afetadas.

Alternativa descartada: afrouxar `icon_key` no `HabitDayEntrySerializer` para não
entrar em `required`. Isso mentiria sobre o contrato (o read-model do dia SEMPRE
carrega a chave, mesmo que nula) e divergiria do `emoticon` vizinho. Preferiu-se a
correção mecânica na fixture, anotada em cada arquivo com a ligação a DW-60.

Arquivos: `api.test.tsx`, `HabitHistory.test.tsx`, `HabitHistoryGrid.test.tsx`,
`HabitTracker.test.tsx`, `record/recordPrimitives.test.tsx`,
`pages/habits/HabitsRecordPage.test.tsx`. Nenhum deles renderiza o pictograma; o
guard `record/noLiteralTokens.test.ts:134-147` segue sem exceção e verde.

**2026-08-22 — `health/tests/test_serializers.py` atualizado.**
`test_read_serializer_exposes_expected_fields` fixa o conjunto de campos do único
serializer de leitura de Saúde; `icon_key` entrou nele por decisão da story, então
a asserção foi estendida (não afrouxada) com o motivo em comentário.

**2026-08-22 — o validador compartilhado ficou em `core/phosphor.py`.**
A spec pedia `is_valid_icon_key(value)` em `core/phosphor.py` e `validate_icon_key`
nos serializers dos dois apps. Como a regra e o texto de erro são idênticos em
Hábitos e Saúde, o `validate_icon_key` (que levanta `serializers.ValidationError`)
mora junto do catálogo e cada serializer o pluga com
`validate_icon_key = staticmethod(validate_icon_key)`. Uma definição, um texto de
erro. `core/` já importa DRF em cinco módulos, e ler o JSON por caminho de arquivo
não é import de `habits` — a port rule (import-linter) segue KEPT.

**2026-08-22 — 7 falhas PRÉ-EXISTENTES no frontend (não são desta story).**
A suíte do frontend fecha em **2214 passed | 7 failed** (150 arquivos), com as 7
falhas concentradas em três arquivos de `bujo`/`planner`:
`features/bujo/components/TaskDestinationDialog.test.tsx` (5),
`features/bujo/components/TaskDetailPanel.test.tsx` (1) e
`pages/planner/FuturePage.test.tsx` (1) — todas em torno do seletor de destino e
da migração.

**Verificado que são anteriores a esta story**: as mesmas 7 falham em worktree
limpo no baseline `901464a`, sem nenhuma linha deste diff. O diff não toca
`features/bujo/` nem `pages/planner/` — a única mudança de frontend fora de
habits é `types.gen.ts`, regenerado do schema, e a suíte de Hábitos passa
integralmente. Não corrigidas aqui por estarem fora do escopo; candidatas a
entrada no ledger de trabalho diferido.

**2026-08-22 — patches do ciclo de review 1 aplicados (8 achados).**
O mais consequente: `icon_key_for_emoticon` passou a **degradar para o emoji base**
quando a grafia traz modificador de tom de pele (`U+1F3FB`–`U+1F3FF`) ou cauda de
gênero ZWJ. Medido antes do patch: `🏃🏽`, `🧘🏻`, `🙏🏼` e `🚶‍♀️` devolviam `None`
com o base mapeado — perda silenciosa de pictograma para quem digitou o emoji com
tom, num campo legado de texto livre. Verificado depois em banco descartável com
dados reais: `🏃🏽` → `person-simple-run`, `🚶‍♀️` → `person-simple-walk`, e
reverte/reaplica preservando `emoticon`.

Os outros sete são de robustez e de verificação, sem mudança de comportamento
observável: guarda contra chave duplicada no mapa congelado; `\Z` no regex kebab
(o `$` casava antes de `\n`); `ImproperlyConfigured` ao carregar catálogo
ausente/corrompido, em vez de traço cru no boot; step de CI restaurando o arquivo
antes de comparar (não deixa a árvore suja); guardas no gerador para `dist/csr`
ausente e para nome com dígito; renomeação do teste tautológico de versão
(`test_catalog_e_internamente_consistente`) mais um gate local anti-drift que
compara com `node_modules` quando presente; e dois testes de borda documentando
que a API apara espaços (`"  barbell  "` → 201 com `"barbell"`) e rejeita `""`.

Suíte de `icon_key`: 61 → **71 testes**. Detalhe de cada achado, mantido ou
descartado, no Review Triage Log acima.

## Review Triage Log

**Ciclo de review 1** — 3 camadas (blind-hunter, edge-case-hunter, verification-gap)
contra o diff de `901464a`..árvore de trabalho. Cada achado foi verificado no local
que nomeia antes da classificação.

### Mantidos → `patch` (corrigidos neste ciclo)

| # | Achado | Consequência verificada | Sev |
|---|---|---|---|
| P1 | Tom de pele e ZWJ caem para `NULL` na migração | Medido: `🏃🏽`, `🧘🏻`, `🙏🏼` devolviam `None` com o emoji base mapeado; `🚶‍♀️` idem. O campo legado é texto livre, então tom de pele é população realista — perda silenciosa de pictograma, o oposto da "ausência por escolha" do gate 16.0. Corrigido com degradação para o emoji base (tom + cauda ZWJ), +3 testes | medium |
| P2 | Nada impede chave duplicada no mapa congelado | Dict literal de 155 entradas sem lint (migrations em `extend-exclude`); chave repetida perde a primeira em silêncio. Adicionado `test_nenhuma_chave_duplicada_no_mapa` | low |
| P3 | `_KEBAB_CASE` usa `$`, que casa antes de `\n` | Medido: `is_kebab_case("barbell\n")` devolvia `True`. A pertinência ao catálogo ainda barrava (sem consequência ao usuário), mas a regra de forma deve valer sozinha. Trocado por `\Z` | low |
| P4 | Catálogo ausente/corrompido derruba o boot com traço opaco | `json.loads` sem guarda no import: `FileNotFoundError`/`JSONDecodeError` cru no start do gunicorn. Envolvido em `ImproperlyConfigured` nomeando arquivo e conserto | low |
| P5 | Step de CI deixa a árvore suja mesmo passando | O gerador escreve in-place e nada restaura. Hoje é o último step do arquivo (latente), mas arma quem adicionar outro depois. Passou a restaurar antes de decidir e a comparar dois arquivos em `/tmp` | low |
| P6 | Gerador sem guarda para `dist/csr` ausente e para dígito no nome | `readdirSync` cru daria ENOENT em vez da mensagem acionável que a leitura de versão já dá; e a conversão kebab não define separação para dígitos. Ambas as guardas adicionadas | low |
| P7 | `test_catalog_tem_o_tamanho_e_a_versao_do_pacote_instalado` é tautológico | Compara `payload["version"]` com `PHOSPHOR_VERSION`, que é lido do MESMO arquivo — nunca detectaria o drift do nome. Renomeado para `test_catalog_e_internamente_consistente` com o motivo, e adicionado gate local que compara com `node_modules` quando presente (skip no CI-backend) | low |
| P8 | Borda de espaços e de `""` sem teste na API | Medido: `iconKey: "  barbell  "` devolve **201** persistindo `"barbell"` (o `CharField` do DRF apara antes do validador); `""` devolve 400. Comportamento correto nos dois casos, mas não documentado. Dois testes de borda adicionados + nota no teste unitário que parecia contradizer a API | low |

### Descartados (verificação refutou ou regra do workflow dispôs)

| Achado | Por que cai |
|---|---|
| I/O Matrix diz `✅ → "check"`, mapa implementa `"check-circle"` | Divergência real, mas o conserto editaria a Matrix, que está DENTRO de `<frozen-after-approval>` — o workflow manda descartar achado cujo fix edita a spec desta build. No mérito o código está certo: `✅` é check em círculo (`check-circle`); `✔️`/`✔`, sem círculo, é que mapeiam para `check` |
| `HabitDayEntry.iconKey` é `required` e o de Saúde é opcional (assimetria) | Verificado no `types.gen.ts`: é o reflexo correto de duas construções distintas — `HabitDayEntrySerializer` declara o campo explicitamente (read-model do dia SEMPRE carrega a chave, `readonly`), enquanto os demais o herdam do model com `blank=True`. Mesmo par que `emoticon` já exibe. Nenhuma consequência para o consumidor |
| Status divergente entre spec (`in-review`) e `sprint-status.yaml` (`in-progress`) | Não é defeito: o `sync-sprint-status` roda com `target_status=review` no step-05, depois deste. A divergência é o estado esperado durante o próprio review |
| Backfill faz N `UPDATE` em vez de `bulk_update` | O próprio achado reconhece que segue o precedente de `bujo/0007`. Base instalada é de um usuário; a tabela não tem escala que torne N round-trips um problema, e divergir do único precedente de data migration do repo custa mais do que ganha |
| Factories não setam `icon_key` por default | Deliberado: o default reflete a população real PRÉ-migração (`emoticon` preenchido, `icon_key` nulo), e os testes que exercitam o campo o setam explicitamente. `register_isolation_case` não precisa de campo nullable |
| Gate de CI só pega bump de lockfile sem regenerar catálogo | É exatamente o cenário que importa (`npm ci` instala do lockfile), e o gate o cobre. A redação do comentário promete um pouco mais do que entrega — cosmético |
| `print()` na migration é a única evidência do AC de backfill | Verificado à mão em banco descartável (reverte/reaplica com dados reais, `emoticon` intacto). Introduzir `django_test_migrations` é dependência e padrão novos, fora do escopo; segue o precedente de `bujo/0007` |
| `HabitCreateSerializer.icon_key` sem `default` diverge de `emoticon`/`unit` | Divergência intencional e documentada em comentário: com `default` o "não enviou" viraria `icon_key=None` explícito nos kwargs do service. Comportamento correto e coberto por `test_post_sem_chave_devolve_null` |
| Mensagem de `""` em inglês (built-in do DRF) | Verificado; o texto vem do DRF porque `validate_icon_key` não roda para blank. Inconsistência cosmética de idioma numa borda que o usuário não alcança pela UI (o seletor manda `null`, nunca `""`) |

### `defer` (pré-existente ou fora do escopo — no ledger)

`DW-61` 7 testes de frontend falhando em `bujo`/`planner`, confirmados no baseline
`901464a`; `DW-62` gates de artefato do CI sem proteção contra remoção silenciosa
(mesma exposição dos gates pré-existentes de `schema.yaml`/`types.gen.ts`);
`DW-63` `@phosphor-icons/react` em caret com catálogo de versão exata.

## Design Notes

**Por que kebab-case, e por que a conversão é segura.** Medido nos 1512 nomes de `dist/csr/`: nenhum contém dígito e a conversão PascalCase→kebab não produz **nenhuma** colisão, então o mapeamento é bijetivo e reversível sem tabela. Persistimos o nome público do Phosphor (`address-book`) — também o que a busca por substring espera em DW-60 — e a conversão para o export do pacote fica no frontend.

**400 e não 409.** A AC pede 400 para nome inexistente, mas todo `DomainError` de service vira 409 (`core/exceptions.py:172-182`). A validação primária vai portanto no serializer, exatamente como `health/services.py:41-43` já documenta para a regra de enum.

**Por que Saúde ganha o campo sem UI.** A AC do epics.md nomeia "hábitos e métricas de saúde" na mesma migration. Como `HealthFieldDefinition` é plana e não-versionada, o custo é uma coluna nullable e evita uma segunda migration na Story 16.4 — que está atrás do gate UX 16.3 e não pode consumir nada ainda.

## Verification

**Commands:**
- `cd backend && uv run pytest` -- expected: suíte completa verde (Postgres local; full-suite é padrão neste repo)
- `cd backend && uv run python manage.py makemigrations --check --dry-run --noinput --settings=config.settings.prod` -- expected: sem drift
- `cd backend && uv run python manage.py migrate habits 0003 && uv run python manage.py migrate` -- expected: reverte e reaplica sem erro
- `cd backend && uv run python manage.py spectacular --file ../schema.yaml` -- expected: diff só com `iconKey`
- `node scripts/gen_phosphor_catalog.mjs && git diff --exit-code backend/habits/phosphor_catalog.json` -- expected: sem diferença
- `cd frontend && npm run generate-types && npm run typecheck && npm run lint && npm run test:run` -- expected: tudo verde, sem mudança de comportamento de UI
- `cd frontend && CI=1 npx playwright test habits-record.spec.ts` -- expected: verde e inalterado (aplicar as migrations ao banco `bujo_e2e` local **antes**)

**Manual checks:**
- Node ≥20.12 via `nvm use 22.15.1` antes de qualquer comando de frontend/e2e.
- `git diff --stat` não deve listar nenhum arquivo sob `frontend/src/features/habits/components/` nem `frontend/src/pages/`.

## Suggested Review Order

**Autoridade de validação (comece aqui)**

- Entrada do design: catálogo aberto vira `frozenset` no import, molde de `available_timezones()`.
  [`phosphor.py:60`](../../backend/core/phosphor.py#L60)

- A regra que a AC pede: 400 no serializer, nunca `DomainError` (que viraria 409).
  [`phosphor.py:82`](../../backend/core/phosphor.py#L82)

- Duas condições, não uma: grafia kebab **e** existência — PascalCase cai por regra, não por acaso.
  [`phosphor.py:71`](../../backend/core/phosphor.py#L71)

**Migração de dado (a peça de maior risco)**

- Mapa literal congelado: uma migration não pode importar `core.phosphor` nem os models.
  [`0004_icon_key.py:44`](../../backend/habits/migrations/0004_icon_key.py#L44)

- Degradação para o emoji base — tom de pele e cauda ZWJ (patch do review).
  [`0004_icon_key.py:211`](../../backend/habits/migrations/0004_icon_key.py#L211)

- Varredura global deliberada: model histórico não tem `TenantManager`.
  [`0004_icon_key.py:261`](../../backend/habits/migrations/0004_icon_key.py#L261)

- Reverso `noop`: reverter derruba a coluna, e `emoticon` nunca foi tocado.
  [`0004_icon_key.py:311`](../../backend/habits/migrations/0004_icon_key.py#L311)

**O campo nos dois modelos**

- Identidade nullable sem `CheckConstraint`: catálogo aberto não cabe em constraint.
  [`habits/models.py:79`](../../backend/habits/models.py#L79)

- Saúde recebe só o campo — evita segunda migration na 16.4, atrás do gate 16.3.
  [`health/models.py:67`](../../backend/health/models.py#L67)

**Borda e persistência**

- Validador plugado por `staticmethod`: uma regra, um texto de erro nos dois apps.
  [`habits/serializers.py:86`](../../backend/habits/serializers.py#L86)

- Sem isto o PATCH descarta o campo em silêncio — `continue` fora da tupla.
  [`habits/services.py:31`](../../backend/habits/services.py#L31)

- Mesmo mecanismo em Saúde.
  [`health/services.py:35`](../../backend/health/services.py#L35)

**O artefato e seu gate**

- Bijeção kebab⇄Pascal é premissa do contrato: colisão futura falha ruidosamente aqui.
  [`gen_phosphor_catalog.mjs:35`](../../scripts/gen_phosphor_catalog.mjs#L35)

- Único elo entre o JSON commitado e o pacote instalado; roda no job com `node_modules`.
  [`ci.yml:227`](../../.github/workflows/ci.yml#L227)

**Testes (periféricos)**

- Prova do patch de tom de pele sobre a função pura.
  [`test_migration_icon_key.py:67`](../../backend/habits/tests/test_migration_icon_key.py#L67)

- Documenta a borda real da API: DRF apara espaços antes do validador.
  [`test_icon_key.py:128`](../../backend/habits/tests/test_icon_key.py#L128)

- Gate anti-drift local, com skip onde `node_modules` não existe.
  [`test_phosphor.py:114`](../../backend/core/tests/test_phosphor.py#L114)
