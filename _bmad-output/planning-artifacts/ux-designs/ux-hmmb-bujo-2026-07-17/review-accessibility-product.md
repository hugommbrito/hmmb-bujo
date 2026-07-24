# Accessibility Review — HMMB BuJo

Data: 2026-07-24
Lente: produto consumer, WCAG 2.2 AA
Escopo revalidado integralmente: `DESIGN.md`, `EXPERIENCE.md`, `.decision-log.md`, `architecture-and-story-handoff.md`, `requirements-traceability.md`, `reconcile-story-13-0-app-shell.md`, Story 13.0, `review-rubric.md` e os mocks promovidos `mockups/key-app-shell-13-0.html` e `mockups/key-settings-appearance-nav-13-0.html`.

## Overall verdict

O contrato está **strong** para acessibilidade consumer WCAG 2.2 AA. A revalidação final não encontrou lacunas load-bearing nem divergências remanescentes entre spines, handoff, decisões e mocks: os oito temas passam os pares textuais e não textuais definidos; navegação, estados dinâmicos, foco, reflow, touch, preferências e resiliência estão comprometidos de forma implementável e testável.

Contagem: **0 critical · 0 high · 0 medium · 0 low**.

## 1. Estrutura, landmarks e anúncio de rota — strong

### Findings

Nenhum.

### Coverage notes

- `Pular para o conteúdo` é o primeiro controle focável e aponta para a única região `main` ativa, no heading da superfície.
- Topbar usa `header`; sidebar/rail, bottom nav e sheet usam `nav` com nomes distintos.
- Mudança de rota e sucesso não bloqueante usam `status`/live polite; erro bloqueante ou de escrita usa `alert` uma única vez.
- Erro de campo é associado programaticamente; saving combina `Salvando…` e `aria-busy`; progresso determinado usa `progressbar` nomeada.
- Título e RouteAnnouncer não duplicam anúncio.

## 2. Navegação, nomes, estados e badges — strong

### Findings

Nenhum.

### Coverage notes

- Destino ativo usa `aria-current="page"`; agrupadores usam `aria-expanded` e nunca recebem `aria-current`.
- Grupo recolhido com filho ativo associa `Contém a página atual: {destino ativo}.`.
- Alternador do Hoje usa `aria-pressed`; família, modo e atalhos formam grupos programáticos.
- Phosphor `fill` é canal adicional a indicador, fundo, peso textual e estado programático.
- Labels ocultos no rail/FAB mantêm nome acessível.
- Badge oculta zero/loading/erro, mostra `1`–`9`/`9+`, e conserva contagem exata e flexão no nome acessível.
- Nos mocks, os exemplos `9+` usam contagem exata ilustrativa de 17 itens no controle; o badge overlay não altera target ou layout.

## 3. Teclado, foco, overlays e movimento — strong

### Findings

Nenhum.

### Coverage notes

- Ordem de Tab acompanha leitura/recomposição e conteúdo colapsado não recebe foco.
- Sheet começa no destino ativo, contém foco, deixa o fundo inerte e retorna a Menu ao fechar sem navegar.
- Fechar, backdrop e `Escape` complementam o drag; gesto nunca é mecanismo único.
- Drag/reorder possui comando alternativo.
- Todo foco deve ficar integralmente visível; scroll padding/margin considera chrome fixo/sticky, FAB, teclado virtual e safe-area.
- Aceite cobre primeiro/último controles em 320 CSS px e zoom 200%.
- Reduced motion elimina deslocamentos sem suprimir feedback.

## 4. Reflow, zoom, safe-area e targets — strong

### Findings

Nenhum.

### Coverage notes

- Reflow em 320 CSS px e zoom 200% são obrigatórios sem perda de conteúdo/ação.
- Weekly/Monthly têm equivalentes compactos sem scroll horizontal da página.
- FAB, bottom nav e sheet respeitam safe-area.
- O projeto exige 44×44px para touch, acima do piso normativo de 24×24px; controles frequentes usam 48px e FAB usa 52px.

## 5. Cor, contraste e forced-colors — strong

### Findings

Nenhum.

### Coverage notes

- Todos os 32 pares semânticos `info/success/warning/danger` sobre seus fundos soft passam 4,5:1.
- Warning Mineral Light corrigido mede aproximadamente 4,76:1.
- Nas oito paletas, `ink/canvas`, `ink/surface`, `ink-muted` nos fundos usuais, `on-primary/primary`, `primary/surface` e `focus` sobre canvas/surface passam os limiares aplicáveis.
- `control-border` passa 3:1 contra `surface` e `canvas` em todos os temas. Contra `surface`: Mineral Light 5,88; Mineral Dark 7,94; Horizonte Light 5,70; Horizonte Dark 8,66; Bosque Light 5,74; Bosque Dark 8,68; Ameixa Light 6,01; Ameixa Dark 8,53.
- Inputs, selects, radios/checkboxes e boundaries necessários usam `control-border`; `border`/`border-strong` permanecem estruturais e não são fallback interativo.
- Focus ring passa 3:1 nos oito temas.
- Seleção, categorias, Eisenhower, status, erro e progresso mantêm forma/texto/ícone além da cor.
- Disabled só admite contraste menor quando realmente indisponível; readonly conserva contraste normal.
- Forced-colors/high contrast preserva forma, outline, estado e semântica por cores do sistema.

## 6. Estados de dados, rede e preferências — strong

### Findings

Nenhum.

### Coverage notes

- Loading preserva geometria; erro é local com retry/preservação; offline mantém leitura/cache disponível e indisponibiliza somente mutações de rede com motivo.
- Disabled comunica motivo quando necessário; readonly remove mutações sem degradar leitura.
- Aparência distingue aplicado de draft; saving bloqueia duplicação; erro preserva draft/tema vigente; sucesso aplica após confirmação.
- Preferência remota usa last-write-wins sem descartar draft local.
- Atalho inválido bloqueia Salvar; remoção externa usa fallback canônico sem duplicata.

## 7. App Shell mobile, sheet e seam legado — strong

### Findings

Nenhum.

### Coverage notes

- Bottom nav oferece três atalhos configuráveis + Menu fixo; Menu representa rota atual fora dos atalhos.
- Sheet contém todos os destinos e preserva grupos, ativo e badges.
- Conteúdo inferior fica inerte; sheet tem rolagem interna, trap, retorno e safe-area.
- Seam legado é textual, persistente, não dispensável e não depende apenas de cor.
- Zero/uma/todas collections e Saúde com um filho estão cobertos.

## 8. Semântica dos mocks estáticos — strong para a finalidade

### Findings

Nenhum.

### Coverage notes

- Ambos possuem skip link e uma única `main` de revisão.
- App Shell usa landmarks nomeados, `aria-current`, `aria-expanded`, descrição do grupo ativo e `inert` sob o sheet.
- Configurações usa `radiogroup` + `radio`/`aria-checked`, selects nativos, `aria-busy`, `status` e `alert`.
- Badges truncados preservam o valor exato no nome acessível dos controles.
- A nota visível impede que o markup estático seja tratado como implementação de comportamentos runtime; esses comportamentos continuam regidos pelo spine.

## Coverage summary

| Área solicitada | Resultado |
|---|---|
| Landmarks, nomes, estados e bypass | strong |
| `aria-current` / `expanded` / `pressed` / live/busy | strong |
| Anúncio de rota | strong |
| Teclado, trap, retorno, Escape/backdrop/drag | strong |
| Foco não encoberto | strong |
| 320 CSS px, zoom, reflow e scroll horizontal | strong |
| Safe-area e targets 44/24 | strong |
| Oito paletas: contraste textual e não textual | strong |
| Forced-colors/high contrast | strong |
| Informação além da cor | strong |
| Badge `9+`, valor exato e overlay compacto | strong |
| Loading/error/offline/disabled/readonly | strong |
| Reduced motion | strong |
| Draft/saving/error/configuração | strong |
| Seam legado | strong |
| Bottom nav + sheet | strong |
