# Spine Pair Review — hmmb-bujo

## Overall verdict

O par está **quebrado como contrato para produção de mockups de todas as telas**: a direção, a arquitetura de informação de alto nível e os limites de produto estão claros, mas jornadas, catálogo bilateral de componentes, matriz de estados por superfície e referências visuais ainda não fecham a cobertura downstream. Antes de renderizar o conjunto completo, é necessário transformar a lista de destinos em um inventário explícito de telas/variantes e resolver os contratos visuais que hoje dependem de interpretação.

## 1. Flow coverage — broken

Foram confrontados UJ-1 a UJ-8, FR-0 a FR-6, capacidades CAP-1 a CAP-5 e as superfícies do app shell contra os quatro Key Flows existentes.

### Findings

- **[critical]** Os quatro fluxos não cobrem nominalmente as oito jornadas do PRD: faltam fluxos completos para **UJ-3 — Abertura do Mês**, **UJ-5 — Future Log**, **UJ-6 — Diário de Gratidão**, **UJ-7 — Saúde e Medicamentos** e **UJ-8 — Configuração de Hábitos**; o Fluxo 1 absorve apenas parte da UJ-1 e o Fluxo 2 não espelha integralmente a UJ-2 (EXPERIENCE.md §Key Flows, linhas 219–250; PRD §4). *Fix:* criar uma tabela UJ/FR → fluxo e adicionar jornadas nomeadas, numeradas, com clímax e falha para cada necessidade/superfície; jornadas compostas podem servir mais de uma UJ se o vínculo for explícito.
- **[high]** Mês, Future, Recorrentes, Brain Dump em processamento, Configurações, Hábitos, Saúde, Medicamentos e Gratidão estão na IA, mas nenhuma jornada termina em várias dessas superfícies; a closure IA↔journey não está satisfeita (EXPERIENCE.md linhas 42–71). *Fix:* fechar cada superfície com ao menos uma jornada que chegue, aja e produza um resultado verificável.
- **[high]** Autenticação é funcionalidade implementada e entra na Onda 6, porém login, sessão expirada/renovada e recuperação de acesso não aparecem na IA nem em Key Flows (EXPERIENCE.md linhas 178–188; fontes FR-0.2 e Épico 2). *Fix:* inventariar as superfícies reais de auth e incluir o fluxo mínimo de entrada/retomada, sem criar gestão de usuários futura.
- **[medium]** Somente o Fluxo 3 explicita uma falha dentro dos passos; Catch-Up, planejamento semanal e consulta de arquivo não definem falha/indisponibilidade aplicável (EXPERIENCE.md linhas 221–250). *Fix:* adicionar failure paths concisos para leitura, escrita, retomada e ciclo que muda de estado durante a ação.

## 2. Token completeness — thin

Foram extraídos 23 tokens de cor, 6 de tipografia, 5 de raio, 9 de spacing, 6 grupos de componentes e todas as referências `{path.to.token}`.

### Findings

- **[critical]** `colors.overlay` usa `rgba(...)`, embora o tipo `colors` do DESIGN.md exija valor hexadecimal; consumidores que espelham tokens não podem tratá-lo como color token válido (DESIGN.md linha 38; design-md-spec §Frontmatter tokens). *Fix:* fornecer hexadecimal de oito dígitos compatível com o contrato ou retirar a opacidade para um token tipado fora de `colors` conforme a especificação adotada.
- **[high]** A referência `{components.focus-ring.*}` não é um path resolvível: `*` não é uma chave definida do YAML (EXPERIENCE.md linha 159; DESIGN.md linhas 88–91). *Fix:* referenciar propriedades concretas (`color`, `width`, `offset`) ou criar um token semântico único válido.
- **[high]** WCAG 2.2 AA é declarado, mas não há alvos/ratios para combinações load-bearing como `ink/canvas`, `ink-muted/canvas`, `primary/on-primary`, texto semântico sobre fundos soft, bordas/foco e estados disabled (DESIGN.md linhas 112–125; EXPERIENCE.md linhas 155–165). *Fix:* registrar as combinações obrigatórias e seus alvos mínimos; validar antes de congelar a paleta.
- **[high]** A fundação contratual pede tokens de borda, elevação, opacidade, densidade, breakpoints e estados; vários permanecem apenas em prosa ou valores locais dentro de componentes, impedindo reutilização consistente (DESIGN.md linhas 62–91 e 133–152; design-system-contract.md §Fundação reutilizável). *Fix:* promover os valores estruturais compartilhados para tokens semânticos ou declarar explicitamente a herança MUI para cada categoria não sobrescrita.
- **[medium]** A decisão de usar Inter não define carregamento/fallback nem confirma se a família é ativo disponível; isso é relevante antes de mockups de fidelidade visual (DESIGN.md linhas 39–45 e 127–131). *Fix:* definir stack de fallback e origem/licença ou marcar a escolha como pendente até validação visual.

## 3. Component coverage — broken

Foram comparados os nomes do YAML, os dez grupos visuais de DESIGN.md, os onze padrões comportamentais de EXPERIENCE.md e a fundação obrigatória do contrato de design system.

### Findings

- **[critical]** Não existe catálogo bilateral com nomes idênticos: DESIGN usa `Task/Item Row`, `Panel e Section Header`, `Date/Range Controls`, `Data Grid e Calendar`, `Dialog, Sheet e Ritual`; EXPERIENCE separa ou renomeia esses conceitos como `Task Row`, `Item Row`, `Panel`, `Section Header`, `Date/Range Control`, `Grid/Calendar`, `Dialog/Sheet` e `Full-screen Flow` (DESIGN.md linhas 154–194; EXPERIENCE.md linhas 87–101). *Fix:* estabelecer um nome canônico por componente e uma linha visual + uma linha comportamental para cada um.
- **[high]** O frontmatter oferece tokens somente para app shell, workspace, task row, panel, chip e focus ring; Page/Period Header, Item Row, Section Header, controles de data, grid/calendar, overlays e feedback não têm objeto de componente consumível (DESIGN.md linhas 62–91). *Fix:* completar `components:` com anatomia/tokens dos componentes aprovados ou declarar precisamente quais herdam MUI sem delta.
- **[high]** `Workspace Surface` e `Feedback` têm especificação visual mas nenhuma linha comportamental homônima; `Item Row`, `Section Header` e `Full-screen Flow` têm comportamento, mas não especificação visual independente (DESIGN.md linhas 164–194; EXPERIENCE.md linhas 89–101). *Fix:* completar os pares antes de desenhar variantes por tela.
- **[high]** Controles essenciais usados pelas telas — Button/Icon Button, campos de texto/número/enum, checkbox/controle de status, menu, tabs/filtros, toast/banner, progress, formulário/composer e gráficos — não possuem contratos bilateralmente definidos nem uma declaração suficiente de herança MUI (DESIGN.md linhas 110 e 154–194; EXPERIENCE.md linhas 87–122). *Fix:* inventariar o componente real de cada ação/estado e definir somente os deltas visuais e comportamentais sobre MUI.
- **[medium]** O componente de captura persiste conceitualmente, mas o contrato oscila entre FAB existente e uma linguagem do shell ainda não decidida (DESIGN.md linha 152; migration-plan.md Onda 4). *Fix:* decidir e nomear a primitiva de captura que será mockada em desktop e mobile, preservando a funcionalidade atual.

## 4. State coverage — broken

Foram percorridas as superfícies Hoje, Semana, Mês, Futuro, Recorrentes, Brain Dump, Arquivo, Configurações, Migração/Catch-Up/placement, Hábitos, Saúde, Medicamentos, Gratidão e auth inferida das fontes.

### Findings

- **[high]** A tabela de estados é global e não registra quais estados se aplicam a cada superfície; assim, não define o conjunto de mockups/variantes necessário para “todas as telas” (EXPERIENCE.md linhas 124–140). *Fix:* adicionar matriz superfície × cold-load/empty/filtro vazio/read error/write error/offline/disabled/readonly/closed/focus/optimistic, com “N/A” justificado.
- **[high]** Estados específicos de domínio estão subespecificados: ritual sem pendências, ritual parcialmente salvo/retomado, destination inválido/deduplicado, período passado aberto, ciclo fechável/não fechável, Future sem data, recorrente ativo/inativo e dose perdida (EXPERIENCE.md linhas 103–122). *Fix:* nomear os estados que mudam composição ou ação e vinculá-los às respectivas telas.
- **[high]** Auth não tem cold-load, sessão renovando, credencial inválida, sessão expirada e acesso negado; Configurações não tem validação, dirty/save e conflito/falha (EXPERIENCE.md linhas 42–71 e 124–140). *Fix:* inventariar estados implementados nessas rotas antes da Onda 6 e representá-los no plano de mockups.
- **[medium]** Focus/pressed/selected/hover são exigidos pelo contrato upstream, mas aparecem apenas como regras dispersas, não como estados verificáveis por componente (design-system-contract.md §Decisões reservadas; DESIGN.md linhas 156–194). *Fix:* acrescentar uma matriz de estados interativos por componente e usá-la no catálogo visual.

## 5. Visual reference coverage — broken

Foram listados todos os arquivos em `imports/`; não existem diretórios `mockups/` ou `wireframes/` promovidos neste workspace.

### Findings

- **[critical]** Não há nenhum mockup canônico do novo style guide; portanto, paleta, densidade, shell, grids, ritual e responsividade não foram validados visualmente (workspace sem `mockups/` e `wireframes/`; `.decision-log.md` linha 14). *Fix:* produzir e promover mockups de todas as superfícies/variantes inventariadas, começando pelo catálogo da fundação e pelos gates Daily + Planner/Migração.
- **[high]** Os nove HTMLs do handoff, três JS, quatro fontes e README estão em `imports/`, mas os spines linkam somente o README no frontmatter e não nomeiam inline o que cada arquivo ilustra (DESIGN.md linha 14; EXPERIENCE.md linha 15 e §Inspiration). *Fix:* vincular inline somente as referências relevantes, com descrição qualitativa e decisão de aproveitamento/rejeição; marcar JS/fontes como referência descartada ou removê-los do conjunto de inputs ativos.
- **[high]** A frase “spines vencem em conflito” existe, mas não acompanha referências específicas nem uma tabela de cobertura visual por superfície e breakpoint (DESIGN.md linha 96; EXPERIENCE.md linha 20). *Fix:* manter a regra uma vez e criar inventário `superfície × wide/medium/compact × estado-chave × arquivo`.
- **[medium]** `reconcile-mybujo-full-handoff.md` reconcilia conceitos por superfície, porém não é linkado inline nos spines e não rastreia arquivo a arquivo (reconcile-mybujo-full-handoff.md; DESIGN.md/EXPERIENCE.md). *Fix:* citar a reconciliação no trecho de inspiração e complementar com os arquivos efetivamente usados.

## 6. Bloat & overspecification — adequate

O par é relativamente compacto e separa bem visual de comportamento, mas repete algumas decisões upstream.

### Findings

- **[medium]** `Migration Strategy`, `UX Acceptance Criteria` e `Decisions for Architecture and Stories` repetem conteúdo substancial da SPEC/migration-plan em vez de manter apenas deltas de UX (EXPERIENCE.md linhas 178–211). *Fix:* preservar gates UX exclusivos e substituir o restante por referências nominais às fontes.
- **[low]** Breakpoints e regras de layout aparecem quase iguais nos dois spines (DESIGN.md linhas 133–144; EXPERIENCE.md linhas 167–176). *Fix:* deixar DESIGN como dono da geometria e EXPERIENCE apenas descrever recomposição/comportamento por faixa.

## 7. Inheritance discipline — broken

Todos os caminhos `sources:` resolvem, mas as listas, nomes de requisitos e vocabulário de componentes não são consistentes entre os contratos.

### Findings

- **[high]** DESIGN.md omite `addendum.md` e `sprint-status.yaml`, enquanto EXPERIENCE.md os declara; consumidores visuais e comportamentais partem de conjuntos de autoridade diferentes (DESIGN.md linhas 7–14; EXPERIENCE.md linhas 6–15). *Fix:* alinhar as fontes ou documentar por que uma fonte se aplica somente a um spine.
- **[high]** Os nomes UJ-1…UJ-8, CAP-1…CAP-5 e FRs não são espelhados verbatim na rastreabilidade dos fluxos; “Fluxo 1…4” impede extração determinística (EXPERIENCE.md linhas 219–250). *Fix:* incluir identificadores upstream nos títulos ou em uma tabela de cobertura.
- **[high]** Nomes de componentes divergem em singular/plural, agrupamento e idioma entre YAML, DESIGN e EXPERIENCE, quebrando source-extraction por nome (DESIGN.md linhas 62–91 e 154–194; EXPERIENCE.md linhas 87–101). *Fix:* adotar glossário canônico e usar exatamente o mesmo label em todos os lugares.
- **[medium]** O texto afirma herdar MUI, mas não delimita quais componentes/tokens ficam “as-is” e quais recebem delta, o que abre espaço para implementações Material genéricas ou customizações conflitantes (DESIGN.md linha 110; EXPERIENCE.md linha 24). *Fix:* registrar uma tabela MUI herdado / sobrescrito / proibido.

## 8. Shape fit — strong

DESIGN.md contém as oito seções opcionais na ordem canônica. EXPERIENCE.md contém Foundation, Information Architecture, Voice and Tone, Component Patterns, State Patterns, Interaction Primitives, Accessibility Floor e Key Flows; Responsive & Platform e Inspiration & Anti-patterns estão corretamente presentes para a aplicação multi-breakpoint e o handoff de referência.

### Findings

- **[low]** As seções inventadas de migração e handoff downstream são justificadas pelo brownfield, mas podem ser reduzidas após a rastreabilidade estar formalizada para preservar legibilidade (EXPERIENCE.md linhas 178–217). *Fix:* conservar apenas decisões de UX não duplicadas nas fontes.

## Mechanical notes

- Todos os caminhos declarados em `sources:` resolvem a partir de seus respectivos arquivos.
- Todas as referências explícitas `{path.to.token}` de DESIGN.md resolvem; a exceção é o wildcard não resolvível `{components.focus-ring.*}` em EXPERIENCE.md.
- `colors.overlay` viola o tipo hexadecimal esperado para `colors`.
- Não há Mermaid nos spines.
- Não existem `mockups/` ou `wireframes/`; os 17 arquivos importados (README, 9 HTMLs, 3 JS e 4 TTFs) não têm cobertura inline individual.
- Inconsistências nominais principais: `workspace`/`Workspace Surface`; `task-row`/`Task Row`/`Task/Item Row`; `Date/Range Controls`/`Date/Range Control`; `Data Grid e Calendar`/`Grid/Calendar`; `Dialog, Sheet e Ritual`/`Dialog/Sheet`/`Full-screen Flow`; `Feedback` sem par comportamental.
- Não há mapa de mockups. Para a exigência atual, o mínimo é inventariar cada rota/superfície e seus estados visualmente distintos antes de renderizar, evitando que “todas as telas” seja interpretado apenas como um screenshot feliz por destino.
