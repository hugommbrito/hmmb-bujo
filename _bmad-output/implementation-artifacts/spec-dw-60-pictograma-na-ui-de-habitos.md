---
title: 'DW-60 — Renderização do pictograma na UI de Hábitos'
type: 'feature'
created: '2026-08-23'
status: 'done'
baseline_commit: '8edebc45ee2f8ae6e894ba5cea96bd5fed8021ee'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-16-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A Story 16.2 entregou o contrato e **já converteu** os `emoticon` existentes em `iconKey`, mas nenhuma superfície lê o campo: a coluna do glifo na Habit Tracker Row segue vazia mesmo para hábitos que têm pictograma no banco. O dado migrado está invisível.

**Approach:** Entregar a **renderização**: um módulo puro de conversão kebab⇄Pascal e um `DomainIcon` que resolve o glifo do catálogo Phosphor por chave, preenchendo os slots já reservados no tracker, na grade de completude e no histórico — com ausência (chave nula ou órfã) como estado válido e visualmente idêntico ao de hoje. A **escolha** do pictograma (seletor + campo na Configuração) é **DW-64**, fora desta spec; até lá `iconKey` só é escrito via API.

## Boundaries & Constraints

**Always:**
- **Ausência é estado válido, nunca erro visual.** `iconKey` nulo **ou** órfão (glifo que saiu numa atualização do Phosphor) ⇒ coluna vazia, layout inalterado. Nunca tofu, quadrado, placeholder ou glifo de erro (gate 16.0, Q2).
- **O bundle inicial não cresce de forma desproporcional.** O catálogo Phosphor é o peso do pacote (13 MB em `dist/defs/`); esta spec renderiza apenas as chaves que os hábitos do usuário realmente usam, não o catálogo inteiro.
- O glifo é **decorativo** onde há label visível: `aria-hidden`, sem nome acessível duplicado.
- **`currentColor` e weight `regular`**, tamanhos por `var(--ds-domain-icon-size-default|compact)`. A tinta vem por herança do estado da linha — nunca cor própria, nunca cor que varie com o número (proibição de celebração).
- Persistência e wire em **kebab-case**; a conversão para o export PascalCase do pacote é do frontend e é bijetiva (verificado na 16.2: 0 colisões em 1512 nomes, nenhum dígito).
- Todo arquivo novo sob `record/` entra em `SOURCES` do guard de literais — guard assimétrico é falsa cobertura.

**Never:**
- Não construir o seletor, o campo de Configuração nem o chunk lazy do catálogo completo — é **DW-64**.
- Não renderizar `emoticon` em nenhuma superfície, nem como fallback — o guard `noLiteralTokens.test.ts:134-148` proíbe o identificador fora de comentário.
- Não tocar backend, `schema.yaml`, `types.gen.ts` nem o catálogo commitado: o contrato está fechado e `Habit`/`HabitSlim`/`HabitDayEntry` já entregam `iconKey`.
- Não alterar a largura da coluna do glifo: `HabitTrackerRow.tsx:340,350` calculam indentação a partir dela.
- Não inserir glifo na tabela textual equivalente da grade (`HabitCompletionGrid.tsx:521-534`) — é a representação de acessibilidade.
- Não alterar regra de domínio (completude ponderada, multiplicador, snapshot).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Chave válida no tracker | `iconKey: "barbell"` | Glifo 20px em `currentColor`, `aria-hidden`; nome inalterado | N/A |
| Chave nula | `iconKey: null` | Coluna 20×20 vazia; layout idêntico ao da 16.1 | N/A |
| Chave órfã | `iconKey: "glifo-que-saiu"` | Coluna vazia — resolver devolve `null` | Sem throw, sem log ruidoso |
| Chave em PascalCase | `iconKey: "AddressBook"` | Coluna vazia — só kebab-case resolve | Trata como órfã |
| Conversão kebab→Pascal | `"address-book"` | `AddressBook` | Nome fora do catálogo ⇒ `null` |
| Grade e histórico | Entradas com `iconKey` | Glifo 18px (`compact`) antes do nome | Chave nula/órfã ⇒ sem glifo |
| Tabela textual da grade | Qualquer `iconKey` | Nenhum glifo — só texto | N/A |

</frozen-after-approval>

## Code Map

**Tokens (prontos — não criar medidas novas):**
- `frontend/src/shared/design/tokens.ts:363-370` — `domainIcon = { library: '@phosphor-icons/react', weight: 'regular', sizeCompact: '18px', sizeDefault: '20px', color: 'currentColor' }`; vars emitidas em `:594-595`. `tokens.test.ts:178` fixa `library` — **não mexer**.
- `:341-345` `pictogramPicker` segue **sem consumidor** nesta spec (é da DW-64).

**Onde o glifo entra:**
- `frontend/src/features/habits/components/record/HabitTrackerRow.tsx:190-199` — **o slot**: `<Box aria-hidden data-testid="habit-glyph-column">` com `width`/`height` = `var(--ds-domain-icon-size-default)`, sem `display` e sem conteúdo. Preencher mantendo `aria-hidden` e a largura, adicionando centralização flex (hoje é espaçador puro; sem isso o `svg` herda baseline). `:340,350` dependem da largura. Cabeçalho `:10-14` documenta a coluna vazia — atualizar o comentário.
- `frontend/src/features/habits/components/record/HabitsHistoryPanel.tsx:182-191` — `<Box component="span">{entry.name}…` em `<li>` flex (`:169-181`); `entry` é `HabitDayEntry`, que **já tem** `iconKey`. Slot compact mais direto. **`:404-417`** é um `<select>` de `<option>` — SVG é impossível ali, não tentar.
- `frontend/src/features/habits/components/record/HabitCompletionGrid.tsx:216-219` (compact, `<li>` flex com `gap: var(--ds-space-2)`) e `:374` (wide, `<th scope="row">` sticky — precisa de wrapper `inline-flex` no nome). **`:521-534` é a tabela textual — não tocar.** `:129-131` do guard exigem o `color-mix` das células — não tocar.
- `frontend/src/features/habits/components/record/HabitsSkeleton.tsx:37,49-50,57-58` — espelho das 4 colunas e do bloco 20×20; manter em sincronia se a dimensão mudar.

**Contrato do frontend:**
- `frontend/src/api/types.gen.ts` — leitura **já pronta**, nada a regenerar: `Habit.iconKey?` `:1721`, `HabitDayEntry.iconKey` (readonly, não-opcional) `:1787`, `HabitSlim.iconKey?` `:1883`.
- `frontend/src/features/habits/api.ts:106-115` `CreateHabitVariables` e `:130-136` `UpdateHabitIdentityVariables` — adicionar `iconKey?: string | null` (os campos vão ao body por spread em `:117-120`, `:138-144`, sem mudança de transporte). A **escrita** é da DW-64, mas o tipo entra aqui para o contrato do cliente ficar completo e coerente com `types.gen.ts`.

**Molde a seguir:**
- `frontend/src/app/layout/shell/navIcons.tsx:72` `NAV_ICON_SIZE = 20` (número, não `'20px'` — o guard proíbe a string) e `:119-123` `navIconFor` com **guard que retorna `null`** para chave ausente: molde exato do fallback exigido pelo gate. `:31-34` documenta colisão de nomes MUI×Phosphor (aliasar `List`, `Heart` etc.). `ShellSidebar.test.tsx:482` assere que esse arquivo importa do **barrel** — não alterar o padrão global.

**Guards:**
- `record/noLiteralTokens.test.ts:13-23` (imports `?raw`) + `:51-63` (`SOURCES`) — **registrar cada arquivo novo**. `FORBIDDEN_LITERALS` (`:37-49`) inclui `'20px'` e `'18px'`: usar `var(--ds-domain-icon-size-*)`; `size={20}` numérico passa (regex é `\b20px\b`). `:134-148` proíbe `emoticon` fora de comentário. Guard gêmeo em `pages/habits/noLiteralTokens.test.ts`.

**Testes a inverter (hoje afirmam ausência do glifo):**
- `record/recordPrimitives.test.tsx:110-117`; `pages/habits/HabitsRecordPage.test.tsx:571,1280`.
- Fixtures já com `iconKey: null` (postas na 16.2): `api.test.tsx`, `HabitHistory.test.tsx`, `HabitHistoryGrid.test.tsx`, `HabitTracker.test.tsx`, `recordPrimitives.test.tsx`, `HabitsRecordPage.test.tsx`.
- E2E: `frontend/e2e/habits-record.spec.ts:138-143`.

**Medição que fundamenta o desenho** (build real de Vite): `dist/defs/` = 13 MB, ~4 kB por glifo; o barrel importado estaticamente arrasta 6,9 MB para o chunk que o alcança. Daí a resolução por chave usada, e não por catálogo inteiro.

## Tasks & Acceptance

**Execution:**

- [x] `frontend/src/features/habits/iconKey.ts` (novo) -- módulo **puro** (sem React, sem Phosphor): `toPascalCase(kebab)` e o predicado de forma kebab -- separar a conversão do componente permite testá-la sem montar o catálogo do Phosphor.
- [x] `frontend/src/features/habits/iconKey.test.ts` (novo) -- cobrir as linhas de conversão da I/O Matrix, incluindo PascalCase de entrada e nome inválido.
- [x] `frontend/src/features/habits/components/record/DomainIcon.tsx` (novo) -- resolve o glifo por `iconKey` e renderiza em `currentColor`/weight regular, tamanho `default`|`compact`, `aria-hidden` por padrão; chave nula, malformada **ou** órfã ⇒ devolve `null` (molde `navIconFor:119-123`). Só as chaves efetivamente usadas são resolvidas -- importar o catálogo inteiro traria 6,9 MB para o chunk da rota.
- [x] `frontend/src/features/habits/components/record/HabitTrackerRow.tsx:190-199` -- preencher o slot com `DomainIcon` mantendo `aria-hidden` e a largura, adicionando centralização flex; atualizar o comentário `:10-14` -- mudar a largura quebra `:340,350`.
- [x] `frontend/src/features/habits/components/record/HabitCompletionGrid.tsx:216,374` -- glifo `compact` antes do nome nas duas faixas; **não** tocar a tabela textual (`:521-534`).
- [x] `frontend/src/features/habits/components/record/HabitsHistoryPanel.tsx:182` -- glifo `compact` antes do nome da entrada.
- [x] `frontend/src/features/habits/api.ts:106-115,130-136` -- `iconKey?: string | null` nas duas interfaces.
- [x] `frontend/src/features/habits/components/record/noLiteralTokens.test.ts:13-23,51-63` -- registrar `DomainIcon.tsx` em `SOURCES` -- sem isso o guard não o cobre.
- [x] `record/recordPrimitives.test.tsx:110-117` + `pages/habits/HabitsRecordPage.test.tsx:571,1280` -- inverter as asserções de coluna vazia; cobrir chave válida, nula e órfã nas três superfícies.
- [x] `frontend/e2e/habits-record.spec.ts:138-143` -- ajustar o cenário para um hábito com `iconKey` semeado, confirmando o glifo no tracker.

**Acceptance Criteria:**

- **Dado** um hábito com `iconKey` válido no banco (inclusive um convertido pela migração da 16.2), **quando** as três superfícies renderizam, **então** o mesmo glifo aparece nas três, decorativo e em `currentColor`.
- **Dado** um hábito sem pictograma e outro com chave órfã ou malformada, **quando** as superfícies renderizam, **então** a coluna fica vazia, o layout é idêntico ao da 16.1 e nenhum tofu, quadrado ou glifo de erro aparece.
- **Dado** o app compilado para produção, **quando** os chunks são medidos, **então** o chunk de entrada permanece na ordem de grandeza atual — o catálogo completo do Phosphor não entrou no bundle.
- **Dado** o guard de literais, **quando** a suíte roda, **então** `DomainIcon.tsx` está em `SOURCES`, nenhum literal proibido ou cor hex foi introduzido, e `emoticon` não aparece em código.
- **Dado** o Épico 16, **quando** a suíte roda, **então** nenhuma regra de domínio mudou e as 7 falhas pré-existentes de `bujo`/`planner` (DW-61) seguem sendo as únicas vermelhas.

## Spec Change Log

## Review Triage Log

**Ciclo de review 1** — 3 camadas (blind-hunter, edge-case-hunter, verification-gap) contra o diff de `8edebc4`..árvore de trabalho. As três estouraram timeout na primeira tentativa e foram retomadas para colher o relatório. Cada achado foi verificado no local que nomeia antes da classificação.

### Mantidos → `patch` (corrigidos neste ciclo)

| # | Achado | Consequência verificada | Sev |
|---|---|---|---|
| P1 | Glifo da LISTA COMPACT da grade sem nenhuma asserção | **Medido por mutação:** apaguei o `<DomainIcon>` do branch compact (`HabitCompletionGrid.tsx:230`) e os 86 testes de `HabitsRecordPage.test.tsx` seguiram VERDES. Os dois testes que alcançam o branch (`:1707`, `:1720`) só afirmam o heading "Completude por dia". É a leitura mobile do histórico — a recomposição pela qual o componente existe — e o pictograma pode desaparecer ou vir mal dimensionado sem nada ficar vermelho. Mecanismo de teste já existe (`mockCompactFaixa()`) | medium |
| P2 | Mapa vazio de `GLYPH_LOADERS` é indistinguível de "sem pictograma" | `import.meta.glob` sobre `/node_modules/...` resolve pelo layout físico do pacote. Verificado que HOJE funciona (npm + `package-lock.json` local, sem hoisting para a raiz, CI usa `npm ci`), então não é defeito ativo — mas o modo de falha é exatamente o estado VÁLIDO de ausência: mapa vazio ⇒ todo glifo tratado como órfão, zero erro, suíte verde. Nenhum teste assere que o mapa está populado, e `GLYPH_LOADERS` nem é exportado. Mesma classe do guard assimétrico que a Retro do Épico 13 já custou | medium |
| P3 | `boundingBox()` nulo passa em silêncio no E2E | `e2e/habits-record.spec.ts:176` faz `expect(comGlifo?.width).toBeCloseTo(semGlifo?.width ?? 0, 1)`: se o box vier `null`, `comGlifo?.width` é `undefined` e a falha não aponta deriva de layout. Faltam as duas asserções de não-nulo antes da comparação | low |

### `defer` (fora do escopo — no ledger)

`DW-65` latência por chave do pictograma é visualmente indistinguível de "sem pictograma". Emergiu na verificação pós-patch, não das camadas de review: um run do E2E marcou `1 flaky` exatamente no cenário do glifo (`toHaveCount(1)` no `svg` falhou por 10s, 24 polls, 0 elementos, SEM erro de console) e passou no retry; o run seguinte deu 9/9 limpo. Cold start do Vite dev compilando 1 dos 1512 módulos sob demanda — em produção são chunks pré-buildados de ~4 kB. Deferido porque a Boundary desta spec manda explicitamente NÃO ter estado de loading (coluna vazia é o estado válido, sem CLS), e a decisão certa depende do mecanismo que a DW-64 vai adotar. Decidido com Hugo em 2026-08-23.

`DW-63` (já aberto) cobre o caret de `@phosphor-icons/react` com catálogo pinado — o achado das camadas sobre pinar a versão tem o mesmo mérito e não foi duplicado.

### Descartados (verificação refutou ou regra do workflow dispôs)

| Achado | Por que cai |
|---|---|
| `pickExport` aceita `typeof candidate === 'object'`, então `null`/objeto não-renderizável viraria `<Glyph/>` e estouraria o render | A aritmética do `typeof` procede (`typeof null === 'object'` passa), mas a consequência exige um módulo que exporte `null` ou objeto simples. **Verificados os 1512 módulos de `dist/csr/`: todos exportam componente `forwardRef` de verdade** (zero sem `forwardRef`). Sem caminho para a consequência no pacote instalado. O `?? ` só cai para o segundo nome quando o primeiro é nulo, e se ambos faltam o resultado é `undefined`, que o guard já converte em `null` |
| Glob acopla a pnpm / Yarn PnP / hoisting da raiz do monorepo | Cenário hipotético: o repo usa npm com `package-lock.json` em `frontend/`, sem `node_modules` na raiz, e o CI roda `npm ci`. Trocar de gerenciador é mudança de infra que quebraria muito mais que isto. A parte REAL do achado — falha silenciosa — foi mantida como P2 |
| E2E depende de `data-testid="habit-tracker-row"` que talvez não exista nos dois modos | Verificado: o testid está em `HabitTrackerRow.tsx:321`, na raiz ÚNICA do componente, emitido igual em compact e wide. O helper `rowOf` é sólido |
| Cache module-level nunca limpo entre testes ⇒ os "relógios" podem virar vácuo | Consequência é sobre teste FUTURO, não sobre o código entregue: hoje as 4 chaves-relógio (`alarm`, `airplane`, `anchor`, `archive`) não aparecem em nenhum outro lugar da suíte, e rodei os testes de glifo 3× seguidas + isolados — 22/22 estáveis, sem dependência de ordem observável. O risco de reuso futuro de chave é real mas latente; anotá-lo é o que os comentários dos próprios testes já fazem. Um `__resetGlyphCache()` exportado só para teste adicionaria superfície de produção para proteger um cenário que ainda não existe |
| `.catch` memoiza falha de rede como ausência permanente na sessão | Verificado que é o comportamento escrito, mas para glifo DECORATIVO a consequência é cosmética: a coluna vazia é o estado válido do gate 16.0, e a linha, o nome e o controle seguem íntegros. Distinguir órfã (determinística) de falha transitória exigiria retry/telemetria — decisão de produto fora do escopo desta spec |
| Prop `label` é código morto (nenhum call-site, nenhum teste) | Procede como fato, mas o branch existe porque a EXPERIENCE.md exige nome acessível na apresentação só-por-ícone, que é da DW-64. Remover para readicionar lá é churn; o custo de mantê-la é uma prop não exercitada, sem consequência para o consumidor atual |
| Falta cobrir o `.catch` de falha de import | Mesmo mérito do item acima: caminho de resiliência de glifo decorativo cuja falha degrada para o estado já validado por outros 6 testes (ausência) |
| Renomear `DomainIconSize` (`compact` agora significa "não-tracker") | Cosmético e prematuro: `compact`/`default` vêm dos tokens `domainIcon.sizeCompact`/`sizeDefault` (`tokens.ts:363-370`), que são o contrato do design system. Renomear aqui divergiria do token |
| `@phosphor-icons/react` em caret com catálogo pinado | **Já está no ledger como DW-63**, aberto, com o mesmo mérito. Não duplicar |
| Faltam asserção de tamanho do glob = 1512 e teste cruzando glob × `phosphor_catalog.json` | A parte acionável (detectar mapa vazio) entrou como P2. Fixar a CONTAGEM em 1512 no frontend duplicaria o gate de CI da 16.2 e passaria a falhar a cada bump do pacote em dois lugares em vez de um |
| Comentário de `HabitTrackerRow` cita `:340,350`, já deslocado para `:352,362` | Verificado o deslocamento. Cai porque o próprio achado propõe a correção certa (apontar para o `calc()` em vez do offset) e o texto já nomeia o token; número de linha em comentário apodrece por natureza, sem consequência funcional |
| Nada impede alguém reintroduzir `import { X } from '@phosphor-icons/react'` e trazer o barrel de volta | Guard de import é trabalho novo de infra sobre um risco hipotético; o `noLiteralTokens` citado como molde vigia literais, não grafo de import. Fora do escopo desta spec |
| Skeleton (`HabitsSkeleton.tsx`) pode ter divergido da linha real | Verificado: a largura da coluna NÃO mudou (mesmo token nas duas), então o skeleton segue fiel. Nenhuma consequência |
| `api.ts` ganhou `iconKey` sem consumidor nem teste de payload | Deliberado e declarado na spec (Task 8 + Code Map): o tipo entra para o contrato do cliente fechar com `types.gen.ts`; a escrita é DW-64. `camelize_serializer_fields` (`base.py:209-212`) já resolve `iconKey`⇄`icon_key` no wire, e o backend aceita o campo (`services.py:31` `_IDENTITY_FIELDS`) |
| Comentário de `seedHabits.ts` com linha longa mal reflowada | Cosmético puro, sem consequência para nenhum consumidor |
| Chunk de rota 57 → 340 kB é regressão que nenhum check pega | A spec ACEITA esse custo explicitamente (Boundaries + Design Notes) e o AC de bundle mira o chunk de ENTRADA, que ficou em +1,4 kB. O trade-off medido (52 kB gzip na rota × 1,07 MB do barrel) está registrado na DW-64 |
| Regex kebab do frontend usa `$` onde o backend usa `\Z` | Verificado que em JS, sem flag `m`, `$` NÃO casa antes de `\n` final — comportamento idêntico ao backend, e `'barbell\n'` já está na tabela de inválidos de `iconKey.test.ts`. Divergência de grafia sem divergência de comportamento |

### Conflito de mecanismo com a decisão registrada na DW-64 (levantar com Hugo)

A entrada **DW-64** do `deferred-work.md` registra, como "decisão de arquitetura já fechada com Hugo em 2026-08-23", que **`import.meta.glob` foi descartado** por "emitir 299 kB no bundle INICIAL e 1512 arquivos no deploy", em favor do "barrel atrás de `import()`". Esta implementação usa `import.meta.glob` — porque é o único mecanismo que satisfaz o que ESTA spec pede: "renderiza apenas as chaves que os hábitos do usuário realmente usam, não o catálogo inteiro" (Boundaries) e "Só as chaves efetivamente usadas são resolvidas" (Task 3). Registro a divergência em vez de escolher em silêncio:

- **A objeção do "bundle inicial" não se materializou.** O mapa de loaders cai no chunk **lazy da rota** (`HabitsRecordPage`, 57 → 340 kB brutos / 13 → 65 kB gzip), não no de entrada, que ficou em 1 082 → **1 084 kB**. O AC de bundle desta spec passa. Provável origem dos 299 kB medidos antes: um consumidor alcançável pelo grafo eager (a rota de Hábitos é `import()`-ada pelo `registry.ts`, então o mapa herda a laziness dela).
- **A objeção dos "1512 arquivos no deploy" procede** e não é medida por nenhum AC daqui: `dist/assets` vai de 21 para 1 504 arquivos JS.
- **O barrel atrás de `import()` não serve para RENDERIZAR:** medido, são 1,07 MB gzip num único chunk baixado no primeiro glifo — todo usuário que abre a aba Hábitos paga o catálogo inteiro para ver meia dúzia de pictogramas. É justamente o que as Boundaries proíbem aqui, e é aceitável na DW-64 porque lá o custo cai sobre a ação deliberada de **navegar** a lista.

**Encaminhamento sugerido:** as duas stories podem legitimamente usar mecanismos diferentes (per-chave para renderizar, barrel lazy para navegar), e nesse caso a frase da DW-64 precisa ser reescrita para dizer que a rejeição do `import.meta.glob` vale para o **seletor**, não para a renderização. Se Hugo preferir um mecanismo único, a troca aqui é o barrel atrás de `import()` com a regressão de 1,07 MB gzip na primeira abertura da aba — decisão dele, não desta spec.

## Design Notes

**Por que resolver por chave usada, e não carregar o catálogo.** O peso do Phosphor está em `dist/defs/` (13 MB, ~4 kB por glifo). Medi com build real que um import estático do barrel leva 6,9 MB (1,14 MB gzip) para o chunk que o alcança — inaceitável na rota de Hábitos. Um usuário tem dezenas de hábitos, não 1512, então renderizar exige apenas as chaves em uso. O catálogo completo só é necessário para **navegar** a lista inteira, que é o seletor da DW-64 — e lá o custo cai sobre uma ação deliberada e cacheável, com o mecanismo (`import()` num chunk separado) já decidido e medido.

**Mecanismo escolhido, e o que ele custa (medido na implementação).** `import()` com template literal de specifier **bare** (`@phosphor-icons/react/dist/csr/${x}.es.js`) **não serve**: o Rollup não resolve o specifier, deixa o `import()` cru no bundle e a página quebra em produção — verificado com build real. O mecanismo que funciona é `import.meta.glob` (lazy, sem `eager`) sobre `/node_modules/@phosphor-icons/react/dist/csr/*.es.js`: Vite emite **um chunk por glifo** (1512 chunks de ~4–12 kB) e a rota busca só os que as chaves dos hábitos pedem. Custo medido: o **chunk de entrada não se mexe** (1 082 kB → 1 084 kB), e o **mapa de loaders** (1512 caminhos) entra no chunk da rota de Hábitos — `HabitsRecordPage` 57 kB → 340 kB brutos, 13 kB → 65 kB gzip. É ~260 kB brutos de tabela de caminhos, irredutível para catálogo aberto (globar `defs/` em vez de `csr/` dá o mesmo tamanho — o custo é o mapa, não as dependências), e ainda uma ordem de grandeza abaixo do 1,14 MB gzip que o barrel estático traria.

**Por que a ausência não tem estado de loading.** A coluna vazia 20×20 já é o estado válido entregue pela 16.1 e é visualmente idêntica ao espaço que o glifo vai ocupar. Então "ainda não resolveu" e "não tem glifo" podem compartilhar a mesma renderização — sem skeleton, sem piscada, sem CLS.

## Verification

**Commands:**
- `nvm use 22.15.1` -- pré-requisito de todo comando de frontend/e2e (a sessão inicia em v18).
- `cd frontend && npm run typecheck && npm run lint` -- expected: verde.
- `cd frontend && npm run test:run` -- expected: suíte de Hábitos integralmente verde; total continua com **apenas** as 7 falhas pré-existentes de `bujo`/`planner` (DW-61), nenhuma nova.
- `cd frontend && npm run build && ls -la dist/assets/` -- expected: chunk de entrada na ordem de grandeza atual (~1,2 MB); nenhum chunk multi-MB de ícones.
- `cd frontend && CI=1 npx playwright test habits-record.spec.ts` -- expected: verde (não há migration nova; o banco `bujo_e2e` local já tem `icon_key` da 16.2).

**Manual checks:**
- Semear um hábito com `iconKey` válido e outro com chave inexistente; confirmar glifo no primeiro e coluna vazia no segundo, com a mesma altura de linha.

## Suggested Review Order

**A decisão central: como o glifo chega sem trazer o catálogo (comece aqui)**

- Entrada do design: loaders lazy, um por glifo — nenhum `dist/defs/*` entra no chunk da rota.
  [`DomainIcon.tsx:57`](../../frontend/src/features/habits/components/record/DomainIcon.tsx#L57)

- A guarda que o review pediu: mapa vazio deixaria TODO glifo órfão em silêncio.
  [`DomainIcon.tsx:76`](../../frontend/src/features/habits/components/record/DomainIcon.tsx#L76)

- Chave órfã é fluxo normal, não incidente: nunca lança, nunca loga.
  [`DomainIcon.tsx:106`](../../frontend/src/features/habits/components/record/DomainIcon.tsx#L106)

- Ausência e "ainda não resolveu" compartilham a renderização — sem skeleton, sem CLS.
  [`DomainIcon.tsx:176`](../../frontend/src/features/habits/components/record/DomainIcon.tsx#L176)

**A forma da chave é contrato, não detalhe**

- PascalCase de entrada é chave INVÁLIDA, nunca normalizada — espelha o backend.
  [`iconKey.ts:28`](../../frontend/src/features/habits/iconKey.ts#L28)

- `null` em vez de exceção: o consumidor é uma coluna cuja ausência é válida.
  [`iconKey.ts:42`](../../frontend/src/features/habits/iconKey.ts#L42)

**O glifo nas três superfícies (largura fixa é a invariante)**

- O slot da 16.1 preenchido; a largura NÃO muda porque `:352,362` indentam a partir dela.
  [`HabitTrackerRow.tsx:210`](../../frontend/src/features/habits/components/record/HabitTrackerRow.tsx#L210)

- Faixa compact da grade — o branch que o review pegou sem nenhuma asserção.
  [`HabitCompletionGrid.tsx:230`](../../frontend/src/features/habits/components/record/HabitCompletionGrid.tsx#L230)

- Faixa wide: wrapper `inline-flex` senão o `svg` herda o baseline do `th` sticky.
  [`HabitCompletionGrid.tsx:398`](../../frontend/src/features/habits/components/record/HabitCompletionGrid.tsx#L398)

- Detalhe do dia; o `{' '}` virou `gap` do flex para não somar duas separações.
  [`HabitsHistoryPanel.tsx:196`](../../frontend/src/features/habits/components/record/HabitsHistoryPanel.tsx#L196)

**Contrato do cliente (tipo agora, escrita na DW-64)**

- `iconKey` nas variáveis de mutação: fecha o tipo com `types.gen.ts` sem consumidor ainda.
  [`api.ts:116`](../../frontend/src/features/habits/api.ts#L116)

**Testes (periféricos, mas dois provam o que a mutação exigiu)**

- Sem isto, apagar o glifo do compact deixava os 86 testes verdes.
  [`HabitsRecordPage.test.tsx:1720`](../../frontend/src/pages/habits/HabitsRecordPage.test.tsx#L1720)

- Cota inferior, não a contagem exata: fixar 1512 duplicaria o gate de CI da 16.2.
  [`DomainIcon.test.ts:14`](../../frontend/src/features/habits/components/record/DomainIcon.test.ts#L14)

- O "relógio": chave inédita ao lado prova que a coluna vazia é ausência, não espera.
  [`recordPrimitives.test.tsx:139`](../../frontend/src/features/habits/components/record/recordPrimitives.test.tsx#L139)

- Contra o backend real: glifo presente e ausência com a MESMA largura.
  [`habits-record.spec.ts:179`](../../frontend/e2e/habits-record.spec.ts#L179)
