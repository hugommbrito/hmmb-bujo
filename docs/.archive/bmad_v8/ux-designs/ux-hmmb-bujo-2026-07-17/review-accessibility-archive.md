# Accessibility Review — Arquivo / Story 14.0

## Veredito

**Adequado com correções importantes antes do handoff.** Os spines estabelecem um piso forte de WCAG 2.2 AA, preservação de contexto, foco, readonly, offline e reflow. Os tokens também cumprem os contrastes load-bearing declarados nas oito paletas. Entretanto, o mock canônico contradiz parte desse contrato em alvos, tipografia, controles de status readonly e semântica de abas; se usado como referência visual sem ressalvas operacionais, pode induzir uma implementação inacessível.

## Escopo e método

Foram revisados:

- `DESIGN.md`, com foco nos tokens das oito paletas, Arquivo, Task Row e Do's and Don'ts;
- `EXPERIENCE.md`, com foco em Arquivo e ciclo fechado, State Patterns, Interaction Primitives, Accessibility Floor e Fluxo 4;
- `.working/key-archive.html`, como referência canônica aprovada da Story 14.0.

Critérios: WCAG 2.2 AA, teclado e foco, landmarks/headings, nomes/estados acessíveis, contraste, forced-colors, targets, reflow a 320 CSS px/zoom 200%, estados de disponibilidade e ausência de mutações.

## Achados

### High

1. **Controles de status continuam focáveis em conteúdo readonly e possuem nomes inacessíveis.** O mock renderiza status concluído, pendente e cancelado como `<button class="status">✓/○/×</button>` nas linhas do detalhe (`key-archive.html:73`, `:75`, `:94–96`). Isso contradiz o contrato de que mutações desaparecem no Arquivo (`DESIGN.md`, Arquivo; `EXPERIENCE.md`, Arquivo e ciclo fechado) e cria controles focáveis cujo nome é apenas um glifo, sem ação readonly definida.
   **Correção:** renderizar status terminal/não navegável como conteúdo semântico não interativo, com texto acessível do estado e ícone decorativo; manter como botão/link somente a seta de linhagem, com nome que inclua tarefa e destino quando conhecido.

2. **A composição usa texto essencial abaixo do mínimo contratado e fica vulnerável em zoom/reflow.** Títulos de tarefa aparecem em 12px, descrições e metadados em 9–11px, navegação compacta em 10px e feedback em 10px (`key-archive.html:28–30`, `:44–53`). Isso conflita diretamente com “não reduza texto essencial abaixo de 14px” (`DESIGN.md`, Do's and Don'ts) e torna a leitura a 200% mais frágil, embora o mock declare conformidade.
   **Correção:** elevar conteúdo essencial, labels, feedback, datas, estados e navegação a pelo menos 14px; reservar escala menor apenas a informação genuinamente suplementar e validar novamente a recomposição.

3. **A semântica e o comportamento de abas não estão fechados no artefato.** O mock usa `nav` + `aria-current="page"` para Semanal/Mensal e não associa abas a painéis (`key-archive.html:68`, `:89`, `:121`), apesar da anotação prometer “abas associadas aos painéis” (`:129`). Os spines tampouco especificam `tablist`/`tab`/`tabpanel`, `aria-selected`, associação, setas/Home/End ou a alternativa deliberada de navegação por links.
   **Correção:** escolher e contratar um padrão único. Se forem abas in-page, usar o padrão ARIA APG completo e definir foco/ativação; se trocarem rota, usar links com `aria-current="page"` e não chamá-las de tabs programáticas.

4. **A categoria ainda é comunicada somente por cor na Task Row.** O contrato visual define a borda colorida como identificador da categoria (`DESIGN.md`, Colors e Task Row), enquanto o Accessibility Floor proíbe significado apenas por cor. No mock, nomes como Teal/Purple/Pink/Yellow não aparecem na linha; em forced-colors as bordas podem colapsar para a mesma cor.
   **Correção:** fornecer nome/ícone/padrão redundante da categoria na linha ou no nome acessível da tarefa; em forced-colors, preservar uma distinção não cromática. O detalhe pode repetir a categoria, mas não substitui a identificação da linha antes da abertura.

### Medium

1. **Vários alvos ficam abaixo do mínimo interno de 44×44px.** Inputs e botões de filtro desktop têm 42px, retry/limpar têm 40px e botões de status têm apenas 22×44px (`key-archive.html:41`, `:48`, `:50`). O piso explícito em `EXPERIENCE.md` e `{components.app-shell.touch-target-min}` é 44×44px.
   **Correção:** garantir caixa interativa mínima de 44×44px em ambos os eixos, inclusive por padding/área de hit invisível que não sobreponha alvos vizinhos.

2. **O mock afirma suporte a forced-colors sem demonstrar a adaptação.** Não há `@media (forced-colors: active)`, uso de cores de sistema ou ajuste de `forced-color-adjust`; seleção, destaque, categoria e feedback dependem fortemente de fills/bordas temáticos. O spine contém o requisito correto, mas a referência visual não prova sua execução.
   **Correção:** acrescentar ao contrato de implementação um mapa de forced-colors para foco, seleção, estado, banners, categoria e sucessor destacado; validar com o modo de alto contraste real. O mock pode permanecer ilustrativo se a anotação deixar explícito que não demonstra esse estado.

3. **A navegação de linhagem não fecha de forma inequívoca o foco no destino.** O Arquivo define posicionar e destacar o sucessor e restaurar o foco na seta ao voltar. A regra transversal diz que navegação move foco ao “heading/destino resultante”, deixando duas opções.
   **Correção:** para esta superfície, determinar um único alvo: preferencialmente focar a Task Row sucessora programaticamente (ou seu heading associado) após o carregamento e anunciar período + tarefa; no retorno, restaurar a seta de origem após a lista estar montada.

4. **Estados de loading, erro e offline têm apresentação visual, mas faltam regras específicas de anúncio do Arquivo.** O piso global cobre `aria-busy`, `status` e `alert`, porém o mock não indica qual região recebe busy, como o skeleton é ocultado da árvore, nem como erro/offline são anunciados sem repetição.
   **Correção:** especificar no padrão Arquivo: região lista/detalhe com `aria-busy`; skeleton `aria-hidden`; erro de leitura com anúncio único e retry nomeado pelo contexto; aviso offline persistente como status, sem anunciar novamente em cada render.

### Low

1. **Labels dos filtros no markup ilustrativo não estão programaticamente ligados aos inputs.** Os `<label>` não usam `for` e os inputs não têm `id` (`key-archive.html:69`, `:90`).
   **Correção:** associar explicitamente labels e controles, ou usar o mecanismo equivalente do MUI, mantendo nomes completos “Data inicial” e “Data final”.

2. **Seleção de período depende de styling sem estado programático demonstrado.** Botões `.period.on` e `.mperiod.on` não expõem `aria-pressed`, `aria-current` ou relação com o detalhe.
   **Correção:** expor seleção conforme o widget escolhido e associar lista/detalhe por heading ou descrição; anunciar a mudança do período sem duplicar o RouteAnnouncer.

3. **O mock isolado não contém skip link.** O artefato tem um único `main`, mas não demonstra o primeiro controle “Pular para o conteúdo” exigido pelo spine. Por ser uma prancha estática, o impacto é baixo; o shell implementado continua obrigado a fornecê-lo.
   **Correção:** manter o requisito como critério explícito da Story 14.0 e verificá-lo no app, não necessariamente na prancha.

## Verificações fortes

### Contraste nas oito paletas

Verificação matemática dos pares contratados:

- `ink/canvas`: **13.13–16.31:1**;
- `ink/surface`: **14.26–15.02:1**;
- `on-primary/primary`: **6.83–8.32:1**;
- `info/info-soft`: **4.92–5.94:1**;
- `success/success-soft`: **4.66–5.92:1**;
- `warning/warning-soft`: **4.51–6.40:1**;
- `danger/danger-soft`: **4.89–5.52:1**;
- `control-border/surface`: **5.70–8.68:1**;
- `focus/canvas` e `focus/surface`: **5.13–9.32:1**;
- `primary/primary-soft` para seleção: **4.92–6.55:1**.

Todos passam os limiares declarados. A aprovação não se estende automaticamente a combinações não contratadas, opacidade, antialiasing ou cores impostas pelo mock fora dos tokens.

### Teclado, ordem e retorno de foco

O spine define ordem de Tab conforme leitura/recomposição, foco não encoberto, retorno ao acionador, exceção quando há navegação e restauração completa do contexto da linhagem. O fluxo do Arquivo preserva aba, intervalo, período, scroll e foco. Falta apenas eliminar os falsos botões readonly e fechar o alvo exato no destino.

### Landmarks e headings

O piso global define skip link, único `main`, `header`, navegações nomeadas e RouteAnnouncer. O mock demonstra nomes das navegações, mas é uma prancha com múltiplas representações da tela, não markup implementável. A implementação deve manter um único conjunto ativo de landmarks e uma hierarquia de headings coerente.

### Reflow, zoom e foco não encoberto

O contrato cobre 320 CSS px, zoom 200%, primeiro/último controle, chrome fixo, safe-area e ausência de scroll horizontal. A recomposição lista → detalhe é adequada. A validação final precisa ocorrer no app renderizado, pois o mock usa altura fixa, `overflow:hidden` no frame mobile e tipografia menor que a contratada.

### Estados e ausência de mutações

Há boa cobertura de loading, empty inicial, empty por filtro, erro, offline, readonly, ausência de collections e retorno da linhagem. O contrato distingue cache ausente de vazio e remove criar, editar, mover, reordenar, concluir, cancelar e excluir. O principal desvio é o uso de botões de status no mock readonly.

## Contagem por severidade

- Critical: **0**
- High: **4**
- Medium: **4**
- Low: **3**

## Recomendação de gate

**Aprovar com correções obrigatórias antes da promoção/handoff.** Resolver primeiro: status readonly não interativo, padrão programático de abas, redundância da categoria e tipografia essencial. Depois alinhar targets, anúncios de estado, forced-colors e foco no sucessor, e executar testes no app real com teclado, leitor de tela, 320 CSS px, zoom 200% e forced-colors.
