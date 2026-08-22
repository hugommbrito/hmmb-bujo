# Story 16.0 — Mockup de Hábitos no sistema novo · Especificação de UX

> Fonte visual: `Story 16.0 - Habitos.dc.html` (pacote de handoff).
> Âncoras citadas abaixo (`#2e`, `#2f`, `F1`, `O1`, `E3`…) referem-se a esse arquivo.
> Em conflito, `uploads/DESIGN.md` e `uploads/EXPERIENCE.md` vencem; este documento é a leitura de UX do gate 16.0.
> O módulo de Hábitos **já existe** (Épico 6, stories 6.1–6.4). Esta story recompõe a apresentação sobre o design system novo **sem alterar domínio**. Toda obrigação de paridade está em `traceability.md` §2.

## 1. Contrato e escopo

AC único da 16.0: entregar o mockup de Hábitos no sistema novo — registro do dia, configuração de hábitos e grupos, pictograma por `iconKey`, histórico navegável e evolução — com a matriz completa de estados e as três faixas por recomposição, e promover o resultado a DESIGN/EXPERIENCE antes das stories de implementação.

### 1.1 Obrigatório
- Registro e edição dos hábitos do dia, booleano e numérico (FR-7.2/7.3).
- Completude ponderada do dia e por grupo, **calculada no servidor** (FR-7.4).
- Configuração de hábitos e grupos com efeito prospectivo (FR-7.5/7.6).
- Ativar e desativar sem excluir; inativo permanece no histórico (FR-7.7/7.8).
- Histórico consultável por data e evolução por hábito com eventos datados (FR-7.9/7.10).
- Multiplicador por grupo × tipo de dia, precedência feriado > fim de semana > dia útil (AR-17).
- Pictograma Phosphor por `iconKey`, o mesmo em cadastro, Hoje, tracker, grades e históricos.
- Estados: vazio, loading, saving, sucesso, erro com retry, offline, falha parcial.
- Wide 1440 · medium/tablet 900 · compact 390, sem scroll horizontal, alvos ≥44px (48px no toque).

### 1.2 Permitido
- Abas dentro de Hábitos na ordem **Hoje · Histórico · Configuração** (paridade com as abas vigentes, mais a de configuração).
- Expor os fatores já congelados na linha — peso base, multiplicador e peso efetivo — como texto de transparência.
- Substituir o `emoticon` legado pelo pictograma: o campo de emoji **sai** da interface (ver Q2).
- Escrita otimista na marcação do dia e no feriado, com rollback e erro inline (UX-DR14/15).
- Recompor a grade densa como lista por dia no compact (comportamento já vigente).
- Cards de grupo no tracker, em duas colunas em wide e uma coluna nas demais faixas (ver Q4).

### 1.3 Fora de escopo
- Streak, ranking, conquista, recompensa, gamificação, recomendação, insight ou IA **nas superfícies 2e–2j**. O que foi desenhado a pedido da revisão está isolado em `#2l` e depende de `domain-gaps.md`.
- Tipo de hábito novo, métrica nova, regra de completude nova, campo, filtro, rota ou mutação nova.
- Exclusão de hábito — o domínio desativa, nunca deleta.
- Redesenho de sidebar, rail, topbar, bottom nav, Daily Log ou do Hoje como superfície.
- Reordenação de grupos: `display_order` existe no schema e não tem UI nem endpoint (Q3).
- Fila offline, rascunho local, sincronização posterior. Registrar exige rede.
- Toast de sucesso e qualquer celebração — o sucesso é a mudança do valor e da porcentagem.

### 1.4 Domínio preservado (verbatim do contrato técnico)

**Rotas.** `GET/POST /api/habits/` · `PATCH /api/habits/{id}/` (identidade: `name`, `emoticon`, `unit`, `group`) · `POST /api/habits/{id}/versions/` (versão prospectiva: `weight`, `meta`, `bonus`, `active`) · `GET/POST /api/habit-groups/` · `GET/PUT /api/habit-groups/{id}/multipliers/` · `GET /api/habits/days/?date` · `PATCH /api/habits/days/{entryId}/` (`value`, `multiplierAtTime`, correção de dia passado) · `POST /api/habits/holidays/` · `GET /api/habits/history/?start&end` · `GET /api/habits/{id}/series/?start&end`.

**Completude** (servidor, nunca inferida pela interface):
- contribuição do booleano = 1 quando `value = 1`, senão 0;
- contribuição do numérico = 1 ao atingir `metaAtTime`, senão `(value / meta) × (1 − bonus/100)`; `bonus` nulo = 0;
- peso efetivo = `weightAtTime × multiplierAtTime`;
- completude = `Σ(contribuição × peso efetivo) / Σ(peso efetivo)`, inteiro, meio para cima; `Σ peso efetivo = 0` → 0;
- `value` nulo = não feito; booleano marcado = 1;
- `weekday` = 1,00 implícito e nunca armazenado; grupo sem config para o tipo do dia = 1,00.

**Versionamento.** `weight`, `active`, `meta` e `bonus` são versionados (INSERT com `effective_from = hoje`; segunda mudança no mesmo dia faz UPDATE da versão do dia). `name`, `emoticon`/`iconKey`, `group` e `unit` são identidade (UPDATE direto, não versionado). `type` é imutável após a criação. Corrigir um dia passado toca só a linha daquele dia.

**Semeadura.** A primeira abertura do dia materializa uma linha por hábito ativo, congelando peso, meta, bônus, tipo de dia e multiplicador. A interface não cria linhas: ela abre o dia.

## 2. Superfícies, camadas e faixas

| Superfície / camada | Rota / origem | Faixas | Estados cobertos |
|---|---|---|---|
| Hábitos → Hoje (tracker do dia) | rota de Hábitos, aba Hoje | wide 1440 · tablet 900 (rail) · compact 390 | populated · loading · sem hábito ativo · sem grupo · saving · erro de escrita com retry · offline · dia de ritmo · override avulso · alta densidade |
| Hábitos → Configuração | rota de Hábitos, aba Configuração | wide · tablet · compact | populated · sem grupo · grupo vazio · edição versionada · inativo · mostrar inativos · saving · erro por campo · falha parcial da config de multiplicador · offline |
| Escolher pictograma (Dialog/Sheet) | campo Pictograma na criação e na edição de identidade | dialog em wide/medium/tablet · sheet no compact | default · selecionado · sem pictograma · busca sem resultado · saving · erro com retry |
| Hábitos → Histórico | rota de Hábitos, aba Histórico | wide · tablet · compact (grade vira lista) | populated · loading · intervalo sem registro · dia-lacuna · série sem hábito escolhido · erro de leitura com retry · falha parcial · readonly |
| Hoje — integração mínima | superfície existente do Hoje, duas lentes | wide (recorte) · compact (recorte) | totalizador em Foco · lista densa editável em Dia completo · módulo sem hábito ativo · falha do bloco sem derrubar o Daily Log |
| **2l — leituras pedidas na revisão** | Histórico, blocos adicionais | wide | **não implementável hoje** — ver `domain-gaps.md` |

Ordem das abas: **Hoje · Histórico · Configuração** em todas as faixas (no compact, "Config." pela largura). Nenhuma camada abre sobre outra: o seletor de pictograma é a única profundidade de overlay do módulo.

## 3. Tracker diário (F1–F4)

Ordem de leitura idêntica nas três faixas: **data e tipo de dia → completude do dia → registro por grupo**.

- **F1 · wide 1440** — cards de grupo em duas colunas (~520px cada), workspace até 1120px. Cada card: nome do grupo, porcentagem ponderada, peso efetivo, barra redundante, linhas do grupo.
- **F3 · tablet 900** — rail de 64px, mesmos cards em uma coluna.
- **F4 · compact 390** — cards em uma coluna; a linha booleana vira alvo único de 48px (rótulo inteiro clicável) e a numérica quebra em duas faixas: identidade e estado em cima, campo de largura total embaixo alinhado à coluna do nome. O conteúdo reserva 96px ao fim para não ficar sob a bottom nav.

### 3.1 Anatomia da linha
| Coluna | Booleano | Numérico |
|---|---|---|
| 44px | checkbox interativo (`1` ↔ nulo) | checkbox **desabilitado**, marcado quando a meta é atingida (indicador, não controle — Q9) |
| 20px | pictograma `iconKey`, `aria-hidden` | idem |
| flex | nome + peso na extremidade direita da mesma linha; abaixo, o estado | nome + peso à direita; abaixo, `valor / meta unidade (percentual da meta)` ou "Meta atingida" |
| trailing | — | campo numérico de 104px, `text-align:right` |

- Peso é escrito como inteiro quando não há fração ("Peso 2"); a vírgula só aparece no valor quebrado ("Peso 3 × 0,5 = 1,5").
- Estado textual obrigatório: **"Feito" / "Não feito"** — a marca do checkbox nunca é o único canal.
- Campo numérico: commit no `blur` e no `Enter`; campo vazio grava nulo; só envia quando o valor muda.

### 3.2 Completude
Uma leitura por escopo (dia e grupo): porcentagem em texto tabular + barra redundante de mesma largura em todas as faixas, com o denominador nomeado ("Soma dos pesos efetivos do dia: 14,0 · 7 de 11 registros preenchidos"). A interface **nunca** recalcula a porcentagem: a marcação é otimista no valor da linha e a porcentagem reconcilia com o refetch.

### 3.3 Tipo de dia, multiplicador e override (F2)
- Feriado é marcado por data, no cabeçalho de completude.
- A legenda do grupo ("Feriado · peso ×0,5 neste grupo") só aparece quando o dia não é útil **e** o multiplicador difere de 1.
- Os fatores aparecem separados na linha: `Peso 3 × 0,5 = 1,5`.
- Override avulso "Tratar este dia como dia útil (peso cheio)" grava `multiplierAtTime = 1,00` em cada linha do dia e não altera a configuração dos grupos.

### 3.4 Dias passados
A navegação de data no tracker edita qualquer dia já semeado, com os pesos congelados daquele dia — comportamento confirmado na revisão. Limite de retroatividade em aberto (Q5).

## 4. Configuração de hábitos e grupos (F5–F7)

Padrão Coleção: grupos → hábitos do grupo → criação ao fim. Dois blocos de edição **visualmente separados por natureza de dado**:

| Bloco | Campos | Efeito |
|---|---|---|
| Identidade | nome, pictograma, unidade, grupo | UPDATE direto; vale para todo o histórico |
| Versionado | peso, meta, bônus, ativação | INSERT de versão com `effective_from = hoje` |

- O aviso **"Alteração válida a partir de hoje. Registros anteriores preservados."** é texto persistente sob os campos versionados — nunca tooltip (não sobrevive a teclado nem a toque).
- **Criação:** grupo é obrigatório; sem grupo, criar hábito fica indisponível com o motivo escrito. Nome, grupo, tipo e peso inicial são obrigatórios; meta, bônus e unidade só existem no numérico. Tipo por **radio group** (não select) e imutável depois.
- **Inativos:** fora da lista por padrão, aparecem com "Mostrar inativos", somem do dia ativo, permanecem no histórico. Tratamento terminal (opacidade 0,58) **e** chip textual "Inativo". Ações nomeiam a consequência: "Desativar hábito" / "Reativar hábito". **Excluir não existe.**
- **Multiplicadores do grupo:** dois campos por grupo (fim de semana e feriado), preenchidos pela config vigente, salvos prospectivamente; campo vazio remove a config e devolve 1,00. Precedência declarada no próprio bloco. No compact o bloco vive em `details`. Entrada decimal: ver Q6.
- **Grupo vazio:** "Nenhum hábito neste grupo." sem ação sugerida.

## 5. Seleção de pictograma (O1–O2)

- `iconKey` guarda **o nome do glifo Phosphor**, sem variação de peso: `regular` é fixo no front-end e `fill` permanece reservado ao destino selecionado do App Shell.
- Catálogo **aberto**: os ~1.500 nomes únicos do Phosphor, buscáveis por substring do nome em inglês. Sem categorias e sem sinônimos em pt-BR. O nome do glifo nunca aparece fora do seletor.
- Grade de tiles: 6 colunas no dialog, 4 no sheet; cada tile é um `role="radio"` focável — sem controle desenhado; seleção por borda e fundo `primary` + `aria-checked`; foco pelo anel de 2px com offset.
- Contador anunciado por `aria-live="polite"`: "11 de 1.512 ícones contêm 'dr'". Sem busca, a lista abre pelos ícones já usados pelos hábitos existentes, seguidos do catálogo em ordem alfabética.
- **Virtualização obrigatória** — a grade não monta ~1.500 nós (Q1).
- Validação: o servidor aceita apenas nomes existentes no catálogo da versão instalada do Phosphor; chave inválida é rejeitada, não renderizada como quadrado vazio.
- Tamanhos: 20px na configuração, no tracker e no Hoje; 18px em grade, série e listas densas. Cor `currentColor`, monocromático.
- Com o nome do hábito visível o pictograma é `aria-hidden`. Sem pictograma escolhido a coluna do glifo fica vazia e o layout não muda. Uma chave pode repetir entre hábitos.
- O dialog prende o foco e devolve ao botão de origem.

## 6. Histórico e evolução (F8–F9)

Somente leitura, com **contraste normal** — readonly nunca parece disabled. Ordem: intervalo → detalhe de um dia → evolução de um hábito → completude por hábito e período.

- **Intervalo:** padrão de 30 dias; "Período anterior"/"Próximo período" deslocam o intervalo inteiro; a data do detalhe fica presa ao intervalo.
- **Detalhe do dia:** grupos e linhas em texto; hábito inativo com o tratamento terminal e a data de inativação. "Abrir este dia para edição" leva o dia selecionado para a aba Hoje — a edição **não** acontece dentro do histórico.
- **Dia-lacuna:** "Sem registro neste dia." com a nota de que nenhuma linha foi materializada. **Nunca 0% fabricado.**
- **Evolução:** um hábito por vez, selecionado explicitamente; sem seleção, nada é buscado. Três visões sobre o payload que a série já devolve — valor diário · % da meta · contribuição na completude (Q8). Dia sem registro é linha tracejada no zero. Eventos de configuração como lista datada em texto ("1 de julho de 2026 — Peso 2 → 3"). **Tabela equivalente permanente**, não escondida atrás de botão.
- **Completude por hábito e período:** uma linha por hábito (agrupada como no tracker) × uma coluna por semana ou quinzena. Booleano mostra dias feitos sobre dias do período ("5/7"); numérico mostra a completude média ("71%"). O número dentro da célula é o canal primário; o tom é reforço. Semana parcial rotula os dias reais ("4 dias"). Hábito inativo em agrupamento próprio, com travessão. Tabela equivalente em `details`. **Agregação depende de definição de domínio (Q10).**
- **Compact:** a grade vira lista por dia, com a mesma informação.

## 7. Integração mínima com o Hoje (F10–F12)

Só o bloco de Hábitos é desenhado; o Daily Log e o resto do Hoje aparecem reduzidos, como contexto.

- **Lente Foco nas tarefas:** totalizador navegável — porcentagem, barra redundante, "7 de 11 registros preenchidos · peso efetivo 14,0 · dia útil" e link "Abrir Hábitos para registrar".
- **Lente Dia completo (compact):** lista densa de todos os hábitos — checkbox + pictograma + nome, 48px por linha. Feito e não feito se distinguem por checkbox, nome acessível **e** opacidade — nunca só por opacidade. Sem repetir o cabeçalho de completude.
- **Falhas:** "Nenhum hábito ativo hoje." + link para Configuração; erro do bloco isolado, com retry, sem derrubar o Daily Log.

## 8. Matriz de estados

| Estado | Hoje (tracker) | Configuração | Histórico | Bloco no Hoje |
|---|---|---|---|---|
| Vazio | "Nenhum hábito ativo hoje." + link | sem grupo: criar hábito indisponível · grupo vazio: "Nenhum hábito neste grupo." | "Nenhum registro no período." · dia-lacuna: "Sem registro neste dia." | "Nenhum hábito ativo hoje." + link |
| Loading | skeleton com a geometria real das linhas, sem porcentagem | skeleton de grupos e linhas | skeleton por bloco (detalhe, série, grade) | skeleton do card, altura fixa |
| Saving | otimista na linha + "salvando…"; % só reconcilia depois | botão em "Salvando…", campos do bloco desabilitados | não se aplica (read-only) | igual ao tracker |
| Sucesso | valor e % atualizados são a confirmação — **sem toast** | o bloco fecha e a linha mostra o novo valor | — | igual ao tracker |
| Erro + retry | inline na linha, rollback do otimista, valor digitado preservado | inline sob o campo ou o bloco que falhou | por consulta, com "Tentar novamente" | card em erro, resto do Hoje intacto |
| Offline | faixa + controles desabilitados com motivo | formulários desabilitados com motivo | consulta indisponível; dado já carregado permanece | último dado carregado + faixa |
| Falha parcial | — | config de multiplicador falha sem derrubar a lista | série falha, grade carrega | bloco falha isolado |
| Alta densidade | cards em 2 colunas (wide) / 1 (compact); nomes longos em até 2 linhas | grupos empilhados, multiplicadores em `details` no compact | grade hábitos × períodos: 5 colunas na semana, 2 na quinzena; compact vira lista por dia | totalizador + "Ver todos os N hábitos" |

### 8.1 Textos de estado (verbatim — paridade com o módulo vigente)
- `Nenhum hábito ativo hoje.`
- `Nenhum hábito neste grupo.`
- `Crie um grupo para começar a adicionar hábitos.`
- `Nenhum registro no período.`
- `Sem registro neste dia.`
- `Não foi possível salvar. Tente novamente.`
- `Não foi possível carregar. Tente novamente.`
- `Sem conexão. Registrar e configurar hábitos exige rede.`
- `Alteração válida a partir de hoje. Registros anteriores preservados.`
- `Dia útil` · `Fim de semana` · `Feriado` · `Meta atingida` · `Feito` · `Não feito` · `Inativo`

## 9. Interação e teclado

- **Marcar booleano:** clique no checkbox ou no rótulo (compact) alterna `1` ↔ nulo, otimista, com rollback no erro.
- **Registrar numérico:** commit no `blur` e no `Enter`; vazio grava nulo; não envia valor inalterado.
- **Feriado:** checkbox no cabeçalho; a mudança de tipo de dia reescreve o `multiplierAtTime` das linhas do dia no servidor e a interface refetcha.
- **Override avulso:** ação nomeada, aplicada só ao dia visível.
- **Editar configuração:** um bloco de edição aberto por vez; "Cancelar edição" descarta sem tocar o servidor.
- **Pictograma:** setas percorrem os tiles do `radiogroup`; `Enter`/`Espaço` seleciona; `Escape` fecha devolvendo o foco ao botão de origem; a ação primária nomeia a chave ("Usar pictograma drop").
- **Histórico:** setas de período deslocam o intervalo; a data do detalhe é um `input[type=date]` limitado ao intervalo; nenhuma edição na superfície.
- **Movimento:** apenas transições de cor de fundo, 120–180ms. Sem celebração. `prefers-reduced-motion` zera as durações.
- **Nada é otimista além do valor da linha:** porcentagens, pesos efetivos e multiplicadores só mudam com resposta do servidor.

## 10. Acessibilidade

- **Nenhuma informação só por cor:** estado tem texto ("Feito", "Não feito", "Sem registro neste dia."), a grade tem rótulo por célula, a barra tem porcentagem ao lado, a célula do heatmap tem o número dentro.
- **Alvos:** 44px em wide/tablet, 48px em compact. Foco visível de 2px com offset em todo controle.
- **Grade:** `th scope` em linha e coluna, `caption` descrevendo a leitura, tags textuais FDS/FER.
- **Gráficos:** `role="img"` com descrição factual + tabela equivalente permanente + eventos de configuração em lista datada.
- **Erros:** `role="alert"` e `aria-invalid` no campo; o texto do erro fica ligado ao campo, não só ao topo da página.
- **Pictograma:** sempre `aria-hidden` quando o nome está visível; nunca é o único portador de significado.
- **Ordem de foco** segue a ordem visual em todas as faixas; o dialog de pictograma prende o foco e devolve ao acionador.
- **Readonly x disabled:** o histórico é readonly com contraste normal; disabled mantém rótulo legível e motivo acessível.
- **Contraste do heatmap:** faixas 0/1–24/25–49/50–69% usam `--ink`; 70–89% usa 80% de `primary` com `--on-primary`; 90–100% usa `primary` sólido com `--on-primary`. Nenhuma célula fica abaixo de 4,5:1.

## 11. Critérios de aceite verificáveis (derivados)

1. A interface nunca calcula completude: alterar um valor não muda a porcentagem antes da resposta do servidor.
2. Marcar booleano alterna entre `1` e nulo; nulo é apresentado como "Não feito", nunca como ausência de registro.
3. Campo numérico vazio grava nulo; valor inalterado não dispara requisição.
4. Atingir a meta exibe "Meta atingida" e marca o checkbox indicador, que permanece não interativo.
5. Editar peso, meta, bônus ou ativação exibe o aviso de prospectividade e cria versão com `effective_from = hoje`; segunda edição no mesmo dia atualiza a mesma versão.
6. Editar nome, pictograma, grupo ou unidade **não** cria versão.
7. Sem grupo cadastrado, criar hábito está indisponível com motivo acessível.
8. Não existe ação de exclusão de hábito em nenhuma superfície.
9. Desativar remove o hábito do dia seguinte e o mantém no histórico com o tratamento terminal e o chip "Inativo".
10. Multiplicador vazio remove a configuração e a leitura volta a 1,00; dia útil nunca é armazenado.
11. Feriado + override avulso grava `multiplierAtTime = 1,00` só nas linhas do dia visível.
12. Dia sem registro exibe "Sem registro neste dia." e **nenhuma** porcentagem.
13. O histórico não tem nenhum controle de escrita; "Abrir este dia para edição" navega para a aba Hoje.
14. Todo gráfico tem tabela equivalente visível na mesma superfície.
15. `iconKey` inválido é rejeitado pelo servidor; a interface não renderiza glifo vazio.
16. A 320 CSS px não há scroll horizontal em nenhuma das três superfícies.
17. Nenhum toast de sucesso é emitido em nenhuma mutação.
18. Nenhuma superfície de 2e–2j exibe streak, contagem de dias completos ou qualquer métrica agregada nova.
