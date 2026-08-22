# Story 13.0: [UX] Spec do App Shell novo

Status: done

> **Gate de execução:** apesar do status padronizado `ready-for-dev`, esta é uma story `x.0` de UX. Executar exclusivamente pelo rito **`bmad-ux` human-in-the-loop**. **Não executar com `dev-story` nem com story-automator.** As stories 13.1–13.4 permanecem bloqueadas até esta story ser aprovada, promovida aos artefatos canônicos e marcada `done`.

## Story

Como Hugo,
Quero a spec/mockup do shell aprovada no bmad-ux antes de qualquer implementação,
Para que o shell nasça desenhado para todos os seus estados reais — inclusive os que só existirão no futuro (UX-DR31, DIR-15).

## Acceptance Criteria

1. **Catálogo fechado e estados do shell**

   **Dado que** a estrutura do shell já foi aprovada na Fundação (Onda 1),
   **Quando** o rito `bmad-ux` human-in-the-loop rodar esta x.0,
   **Então** entrega o **catálogo fechado de ícones por destino** e os estados do shell derivados do manifest,
   **E** inclui obrigatoriamente:
   - `nav mínima` com **zero collections ligadas**;
   - `nav mínima` com **uma collection ligada**;
   - `seam legado`, mostrando uma superfície antiga dentro do shell novo durante as Ondas 2a–5, com tratamento deliberado e não acidental.

2. **Collections desligadas e promoção canônica**

   **Dado que** vigora a condição (c) da Sally (DIR-12),
   **Quando** os mockups são produzidos,
   **Então** todo estado `collection desligada/ausente` está representado,
   **E** o resultado aprovado é promovido para `DESIGN.md` e `EXPERIENCE.md` antes de qualquer story de implementação deste épico começar.

3. **Cobertura suficiente para o Épico 13**

   **Dado que** a spec será o contrato de entrada das Stories 13.1–13.4,
   **Quando** o pacote for submetido à aprovação de Hugo,
   **Então** ele fecha, sem ambiguidade, a composição wide/medium/compact, a escolha de três atalhos da bottom nav em Configurações, o acesso à navegação completa pelo quarto item fixo, a captura persistente, os estados do destino e badge, a anatomia da topbar e o tratamento do seam legado,
   **E** cada decisão é rastreável a requisito/decisão existente, sem introduzir funcionalidade originada apenas no mockup.

4. **Acessibilidade especificável e testável**

   **Dado que** o Épico 13 fecha com WCAG 2.2 AA e paridade verificável,
   **Quando** os estados e anotações de interação forem documentados,
   **Então** contemplam teclado, ordem de foco, foco visível e não encoberto, nome/estado acessível, anúncio de mudança de rota, semântica de navegação, touch targets, safe-area, zoom/reflow em 320 CSS px, contraste e comunicação que não dependa apenas de cor,
   **E** o mockup demonstra wide, medium/tablet e compact/mobile por recomposição, sem scroll horizontal de navegação.

## Tasks / Subtasks

- [x] **1. Executar o rito `bmad-ux` e confirmar o inventário do shell** (AC: 1–4)
  - [x] Reabrir somente as decisões pendentes desta x.0; não redesenhar tokens, estrutura-base ou spines já aprovados na Fundação.
  - [x] Inventariar no produto atual: destinos, grupos, ações, atalhos, badges, estados ativos, colapso, captura, anúncio de rota e comportamento responsivo.
  - [x] Confrontar o inventário com o manifest puro da Story 12.3 e separar explicitamente:
    - núcleo BuJo fora do registry;
    - collections derivadas do registry;
    - destinos ainda não implementados, que não devem aparecer desabilitados;
    - decisões futuras que a composição deve tolerar sem antecipar implementação.
  - [x] Registrar o rito como human-in-the-loop e obter aprovação explícita de Hugo.

- [x] **2. Fechar o catálogo semântico de ícones do shell** (AC: 1, 3, 4)
  - [x] Definir ícone, nome acessível e uso para cada destino atual:
    - núcleo: Hoje, Brain Dump, Arquivo e Configurações;
    - Planner: Esta Semana, Este Mês, Futuro e Recorrentes;
    - collections: Hábitos, Gratidão, Métricas e Medicamentos, incluindo o agrupador Saúde;
    - chrome necessário à composição: colapso, captura e overflow/menu mobile.
  - [x] Registrar rotas secundárias e históricos que não são destinos do chrome, evitando promovê-los acidentalmente à navegação principal.
  - [x] Limitar ícones de grupos/ações aos controles e agrupadores visíveis necessários para fechar a composição; não expandir a x.0 para uma auditoria geral de iconografia.
  - [x] Distinguir ícones de navegação/ação, pictogramas de domínio e vocabulário de estado; não usar um pictograma de domínio para comunicar conclusão, severidade ou estado.
  - [x] Tratar glyphs dos mockups `.working` e ícones MUI hoje existentes no código apenas como referências provisórias, não como aprovação automática.
  - [x] Especificar tamanhos, `currentColor`, variantes active/hover/focus/pressed/selected/disabled e comportamento no rail colapsado.
  - [x] Garantir que texto/estado acessível preserve o significado quando o label visual estiver oculto.

- [x] **3. Produzir o mockup/spec responsivo do App Shell** (AC: 1–4)
  - [x] Demonstrar **wide ≥1440px**: sidebar 240px, topbar 56px, workspace máximo 1440px e gutter 32px.
  - [x] Demonstrar **medium 1024–1439px** e **tablet 768–1023px**: decisão explícita de sidebar expandida/rail 64px, recomposição do workspace e token de gutter aplicável a cada faixa.
  - [x] Demonstrar **compact <768px**, incluindo 320 CSS px: topbar, bottom nav com exatamente três destinos escolhidos pela pessoa e um quarto item fixo que abre o menu com a navegação completa, gutter 16px e safe-area.
  - [x] Fechar anatomia e comportamento de:
    - destino ativo (indicador lateral + peso do label + selected state; nunca cor isolada);
    - badges sem deslocar labels e ainda perceptíveis no estado colapsado;
    - colapso/persistência e atalho `[`;
    - acesso ao Brain Dump por `B`;
    - topbar e anúncio de mudança de superfície;
    - captura persistente com badge, indisponibilidade offline e motivo acessível;
    - retorno de foco e preservação de conteúdo no Capture Sheet;
    - menu mobile que, ao abrir, mostra **todos os destinos disponíveis** na ordem e nos agrupamentos canônicos — núcleo BuJo e todas as collections ligadas — inclusive os destinos frequentes já presentes na bottom nav; o menu não é somente overflow dos itens excedentes;
    - destino ativo, badges e estados aplicáveis preservados também na listagem completa do menu.
  - [x] Especificar em **Configurações** o controle que permite escolher quais **três destinos disponíveis** ocupam os três primeiros itens da bottom nav; o quarto item é reservado e não configurável, com nome/ícone acessível para abrir o menu completo.
  - [x] Cobrir na matriz de estados o que a configuração apresenta quando collections são ligadas/desligadas ou deixam de estar disponíveis, sem manter atalhos para destinos ausentes.
  - [x] Não assumir FAB circular: escolher a composição da captura persistente coerente com o shell.

- [x] **4. Cobrir a matriz obrigatória de estados** (AC: 1–4)
  - [x] Representar navegação normal com todas as collections atualmente implementadas.
  - [x] Representar `nav mínima — zero collections`: núcleo BuJo e Planner-base completo; nenhuma lacuna visual, grupo vazio ou item futuro desabilitado.
  - [x] Representar `nav mínima — uma collection`: agrupamento e hierarquia sem títulos vazios.
  - [x] Representar collection desligada/ausente em cada composição na qual o comportamento divergir; onde for invariável, usar matriz/anotação inequívoca em vez de duplicar frames.
  - [x] Representar o `seam legado`: conteúdo legado reconhecível dentro do shell novo, sem toggle Legado/Moderno, sem fingir migração concluída e sem constranger a superfície interna.
  - [x] Especificar estados default, hover, focus, pressed, selected, disabled, loading, empty, error, offline e readonly quando aplicáveis ao shell.
  - [x] Registrar como o shell tolera mudanças futuras de home e collections sem cristalizar `Hoje` como destino pós-login definitivo nesta story.

- [x] **5. Promover os artefatos aprovados** (AC: 2–4)
  - [x] Promover o mockup aprovado para `ux-designs/ux-hmmb-bujo-2026-07-17/mockups/`.
  - [x] Atualizar `DESIGN.md` com catálogo fechado, anatomia, medidas, variantes e estados do App Shell.
  - [x] Atualizar `EXPERIENCE.md` com regras comportamentais, responsivas, de acessibilidade e coexistência.
  - [x] Se o workflow `bmad-ux` acionado exigir decision log ou relatório de validação, atualizar os paths definidos por ele; não criar artefato auxiliar sem contrato no rito.
  - [x] Verificar que o workspace de 2026-06-15 continua tratado como `LEGACY`.
  - [x] Marcar a story `done` somente após aprovação de Hugo e promoção canônica; só então liberar 13.1–13.4/story-automator.

## Dev Notes

### Natureza desta story e fronteiras

- Esta story produz **decisões e artefatos UX**, não código de aplicação.
- **Não alterar `frontend/`, backend, schema, OpenAPI, dependências ou testes automatizados nesta story.**
- A x.0 é deliberadamente enxuta: a estrutura-base do shell e o contrato visual já foram aprovados. O trabalho é fechar o catálogo de ícones e os estados que ainda bloqueiam implementação.
- Não reabrir nesta story:
  - decisões cromáticas já fechadas nesta x.0: Mineral, Horizonte Azul, Bosque Sálvia e Ameixa Editorial, cada família com Light e Dark;
  - Dashboard/Home pós-login, resolvido pela Story 17.0;
  - migração Gratidão → Journalling, resolvida nos Épicos 16/18;
  - flags/server state de ativação, entregues no Épico 10;
  - Custom Collections dinâmicas, entregues no Épico 19.
- Não adicionar seletor Legado/Moderno. A coexistência é por rota/superfície e o seam deve ser explícito, discreto e transitório.
- Durante as ondas, prod permanece no sistema atual. A coexistência e o rollback por superfície pertencem a dev/homologação; rollback de prod significa não promover até a consolidação.

### Contratos UX canônicos

- Workspace vigente: `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/`.
- Workspace de 2026-06-15: referência histórica marcada como `LEGACY`; não promover decisões dali sobre as atuais.
- Linguagem visual:
  - canvas papel-mineral, tinta e verde-petróleo canônicos;
  - Inter e escala tipográfica do DESIGN vigente;
  - spacing base 4px, radius 2–8px;
  - zero elevation estrutural; bordas/tom/posição criam hierarquia;
  - MUI continua infraestrutura de comportamento acessível, não fonte da aparência;
  - trabalho em primeiro plano, densidade legível, calma operacional e estrutura sem cards decorativos.
- Voz: pt-BR direta, serena e específica; sem celebração, gamificação ou linguagem julgadora.

### Contrato do manifest

- `frontend/src/app/collections/registry.ts` é registro estático e puro: sem hooks, TanStack Query, side effects ou flags de ativação.
- Uma entrada contém identidade, nome, ícone, rotas lazy, metadata de navegação e archetype; `dashboardCard`/`settingsSchema` são extensões reservadas.
- Núcleo BuJo fica fora do registry. Collections coded são derivadas por `map` puro.
- Ativação futura será consulta separada que filtra o registro; não adicionar server state ao manifest.
- Hoje existem quatro collections implicitamente ativas; zero/uma collection são estados futuros reais por causa do default all-off de convidados, não meros edge cases.
- Como os itens de navegação variam conforme as collections ligadas, o menu mobile é a visão completa e dinâmica da navegação disponível. A bottom nav contém três atalhos configuráveis e um quarto item fixo para abrir esse menu; ela não filtra nem remove os três destinos escolhidos da listagem completa.

### Estado atual a considerar no design

Os arquivos abaixo são **referência de inventário**, não alvos de edição nesta story:

- `frontend/src/app/layout/AppLayout.tsx`
  - hoje alterna Sidebar/BottomNav por breakpoint;
  - mobile não possui topbar;
  - estado de colapso é local e não persistido;
  - atalhos `[` e `B` já existem no desktop.
- `frontend/src/app/layout/Sidebar.tsx`
  - 240px expandida e 56px colapsada; contrato novo exige 64px;
  - núcleo é hardcoded e collections são parcialmente derivadas;
  - ativo já combina borda, fundo, peso e `aria-current`;
  - badge do Brain Dump existe; grupos vazios/nav mínima ainda não existem.
- `frontend/src/app/layout/BottomNav.tsx`
  - quatro destinos fixos, sem menu de excedentes;
  - FAB atual abre o Capture Sheet, mostra badge e fica disabled offline;
  - a forma circular não é vinculante para o novo shell.
- `frontend/src/app/router.tsx` e `RouteAnnouncer.tsx`
  - registry alimenta rotas lazy;
  - anúncio de rota usa `role=status`/`aria-live=polite`;
  - `/today` é o redirect atual, mas a home futura será resolvida no Épico 17.
- `frontend/src/features/braindump/components/BrainDumpCaptureSheet.tsx`
  - preserva texto em erro, gerencia foco e confirmação de descarte; deve ser reutilizado nas implementações futuras.
- `frontend/src/features/braindump/components/BrainDumpBadge.tsx`
  - badge é server state derivado, possui nome acessível e desaparece em zero.
- `frontend/src/theme.ts` e `frontend/src/index.css`
  - tokens e piso de targets já existem; a spec não deve inventar um sistema paralelo.

### O que a spec precisa destravar

- **13.1:** AppLayout novo, topbar 56px, canvas contínuo, workspace 1440px, coexistência por rota e checklist de paridade.
- **13.2:** sidebar 240/64px derivada do manifest, colapso preservado somente durante a sessão, badge, ativo e atalho `[`.
- **13.3:** topbar, bottom nav com três atalhos configuráveis + abertura fixa do menu completo, safe-area e captura persistente reutilizando a superfície existente.
- **13.4:** paridade e WCAG 2.2 AA em wide/medium/compact, reflow, teclado, foco, screen reader e regressão visual.

### Critérios de qualidade do artefato

- Cada ação/estado no mockup precisa apontar para PRD, épico, código existente ou decisão canônica. Ausência de fonte significa exclusão ou decisão upstream explícita, nunca feature silenciosamente inventada.
- Preferir uma matriz de estados/anotações junto ao mockup a duplicar páginas completas quando somente um detalhe muda.
- O mockup precisa tornar implementável e testável:
  - hierarquia e ordem dos destinos;
  - dimensões e gutters;
  - navegação mobile completa e dinâmica, sem tratar o menu apenas como overflow;
  - foco, nomes acessíveis, leitura e navegação por teclado;
  - comportamento de badge e conteúdo dinâmico;
  - seam legado e estados de ativação.
- WCAG 2.2 AA exige, entre outros, reflow sem perda em 320 CSS px, foco não totalmente encoberto e target mínimo normativo de 24×24px salvo exceções. O projeto mantém piso mais forte de **44×44px para controles touch**.

### Pesquisa técnica atual

- A Story 13.0 não deve atualizar bibliotecas: versões vigentes são contrato do repositório e upgrades pertencem às stories de implementação.
- Referências oficiais consultadas para validar o piso:
  - [WCAG 2.2 — recomendação normativa](https://www.w3.org/TR/WCAG22/)
  - [W3C Understanding WCAG 2.2](https://www.w3.org/WAI/WCAG22/understanding/)
  - [MUI — responsive Drawer](https://mui.com/material-ui/react-drawer/)
- Não copiar o layout padrão do MUI Drawer: o DESIGN do projeto é autoridade visual e MUI fornece somente infraestrutura/comportamento.

### Stack declarada/resolvida para handoff às stories 13.1–13.4

- O `package.json` declara React/ReactDOM `^19.2.0`, TypeScript `~5.9.3`, Vite `^8.1.0`, MUI `^6.1.0`, MUI Icons `^6.5.0`, Emotion `^11.13.x`, React Router `^6.30.4` e TanStack Query `^5.59.0`.
- O lockfile atual resolve, entre outros, MUI Material `6.5.0` e TanStack Query `5.101.1`; a implementação deve respeitar o lockfile, não interpretar o piso semver como versão instalada.
- A suíte declarada inclui Vitest, Testing Library, user-event, jest-axe e Playwright.
- Não transformar essas versões em escopo de upgrade na x.0.

### Project Structure Notes

- Entregáveis esperados:
  - `UPDATE` `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/DESIGN.md`
  - `UPDATE` `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md`
  - mockup aprovado promovido pelo rito para `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/mockups/`
  - eventuais artefatos auxiliares somente nos paths e formatos exigidos pelo workflow `bmad-ux`
- Insumos `.working/key-app-shell.html` e `.working/key-app-shell-v2.html` não são contrato final:
  - contêm glyphs provisórios;
  - ainda deixam descoberta mobile de Arquivo/Gratidão/Configurações em aberto;
  - não cobrem nav mínima, collection off/ausente ou seam legado integralmente.
- Nenhum arquivo de código deve aparecer na File List de conclusão desta story.

### Testing Requirements

Nesta x.0, “teste” significa validação do contrato de UX:

- revisão visual human-in-the-loop por Hugo;
- matriz AC → frame/anotação → decisão canônica;
- inspeção wide/medium/tablet/compact e 320px;
- walkthrough de teclado/foco/leitor de tela/touch;
- contraste e distinção sem cor isolada;
- comparação com inventário real para provar paridade e ausência de feature inventada;
- validação de que DESIGN/EXPERIENCE e mockup promovido não divergem.

Os testes automatizados entram nas stories seguintes. A 13.1 deve introduzir axe-core no Playwright e a checklist enumerada de paridade; 13.4 fecha a matriz wide/medium/compact.

### Git Intelligence

- `7b866dc feat(story-12.3): Manifest de collections, fatia 1 (pixel-idêntico)` é o commit upstream diretamente relevante.
- Os commits 12.1, 12.2, 12.4 e 12.5 são majoritariamente backend e não ampliam o escopo visual desta story.
- Não há story anterior no Épico 13; a principal inteligência anterior está na Story 12.3 e no gate da Fundação já aprovado.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-13-Onda-2a--App-Shell-no-Sistema-Novo]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-13.0-UX-Spec-do-App-Shell-novo-x.0--gate-do-épico]
- [Source: _bmad-output/planning-artifacts/epics.md#Diretrizes-e-Decisões-de-UX]
- [Source: _bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md#Requisitos-Funcionais]
- [Source: _bmad-output/planning-artifacts/architecture.md#AD-17--Manifestregistry-estático-de-collections-fatia-1]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/DESIGN.md#App-Shell]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md#Component-Patterns]
- [Source: _bmad-output/specs/spec-design-system-migration/design-system-contract.md]
- [Source: _bmad-output/specs/spec-design-system-migration/migration-plan.md]
- [Source: _bmad-output/planning-artifacts/implementation-readiness-report-2026-07-23.md]
- [Source: _bmad-output/implementation-artifacts/12-3-manifest-de-collections-fatia-1-pixel-identico.md]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Customização resolvida por `_bmad/scripts/resolve_customization.py`; sem activation steps adicionais.
- Análise paralela: épicos/PRD; arquitetura/código; UX/migração/Git.
- Pesquisa oficial: W3C WCAG 2.2 e MUI Drawer responsivo.

### Completion Notes List

- Rito `bmad-ux` human-in-the-loop concluído e aprovado por Hugo em 2026-07-24, sem implementação de código.
- ACs 1–4 e Tasks 1–5 auditados como cumpridos; Rubric Walker e revisão de acessibilidade concluíram com zero findings.
- Catálogo Phosphor, navegação responsiva, captura persistente, topbar, badges, seam legado, configuração mobile e estados zero/uma/todas collections foram fechados.
- `DESIGN.md` e `EXPERIENCE.md` foram reconciliados, revisados editorialmente e promovidos como contratos canônicos; os dois key mocks aprovados foram promovidos para `mockups/`.
- Superfícies fora do gate permanecem spine-only/diferidas para 16.0, 16.3, 16.10, Épicos 17, 18 e demais ondas registradas.
- Workspace de 2026-06-15 verificado como `LEGACY`; nenhuma questão funcional bloqueadora permanece para as Stories 13.1–13.4.

### File List

- `_bmad-output/implementation-artifacts/13-0-ux-spec-do-app-shell-novo.md`
- `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/DESIGN.md`
- `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md`
- `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/.decision-log.md`
- `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/reconcile-story-13-0-app-shell.md`
- `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/architecture-and-story-handoff.md`
- `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/requirements-traceability.md`
- `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/review-rubric.md`
- `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/review-accessibility-product.md`
- `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/validation-report.md`
- `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/validation-report.html`
- `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/editorial-review-structure.md`
- `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/editorial-review-prose.md`
- `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/mockups/key-app-shell-13-0.html`
- `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/mockups/key-settings-appearance-nav-13-0.html`
