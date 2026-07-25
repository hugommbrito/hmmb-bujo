# Story 14.0: [UX] Mockups complementares do Núcleo BuJo

Status: done

> **Gate de execução:** apesar do status padronizado `ready-for-dev`, esta é uma story `x.0` de UX. Executar exclusivamente pelo rito **`bmad-ux` human-in-the-loop**. **Não executar com `dev-story` nem com story-automator.** As Stories 14.1–14.10 permanecem bloqueadas até esta story ser aprovada, promovida aos artefatos canônicos e marcada `done`.
>
> **Dependência de fila:** o Épico 13/App Shell é upstream formal e ainda não está encerrado: a Story 13.4 está `ready-for-dev` em 2026-07-24. A 14.0 pode ser preparada, mas sua aprovação/promoção não libera implementação fora da ordem mestre.

## Story

Como Hugo,
Quero os mockups que faltam para a Onda 3 aprovados no bmad-ux,
Para que toda superfície do épico tenha spine/mockup vigente antes da implementação (UX-DR31, DIR-15).

## Acceptance Criteria

1. **Complemento estrito dos spines promovidos**

   **Dado que** M06–M10 já estão aprovados e promovidos desde o gate de 2026-07-21,
   **Quando** esta x.0 rodar,
   **Então** cobre somente o que falta: **Arquivo**, no padrão Histórico readonly, e lacunas comprovadas na aplicação dos spines,
   **E** não redesenha Weekly, Monthly, Future Log, Recorrentes ou Migração/Catch-Up nem reabre decisões já promovidas.

2. **Estados obrigatórios e collection ausente**

   **Dado que** vigora a condição (c) da Sally (DIR-12),
   **Quando** o mockup do Arquivo e qualquer complemento necessário forem produzidos,
   **Então** cada composição aplicável demonstra `collection desligada/ausente` sem destino fantasma ou módulo disabled,
   **E** cobre `loading`, `empty` inicial, `empty` por filtro, `error` de leitura com retry, `offline` e `readonly`.

3. **Contrato implementável do Arquivo**

   **Dado que** o Arquivo segue o padrão Histórico e deve preservar a paridade de FR-4.13,
   **Quando** o mockup for submetido à aprovação,
   **Então** fecha sem ambiguidade a sequência **filtros/período → lista → detalhe readonly** para semanas e meses finalizados,
   **E** usa contraste normal, identifica textualmente `Fechado`/`Somente leitura`, remove mutações em vez de apenas desabilitá-las e mantém conteúdo, filtros e navegação compreensíveis em todos os estados.

4. **Linhagem, contexto e retorno preservados**

   **Dado que** tarefas migradas preservam linhagem e a Story 11.11 estabeleceu a paridade de navegação em logs passados,
   **Quando** Hugo segue a seta de linhagem até o sucessor em outro período,
   **Então** o destino correto abre, a linha sucessora recebe destaque temporário e o retorno preserva período, filtros e posição,
   **E** o detalhe readonly permanece acessível sem reintroduzir qualquer comando de mutação.

5. **Spines como autoridade e promoção canônica**

   **Dado que** os spines vencem conflitos,
   **Quando** houver divergência entre um mockup novo, o código inventariado e M06–M10/DESIGN/EXPERIENCE,
   **Então** o spine vigente vence, a divergência e sua resolução são registradas e nenhuma regra de produto nasce apenas do handoff visual,
   **E** o resultado aprovado é promovido para `DESIGN.md` e `EXPERIENCE.md` antes de a story ser marcada `done`.

6. **Responsividade e acessibilidade especificáveis**

   **Dado que** UX-DR30 e o contrato do App Shell exigem WCAG 2.2 AA,
   **Quando** frames e anotações forem validados,
   **Então** cobrem wide, medium, tablet e compact, incluindo reflow em 320 CSS px e zoom de 200%, sem scroll horizontal de página,
   **E** especificam teclado, ordem/retorno de foco, foco visível e não encoberto, headings/landmarks, nomes/estados acessíveis, contraste nas oito paletas, forced-colors e touch targets de pelo menos 44×44px conforme o piso do projeto.

## Tasks / Subtasks

- [x] **1. Executar o rito `bmad-ux` e congelar o escopo complementar** (AC: 1, 5)
  - [x] Confirmar a dependência do Épico 13 e registrar que esta x.0 é human-in-the-loop, nunca `dev-story`/automator.
  - [x] Reabrir somente Arquivo e lacunas demonstráveis de aplicação dos spines; não redesenhar M06–M10.
  - [x] Usar como autoridades, nesta ordem: decisões/spines promovidos, `DESIGN.md`/`EXPERIENCE.md`, requisitos/arquitetura e comportamento real inventariado.
  - [x] Produzir uma matriz de cobertura M06–M10 → mockup promovido → lacuna comprovada → decisão. Ausência de lacuna encerra o item sem novo frame.
  - [x] Registrar toda divergência; se ela exigir regra de produto ou contrato novo, encaminhar upstream e não resolvê-la visualmente.

- [x] **2. Inventariar o Arquivo atual e a paridade necessária** (AC: 1–5)
  - [x] Percorrer `/archive`, `/archive/weekly/:weekStart` e `/archive/monthly/:monthFirst` no shell vigente.
  - [x] Documentar o comportamento atual: skeleton, vazio, lista de períodos, deep links, navegação temporal, conteúdo semanal/mensal, tarefas terminais e seam legado.
  - [x] Tornar explícitas as lacunas atuais que o mockup precisa resolver para a futura 14.10:
    - erro/retry, offline e vazio por filtro ainda não representados;
    - ausência de filtros/período e de detalhe readonly canônico;
    - logs fechados hoje removem também abertura do detalhe, não só mutações;
    - Task Row ainda expõe `Mover` em certos contextos sem callbacks, perde contraste em `completed` e não oferece seta navegável ao sucessor;
    - o endpoint de índice retorna apenas tipo e chave temporal; o mockup não pode presumir novo dado/API sem fonte upstream.
  - [x] Preservar semântica e deep links de `weekly`/`monthly`; não converter inventário de código em decisão visual automática.

- [x] **3. Produzir e aprovar o mockup canônico do Arquivo** (AC: 2–6)
  - [x] Criar a exploração em `.working/` e promover a versão aprovada como `mockups/key-archive.html`.
  - [x] Demonstrar a arquitetura filtros/período → lista → detalhe readonly, com semanas e meses distinguíveis e ordenação temporal clara.
  - [x] Mostrar `Fechado` e `Somente leitura` por texto/semântica, com contraste normal; remover criar, editar, mover, reordenar, concluir, cancelar e excluir.
  - [x] Reusar a Task Row canônica e a anatomia do detalhe, restringindo permissões/contexto sem reposicionar status, categoria, Eisenhower, ordem ou linhagem.
  - [x] Demonstrar navegação ao sucessor e retorno com preservação de filtro, período, scroll/posição e foco.
  - [x] Não inventar endpoint, schema, paginação, busca, exportação, agregação ou regra de finalização não prevista em requisitos/arquitetura.

- [x] **4. Fechar a matriz de estados e responsividade** (AC: 2, 3, 6)
  - [x] Representar `loading` com skeleton da geometria real e shell/header estáveis.
  - [x] Separar `empty` inicial de `empty` por filtro; o segundo preserva o filtro e oferece limpeza.
  - [x] Manter erro de leitura junto à região afetada, com retry e período/filtros/posição preservados.
  - [x] Em offline, manter leitura/cache disponível; como Arquivo é readonly, não simular fila local nem bloquear navegação já carregada.
  - [x] Representar `collection desligada/ausente` no shell como ausência real da collection; Arquivo e Planner-base permanecem no núcleo, nunca disabled.
  - [x] Validar wide ≥1440px, medium 1024–1439px, tablet 768–1023px e compact <768px, incluindo 320 CSS px/zoom 200%.
  - [x] Fazer walkthrough de teclado, foco/retorno, leitor de tela, forced-colors, oito paletas e alvos touch.

- [x] **5. Auditar lacunas dos spines M06–M10 sem redesenho** (AC: 1, 5, 6)
  - [x] Weekly/M06: confirmar board multi-faixa, pool sem dia, mobile por dia, rails, densidade e estados parciais por fonte.
  - [x] Monthly/M07: confirmar calendário seg→dom, células vazias, scroll interno, lista compacta completa e destino sem dia.
  - [x] Future/M08: confirmar trilho de oito meses, vazios visíveis, `Ir para mês…`, datear/mover com linhagem e ausência de concluir/cancelar.
  - [x] Recorrentes/M09: confirmar Item Row sem status, `Alocar`, inativo ≠ excluído, soft delete e card de detalhe compartilhado.
  - [x] Migração/M10: confirmar ritual no workspace, ordem mês→semana→dia, decisões imediatas, retomada e resumo factual.
  - [x] Para cada lacuna real, preferir anotação/matriz ao novo mockup completo; qualquer conflito funcional volta ao spine.

- [x] **6. Promover, reconciliar e obter aprovação explícita** (AC: 1–6)
  - [x] Atualizar `DESIGN.md` somente com anatomia/variantes/estados visuais aprovados que ainda não estejam canônicos.
  - [x] Atualizar `EXPERIENCE.md` somente com comportamento, responsividade, acessibilidade e preservação de contexto aprovados que ainda não estejam canônicos.
  - [x] Atualizar decision log, rastreabilidade, validação ou handoff apenas se o workflow `bmad-ux` exigir esses artefatos.
  - [x] Produzir matriz AC → frame/anotação → fonte canônica → evidência de aprovação.
  - [x] Obter aprovação explícita de Hugo; marcar `done` somente após promoção e reconciliação sem divergências silenciosas.
  - [x] Só então liberar 14.1–14.10, respeitando domínio-primeiro e a ordem do sprint.

## Dev Notes

### Natureza desta story e fronteiras

- Esta story produz **decisões e artefatos UX**, não código de aplicação.
- **Não alterar `frontend/`, backend, schema, OpenAPI, dependências ou testes automatizados nesta story.**
- Não executar `dev-story`, story-automator ou QA de implementação. O executor correto é `bmad-ux` com aprovação humana.
- M06–M10 e seus mockups promovidos já são contrato:
  - `mockups/key-weekly.html`;
  - `mockups/key-monthly.html`;
  - `mockups/key-future-log.html`;
  - `mockups/key-recorrentes.html`;
  - `mockups/key-migracao.html`.
- O entregável visual novo esperado é `mockups/key-archive.html`. Complementos aos cinco spines só existem se uma lacuna comprovada exigir anotação/frame adicional.
- Não absorver débitos do Épico 13, deltas de domínio das Stories 14.1–14.4 nem implementação da 14.10.
- Daily legado permanece plenamente utilizável até o Épico 17; aliases legados só são removidos no Épico 18.

### Contrato do Arquivo

- Padrão Histórico: **filtros/período → lista/tabela → detalhe readonly**.
- Arquivo contém semanas e meses finalizados; o estado futuro autoritativo será `finalized` (AD-28), com histórico legado preservado.
- Fechado é legível, navegável e de contraste normal. Readonly não é disabled:
  - mutações desaparecem;
  - navegação, seleção, expansão, leitura do detalhe e seta de linhagem permanecem operáveis;
  - `Fechado` e `Somente leitura` aparecem textualmente onde eliminam ambiguidade.
- A seta de uma Task Row migrada navega ao sucessor imediato, abre período/container correto, posiciona e destaca a linha sem abrir automaticamente edição. O retorno preserva filtro, período, posição e foco.
- O índice atual não fornece conteúdo agregado: entrega apenas `type`, `weekStart` e `monthFirst`. Detalhes continuam usando rotas/queries dos logs. Não desenhar dependência em contrato inexistente.

### Estado atual dos arquivos inventariados

Os arquivos abaixo são **referência obrigatória de inventário**, não alvos de edição nesta x.0:

- `frontend/src/pages/archive/ArchivePage.tsx`
  - consulta o índice, mostra skeleton, vazio textual e lista simples de semana/mês;
  - não possui erro/retry, offline explícito, filtros/período ou detalhe próprio;
  - preserva deep links weekly/monthly.
- `frontend/src/pages/planner/WeeklyPage.tsx`
  - atende também `/archive/weekly/:weekStart`;
  - quando fechado, remove criação/recorrentes e impede abrir detalhe;
  - preserva dias, sem-dia e navegação entre períodos.
- `frontend/src/pages/planner/MonthlyPage.tsx`
  - atende também `/archive/monthly/:monthFirst`;
  - fechado remove formulário/recorrentes e detalhe;
  - preserva conteúdo por data/sem data e navegação.
- `frontend/src/features/bujo/components/TaskRow.tsx`
  - callbacks ausentes produzem readonly parcial, mas `Mover` ainda pode aparecer;
  - `completed` usa cor disabled;
  - linhagem ainda não oferece seta navegável ao sucessor.
- `frontend/src/app/router.tsx`
  - mantém `/archive`, `/archive/weekly/:weekStart` e `/archive/monthly/:monthFirst`.
- `frontend/src/app/layout/shell/shellRouting.ts`
  - Arquivo ainda é superfície legada dentro do shell novo; a futura 14.10 migra a rota, não esta x.0.
- `backend/bujo/services/archive.py`
  - hoje deriva fechamento por conteúdo + ausência de `pending`/`started`, inclui subtarefas, ordena do mais recente e é tenant-scoped;
  - AD-28 moverá a autoridade para o estado explícito sem apagar histórico legado.

### Guardrails de arquitetura e produto

- AD-16: passado aberto continua acionável; fechado é readonly; a fronteira de escrita deve ser única.
- AD-17: registry de collections é estático/puro. Arquivo é núcleo, não collection: permanece disponível com zero collections ligadas.
- AD-28: `WeeklyLog`/`MonthlyLog.status = finalized` será fonte operacional; chaves `week_start` e `month_first` permanecem.
- Nenhuma regra de finalização, filtro, API, schema ou mutação pode nascer do mockup.
- Coexistência/rollback é por superfície no ambiente de desenvolvimento/homologação; não adicionar toggle Legado/Moderno.
- O shell novo é moldura aprovada. Não alterar sidebar, topbar, bottom nav, captura, tokens ou regras de nav nesta story.

### Contrato visual e de voz

- Workspace canônico: `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/`.
- `DESIGN.md` e `EXPERIENCE.md` de 2026-07-17 vencem o workspace LEGACY de 2026-06-15.
- Linguagem visual: canvas contínuo, Inter, spacing 4px, radius 2–8px, zero elevation estrutural, hierarquia por espaço/divisor/tom e Task Row canônica.
- MUI fornece infraestrutura/comportamento, não aparência Material genérica; Phosphor é o catálogo de pictogramas.
- Voz pt-BR direta, serena e factual. Sem celebração, gamificação ou aparência disabled para conteúdo histórico.

### File Structure Requirements

Entregáveis esperados do futuro rito `bmad-ux`:

- `NEW` `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/mockups/key-archive.html`
- `UPDATE` `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/DESIGN.md`
- `UPDATE` `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md`
- `UPDATE` `.decision-log.md`, `requirements-traceability.md`, `validation-report.md` ou `architecture-and-story-handoff.md` **somente se** o rito exigir e houver conteúdo novo.
- Explorações ficam em `.working/`; somente a versão aprovada entra em `mockups/`.
- Nenhum arquivo de runtime deve constar na File List de conclusão desta story.

### Testing Requirements

Nesta x.0, “teste” significa validação do contrato UX:

- aprovação visual explícita de Hugo;
- matriz AC → frame/anotação → fonte → evidência;
- comparação com comportamento real e spines promovidos;
- walkthrough de filtros, lista, detalhe, linhagem e retorno;
- estados loading/empty/filter-empty/error/offline/readonly;
- matriz wide/medium/tablet/compact, 320 CSS px e zoom 200%;
- teclado, foco visível/não encoberto, leitor de tela, landmarks/headings e touch;
- contraste nas oito paletas e forced-colors;
- prova de que mutações estão ausentes e conteúdo fechado mantém contraste normal;
- prova de que collection ausente não cria destino fantasma ou conteúdo disabled;
- reconciliação final entre mockup, DESIGN e EXPERIENCE.

Os testes automatizados entram na Story 14.10. O inventário atual sugere cobrir futuramente ArchivePage/WeeklyPage/MonthlyPage/TaskRow, deep links, error/offline, filtros/posição, linhagem, axe e E2E representativo.

### Stack declarada/resolvida para o handoff

- `package.json`: React `^19.2.0`, TypeScript `~5.9.0`, Vite `^8.1.0`, MUI `^6.1.0`, TanStack Query `^5.59.0`, React Router `^6.30.4` e Phosphor `^2.1.10`.
- Testes vigentes: Vitest `^4.1.9`, Testing Library, jest-axe, Playwright `^1.61.1` e axe-core.
- Respeitar o lockfile nas stories de implementação. Não atualizar bibliotecas nesta x.0.
- Skeleton preserva a geometria e não é focável; tabs/filtros devem ter relações acessíveis explícitas. O DESIGN do projeto, não o exemplo visual do MUI, é autoridade.

### Inteligência do trabalho anterior

- Story 13.0/commit `ee50f10`: precedente direto — exploração `.working` → aprovação explícita → promoção para `mockups/` e documentos canônicos → reconciliação.
- Commits `1055990`, `d14e366` e `2fca13f`: o shell novo já existe; encaixar o Arquivo nele, sem redesenhá-lo.
- Commit `0ff2f87`: implementação original de fechamento/Arquivo; usar como histórico de comportamento, não como contrato visual atual.
- O Épico 13 ainda tem a 13.4 pendente. Preservar suas mudanças e débitos; a 14.0 não é veículo para corrigi-los.

### Pesquisa técnica atual

- WCAG 2.2 permanece a referência normativa do produto:
  - reflow em 320 CSS px;
  - foco não inteiramente encoberto;
  - target mínimo AA de 24×24px ou espaçamento equivalente; o projeto mantém piso mais forte de 44×44px para touch.
- Skeletons MUI não recebem ARIA nem foco por padrão; o container/região deve comunicar o estado quando necessário.
- Tabs MUI exigem nomes e associação tab/tabpanel; não copiar a aparência padrão Material.
- Referências oficiais:
  - [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
  - [W3C Understanding WCAG 2.2](https://www.w3.org/WAI/WCAG22/understanding/)
  - [MUI Skeleton](https://mui.com/material-ui/react-skeleton/)
  - [MUI Tabs](https://mui.com/material-ui/react-tabs/)

### Project Structure Notes

- O `key-archive.html` completa o conjunto M06–M10 sem substituí-lo.
- Arquivo é destino do núcleo e não depende de flags de collection.
- A Story 14.10 será responsável por código, migração da superfície e testes; a 14.0 apenas torna esse trabalho implementável e testável.
- Se a auditoria não encontrar lacunas em um spine, registrar “cobertura suficiente” é o resultado correto; não produzir frame por volume.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-14-Onda-3--Núcleo-BuJo-no-Sistema-Novo-gate-vertical]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-14.0-UX-Mockups-complementares-do-Núcleo-BuJo-x.0--gate-do-épico]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-14.10-Arquivo-no-sistema-novo]
- [Source: _bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md#Requisitos-Funcionais]
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-16--Passado-aberto-é-acionável-fechado-é-readonly]
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-17--Manifestregistry-estático-de-collections-fatia-1]
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-28--Deltas-de-domínio-dos-spines-M06M10]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/DESIGN.md#Component-Patterns]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md#Arquivo-e-ciclo-fechado]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/architecture-and-story-handoff.md]
- [Source: _bmad-output/implementation-artifacts/13-0-ux-spec-do-app-shell-novo.md]
- [Source: frontend/src/pages/archive/ArchivePage.tsx]
- [Source: frontend/src/pages/planner/WeeklyPage.tsx]
- [Source: frontend/src/pages/planner/MonthlyPage.tsx]
- [Source: frontend/src/features/bujo/components/TaskRow.tsx]
- [Source: backend/bujo/services/archive.py]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/review-rubric.md`
- `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/review-accessibility-archive.md`
- `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/validation-report.md`

### Completion Notes List

- Rito `bmad-ux` coaching/human-in-the-loop concluído com aprovação explícita de Hugo em 2026-07-24.
- M06–M10 auditados e mantidos fechados; nenhuma lacuna comprovada exigiu novo frame.
- Arquivo aprovado com abas Semanal/Mensal, filtros de data, lista, detalhe readonly, linhagem, estados obrigatórios e recomposição wide/medium/tablet/compact.
- `key-archive.html` promovido para `mockups/`; DESIGN/EXPERIENCE reconciliados e mantidos `status: final`.
- Future Vision aprovada como exploração não contratual e isolada em `.working/future-vision/`; ideias registradas em `deferred-features.md`.
- Reviewer Gate executado com Rubric Walker + Acessibilidade: 0 críticos; achados altos/médios/baixos corrigidos antes do handoff.
- Contraste load-bearing verificado nas oito paletas; testes de comportamento no app permanecem para a Story 14.10.
- Gate UX da 14.0 satisfeito. Stories 14.1–14.10 continuam subordinadas ao fechamento do Épico 13 e à ordem mestre.

### File List

- `_bmad-output/implementation-artifacts/14-0-ux-mockups-complementares-do-nucleo-bujo.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/planning-artifacts/deferred-features.md`
- `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/.decision-log.md`
- `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/DESIGN.md`
- `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md`
- `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/.working/archive-14-0-coverage-audit.md`
- `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/.working/key-archive.html`
- `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/.working/future-vision/README.md`
- `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/.working/future-vision/archive-lineage-options.html`
- `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/.working/future-vision/archive-future-vision.html`
- `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/mockups/key-archive.html`
- `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/reconcile-story-14-0.md`
- `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/story-14-0-evidence-matrix.md`
- `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/review-rubric.md`
- `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/review-accessibility-archive.md`
- `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/validation-report.md`
- `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/validation-report.html`
- `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/editorial-review-structure-14-0.md`
- `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/editorial-review-prose-14-0.md`
