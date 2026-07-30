# Story 15.0 — Captura e Brain Dump · Especificação de UX

> Fonte visual: `Story 15.0 - Captura e Brain Dump.dc.html` (pacote de handoff).
> Âncoras citadas abaixo (`#1d`, `#1e`, `F1`, `O4`, `E3`…) referem-se a esse arquivo.
> Em conflito, `DESIGN.md` e `EXPERIENCE.md` vencem; este documento é a leitura de UX do gate 15.0.

## 1. Contrato e escopo

AC único da 15.0: entregar o mockup do Brain Dump (desktop e mobile) e do Capture Sheet no padrão de página **Inbox** — captura → pendências → processamento, vazio é saudável — com os estados loading, empty, error e offline, mais “collection desligada/ausente” *onde aplicável* (DIR-12c), e promover o resultado a DESIGN/EXPERIENCE antes de 15.1–15.3.

### 1.1 Obrigatório
- Inbox sem data, estado normal vazio (FR-5.1).
- Título obrigatório; descrição e log de destino opcionais (FR-5.2).
- Processamento manual: mover para o log correto ou descartar (FR-5.3).
- Indicador persistente enquanto houver itens (FR-5.4).
- Captura persistente do shell: ancorada na navegação em wide/medium/tablet, FAB no compact.
- Badge = server state derivado; oculto em 0/loading/erro; 1–9 literal; 9+ com contagem exata no nome acessível.
- Estados loading, empty, read error, write error, saving, offline, alta densidade, erro parcial.
- Foco no título ao abrir; falha preserva texto; retorno de foco ao acionador.
- Wide 1440 · medium/tablet 900 · compact 390, sem scroll horizontal, alvos ≥44px.

### 1.2 Permitido
- Recompor a linha em mobile: ações do item saem para um sheet de item (padrão “tap na linha abre detalhe”).
- Mostrar o `target_log` gravado como dica textual e usá-lo para pré-selecionar o destino no processamento.
- Nomear a consequência nos botões (“Salvar no Brain Dump”, “Mover para Hoje”).
- Escrita otimista na captura, com rollback e erro inline (UX-DR14/15, AR-20).

### 1.3 Fora de escopo
- Processamento automático, sugestão de destino, IA, categorias, prioridade, tags, filtros, busca, ordenação manual.
- Status de tarefa no item do Brain Dump — o item não tem máquina de estado.
- Fila offline, rascunho local ou sincronização posterior. O MVP exige rede.
- Redesenho de sidebar, rail, topbar, bottom nav ou seletor de destino dos rituais.
- Edição do item: não existe endpoint de atualização (ver Q1 em `open-questions.md`).
- Toast de sucesso, contadores motivacionais, celebração.

### 1.4 Domínio preservado (verbatim do contrato técnico)
Rotas: `GET/POST /api/brain-dump/items/` · `DELETE /api/brain-dump/items/{id}/` · `POST /api/brain-dump/items/{id}/process/` · `GET /api/brain-dump/count/`.
Campos do item: `id`, `title` (máx. 500), `description`, `target_log` (`today|week|month|future` ou nulo = Brain Dump), `created_at`; ordenação por `created_at`.
Destinos de processamento: `today · week · month · future`; `future` exige `month_first` no dia 1 e posterior ao mês corrente; `month` resolve o mês corrente no servidor.
Processar cria a Task e apaga o item; descartar apaga.
Chaves: lista e `['brainDump','count',userId]`; captura otimista sobre a contagem, mutações invalidam.

## 2. Superfícies, camadas e faixas

| Superfície / camada | Rota / origem | Faixas | Estados cobertos |
|---|---|---|---|
| Brain Dump (Inbox) | rota existente do Brain Dump | wide 1440 · tablet 900 (rail) · compact 390 | populated · loading · empty · read error + retry · offline · saving · alta densidade e texto longo · erro parcial (contador) · sucesso após mutação |
| Capture Sheet (`Dialog/Sheet — variante Capture`) | captura persistente do shell, de qualquer rota | dialog em wide/medium/tablet · sheet no compact | default · saving · write error com retry · fechar com texto preenchido · indisponível offline |
| Seletor de destino (mesmo componente do ritual M10 · C) | ação Mover na linha | dialog em wide/medium/tablet · sheet no compact | Hoje · Esta Semana com dia · Este Mês com densidade · Futuro com mês · dia escolhido · sem dia definido · mês corrente recusado · saving · write error com retry |
| Descartar item? (confirmação do rascunho) | fechar o Capture Sheet com título preenchido | dialog em todas as faixas | default |
| Item do Brain Dump (ações da linha no touch) | tap na linha, apenas no compact | sheet no compact | default · offline (ações indisponíveis com motivo) |
| Badge do shell (Brain Dump e captura) | server state derivado | sidebar · rail · bottom nav · menu completo | 0/loading/erro oculto · 1–9 literal · 9+ com contagem exata · offline não determina disponibilidade |

Sem tela nova de listagem, sem rota nova, sem camada de segunda profundidade: o seletor de destino e o sheet de item **nunca** abrem sobre o Capture Sheet.

## 3. Composição por faixa (frames F1–F3)

- **F1 · wide 1440** — sidebar 240px, topbar 56px; ordem de leitura única: Panel “Capturar” → Section Header “Pendências” com contagem → lista de Item Rows. Largura de leitura 800px (`{workspace.reading-width}`).
- **F2 · medium/tablet 900** — rail de 64px, mesma composição em uma coluna. Nada é comprimido.
- **F3 · compact 390** — recomposto: a linha vira alvo único de 48px e as ações vão para o sheet do item; a captura inline reduz-se a Título + Destino (Descrição realocada para as camadas); ação primária em largura total; FAB de 52px acima da bottom nav e da safe-area. Sem scroll horizontal, inclusive a 320 CSS px.

Item Row (variante Brain Dump): título, descrição truncada em uma linha, borda esquerda **neutra** — sem categoria, sem Eisenhower, sem ícone de status.

## 4. Overlays (O1–O6)

Uma só profundidade de camada: `Dialog/Sheet` como dialog no ponteiro e sheet no toque. Nenhum overlay abre sobre outro overlay. Backdrop `{colors.overlay}`, sombra única `{--shadow-layer}`, raio 6px no dialog e 8px no topo do sheet.

### O1 / O2 — Capture Sheet (dialog e sheet)
- Abre de qualquer rota e **não navega**: o fundo é a superfície anterior e, ao fechar, o usuário continua exatamente onde estava (Fluxo 3, clímax). O destino padrão é Brain Dump; escolher outro destino grava a dica, **não** move o item.
- Foco vai ao Título na abertura, fica contido no dialog/sheet e volta ao acionador — captura da sidebar/rail ou FAB — quando fecha sem salvar. Se salva, o foco também volta ao acionador porque a rota não muda.
- Fecha por Fechar, backdrop, `Escape` e, no sheet, arrastar para baixo. Com o Título preenchido, qualquer um desses caminhos passa por **O3** — nenhum texto se perde em silêncio.
- `Enter` no Título salva. Envio duplicado é bloqueado durante a persistência (botão indisponível + `aria-busy` na região).
- Ação primária nomeia a consequência: *Salvar no Brain Dump*. Com o Título vazio fica indisponível, sem erro.
- No compact o campo focado é reposicionado quando o teclado virtual abre: sheet limitado a 80% da altura, rolagem interna.

### O3 — Descartar item? (confirmação do rascunho)
Paridade com o comportamento atual do sheet. Foco inicial em **Continuar editando**; `Escape` equivale a continuar editando, nunca a descartar.

### O4 / O4b / O5 — Seletor de destino
- Quatro destinos, exatamente os do contrato: *Hoje · Esta Semana · Este Mês · Futuro*. Nenhum destino calculado, sugerido ou aplicado sem confirmação. Dica gravada vem pré-selecionada e continua trocável.
- Anatomia do ritual de migração (M10 · C) — cabeçalho nomeando o item, grade com densidade, atalhos **Hoje** e **Sem dia definido**, ação nomeada, linha de atalhos — com o **seletor de log** no topo em vez de abas: os quatro destinos com os nomes e ícones Phosphor da navegação lateral (`calendar-dot` · `calendar-dots` · `calendar` · `calendar-plus`). Seletor de log = `radiogroup`; grade = `radiogroup` na semana, `grid` no mês.
- Mapa destino → contrato: *Hoje* = `today` · *Esta Semana* = `week` com `scheduled_date` do dia escolhido · *Este Mês* = `month` com `scheduled_date` opcional · *Futuro* = `future` com `month_first` · **Sem dia definido** = mesmo destino sem `scheduled_date`.
- **Futuro** exige mês e recusa o mês corrente com erro associado ao campo (regra do contrato de processamento); o mês corrente é atendido por **Este Mês**. Futuro não tem dia: o item entra no início do mês, como no Future Log — por isso a aba não oferece grade nem **Sem dia definido**.
- Calendário de densidade idêntico ao dos rituais: segunda–domingo, dias fora do mês preservados em `surface-subtle`, célula de 40px (44px no compact), hoje com contorno `info`, dia escolhido em `primary`, pontos de densidade com a contagem também no nome acessível. Mês corrente resolvido no servidor, sem navegação entre meses — outro mês é o destino **Futuro**.
- No compact abre como **sheet**: destinos empilhados em largura total, células a 44px, atalhos e confirmação empilhados no rodapé, **Fechar** do header a 44px.
- Saída sempre visível: **Fechar** no header e **Cancelar** no rodapé, além de backdrop e `Escape`.
- Confirmar cria a tarefa no destino e remove a linha da caixa; contagem e badge caem juntos. Sem toast de sucesso.

### O6 — Item do Brain Dump (sheet de ações, só compact)
Existe apenas no compact e substitui os dois botões inline da linha; no ponteiro não aparece. O item não expõe status de tarefa nem campos editáveis (ver Q1).

## 5. Matriz de estados

| Estado obrigatório | Tratamento | Frame |
|---|---|---|
| default / populated | Captura + Pendências com contagem; ações nomeadas por linha (ponteiro) ou sheet do item (toque). | F1 · F2 · F3 |
| loading | Skeleton de 5 linhas com a geometria real; shell, header e captura permanecem ativos. | E2 |
| empty | “Brain Dump vazio.” sem ação; contagem e badge desaparecem. | E1 |
| error com retry | Leitura: mensagem local + “Tentar novamente”. Escrita: erro junto à ação, entrada preservada, retry na própria ação. | E3 · E5 |
| offline | Aviso persistente; captura e ações de item indisponíveis com motivo acessível; leitura preservada; nenhuma fila. | E4 |
| saving | “Salvando…”, `aria-busy` na região, envio duplicado bloqueado, sem spinner global. | E5 |
| sucesso após mutação | Linha entra ou sai, contagem e badge mudam, anúncio `polite`. Nenhum toast, nenhuma celebração. | anotação E7 |
| erro parcial (uma fonte falha) | Lista e contador são fontes independentes: badge oculto com lista íntegra, ou lista em erro com badge correto e captura operante. | E3 · E7 |
| conteúdo longo / alta densidade | Rolagem vertical da região, truncamento em uma linha, nome acessível completo, badge `9+`. | E6 |
| foco e retorno de foco | Foco inicial no Título da superfície e no Título do sheet; retorno ao acionador ao fechar sem navegar. | O1 · O2 |
| disabled com motivo | Capturar sem título (“Informe um título para capturar.”), tudo offline, Mover para o Futuro sem mês válido. | F2 · E4 · O5 |
| readonly / closed | **Não aplicável:** o Brain Dump não é ciclo — não fecha, não arquiva, não tem estado temporal. Não desenhado, por ausência de requisito. | — |
| collection desligada / indisponível | **Não aplicável:** Brain Dump e os quatro destinos são núcleo não-gateável (FR-1.1). Registrado como recusa. | — |
| seam legado | Removido desta rota quando a Onda 4 entrar: o aviso “Esta área ainda usa a versão anterior.” existe só enquanto a rota é legada. | anotação |

### 5.1 Badge — regra única nas quatro presenças
| Contagem | Comportamento |
|---|---|
| 0 | badge oculto; nome acessível informa “0 itens pendentes”. |
| 1–9 | valor literal. |
| >9 | `9+` visual, contagem exata no nome acessível. |
| loading / erro | badge oculto e sem substituto visual; nome acessível volta a ser só “Brain Dump”. Navegação, superfície e captura continuam operando — erro parcial não bloqueia nada. |

Presenças: sidebar (trailing), rail (canto do ícone), bottom nav (canto do ícone), menu completo. Após capturar ou processar, a mudança é anunciada em `aria-live="polite"` — ex.: “Brain Dump, 8 itens pendentes.” — sem toast e sem mover o foco.

### 5.2 Textos de estado (verbatim)
- Empty: `Brain Dump vazio.`
- Read error: `Não foi possível carregar as pendências.` + `Tentar novamente`
- Write error: `Não foi possível salvar. Tente novamente.`
- Offline: `Sem conexão. Esta ação exige rede.`
- Saving: `Salvando…`
- Captura indisponível (nome acessível): `Abrir captura rápida (sem conexão)`
- Dica do destino: `Fica no Brain Dump até ser processado.`
- Disabled sem título: `Informe um título para capturar.`

## 6. Interação e teclado

- **Capturar na superfície:** Enter no Título envia; a linha nova aparece no fim da lista (ordenação por data de captura) e a contagem sobe; o Título volta a ficar vazio e focado para a captura seguinte.
- **Capturar pelo shell:** a ação persistente não navega. Após salvar, o sheet fecha, o badge sobe e a rota anterior permanece intacta — inclusive se a rota atual já for o Brain Dump, onde a lista também é atualizada.
- **Processar:** Mover abre o seletor; confirmar cria a tarefa no destino, remove a linha e atualiza contagem e badge. Nenhuma etapa em lote, nenhum “processar tudo”.
- **Escolher o dia:** em *Esta Semana*, `1`–`7` escolhem o dia e `0` escolhe **Sem dia definido**; em *Este Mês*, as setas percorrem o calendário; `Enter` confirma a ação nomeada, que cita a data escolhida. No seletor de log as setas movem o destino, e trocar de destino troca a escolha de dia abaixo. **Sem dia definido** é sempre alcançável e nunca é o resultado silencioso de não escolher.
- **Descartar:** executa imediatamente e a linha sai. Não existe desfazer no domínio atual (Q2).
- **Atalhos:** `B` abre o Brain Dump; `[` alterna sidebar/rail nas faixas que permitem; `Escape` fecha a camada superior. Respeitam foco em campo editável — digitar “b” no Título nunca navega. Nenhum atalho novo é proposto.
- **Ordem de Tab (superfície):** Pular para o conteúdo → navegação → captura do shell → Título → Descrição → Destino → Capturar → cada linha (título, Mover, Descartar) na ordem visual.
- **Ordem de Tab (camadas):** foco entra no Título, fica contido, e sai por Fechar/Escape devolvendo o foco ao acionador. Nenhuma camada abre sobre outra.
- **Movimento:** apenas transições de cor de fundo (120–180ms) e a entrada do sheet. Sem bounce, sem celebração; `prefers-reduced-motion` zera as durações sem remover posicionamento.
- **Hover não é acesso único:** as ações da linha estão sempre visíveis no ponteiro; no toque, o alvo é a linha inteira.
- **Nada é otimista além da contagem:** a linha só aparece após a confirmação do servidor; a contagem usa atualização otimista com rollback.

## 7. Acessibilidade

- **Landmarks e headings:** `header` (topbar anuncia “Brain Dump”), `nav` “Navegação principal”, `nav` “Atalhos de navegação” (compact), `nav` “Navegação completa” (sheet de Menu), um único `main` por rota. `h1` “Brain Dump” uma única vez; `h2` “Capturar” e “Pendências”; a lista é `ul`/`li`.
- **Skip link:** “Pular para o conteúdo” é o primeiro controle focável e aponta para o `main`.
- **Nomes acessíveis:** captura do shell = “Abrir captura rápida”, ou “Abrir captura rápida (sem conexão)” quando indisponível; destino Brain Dump = “Brain Dump, N itens pendentes” com a contagem exata mesmo em `9+`; linha no compact = título + descrição + dica + “Abrir ações do item”; ícones com label visível ficam `aria-hidden`.
- **Anúncios:** mudança de contagem em `role="status"`/`aria-live="polite"`, uma vez por mutação; erro de escrita em `role="alert"`, uma única vez; erro de campo associado por `aria-describedby`/`aria-errormessage`, sem duplicar; título visual e RouteAnnouncer não repetem a mesma mensagem.
- **Persistência:** ação exibe “Salvando…” e a região recebe `aria-busy="true"`; não há progresso determinado a expor.
- **Alvos:** 44px no ponteiro, 48px nas listas e formulários de toque; linhas do compact com 48px; FAB de 52px; Fechar do sheet com 44px.
- **Foco:** anel de 2px com offset 2px em todos os temas; foco nunca encoberto por topbar, bottom nav, FAB ou safe-area — o `main` reserva 76px ao fim e o shell ajusta `scroll-padding`. Aceite testa o primeiro e o último controle a 320 CSS px e em zoom 200%.
- **Cor nunca sozinha:** dica de destino é texto; erro tem ícone e texto; offline tem ícone, texto e estado indisponível; badge acompanha o label do destino.
- **Forced colors:** bordas de controle, contorno do dialog, anel de foco e estados permanecem reconhecíveis com cores do sistema; nada de significado depende de fill do tema.
- **Readonly x disabled:** não existe readonly nesta superfície. Disabled mantém rótulo legível e motivo associado por `aria-describedby`.
- **Reflow:** 320 CSS px sem perda de conteúdo ou ação, sem scroll horizontal; zoom 200% preserva a sequência vertical.

## 8. Critérios de aceite verificáveis (derivados)

1. Capturar com Título vazio é impossível e não gera erro visual.
2. Enter no Título captura, limpa o campo e mantém o foco nele.
3. Capture Sheet aberto de qualquer rota não muda a URL, e o foco retorna ao acionador em todos os caminhos de fechamento.
4. Fechar o Capture Sheet com Título preenchido sempre passa por “Descartar item?”.
5. Badge: 0/loading/erro — oculto; 1–9 — literal; >9 — `9+` com contagem exata no nome acessível.
6. Lista em erro não impede capturar; contador em erro não impede navegar.
7. Offline: nenhuma ação de escrita fica habilitada, e nenhuma copy promete envio posterior.
8. Processar para *Futuro* com o mês corrente é recusado com erro associado ao campo.
9. A 320 CSS px não há scroll horizontal e o primeiro/último controle recebem foco visível.
10. Nenhum toast de sucesso é emitido em nenhuma mutação.

## 9. Nota de decisão (registrada na promoção da 15.0, 2026-07-29)

As questões abertas Q1–Q7 deste pacote foram decididas por Hugo na sessão de promoção do bmad-ux. Ver `open-questions.md` para o enunciado original de cada uma e `../../.memlog.md` para o registro de decisão. Resumo:

- **Q1 — edição do item:** decidido **adicionar edição** (endpoint novo). O sheet de ações do item ganha os mesmos três campos da captura (Título, Descrição, Destino) e passa a ter um modo de edição, não só leitura. Isso reabre o texto “O sheet do item mostra o conteúdo sem campos editáveis” do §4/O6 acima — tratar como superado por esta nota. Endpoint de atualização é obrigação downstream de arquitetura antes da 15.1.
- **Q2 — descartar sem confirmação:** decidido **manter paridade** (descarta direto, sem dialog, sem desfazer), exatamente como descrito acima.
- **Q3 — data de captura:** decidido **manter**, exatamente como descrito acima (meta tabular na linha e no sheet do item).
- **Q7 — locale do mês:** decidido **manter o controle nativo** (input month), exatamente como descrito acima.
