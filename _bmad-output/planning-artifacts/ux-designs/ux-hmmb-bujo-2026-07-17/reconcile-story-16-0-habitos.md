# Reconciliação — Story 16.0 (Hábitos)

Data: 2026-08-21
Entrada: `imports/story-16-0-habitos-handoff/` (pacote produzido por Hugo no Claude Design; original em `docs/ux-handoffs/16-0`)

## Resultado

| Tema da entrada | Destino canônico | Resultado |
|---|---|---|
| Contrato e escopo (§1) | `EXPERIENCE.md.Hábitos` + `DESIGN.md.Hábitos (Registro)` | Promovido |
| Domínio preservado (§1.4) | `EXPERIENCE.md.Hábitos` + `architecture-and-story-handoff.md#m12--hábitos` | Promovido como descrição, nunca como redesenho — regras do Épico 6 são autoridade herdada |
| Superfícies, camadas e faixas (§2) | `DESIGN.md.Hábitos (Registro)` | Promovido; ordem canônica das abas fixada em **Hoje · Histórico · Configuração** |
| Tracker diário (§3) | `DESIGN.md.Hábitos (Registro)` (anatomia) + `EXPERIENCE.md.Hábitos` (comportamento) | Promovido; variante **Habit Tracker Row** e **Registro em cards** documentadas |
| Configuração (§4) | `EXPERIENCE.md.Hábitos` | Promovido; separação identidade × versionado e aviso persistente (nunca tooltip) |
| Seleção de pictograma (§5) | `DESIGN.md.Seleção de pictograma` + `DESIGN.md.Dialog/Sheet` | Promovido; catálogo passa de fechado a **aberto** (mudança consciente, ver Divergências) |
| Histórico e evolução (§6) | `EXPERIENCE.md.Hábitos` + `DESIGN.md.Grid/Calendar` | Promovido; grade agregada documentada, mas sua **agregação** fica na Story 16.2b |
| Integração com o Hoje (§7) | `EXPERIENCE.md.Hábitos` | Promovido nas duas lentes (Foco e Dia completo) |
| Matriz de estados (§8) + textos verbatim (§8.1) | `EXPERIENCE.md.State Patterns` | Promovido; 5 linhas novas — a maioria já coberta pelos padrões genéricos |
| Interação e teclado (§9) | `EXPERIENCE.md.Hábitos` | Promovido; as regras de teclado do módulo (commit em `blur`/`Enter`, alternância booleana pelo rótulo no compact, setas no `radiogroup` de pictogramas) vivem na prosa da seção, não em `Interaction Primitives` — são específicas da superfície, não primitivos transversais |
| Acessibilidade (§10) | `EXPERIENCE.md.Accessibility Floor` | Já coberto pelos princípios gerais; nenhuma exceção nova. Verificação **formal** de a11y segue descontinuada desde a retro do Épico 15 — não reintroduzida |
| Delta de design system | `DESIGN.md` (frontmatter + seções) | Parcialmente confirmado: **nenhuma cor nova**, mas 4 blocos de token de geometria adicionados (ver Divergências) |
| `domain-gaps.md` (4 leituras) | `epics.md` Story 16.2b + `EXPERIENCE.md.Módulos futuros` + `#m12` | Promovido como desenho aprovado **não implementável** até a 16.2b |

## Questões abertas — decisões de Hugo (2026-08-21)

| # | Decisão | Onde ficou registrado |
|---|---|---|
| Q1 — carga do catálogo | Virtualização **obrigatória**; fonte única é o pacote instalado. | `DESIGN.md.Seleção de pictograma` |
| Q1b — glifo órfão | Servidor valida contra a versão instalada; chave órfã cai para **coluna vazia**, nunca tofu. | `DESIGN.md.Seleção de pictograma` + `#m12` |
| Q2 — migração do `emoticon` | **Handoff vence o AC2 da story**: o emoji sai da interface, `iconKey` é obrigatório, sem fallback. A Story 16.2 ganha migração de dado. | `DESIGN.md.Pictogramas de domínio` + `EXPERIENCE.md.Pictogramas de hábitos e saúde` + `epics.md` 16.1/16.2 + `#m12` |
| Q3 — ordenação | Mantida a ordem do servidor; `display_order` sem UI nem endpoint. Não vira requisito agora. | sem mudança de contrato |
| Q4 — largura de leitura | **Variante canônica** "Registro em cards" (não exceção local): 2 colunas em wide, workspace até 1120px. Saúde-Métricas (16.3) reaproveita. | `DESIGN.md.Hábitos (Registro)` + token `record-cards` |
| Q5 — dias passados | **Sem limite de retroatividade**: qualquer dia já semeado é editável, com os pesos congelados. Nenhuma regra nova de backend. | `EXPERIENCE.md.Hábitos` + `#m12` |
| Q6 — entrada decimal | `inputmode="decimal"`; parser aceita vírgula e ponto (obrigação de implementação). | `EXPERIENCE.md.Hábitos` |
| Q7 — leituras da 2l | **Promover revogando o limite** "sem streaks" como proibição de *métrica agregada*; celebração segue proibida. Vira **Story 16.2b**. | `epics.md` UX-DR13/UX-DR19 + Story 16.2b + `EXPERIENCE.md.Voice and Tone` |
| Q8 — visões do gráfico | Resolvida no próprio pacote (3 visões sobre o payload existente, sem API nova). | `EXPERIENCE.md.Hábitos` |
| Q9 — checkbox indicador | Adotado como **saída, não entrada**; nota no catálogo para não confundir com disabled por permissão. | `DESIGN.md.Hábitos (Registro)` |
| Q10 — agregação | Definições fixadas (denominador, média simples, ano civil, semana parcial) — alvo da 16.2b. | `EXPERIENCE.md.Módulos futuros` + `epics.md` 16.2b + `#m12` |

## Divergências resolvidas

| Handoff / spine original | Spine aprovado |
|---|---|
| AC2 da Story 16.0: "`iconKey` Phosphor **+ fallback ao emoticon atual**" | Revogado por Q2 — o emoji sai da interface de Hábitos; o AC foi reescrito no `epics.md` e a migração de dado virou escopo da 16.2 |
| `EXPERIENCE.md`: catálogo de pictogramas "**fechado** e pesquisável" | Catálogo **aberto** (~1.500 nomes do Phosphor, busca por substring em inglês). Delimitado: o catálogo curado permanece válido **no App Shell**, onde os destinos são fixos — a abertura vale para o `iconKey` de domínio |
| `EXPERIENCE.md`: "A migração preserva o `emoticon` existente como fallback... registros sem mapeamento continuam exibindo o emoji" | Revogado em texto explícito (não apagado), para que o leitor do spine veja que houve revogação |
| `epics.md` UX-DR13/UX-DR19: "zero gamificação/sequências" | Qualificado: revogada a proibição de **métrica agregada** factual; mantida integralmente a proibição de **celebração** (chama colorida, medalha, "não quebre a corrente", cor que muda conforme o número) |
| `architecture-and-story-handoff.md`: "`iconKey` é mudança contratual isolada, **retrocompatível**" | Deixa de ser retrocompatível: carrega migração de dado, porque o emoji deixa de ser renderizado |
| `design-system-delta.md` §C.6: "**nenhum token novo**" | Verdadeiro para **cores** — nenhuma cor nova. Falso para geometria: 1120px, 520px, 44px de coluna de controle, 104px de campo, 8px/6px de barra e 6/4 colunas de grade não tinham endereço. Como Q4 promove "Registro em cards" a variante reutilizável, medida sem token seria inendereçável — 4 blocos adicionados (`record-cards`, `completion-bar`, `habit-tracker-row`, `pictogram-picker`), todos com valores literais do handoff |
| §6 da story: grade booleana "dias feitos sobre **dias do período**" ("5/7") | Denominador decidido é **dias com registro**; a coluna rotula os dias reais quando os dois divergem, o que reconcilia os dois textos |
| §3.4 da story: "Limite de retroatividade em aberto (Q5)" | Fechado: sem limite |

## Cobertura de mockup

`mockups/key-habitos.html` — promovido de `.working/` nesta sessão. Cobre os frames F1–F12, overlays O1–O2 e estados E1–E6 do pacote de origem, mais F13–F15 isolados num bloco com aviso de que são alvo da Story 16.2b e não implementáveis hoje.

O anexo visual de origem (`Story 16.0 - Handoff visual.html`) é um bundle auto-extraível de ~5MB e permanece em `imports/` como evidência, não como fonte editável.

## Reviewer Gate (2026-08-22)

Rodado com rubric walker, lente única escolhida por Hugo. Achados: 0 critical, 3 high, 3 medium, 4 low. Verdicts: completude de token, referência visual, inchaço, herança e forma **STRONG**; cobertura de estado **ADEQUATE**; fluxo **THIN**; componente **BROKEN**. O critical da rodada 15.0 (tokens quebrados) não reincidiu — 452 tokens, 0 referências quebradas. Os três high foram corrigidos nesta mesma sessão:

- **High — UJ-8/FR-7 órfãos.** Nenhum fluxo cobria Hábitos. Criado o **Fluxo 9 — Configurar e registrar hábitos**, com clímax marcado e parágrafo de falha no formato dos outros oito; tabelas de rastreabilidade repontadas.
- **High — catálogo bilateral dessincronizado.** O DESIGN.md ganhou 5 linhas e o EXPERIENCE.md só 1. Adicionadas 4 linhas comportamentais e renomeada `Hábitos` → **`Hábitos (Registro)`** para que as duas tabelas casem por nome.
- **High — DIR-12c.** Ver abaixo.

Medium de copy também corrigido: três strings verbatim que só viviam no mockup — "Crie um grupo para começar a adicionar hábitos.", "Nenhum registro no período." e a copy de offline — foram levadas ao texto do spine.

Relatório completo: [`review-rubric.md`](review-rubric.md).

### DIR-12c — collection desligada/ausente

O pacote de origem **não cobriu** o estado "collection desligada/ausente", apesar de ser AC explícito da Story 16.0 (AC3). Achado do Reviewer Gate desta sessão, não do handoff. A recusa que a Story 15.0 registrou legitimamente — "o núcleo BuJo não é gateável, DIR-12c não se aplica" — **não vale aqui**: Hábitos é collection gateável (só o núcleo é não-gateável, FR-1.1).

Decisão de Hugo (2026-08-22): fechar por **contrato comportamental**, sem frame novo — o comportamento é ausência, e desenhar ausência renderia frame pobre. As linhas genéricas `Nav sem collections` e `Nav com uma collection` já cobriam a navegação; a linha nova **Hábitos com a collection desligada** (`EXPERIENCE.md.State Patterns`) fecha o que faltava: rota direta não resolve, núcleo/Planner/Hoje intactos, nenhum dado apagado, religar devolve o histórico. A verificação disso é da Story 16.1, junto com o manifest da collection (`registry.ts`).

## Decisão posterior — escala do heatmap (2026-08-22)

Depois da revisão visual do mockup, Hugo inverteu o canal de leitura da grade **hábitos × períodos**: o **tom** passa a ser o canal primário e o número recua.

O tom deixou de ter quatro faixas e virou **escala contínua** — a célula pinta `primary` sobre `surface` com alpha igual à própria completude, de modo que 71% é literalmente 71% de opacidade. O booleano usa a razão real da fração (`5/7` pinta a 71%, não 5%). O número herda a cor do próprio fundo um degrau mais escura: continua presente para conferência, sem competir com a mancha.

**Duas regras escritas neste mesmo gate foram revogadas** por essa decisão: "o número dentro da célula é o canal primário e o tom é apenas reforço" e "nenhuma célula fica abaixo de 4,5:1". Permanece válida: "célula sem número é bug, não variante".

A queda de contraste está registrada como **exceção nomeada** em `EXPERIENCE.md.Accessibility Floor` — a única do produto, não extensível a outra superfície. A acessibilidade da leitura não fica presa à cor: a tabela equivalente em `details` é permanente na mesma superfície, em contraste normal e com os mesmos números, ao lado de `caption`, `th scope` em linha e coluna e as tags textuais FDS/FER.

## Lacunas conscientes do mockup

Três itens do pacote de origem não ganharam frame próprio. Nenhum é omissão silenciosa:

1. **Alternador semana/quinzena da grade agregada** (§6 do pacote). Não desenhado e **não promovido aos spines**: o alternador depende da mesma agregação diferida à Story 16.2b, e implicaria dois tamanhos de bucket na mesma rota. A grade do mockup mostra a leitura semanal fixa. Se a 16.2b quiser o alternador, ele é decisão dessa story — não há contrato herdado a honrar.
2. **Erro por campo na configuração** (§8, coluna Configuração). O padrão está descrito no spine (erro inline sob o campo ou o bloco que falhou, `aria-invalid` e `role="alert"` no Accessibility Floor) e demonstrado em E5 na falha parcial do multiplicador, mas sem frame dedicado mostrando `aria-invalid` no campo de peso. Padrão genérico já canônico — cobertura suficiente, não frame por volume.
3. **"Ver todos os N hábitos"** (alta densidade do bloco no Hoje). Aparece no F11 compact, não como estado separado no F10 wide.

## Escopo explicitamente NÃO promovido

Recusas do pacote de origem, mantidas: exclusão de hábito (o domínio desativa, nunca deleta); tipo de hábito, métrica, regra de completude, campo, filtro, busca ou ordenação manual novos; reordenação por arraste (Q3); fila offline, rascunho local, autosave ou sincronização posterior; toast de sucesso e qualquer celebração; recomendação, insight, sugestão de meta ou IA; lembrete e notificação; compartilhamento, exportação e importação; edição dentro do histórico (a correção acontece na aba Hoje).

Fora de escopo por fronteira de story: Saúde-Métricas e Medicamentos (16.3), Journalling/Gratidões (16.10).
