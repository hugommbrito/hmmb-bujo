---
title: "BuJo Digital — PRD"
status: final
created: 2026-06-15
updated: 2026-07-23
---

# BuJo Digital — Product Requirements Document

> **Revisão CC 2026-07-22** — Seção 5 (Requisitos Funcionais) reorganizada no modelo real do produto (**núcleo BuJo não-gateável + collections opcionais + plataforma**), conforme roteado pelo `sprint-change-proposal-2026-07-22.md`. FRs entregues tiveram o **texto preservado**; a renumeração e o de-para (FR antigo → FR novo) estão no **Anexo A**. As decisões §2/§3 do proposal são vinculantes.

> **Revisão IR 2026-07-23** — 3 correções cirúrgicas roteadas pelo rito [IR] (`implementation-readiness-report-2026-07-23.md`): novo **FR-0.5** (recuperação de senha — issue crítico, pré-requisito do Épico 10); rename **"cardápio" → "Index"** (decisão Hugo 2026-07-23 — FR-1.4, FR-6.4, FR-15.5 e correlatas); **NFR-8** alinhado à decisão do dono de 2026-07-22 (cláusula crop+EXIF removida do NFR transversal; permanece em FR-12.8). Sem renumeração; escopo inalterado.

---

## 1. Visão e Objetivos

BuJo Digital é um aplicativo web pessoal que digitaliza e automatiza o sistema de Bullet Journal analógico do Hugo, eliminando o trabalho mecânico de setup e preservando a intencionalidade que torna o método eficaz.

O app não compete com Notion ou apps de produtividade genéricos — compete com o caderno. Vence quando o usuário não precisar mais dele.

**Objetivo primário:** eliminar o atrito mecânico do ciclo BuJo (reescrever cabeçalhos, recriar grids, repassar tarefas) sem eliminar o juízo que o método exige nas migrações.

**Objetivo secundário:** consolidar caderno físico e Notion em uma plataforma única, acessível de desktop e mobile, eliminando o retrabalho de transcrição entre sistemas.

**Modelo mental (CC 2026-07-22):** o produto é um **núcleo de logs BuJo** (não-gateável) mais **collections opcionais** que o usuário ativa deliberadamente. Não é feature nova — é dar nome verdadeiro ao que o produto já é. A fidelidade ao método (o caderno nasce com o esqueleto; cada collection é escolha do dono) é o diferencial.

---

## 2. Usuários

**Primário — Hugo:** praticante comprometido do método BuJo, com sistema consolidado e personalizado. Usuário técnico, uso intensivo diário em desktop e mobile.

**Secundário — amigos do Hugo:** usuários que queiram adotar o mesmo sistema quando o app estiver estável. O app é construído para acolher esse círculo sem refatoração estrutural.

O app não é um produto SaaS público — mas é arquitetado para escalar dentro desse círculo sem retrabalho.

---

## 3. Critérios de Sucesso

| Métrica | Aceitável | Ideal |
|---|---|---|
| Tempo de setup diário | ≤ 20 min | ≤ 10 min |
| Retrabalho de transcrição (caderno → Notion) | Eliminado | — |
| Critério de abandono do caderno | Ciclo BuJo completo funcional | — |

**Counter-métrica:** o tempo de setup não deve cair à custa da eliminação do julgamento. 100% das decisões de migração exigem ação explícita do usuário — nenhuma tarefa é movida silenciosamente sem confirmação.

> **Nota (CC 2026-07-22):** o antigo item de backlog "Dashboard de indicadores de saúde do sistema (consistência de uso, percentual de hábitos, outros)" foi **absorvido** pela home dashboard-panorama (FR-6.6), complementada pelo dashboard de período de saúde (FR-8.3) e pelo gráfico de evolução de hábitos (FR-7.10). Não é mais um item de backlog independente.

---

## 4. Jornadas de Usuário

> **Nota (CC 2026-07-22):** as jornadas descrevem os fluxos entregues. Dois pontos mudaram de nome/entorno e recebem nota leve abaixo; a spec da nova home (bmad-ux) e o [CE] reconciliam o detalhe. O fluxo em si permanece válido.

### UJ-1 — O Dia de Hugo

*Protagonista: Hugo. Começa na primeira abertura do app no dia.*

> *Nota (CC 2026-07-22): o ponto de entrada pós-login agora é o **Dashboard-panorama** (FR-6, UX-DR16 revogado parcialmente), não o Daily Log. O card do dia no Dashboard é acionável (rapid logging e migrações pendentes direto do card), preservando a captura a um toque.*

1. Abre o Daily Log de **ontem** → revisa e preenche hábitos não marcados em tempo real
2. Revisa dados de saúde de ontem → preenche campos pendentes
3. Abre o Diário de Gratidão de ontem → preenche entrada pendente → adiciona eventual gratidão do dia de hoje
4. Vai para o Daily Log de **hoje** → marca hábitos e saúde das primeiras horas do dia
5. **Bloco de migrações:**
   - Revisa tarefas não concluídas de ontem → decide por cada uma: migrar para hoje, adiar ou cancelar
   - Puxa do Weekly Log as tarefas previstas para hoje
   - *Se segunda-feira:* revisa recorrentes semanais e decide placement; puxa itens do Monthly Log desta semana para o Weekly Log
   - *Se primeira semana do mês:* revisa recorrentes mensais e decide placement; puxa itens do Future Log do mês corrente para o Monthly Log com suas datas
6. Prioriza tarefas do dia com etiqueta Eisenhower → define ordem de execução manualmente
7. Executa tarefas: marca `/` ao iniciar, `\` ao concluir (formam X)
8. Ao longo do dia: marca atividades e hábitos conforme realizados; registra horários da janela de jejum nas refeições

*Nota: o dia não tem ritual de encerramento formal. O Daily Log não precisa ser "fechado".*

---

### UJ-2 — A Semana de Hugo

*Protagonista: Hugo. Acontece na abertura de cada semana (segunda-feira), como parte do UJ-1.*

1. Acessa o Weekly Log da semana anterior
2. Revisa tarefas sem disposição (não atribuídas a nenhum Daily Log e não concluídas) → decide por cada uma: migrar para o novo Weekly Log, adiar ou cancelar
3. Uma semana é considerada **fechada** quando todas as tarefas têm disposição: concluída, cancelada, adiada ou migrada
4. Semanas fechadas ficam no arquivo — consultáveis com o status final de cada tarefa

---

### UJ-3 — Abertura do Mês

*Protagonista: Hugo na primeira semana de um novo mês, como parte do UJ-1.*

1. O app sinaliza que há itens do mês anterior sem disposição
2. Hugo revisa as tarefas do Monthly Log anterior sem disposição → decide por cada uma: migrar para o mês atual (com data específica), adiar para o Future Log ou cancelar
3. O app puxa automaticamente os itens do Future Log do mês corrente para o Monthly Log, com suas datas — Hugo os revisa e confirma
4. O app apresenta os recorrentes mensais ativos → Hugo decide o placement de cada um no Monthly Log
5. O mês anterior é considerado **fechado** quando todas as suas tarefas têm disposição

---

### UJ-4 — Captura Rápida no Mobile

*Protagonista: Hugo fora de casa, sem desktop disponível.*

1. Abre o app no celular
2. **Opção A:** captura um item no brain dump — título obrigatório, descrição e log de destino opcionais
3. **Opção B:** marca um hábito ou métrica de saúde
4. Não faz planejamento, detalhamento de tarefas ou migrações

---

### UJ-5 — Future Log

*Protagonista: Hugo planejando algo com antecedência.*

1. Acessa o Future Log diretamente
2. Adiciona novo item com mês + dia (data completa) ou só mês (dia definido futuramente na migração mensal)
3. Consulta itens existentes por período

---

### UJ-6 — Diário de Gratidão

*Protagonista: Hugo, tipicamente de manhã ao revisar o dia anterior.*

> *Nota (CC 2026-07-22): a Gratidão passa a ser um **campo seed do Journalling** (FR-10.7) — a superfície dedicada é aposentada quando o Journalling entra, e as entradas migram. O fluxo abaixo continua válido como o comportamento do campo "Gratidões".*

1. Acessa o Diário de Gratidão
2. Adiciona entrada de texto livre — sem estrutura obrigatória, múltiplas entradas por dia permitidas
3. Navega o histórico por data ou por mês para releitura

---

### UJ-7 — Saúde e Medicamentos

*Protagonista: Hugo, majoritariamente de manhã revisando o dia anterior.*

1. Abre o módulo de Saúde
2. Preenche as métricas do dia anterior — [ASSUMPTION: exemplos dos campos atuais de Hugo: peso, pressão, horas de sono, qualidade de sono, produtividade manhã/tarde/noite, atividade física, evacuação, viagem, etc. O conjunto exato é dinâmico e definido pelo usuário (FR-8.1)]
3. Confirma medicamentos por bloco de horário — clica em "tomar remédios da manhã" para confirmar todos do bloco de uma vez, ou confirma individualmente
4. Para consultar evolução: acessa tabela dia a dia, gráficos de evolução por campo ou dashboard de resumo do período

---

### UJ-8 — Configuração de Hábitos

*Protagonista: Hugo criando ou ajustando o sistema de hábitos.*

1. Cria novo hábito: define nome, emoticon, grupo, peso inicial, tipo (booleano ou numérico)
   - Para numérico: define também meta e bonus de completude (%)
2. Ajusta o peso de um hábito existente → alteração vale a partir do dia corrente
3. Desativa um hábito que não é mais relevante → some do log ativo, permanece no histórico
4. Reativa hábito desativado quando necessário

---

## 5. Requisitos Funcionais

> **Organização (CC 2026-07-22):** os FRs seguem o modelo **núcleo + collections + plataforma**. Grupo A = fundação e plataforma transversal; Grupo B = núcleo BuJo não-gateável; Grupo C = collections coded; Grupo D = collections custom; Grupo E = gestão de usuários. FRs marcados *(novo)* nasceram deste rito a partir das anatomias do brainstorming 2026-07-21 e do TR 2026-07-22. FRs entregues têm texto preservado — ver **Anexo A** para o de-para de numeração.

## Grupo A — Fundação e Plataforma

### FR-0 — Fundação

**FR-0.1** — Os dados de cada usuário são completamente isolados. Nenhum dado de um usuário é acessível por outro usuário, em nenhuma circunstância.

**FR-0.2** — Autenticação via email/senha com sessão persistente.

**FR-0.3** — Dois ambientes isolados: dev e prod. Dados não se cruzam entre ambientes.

**FR-0.4** — O sistema suporta múltiplos usuários desde o início. A UI de convite e gestão de usuários é entregue em fase posterior (FR-15).

**FR-0.5** — *(novo — IR 2026-07-23)* **Recuperação de senha:** o usuário redefine a própria senha por email — solicita a redefinição ("esqueci minha senha"), recebe um link com token de validade limitada e define uma nova senha. Capacidade de autenticação complementar ao FR-0.2. Entrega obrigatória **antes do Épico 10** (FR-15) — convidado trancado para fora é falha de onboarding. *(Issue crítico do [IR] 2026-07-23; pendência auto-sinalizada no preâmbulo do Épico 10 do `epics.md`.)*

---

### FR-1 — Infraestrutura de Collections *(novo)*

*Dá forma ao modelo "núcleo + collections". Base das ondas de migração e do Épico 10 ampliado. Fatia 1 (manifest) é Tier 0, sem UI visível.*

**FR-1.1** — O núcleo BuJo (logs Daily/Weekly/Monthly/Future, motor de migrações, recorrentes, arquivo e Brain Dump) é **não-gateável por construção**: existe sempre, não participa do jogo de ativação. Todo o resto é uma **collection** opcional.

**FR-1.2** — **Taxonomia de collections (4 archetypes):** (1) **coded fixa** (ex.: Medicamentos); (2) **coded com campos definidos pelo usuário** (ex.: Saúde-Métricas, Journalling); (3) **coded de integração** (fonte externa + espelho local; ex.: Alimentação); (4) **custom** (schema no banco, criada pelo usuário). As collections coded vivem no manifest (registro em código); as custom vivem como **conteúdo do container coded "Custom Collections"** (FR-14).

**FR-1.3** — **Manifest/registro de collections:** um registro central declara cada collection coded — identidade, nome, ícone, rotas e entrada de navegação (label, grupo, ordem) — e reserva espaço para o card de dashboard e as configurações da collection (sem consumidores na fatia 1). A navegação (sidebar, bottom-nav, roteamento) é derivada desse registro. **Aceite da fatia 1:** a extração não altera nada visível — o app é idêntico antes e depois; adicionar uma collection nova passa a ser uma operação de baixo atrito (atende o job do Hugo de publicar collections sem atrito — o "cardápio sem atrito" do brainstorming, hoje **Index**, FR-1.4). *(Estrutura do registro e DoD → addendum.)*

**FR-1.4** — **Index (ativação/desativação de collections, #14 peça 2):** superfície onde o usuário liga/desliga cada collection. **Desativar preserva os dados** (filosofia da casa); reativar restaura a superfície. O núcleo (FR-1.1) fica fora do Index. O Index é um ambiente de escolha de collections, não uma loja/marketplace — o job de publicar collections novas é do próprio Hugo e é atendido pelo manifest (baixo atrito), não por infraestrutura de marketplace. *(Renomeado de "cardápio" — decisão Hugo 2026-07-23: Index é a estrutura canônica do método Bullet Journal que lista as collections do caderno; o nome dissolve por vocabulário o risco de leitura como loja/marketplace. O rótulo pt-BR final — Index × Índice — é decidido na story x.0 10.3.)*

**FR-1.5** — **Default all-off para convidados (#14 peça 3):** usuário novo (convidado, FR-15) nasce com **todas as collections desligadas** — ambienta-se no núcleo primeiro e ativa collections por escolha deliberada.

**FR-1.6** — A **granularidade da flag de ativação** (por espaço × por usuário) é decidida no desenho do Épico 10 (FR-15); o manifest é agnóstico a ela. *(Nota — não é requisito fechado aqui.)*

---

### FR-2 — Configuração de IA (BYO key) *(novo)*

*Credencial e capability transversais que gateiam toda funcionalidade de IA (Análises, Pressão Arterial foto+IA, contexto de journalling). Nasce com a primeira feature de IA (Análises fase a).*

**FR-2.1** — A chave de API de IA é **fornecida pelo usuário** (BYO key), em **configuração global**, **criptografada em repouso**. É a única credencial de IA global; credenciais de integração de collection (ex.: foodLog) permanecem no `settingsSchema` da collection respectiva.

**FR-2.2** — O sistema deriva a capability `ai_available` (= chave configurada) como **estado transversal** que habilita todos os fluxos de IA.

**FR-2.3** — **Tag "função de IA"** (ícone + texto, nunca só cor — UX-DR20): elementos que dependem de IA e não têm chave configurada ficam **inativos (não ocultos)**, explicam o porquê e **linkam para a configuração**. Dá ao usuário descoberta do que a IA destravaria.

**FR-2.4** — Dados sensíveis (saúde) **nunca** são enviados a provedores de IA que usam o conteúdo para treino (ex.: Gemini free tier **proibido** para dados de saúde). *(Ver NFR-8.)*

---

### FR-3 — Plataforma de Automação e Captura (C5) *(novo)*

*Pré-requisitos de backend enxutos (Tier 0, sem UI própria) que servem os atalhos iOS, o widget "resumo do dia" e a futura ponte Apple Health do #20. Atalhos e widget ficam do lado do usuário, fora do produto.*

**FR-3.1** — **Credencial de automação:** o sistema oferece uma credencial dedicada, **distinta da sessão de login** — de longa duração, restrita às capacidades de captura e resumo, e revogável a qualquer momento. Permite que ferramentas externas do usuário (atalhos iOS, widget) autentiquem sem expor senha. *(Mecanismo → addendum.)*

**FR-3.2** — **Captura rápida por automação:** uma ferramenta externa registra um item de captura com conteúdo mínimo (tipo + texto + valor opcional) e recebe confirmação imediata. A captura é preparada para aceitar dados importados de fontes externas (ex.: ponte Apple Health futura do #20) sem retrabalho de modelo.

**FR-3.3** — **Resumo do dia por automação:** uma ferramenta externa obtém, em uma única requisição, um resumo agregado do dia (tarefas pendentes, hábitos do dia, última entrada de journalling) para alimentar um widget de "resumo do dia".

**FR-3.4** — As capacidades de automação nascem com **limite de taxa e registro de auditoria** (preparação para o multiusuário do Épico 10).

**FR-3.5** — A PWA **não** é canal de captura rápida (limitação de plataforma iOS: sem Web Share Target; deep links abrem no Safari). Polir a PWA (manifest, badge, Declarative Web Push) é oportunista. *(Detalhe técnico → addendum.)*

---

## Grupo B — Núcleo BuJo (não-gateável)

### FR-4 — Motor BuJo

#### Logs e Estrutura

**FR-4.1** — O sistema mantém quatro tipos de log:
- **Daily Log:** um por dia calendário
- **Weekly Log:** um por semana, organizado por dia da semana (segunda a domingo)
- **Monthly Log:** um por mês, com tarefas atribuídas a datas específicas
- **Future Log:** itens com data futura completa (mês + dia) ou parcial (só mês)

**FR-4.2** — O Future Log aceita itens com data parcial (só mês). O dia é definido quando aquele mês for aberto na migração mensal.

#### Tarefas

**FR-4.3** — Uma tarefa tem os seguintes campos:
- Título (obrigatório)
- Descrição (opcional)
- Subtarefas (opcional)
- Etiqueta Eisenhower: Vermelho (Urgente + Importante), Laranja (Urgente), Amarelo (Importante), Verde (nenhum) — opcional
- Categoria: agrupamento visual por cor (teal, purple, pink, yellow, green, blue), exibido como borda lateral na Task Row — independente do Eisenhower, opcional

**FR-4.4** — Estados de uma tarefa: pendente, iniciada (`/`), concluída (`X`), cancelada, migrada, adiada.

**FR-4.5** — Ao iniciar uma tarefa o usuário marca `/`; ao concluir marca `\`, formando visualmente um X.

**FR-4.6** — A ordenação das tarefas dentro de um log é manual.

#### Motor de Migrações

**FR-4.7** — Na abertura do dia, o app apresenta as tarefas pendentes do dia anterior uma a uma. Para cada tarefa, o usuário decide:
- **Migrar** → vai para o Daily Log de hoje
- **Adiar dentro do mês** → atribuída a uma data específica no Monthly Log
- **Adiar fora do mês** → vai para o Future Log com mês + dia ou só mês
- **Cancelar** → encerrada sem destino

**FR-4.8** — Na abertura da semana (segunda-feira), o app apresenta as tarefas do Weekly Log anterior sem disposição. Para cada tarefa, o usuário decide: migrar para o novo Weekly Log, adiar ou cancelar.

**FR-4.9** — Na abertura do mês (primeira semana do mês), o app:
1. Apresenta tarefas do Monthly Log anterior sem disposição → usuário decide por cada uma
2. Puxa automaticamente os itens do Future Log do mês corrente para o Monthly Log, com suas datas

**FR-4.10** — Uma semana é considerada **fechada** quando todas as suas tarefas têm disposição (concluída, cancelada, adiada ou migrada).

#### Recorrentes

**FR-4.11** — Tarefas recorrentes são templates com os seguintes campos: título, grupo de recorrência (Semanal / Mensal / Anual), recorrência (texto livre — ex: "segunda e quarta", "dia 15"), ativo (booleano) e demais campos de tarefa.

**FR-4.12** — Na abertura de cada ciclo, o app apresenta a lista de recorrentes ativos do período. O usuário decide o placement de cada um (em qual dia/log cada recorrente entra). Não há auto-placement.

#### Arquivo

**FR-4.13** — Semanas e meses fechados ficam consultáveis no arquivo. O histórico exibe o estado final de cada tarefa e o que foi feito com ela.

#### Refinos pós-MVP (CC 2026-07-22)

**FR-4.14** — **[Refino — #24] Nome às categorias:** o usuário atribui um **rótulo (nome)** a cada uma das 6 cores fixas de categoria; o rótulo aparece em selects e tooltips. As 6 cores permanecem fixas — é um mapeamento usuário→label, não a criação de novas cores.

**FR-4.15** — **[Refino — #15] Flag "Aguardando Terceiro":** uma tarefa pode ser marcada com a flag `waiting_on` (aguardando um terceiro), com **indicador visual** e **filtro**. A flag é uma anotação sobre a tarefa — **não** é um estado da máquina de estados (que permanece com os 6 estados de FR-4.4, congelados). É **proibido** criar um 7º estado. *(Backend — campo + service + API — é Tier 0; o indicador visual e o filtro nascem na onda da home/Daily.)*

**FR-4.16** — **[Refino — #23] Herança de status na migração:** o sucessor de uma tarefa migrada **herda o status `started`** da origem (em vez de resetar para `pending`); apenas tarefas `pending`/`started` são migráveis; `migrated`/`postponed` são terminais. É regra de service, **sem tocar o schema** do agregado Task.

---

### FR-5 — Brain Dump

**FR-5.1** — O brain dump é uma caixa de entrada independente, sem data e sem log de destino obrigatório. Seu estado normal é vazio.

**FR-5.2** — Cada item tem título (obrigatório) e, opcionalmente, descrição e log de destino.

**FR-5.3** — Itens do brain dump são processados manualmente pelo usuário: movidos para o log correto ou descartados. Não há migração automática.

**FR-5.4** — Quando o brain dump contém itens pendentes, um indicador visual persistente é exibido na interface até que o brain dump esteja vazio.

---

### FR-6 — Home: Dashboard, Hoje e Captura *(novo)*

*Superfície que amarra o modelo núcleo+collections. Capacidades aqui; o layout/spec visual é da x.0 de UX da Onda 2b (bmad-ux), que também valida em detalhe o desenho do empty-state.*

**FR-6.1** — O ponto de entrada pós-login é o **Dashboard-panorama (home)**. Revoga a cláusula "pós-login abre no Daily Log de hoje" do UX-DR16 (revogação parcial já registrada no `epics.md`).

**FR-6.2** — **Dashboard = ver:** apresenta o panorama do dia + cards das collections ativas. O **card do dia é acionável** — rapid logging direto do card e migrações pendentes visíveis — preservando a **captura a um toque** (exigência do UX-DR16).

**FR-6.3** — **Hoje = trabalhar:** superfície dos itens de trabalho do dia (eventos, migrações pendentes, rapid logging). Hoje e Dashboard apresentam a **mesma visão das tasks do dia** (mesma capacidade de visualização e manipulação); diferem apenas pelo **entorno** (Hoje = trabalho; Dashboard = panorama + cards). *(Implementação por componente único compartilhado — decisão de arquitetura.)*

**FR-6.4** — **Empty-state do dashboard = Index/oferta:** sem collections ativas, a home mostra o núcleo (o dia) + convite para ativar collections, cada convite ligando ao toggle (FR-1.4). Uma superfície, dois jobs: panorama para quem tem collections ligadas, vitrine para quem não tem nenhuma. Resolve o "primeiro login numa home vazia" do convidado do Épico 10.

**FR-6.5** — Cada collection ativa contribui com um **card no dashboard** (via `dashboardCard` reservado no manifest); o conteúdo e o layout de cada card são detalhados na spec da home (bmad-ux).

**FR-6.6** — A home-panorama apresenta **indicadores de uso do sistema**, complementando o dashboard de período de saúde (FR-8.3) e o gráfico de evolução de hábitos (FR-7.10). [ASSUMPTION] exemplos de indicadores: consistência de uso e percentual de hábitos agregado; **o conjunto exato e as fórmulas são definidos na spec da home (bmad-ux)**. *(Absorve o antigo item de backlog "dashboard de indicadores do sistema".)*

---

## Grupo C — Collections coded

### FR-7 — Hábitos

**FR-7.1** — Hábitos são organizados em grupos criados pelo usuário (ex: Profissional, Pessoal, Saúde).

**FR-7.2** — Campos de criação de um hábito: nome, emoticon, grupo, peso inicial, tipo (booleano ou numérico).

**FR-7.3** — Hábitos numéricos têm adicionalmente: meta (valor alvo) e bonus de completude (%).

**FR-7.4** — Cálculo do percentual de completude diário, ponderado pelos pesos:
- **Hábito booleano:** contribui 100% do seu peso quando marcado como feito
- **Hábito numérico:** contribui proporcionalmente de 0% a (100% − bonus%) conforme o valor registrado em relação à meta; ao atingir ou superar a meta, contribui 100% do peso
- *Exemplo: meta 5.000 passos, bonus 30% → ao registrar 2.500 passos (50% da meta), contribui com 35% do peso (50% × 70%). Ao atingir 5.000, salta para 100%.*

**FR-7.5** — Pesos podem ser alterados a qualquer momento. A alteração vale a partir do dia corrente; dias anteriores preservam os pesos que tinham naquele dia.

**FR-7.6** — O log diário de hábitos é um snapshot imutável: registra os hábitos ativos naquele dia e seus pesos vigentes naquele dia. Registros passados não são alterados por mudanças futuras de configuração.

**FR-7.7** — Hábitos são desativados, nunca deletados. Hábitos inativos não aparecem no log ativo mas permanecem no histórico com seus registros intactos.

**FR-7.8** — Hábitos desativados podem ser reativados. Ao reativar, voltam a aparecer no log a partir do dia da reativação.

**FR-7.9** — O histórico de hábitos é consultável por data.

**FR-7.10** — O histórico de hábitos também é consultável como **gráfico de evolução por hábito** ao longo do tempo. Mudanças reais de configuração (peso, meta, bonus, ativação/desativação) são anotadas no gráfico como eventos datados; variações periódicas por tipo de dia (multiplicador de fim de semana/feriado) **não** são tratadas como mudança de configuração. (Ver arquitetura AD-10 e AD-11.)

---

### FR-8 — Saúde-Métricas

*Collection coded com campos definidos pelo usuário. Exibida em grupo visual "Saúde" ao lado de Medicamentos (FR-9) — duas collections, agrupamento é apresentação.*

**FR-8.1** — Métricas de saúde são campos dinâmicos criados pelo usuário. Cada campo tem: nome, tipo de dado (inteiro, decimal, booleano, enum, texto) e ativo (booleano).

**FR-8.2** — O log diário de saúde é preenchido pelo usuário (majoritariamente de manhã, revisando o dia anterior). Campos inativos não aparecem no log ativo mas são preservados no histórico.

**FR-8.3** — O histórico de saúde é consultável em três visualizações:
- **Tabela dia a dia:** valores de cada campo por data
- **Gráficos de evolução:** por campo, ao longo do tempo
- **Dashboard de período:** resumo de métricas de um intervalo selecionado

> *Nota (CC 2026-07-22): os refinos de Saúde-Métricas (reordenar, editar, percentual/enum multi, grupos — #16/#17/#18/#22) estão **fora do escopo deste PRD** por decisão do rito; entram como refinos de story no [CE], preservando o princípio "editar seguro × destrutivo" (renomear/adicionar = livre; mudar tipo/remover = só desativação).*

---

### FR-9 — Medicamentos

*Collection coded fixa. Entidade separada das métricas de saúde; exibida no grupo visual "Saúde".*

**FR-9.1** — Medicamentos são uma entidade separada das métricas de saúde. Cada medicamento tem: nome, dose e blocos de horário (manhã / tarde / noite).

**FR-9.2** — Um mesmo medicamento pode aparecer em múltiplos blocos com doses diferentes.

**FR-9.3** — Na confirmação diária, o usuário pode confirmar todos os medicamentos de um bloco de uma vez ("tomar remédios da manhã") ou confirmar individualmente cada medicamento.

**FR-9.4** — Medicamentos têm estado ativo/inativo. O histórico de confirmações é preservado após desativação.

> *Nota (CC 2026-07-22): o campo "médico prescritor" (referenciado como filtro-exemplo em Análises) **não** é requisito deste PRD; se necessário, é refino do módulo Medicamentos verificado na onda de Saúde ([CE]/§10 do proposal).*

---

### FR-10 — Journalling *(novo)*

*Collection coded com campos de relato definidos pelo usuário. Absorve o Diário de Gratidão entregue (Épico 9). Segunda instância do padrão "coded com campos user-defined" (a primeira é Saúde-Métricas).*

**FR-10.1** — Journalling é uma collection onde o usuário define **campos de relato**. Cada campo tem: `{nome, prompt opcional (placeholder do editor), cadência (diário | semanal | livre), múltiplas entradas (bool), contexto_ia (bool), gravar horário (bool), ativo (bool)}`.

**FR-10.2** — **Ciclo de vida dos campos (editar seguro × destrutivo — filosofia Épico 7):** renomear e adicionar campo/opção = **livre**; mudar tipo/remover = **só desativação** (histórico preservado). Desativar, nunca deletar.

**FR-10.3** — `contexto_ia` **nasce OFF** em todo campo (opt-in explícito). Um campo só vira contexto de Análises (FR-13) quando `contexto_ia = on` — consentimento por campo, coerente com o guardrail UX-DR19.

**FR-10.4** — **Múltiplas entradas por campo (configurável):** campos como "Gratidões" aceitam várias entradas por dia; campos como "Resumo do dia" são entrada única editável.

**FR-10.5** — **Cadência configurável por campo (diário / semanal / livre) já no MVP** (decisão contra-recomendação preservada — §2.10 do proposal). Cada cadência tem **histórico navegável apropriado**: diário por data/mês; campos semanais e livres com visualização própria. *(As âncoras temporais no modelo de dados → addendum.)*

**FR-10.6** — **Visibilidade no Hoje:** a collection aparece como **card único** agregando os campos ativos (não um toggle por campo).

**FR-10.7** — **Absorção da Gratidão (Épico 9 entregue):** o Journalling nasce com um campo seed **"Gratidões"** = `{cadência diário, múltiplas entradas, contexto_ia off}`; as entradas existentes do Diário de Gratidão são **migradas** para esse campo; a **superfície antiga da Gratidão é aposentada na mesma onda** (sem período de duas verdades). *(Absorve as antigas FR-4.1/FR-4.2 do Diário de Gratidão — ver Anexo A.)*

---

### FR-11 — Alimentação (#5a) *(novo)*

*Collection coded de archetype integração — define o padrão herdável por futuras integrações externas.*

**FR-11.1** — A Alimentação consome o **foodLog** (API externa do usuário) em **somente leitura**, via **espelho local sincronizado**.

**FR-11.2** — Superfície: **resumo diário** (refeições + horários + fotos) e **janela de jejum**.

**FR-11.3** — As credenciais/URL da API do foodLog vivem no `settingsSchema` da collection (configuração sensível da collection, não global).

**FR-11.4** — **Resiliência:** o foodLog indisponível **nunca quebra o bujo** — a superfície degrada com indicador de "última sincronização"; as fotos podem degradar. *(Ver NFR-9.)*

**FR-11.5** — As métricas de alimentação são **fontes de primeira classe** nos Modelos de Relatório de Análises (FR-13). **Fotos são exibição, nunca contexto de IA** (fronteira de privacidade).

**FR-11.6** — Espelho completo navegável/editável e absorção do foodLog como desenvolvimento interno (#5b) ficam **fora do MVP** (icebox). *(Nota.)*

---

### FR-12 — Pressão Arterial (#20) *(novo)*

*Collection coded com dados próprios + captura foto+IA sob confirmação humana. Depende de `ai_available` (FR-2). Grounding técnico: TR 2026-07-22.*

**FR-12.1** — Collection para automedição de pressão arterial: suporta **N medições por dia**, cada uma com o **par sistólica/diastólica atômico** + pulso opcional, e contexto opcional (braço, posição, momento). Leitura avulsa ou agrupada em **sessão** (protocolo clínico 7-2-2). *(Schema — par atômico, sessões, `source` enum — → addendum.)*

**FR-12.2** — **Captura por foto + IA:** o usuário fotografa o display do monitor e a IA **transcreve** os valores. É modo de **captura**, não de sugestão — coerente com a fronteira UX-DR19 (transcrição sob confirmação ≠ sugestão de IA).

**FR-12.3** — **Human-in-the-loop obrigatório:** foto (com guia de enquadramento/crop) → IA (saída estruturada estrita com **instrução de recusa**: `null` em vez de adivinhar) → **formulário pré-preenchido** com **badge de confiança por campo** → **confirmação explícita** → salvar. **Nunca salvar direto.**

**FR-12.4** — **Fallback manual sempre visível** (o mesmo formulário sem foto); imagem ilegível ou timeout cai no manual.

**FR-12.5** — **Evidência auditável:** a foto original e o JSON bruto da IA são guardados; há **validação de plausibilidade** e **alerta de outlier** vs. a média de 7 dias (server-side).

**FR-12.6** — O dashboard clínico usa a **média móvel de 7 dias** (a métrica clínica), não a leitura isolada.

**FR-12.7** — Fonte de dados registra `source` (photo_ai / manual / import) **desde o início**; o caminho Apple Health/Bluetooth (`import`) é **preparado no schema, não implementado agora**. *(Nota.)*

**FR-12.8** — **Privacidade:** crop do display (sem ambiente/rosto) + strip de EXIF antes do envio; Gemini free tier **proibido** (dado de saúde — FR-2.4/NFR-8); no contexto multiusuário (Épico 10), **consentimento explícito** para "leitura por IA em nuvem" e **fluxo 100% manual como padrão** para terceiros.

---

### FR-13 — Análises *(novo)*

*Collection coded de archetype dependente (lê outras collections). Depende de `ai_available` (FR-2). Consolida o antigo FR-4.3 e absorve "relatórios médicos" e "resumo mensal por IA". Fases a → b → c. Grounding: Mergulho 3 do brainstorming + TR 2026-07-22.*

**FR-13.1** — **Guardrail (UX-DR19):** a IA **analisa e explica**; **nunca** sugere, preenche ou automatiza captura/migração; **nunca gera nem executa queries**; **nunca produz números**. Toda geração é por **ação explícita** do usuário.

**FR-13.2** — **Entidade central — Modelo de Relatório:** modelo reutilizável composto pelo usuário = `{nome, métricas selecionadas (cross-collection), filtros (range de datas + condições simples de igualdade/existência), anotações por métrica (global com override local), conceitos, prompt de expectativa, exemplar adotado?, histórico de gerações}`.

**FR-13.3** — **Fase a — dicionário semântico:** anotações por métrica (globais, com **override local** por modelo) e **conceitos** ([ASSUMPTION]: definições semânticas do usuário, ex.: "bem-estar" como leitura combinada — a confirmar na onda) que a IA recebe como contexto.

**FR-13.4** — **Fase b — geração sob demanda:** a IA redige a análise a partir de uma **spec validada** — **texto + gráficos** que **referenciam séries pré-computadas pelo backend**, renderizadas no front. A IA escolhe tipo de gráfico, título e destaques; os **números vêm do backend, nunca da IA**. *(DSL, compilação e mecanismo de referência de séries → addendum.)*

**FR-13.5** — **Ancoragem por exemplar:** quando um resultado é satisfatório, o usuário o **"adota"** como padrão do modelo; o exemplar adotado vai como contexto nas gerações futuras do mesmo modelo (consistência de formato sem engenharia pesada).

**FR-13.6** — Relatórios são **salvos com histórico** (data, período, modelo). Cada geração é um **snapshot imutável**.

**FR-13.7** — **Fronteira de privacidade:** saem para a IA **somente** as métricas selecionadas no modelo + os campos de journalling com `contexto_ia: on`. Nada além (fotos nunca — FR-11.5).

**FR-13.8** — **Consentimento e transparência:** a **seleção de uma métrica** num Modelo de Relatório é o consentimento; a métrica/campo ganha um **badge "dado lido por IA"** (ícone + texto — UX-DR20) no **formulário de origem** da collection. Há um índice reverso métrica→modelos, com **degradação graciosa** (Análises desligada/erro = sem badge; formulário intacto). O badge "dado lido por IA" é **distinto** da tag "função de IA" (FR-2.3) e não compartilha o mesmo visual.

**FR-13.9** — Collection-fonte desligada = **fora de novos relatórios** (métricas ocultas do modelo, não deletadas; relatórios antigos permanecem intactos).

**FR-13.10** — **Fase c — geração agendada:** execução periódica dos Modelos de Relatório, **só depois** das fases a/b. *(Agendamento, controle de custo por cap mensal e skip por hash → addendum.)*

**FR-13.11** — **Relatórios médicos** (saúde / medicamentos / pressão arterial por período) são um **Modelo de Relatório especializado**, com exemplar de formato adotado. A **exportação estruturada** (PDF/arquivo) fica para **fase 2** (como o C6, sem export no MVP). *(Absorve o item de backlog "módulo de relatórios médicos" — decisão Hugo 2026-07-22.)*

**FR-13.12** — O antigo **"resumo mensal por IA"** (Gratidão) é apenas **um Modelo de Relatório possível**, não uma feature fixa.

---

## Grupo D — Collections custom

### FR-14 — Custom Collections (C6) *(novo)*

*Framework de coleções criadas pelo usuário, implementado como uma collection coded container. Caso motor: logs do Canadá (#1).*

**FR-14.1** — **Custom Collections é uma collection coded container:** entrada estática única no manifest, ativável/desativável como qualquer outra. Uma vez ativada, permite que o usuário crie suas próprias custom collections, que são **conteúdo do container** (vivem no banco). *(As filhas na sidebar são dinâmicas — nota técnica no addendum.)*

**FR-14.2** — Uma **custom collection** é uma **lista de registros com schema definido pelo usuário**: campos tipados, incluindo **campo-array de sub-registros** com **no máximo 1 nível de aninhamento** (sub-registro não aninha). *(Persistência/JSONB → addendum.)*

**FR-14.3** — Sistema de tipos **próprio, independente do Épico 7** (Saúde-Métricas) — decisão contra-recomendação preservada (§2.10).

**FR-14.4** — Navegação: **sidebar, grupo "Custom Collections"**; cada custom collection ativa é entrada da sidebar (paridade com as coded).

**FR-14.5** — **Edição de schema com registros existentes:** segura livre (renomear/adicionar campo e opção de enum); destrutiva bloqueada (mudar tipo/remover campo = só **desativação**; histórico preservado).

**FR-14.6** — Nasce **vazia com exemplos ilustrativos** no empty-state; **sem templates/presets** seed.

**FR-14.7** — **Sem export no MVP** — decisão contra-recomendação preservada (§2.10). Export vira fase 2 se a dor aparecer.

**FR-14.8** — Cidadania no ecossistema (card no dashboard, participação em `contexto_ia`/Análises, listagem no Index) é decidida **por feature/story**; default conservador (**off**). *(Nota.)*

**FR-14.9** — **Caso motor:** logs do Canadá (#1) — Viagens (datas, destinos), Moradias (endereços, períodos), Empregos (empregador, cargo, período): listas estruturadas com colunas tipadas.

---

## Grupo E — Gestão de Usuários

### FR-15 — Gestão de Usuários *(Épico 10 ampliado)*

**FR-15.1** — O sistema suporta convite de novos usuários por email.

**FR-15.2** — Cada usuário tem seu próprio espaço de dados completamente isolado.

**FR-15.3** — [ASSUMPTION] Não há espaço compartilhado entre usuários no MVP — cada um tem sua própria instância do sistema.

**FR-15.4** — **[BACKLOG]** Competição entre amigos com base no percentual de completude de hábitos — ranking ou comparativo entre usuários do mesmo círculo.

**FR-15.5** — **[Escopo ampliado — CC 2026-07-22]** O Épico 10 entrega, além de convites e onboarding: observabilidade mínima (antes de convidar externos); e as **peças 2–4 do #14** — o Index (FR-1.4), o default all-off para convidados (FR-1.5) e o empty-state do dashboard como superfície de oferta (FR-6.4).

**FR-15.6** — **[LGPD]** Para dados sensíveis de terceiros, o Épico 10 exige **consentimento explícito** para "leitura por IA em nuvem" e adota **fluxo 100% manual como padrão** (cross-ref FR-12.8, FR-2.4). A **granularidade da flag de ativação** (espaço × usuário) é decidida no desenho deste épico (FR-1.6).

---

## 6. Requisitos Não-Funcionais

**NFR-1 — Mobile real:** 100% das ações do fluxo diário (brain dump, marcação de hábito, saúde) são executáveis em mobile sem scroll horizontal. A experiência não é só responsividade cosmética — é um ponto de acesso funcional.

**NFR-2 — Performance:** carregamento do Daily Log e do fluxo de migrações deve ser percebido como instantâneo no uso cotidiano. [ASSUMPTION: < 2s em conexão normal]

**NFR-3 — Isolamento de dados:** nenhum dado de um usuário é acessível por outro em nenhuma circunstância.

**NFR-4 — Integridade do histórico:** logs passados são imutáveis. Nenhuma operação futura altera registros históricos (hábitos, saúde, tarefas concluídas).

**NFR-5 — Ambientes separados:** dev e prod com dados completamente isolados.

**NFR-6 — Disponibilidade:** uptime de 99% no horário de uso ativo (6h–23h). Downtime tolerável apenas em janelas de madrugada.

**NFR-7 — Segurança de IA:** *(novo)* nenhuma query é gerada ou executada por IA — a IA compõe apenas specs validadas server-side contra catálogo/allowlist. Defesa em profundidade no caminho de leitura de relatórios (role read-only + `statement_timeout`). *(Detalhe → addendum.)*

**NFR-8 — Privacidade de dados sensíveis:** *(novo)* a chave de IA é criptografada em repouso; dados de saúde nunca são enviados a provedores que treinam com o conteúdo (Gemini free tier proibido). *(Decisão do dono 2026-07-22, registrada no `epics.md` e alinhada aqui pelo [IR] 2026-07-23: a cláusula "crop do display + strip de EXIF antes do envio" foi removida do NFR transversal; o pipeline de foto permanece como requisito de feature em FR-12.8/AD-27.)*

**NFR-9 — Resiliência de integrações externas:** *(novo)* a indisponibilidade de uma fonte externa (ex.: foodLog) nunca quebra o núcleo do bujo; a superfície degrada graciosamente com indicador de última sincronização.

---

## 7. Sequência de Build

### 7.1 — MVP (entregue)

| Fase | Módulo | Critério de saída |
|---|---|---|
| 0 | Fundação: schema multi-tenant + auth básica | Hugo consegue logar e os dados estão isolados por usuário desde o primeiro registro |
| 1 | Motor BuJo completo | Daily, Weekly, Monthly, Future Log + motor de migrações funcionando → critério de abandono do caderno |
| 1b | Brain Dump | Caixa de entrada com indicador visual; captura rápida mobile (válvula de escape, UJ-4) |
| 2 | Sistema de Hábitos | Hábitos com pesos e percentual de completude |
| 3 | Saúde e Medicamentos | Métricas dinâmicas + confirmação de medicamentos por bloco |
| 4 | Diário de Gratidão | Entradas livres + histórico navegável |
| 5 | Gestão de Usuários | Convites + onboarding de amigos |

### 7.2 — Roadmap pós-MVP (CC 2026-07-22)

A ordenação de entrega dos FRs novos **por onda** é governada pela **ordem-mestre do roadmap** no `sprint-change-proposal-2026-07-22.md` (§4) — a autoridade única de sequenciamento. Este PRD descreve as **capacidades** (por feature); a **sequência** (por onda) vive no proposal e é decomposta no rito [CE]. Diretriz de entrada: todo épico novo com superfície de UI nasce com uma **story x.0 de UX** (bmad-ux) como gate.

---

## 8. Escopo e Backlog

### Dentro do escopo (MVP — entregue)
- Ciclo BuJo completo com motor de migrações e recorrentes
- Sistema de hábitos com pesos, bonus de completude e snapshot histórico
- Tracking de saúde com campos dinâmicos e visualizações
- Confirmação de medicamentos por bloco de horário
- Diário de Gratidão com histórico navegável *(a ser absorvido pelo Journalling — FR-10)*
- Brain dump com indicador visual
- Acesso mobile responsivo e funcional
- Autenticação multi-tenant (schema + auth básica)
- Ambientes dev e prod

### Trabalho novo (pós-MVP — FRs deste rito)
Os FRs novos (FR-1, FR-2, FR-3, FR-6, FR-10 a FR-14, FR-15.5–15.6 e os refinos FR-4.14–4.16) estão listados com o de-para no **Anexo A**; a ordenação de entrega vive no proposal §4. O **FR-0.5** (recuperação de senha) entrou pelo [IR] 2026-07-23 — pré-requisito do Épico 10.

### Backlog (fora do MVP) — reconciliado pelo CC 2026-07-22
- ~~Gestão de usuários: convites e onboarding~~ → **promovido a Épico 10 ampliado** (FR-15.5: Story 10.0 observabilidade + Index/#14 + defaults all-off + empty-state do dashboard como oferta)
- Competição entre amigos por percentual de hábitos (FR-15.4)
- ~~Dashboard de indicadores de saúde do sistema~~ → **absorvido** pela home-panorama (FR-6.6) + FR-8.3 + FR-7.10
- ~~Análise de IA de correlações nos dados de saúde~~ → collection **Análises** (FR-13)
- ~~Resumo mensal do Diário de Gratidão por IA~~ → um Modelo de Relatório possível (FR-13.12)
- ~~Módulo de relatórios médicos (exportação estruturada por período)~~ → **absorvido** por Análises (FR-13.11); export estruturado = fase 2
- ~~Monitoramento automático de janela de jejum + food log~~ → collection **Alimentação** (FR-11; integração read-only via espelho local; Tier 3)
- ~~Tracking de alimentação por foto~~ → superseded (fotos vêm do foodLog via FR-11; reimplementar = #5b, icebox)
- Integração com calendários externos
- Notificações *(caminho técnico validado: Declarative Web Push na PWA — oportunista, FR-3.5)*
- Migração de dados históricos do Notion
- PWA / modo offline *(parcial: polir a PWA é oportunista — iOS 26 abre standalone; offline segue fora — FR-3.5)*
- Kindle View
- Timer de foco (#13, icebox) · Superfície Histórico unificada (#9-restante, icebox) · Reimplementar foodLog (#5b, icebox) · Wrapper nativo/widgets de 1ª classe (icebox)

---

## Anexo A — Rastreabilidade de FRs (antigo → novo)

> A renumeração da Seção 5 (CC 2026-07-22) reorganizou os FRs por collection. O **texto** dos FRs entregues foi preservado. Esta tabela permite ao [CE]/[IR] reconciliar o **FR Coverage Map** do `epics.md`, que referencia os números antigos.

| FR antigo | FR novo | Nota |
|---|---|---|
| FR-0.1 – FR-0.4 | FR-0.1 – FR-0.4 | Inalterado |
| FR-1.1 – FR-1.13 (Motor BuJo) | FR-4.1 – FR-4.13 | Texto preservado; renumerado |
| — | FR-4.14 – FR-4.16 | Novo: #24, #15, #23 |
| FR-2.1 – FR-2.10 (Hábitos) | FR-7.1 – FR-7.10 | Texto preservado; renumerado |
| FR-3.1 – FR-3.3 (Saúde-Métricas) | FR-8.1 – FR-8.3 | Texto preservado; renumerado |
| FR-3.4 – FR-3.7 (Medicamentos) | FR-9.1 – FR-9.4 | Texto preservado; renumerado |
| FR-4.1 (Gratidão — múltiplas entradas) | FR-10.7 + FR-10.4 | Absorvido pelo Journalling (campo seed "Gratidões") |
| FR-4.2 (Gratidão — histórico data/mês) | FR-10.5 | Absorvido pelo Journalling |
| FR-4.3 (Análises — Modelos de Relatório) | FR-13.1 – FR-13.12 | Realocado e decomposto (era backlog; E1 do proposal) |
| FR-5.1 – FR-5.4 (Brain Dump) | FR-5.1 – FR-5.4 | Inalterado |
| FR-6.1 – FR-6.4 (Gestão de Usuários) | FR-15.1 – FR-15.4 | Texto preservado; renumerado |
| — | FR-0.5 (Recuperação de senha) | Novo (IR 2026-07-23; pré-requisito do Épico 10) |
| — | FR-1 (Infra Collections) | Novo |
| — | FR-2 (Config de IA/BYO key) | Novo |
| — | FR-3 (Plataforma C5) | Novo |
| — | FR-6 (Home/Dashboard/Hoje) | Novo (D4) |
| — | FR-10 (Journalling — núcleo) | Novo |
| — | FR-11 (Alimentação) | Novo (#5a) |
| — | FR-12 (Pressão Arterial) | Novo (#20) |
| — | FR-13 (Análises) | Novo (consolida FR-4.3) |
| — | FR-14 (Custom Collections) | Novo (C6) |
| — | FR-15.5 – FR-15.6 (Épico 10 ampliado) | Novo |
