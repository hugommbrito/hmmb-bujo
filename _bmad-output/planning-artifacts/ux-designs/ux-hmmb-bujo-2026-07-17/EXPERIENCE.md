---
name: HMMB BuJo — Sistema Operacional Visual
status: final
created: 2026-07-17
updated: 2026-07-29
sources:
  - ../../../specs/spec-design-system-migration/SPEC.md
  - ../../../specs/spec-design-system-migration/design-system-contract.md
  - ../../../specs/spec-design-system-migration/migration-plan.md
  - ../../prds/prd-hmmb-bujo-2026-06-15/prd.md
  - ../../prds/prd-hmmb-bujo-2026-06-15/addendum.md
  - ../../architecture/architecture-hmmb-bujo-2026-07-29/ARCHITECTURE-SPINE.md
  - ../../epics.md
  - ../../../implementation-artifacts/13-0-ux-spec-do-app-shell-novo.md
  - ../../../implementation-artifacts/14-0-ux-mockups-complementares-do-nucleo-bujo.md
  - ../../../implementation-artifacts/sprint-status.yaml
  - imports/mybujo-full-handoff/design_handoff_full_app/README.md
  - imports/story-15-0-brain-dump-handoff/README.md
---

# HMMB BuJo — Experience Spine

> Novo contrato canônico de experiência da migração. O UX de 15/06 é legado. `DESIGN.md` governa a expressão visual; este arquivo governa estrutura, comportamento, estados e acessibilidade.

## Foundation

Aplicação web responsiva, desktop-first para planejamento denso e mobile real para os fluxos cotidianos. React SPA + MUI permanecem a fundação técnica. O produto atual é brownfield: o redesign preserva domínio, URLs, dados, máquina de estados, contratos de API e funcionalidades implementadas.

Princípios:

1. Trabalho antes de decoração.
2. Densidade controlada, não compressão.
3. Ritual e decisão explícitos.
4. Responsividade por recomposição.
5. Semântica redundante além da cor.
6. Um único destino visual; legado apenas como transição interna.
7. Nenhuma funcionalidade nasce do handoff sem requisito upstream.

O MVP requer rede; a UX não promete modo offline ou fila local. Escritas seguem o otimismo seletivo e rollback definidos na arquitetura.

Os sources são intencionalmente assimétricos em relação a `DESIGN.md`: `addendum.md` e `sprint-status.yaml` sustentam comportamento, sequência e gates deste spine, sem originar a identidade visual.

## Information Architecture

### App shell

| Destino | Papel | Disponibilidade |
|---|---|---|
| Hoje | Daily Log e entrada principal | atual |
| Planner / Semana | Weekly Log | atual |
| Planner / Mês | Monthly Log | atual |
| Planner / Futuro | Future Log | atual |
| Recorrentes | templates e alocação manual | atual |
| Brain Dump | captura e processamento | atual |
| Arquivo | ciclos fechados | atual |
| Configurações | preferências e cadastros | atual/conforme módulo |
| Hábitos | registro e histórico | previsto no Épico 6 |
| Saúde | métricas dinâmicas | previsto no Épico 7 |
| Medicamentos | confirmação e histórico | previsto no Épico 8 |
| Gratidão | entradas e histórico | previsto no Épico 9 |

O shell mostra somente destinos disponíveis. Módulos futuros não aparecem desabilitados. Hoje, Brain Dump, Arquivo e Configurações formam o núcleo; Planner permanece completo com Esta Semana, Este Mês, Futuro e Recorrentes mesmo quando zero collections estão ligadas. Hábitos e Gratidão são destinos diretos quando disponíveis. Saúde é agrupador não navegável de Métricas e Medicamentos: permanece com apenas um filho e desaparece quando não possui nenhum.

Wide e medium iniciam com a sidebar expandida na largura `{components.app-shell.sidebar-expanded}`; tablet inicia com o rail na largura `{components.app-shell.sidebar-collapsed}`. A pessoa pode recolher/expandir durante a sessão; nada é persistido no banco ou navegador. Planner e Saúde iniciam expandidos em nova sessão e preservam seu estado ao trocar de rota. Se um filho fica ativo com o grupo recolhido, o grupo permanece recolhido e indica que contém a rota ativa sem receber `aria-current`. As faixas exatas vivem em **Responsive & Platform**.

Compact usa topbar, três atalhos configuráveis e um quarto item fixo **Menu**. Se a rota atual não estiver entre os atalhos, Menu aparece selecionado. O sheet alto aberto por Menu lista **todos** os destinos disponíveis na ordem e nos agrupamentos canônicos, inclusive os três atalhos. Abre com foco no destino ativo; fecha por Fechar, backdrop, `Escape` ou arrastar para baixo e, sem navegação, devolve foco a Menu.

Brain Dump mantém badge persistente: zero/loading/erro ficam ocultos; 1–9 aparecem literalmente; acima disso, `9+`, preservando a contagem exata no nome acessível. Falha do contador não bloqueia navegação ou captura. Captura fica ancorada na navegação em desktop/tablet e vira FAB circular icon-only no mobile, acima da bottom nav e safe-area.

→ Composições aprovadas: [`mockups/key-app-shell-13-0.html`](mockups/key-app-shell-13-0.html) e [`mockups/key-settings-appearance-nav-13-0.html`](mockups/key-settings-appearance-nav-13-0.html). Os spines vencem em conflito.

Migração/Catch-Up é um **ritual contextual dentro do shell** (reusa a estrutura do planejamento), retomável, não item permanente de navegação nem camada full-screen própria. Detecção segue a arquitetura: pendências, não dia específico; fila unificada na ordem mês → semana → dia.

### Padrões de página

| Tipo | Superfícies | Composição |
|---|---|---|
| Hoje — Dia completo | Hoje | Period Header + alternador → catch-up → Daily Log → registros diários implementados |
| Hoje — Foco nas tarefas | Hoje | Period Header + alternador → catch-up → Daily Log dominante → totalizadores dos demais módulos |
| Planner | Semana, Mês, Futuro | período → estado do ciclo → representação temporal → pool/contexto |
| Planejamento semanal | Semana em planejamento | fontes → lista de decisões → densidade real/progresso/avisos → conclusão/início |
| Planejamento mensal | Mês em planejamento | recorrentes → Future Log → Monthly anterior → densidade real/progresso/avisos → conclusão/início |
| Ritual | Migração, Catch-Up, alocação | origem/destino → progresso → item → decisão → resumo |
| Inbox | Brain Dump | captura → pendências → processamento; vazio é saudável |
| Coleção | Recorrentes, configurações | grupos/filtros → lista → criar/editar |
| Histórico | Arquivo e históricos | filtros/período → lista/tabela → detalhe readonly |
| Registro | Hábitos, Saúde, Medicamentos, Gratidão | data → registro → feedback → histórico |

## Voice and Tone

pt-BR, direto, sereno e específico. O sistema descreve estado e consequência; não motiva, julga ou celebra.

| Use | Evite |
|---|---|
| “3 tarefas precisam de uma decisão.” | “Vamos zerar suas pendências!” |
| “Semana fechada.” | “Parabéns, semana concluída!” |
| “Não foi possível salvar. Tente novamente.” | “Ops! Algo deu errado.” |
| “Brain Dump vazio.” | “Tudo limpo por aqui 🎉” |
| “Sem conexão. Esta ação exige rede.” | “Você está offline, mas cuidamos de tudo.” |
| “Fica no Brain Dump até ser processado.” | “Salvo no Brain Dump até você processar.” |

Empty states explicam a ausência e oferecem no máximo uma ação pertinente. Ciclos fechados usam “Fechado”; arquivo usa “Somente leitura” quando necessário.

## Component Patterns

| Padrão | Consumidores | Regras comportamentais |
|---|---|---|
| App Shell | rotas autenticadas | um destino ativo; estado colapsado preservado somente na sessão; sem toggle legado/moderno |
| App Shell Navigation | shell desktop/tablet/mobile | deriva destinos disponíveis; grupos preservam estado na sessão; bottom nav usa três atalhos + Menu; menu completo repete todos os destinos |
| App Shell Badge | Brain Dump e captura | oculta 0/loading/erro; mostra 1–9/9+; nome acessível conserva valor exato; falha não bloqueia |
| Persistent Capture | shell | abre Capture Sheet; ancorada na navegação em desktop/tablet e FAB circular no compact; indisponibilidade offline comunica motivo |
| Mobile Navigation Sheet | compact | sheet alto com lista completa; foco inicial no destino ativo; trap, rolagem interna e retorno a Menu |
| Legacy Seam Notice | superfície ainda legada | aviso editorial persistente no início do conteúdo; sem dispensar e sem toggle |
| Appearance Settings | Configurações | quatro famílias × Light/Dark; Claro/Escuro/Sistema; aplica e persiste por conta somente após Salvar |
| Mobile Shortcut Settings | Configurações | três destinos disponíveis, sem duplicatas; Menu fixo; valida collection usada antes de salvar |
| Access Surface | Login e Signup | formulário em primeiro plano; silhueta contextual não interativa |
| Page/Period Header | todos os logs e arquivo | anterior/próximo, Atual/Hoje, seletor e status temporal |
| Workspace Surface | todas as superfícies autenticadas | principal obrigatória; contexto apenas quando necessário à decisão |
| Task Row | logs, migração, arquivo | ícone de status vigente, título, descrição, indicador/subárvore de subtarefas, borda de categoria, Eisenhower e ações autorizadas |
| Domain Pictogram | toda a plataforma | Phosphor monocromático identifica destino, ação ou entidade; label e estado permanecem semanticamente independentes |
| Item Row | recorrentes, Brain Dump, settings | mesma anatomia; variantes de domínio explícitas |
| Panel | contexto secundário | uma função; não aninhar por decoração |
| Section Header | listas agrupadas | label, contagem/progresso, collapse e ações |
| Chip | status/prioridade/origem | taxonomias separadas; texto/ícone além da cor |
| Date/Range Control | logs/históricos | locale pt-BR; accessible name com data completa |
| Grid/Calendar | Weekly, Monthly, hábitos, saúde | teclado, headers, alternativa de lista e sem scroll diário mobile |
| Dialog/Sheet | ações curtas/detalhe | uma camada; mantém dados digitados em erro |
| Feedback | qualquer superfície | estado junto ao dado/ação; retry e preservação de entrada |
| Ritual de migração | Migração/Catch-Up | reusa o ritual (fontes = níveis mês→semana→dia) dentro do shell; fila unificada; decisão individual; retomável pelos itens restantes; progresso; resumo |
| Weekly Board | Semana | dias em múltiplas faixas + pool sem data; filtros globais; scroll interno por painel |
| Weekly Planning Workspace | Planejamento semanal | composição pai de sources, decisões e density |
| Weekly Planning Sources | Planejamento semanal | ordem fixa, navegação livre, contagem/aviso/bloqueio por fonte |
| Week Density | Planejamento semanal | registros reais do Weekly, incluindo subtarefas, segmentados por status |
| Monthly Board | Mês | calendário completo com tarefas nas células + pool sem dia; lista diária equivalente no compact |
| Monthly Planning Workspace | Planejamento mensal | composição pai de sources, decisões e density |
| Monthly Planning Sources | Planejamento mensal | recorrentes → Future Log → Monthly anterior; navegação livre e decisões próprias por fonte |
| Month Density | Planejamento mensal | minicalendário real, total e distribuição textual por status em cada dia e no pool sem dia |
| Archive History | Arquivo | abas Semanal/Mensal; filtros de data; lista selecionável; detalhe readonly; linhagem e restauração de contexto |
| Brain Dump (Inbox) | Brain Dump | padrão Inbox; captura → pendências → processamento; Mover/Descartar/editar por linha; badge/contagem otimista |

### App Shell, aparência e atalhos

O catálogo fechado usa Phosphor `regular` em destinos inativos e `fill` no destino ativo, sem substituir indicador lateral, fundo, peso do label ou `aria-current`. Saúde apenas expande/recolhe; não abre superfície. Os nomes e ícones canônicos vivem em `DESIGN.md.Catálogo Phosphor do App Shell`.

Aliases controlados, sem criar componentes: **Capture Sheet** = `Dialog/Sheet — variante Capture`; **alternador do Hoje** = `Page/Period Header — variante alternador`; **card/detalhe de tarefa** = composição `Task Row + Dialog/Sheet — variante detalhe`.

Em **Configurações → Aparência**, a pessoa escolhe Mineral, Horizonte Azul, Bosque Sálvia ou Ameixa Editorial e um modo Claro, Escuro ou Sistema. O modo **Sistema** mantém a família escolhida e acompanha somente a preferência Light/Dark do sistema operacional. A seleção é um draft: não altera o shell até **Salvar** concluir. O sucesso aplica a aparência e persiste no banco por conta, sincronizada em todos os dispositivos. Durante saving, o envio duplicado fica indisponível. Em erro, o tema aplicado não muda, o draft permanece e `Não foi possível salvar. Tente novamente.` é anunciado junto à ação.

Sincronização entre dispositivos usa **last write wins**, sem UI de conflito. Atualização remota é aplicada automaticamente apenas quando não existe alteração local pendente. Um draft local nunca é descartado por atualização remota; ao ser salvo, torna-se a preferência vigente da conta.

Em **Configurações → Navegação mobile**, a pessoa escolhe três destinos disponíveis e distintos; **Menu** é o quarto slot fixo e não configurável. Conta sem preferência recebe os três primeiros destinos disponíveis na ordem canônica, sem duplicatas. Se a pessoa tenta desligar uma collection usada em um atalho, Salvar fica bloqueado até escolher um substituto. Se o destino desaparece por mudança externa à tela, o sistema escolhe automaticamente o primeiro destino disponível na ordem canônica que não esteja nos outros dois atalhos.

O seam legado permanece visível enquanto a rota usa a superfície anterior. Ele comunica coexistência, não oferece ação e não muda o domínio interno. A topbar continua pertencendo ao shell novo e anuncia a superfície atual.

### Signup e confirmação de senha

Signup contém Email, Senha, Confirmar senha e a ação Criar conta. A confirmação é uma validação local: divergência impede o envio, preserva os valores e mostra `As senhas não coincidem.` junto ao campo de confirmação. O erro é anunciado e programaticamente associado ao campo; não se bloqueia colar nem o preenchimento por gerenciador de senhas. Somente Email, Senha e timezone detectado compõem a requisição existente.

Cold-load, sessão expirada, credencial inválida, recuperação e demais estados específicos do sistema novo de Auth estão diferidos à **x.0 do Épico 18**. Este spine não presume seus fluxos.

### Alternador de visualização do Hoje

O alternador é um único Icon Button terciário no `Page/Period Header`. Pressionado (`aria-pressed=true`) representa **Dia completo**; desmarcado representa **Foco nas tarefas**. O ícone não muda de significado, apenas de estado, e recebe tooltip/nome acessível que descreve a ação disponível. As duas lentes compartilham rota, data, dados, Task Rows, feedback e regras de domínio; somente composição e nível de detalhe mudam.

A última lente escolhida é preservada como preferência local. No primeiro acesso ou quando a preferência não puder ser lida, o Hoje abre em **Dia completo**. A preferência altera somente composição; não faz parte do domínio, não sincroniza registros e não muda a rota.

| Regra | Dia completo | Foco nas tarefas |
|---|---|---|
| Daily Log | região principal, editável | região principal ampliada, editável |
| Hábitos | registros do dia editáveis quando o módulo existir | total realizado/esperado e estado de preenchimento |
| Saúde | campos do período diário editáveis quando o módulo existir | quantidade preenchida/pendente, sem inventar score |
| Medicamentos | blocos e confirmações editáveis quando o módulo existir | blocos confirmados/pendentes e alerta textual de dose perdida quando aplicável |
| Gratidão | composer compacto + entradas do dia quando o módulo existir | quantidade de entradas e acesso ao módulo |
| Catch-Up | mesmo banner e mesma entrada para o fluxo | mesmo banner e mesma entrada para o fluxo |

Composição desktop proposta para **Dia completo**: rail compacto → header temporal full-width → banda de registros diários autorizados → grid assimétrico com Daily Log ocupando aproximadamente dois terços e módulos Hábitos/Gratidão empilhados no terço restante. A banda superior nunca exibe produtividade; recebe somente campos/confirmadores de Saúde e Medicamentos que existirem no produto. Em mobile, a ordem é header → catch-up → Daily Log → Saúde/Medicamentos → Hábitos → Gratidão.

Totalizadores são resumos navegáveis, não KPIs de performance. Ao acioná-los em **Foco nas tarefas**, a interface muda para **Dia completo**, posiciona o módulo correspondente na viewport e transfere foco programático para o heading da região, sem disparar edição. Módulos não implementados não geram cards vazios, placeholders ou navegação desabilitada.

Trocar a lente não salva nem altera dados, não reinicia queries e não perde edição confirmada. Se houver edição não confirmada, a alternância deve preservar o draft ou pedir confirmação antes de ocultar a região. O controle anuncia a opção selecionada e é operável por setas conforme segmented control/tabs do MUI.

### Tarefas e logs

Status segue a máquina real: pending usa círculo vazio; started usa ampulheta; completed usa `TaskAlt`; cancelled usa `Cancel`; migrated usa seta simples; postponed usa seta dupla. Migrated/postponed são terminais no log de origem. Completed pode reabrir conforme arquitetura; cancelamento e transições especiais usam ações explícitas. Reordenação por drag tem alternativa de teclado/comando Mover.

Task Row e detalhe são padrões transversais para toda superfície que exibe uma tarefa real: Daily, Weekly, Monthly, Future, Migração/Catch-Up, instâncias alocadas de Recorrentes, destino processado do Brain Dump e Arquivo. A superfície pode restringir edição, movimento, ordem ou ações conforme domínio, mas não altera a anatomia, os controles de categoria/Eisenhower nem a hierarquia das ações. Templates e itens ainda não processados não fingem ser tarefas e usam suas variantes próprias.

A linha secundária da Task Row é reservada à descrição, truncada em uma linha, e à indicação de subtarefas quando existirem. Categoria aparece como borda esquerda de 3px nas seis cores vigentes; sem categoria usa divider. Eisenhower mantém U+I vermelho, U laranja, I amarelo e nenhum chip para `none`.

No detalhe, Categoria é escolhida por radio group com `Sem categoria`, teal, purple, pink, yellow, green e blue; cada swatch possui nome acessível, foco e estado selecionado sem depender apenas da cor. Eisenhower usa dois checkboxes independentes, `Urgente (U)` e `Importante (I)`, sem checkmark visível: a caixa recebe ênfase de cor quando marcada e mantém `checked` programático. O conjunto deriva o enum persistido: nenhum → `none/null`, apenas U → `u`, apenas I → `i`, ambos → `ui`. A Task Row posiciona categoria/status/Eisenhower à esquerda e ordem/drag à direita.

Em tarefa raiz mutável, o footer oferece Salvar, Mover tarefa, Cancelar tarefa e Excluir como intenções distintas. Cancelar preserva o registro com status `cancelled`; Excluir remove definitivamente somente quando autorizado pelo domínio. Cancelar tem maior hierarquia visual; Excluir permanece uma lixeira cinza com nome acessível. Tarefas terminais na origem não exibem essas mutações.

`Enter` no campo Título salva e fecha o detalhe. Em Descrição, `Enter` insere quebra de linha; em Nova subtarefa, adiciona a subtarefa; em Categoria e U/I, preserva a ativação nativa do controle. `Ctrl+Enter`/`Cmd+Enter` salva e fecha a partir de qualquer controle do formulário. Se o título for inválido ou houver escrita em andamento, o comando não fecha e o motivo permanece visível/anunciado.

A seta de uma Task Row `migrated` navega ao sucessor imediato, abre o container/período correto, seleciona o dia ou grupo necessário, posiciona e destaca a linha sem abrir o detalhe. Cadeias são percorridas elo a elo. No detalhe do sucessor, um texto readonly informa de onde veio, sem navegação inversa.

Weekly desktop usa múltiplas faixas conforme `DESIGN.md.Weekly Board`, nunca sete colunas comprimidas. Em mobile, mostra um dia por vez com seletor. Monthly usa calendário para overview e lista cronológica como equivalente compacta. Future diferencia mês parcial de data completa por label e forma.

### Weekly e planejamento semanal

→ Composição e estados aprovados: [`mockups/key-weekly.html`](mockups/key-weekly.html). Este spine vence em qualquer conflito.

#### Identidade temporal e navegação

Toda semana conserva segunda-feira como `week_start` e domingo como fim, independentemente de quando muda de estado. O header mostra intervalo completo, semana ISO e posição no mês; quando cruza meses, mostra a posição nos dois. Planner / Semana abre o Weekly **Em andamento**, mesmo quando a data atual pertence a outro período.

Navegação oferece Semana em andamento, Semana em planejamento, anterior/próxima cronológica e seleção por data. Uma semana operacional atrasada é distinta da semana que contém hoje. O planejamento pode escolher a semana do calendário atual ou qualquer semana futura, inclusive pulando semanas sem registro; apenas uma semana pode estar **Em planejamento**. O alvo sugerido é a semana de hoje quando o ciclo está atrasado, ou a próxima semana quando coincide. Dias já transcorridos continuam destinos válidos. Após a primeira decisão persistida, o alvo é imutável; planejamento vazio pode ser cancelado e recriado, nunca retargeted.

#### Ciclo de vida

| Estado | Entrada | Saída e restrições |
|---|---|---|
| Em planejamento | registro-alvo criado enquanto outro Weekly está em andamento | plenamente operável; sai somente por **Iniciar semana** |
| Em andamento | confirmação explícita após `week_start`, planejamento concluído e Weekly anterior finalizado | um único Weekly pode estar **Em andamento**; quando não há `pending`/`started` e já existe o próximo Weekly em planejamento, oferece **Finalizar semana** |
| Finalizada | confirmação irreversível de **Finalizar semana**, com próximo Weekly já registrado | somente leitura, nunca reabre |

**Concluir planejamento** é uma declaração não bloqueante: pode ocorrer a qualquer momento, não exige abrir/zerar fontes, não congela o ritual e não precisa ser repetida após novas decisões. **Revisar planejamento** permanece disponível. **Iniciar semana** exige data igual/posterior à segunda-feira-alvo, planejamento concluído e Weekly imediatamente anterior finalizado. Daily, Monthly e recorrentes podem manter avisos, mas não bloqueiam. **Finalizar semana** e **Iniciar semana** permanecem ações separadas.

Um Weekly **Em planejamento** permite criar, editar, reordenar, migrar, iniciar e concluir tarefas, além de abrir a grade completa. Mudar de dia usa o fluxo único de migração: origem terminal, sucessor novo e linhagem preservada.

#### Grade e progresso da semana

Desktop: Seg–Qua na primeira faixa; Qui–Sex e sábado/domingo compactos na segunda; **Sem dia definido** ocupa coluna lateral contínua. Cada painel tem scroll próprio. Mobile usa um dia por vez. Terminais ficam visíveis com menor ênfase; **Ocultar não abertas** e totais por status filtram globalmente todos os dias/pool. Filtros não persistem entre acessos e removem estados não selecionados, com limpeza explícita.

O resumo conta registros, não linhagens: origem migrada e sucessor contam separadamente. Inclui tarefas raiz e subtarefas, diferenciadas por status.

#### Fontes do ritual

Desktop usa navegação lateral; mobile usa seletor em sheet. Ordem e elegibilidade:

1. **Monthly na semana:** `pending`/`started` datadas dentro do intervalo, incluindo ambos os Monthly quando cruza meses. Ação rápida preserva o dia; também permite outro dia, sem data, manter ou adiar.
2. **Monthly ampliado:** qualquer mês anterior/futuro navegável; fonte opcional, fora do progresso obrigatório.
3. **Recorrentes:** todos os templates weekly ativos, ordenados alfabeticamente pelo texto de recorrência e com todos os campos cadastrados. Alocação individual cria tarefa imediatamente. **Já alocados** permite novas instâncias, inclusive duplicadas no mesmo dia; **Não alocar nesta semana** remove o aviso sem desativar o template.
4. **Weekly anterior:** somente `pending`/`started`; não oferece “manter”. É a única fonte que bloqueia iniciar a semana. Ao zerar, mostra **Semana anterior pronta para finalizar** e permite finalização irreversível no próprio ritual; após finalizar, a seção desaparece.
5. **Daily pendentes:** todos os Daily Logs não resolvidos, do mais antigo ao mais recente, agrupados por data e recolhíveis. Cada grupo desaparece da área ativa ao zerar, permanecendo no histórico do planejamento.

Todas as decisões são individuais, sem bulk action: migrar para um dia/sem data, adiar, cancelar, concluir ou manter quando autorizado. Não há edição de conteúdo dentro das listas de origem. Cada decisão persiste imediatamente; falha mantém o item, a densidade e o foco anteriores, mostra motivo quando disponível e oferece retry.

Sucesso é comunicado pela remoção/atualização da linha, histórico, contagens e densidade; não mostrar toast de sucesso redundante.

#### Densidade, revisão e avisos

O rail sticky de contexto mostra densidade, totais, itens decididos, fontes revisadas, avisos e ações. Densidade usa apenas registros reais já materializados no Weekly, inclui subtarefas e segmenta todos os status. Monthly/recorrentes não aparecem como projeção. Selecionar dia escolhe destino; não abre inspeção.

A área central alterna **Pendentes de decisão / Tudo**. Decisão persistida sai da primeira e permanece na segunda com decisão/destino; **Tudo** cobre somente o planejamento atual. Uma fonte obrigatória fica revisada automaticamente quando não restam itens sem decisão; vazio é revisado. Manter, não alocar, concluir, cancelar, migrar e adiar contam. Monthly ampliado não entra no denominador. Novos itens preservam o marco anterior e reativam o aviso da fonte.

Avisos são não dispensáveis e acionáveis: abrem a fonte em Pendentes e posicionam o primeiro item. Weekly anterior usa tratamento bloqueante distinto; demais são informativos. Quando zera, o bloqueio vira prontidão para finalizar. Mobile resume avisos no header/densidade e detalha em sheet.

#### Confirmação, teclado e disponibilidade

Migração/adiamento/alocação confirmam no próprio seletor com destino explícito. Cancelar tarefa e Finalizar semana usam dialog; Iniciar semana usa painel de verificação, sem segundo modal. No seletor, `1`–`7` escolhem segunda–domingo, `0` escolhe Sem dia e `Enter` confirma; a UI mostra lembrete discreto. Tab navega fontes/ações. Após sucesso, foco avança à próxima pendência; ao esgotar a fonte, fica no heading/estado revisado. Drag possui comando relativo alternativo.

Fontes carregam/falham independentemente. Offline mantém consulta ao cache e desabilita decisões com motivo; não existe fila local. Estados vazios permanecem visíveis. No mobile, decisão abre sheet/tela própria com densidade prioritária e retorna à mesma fonte, posição, filtros e grupos.

### Monthly e planejamento mensal

→ Composição e estados aprovados: [`mockups/key-monthly.html`](mockups/key-monthly.html). Os spines vencem em qualquer conflito com o mockup.

#### Identidade temporal e navegação

Planner / Mês abre o Monthly operacional **Em andamento**, mesmo quando o calendário avançou. A navegação mensal contém somente ciclos operacionais — o mês em andamento, o único mês em planejamento e meses finalizados — com retorno direto aos ciclos ativos, anterior/próximo cronológico e seleção por mês. Monthlies futuros usados apenas como armazenamento do Future Log não aparecem nessa navegação e consultá-los no Future Log não cria nem inicia um ciclo operacional.

O alvo de **Planejar próximo mês** é sempre o mês cronologicamente seguinte ao Monthly em andamento; não existe escolha ou retargeting. A janela regular começa na segunda-feira da semana segunda→domingo que contém a virada do mês — simultaneamente a última semana do anterior e a primeira do novo. Depois do fim dessa janela, o mesmo ritual permanece disponível como regularização atrasada. `today_for(user)` governa a janela e o gate de início.

#### Ciclo de vida e continuidade

| Estado | Entrada | Saída e restrições |
|---|---|---|
| Em planejamento | próximo mês sequencial materializado dentro da janela regular ou numa regularização | plenamente operável; não pode ser cancelado nem trocar de alvo; sai somente por **Iniciar mês** |
| Em andamento | confirmação explícita após o dia 1, planejamento concluído e Monthly anterior finalizado | somente um simultâneo; ao não haver `pending`/`started` e existir o próximo Monthly em planejamento, oferece **Finalizar mês** |
| Finalizado | confirmação irreversível de **Finalizar mês** | somente leitura, nunca reabre |

**Concluir planejamento** é uma declaração não bloqueante: não exige zerar as três fontes, não remove avisos, não congela o ritual e não precisa ser repetida após novas decisões. **Revisar planejamento** permanece disponível. A fila sem decisões pendentes é o clímax ideal, não um gate técnico.

**Iniciar mês** exige cumulativamente data igual ou posterior ao dia 1 do alvo, planejamento concluído e Monthly imediatamente anterior finalizado. Somente `pending`/`started` do Monthly anterior bloqueiam; Future Log e recorrentes mantêm avisos informativos. **Finalizar mês** e **Iniciar mês** são confirmações distintas, sem efeito colateral entre elas, e nunca coexistem dois Monthlies **Em andamento**.

Concluir/sair do ritual retorna ao calendário Monthly. Não há CTA **Planejar primeira semana**, abertura automática do Weekly nem migração direta para ele; o ritual semanal permanece independente.

Meses pulados são exceção consciente à política de não materializar períodos ausentes: cada mês intermediário é criado em sequência e percorre individualmente planejar → concluir planejamento → iniciar → finalizar. Não há salto, processamento em lote nem fechamento automático, mesmo quando o ciclo está vazio. O produto pode informar quantos meses ainda faltam regularizar.

#### Calendário e operação do mês

Desktop mostra todos os dias num calendário segunda→domingo, inclusive vazios, com as tarefas diretamente nas células e **Sem dia definido** em coluna lateral contínua conforme `DESIGN.md.Monthly Board`. Uma célula expõe categoria, estado, Eisenhower e título de cada tarefa; overflow usa rolagem interna acessível, sem resumo “+ N tarefas”. A Task Row abre o detalhe; o cabeçalho/número do dia abre o Daily Log correspondente.

Task Rows terminais continuam visíveis com menor ênfase. Totais por status e **Ocultar não abertas** seguem o comportamento global aprovado no Weekly: filtram simultaneamente todos os dias e o pool, mostram o filtro ativo por texto e não persistem entre visitas. O resumo conta registros reais, não linhagens deduplicadas.

Arrastar serve somente para reordenar tarefas dentro do mesmo dia e possui alternativa relativa por teclado/comando. Drag entre dias não existe. Mover entre dias ou entre um dia e **Sem dia definido** usa o seletor explícito, deixa a origem terminal `migrated`, cria sucessor e preserva a linhagem. O mesmo vale para atribuir dia a um item sem data vindo do Future Log.

#### Fontes e decisões do ritual

Desktop usa três regiões; mobile usa índice de fontes em sheet. A ordem é fixa, mas não força sequência:

1. **Recorrentes:** templates `monthly` ativos primeiro; depois `annual` ativos ainda sem instância no ano do Monthly alvo. `recurrence_text` é apenas exibido, nunca parseado para inferir mês. Cada alocação manual cria uma Task snapshot no dia escolhido ou em **Sem dia definido**. A primeira instância resolve a pendência do ciclo, mas **Já alocados**/**Já alocados no ano** continuam acessíveis fora do progresso para novas instâncias conscientes, inclusive no mesmo dia. Um anual só deixa de ser lembrado quando recebe destino no ano do alvo; pode ir ao Monthly alvo ou a um mês posterior do Future Log dentro desse mesmo ano. Em dezembro, somente o próprio mês-alvo resolve a pendência anual. Não existe **Não alocar neste mês** para anual.
2. **Future Log:** itens destinados ao mês-alvo já pertencem a esse Monthly e chegam com data preservada ou em **Sem dia definido**. No ritual, oferecem somente escolher um dia, **Manter sem dia** ou adiar para um Monthly futuro. Manter conta como decisão persistida no snapshot do ritual sem mudar a Task; escolher um dia usa migração com origem terminal e sucessor. Concluir/cancelar não aparecem nessa fonte.
3. **Monthly anterior:** somente `pending`/`started`; permite concluir ou cancelar na origem, migrar para o alvo com dia/**Sem dia definido**, ou adiar ao Future Log. É a única fonte bloqueante do gate de início. Ao zerar, oferece **Finalizar mês anterior** com confirmação irreversível e depois desaparece do ritual.

O planejamento mensal nunca envia uma tarefa diretamente ao Weekly. Cada decisão é individual, persiste imediatamente e não permite editar o conteúdo na lista de origem. Sucesso atualiza linha, histórico, contagens e densidade sem toast redundante. Falha mantém item, densidade e foco, mostra o motivo seguro disponível e oferece retry local.

#### Densidade, revisão, avisos e destino

O rail sticky mostra minicalendário completo do alvo, total e distribuição por status em cada dia, faixa **Sem dia definido**, totais, itens decididos, fontes revisadas, avisos e ações. Conta somente Tasks reais já materializadas no Monthly, incluindo subtarefas; recorrentes ainda não alocados não são projeção. Depois da persistência, destino e contagens atualizam imediatamente e o dia recebe destaque perceptível além da cor.

A área central alterna **Pendentes de decisão / Tudo**. Decisão persistida sai da primeira e permanece na segunda com decisão/destino; **Tudo** cobre somente o planejamento atual. Uma fonte vazia, ou sem itens elegíveis que ainda aguardem decisão, fica marcada como revisada automaticamente. Novos itens preservam o marco anterior e reativam o aviso da própria fonte. **Já alocados no ano** não entra em progresso nem avisos.

Avisos são persistentes, não dispensáveis e acionáveis: abrem a fonte em Pendentes e posicionam o primeiro item relevante. O Monthly anterior usa semântica bloqueante distinta; recorrentes e Future Log são informativos. No mobile, o header/densidade resume quantidade e a lista detalhada abre em sheet.

O seletor de destino combina calendário navegável por setas e entrada direta do número do dia; ambos ficam sincronizados e validam os 28–31 dias reais, inclusive ano bissexto. **Sem dia definido** é uma opção explícita, não valor vazio. `Enter` confirma somente a ação final nomeada, por exemplo **Migrar para 18 de agosto**. No mobile, o seletor abre em sheet/tela própria e o retorno preserva fonte, posição e filtros.

#### Disponibilidade e recomposição

Recorrentes, Future Log e Monthly anterior carregam/falham independentemente. Offline mantém consulta ao cache e desabilita todas as decisões com motivo, sem fila local. Mês vazio conserva o calendário e o ciclo normal. Ciclo finalizado conserva navegação, tarefas e linhagem com contraste normal, removendo mutações e reordenação.

Em compact, a grade completa vira seleção de data + lista completa de um dia por vez, sem scroll horizontal. Todos os dias continuam alcançáveis, inclusive vazios; **Sem dia definido** permanece ação/lista equivalente. O ritual mantém densidade no topo, fonte ativa em largura total e seleção de fonte/destino em sheet.

### Future Log

→ Composição e estados aprovados: [`mockups/key-future-log.html`](mockups/key-future-log.html). Os spines vencem em qualquer conflito com o mockup.

#### Identidade temporal e horizonte

Planner / Futuro é a visão de leitura e captura sobre os `monthly_log` futuros — a mesma entidade do Monthly, nunca um ciclo operacional. Abrir o Futuro ou consultar qualquer mês dele não cria nem inicia um Monthly **Em andamento** ou **Em planejamento**.

A superfície usa composição híbrida: um trilho com o **horizonte rolante fixo de oito meses** — os oito meses seguintes ao Monthly operacional, sempre visíveis, inclusive os vazios, cada um com a contagem de itens — e uma coluna de foco com o mês selecionado em Task Rows integrais. O horizonte não inclui o mês corrente, que vive no Monthly operacional.

Meses além do horizonte não poluem o trilho. **Ir para mês…** abre um seletor que lista somente os meses distantes que têm itens, agrupados por ano e com a contagem de tasks de cada um; selecionar leva o foco àquele mês. Assim nenhum item lançado à frente se perde da vista sem encher o trilho. Capturar em um mês distante vazio é feito pelo campo de captura com a data; ao ganhar o primeiro item, o mês passa a aparecer no seletor.

#### Captura, data e ordenação

A captura fica no topo, no molde do `FutureLogItemForm`: título com data completa ou apenas mês. Item com dia exibe o prefixo `(14)`; item só com mês exibe `— ago` (data parcial, FR-4.2). Dentro do mês, itens datados vêm ordenados por dia e os sem dia depois deles.

#### Datear e mover no lugar

Fora dos rituais, o Futuro permite atribuir uma data ou mover um item na própria tela. As ações **Definir dia** e **Mover** abrem o seletor de destino, que oferece os dias do mês em foco, **Manter sem dia definido** e a aba **Outro mês**. Confirmar nomeia o destino (por exemplo **Datar em 14 de agosto**) e usa migração — a origem fica terminal `migrated` (readonly, com seta navegável ao sucessor) e nasce um sucessor no destino, preservando a linhagem, mesmo padrão do ritual mensal. Concluir e cancelar não aparecem nesta superfície; permanecem no contexto operacional/ritual.

#### Anuais pendentes

A seção **Anuais pendentes de {ano}** repete o comportamento implementado: lista os templates `annual` ativos ainda sem instância no ano e oferece **Definir placement** via dialog. Sem pendência, a seção não renderiza (molde "banner vazio = sem DOM"), sem placeholder.

#### Disponibilidade e recomposição

Estados seguem o contrato global: skeleton preserva a geometria trilho + foco; erro de leitura fica junto ao dado com retry; offline mantém consulta ao cache e desabilita captura, datar e mover com motivo, sem fila local; vazio saudável convida a capturar sem parecer quebrado. No compact, o trilho vira uma barra de meses rolável horizontalmente com contagem, **Ir para mês** e o seletor de destino abrem em sheet, e a coluna de foco ocupa a largura total; o retorno preserva mês, posição e foco.

### Pictogramas de hábitos e saúde

Hábitos e métricas de Saúde adotam Phosphor como linguagem pictográfica conforme `{components.domain-icon}`. O mesmo `iconKey` representa a entidade no cadastro, no Hoje, em trackers, grids e históricos. O catálogo é fechado e pesquisável por nome; não aceita nome arbitrário de componente nem transforma o ícone em campo de texto livre.

Quando o label está visível, o pictograma é decorativo e não é anunciado duas vezes. Em uma apresentação somente por ícone, o controle recebe nome acessível e tooltip. Conclusão de hábito, valor preenchido, alerta e readonly são anunciados separadamente; nunca se deduz estado pela forma ou cor do pictograma.

A migração preserva o `emoticon` existente como fallback e compatibilidade de leitura. Arquitetura deve avaliar um `iconKey` estável e validado, sem persistir componentes React ou paths SVG. Registros sem mapeamento continuam exibindo o emoji até o usuário escolher um pictograma ou uma migração segura ser executada. A introdução do campo é mudança explícita de contrato e exige história própria; não fica implícita na troca visual.

### Recorrentes

Templates não têm status de tarefa. **Alocar** é manual e cria snapshot de tarefa real no destino; não existem auto-injeção, indicador “synced”, frequência executável ou audit trail de engine originados no handoff.

A biblioteca vive em `/planner/recurring` (padrão Coleção) e é só CRUD: agrupa por abas **Semanal / Mensal / Anual** com contagem, filtro **Mostrar inativos**, e cada template é a variante Item Row — borda de categoria, título, subline `{grupo} — {recurrence_text}`, descrição e chip Eisenhower; sem ícone de status. Empty por grupo: “Nenhum template neste grupo.” mais uma ação de criar.

Criar e editar abrem o mesmo card do detalhe de tarefa, com paridade e o conjunto completo de campos (título, descrição, categoria por swatches, Eisenhower por checkboxes U/I, recorrência). O grupo (`recurrence_group`) é editável na criação — herdado da aba — e **readonly** na edição. O footer oferece **Salvar**, **Ativar/Desativar** e **Excluir**: Ativar/Desativar é reversível e prospectivo (o inativo permanece no sistema, visível com o filtro); **Excluir** existe só na edição, confirma em dialog e é **soft delete** — o template sai da biblioteca e dos rituais, mas o registro persiste para preservar a linhagem (`source_template`) das tarefas já alocadas. Não há exclusão física.

**Alocar** permanece decisão dos rituais, não da biblioteca: os templates ativos aparecem na fonte **Recorrentes** do planejamento semanal/mensal e nos anuais do Future Log, onde o ato **Alocar** cria a instância. A biblioteca só os alimenta. Falha de escrita preserva o rascunho, mostra o motivo e oferece retry; offline mantém a consulta e desabilita criar/editar/ativar/excluir com motivo, sem fila local. Configurações — recorrentes (superfície futura) compartilha esta biblioteca.

→ Composição e estados aprovados: [`mockups/key-recorrentes.html`](mockups/key-recorrentes.html). Os spines vencem em conflito.

### Migração e Catch-Up

Tudo que ficou sem lugar — de meses, semanas ou dias anteriores — é migração. Uma **faixa discreta** no Hoje ("N tarefas precisam de decisão", com contagem por fonte) é o único ponto de entrada; vazio = sem faixa. O fluxo **reusa o ritual de planejamento** dentro do shell, não uma camada full-screen própria: rail de fontes, lista de decisões e rail de contexto.

Uma **fila unificada** reúne as pendências dos três níveis, ordenadas **mês → semana → dia** ("ontem" é o nível dia); a arquitetura mescla as filas hoje separadas (`/migration/queue/` + `/catch-up/queue/`) numa lista com rótulo e contagem por fonte. Cada item é uma Task Row com origem/linhagem; a decisão é individual: **Migrar para hoje** (ação destacada em toda fonte), **Escolher destino…** ou **Cancelar** — não há "Concluir". O seletor de destino é o mesmo dos rituais/Future Log, com as abas **Esta semana**, **Dia no mês** e **Outro mês** e os atalhos **Hoje** e **Sem dia**; migrar gera linhagem (origem terminal + sucessor). O rail de contexto mostra progresso, o que já foi decidido e o que resta por fonte — sem calendário-alvo.

**Pausar e sair** não perde decisões (cada uma persiste por item); retomar reabre pela faixa e continua com os **itens restantes**, sem persistir posição exata. Ao decidir tudo, um **resumo** factual (migradas/adiadas/canceladas) antecede **Voltar ao Hoje**, onde só aparecem as tarefas trazidas. Falha de escrita preserva a decisão e o item, com retry local; offline desabilita as decisões com motivo, sem fila local; uma fonte que não carrega não bloqueia as demais. O escopo é o Hoje: a migração por-tarefa ("Mover") e as decisões dos rituais de planejamento são superfícies distintas que reusam o mesmo seletor.

→ Composição e estados aprovados: [`mockups/key-migracao.html`](mockups/key-migracao.html). Os spines vencem em conflito.

### Brain Dump e captura

Brain Dump é a única superfície no padrão **Inbox**: sem data, vazio é o estado normal e saudável. A ordem de leitura é fixa em toda faixa — Panel **Capturar** → Section Header **Pendências** com contagem → lista de Item Rows — sem Page/Period Header pleno (sem stepper, sem status de ciclo, sem seletor de período). Título é obrigatório; descrição e log de destino (`target_log`) são opcionais e default para Brain Dump. A captura persistente do shell (ancorada na navegação em wide/medium/tablet, FAB no compact) abre o mesmo formulário num **Capture Sheet** que nunca navega: fecha e devolve o foco ao acionador na rota onde Hugo estava, mesmo quando essa rota já é o próprio Brain Dump.

Processamento é sempre manual e nomeado: cada linha tem **Mover** (abre o seletor de destino) e **Descartar** — nunca migração automática, sugestão de destino, IA, categoria, prioridade, tags, filtro, busca ou ordenação manual, e o item não tem máquina de estado de tarefa. O `target_log` gravado aparece como dica textual (“Fica no Brain Dump até ser processado.”) e pré-seleciona o destino no seletor, mas nunca move o item sozinho. **Descartar** executa direto, sem dialog nem desfazer — paridade deliberada com o comportamento legado. **Mover** abre o mesmo seletor de destino do ritual de migração (`DESIGN.md.Migração / Catch-Up`), com o seletor de log em `radiogroup` no lugar das abas: **Hoje** (`today`), **Esta Semana** (`week` + `scheduled_date` do dia escolhido), **Este Mês** (`month` + `scheduled_date` opcional) e **Futuro** (`future` + `month_first` via `input month` nativo, recusando o mês corrente com erro associado ao campo — o mês corrente é atendido por Este Mês). **Sem dia definido** é sempre alcançável em Esta Semana/Este Mês e nunca o resultado silencioso de não escolher; Futuro não oferece dia, porque o item entra no início do mês como no Future Log. Confirmar cria a Task no destino e remove a linha; contagem e badge caem juntos, sem toast.

O item ganha edição paritária com a captura: o sheet de item (aberto por tap na linha no compact; a linha mantém as duas ações inline no ponteiro) expõe os mesmos três campos — Título, Descrição, Destino, pré-preenchidos com o valor atual — e persiste via o endpoint de atualização definido em [M11](architecture-and-story-handoff.md#m11--brain-dumpcaptura). Foco inicial vai ao Título tanto no Capture Sheet quanto no sheet de edição; `Enter` no Título salva em ambos. Salvar a edição fecha o sheet, atualiza a linha in-place (sem otimismo — só após confirmação do servidor, como qualquer mutação além da contagem) e devolve o foco ao acionador da linha, espelhando o ciclo do Capture Sheet; falha preserva os três campos com o erro junto à ação. Fechar o Capture Sheet com o Título preenchido sempre passa por **Descartar item?**; fechar o sheet de edição do item com **alterações não salvas** em relação ao valor carregado — não com o simples fato de ter texto, que é o estado normal de um item existente — passa por **Descartar alterações?**. Ambas as confirmações têm foco inicial em **Continuar editando**; `Escape` equivale a continuar editando, nunca a descartar.

Item Row usa a variante Brain Dump: título, descrição truncada em uma linha, borda esquerda neutra — sem categoria, sem Eisenhower, sem ícone de status — com a data de captura (`created_at`) em meta tabular; a lista ordena por `created_at`. Offline desabilita captura e ações de item com o motivo no nome acessível; leitura já carregada permanece; nenhuma fila local, rascunho persistido ou promessa de envio posterior. Loading preserva shell/header/captura com skeleton de 5 linhas na geometria real; erro de leitura fica junto à lista com retry local, sem bloquear captura; escrita preserva a entrada e mostra “Salvando…” com `aria-busy`, envio duplicado bloqueado. Lista e contador do badge são fontes independentes: um pode falhar sem o outro (ver **Badge Brain Dump** em State Patterns).

→ Composição e estados aprovados: [`mockups/key-brain-dump.html`](mockups/key-brain-dump.html); especificação de origem em [`imports/story-15-0-brain-dump-handoff/story-15.0-brain-dump.md`](imports/story-15-0-brain-dump-handoff/story-15.0-brain-dump.md). Os spines vencem em conflito.

### Arquivo e ciclo fechado

Ciclo finalizado permanece navegável e legível, em readonly. Controles de mutação desaparecem; conteúdo não recebe aparência disabled. Weekly só finaliza explicitamente sem tarefas `pending`/`started` e nunca reabre.

Arquivo usa abas **Semanal** e **Mensal**. Cada aba segue **filtros de data → lista de períodos → detalhe readonly**. Os filtros operam somente sobre `weekStart`/`monthFirst`; o índice não precisa fornecer busca, agregados, paginação ou conteúdo dos logs. A lista usa os tipos e chaves temporais do índice; selecionar um período conserva os deep links e carrega o detalhe pela rota/query semanal ou mensal existente.

As abas são in-page e seguem o padrão ARIA tabs: container `tablist`; cada controle `tab` expõe `aria-selected` e `aria-controls`; cada painel usa `tabpanel`, `aria-labelledby` e `tabindex="0"`. Setas esquerda/direita movem foco; Home/End levam à primeira/última aba; ativação acompanha o foco porque o carregamento do índice já está disponível. A seleção de período expõe estado programático e associa lista e heading do detalhe.

No detalhe, `Fechado` nomeia o estado do ciclo e `Somente leitura` explicita a permissão. Task Row, grupos diários, **Sem dia definido**, categoria, status, Eisenhower, ordem, subtarefas e anatomia do detalhe permanecem canônicos. Criar, editar, mover, reordenar, concluir, cancelar e excluir não são renderizados. Abertura do detalhe, seleção, navegação temporal e seta de linhagem continuam operáveis.

A seta de uma origem migrada abre o período/container do sucessor imediato, seleciona o dia ou grupo necessário, posiciona e destaca a linha sem abrir o detalhe. Voltar restaura aba, intervalo, período selecionado, posição de rolagem e foco na seta de origem.

Após a navegação, foco programático vai para a **Task Row sucessora** (`tabindex="-1"`), e uma mensagem `aria-live="polite"` anuncia o período e o título da tarefa. No retorno, o foco só é restaurado na seta de origem depois que a lista e a linha estiverem montadas.

Loading mantém shell/header e usa skeleton de abas, filtros, lista e detalhe. Empty inicial informa que ainda não há ciclo finalizado do tipo; empty por filtro mantém o intervalo e oferece **Limpar período**. Erro de leitura preserva aba, datas, seleção e posição com retry local. Offline mantém ciclos já carregados; período sem cache comunica indisponibilidade e nunca simula vazio.

Lista e detalhe recebem `aria-busy` durante seus carregamentos; skeletons ficam `aria-hidden`. Erro de leitura usa anúncio único `alert` e retry nomeado pelo tipo/período; offline persistente usa `status` sem repetir anúncio a cada render. Em readonly, ícones de status não são controles e ficam fora da ordem de foco; somente a seta de linhagem permanece interativa.

Categoria conserva borda cromática e acrescenta seu nome no texto/nome acessível da Task Row. Em forced-colors, seleção, foco, feedback, categoria e destaque usam cores do sistema e distinções por borda/espessura/texto; nenhum fill tem significado isolado.

Wide/medium usam lista + detalhe; tablet reduz a lista; compact usa lista → detalhe em sequência, com filtros alcançáveis e sem scroll horizontal de página. Em 320 CSS px e zoom 200%, primeiro e último controles ficam visíveis acima do chrome fixo.

→ Composição e estados aprovados: [`mockups/key-archive.html`](mockups/key-archive.html). A exploração deferida do Arquivo vive em [`.working/future-vision/archive-future-vision.html`](.working/future-vision/archive-future-vision.html) e não constitui contrato. Os spines vencem em conflito.

### Módulos futuros previstos e estados diferidos

- **Hábitos — Story 16.0:** tracker diário e configuração; estados específicos de vazio, inativo, histórico, falha e offline serão fechados nesse gate. Sem streaks/ranking.
- **Saúde-Métricas + Medicamentos — Story 16.3:** campos dinâmicos, histórico e confirmações; estados de métrica sem valor, histórico vazio, dose perdida/readonly e falha parcial serão fechados na mesma sessão.
- **Journalling/Gratidões — Story 16.10:** composer e histórico; vazio, salvamento, falha preservando texto e offline serão fechados nesse gate. Sem insights, streak ou IA.

## State Patterns

| Estado | Contrato obrigatório |
|---|---|
| Initial loading | skeleton com geometria real; shell/header permanecem |
| Local loading | bloqueia somente a ação/região afetada |
| Empty inicial | uma frase e até uma ação; Brain Dump vazio não incentiva conteúdo |
| Empty por filtro | filtro permanece visível e pode ser limpo |
| Read error | mensagem local, retry e período/filtros preservados |
| Write error | entrada preservada; rollback seletivo; retry explícito |
| Offline | aviso persistente; ações de rede indisponíveis com motivo; sem falsa promessa local |
| Disabled | motivo acessível quando não óbvio; label legível |
| Readonly/archive | mutações ausentes, contraste normal, estado textual |
| Recorrente inativo | menor ênfase + chip "inativo"; visível só com "Mostrar inativos"; efeito prospectivo |
| Recorrente excluído | soft delete: some da biblioteca e dos rituais; registro e linhagem (`source_template`) preservados; confirmação em dialog |
| Closed cycle | “Fechado” no header; consulta e navegação ativas |
| Optimistic | estado provisório anunciado; confirma ou reverte sem duplicação |
| Week planning concluded | marco persistente; ritual continua editável; avisos podem reativar por fonte |
| Week ready to finalize | aviso de prontidão + confirmação irreversível; nenhuma transição automática |
| Month planning concluded | marco persistente e não bloqueante; ritual continua editável; avisos permanecem/reativam por fonte |
| Month ready to finalize | nenhuma `pending`/`started`; aviso de prontidão + confirmação irreversível; nenhuma transição automática |
| Empty month | calendário completo permanece; próximo ciclo sequencial segue o ritual e não pode ser cancelado |
| Future vazio | horizonte de 8 meses convida à captura sem parecer quebrado; meses vazios seguem visíveis no trilho |
| Future além do horizonte | itens distantes alcançáveis pelo seletor "Ir para mês", que lista só meses com itens e a contagem; sem nenhum, o seletor orienta captura por data |
| Monthly catch-up | informa meses ainda por regularizar; cada ciclo usa o fluxo normal, sem salto, lote ou autoencerramento |
| Partial source error | erro/retry local; demais fontes do planejamento continuam operáveis |
| Migração pausada | decisões persistidas por item; retoma pela faixa com os itens restantes; sem posição salva |
| Migração concluída | resumo factual (migradas/adiadas/canceladas) antes de voltar ao Hoje |
| Nav sem collections | núcleo + Planner completo; nenhum heading de collections, Saúde vazio ou item desabilitado |
| Nav com uma collection | destino direto ou Saúde com um único filho; hierarquia não é achatada |
| Grupo com filho ativo recolhido | permanece recolhido; indicador no grupo; filho conserva rota ativa; grupo não recebe `aria-current` |
| Badge Brain Dump 0/loading/error | badge oculto; navegação e captura continuam funcionais |
| Badge Brain Dump 1–9/maior | valor literal até 9; `9+` acima; nome acessível anuncia contagem exata |
| Brain Dump erro parcial | lista e contador são fontes independentes: badge oculto com lista íntegra, ou lista em erro com badge correto e captura operante |
| Descartar rascunho do Brain Dump | Capture Sheet dispara por texto preenchido; sheet de edição dispara por alteração não salva; foco inicial em Continuar editando, `Escape` nunca descarta |
| Captura offline | ação indisponível com motivo acessível; conteúdo e navegação continuam; contador não determina disponibilidade |
| Menu mobile aberto | sheet alto; foco inicial no destino ativo, foco contido, rolagem interna e conteúdo inferior inerte |
| Aparência dirty | draft visível; aparência aplicada permanece inalterada; Salvar habilitado |
| Aparência saving | progresso anunciado; envio duplicado indisponível; tema anterior continua aplicado |
| Aparência saved | nova família/modo aplicada após confirmação; preferência por conta sincronizada |
| Aparência save error | tema anterior aplicado; draft e erro preservados; retry disponível |
| Atalho usa collection desligada | validação bloqueia Salvar até substituição por destino disponível |
| Atalho desaparece externamente | fallback automático pelo primeiro destino canônico disponível, sem duplicar |
| Seam legado | aviso editorial sempre visível no início do conteúdo até a rota ser migrada; não dispensável |

Estados são parte do aceite de cada superfície, não casos posteriores.

No detalhe de tarefa, falha de escrita preserva todo o rascunho e exibe `Não foi possível salvar. Tente novamente.` junto às ações, com nova tentativa disponível.

### Resiliência canônica

| Situação | Regra transversal | Exceção nomeada |
|---|---|---|
| Offline | mantém dado carregado; leitura/navegação seguem; mutação de rede fica indisponível com motivo | Fluxos 1 e 4 distinguem cache ausente de vazio |
| Read error | erro junto à região; retry local; período, filtros e posição preservados | fonte parcial de ritual não bloqueia demais fontes |
| Write error | draft/entrada preservado; retry explícito; estado confirmado anterior permanece | Appearance Settings mantém tema aplicado |
| Retorno de foco | camada devolve foco ao acionador quando fecha sem navegar | Mobile Navigation Sheet retorna a Menu |

## Interaction Primitives

- Clique/tap na linha abre detalhe; controle leading altera apenas o estado permitido.
- Hover nunca é o único acesso a ação.
- `Esc` fecha a camada superior ou pausa ritual sem perder decisões já salvas.
- Tab order acompanha leitura e recomposição visual.
- Drag/reorder possui alternativa “Mover acima/abaixo/para…”.
- Feedback otimista não anuncia sucesso antes da confirmação quando a arquitetura exigir confirmação.
- Nenhuma animação celebratória, parallax ou transição que bloqueie input.
- Reduced motion elimina deslocamentos; feedback continua imediato.
- `1`–`7`/`0` escolhem destino semanal no seletor; `Enter` confirma a ação nomeada.
- No destino mensal, setas e entrada direta escolhem um dia válido; **Sem dia definido** é explícito e `Enter` confirma a ação nomeada.
- No Monthly, cabeçalho/número da data abre o Daily Log; Task Row abre o detalhe sem navegar de período.
- Drag no Monthly reordena somente dentro do mesmo dia; mudança de dia usa migração explícita.
- Navegação de linhagem leva ao sucessor imediato, posiciona e destaca sem abrir detalhe.
- `[` alterna sidebar expandida/rail nas faixas que permitem; `B` abre Brain Dump. Ambos respeitam foco em campo editável e o inventário vigente.
- `Enter` no Título do Brain Dump/Capture Sheet/sheet de edição do item salva; após capturar na superfície, o Título limpa e mantém o foco para a captura seguinte, e após salvar uma edição o foco volta ao acionador da linha. Digitar em qualquer campo editável nunca aciona atalhos de navegação.
- No seletor de destino do Brain Dump, `1`–`7`/`0` e as setas herdam o mesmo comportamento do seletor de migração (ver acima); trocar o destino no seletor de log troca a escolha de dia abaixo.
- Menu mobile abre um sheet alto com foco no destino ativo. `Tab` fica contido; Fechar, backdrop, `Escape` e gesto de arrastar para baixo encerram. Sem navegação, foco retorna a Menu.
- Alterar família, modo ou atalhos modifica somente o draft de Configurações. `Salvar` é o único commit; falha nunca descarta escolhas.

Atalhos existentes devem ser inventariados antes de cada migração e preservados. Adições aprovadas: salvamento por Enter no detalhe de tarefa e seleção `1`–`7`/`0` + confirmação por Enter no destino semanal, com escopo restrito aos respectivos controles.

Retorno de foco segue a tabela **Resiliência canônica**; se a ação navega, foco vai ao heading/destino resultante em vez de retornar ao acionador desmontado.

## Accessibility Floor

- WCAG 2.2 AA em todos os estados e temas efetivamente entregues.
- Contraste de texto normal é no mínimo 4,5:1; texto grande, no mínimo 3:1. Foco, limites necessários e indicadores de estado alcançam 3:1 contra cores adjacentes; hover/seleção também alcançam 3:1 quando identificam o estado. Contraste reduzido só é admitido em controles realmente indisponíveis, mantendo legíveis o rótulo e o motivo.
- Boundaries necessários para reconhecer controles interativos usam o papel `{colors.control-border}` contra a surface correspondente. `{colors.border}` permanece estrutural e `{colors.border-strong}` não é fallback para boundary interativo.
- Em cores forçadas/alto contraste, forma, contorno, estado e semântica permanecem reconhecíveis com cores do sistema; nenhum significado depende dos fills do tema.
- Target mínimo 44×44px; controles frequentes compactos usam 48px.
- Focus ring visível conforme `{components.focus-ring}`.
- Zoom 200% e reflow em 320 CSS px sem perda de conteúdo/ação.
- O primeiro controle focável é `Pular para o conteúdo`, apontando para o único `main` ativo da rota, no início do heading da superfície. Topbar usa `header`; sidebar/rail usa `nav` com nome `Navegação principal`; bottom nav, `Atalhos de navegação`; e o sheet, `Navegação completa`.
- Ao receber foco, qualquer controle fica totalmente visível. O shell reserva espaço e ajusta scroll padding/margin para topbar, bottom nav, FAB, regiões sticky e safe-area; no final do workspace há espaço suficiente para elevar a última ação. A rolagem move somente o necessário, e sheets recompõem com teclado virtual.
- O aceite testa primeiro e último controles a 320 CSS px e zoom de 200%, com chrome fixo/sticky ativo.
- Screen reader anuncia superfície, período, mudança de status, erro e progresso do ritual.
- Mudança de rota e sucesso não bloqueante usam `role="status"`/`aria-live="polite"`; erro de escrita ou bloqueante usa `role="alert"` e é anunciado uma única vez. Erro de campo associa-se por `aria-describedby` ou `aria-errormessage`, sem duplicação.
- Durante persistência, a ação exibe `Salvando…` e a região recebe `aria-busy="true"`. Progresso determinado usa `progressbar` com nome, valor atual e total; apenas marcos úteis são anunciados. Título visual e RouteAnnouncer nunca repetem a mesma mensagem.
- Grids e calendars possuem headers programáticos; cells anunciam data e estado.
- Célula mensal com overflow só captura rolagem após interação explícita, é alcançável por teclado e mantém foco visível.
- Cabeçalho do dia e Task Rows na célula mensal têm nomes, papéis e foco independentes.
- Segmentos de densidade mensal expõem total e contagem por status em texto/nome acessível.
- Gráficos previstos têm resumo textual e tabela equivalente.
- Cor nunca comunica sozinha; ícone decorativo fica fora da árvore acessível.
- Conteúdo colapsado não recebe foco; sheets/dialogs contêm foco e devolvem ao acionador.
- O menu completo usa `nav` nomeada; destino ativo recebe `aria-current="page"` e o agrupador Saúde expõe `aria-expanded`, nunca `aria-current`.
- Grupo recolhido que contém a rota ativa mantém nome estável, `aria-expanded="false"`, não recebe `aria-current` e associa a descrição dinâmica `Contém a página atual: {destino ativo}.`; a descrição é removida quando nenhum filho está ativo.
- O foco inicial do menu mobile vai ao destino ativo e não fica encoberto por topbar, sheet, FAB, bottom nav ou safe-area.
- Labels ocultos no rail e no FAB preservam nome acessível. O badge anuncia a contagem exata mesmo quando mostra `9+`.
- Alterações de rota anunciam o nome completo da superfície; títulos longos podem truncar visualmente, nunca no nome acessível.
- Família/modo e slots de atalho formam grupos programáticos; erros associam-se ao controle e à ação Salvar. Estados dirty/saving/success/error são anunciados.

## Responsive & Platform

| Faixa | Navegação | Conteúdo |
|---|---|---|
| ≥1440px | sidebar inicia expandida em `{components.app-shell.sidebar-expanded}` | workspace até `{components.app-shell.workspace-max-width}`; gutter `{components.app-shell.gutter-wide}` |
| 1024–1439px | sidebar inicia expandida; pode virar rail `{components.app-shell.sidebar-collapsed}` | reduz colunas; gutter `{components.app-shell.gutter-medium}` |
| 768–1023px | rail `{components.app-shell.sidebar-collapsed}` | uma coluna; contexto abaixo; gutter `{components.app-shell.gutter-medium}` |
| <768px | topbar + três atalhos + Menu; FAB separado | sequência vertical; gutter `{components.app-shell.gutter-compact}`; sheets e safe-area |

O fluxo diário mobile não usa scroll horizontal. Tabelas históricas podem oferecer rolagem controlada apenas quando também existe resumo/lista utilizável; ações essenciais não ficam fora da viewport.

Weekly mobile mostra um dia por vez. Planejamento mantém densidade no topo, fonte ativa em largura total e índice de fontes em sheet; seleção de destino usa sheet/tela própria. O retorno preserva posição, filtros e colapsos.

Monthly wide mostra calendário completo com tarefas nas células e pool lateral **Sem dia definido**. Medium reduz a largura do pool e dos rails antes de abandonar a composição; tablet move contexto abaixo. No compact, seleciona-se uma data e lê-se sua lista completa, com todos os dias e o pool sem data alcançáveis sem scroll horizontal. No planejamento, densidade vem primeiro e fontes/destino usam sheets; retorno preserva contexto.

## Migration Strategy

| Onda | Escopo | Gate UX |
|---|---|---|
| 0 | inventário de rotas, estados, componentes e testes | baseline e divergências aprovados |
| 1 | tokens, tema, shell, headers, rows, panels, feedback e overlays | catálogo cobre estados, responsividade e AA |
| 2 | shell + Daily | paridade funcional desktop/mobile e rollback comprovado |
| 3 | Weekly, Monthly, Future, Migração/Catch-Up, Recorrentes, Arquivo | planners, ciclos e alocação preservados |
| 4 | Brain Dump e captura | indicador, captura mobile, processamento e rede equivalentes |
| 5 | Hábitos, Saúde, Medicamentos, Gratidão | nascem apenas na nova fundação |
| 6 | auth, settings, resíduos e remoção | nenhuma rota ativa depende do legado |

Coexistência ocorre por rota/superfície, com uma linguagem por vez. Depois da Onda 1, novas stories de UI referenciam o sistema novo ou registram exceção temporária, responsável, prazo e remoção. Não se mistura redesign com mudança de regra de domínio na mesma story.

## UX Acceptance Criteria

Uma story de implementação precisa:

1. Rastrear SPEC CAP, FR/épico e padrão deste spine.
2. Inventariar e preservar ações, estados, atalhos e feedback da superfície real.
3. Consumir tokens/componentes do novo `DESIGN.md`, sem valores estruturais locais injustificados.
4. Demonstrar wide, medium e compact por recomposição.
5. Cobrir loading, empty, error, offline, disabled e readonly/closed aplicáveis.
6. Passar teclado, foco, screen reader, touch target, zoom/reflow, reduced motion e contraste.
7. Preservar conteúdo em falha e seguir otimismo/rollback da arquitetura.
8. Preservar ciclos, status, linhagem, snapshots e alocação manual.
9. Ter testes semânticos/interação, E2E representativo e regressão visual complementar.
10. Definir ativação, rollback e remoção do legado por superfície.

## Decisions for Architecture and Stories

| Área | Decisão UX | Obrigação downstream | Fonte/detalhe |
|---|---|---|---|
| Fundação | temas, MUI/Phosphor, ownership e rollout por rota | definir fronteiras, persistência, flags e remoção | [`architecture-and-story-handoff.md`](architecture-and-story-handoff.md#fundação-transversal) |
| Weekly | ciclos, planejamento, densidade e linhagem | transações, constraints, idempotência e localizador | [M06](architecture-and-story-handoff.md#m06--weekly) |
| Monthly | continuidade, fontes, anuais e densidade | materialização, gates e snapshots | [M07](architecture-and-story-handoff.md#m07--monthly) |
| Future | horizonte, meses distantes e datear/mover | queries, linhagem e estados | [M08](architecture-and-story-handoff.md#m08--future-log) |
| Recorrentes | biblioteca, edição e soft delete | preservar `source_template` e alocação | [M09](architecture-and-story-handoff.md#m09--recorrentes) |
| Migração | fila unificada e ritual no shell | unificação, retomada, resumo e erro | [M10](architecture-and-story-handoff.md#m10--migraçãocatch-up) |
| Brain Dump | edição paritária do item; `scheduled_date` exercitado por Esta Semana/Este Mês; contagem otimista | endpoint de atualização (`PATCH`), invalidação de chaves, rollback de contagem | [M11](architecture-and-story-handoff.md#m11--brain-dumpcaptura) |

## Inspiration & Anti-patterns

Do MyBujo são aproveitados: hierarquia de regiões, headers temporais, superfície principal versus contexto, grids, chips compactos, sidebars contextuais e ritual dedicado.

São rejeitados: papel/caderno literal, annotation layer, toolbar, fontes/ícones/CSS/JS, dashboards genéricos, produtividade, streaks, fasting, analytics não previsto, auto-injeção de recorrentes e health fields fixos. A premissa do journal é comportamental: itens só entram no Weekly/Monthly após decisão explícita; fontes e projeções não fingem que já foram alocadas.

| Wireframe MyBujo | O que ilustra | Disposição canônica |
|---|---|---|
| [Daily Dashboard](<imports/mybujo-full-handoff/design_handoff_full_app/Daily Dashboard Wireframe.html>) | hierarquia de Hoje/dashboard | diferido à x.0 do Épico 17; sem antecipar home |
| [Weekly View](<imports/mybujo-full-handoff/design_handoff_full_app/Weekly View Wireframe.html>) | faixas semanais | substituído por [`mockups/key-weekly.html`](mockups/key-weekly.html) |
| [Monthly & Future Log](<imports/mybujo-full-handoff/design_handoff_full_app/Monthly & Future Log Wireframe.html>) | calendário e horizonte | substituído por [`mockups/key-monthly.html`](mockups/key-monthly.html) e [`mockups/key-future-log.html`](mockups/key-future-log.html) |
| [Migration Ritual](<imports/mybujo-full-handoff/design_handoff_full_app/Migration Ritual Wireframe.html>) | ritual de decisão | substituído por [`mockups/key-migracao.html`](mockups/key-migracao.html) |
| [Recurrents Engine](<imports/mybujo-full-handoff/design_handoff_full_app/Recurrents Engine Wireframe.html>) | biblioteca de templates | substituído por [`mockups/key-recorrentes.html`](mockups/key-recorrentes.html) |
| [Habits Tracker](<imports/mybujo-full-handoff/design_handoff_full_app/Habits Tracker Wireframe.html>) | tracker/configuração | diferido à Story 16.0 |
| [Gratitude Journal](<imports/mybujo-full-handoff/design_handoff_full_app/Gratitude Journal Wireframe.html>) | escrita e histórico | absorvido por Journalling; diferido à Story 16.10 |
| [Health Tracking](<imports/mybujo-full-handoff/design_handoff_full_app/Health Tracking Wireframe.html>) | métricas e histórico | diferido à Story 16.3 |
| [Analytics Dashboard](<imports/mybujo-full-handoff/design_handoff_full_app/Analytics Dashboard Wireframe.html>) | análises de período | diferido à x.0 do Épico 21 |

Os nove HTMLs são referências ilustrativas: os spines vencem em conflito. Scripts e fontes no pacote são dependências internas do import, não referências visuais autônomas.

### Rastreabilidade UJ e aliases

| Jornada upstream verbatim | Nome canônico/alias | Destino |
|---|---|---|
| UJ-1 — O Dia de Hugo | Dashboard-panorama + Hoje | diferido à x.0 ampliada do Épico 17; Fluxo 1 é somente subfluxo Hoje |
| UJ-2 — A Semana de Hugo | Planejar a semana | Fluxo 2 |
| UJ-3 — Abertura do Mês | Planejar o próximo mês | Fluxo 5 |
| UJ-4 — Captura Rápida no Mobile | Capturar no mobile | Fluxo 3 |
| UJ-5 — Future Log | Capturar longe e reencontrar | Fluxo 6 |
| UJ-6 — Diário de Gratidão | Journalling · campo seed “Gratidões” | diferido à Story 16.10 |
| UJ-7 — Saúde e Medicamentos | Saúde agrupador → Métricas + Medicamentos | diferido à Story 16.3 |
| UJ-8 — Configuração de Hábitos | Hábitos | diferido à Story 16.0 |

### Rastreabilidade FR agrupada

| Faixa de requisitos | Superfície/fluxo | Status | Fonte/gate |
|---|---|---|---|
| FR-0–FR-3 | Fundação, collections, IA e automação | plataforma/handoff | PRD + arquitetura |
| FR-4 | Núcleo BuJo | Fluxos 1, 2 e 5 | PRD/épicos |
| FR-5 | Brain Dump/captura | Fluxo 3 | PRD/Story 13.0 + Story 15.0 |
| FR-6 | Home/dashboard | diferido | x.0 do Épico 17 |
| FR-7 | Hábitos | diferido | Story 16.0 |
| FR-8–FR-9 | Saúde-Métricas + Medicamentos | diferido | Story 16.3 |
| FR-10 | Journalling/Gratidões | diferido | Story 16.10 |
| FR-11–FR-13 | Alimentação, Pressão e Análises | diferido | gates dos épicos correspondentes; Análises na x.0 do Épico 21 |
| FR-14–FR-15 | Custom Collections e usuários | backlog/handoff | PRD + épicos |

Detalhamento completo, com cada ID e nomenclatura upstream: [`requirements-traceability.md`](requirements-traceability.md).

## Key Flows

### Fluxo 1 — Subfluxo Hoje (Hugo, manhã, desktop)

1. Hugo abre Hoje; shell e período atual aparecem imediatamente.
2. Se existem pendências, uma faixa discreta informa a quantidade e a contagem por fonte (meses/semanas/dias).
3. Hugo aciona a migração; o ritual abre dentro do shell, com as fontes na ordem mês → semana → dia.
4. Para cada tarefa, lê origem/linhagem e decide: migrar para hoje, escolher outro destino (esta semana, dia no mês, outro mês ou sem dia) ou cancelar. Cada decisão persiste e o progresso avança.
5. Pode pausar e sair sem perder nada; ao retomar, continua com os itens restantes.
6. **Clímax:** decidida a última, um resumo factual mostra o que foi migrado, adiado e cancelado; Hugo volta ao Hoje e vê apenas as tarefas realmente trazidas, na superfície pronta para trabalhar.

Falha: erro de leitura fica na região de conteúdo com retry e shell navegável. Offline mantém dados já carregados, sem prometer carregar um dia ausente do cache; mutações ficam indisponíveis com motivo. Este fluxo não define o ponto de entrada pós-login nem cobre integralmente UJ-1.

### Fluxo 2 — Planejar a semana (Hugo, entre sexta e terça, laptop)

1. Hugo abre Semana; a superfície mostra o Weekly operacional **Em andamento**, mesmo quando o calendário avançou.
2. Aciona **Planejar próxima semana**, confirma a semana-alvo sugerida ou escolhe outra atual/futura.
3. No ritual, revisa livremente Monthly datado, Monthly ampliado quando necessário, recorrentes, Weekly anterior e Daily pendentes; densidade real permanece visível.
4. Para cada item, decide individualmente: migrar/alocar num dia ou sem data, adiar, concluir, cancelar ou manter quando permitido. Cada decisão persiste e atualiza densidade/histórico.
5. Conclui o planejamento sem precisar zerar avisos. Quando o Weekly anterior fica sem tarefas abertas, finaliza-o no próprio ritual após confirmação irreversível.
6. A partir da segunda-feira-alvo, abre o painel de verificação e confirma **Iniciar semana**.
7. **Clímax:** a nova semana entra **Em andamento** com cada registro apenas onde Hugo decidiu colocá-lo; a anterior está finalizada e somente leitura, sem dois ciclos ativos nem auto-injeção.

Falha: aplica **Resiliência canônica**; a exceção do ritual é que uma fonte indisponível não bloqueia as demais e retomar devolve Hugo à fonte, lista e posição anteriores.

### Fluxo 3 — Capturar no mobile (Hugo, em deslocamento)

1. Hugo aciona captura persistente.
2. O sheet abre com foco no título e Brain Dump como destino padrão.
3. Salva; o sheet fecha, o indicador do Brain Dump aumenta e o foco volta ao acionador, sem tirar Hugo do contexto anterior.
4. Mais tarde, no Brain Dump, Hugo encontra o item na lista e aciona **Mover**: escolhe o destino no seletor (mesma anatomia do ritual de migração) e confirma — a tarefa nasce no destino, a linha some da caixa e a contagem cai. Se só quer ajustar o texto, abre o item e edita Título/Descrição/Destino em vez de mover.
5. **Clímax:** o item que nasceu como uma nota rápida durante o deslocamento vira uma tarefa no lugar certo, sem que Hugo tenha perdido o pensamento nem parado o que estava fazendo para decidir o destino na hora da captura.

Falha: a captura preserva o texto digitado, com retry na própria ação; Mover e a edição do item preservam a entrada e mostram o erro junto ao controle, com retry local. Offline desabilita captura e ações de item com motivo acessível; a leitura da lista já carregada permanece disponível.

### Fluxo 4 — Consultar ciclo fechado (Hugo, desktop, revisão mensal)

1. Hugo abre Arquivo e seleciona um mês fechado.
2. Vê status final, linhagem e itens por período com contraste normal.
3. Navega entre detalhes sem controles de mutação acidental.
4. **Clímax:** entende o destino de uma tarefa migrada e retorna ao período sem perder filtro ou posição.

Falha: erro preserva período, filtros e posição com retry local. Offline mantém ciclos já carregados; ciclo não disponível localmente comunica indisponibilidade sem simular vazio.

### Fluxo 5 — Planejar o próximo mês (Hugo, na semana da virada, laptop)

1. Hugo abre Mês e vê o Monthly **Em andamento**; aciona **Planejar próximo mês**, cujo alvo sequencial já está determinado.
2. No ritual, revisa livremente Recorrentes, Future Log e Monthly anterior nessa ordem, mantendo o minicalendário de densidade real visível.
3. Para cada recorrente mensal/anual elegível, aloca uma instância num dia ou sem dia, ou envia ao Future Log quando o ano permitir; **Já alocados** continua disponível para instâncias adicionais.
4. Para cada item do Future Log, escolhe um dia, registra **Manter sem dia** ou adia; para cada `pending`/`started` do Monthly anterior, conclui, cancela, migra ou adia. Cada decisão persiste e atualiza histórico, avisos e densidade.
5. Conclui o planejamento mesmo se restarem avisos. Quando o Monthly anterior fica sem tarefas abertas, finaliza-o explicitamente; a partir do dia 1, verifica o gate e confirma **Iniciar mês**.
6. **Clímax:** a fila ideal está sem decisões pendentes e Hugo retorna ao calendário mensal, pronto para iniciar separadamente o planejamento da primeira semana, sem tarefa inserida automaticamente no Weekly.

Falha: aplica **Resiliência canônica**; uma fonte indisponível não bloqueia as demais e retomar preserva fonte/lista/posição. Meses ausentes repetem o fluxo integralmente, um por vez.

### Fluxo 6 — Capturar longe e reencontrar (Hugo, organizando o ano, laptop)

1. Hugo abre o Futuro e vê os oito meses seguintes no trilho, cada um com sua contagem; agosto abre em foco.
2. Captura "Renovar seguro do carro" com apenas o mês de janeiro; o item aparece em janeiro como `— jan`, sem dia.
3. Precisa registrar algo para junho do ano seguinte, fora do horizonte: captura com a data completa; junho/2027 passa a existir no seletor.
4. Semanas depois, procura o item distante: aciona **Ir para mês…**, vê "Junho 2027 · 2 itens", seleciona e o foco vai até lá sem que o trilho tenha crescido.
5. De volta a agosto, resolve o dia da consulta que estava só no mês: **Definir dia** → 14 de agosto; a origem vira migrada e o sucessor nasce datado, com a seta ligando os dois.
6. **Clímax:** nada do que Hugo lançou meses à frente se perdeu — o horizonte próximo está à mão, o distante está a um seletor de distância com a contagem à vista, e datar preservou a linhagem.

Falha: aplica **Resiliência canônica**; retry não troca o mês e retomar preserva mês em foco, posição e item em decisão.

### Fluxo 7 — Ajustar aparência em todos os dispositivos (Hugo, à noite, desktop)

1. Hugo abre Configurações → Aparência; Mineral · Claro aparece como aplicado.
2. Escolhe Horizonte Azul e Sistema. O formulário marca alterações não salvas, mas o shell continua Mineral · Claro.
3. Revisa a amostra e aciona **Salvar**.
4. O botão comunica `Salvando…` e impede um segundo envio.
5. **Clímax:** após confirmação do banco, o shell passa para Horizonte Azul na variante do sistema; ao abrir a conta em outro dispositivo, a mesma família e modo estão ativos.

Falha: o salvamento falha; Mineral · Claro permanece aplicado, Horizonte Azul · Sistema continua selecionado no formulário e `Não foi possível salvar. Tente novamente.` oferece nova tentativa.

### Fluxo 8 — Configurar e usar a navegação mobile (Hugo, preparando acesso rápido, mobile)

1. Hugo abre Configurações → Navegação mobile.
2. Escolhe Hoje, Brain Dump e Esta Semana nos três slots; Menu permanece fixo.
3. Salva e volta ao shell; a bottom nav mostra os três atalhos e Menu.
4. Abre Métricas pelo Menu. Como Métricas não está entre os atalhos, Menu fica selecionado na bottom nav.
5. Abre Menu novamente; o sheet alto foca Métricas na lista completa, que também repete os três atalhos.
6. **Clímax:** Hugo navega para Arquivo sem perder acesso à captura; ao fechar o sheet sem navegar, foco retorna a Menu.

Falha: ao tentar desligar uma collection que ocupa um atalho, Salvar permanece bloqueado e indica qual slot exige substituição. Se um destino desaparece externamente, o primeiro destino canônico disponível e não duplicado ocupa a lacuna.
