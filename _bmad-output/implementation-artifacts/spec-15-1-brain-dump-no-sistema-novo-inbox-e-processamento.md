---
title: 'Brain Dump no sistema novo (inbox + processamento)'
type: 'feature'
created: '2026-07-29'
status: 'done'
baseline_revision: '3f3f08422e6dfd6fdf5c02c4ee22320407e0a770'
final_revision: 'e6bbf0a2df76ae8932707a605860a14995f35e15'
review_loop_iteration: 0
followup_review_recommended: true
context: [
  '{project-root}/_bmad-output/implementation-artifacts/epic-15-context.md',
  '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/mockups/key-brain-dump.html',
]
warnings: ['oversized']
deferred:
  - summary: >-
      Os radiogroups novos (log de destino e dia da semana) não têm
      navegação por setas/roving-tabindex, só Tab por item.
    evidence: |-
      Mirrors o mesmo gap já existente em `DestinationPicker.tsx` (M10), cuja
      anatomia esta story reusa deliberadamente — não é regressão nova, é
      padrão herdado sem correção.
    location: >-
      frontend/src/features/braindump/components/BrainDumpDestinationPicker.tsx
    severity: low
  - summary: >-
      O `input type="month"` de "Futuro" não tem `min`, então um mês passado
      pode ser escolhido e confirmado.
    evidence: |-
      Mesmo gap já presente no `ProcessItemDialog.tsx` legado — replicado,
      não introduzido, pela nova anatomia.
    location: >-
      frontend/src/features/braindump/components/BrainDumpDestinationPicker.tsx
    severity: low
  - summary: >-
      A recusa client-side do mês corrente em "Futuro" depende de
      `currentMonthFirst`, que fica `null` até `useTodayLogQuery` resolver —
      existe uma janela breve em que a guarda não dispara no cliente.
    evidence: |-
      O backend (`BrainDumpItemProcessView`) revalida
      `destination=future`/`month_first <= mês corrente` de forma
      independente e rejeita com 400, então nenhuma Task inválida chega a
      ser criada — o pior caso é um erro de servidor no lugar da mensagem
      inline antecipada.
    location: 'frontend/src/features/braindump/components/BrainDumpDestinationPicker.tsx:122'
    severity: low
  - summary: >-
      O radiogroup de dia da semana permite selecionar e confirmar um dia já
      passado dentro da semana corrente.
    evidence: |-
      Nenhum requisito de produto ou precedente no seletor irmão proíbe isso
      explicitamente; achado incidental, sem AC violada.
    location: 'frontend/src/features/braindump/components/BrainDumpDestinationPicker.tsx:255'
    severity: low
  - summary: >-
      `useTaskDensityQuery` descarta o estado de erro (`density.data ?? []`),
      então uma falha de leitura da densidade renderiza igual a um mês
      genuinamente vazio.
    evidence: |-
      Mesmo padrão já aceito em `TaskDestinationDialog.tsx` — comportamento
      herdado, não uma regressão desta story.
    location: 'frontend/src/features/braindump/components/BrainDumpDestinationPicker.tsx:131'
    severity: low
  - summary: >-
      O job de frontend do CI (`ci.yml`) só roda `tsc`/`eslint`/`vite
      build` — nunca invoca vitest, então nenhum teste unitário/jest-axe
      novo desta story (nem os pré-existentes) é aplicado como gate
      automático.
    evidence: |-
      Achado incidental de um reviewer, pré-existente e alheio aos arquivos
      deste diff — `ci.yml` não foi tocado por esta story.
    location: '.github/workflows/ci.yml'
    severity: medium
  - summary: >-
      O atalho global de Enter nos seletores de destino (Brain Dump E M10)
      pode confirmar uma seleção antiga/já armada em vez do dia/destino que
      o usuário acabou de focar, por uma corrida entre o handler de teclado
      em `window` e o clique nativo do botão-radio focado.
    evidence: |-
      Confirmado lendo `useKeyboardShortcuts` (só exclui INPUT/TEXTAREA/
      contentEditable do guard de atalho, não BUTTON) e `confirm()` em
      `BrainDumpDestinationPicker.tsx` — o clique nativo que atualiza o
      estado do dia dispara como ação padrão do keydown, DEPOIS do listener
      de `window` já ter lido o estado antigo. Anatomia idêntica
      (useKeyboardShortcuts + role="radio" em botão) já existe, sem
      alteração, em `DestinationPicker.tsx` (M10, `MigrationRitualPage.tsx`)
      — herdada, não introduzida por esta story.
    location: >-
      frontend/src/features/braindump/components/BrainDumpDestinationPicker.tsx:205-208;
      frontend/src/features/bujo/components/DestinationPicker.tsx
    severity: medium
---

<intent-contract>

## Intent

**Problem:** O Brain Dump legado (`BrainDumpPage.tsx`) roda fora do shell novo, sem tokens de design, e sem edição de item — mas o gate UX da 15.0 tornou a edição paritária (título/descrição/destino) parte obrigatória do escopo, e o domínio backend hoje só tem criar/listar/processar/descartar/contar (sem endpoint de atualização).

**Approach:** Adicionar `PATCH /api/brain-dump/items/{id}/` (M11) ao domínio `braindump`; construir a página Inbox do sistema novo com paridade total do fluxo legado (capturar/listar/mover/descartar) mais edição paritária via sheet de item; reusar a anatomia do seletor de destino do ritual de migração (M10) para "Mover", trocando abas por um radiogroup de 4 destinos; ligar a rota nova e marcar a superfície como migrada.

## Boundaries & Constraints

**Always:**
- Preservar as query keys/invalidações atuais (`['brainDump','count',userId]`, `['brainDump','list']`); nenhuma chave nova de estado cliente.
- Captura permanece otimista só sobre a contagem (com rollback em falha); mover/descartar/editar são não-otimistas — a linha só atualiza após confirmação do servidor.
- Descartar executa direto, sem dialog, sem desfazer (paridade deliberada com o legado).
- Item do Brain Dump não ganha categoria, Eisenhower, ícone de status, máquina de estado, filtro, busca, ordenação manual, IA ou sugestão automática de destino.
- Todo código novo de domínio usa `BrainDumpItem.objects` (tenant-scoped), nunca `all_objects`.
- Toda página/componente novo usa tokens de `shared/design/tokens.ts` (`var(--ds-*)`), nunca cor de tema MUI crua (todo `Button` declara `sx` de cor explícita — achado real de axe em stories anteriores).
- "Brain Dump vazio." é o único texto do estado vazio (uma frase, sem incentivo a conteúdo).

**Block If:**
- Reusar a anatomia do seletor de destino exigir modificar o comportamento hoje ativo de `DestinationPicker.tsx` para o consumidor existente (`MigrationRitualPage.tsx`, ritual de migração já em produção): pare antes de alterar esse arquivo compartilhado e decida se a extensão é aditiva-segura ou se precisa de um componente novo que só reusa as peças internas.
- Qualquer sinal de que o PATCH precisa de um campo `updated_at` em `BrainDumpItem` (o padrão de `Task._apply_fields` salva com `update_fields=[...,"updated_at"]`): este spec assume que NÃO é necessário (nenhum requisito de produto pede timestamp de edição) — confirme antes de adicionar migração/campo novo.

**Never:**
- Alterar `BrainDumpCaptureSheet.tsx` (estilo, comportamento ou rotas) — pertence à Story 15.2.
- Alterar `BrainDumpPage.tsx`, `ProcessItemDialog.tsx` ou `BrainDumpItemRow.tsx` legados — permanecem intocados e roteados só pela rota antiga até o Épico 18.
- Fazer o sheet de edição do item disparar "Descartar alterações?" por simplesmente ter texto (isso é o Capture Sheet); o sheet de edição dispara só por alteração não salva vs. o valor carregado.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| PATCH parcial válido | `{title}` só | 200, item atualizado, demais campos preservados | — |
| PATCH todos os campos | `{title, description, target_log}` | 200, todos atualizados | — |
| PATCH `target_log` inválido | valor fora de `today/week/month/future`/null | 400 | `ValidationError` no campo |
| PATCH item inexistente/de outro tenant | `pk` não pertence ao tenant atual | 404 | `NotFound` |
| Editar item, salvar sucesso | sheet aberto, campos alterados, Salvar | linha atualiza in-place, sheet fecha, foco volta ao acionador | — |
| Editar item, falha de escrita | mesma ação, servidor erra | sheet permanece aberto, 3 campos preservados, erro junto à ação | retry manual (reenviar) |
| Fechar sheet de edição sem alteração | valor igual ao carregado | fecha direto, sem dialog | — |
| Fechar sheet de edição com alteração não salva | valor diverge do carregado | dialog "Descartar alterações?", foco em Continuar editando, `Escape` = continuar | — |
| Mover para Esta Semana/Este Mês com dia escolhido | radiogroup + dia no calendário de densidade | cria Task com `scheduled_date`, remove item, contagem/badge caem juntos | — |
| Mover para Futuro no mês corrente | `input month` = mês atual | erro associado ao campo, recusa (Este Mês atende o mês corrente) | erro inline no campo |
| Offline | qualquer ação de escrita (capturar/mover/descartar/editar) | ação desabilitada, motivo no nome acessível; leitura já carregada permanece | — |

</intent-contract>

## Code Map

- `backend/braindump/models.py` -- `BrainDumpItem` (title≤500, description null, target_log null/choices, created_at) — ler só, sem alteração (ver Block If sobre `updated_at`).
- `backend/braindump/serializers.py` -- adicionar `BrainDumpItemUpdateSerializer` (campos opcionais, mesmo molde de `bujo/serializers.py::TaskUpdateSerializer`).
- `backend/braindump/services.py` -- adicionar `update_brain_dump_item(*, user, item_id, **fields)`, mesmo formato de `create_brain_dump_item`/`discard_brain_dump_item` já no arquivo (`BrainDumpItem.objects.get` + `setattr` + `.save(update_fields=list(fields))`, sem `updated_at`).
- `backend/braindump/views.py` -- `BrainDumpItemDetailView` (hoje só `delete`, L41-48) ganha `.patch`, espelhando `bujo/views.py::TaskDetailView.patch` (L135-160): serializer partial → `is_valid(raise_exception=True)` → `except DoesNotExist: raise NotFound()` → `Response(BrainDumpItemSerializer(item).data)`.
- `backend/braindump/urls.py` -- sem mudança (rota `items/{id}/` já existe, só ganha método).
- `backend/braindump/tests/test_serializers.py`, `test_views.py` -- estender no padrão pt-BR já usado (`test_patch_..._de_outro_tenant_retorna_404`, ver `bujo/tests` equivalente).
- `schema.yaml` (raiz) + `frontend/src/api/types.gen.ts` -- regenerar (Verification) após o endpoint novo.
- `frontend/src/features/braindump/api.ts` -- adicionar `useUpdateBrainDumpItemMutation` (não-otimista, mesmo molde de `features/bujo/api.ts::useUpdateRecurringTemplateMutation`: `useMutation` simples + `onSuccess` invalida `keys.brainDump.list()`).
- `frontend/src/features/braindump/components/BrainDumpCaptureForm.tsx` -- só ler: reusar `TARGET_LOG_OPTIONS` (rótulos dos 5 destinos) nos componentes novos, sem duplicar vocabulário.
- `frontend/src/features/bujo/components/ItemRowBase.tsx` -- estender com prop opcional `onActivate?: () => void` (torna a linha/título um controle real) — extensão explicitamente prevista no cabeçalho do arquivo para o Épico 15, com este componente como consumidor de produção real.
- `frontend/src/features/bujo/components/DestinationPicker.tsx` -- reusar a anatomia (calendário de densidade via `MonthDensityCalendar`, `useKeyboardShortcuts`, ação nomeada); ver Block If antes de editar o arquivo em si.
- `frontend/src/app/layout/shell/shellDestinations.ts` -- só ler: ícones/rótulos dos 4 destinos (`calendar-dot`/`calendar-dots`/`calendar`/`calendar-plus`) para o radiogroup do seletor novo.
- `frontend/src/pages/planner/FutureBoardPage.tsx` -- referência de convenção de página nova (tokens, `useOnlineStatus`, `RETRY_BUTTON_SX`, skeleton, sem cor de tema MUI).
- `frontend/src/pages/braindump/BrainDumpInboxPage.tsx` (NOVO) -- página Inbox do sistema novo.
- `frontend/src/features/braindump/components/BrainDumpInboxCaptureForm.tsx` (NOVO) -- Panel Capturar com tokens (Título/Descrição/Destino), usa `useCreateBrainDumpItemMutation` existente.
- `frontend/src/features/braindump/components/BrainDumpInboxItemRow.tsx` (NOVO) -- variante Brain Dump sobre `ItemRowBase` (sem categoria/Eisenhower/status; chip de dica de `target_log` com texto verbatim "Fica no Brain Dump até ser processado."; meta `created_at`; trailing Mover/Descartar no ponteiro via `onActivate` para editar).
- `frontend/src/features/braindump/components/BrainDumpItemSheet.tsx` (NOVO) -- sheet responsivo de edição (ver Design Notes).
- `frontend/src/features/braindump/components/BrainDumpDestinationPicker.tsx` (NOVO) -- "Mover": radiogroup de log (Hoje/Esta Semana/Este Mês/Futuro) sobre a anatomia do `DestinationPicker`; confirma via `useProcessBrainDumpItemMutation` (já existe, sem mudança).
- `frontend/src/app/router.tsx:175` -- trocar `element` de `<BrainDumpPage />` para `<BrainDumpInboxPage />` na rota `brain-dump`.
- `frontend/src/app/layout/shell/shellRouting.ts:73` -- `surfaceMigrated: false` → `true` para `routeId: 'brain-dump'`.

## Tasks & Acceptance

**Execution:**
- `backend/braindump/serializers.py` -- adicionar `BrainDumpItemUpdateSerializer` -- contrato de entrada do PATCH.
- `backend/braindump/services.py` -- adicionar `update_brain_dump_item` -- aplica campos parciais, tenant-scoped.
- `backend/braindump/views.py` -- adicionar `BrainDumpItemDetailView.patch` -- expõe o endpoint M11.
- `backend/braindump/tests/test_serializers.py` + `test_views.py` -- cobrir a I/O Matrix do PATCH (parcial, todos campos, inválido, 404 próprio/outro tenant) -- fecha M11.
- `schema.yaml` + `frontend/src/api/types.gen.ts` -- regenerar -- tipos do PATCH disponíveis no frontend.
- `frontend/src/features/braindump/api.ts` -- adicionar `useUpdateBrainDumpItemMutation` -- consumo do PATCH, não-otimista.
- `frontend/src/features/bujo/components/ItemRowBase.tsx` -- adicionar `onActivate?` -- linha vira controle para abrir o sheet de edição.
- `frontend/src/features/braindump/components/BrainDumpInboxItemRow.tsx` -- criar variante Brain Dump -- Item Row com paridade visual DESIGN.md.
- `frontend/src/features/braindump/components/BrainDumpInboxCaptureForm.tsx` -- criar Panel Capturar com tokens -- captura inline da página Inbox.
- `frontend/src/features/braindump/components/BrainDumpDestinationPicker.tsx` -- criar seletor de destino em radiogroup -- reuso do M10, fecha divergência de `scheduled_date` em semana/mês.
- `frontend/src/features/braindump/components/BrainDumpItemSheet.tsx` -- criar sheet responsivo de edição -- edição paritária (Q1 do gate 15.0).
- `frontend/src/pages/braindump/BrainDumpInboxPage.tsx` -- criar página Inbox -- compõe captura → pendências → lista, estados loading/empty/error/offline.
- `frontend/src/app/router.tsx` -- trocar elemento da rota `brain-dump` -- ativa a página nova.
- `frontend/src/app/layout/shell/shellRouting.ts` -- `surfaceMigrated: true` -- sinaliza migração concluída da superfície.
- Testes colocados (`*.test.tsx`, `jest-axe`) para cada componente/hook novo -- paridade de convenção com as demais superfícies do sistema novo.

**Acceptance Criteria:**
- Given o inventário da superfície legada, when o Brain Dump renderiza no sistema novo, then captura, listagem (variante Item Row), edição e processamento (mover/descartar) mantêm paridade completa, e "Brain Dump vazio." permanece o estado saudável.
- Given o server state existente, when itens são processados/editados/descartados, then as query keys e invalidações atuais são preservadas (sem estado novo de cliente), e a captura segue otimista sobre a contagem com rollback em falha — as demais mutações não são otimistas.
- Given um item com `target_log` gravado, when o seletor de destino abre para Mover, then a opção correspondente já vem pré-selecionada no radiogroup, sem mover o item sozinho.
- Given a rota `/brain-dump` após a implementação, when carregada, then usa `BrainDumpInboxPage` (não a página legada) e `shellRouting.ts` marca a superfície como migrada.

## Spec Change Log

## Review Triage Log

### 2026-07-30 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 12 (high 0, medium 7, low 5)
- defer: 6 (high 0, medium 1, low 5)
- reject: 3
- addressed_findings:
  - `[medium]` `[patch]` `BrainDumpItemSheet.tsx` dirty-check compared `description.trim() || null` (current) against `item.description ?? null` (original) — for a stored `''`, this reported dirty on load and silently rewrote `''`→`null` on save. Fixed via a shared normalization helper applied to both sides; regression test added.
  - `[medium]` `[patch]` `BrainDumpDestinationPicker.tsx`/`BrainDumpItemSheet.tsx` nested `role="dialog"` — an inner labeled `Box[role=dialog]` sat inside MUI `Dialog`'s own `role="dialog"` Paper. Fixed: inner role only render for the compact/Drawer variant; the Dialog/pointer variant is named via `slotProps.paper['aria-label']`. `getAllByRole('dialog')` single-match tests added to both.
  - `[medium]` `[patch]` `ItemRowBase.tsx` `onActivate` button's accessible name concatenated title+hint+description, unbounded and fragile for locators. Fixed: `aria-label` is title-only; hint/description stay visible but out of the accessible name.
  - `[low]` `[patch]` `epic-15-context.md` still claimed M11 "not implemented" after this diff implements it. Fixed: both mentions updated with a historical note.
  - `[low]` `[patch]` `braindump/serializers.py` docstring attributed field optionality to `partial=True`, but it's `required=False` per field that actually does it (`partial=True` is inert here). Fixed: docstring corrected.
  - `[low]` `[patch]` `braindump/tests/test_views.py` had no view-level test for `PATCH` with an empty body `{}`. Fixed: `test_patch_item_corpo_vazio_retorna_200_e_nao_altera_nada` added, passes.
  - `[low]` `[patch]` `shellRouting.test.ts`'s new `brain-dump` migration test skipped the companion "another route stays false" guard every sibling test in the file uses. Fixed: companion `settings → false` assertion added.
  - `[low]` `[patch]` `BrainDumpInboxItemRow.tsx` (and the same lookup in `BrainDumpItemSheet.tsx`, same bug class, fixed alongside) had no fallback for an out-of-enum `targetLog`, which would render `Dica: undefined`. Fixed: `?? null` fallback skips the hint chip instead.
  - `[medium]` `[patch]` `BrainDumpDestinationPicker.tsx` never read `useTodayLogQuery`'s loading/error state, leaving `todayIso`/`currentMonthFirst`/`weekStart` silently `null`. Fixed: visible loading/error+retry states added, scoped to the week/month/future branches that depend on it ("Hoje" stays immediately usable); 2 new tests.
  - `[medium]` `[patch]` `BrainDumpInboxCaptureForm.tsx` didn't refocus Título after a successful capture, breaking the established "clear + keep focus for the next entry" convention already implemented in `BrainDumpCaptureSheet.tsx`. Fixed: refocuses via ref on success; regression test added.
  - `[medium]` `[patch]` `BrainDumpDestinationPicker.tsx`'s "Este Mês" destination branch (density calendar, day pick, confirm, POST payload) had zero test coverage despite being half of I/O matrix row 9. Fixed: full unit test added (select Este Mês → pick day → confirm → assert POST body).
  - `[medium]` `[patch]` No test asserted the exact `scheduledDate` sent in the POST body against the day actually clicked (only e2e outcome — item disappeared — was checked, which wouldn't catch a silently-dropped `scheduledDate`). Fixed: unit test added asserting the exact `scheduledDate` for a specific-day "Esta Semana" confirm.

### 2026-07-30 — Review pass (follow-up)
- intent_gap: 0
- bad_spec: 0
- patch: 7 (high 0, medium 3, low 4)
- defer: 1 (high 0, medium 1, low 0)
- reject: 12 (high 0, medium 0, low 12)
- addressed_findings:
  - `[medium]` `[patch]` The "Mover" destination-picker overlay had NO focus-restore at all when closed — neither from the row's direct "Mover" trailing button nor from the sheet's "Mover para um log" chain (`handleMoveFromSheet` discarded `editingTriggerRef` instead of transferring it); `handleDiscardFromSheet` also bypassed the focus-safe `closeEditSheet`. Fixed: added `movingTriggerRef` mirroring `editingTriggerRef`, a `closeMovePicker` restore function, `handleMove` capture on the row path, ref-transfer in `handleMoveFromSheet`, and routed `handleDiscardFromSheet` through `closeEditSheet`. 3 new focus-assertion tests added in `BrainDumpInboxPage.test.tsx`.
  - `[medium]` `[patch]` `BrainDumpItemSheet`'s Fechar/Escape/backdrop-close had no guard against an in-flight Save — confirming "Descartar alterações?" while `updateItem.isPending` unmounts the sheet without cancelling the already-dispatched PATCH (`useMutation` doesn't abort on unmount), so a "discarded" edit could still land server-side. Fixed: `requestClose` now no-ops while `updateItem.isPending`.
  - `[medium]` `[patch]` `BrainDumpDestinationPicker.test.tsx` had zero coverage of the `compact`/Drawer variant (the mobile-first rendering path) and zero coverage of the offline-`disabled` gating required by the I/O Matrix. Fixed: added a compact-variant render/role="dialog"/jest-axe test and an offline-disabled test.
  - `[low]` `[patch]` `BrainDumpInboxItemRow`'s Descartar button (and, by the same gap, the sheet's compact "Descartar item") had no `isPending` guard, unlike every other write action in this diff — a fast double-click on the row's Descartar could fire two DELETE requests, with the second 404ing and surfacing a false failure banner despite the first succeeding. Fixed: added a per-item `discarding` prop (`discardItem.isPending && discardItem.variables?.itemId === item.id`) gating the row's Descartar button.
  - `[low]` `[patch]` `BrainDumpItemSheet`'s Salvar button gave no disabled/visual signal for an invalid (blank) title — functionally safe (`handleSave` already blocked it) but inconsistent with Capturar's `!title.trim()` disable. Fixed: added `Boolean(titleError)` to Salvar's `disabled` expression; updated the existing "título vazio" test to match (button disabled instead of clickable-but-blocked) and to assert the inline error via blur.
  - `[low]` `[patch]` No backend test asserted `PATCH {"title": ""}` → 400, despite `allow_blank=False` being the only server-side enforcement against blanking a title. Fixed: added `test_patch_item_title_vazio_retorna_400` and the matching serializer-level test.
  - `[low]` `[patch]` No test verified focus actually returns to the row's `onActivate` trigger after a successful Save (I/O Matrix: "sheet fecha, foco volta ao acionador") — `BrainDumpInboxPage.test.tsx` mocked the sheet as a plain div, and neither the sheet's own tests nor the e2e suite asserted it. Fixed: covered by the same 3 new focus-assertion tests added for the Mover-overlay fix above.
  - (Incidental, found while re-running Verification, unrelated to any reviewer finding) `[low]` `[patch]` `BrainDumpItemSheet.test.tsx`'s timezone regression test used an exact-text match against a meta line that always includes the item's destination hint suffix (`ITEM.targetLog = 'week'` → "· Dica: Esta Semana"), so the assertion never actually matched and the test had been silently broken since it was authored — never caught because CI doesn't run vitest (already-deferred, see frontmatter). Fixed: matcher now checks the full combined text.

## Design Notes

**Sheet de item responsivo** (`BrainDumpItemSheet.tsx`): DESIGN.md L671 diz que no compact "as ações [Mover, Descartar] migram para o sheet de item, incluindo os campos de edição"; EXPERIENCE.md L380 descreve o "sheet de edição" como aberto por tap na linha, com a linha "mantendo as duas ações inline no ponteiro". Síntese: é o MESMO componente, responsivo — no compact ele reúne Mover + Descartar + os 3 campos de edição (porque os botões trailing não existem nessa faixa); no ponteiro (wide/medium/tablet) ele expõe só os campos de edição, porque Mover/Descartar já são botões trailing sempre visíveis na linha. Confirmação de descarte usa dirty-check (valor atual ≠ valor carregado), nunca "tem texto" (que é o estado normal de um item existente) — diferente do Capture Sheet.

**`ItemRowBase.onActivate`**: o comentário do arquivo já reserva este ponto de extensão para o Épico 15 ("se precisar do título acionável, a prop nasce lá, com consumidor de produção real") — não é invenção desta spec, é o uso pretendido. Manter a prop opcional (default: título não é controle) preserva o consumidor atual (Recorrentes, 14.8) inalterado.

**`updated_at`**: o padrão de `Task._apply_fields` salva com `update_fields=[...,"updated_at"]`, mas `BrainDumpItem` não tem esse campo e nenhum requisito de produto pede timestamp de edição visível. `update_brain_dump_item` deve salvar só com `update_fields=list(fields)`, sem adicionar migração nova — ver Block If se essa suposição se provar errada em runtime.

## Verification

**Commands:**
- `cd backend && uv run pytest braindump bujo` -- expected: todos passam, incluindo os testes novos do PATCH e nenhuma regressão em `bujo` (isolamento de tenant, `TaskDetailView.patch` como referência).
- `cd backend && uv run ruff check . && uv run lint-imports` -- expected: limpo.
- `cd backend && uv run python manage.py spectacular --file ../schema.yaml` -- expected: roda sem erro, `schema.yaml` inclui o PATCH novo.
- `cd frontend && npm run generate-types && git diff --exit-code src/api/types.gen.ts` -- expected: tipos gerados batem com o que foi commitado (mesmo gate do CI).
- `cd frontend && npx tsc --noEmit && npx eslint . && npx vitest run src/features/braindump src/features/bujo/components/ItemRowBase.test.tsx src/pages/braindump` -- expected: sem erro de tipo/lint, testes novos e existentes passam (inclui `jest-axe` por componente).
- `cd frontend && npx playwright test unified-migration-queue.spec.ts` -- expected: continua verde, prova que a extensão do `DestinationPicker`/reuso não regrediu o ritual de migração (M10).

**Manual checks (if no CLI):**
- Abrir `/brain-dump` em wide e compact: confirmar ordem captura → pendências → lista, chip de dica de destino, meta de `created_at`, e o comportamento responsivo do sheet de item descrito nas Design Notes.

## Auto Run Result

**Resumo:** Implementado o endpoint M11 (`PATCH /api/brain-dump/items/{id}/`) e a página Inbox do Brain Dump no sistema novo — captura, listagem (variante Item Row), edição paritária via sheet responsivo e processamento (Mover via seletor de destino com radiogroup de 4 destinos reusando a anatomia do M10, e Descartar) — com a rota `/brain-dump` migrada e `shellRouting.ts` marcando a superfície como concluída. Duas passadas de review (adversarial + edge-case + verification-gap + intent-alignment) já rodaram sobre o diff completo: a primeira corrigiu 12 achados; esta segunda passada (follow-up, recomendada pela primeira) corrigiu mais 7 — sobretudo restauração de foco ausente no seletor "Mover" (nenhuma existia antes, em nenhum dos dois caminhos de abertura) e uma janela em que "Descartar alterações?" não cancelava um Salvar já em voo.

**Arquivos alterados (cumulativo das duas passadas):**
- `backend/braindump/serializers.py` — `BrainDumpItemUpdateSerializer` (M11).
- `backend/braindump/services.py` — `update_brain_dump_item`.
- `backend/braindump/views.py` — `BrainDumpItemDetailView.patch`.
- `backend/braindump/tests/test_serializers.py`, `test_views.py` — cobertura da I/O Matrix do PATCH (parcial, completo, inválido, corpo vazio, título vazio, 404 próprio/outro tenant).
- `schema.yaml`, `frontend/src/api/types.gen.ts` — regenerados para incluir o M11 (sem drift nesta passada — nenhuma mudança de contrato).
- `frontend/src/features/braindump/api.ts` — `useUpdateBrainDumpItemMutation` (não-otimista).
- `frontend/src/features/braindump/index.ts` — export dos componentes/hooks novos.
- `frontend/src/features/bujo/components/ItemRowBase.tsx` — prop `onActivate` (extensão aditiva prevista para o Épico 15).
- `frontend/src/features/braindump/components/BrainDumpInboxCaptureForm.tsx` (novo) — Panel Capturar com tokens.
- `frontend/src/features/braindump/components/BrainDumpInboxItemRow.tsx` (novo) — variante Brain Dump do Item Row; **nesta passada:** prop `discarding` guarda Descartar contra duplo-clique.
- `frontend/src/features/braindump/components/BrainDumpItemSheet.tsx` (novo) — sheet responsivo de edição/ações; **nesta passada:** `requestClose` bloqueia durante Salvar pendente; Salvar reflete título inválido no `disabled`.
- `frontend/src/features/braindump/components/BrainDumpDestinationPicker.tsx` (novo) — seletor de destino em radiogroup, reuso da anatomia do M10.
- `frontend/src/pages/braindump/BrainDumpInboxPage.tsx` (novo) — página Inbox do sistema novo; **nesta passada:** `movingTriggerRef`/`closeMovePicker` restauram foco ao fechar "Mover" (linha e encadeamento a partir do sheet), `handleDiscardFromSheet` passa a usar `closeEditSheet`.
- `frontend/src/app/router.tsx` — rota `brain-dump` aponta para `BrainDumpInboxPage`.
- `frontend/src/app/layout/shell/shellRouting.ts` — `surfaceMigrated: true` para `brain-dump`.
- `frontend/e2e/brain-dump.spec.ts` — locators/asserções atualizados para o DOM novo (suíte legada da Story 5.1, quebrada pela troca de página).
- `frontend/e2e/brain-dump-inbox.spec.ts` (novo) — cobertura e2e de edição do item e `scheduled_date` real em Esta Semana.
- `_bmad-output/implementation-artifacts/epic-15-context.md` (novo, compilado na primeira passada) — contexto do Épico 15.
- Arquivos `*.test.tsx`/`*.test.ts` colocados para cada componente/hook novo ou alterado; **nesta passada:** testes novos de foco (`BrainDumpInboxPage.test.tsx`), compact/offline (`BrainDumpDestinationPicker.test.tsx`), título vazio (`BrainDumpItemSheet.test.tsx`, atualizado), e o backend (`test_serializers.py`/`test_views.py`); corrigido também um matcher de texto exato pré-existente e quebrado (`BrainDumpItemSheet.test.tsx`, teste de fuso-horário) encontrado ao rodar a verificação.

**Review — achados desta passada (follow-up, 2026-07-30):**
- 7 `patch` (0 high, 3 medium, 4 low) — todos corrigidos nesta execução (ver Review Triage Log acima para o detalhe de cada um).
- 1 `defer` (0 high, 1 medium, 0 low) — corrida herdada do M10 no atalho de Enter dos seletores de destino, já presente e sem alteração em `DestinationPicker.tsx` de produção; registrada em `deferred` no frontmatter e no ledger `deferred-work.md`.
- 12 `reject` — ruído (duas tecnologias de `<select>` para "Destino" sem evidência de ser bug — plausível escolha deliberada nativa para toque; tema claro hardcoded, mas replicando um padrão já presente em 9+ arquivos de produção; parâmetro `user` não lido em `update_brain_dump_item`, mesmo padrão das funções irmãs; radios interativos durante requisição em voo sem efeito no payload já disparado; toggle "Sem dia definido" clicável durante erro do mês corrente sem conseguir confirmar mesmo assim; stacking vertical de botões no sheet compact — decisão de produto explícita de "sem dialog, sem desfazer"; `writeError` não limpo ao editar/reselecionar — limpa no próximo envio, padrão aceito; "motivo no nome acessível" offline — confirmado como convenção já estabelecida em `FutureBoardPage.tsx`, não uma divergência desta story; contagem do badge após Mover sem e2e dedicado — especulativo; tensão textual Never-bullet vs. Approach sobre a rota — resolvida por precedente de 14.8/14.10 + task explícita do Code Map).
- 0 `intent_gap`, 0 `bad_spec`.

**Recomendação de nova revisão:** `true` — 3 patches medium + 4 low nesta passada (`3×3 + 1×4 = 13 ≥ 5`).

**Verificação realizada (nesta passada, sobre o diff completo desde `baseline_revision`):**
- `cd backend && uv run pytest braindump bujo` — 729 passed.
- `cd backend && uv run ruff check . && uv run lint-imports` — limpos.
- `cd backend && uv run python manage.py spectacular --file ../schema.yaml` — sem diff em `schema.yaml` (nenhuma mudança de contrato nesta passada).
- `cd frontend && npm run generate-types && git diff --exit-code src/api/types.gen.ts` — sem drift.
- `cd frontend && npx tsc --noEmit && npx eslint . && npx vitest run src/features/braindump src/features/bujo/components/ItemRowBase.test.tsx src/pages/braindump` — limpos; 144/144 testes passando (13 arquivos).
- `cd frontend && npx playwright test unified-migration-queue.spec.ts brain-dump.spec.ts brain-dump-inbox.spec.ts` — 18/18 passed (prova que o M10/`DestinationPicker.tsx` e a suíte legada não regrediram).
- `makemigrations --check --dry-run` — nenhuma migração pendente (esta passada não alterou modelos).

**Riscos residuais:**
- A corrida do Enter global nos seletores de destino (defer, medium) permanece — inherente ao padrão herdado do M10, fora do escopo desta story para corrigir na raiz; ver `deferred-work.md`.
- `handleDiscardFromSheet` restaura foco via `closeEditSheet` para um nó que está prestes a ser removido da lista (o item some após o DELETE); o `.focus()` síncrono ainda é chamado sobre o nó que existe no momento — comportamento consistente com o já aceito para Descartar direto na linha, sem tratamento especial em nenhum dos dois lugares.

