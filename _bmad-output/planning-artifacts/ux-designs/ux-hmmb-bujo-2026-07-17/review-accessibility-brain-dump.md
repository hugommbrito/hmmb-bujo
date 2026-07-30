# Accessibility Review — Brain Dump / Story 15.0

Data: 2026-07-29
Lente: produto consumer, WCAG 2.2 AA, revisão adversarial
Escopo: material NOVO da Story 15.0 — superfície Brain Dump (Inbox), Capture Sheet, seletor de destino e o sheet de ação/edição do item — recém-promovido em `EXPERIENCE.md` (### Brain Dump e captura), `DESIGN.md` (### Brain Dump (Inbox) e ### Dialog/Sheet), `imports/story-15-0-brain-dump-handoff/story-15.0-brain-dump.md` e `imports/story-15-0-brain-dump-handoff/open-questions.md`. Não revalida App Shell/core (`review-accessibility-product.md`) nem Arquivo (`review-accessibility-archive.md`); cruza apenas consistência. `.working/key-brain-dump.html` não existe — sem spot-check visual, achados apoiados integralmente no texto do spine.

## Overall verdict

O contrato está **adequado, com uma correção obrigatória antes da 15.1**. A base herdada (badge de 4 estados, landmarks, `aria-live`/`aria-busy`, ausência de toast, cor nunca sozinha, forced-colors, alvos 44/48/52px) está corretamente propagada para o Brain Dump e não introduz regressão em relação às revisões já aprovadas. O ponto fraco real está na expansão decidida para a Q1 (edição do item, 2026-07-29): a promoção estendeu explicitamente a **confirmação de descarte** ao sheet de edição do item, mas não estendeu, com a mesma explicitude, a **condição que dispara essa confirmação** nem o resto do contrato de interação da camada (foco inicial, Enter-to-save, enumeração de caminhos de fechamento) — e a condição herdada literalmente ("com texto preenchido") produz um defeito funcional quando aplicada a um campo que, por definição, nunca começa vazio.

Contagem: **0 critical · 1 high · 1 medium · 1 low**.

## 1. Estrutura, landmarks e anúncio de rota — strong

### Findings

Nenhum.

### Coverage notes

- `header`/`nav`/skip link/`main` único são herdados do piso global (`EXPERIENCE.md:501`) sem exceção declarada para o Brain Dump; a rota permanece anunciada pelo nome completo da superfície.
- O Capture Sheet abre "de qualquer rota e não navega" (`EXPERIENCE.md:369`; `story-15.0-brain-dump.md:69`) — corretamente não dispara novo anúncio de rota, mesmo quando a rota de origem já é o próprio Brain Dump.
- `h1`/`h2`/`ul`/`li` e os nomes de `nav` para o Brain Dump só aparecem explicitados no companion (`story-15.0-brain-dump.md:147-148`), não são repetidos verbatim em `EXPERIENCE.md`/`DESIGN.md` — mesmo padrão de distribuição de contrato já usado no resto do par (ex.: Arquivo também deixa detalhe de heading para o mock/story). Não tratado como lacuna.

## 2. Nomes, estados e badges — strong

### Findings

Nenhum.

### Coverage notes

- Regra de badge de 4 estados (`0`/loading/erro oculto · `1`–`9` literal · `9+` com contagem exata no nome acessível) está declarada de forma idêntica nas quatro presenças — sidebar, rail, bottom nav, menu completo (`story-15.0-brain-dump.md:52,111-119`; `EXPERIENCE.md:440-442`) — consistente com a regra já validada em `review-accessibility-product.md` §2 para o resto do shell.
- Nome acessível da captura no estado offline (`Abrir captura rápida (sem conexão)`) e o motivo associado por `aria-describedby` estão cobertos (`story-15.0-brain-dump.md:127`; delta doc, linha "Persistent Capture").
- Nome acessível completo da linha em compact (título + descrição + dica + "Abrir ações do item") está contratado no companion (`story-15.0-brain-dump.md:149`) e não contradito pelo spine — mesmo padrão de truncamento visual vs. nome acessível completo já estabelecido em outras superfícies.
- `offline não determina disponibilidade [do badge]` (badge continua refletindo a última contagem carregada quando offline) não conflita com `contador não determina disponibilidade [da captura]` (contagem zero não bloqueia capturar) — são duas afirmações sobre pares diferentes, ambas presentes e não contraditórias, apesar da redação semelhante.

## 3. Teclado, foco, overlays e movimento — adequate

### Findings

- **[medium]** O contrato de interação explícito da camada (foco inicial no Título, `Enter` salva, enumeração dos caminhos de fechamento que disparam a confirmação de descarte) permanece redigido e taggeado apenas para o Capture Sheet, mesmo após a Q1 ter dado ao sheet de item os mesmos campos editáveis. Evidências:
  - A linha "foco e retorno de foco" da Matriz de estados cita explicitamente `Foco inicial no Título da superfície e no Título do sheet; retorno ao acionador ao fechar sem navegar.` mas tagueia a coluna Frame como **`O1 · O2`** apenas (`story-15.0-brain-dump.md:105`) — o sheet de item é `O6`, e não está listado.
  - A enumeração dos caminhos de fechamento (`Fecha por Fechar, backdrop, Escape e, no sheet, arrastar para baixo. Com o Título preenchido, qualquer um desses caminhos passa por O3`) está redigida só na seção `### O1 / O2 — Capture Sheet` (`story-15.0-brain-dump.md:71`); a seção `### O6` não repete essa enumeração — só diz que o item "ganha edição paritária" via a nota de decisão do §9.
  - O primitivo de teclado `Enter no Título do Brain Dump/Capture Sheet salva` (`EXPERIENCE.md:483`) nomeia explicitamente as duas superfícies com campo Título (a captura inline e o Capture Sheet) mas não o sheet de item, apesar de este agora também ter um campo Título editável.
  - A nota de decisão do §9 (`story-15.0-brain-dump.md:176`) reabre explicitamente só o texto de `### O6` sobre "campos não editáveis" — não reabre a Matriz de estados nem o primitivo de Enter-to-save para incluir `O6`.
  - `DESIGN.md:672` e `EXPERIENCE.md:373` estendem explicitamente a **confirmação de descarte** ao sheet de edição do item (`Descartar item?/Descartar alterações?`), o que prova que o time sabia estender esse ponto — mas não fez o mesmo para foco-ao-abrir/Enter-to-save/caminhos-de-fechamento, que ficam implícitos apenas pela palavra "paritária".
  - **Correção:** adicionar `O6` à coluna Frame da linha "foco e retorno de foco", replicar a frase de fechamento (Fechar/backdrop/Escape/arrastar) para o sheet de item, e estender o primitivo de Enter-to-save para citar também o sheet de edição do item — sem isso, um implementador que siga só as tags explícitas pode entregar o sheet de item sem foco inicial no Título e sem Enter-to-save.

### Coverage notes

- Trap de foco, fundo inerte, retorno ao acionador quando fecha sem navegar e ausência de camada empilhada sobre outra estão corretamente contratados para o par Capture Sheet/seletor/confirmação (`story-15.0-brain-dump.md:54,70`; `DESIGN.md:721`).
- `Escape` equivale a "continuar editando" na confirmação de descarte, nunca a um descarte silencioso — coberto e citado para as duas superfícies (Capture Sheet e sheet de item) (`EXPERIENCE.md:373`).
- `1`–`7`/`0` no seletor de destino e as setas herdam o comportamento já estabelecido no seletor de migração, com a ressalva de foco em campo editável coberta pelo primitivo geral (`EXPERIENCE.md:482-483`).
- Não há trap identificável na grade de densidade/day picker; célula alcançável por teclado, com estado nomeado, herda o piso geral de grids (`EXPERIENCE.md:507-509`).
- O seletor de destino (O4/O4b/O5) não tem, em lugar nenhum do pacote, um alvo de foco inicial explicitamente nomeado (não tem campo "Título"; é um `radiogroup` de log + grade). Isso é uma lacuna pré-existente herdada do ritual de migração (que já reusa essa mesma anatomia) e não uma introdução da 15.0 — fica fora do escopo desta revisão, mas registrado para rastreabilidade caso a Migração/Catch-Up ainda não tenha sido revisada em acessibilidade.

## 4. Anúncios — strong

### Findings

Nenhum.

### Coverage notes

- Mudança de contagem via `role="status"`/`aria-live="polite"` uma única vez por mutação, sem mover o foco (`story-15.0-brain-dump.md:119`).
- Erro de escrita via `role="alert"` uma única vez; erro de campo via `aria-describedby`/`aria-errormessage` sem duplicação (`story-15.0-brain-dump.md:150`) — consistente com o piso global (`EXPERIENCE.md:505`).
- `Salvando…` + `aria-busy="true"` durante persistência está declarado tanto no piso geral (`EXPERIENCE.md:506`, aplica-se a qualquer ação, portanto cobre também o salvamento do sheet de item) quanto no parágrafo específico do Brain Dump (`EXPERIENCE.md:375`).
- Nenhum toast em nenhuma mutação: confirmado explicitamente em três lugares independentes — `EXPERIENCE.md:371` ("sem toast"), `story-15.0-brain-dump.md:170` (critério de aceite 10) e o delta de design system C.3 ("Sem componente de toast: sucesso é comunicado por lista + contagem + `aria-live="polite"`"). Nenhuma contradição encontrada.

## 5. Alvos e reflow — adequate

### Findings

- **[low]** O próprio pacote da Story 15.0 contradiz a si mesmo em tamanho de alvo no ponteiro: `§7 Acessibilidade` declara `Alvos: 44px no ponteiro, 48px nas listas e formulários de toque` (`story-15.0-brain-dump.md:152`) sem exceção nomeada, mas `§4 O4/O4b` (mesmo documento) descreve o calendário de densidade reusado do ritual de migração com `célula de 40px (44px no compact)` (`story-15.0-brain-dump.md:84`) — ou seja, 40px no ponteiro para a mesma superfície. Isso provavelmente cai na exceção "essential" do WCAG 2.5.8 para date pickers compactos (célula precisa caber a semana inteira), mas essa exceção não está nomeada em nenhum lugar do pacote, e o texto geral do piso não a ressalva. **Correção:** nomear explicitamente a exceção do calendário de densidade no piso de acessibilidade (ex.: "célula do calendário de densidade é exceção nomeada ao alvo de 44px no ponteiro, por herdar o padrão já aprovado do ritual de migração") ou subir a célula para 44px também no ponteiro.

### Coverage notes

- FAB 52px, Fechar do sheet 44px, linha compact 48px, formulários de toque 48px estão todos declarados sem outra contradição (`story-15.0-brain-dump.md:152`).
- 320 CSS px sem scroll horizontal, inclusive no F3 compact e no seletor de destino em sheet, está explicitamente coberto (`story-15.0-brain-dump.md:60,85`).
- Primeiro/último controle com foco visível a 320 CSS px e zoom 200% está no critério de aceite verificável #9 (`story-15.0-brain-dump.md:169`), consistente com o piso geral.

## 6. Cor e forced-colors — strong

### Findings

Nenhum.

### Coverage notes

- Dica de destino é texto (chip textual), erro tem ícone+texto, offline tem ícone+texto+estado indisponível, badge acompanha o label do destino — todos explícitos e sem exceção (`story-15.0-brain-dump.md:154`).
- Borda esquerda do Item Row variante Brain Dump é declarada "neutra" — sem categoria, sem Eisenhower, sem ícone de status — corretamente evitando o mesmo erro de "categoria só por cor" que o Arquivo cometeu no mock (`review-accessibility-archive.md`, High #4); aqui não há cor de categoria a comunicar, então não há regressão.
- Forced-colors mantém bordas de controle, contorno do dialog, anel de foco e estados reconhecíveis por cores do sistema, sem depender de fill do tema (`story-15.0-brain-dump.md:155`) — consistente com o piso já validado no shell (`review-accessibility-product.md` §5).

## 7. Consistência com a expansão de edição do item (Q1) — needs fixes

### Findings

- **[high]** A condição que dispara "Descartar item?/Descartar alterações?" foi herdada literalmente do Capture Sheet para o sheet de edição do item sem ajuste, e o texto, como está, produz um defeito funcional. `DESIGN.md:672` e `EXPERIENCE.md:373` dizem: *"Fechar o Capture Sheet ou o sheet de edição do item com texto preenchido sempre passa por Descartar item?/Descartar alterações?"* — a condição de disparo é **"com texto preenchido"** nos dois casos. No Capture Sheet isso faz sentido: o Título começa vazio, então "texto preenchido" == "há algo a proteger". No sheet de edição do item, porém, o Título **nunca** começa vazio — é sempre o título já existente do item (Título é obrigatório para o item existir). Aplicada literalmente, a condição "texto preenchido" é **sempre verdadeira** ao editar um item, então **toda** tentativa de fechar o sheet de edição — mesmo sem qualquer alteração, mesmo só abrindo para ler e fechando — dispararia "Descartar alterações?". Isso é, ao mesmo tempo, uma regressão de usabilidade (interrupção modal obrigatória mesmo sem edição) e um problema de acessibilidade por acurácia de anúncio: o diálogo afirma programaticamente (nome acessível "Descartar alterações?", foco em "Continuar editando") que existem alterações a perder, quando pode não haver nenhuma — informação de estado incorreta para quem usa leitor de tela. Nenhum lugar do pacote (spine, story doc, decision note §9, open-questions.md) define uma checagem de estado "sujo" (dirty state, comparação com os valores persistidos do item) como condição de disparo alternativa para o sheet de item. **Correção:** trocar a condição de disparo do sheet de item de "texto preenchido" para "algum campo (Título/Descrição/Destino) difere do valor persistido do item" — mantendo "texto preenchido" apenas para o Capture Sheet, que não tem estado persistido prévio para comparar.

- **[medium]** Ver §3 acima — o mesmo padrão de "estendeu a confirmação, não estendeu o resto do contrato" se repete para foco inicial, Enter-to-save e enumeração de caminhos de fechamento do sheet de item. Achado completo registrado na categoria 3 para não duplicar; citado aqui porque é exatamente a classe de lacuna que a expansão da Q1 poderia ter introduzido.

### Coverage notes

- A extensão da confirmação de descarte ao sheet de item está corretamente promovida em ambos os spines (`EXPERIENCE.md:373`; `DESIGN.md:672`) e no delta de design system ("sheet de edição do item com confirmação de descarte de rascunho equivalente à do Capture Sheet") — a intenção de paridade está clara, só a condição de disparo específica não foi adaptada.
- Offline desabilita tanto a captura quanto as ações do sheet de item, com motivo acessível nos dois casos — sem tratamento privilegiado para um ou outro (`EXPERIENCE.md:375`; Superfícies table, linha "Item do Brain Dump").
- `aria-busy`/"Salvando…" durante a persistência do sheet de item herda corretamente o piso geral (`EXPERIENCE.md:506`), que não é frame-scoped — não há lacuna aqui, ao contrário do foco/Enter-to-save que são declarados frame-scoped.
- Preservação de erro/entrada em falha de escrita herda a Resiliência canônica (`EXPERIENCE.md:464`), que também não é frame-scoped — cobre o sheet de item sem lacuna.
- O endpoint `PATCH /api/brain-dump/items/{id}/` necessário para a edição está corretamente marcado como obrigação downstream de arquitetura antes da 15.1 (`architecture-and-story-handoff.md:57`; `open-questions.md:24`) — não é uma lacuna de acessibilidade, mas confirma que o sheet de item é, de fato, uma superfície nova que ainda não foi implementada, reforçando a necessidade de fechar os dois achados acima antes da 15.1.
