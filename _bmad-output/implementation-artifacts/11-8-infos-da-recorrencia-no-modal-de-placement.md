---
baseline_commit: d6ddd17
---

# Story 11.8: Infos da recorrência no modal de placement

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Como Hugo,
Quero ver as informações da recorrência (etiqueta Eisenhower, além da descrição e `recurrence_text` que o modal já mostra) no modal de placement,
Para que eu decida o encaixe com contexto completo (fecha o bug remanescente da Story 11.3: o modal não exibia a prioridade Eisenhower do template).

## Acceptance Criteria

> **⚠️ Leia o Diagnóstico (Dev Notes) antes de implementar.** O texto do épico pede exibir "descrição, categoria, etiqueta Eisenhower e `recurrence_text`". **Duas dessas já estão exibidas** (descrição e `recurrence_text`, desde a 11.3) e **`categoria` não existe em templates** (nem no modelo, nem no serializer, nem no contrato, nem no CRUD de template). O gap real e implementável nesta story é **a etiqueta Eisenhower**. Categoria é tratada explicitamente na AC4 (decisão + questão aberta), não como trabalho de frontend.

### AC1 — Etiqueta Eisenhower passa a aparecer no modal de placement

- **Dado que** o modal de placement de um recorrente (`RecurringPlacementDialog`, Story 11.3) com um template que tem prioridade Eisenhower definida (`ui` / `u` / `i`),
- **Quando** o modal abre,
- **Então** exibe a **etiqueta Eisenhower** do template (ex.: "Urgente + Importante") dentro do bloco de infos já existente, junto de título, descrição e "Recorrência: …" que já são mostrados.

### AC2 — Sem regressão no que a 11.3 já entregou; vale nas 3 superfícies

- **Dado que** o mesmo `RecurringPlacementDialog` é compartilhado por **Esta Semana** (`WeeklyPage`, `dateFieldType="date"`), **Este Mês** (`MonthlyPage`, `dateFieldType="day"`) e **Future Log** (`FuturePage`, anuais — Story 11.4),
- **Então** título, descrição, "Recorrência: `recurrence_text`" e o calendário de densidade (`MonthDensityCalendar`) continuam exibidos exatamente como hoje, e a etiqueta Eisenhower passa a valer para **as três superfícies de uma vez** (é um único componente — nenhuma delas é tocada individualmente).

### AC3 — Regra de nulos: campo ausente não aparece (sem placeholder ruidoso)

- **Dado que** um template **sem** prioridade Eisenhower — valor `none`, `""` (blank) ou `null`,
- **Então** a linha de Eisenhower **simplesmente não aparece** (nada de "Prioridade: Nenhum" nem chip vazio). `none`/`""`/`null` são todos tratados como "sem prioridade", **exatamente** como `TaskRow.eisenhowerChipInfo` e o `Select` de `TaskDetailPanel` já fazem (só `ui`/`u`/`i` são exibíveis). A descrição, que já segue essa regra hoje (`{template.description && …}`, `RecurringPlacementDialog.tsx:55`), permanece igual.

### AC4 — Categoria: estruturalmente ausente em templates → não é exibida (decisão registrada)

- **Dado que** `RecurringTaskTemplate` **não possui** campo `category` (confirmado: `backend/bujo/models.py:174-196` não declara `category`; `RecurringTaskTemplateSerializer` `serializers.py:253-264` não o lista; o tipo gerado `types.gen.ts:496-505` não o tem; e o CRUD de template `RecurringTemplateManager` só oferece Eisenhower, nunca categoria),
- **Então** categoria **não aparece** no modal — o que satisfaz por construção a própria regra de nulos da AC3 (campo ausente não aparece). **Adicionar** categoria a templates seria mudança de modelo + migração + serializers + regeneração de contrato + input no CRUD de template + cópia no snapshot de placement — **fora do escopo** desta story (que corrige um bug de frontend da 11.3; ver AD-08, catálogo de templates deliberadamente mínimo). Registrado como **questão aberta ao Hugo** ao final desta story.

## Tasks / Subtasks

> **Escopo real (confirmado por leitura do código atual):** frente **única de frontend**, num único componente compartilhado (`RecurringPlacementDialog.tsx`). **Sem backend, sem mudança de contrato, sem dependência nova, sem migração.** O bug NÃO é de fiação de dados (o template chega completo ao componente — `WeeklyPage.tsx:219` / `MonthlyPage.tsx:233` / `FuturePage.tsx:169` passam `template={placing…Template}`, objeto inteiro): é que o bloco de infos do modal (`RecurringPlacementDialog.tsx:50-64`) renderiza título + descrição + `recurrenceText`, mas **nunca renderiza `eisenhower`**.

### Frontend — o trabalho todo (arquivo único)

- [x] **Task 1: Exibir a etiqueta Eisenhower no bloco de infos do `RecurringPlacementDialog`** (AC1, AC2, AC3)
  - [x] 1.1 Em `frontend/src/features/bujo/components/RecurringPlacementDialog.tsx`, adicionar um mapa de rótulo local espelhando o padrão já existente no projeto (`TaskDetailPanel.tsx:28-33` e `RecurringTemplateManager.tsx:29-34` — ambos já duplicam esse mapa localmente; seguir a mesma convenção, **não** inventar um módulo compartilhado nesta story pequena):
    ```tsx
    const EISENHOWER_LABEL: Record<'ui' | 'u' | 'i', string> = {
      ui: 'Urgente + Importante',
      u: 'Urgente',
      i: 'Importante',
    }
    ```
    Só os 3 valores exibíveis (`ui`/`u`/`i`) — `none`/`""`/`null` não entram no mapa (regra de nulos, AC3).
  - [x] 1.2 Dentro do bloco `{template && ( … )}` (`RecurringPlacementDialog.tsx:50-64`), **depois** da linha "Recorrência: …" (`:60-62`), adicionar a etiqueta Eisenhower **condicionada** a ser uma prioridade real:
    ```tsx
    {template.eisenhower && template.eisenhower in EISENHOWER_LABEL && (
      <Typography variant="body-sm" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
        Prioridade: {EISENHOWER_LABEL[template.eisenhower as 'ui' | 'u' | 'i']}
      </Typography>
    )}
    ```
    O guard `template.eisenhower in EISENHOWER_LABEL` cobre `none`/`""`/`null` de uma vez (nenhum deles é chave do mapa) — mesma equivalência que `TaskRow.eisenhowerChipInfo` (`TaskRow.tsx:50-54`) e o filtro `!== 'none'` de `TaskDetailPanel` (`:145`) já aplicam. **Manter o mesmo estilo tipográfico** das linhas vizinhas (`variant="body-sm"`, `color="text.secondary"`, `component="div"`, `sx={{ mt: 0.5 }}`) para não introduzir um visual novo.
  - [x] 1.3 **Não alterar** o resto do bloco: título (`:52-54`), descrição condicional (`:55-59`), linha "Recorrência: …" (`:60-62`), o `TextField` de data/dia (`:66-84`) e o `MonthDensityCalendar` (`:86`) permanecem idênticos (AC2). Nada de mexer em `handleConfirm`/`handleClose`/`useTaskDensityQuery`.

- [x] **Task 2: Confirmar (sem alterar) que categoria é estruturalmente ausente e que os dados já chegam completos** (AC4, AC2)
  - [x] 2.1 **Nenhuma mudança de backend/contrato.** Confirmar por leitura que `RecurringTaskTemplate` não tem `category`: modelo `backend/bujo/models.py:174-196`, serializer `backend/bujo/serializers.py:253-264`, tipo gerado `frontend/src/api/types.gen.ts:496-505`. Portanto **não** adicionar `category` ao modal (AC4). Se aparecer qualquer diff em `schema.yaml`/`types.gen.ts` no `git diff`, algo saiu do escopo — investigar antes de commitar.
  - [x] 2.2 Confirmar por leitura que o template chega inteiro ao componente (nada a corrigir na fiação): `RecurringPlacementSection` (`RecurringPlacementSection.tsx:81`) chama `onPlace(template)` com o objeto completo; as 3 páginas guardam em estado e passam `template={placing…Template}` (`WeeklyPage.tsx:213,219`; `MonthlyPage.tsx:227,233`; `FuturePage.tsx:169`). O gap era puramente de renderização, não de dados.

### Testes & Verificação

- [x] **Task 3: Estender os testes de `RecurringPlacementDialog`** (AC1, AC3)
  - [x] 3.1 Em `frontend/src/features/bujo/components/RecurringPlacementDialog.test.tsx`, o `TEMPLATE` de fixture tem hoje `eisenhower: null` (`:21`). **Não** trocar o default (mantém verde o teste de a11y e os de coleta). Adicionar testes novos:
    - **Eisenhower exibido quando definido:** renderizar com `template={{ ...TEMPLATE, eisenhower: 'ui' }}` → `expect(screen.getByText('Prioridade: Urgente + Importante')).toBeInTheDocument()`. Cobrir também `'u'` → "Urgente" e `'i'` → "Importante" (pode ser um `it.each`).
    - **Eisenhower NÃO exibido quando ausente (AC3):** com o `TEMPLATE` default (`eisenhower: null`) → `expect(screen.queryByText(/Prioridade:/)).not.toBeInTheDocument()`. Idem para `eisenhower: 'none'` e `eisenhower: ''` (blank) — nenhum renderiza a linha.
  - [x] 3.2 **Manter intactos** os testes existentes (`RecurringPlacementDialog.test.tsx`): "exibe título, descrição e recorrência" (`:58-64`), calendário de densidade (`:66-72`), `enabled: open` (`:74-78`), coleta de data/dia (`:80-96`), "sem template não renderiza o bloco" (`:98-104`) e **o teste jest-axe contra o componente real** (`:106-111` — nunca mockar o componente sob teste de a11y; lição recorrente 3.3→11.7). O teste "exibe título, descrição e recorrência" segue válido sem mudança — a nova linha de prioridade só aparece quando `eisenhower` é real, e o `TEMPLATE` default é `null`.

- [x] **Task 4: Verificação** (AC1, AC2, AC3, AC4)
  - [x] 4.1 `npm run typecheck && npm run lint && npm run build && npx vitest run --no-file-parallelism` (Node 22, `nvm use 22`) — todos verdes, **contagem real colada** (guardrail retro Epic 3 §1). `--no-file-parallelism` obrigatório (lição recorrente 11.2→11.7). Baseline de sanidade da 11.7: **frontend 478 passed (45 arquivos)**; esta story só adiciona testes ao `RecurringPlacementDialog.test.tsx` → a contagem sobe pelo nº de casos novos; colar o número real.
  - [x] 4.2 **Contrato inalterado (como na 11.7):** confirmar que `git diff` **não** inclui `backend/bujo/schema.yaml` (ou onde o schema mora) nem `frontend/src/api/types.gen.ts` — esta story não toca endpoint/serializer/modelo nenhum. Não precisa rodar a regeneração; só garantir que o diff não os inclui. Backend intocado → **não** rodar `pytest` (nada de backend mudou; baseline 11.7 era 360 passed, não deve mudar).
  - [x] 4.3 **Verificação manual mínima** (a superfície é a mesma nas 3 páginas — o componente é compartilhado): abrir o modal de placement em **Esta Semana** com um recorrente que tenha Eisenhower definido → a linha "Prioridade: …" aparece junto de descrição e recorrência; abrir com um recorrente **sem** Eisenhower → a linha não aparece. Não é necessário repetir manualmente em Mês/Future: é literalmente o mesmo `RecurringPlacementDialog` já exercitado (mesma decisão de cobertura da 11.7 sobre o Daily).
  - [x] 4.4 **File List por último** (retro Epic 3 §8-2) — reconciliar contra `git status --short` / `git diff --stat` reais. Guardrails ativos em `_bmad/custom/bmad-dev-story.toml`.
  - [x] 4.5 **e2e:** não há passo de placement que valide as infos do modal em `frontend/e2e/` que precise mudar (o placement é exercitado nos e2e de recorrentes, mas por título/data, não por Eisenhower). **Não** adicionar e2e novo só para isso — o teste de componente é a fonte de verdade da renderização do modal (mesma divisão de responsabilidade da 11.7 Task 4.1). Se o dev encontrar um e2e que assere o conteúdo do modal e quebre por causa da linha nova, ajustar o seletor; caso contrário, sem mudança em `e2e/`.

## Dev Notes

### Diagnóstico — o que realmente falta no modal (e o que já está lá)

O modal `RecurringPlacementDialog` foi construído na **Story 11.3** e **já exibe** (confirmado no código `RecurringPlacementDialog.tsx:50-64` **e** no teste `RecurringPlacementDialog.test.tsx:58-64`):

1. **título** (`template.title`, `:52-54`) ✓
2. **descrição** (condicional, `{template.description && …}`, `:55-59`) ✓ — já respeita a regra de nulos
3. **"Recorrência: `recurrence_text`"** (`:60-62`) ✓
4. **calendário de densidade** (`MonthDensityCalendar`, `:86`) ✓

O texto do épico ("Falta exibir as informações da task no modal - descrição, categoria, eisenhower, etc." — `docs/futureIdeas.md:26`) foi escrito assumindo que o template teria os **mesmos campos de uma `Task`**. Não tem. Cruzando o pedido do épico com a realidade do código:

| Campo pedido na AC | Situação real | Ação nesta story |
|---|---|---|
| descrição | **já exibida** (11.3) | manter (AC2) |
| `recurrence_text` | **já exibida** (11.3) | manter (AC2) |
| **etiqueta Eisenhower** | **NÃO exibida** — é o gap real | **adicionar** (AC1) |
| categoria | **não existe em `RecurringTaskTemplate`** | não exibir; questão aberta (AC4) |

**Correção:** uma única linha condicional de Eisenhower no bloco de infos já existente. É isso. Não há nada de fiação de dados a corrigir (o template chega completo — Task 2.2).

### Categoria não existe em templates — prova e decisão (AC4)

`RecurringTaskTemplate` é um catálogo deliberadamente mínimo (AD-08): `title`, `description`, `eisenhower`, `recurrence_group`, `recurrence_text`, `active`. **Nunca teve `category`.** Contraste com `Task`, que tem `category` (`CategoryEnum`: teal/purple/pink/yellow/green/blue). Provas:

- **Modelo:** `backend/bujo/models.py:174-196` — declara `eisenhower` (`:186-188`) mas **não** declara `category`.
- **Serializer:** `RecurringTaskTemplateSerializer.Meta.fields` (`backend/bujo/serializers.py:256-264`) lista `id, title, description, eisenhower, recurrence_group, recurrence_text, active` — **sem** `category`.
- **Contrato gerado:** `frontend/src/api/types.gen.ts:496-505` — `RecurringTaskTemplate` não tem `category` (só `Task`, `:540`, tem).
- **CRUD de template:** `RecurringTemplateManager` (Story 11.2) oferece formulário de criação/edição com título, descrição, **Eisenhower** e `recurrence_text` (`RecurringTemplateManager.tsx:211-233`) — **nunca** um seletor de categoria.

Logo, exibir categoria é **impossível sem inventar dado que não existe**. Fazê-la existir é uma cadeia grande e fora do escopo de um bugfix de frontend: campo no modelo + migração + `RecurringTaskTemplateSerializer`/`…Create`/`…Update` + regeneração de `schema.yaml`/`types.gen.ts` + input no `RecurringTemplateManager` + cópia no snapshot do endpoint de placement. Isso é uma **story própria** (backend-first), não a 11.8. Por ora, categoria "não aparece" — o que, ironicamente, já satisfaz a regra de nulos que a própria AC pede.

> **QUESTÃO ABERTA para o Hugo (não bloqueia o dev):** você quer que templates recorrentes passem a ter **categoria** (como as tasks têm), o que puxaria backend + migração + contrato + CRUD + snapshot? Se sim, isso vira uma story separada (candidata ao 3º lote / Épico 11 ou ao backlog). Se não, a AC4 fica como está: categoria não se aplica a templates. Esta memória do projeto — *"Perguntar em vez de assumir fluxos"* — é justamente por isso que estou registrando em vez de silenciosamente adicionar um campo de backend.

### Como exibir Eisenhower — reusar padrão, não inventar

Há dois padrões no projeto para mostrar Eisenhower:

1. **Texto** — mapa `EISENHOWER_LABEL` (`ui`→"Urgente + Importante", `u`→"Urgente", `i`→"Importante"), duplicado hoje em `TaskDetailPanel.tsx:28-33` e `RecurringTemplateManager.tsx:29-34`.
2. **Chip colorido** — `TaskRow.eisenhowerChipInfo` (`TaskRow.tsx:50-54`, rótulos curtos "U+I"/"U"/"I" + cor de `theme.palette.priority`).

**Decisão desta story: usar o padrão de texto (opção 1).** Motivos: (a) o bloco de infos do modal já é uma pilha de `Typography` descritiva ("Recorrência: …") — uma linha "Prioridade: …" é coerente e não introduz visual novo; (b) o Chip exigiria extrair/exportar `eisenhowerChipInfo` (hoje é função privada dentro de `TaskRow.tsx`) e plumbar cor de tema — surface maior para ganho estético marginal num modal informativo. *(Chip é uma variante aceitável se o dev preferir paridade visual, mas **não é requerido** — priorize a mudança mínima e decisiva.)*

Sobre duplicar o mapa: os dois usos existentes **já** o duplicam localmente. Adicionar uma 3ª cópia de 3 linhas segue a convenção vigente e é a escolha de menor risco para um bugfix. Extrair um módulo compartilhado (`eisenhowerLabels.ts`) seria uma limpeza legítima, mas é **scope creep** aqui — deixar como possível follow-up, não fazer nesta story.

### Valores de Eisenhower e a regra de nulos (AC3)

`EisenhowerEnum` = `"ui" | "u" | "i" | "none"`; além disso o campo aceita `BlankEnum` (`""`) e `NullEnum`/`null`. Convenção app-wide (não reinventar): **só `ui`/`u`/`i` são "prioridade real"**; `none`, `""` e `null` significam "sem prioridade" e **não** renderizam nada (`TaskRow.eisenhowerChipInfo` retorna `undefined` para eles, `TaskRow.tsx:50-54`; `TaskDetailPanel` filtra `!== 'none'`, `:145`). O guard `template.eisenhower in EISENHOWER_LABEL` (Task 1.2) cobre os três casos de uma vez, porque nenhum deles é chave do mapa de 3 entradas.

### Componente compartilhado → correção nas 3 superfícies (AC2)

Igual ao que a 11.7 explorou com o `TaskDetailPanel`: `RecurringPlacementDialog` é uma instância única importada por `WeeklyPage` (`:216`, `dateFieldType="date"`), `MonthlyPage` (`:230`, `dateFieldType="day"`) e `FuturePage` (`:166`, anuais — Story 11.4). Mexer no componente conserta o placement de Semana, Mês **e** Future de uma vez. Nenhuma página precisa ser tocada — e os testes de página (que só verificam que o diálogo abre) devem seguir verdes sem mudança de seletor.

### O que NÃO fazer nesta story (fora de escopo, registrado)

- **Não** adicionar `category` a `RecurringTaskTemplate` (modelo/serializer/contrato/CRUD/snapshot) — é backend + contrato, fora do escopo; ver AC4 e a questão aberta. Se `git diff` mostrar `schema.yaml`/`types.gen.ts`, saiu do escopo.
- **Não** mexer em backend, serializer, view, `urls.py`, `api.ts`, `keys.ts`. Zero mudança de contrato (Task 4.2).
- **Não** trocar o `Typography` do bloco por Chip como requisito (é variante opcional, não obrigatória — Dev Notes acima).
- **Não** extrair um módulo compartilhado de `EISENHOWER_LABEL` nesta story (scope creep; a duplicação local é a convenção atual).
- **Não** tocar em `MonthDensityCalendar`, na coleta de data/dia, ou na dedup/densidade da 11.3 — só o bloco de infos textuais muda.
- **Não** adicionar toast/snackbar nem qualquer feedback novo — não há esse padrão e nada aqui pede.

### Previous Story Intelligence (11.7 — done)

- **Stack (sem dependência nova aqui):** Frontend Node 22 + Vite + React 19 + MUI 6.1 + TanStack Query 5.59 + Vitest + jest-axe. Backend intocado nesta story.
- **Node 22 obrigatório** (`nvm use 22`); `vitest run --no-file-parallelism`; Playwright (se rodar) `--workers=1` por cold-start da branch Neon `e2e` (lição recorrente 11.2→11.7 / retro Epic 4 ação #4). Esta story provavelmente **não** precisa de e2e (Task 4.5).
- **jest-axe só vale contra o componente real** — o teste de a11y de `RecurringPlacementDialog` (`:106-111`) usa `axe(document.body)` porque o conteúdo do `Dialog` do MUI é portalado; **manter** e não mockar o componente sob teste.
- **Contagem de testes sempre real** (retro Epic 3 §1); **File List por último** (retro Epic 3 §8-2). Guardrails em `_bmad/custom/bmad-dev-story.toml`.
- **Lição de spec da 11.7 (repete aqui):** a AC do épico descrevia o trabalho assumindo campos que o código já tinha (11.7: mutação/invalidação já corretas; o gap era só UI). Aqui é o mesmo padrão — descrição/`recurrence_text` já exibidas; o gap real é só Eisenhower, e "categoria" é uma suposição de campo inexistente. Confirmar contra o código, não contra o texto da AC.
- **AR-22 (observabilidade) segue pendente e sem dono há 4 épicos** — não bloqueia esta story, mas continua o pior follow-through do projeto (escalar antes do Épico 5, conforme memória do projeto).
- Contagens da 11.7 (baseline de sanidade): backend `pytest` 360 passed; frontend `vitest` **478 passed (45 arquivos)**; `RecurringPlacementDialog.test.tsx` = 7 testes. Esta story só mexe em frontend (um componente + seu teste) → backend não muda; frontend sobe pelos casos novos de Eisenhower.

### Git Intelligence

- Branch `main`; HEAD em `d6ddd17` (`feat(story-11.7): Edição de tarefa persiste em Esta Semana / Este Mês`) — `baseline_commit` desta story. Commits recentes do 2º lote: `11.7` (d6ddd17), retro/fechamento (8490e8e), `11.6` (899666e, adicionou "Mover"/`TaskDestinationDialog`), `11.5` (2819951, Excluir/Cancelar + invalidação de `weeklyLog`), `11.4` (61d0806, anuais no Future Log — trouxe `FuturePage` como 3º consumidor do `RecurringPlacementDialog`). Convenção de commit: `feat(story-11.8): <descrição em pt-BR>`.
- `git diff --stat` esperado (frontend-only, arquivo único + teste): `frontend/src/features/bujo/components/RecurringPlacementDialog.tsx` (+mapa `EISENHOWER_LABEL`, +linha condicional de prioridade) e `frontend/src/features/bujo/components/RecurringPlacementDialog.test.tsx` (+testes de Eisenhower presente/ausente). **Nada** de backend, `api.ts`, `schema.yaml`, `types.gen.ts`, nem das páginas do planner.
- **Working tree atual:** `_bmad-output/story-automator/orchestration-11-…md` aparece modificado (artefato do orquestrador, fora do escopo de código) — não commitar como parte desta story. `docs/futureIdeas.md` pode conter notas do Hugo — se aparecer modificado, deixar intocado (mesma decisão da review 11.7).

### Latest Tech Information

- **Nenhuma dependência nova, nenhuma pesquisa de versão necessária.** A mudança reusa `Typography` do MUI 6.1 (já em uso no mesmo bloco) e um `Record` TS trivial. Sem API externa, sem breaking change, sem migração. Nada a pesquisar.

### Project Structure Notes

- **Frontend alterado:** `frontend/src/features/bujo/components/RecurringPlacementDialog.tsx` (+ `.test.tsx`). Nenhum outro arquivo.
- **Sem backend, sem contrato, sem `api.ts`, sem `keys.ts`, sem barrel `index.ts`, sem migração.** As páginas do planner (`WeeklyPage`/`MonthlyPage`/`FuturePage`) **não** mudam — consomem o mesmo componente.
- **Fronteiras:** mudança contida em `features/bujo/components`; nenhum import novo além do `Typography` (já importado, `RecurringPlacementDialog.tsx:2`). Zero nova violação de ESLint boundary / import-linter.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 11.8 (linhas 914-927 — AC "descrição, categoria, etiqueta Eisenhower e recurrence_text" + regra de nulos "campo ausente não aparece"); §Epic 11 intro (linha 757 — "2º lote → (8) infos da recorrência no modal de placement (bug da 11.3)")]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 11.3 (linhas 798-817 — modal de placement construído com infos da recorrência + calendário de densidade); §AD-16 (linha 892 — decisões de spec do 2º lote)]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-07-15.md (reabertura do Épico 11, 2º lote 11.7–11.11)]
- [Source: docs/futureIdeas.md:17,26 (origem do bug: "Falta exibir as informações da task no modal - descrição, categoria, eisenhower, etc." — note "task", não "template": daí a suposição de categoria inexistente)]
- [Source: frontend/src/features/bujo/components/RecurringPlacementDialog.tsx:50-64 (bloco de infos: título/descrição/recorrência JÁ exibidos — ADICIONAR linha de Eisenhower após :62); :55-59 (padrão de campo condicional a espelhar para a regra de nulos); :2 (Typography já importado)]
- [Source: frontend/src/features/bujo/components/RecurringPlacementDialog.test.tsx:17-25 (fixture TEMPLATE com eisenhower: null — não trocar o default); :58-64 (teste "exibe título, descrição e recorrência" — manter); :98-104 ("sem template não renderiza o bloco" — manter); :106-111 (jest-axe contra o componente real — MANTER)]
- [Source: frontend/src/features/bujo/components/TaskDetailPanel.tsx:28-33 (EISENHOWER_LABEL — padrão de mapa a espelhar); :145 (filtro !== 'none' — convenção de "sem prioridade")]
- [Source: frontend/src/features/bujo/components/RecurringTemplateManager.tsx:29-34 (2ª cópia do EISENHOWER_LABEL — convenção de duplicação local); :211-233 (CRUD de template só tem Eisenhower, NUNCA categoria — prova da AC4)]
- [Source: frontend/src/features/bujo/components/TaskRow.tsx:50-54 (eisenhowerChipInfo — 'none'/null/'' = sem chip; equivalência de "sem prioridade")]
- [Source: frontend/src/api/types.gen.ts:496-505 (RecurringTaskTemplate: sem `category`; tem `eisenhower` como EisenhowerEnum|BlankEnum|NullEnum|null); :426 (EisenhowerEnum = "ui"|"u"|"i"|"none"); :540 (Task TEM `category` — contraste); :409 (CategoryEnum)]
- [Source: backend/bujo/models.py:174-196 (modelo RecurringTaskTemplate — sem `category`); backend/bujo/serializers.py:253-264 (RecurringTaskTemplateSerializer.fields — sem `category`)]
- [Source: frontend/src/pages/planner/WeeklyPage.tsx:211-231 (consumidor 1 — passa template inteiro); frontend/src/pages/planner/MonthlyPage.tsx:230-233 (consumidor 2); frontend/src/pages/planner/FuturePage.tsx:166-169 (consumidor 3 — anuais, Story 11.4)]
- [Source: frontend/src/features/bujo/components/RecurringPlacementSection.tsx:81 (onPlace(template) — objeto completo, prova de que o dado chega inteiro)]
- [Source: _bmad-output/implementation-artifacts/11-7-edicao-de-tarefa-persiste-em-esta-semana-este-mes.md (padrão de story frontend-only em componente compartilhado; lição "confirmar contra código, não contra texto da AC"; jest-axe contra componente real)]
- [Source: _bmad/custom/bmad-dev-story.toml (guardrails de retrospectiva: contagem de teste real, File List por último)]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Opus 4.8)

### Debug Log References

- `npx vitest run src/features/bujo/components/RecurringPlacementDialog.test.tsx --no-file-parallelism` (RED, antes da implementação): **3 failed | 10 passed (13)** — falharam exatamente os 3 casos `it.each` de "exibe a etiqueta Eisenhower quando definida" (ui/u/i), enquanto os 3 casos AC3 "não exibe quando ausente" já passavam (a linha ainda não renderizava). Validou a correção dos testes.
- Mesmo comando após a implementação (GREEN): **13 passed (13)**.
- `npm run typecheck` (tsc -b --noEmit): sem erros. `npm run lint` (eslint .): sem erros. `npm run build`: `✓ built in 405ms` (o aviso de chunk > 500 kB é pré-existente, não relacionado a esta story).
- Suíte completa `npx vitest run --no-file-parallelism` (Node 22.15.1): **484 passed (45 arquivos)**. Baseline de sanidade da 11.7 era 478 passed (45 arquivos); +6 testes novos (3 casos "exibe" + 3 casos "não exibe") = 484. Contagem real colada, não estimada (guardrail retro Epic 3 §1).

### Completion Notes List

- **AC1 — Etiqueta Eisenhower no modal:** adicionada uma única linha condicional `Prioridade: {EISENHOWER_LABEL[…]}` no bloco de infos de `RecurringPlacementDialog.tsx`, logo após a linha "Recorrência: …", no mesmo estilo tipográfico das linhas vizinhas (`variant="body-sm"`, `color="text.secondary"`, `component="div"`, `sx={{ mt: 0.5 }}`). Mapa `EISENHOWER_LABEL` local (3 entradas: ui/u/i), espelhando a convenção já duplicada em `TaskDetailPanel.tsx` e `RecurringTemplateManager.tsx` — sem extrair módulo compartilhado (scope creep evitado, conforme Dev Notes).
- **AC3 — Regra de nulos:** o guard `template.eisenhower && template.eisenhower in EISENHOWER_LABEL` cobre `none`/`""`/`null` de uma vez (nenhum deles é chave do mapa de 3 entradas). A falsy-check (`&&`) descarta `""`/`null`/`undefined`; o `in` descarta `'none'`. Testado explicitamente para os três casos → a linha "Prioridade:" não aparece.
- **AC2 — Sem regressão / 3 superfícies:** nenhuma outra parte do bloco foi tocada (título, descrição condicional, "Recorrência: …", `TextField` de data/dia, `MonthDensityCalendar`, `handleConfirm`/`handleClose`/`useTaskDensityQuery` intactos). Por ser componente único compartilhado por `WeeklyPage`/`MonthlyPage`/`FuturePage`, a etiqueta passa a valer nas três superfícies sem tocar nenhuma página. Testes existentes (incl. jest-axe contra o componente real portalado) seguem verdes.
- **AC4 — Categoria estruturalmente ausente:** confirmado por leitura que `RecurringTaskTemplate` não possui `category` (modelo `models.py:174-196`, serializer `serializers.py:253-264`, tipo gerado `types.gen.ts:496-505`, CRUD `RecurringTemplateManager` só oferece Eisenhower). Categoria não é exibida — por construção satisfaz a própria regra de nulos. **Zero mudança de backend/contrato:** `git status --short` não inclui `schema.yaml`, `types.gen.ts`, `api.ts`, `keys.ts` nem `backend/` (Task 4.2 ✓); backend intocado → pytest não executado.
- **Fiação de dados (Task 2.2):** confirmado que o template chega inteiro ao componente (`RecurringPlacementSection.tsx:81` chama `onPlace(template)` com o objeto completo; as 3 páginas passam `template={placing…Template}`). O gap era puramente de renderização, não de dados — nada a corrigir na fiação.
- **Verificação da renderização (Task 4.3/4.5):** o teste de componente monta o `RecurringPlacementDialog` real (só `useTaskDensityQuery` mockado) e assere o texto renderizado exato nos casos presente/ausente + jest-axe contra o Dialog portalado real — fonte de verdade da renderização do modal (mesma divisão de responsabilidade da 11.7). **No momento do dev-story**, nenhum e2e foi adicionado (Task 4.5) e `e2e/` não havia mudado.
  > **Correção da review (2026-07-16):** o passo de QA automatizado subsequente (`bmad-qa-generate-e2e-tests`) **adicionou** um teste E2E em `frontend/e2e/recurring-templates.spec.ts` (deviation consciente registrada em `tests/test-summary.md`), fechando o gap de integração real (form MUI → serializer → snapshot → modal) que a fixture mockada do teste de componente não alcança. A afirmação "e2e/ não mudou" acima vale apenas para o estado pós-dev-story; a File List foi reconciliada para incluir o arquivo.

> **QUESTÃO ABERTA para o Hugo (não bloqueia esta story — AC4):** templates recorrentes hoje **não têm** campo `category` (só `Task` tem). Você quer que passem a ter categoria como as tasks têm? Isso puxaria backend + migração + serializers + regeneração de contrato + input no `RecurringTemplateManager` + cópia no snapshot de placement — vira uma story própria (candidata ao 3º lote do Épico 11 ou backlog). Se não, a AC4 fica como está: categoria não se aplica a templates. Registrado em vez de silenciosamente adicionar campo de backend (memória do projeto: "Perguntar em vez de assumir fluxos").

### File List

- `frontend/src/features/bujo/components/RecurringPlacementDialog.tsx` (modificado — mapa `EISENHOWER_LABEL` local + linha condicional "Prioridade: …" no bloco de infos)
- `frontend/src/features/bujo/components/RecurringPlacementDialog.test.tsx` (modificado — +6 testes: 3 casos `it.each` "exibe Eisenhower" ui/u/i + 3 casos `it.each` "não exibe quando ausente" null/'none'/'')
- `frontend/e2e/recurring-templates.spec.ts` (modificado — +1 teste E2E `AC1/AC3 (Story 11.8)`: cria via UI/backend real um template com prioridade e outro sem, e assere presença/ausência da linha "Prioridade: …" no modal de placement. **Adicionado pelo passo de QA automatizado** (`bmad-qa-generate-e2e-tests`, documentado em `tests/test-summary.md`), não pelo dev-story — daí a Task 4.5 dizer "não adicionar e2e" e as Completion Notes originais dizerem "e2e/ não mudou": ver correção abaixo. Reconciliado nesta review.)

## Senior Developer Review (AI)

**Revisor:** HugoMMBrito · **Data:** 2026-07-16 · **Resultado:** ✅ Aprovado (0 issues CRITICAL) — 1 finding MEDIUM de documentação corrigido nesta review.

### Verificação executada (contagens reais)

- `npm run typecheck` (tsc -b --noEmit): **0 erros**.
- `npm run lint` (eslint .): **0 erros/avisos**.
- `npx vitest run --no-file-parallelism` (Node 22.15.1): **45 arquivos, 484 passed** — bate exatamente com a contagem reivindicada no Dev Agent Record.
- E2E não reexecutado nesta review (requer stack completo + branch Neon `e2e`); validado estaticamente (ver abaixo). O passo de QA registra 4 passed em `recurring-templates.spec.ts`.

### Validação das ACs contra o código

- **AC1 ✓** — `RecurringPlacementDialog.tsx:73-77` renderiza `Prioridade: {EISENHOWER_LABEL[…]}` após a linha "Recorrência:", no mesmo estilo tipográfico das vizinhas. Rótulos idênticos aos de `TaskDetailPanel`/`RecurringTemplateManager` (convenção reusada, não inventada).
- **AC2 ✓** — nenhuma outra parte do bloco/handlers tocada; componente único → vale nas 3 superfícies sem tocar páginas. Testes pré-existentes (incl. jest-axe contra o Dialog real portalado) seguem verdes.
- **AC3 ✓** — guard `template.eisenhower && template.eisenhower in EISENHOWER_LABEL` cobre `none`/`""`/`null` de uma vez (cast pós-guard é seguro; typecheck limpo). Coberto por `it.each` de 3 casos.
- **AC4 ✓** — confirmado por leitura que `RecurringTaskTemplate` não tem `category` (`types.gen.ts:496-505`); `git diff` não inclui `schema.yaml`/`types.gen.ts`/`api.ts`/`keys.ts`/`backend/`. Contrato intacto. Questão aberta ao Hugo devidamente registrada.

### Findings

| # | Severidade | Finding | Ação |
|---|---|---|---|
| 1 | MEDIUM | **File List / Completion Notes desatualizadas vs. git reality:** `git` mostra `frontend/e2e/recurring-templates.spec.ts` modificado (+77 linhas, 1 teste E2E novo), mas a File List da story o omitia e as Completion Notes afirmavam "Nenhum e2e novo adicionado … `e2e/` não mudou". O teste foi adicionado pelo passo de QA automatizado (documentado em `tests/test-summary.md`), mas a story nunca foi reconciliada. | **Corrigido nesta review:** e2e adicionado à File List com nota de origem; Completion Note anotada com a correção da review. |

Nenhum finding CRITICAL/HIGH. Implementação mínima, correta e alinhada às convenções do projeto — nada de scope creep no código-fonte (mudança contida em `RecurringPlacementDialog.tsx`).

## Change Log

| Data | Versão | Descrição | Autor |
|---|---|---|---|
| 2026-07-16 | 1.0 | Story 11.8 implementada: etiqueta Eisenhower ("Prioridade: …") exibida no `RecurringPlacementDialog` quando o template tem prioridade real (ui/u/i); ausente para none/''/null (AC3); categoria confirmada estruturalmente ausente em templates (AC4, questão aberta ao Hugo). Frontend-only, arquivo único + teste; sem backend/contrato. | Amelia (dev-story) |
| 2026-07-16 | 1.1 | Review adversarial (story-automator-review): typecheck/lint/vitest reverificados (484 passed). 1 finding MEDIUM auto-corrigido — File List reconciliada para incluir `frontend/e2e/recurring-templates.spec.ts` (teste E2E adicionado pelo passo de QA) e Completion Note anotada. 0 issues CRITICAL → Status: done. | HugoMMBrito (review) |
