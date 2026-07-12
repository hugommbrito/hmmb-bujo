---
title: "BuJo Digital — PRD"
status: final
created: 2026-06-15
updated: 2026-06-15
---

# BuJo Digital — Product Requirements Document

---

## 1. Visão e Objetivos

BuJo Digital é um aplicativo web pessoal que digitaliza e automatiza o sistema de Bullet Journal analógico do Hugo, eliminando o trabalho mecânico de setup e preservando a intencionalidade que torna o método eficaz.

O app não compete com Notion ou apps de produtividade genéricos — compete com o caderno. Vence quando o usuário não precisar mais dele.

**Objetivo primário:** eliminar o atrito mecânico do ciclo BuJo (reescrever cabeçalhos, recriar grids, repassar tarefas) sem eliminar o juízo que o método exige nas migrações.

**Objetivo secundário:** consolidar caderno físico e Notion em uma plataforma única, acessível de desktop e mobile, eliminando o retrabalho de transcrição entre sistemas.

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

**[BACKLOG]** Dashboard de indicadores de saúde do sistema (consistência de uso, percentual de hábitos, outros).

---

## 4. Jornadas de Usuário

### UJ-1 — O Dia de Hugo

*Protagonista: Hugo. Começa na primeira abertura do app no dia.*

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

1. Acessa o Diário de Gratidão
2. Adiciona entrada de texto livre — sem estrutura obrigatória, múltiplas entradas por dia permitidas
3. Navega o histórico por data ou por mês para releitura

---

### UJ-7 — Saúde e Medicamentos

*Protagonista: Hugo, majoritariamente de manhã revisando o dia anterior.*

1. Abre o módulo de Saúde
2. Preenche as métricas do dia anterior — [ASSUMPTION: exemplos dos campos atuais de Hugo: peso, pressão, horas de sono, qualidade de sono, produtividade manhã/tarde/noite, atividade física, evacuação, viagem, etc. O conjunto exato é dinâmico e definido pelo usuário (FR-3.1)]
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

### FR-0 — Fundação

**FR-0.1** — Os dados de cada usuário são completamente isolados. Nenhum dado de um usuário é acessível por outro usuário, em nenhuma circunstância.

**FR-0.2** — Autenticação via email/senha com sessão persistente.

**FR-0.3** — Dois ambientes isolados: dev e prod. Dados não se cruzam entre ambientes.

**FR-0.4** — O sistema suporta múltiplos usuários desde o início. A UI de convite e gestão de usuários é entregue em fase posterior (FR-6).

---

### FR-1 — Motor BuJo

#### Logs e Estrutura

**FR-1.1** — O sistema mantém quatro tipos de log:
- **Daily Log:** um por dia calendário
- **Weekly Log:** um por semana, organizado por dia da semana (segunda a domingo)
- **Monthly Log:** um por mês, com tarefas atribuídas a datas específicas
- **Future Log:** itens com data futura completa (mês + dia) ou parcial (só mês)

**FR-1.2** — O Future Log aceita itens com data parcial (só mês). O dia é definido quando aquele mês for aberto na migração mensal.

#### Tarefas

**FR-1.3** — Uma tarefa tem os seguintes campos:
- Título (obrigatório)
- Descrição (opcional)
- Subtarefas (opcional)
- Etiqueta Eisenhower: Vermelho (Urgente + Importante), Laranja (Urgente), Amarelo (Importante), Verde (nenhum) — opcional
- Categoria: agrupamento visual por cor (teal, purple, pink, yellow, green, blue), exibido como borda lateral na Task Row — independente do Eisenhower, opcional

**FR-1.4** — Estados de uma tarefa: pendente, iniciada (`/`), concluída (`X`), cancelada, migrada, adiada.

**FR-1.5** — Ao iniciar uma tarefa o usuário marca `/`; ao concluir marca `\`, formando visualmente um X.

**FR-1.6** — A ordenação das tarefas dentro de um log é manual.

#### Motor de Migrações

**FR-1.7** — Na abertura do dia, o app apresenta as tarefas pendentes do dia anterior uma a uma. Para cada tarefa, o usuário decide:
- **Migrar** → vai para o Daily Log de hoje
- **Adiar dentro do mês** → atribuída a uma data específica no Monthly Log
- **Adiar fora do mês** → vai para o Future Log com mês + dia ou só mês
- **Cancelar** → encerrada sem destino

**FR-1.8** — Na abertura da semana (segunda-feira), o app apresenta as tarefas do Weekly Log anterior sem disposição. Para cada tarefa, o usuário decide: migrar para o novo Weekly Log, adiar ou cancelar.

**FR-1.9** — Na abertura do mês (primeira semana do mês), o app:
1. Apresenta tarefas do Monthly Log anterior sem disposição → usuário decide por cada uma
2. Puxa automaticamente os itens do Future Log do mês corrente para o Monthly Log, com suas datas

**FR-1.10** — Uma semana é considerada **fechada** quando todas as suas tarefas têm disposição (concluída, cancelada, adiada ou migrada).

#### Recorrentes

**FR-1.11** — Tarefas recorrentes são templates com os seguintes campos: título, grupo de recorrência (Semanal / Mensal / Anual), recorrência (texto livre — ex: "segunda e quarta", "dia 15"), ativo (booleano) e demais campos de tarefa.

**FR-1.12** — Na abertura de cada ciclo, o app apresenta a lista de recorrentes ativos do período. O usuário decide o placement de cada um (em qual dia/log cada recorrente entra). Não há auto-placement.

#### Arquivo

**FR-1.13** — Semanas e meses fechados ficam consultáveis no arquivo. O histórico exibe o estado final de cada tarefa e o que foi feito com ela.

---

### FR-2 — Sistema de Hábitos

**FR-2.1** — Hábitos são organizados em grupos criados pelo usuário (ex: Profissional, Pessoal, Saúde).

**FR-2.2** — Campos de criação de um hábito: nome, emoticon, grupo, peso inicial, tipo (booleano ou numérico).

**FR-2.3** — Hábitos numéricos têm adicionalmente: meta (valor alvo) e bonus de completude (%).

**FR-2.4** — Cálculo do percentual de completude diário, ponderado pelos pesos:
- **Hábito booleano:** contribui 100% do seu peso quando marcado como feito
- **Hábito numérico:** contribui proporcionalmente de 0% a (100% − bonus%) conforme o valor registrado em relação à meta; ao atingir ou superar a meta, contribui 100% do peso
- *Exemplo: meta 5.000 passos, bonus 30% → ao registrar 2.500 passos (50% da meta), contribui com 35% do peso (50% × 70%). Ao atingir 5.000, salta para 100%.*

**FR-2.5** — Pesos podem ser alterados a qualquer momento. A alteração vale a partir do dia corrente; dias anteriores preservam os pesos que tinham naquele dia.

**FR-2.6** — O log diário de hábitos é um snapshot imutável: registra os hábitos ativos naquele dia e seus pesos vigentes naquele dia. Registros passados não são alterados por mudanças futuras de configuração.

**FR-2.7** — Hábitos são desativados, nunca deletados. Hábitos inativos não aparecem no log ativo mas permanecem no histórico com seus registros intactos.

**FR-2.8** — Hábitos desativados podem ser reativados. Ao reativar, voltam a aparecer no log a partir do dia da reativação.

**FR-2.9** — O histórico de hábitos é consultável por data.

**FR-2.10** — O histórico de hábitos também é consultável como **gráfico de evolução por hábito** ao longo do tempo. Mudanças reais de configuração (peso, meta, bonus, ativação/desativação) são anotadas no gráfico como eventos datados; variações periódicas por tipo de dia (multiplicador de fim de semana/feriado) **não** são tratadas como mudança de configuração. (Ver arquitetura AD-10 e AD-11.)

---

### FR-3 — Saúde e Medicamentos

#### Métricas de Saúde

**FR-3.1** — Métricas de saúde são campos dinâmicos criados pelo usuário. Cada campo tem: nome, tipo de dado (inteiro, decimal, booleano, enum, texto) e ativo (booleano).

**FR-3.2** — O log diário de saúde é preenchido pelo usuário (majoritariamente de manhã, revisando o dia anterior). Campos inativos não aparecem no log ativo mas são preservados no histórico.

**FR-3.3** — O histórico de saúde é consultável em três visualizações:
- **Tabela dia a dia:** valores de cada campo por data
- **Gráficos de evolução:** por campo, ao longo do tempo
- **Dashboard de período:** resumo de métricas de um intervalo selecionado

#### Medicamentos

**FR-3.4** — Medicamentos são uma entidade separada das métricas de saúde. Cada medicamento tem: nome, dose e blocos de horário (manhã / tarde / noite).

**FR-3.5** — Um mesmo medicamento pode aparecer em múltiplos blocos com doses diferentes.

**FR-3.6** — Na confirmação diária, o usuário pode confirmar todos os medicamentos de um bloco de uma vez ("tomar remédios da manhã") ou confirmar individualmente cada medicamento.

**FR-3.7** — Medicamentos têm estado ativo/inativo. O histórico de confirmações é preservado após desativação.

---

### FR-4 — Diário de Gratidão

**FR-4.1** — O usuário pode adicionar múltiplas entradas por dia em texto livre, sem estrutura obrigatória.

**FR-4.2** — O histórico é navegável por data e por mês.

**FR-4.3** — **[BACKLOG]** Resumo mensal gerado por IA.

---

### FR-5 — Brain Dump

**FR-5.1** — O brain dump é uma caixa de entrada independente, sem data e sem log de destino obrigatório. Seu estado normal é vazio.

**FR-5.2** — Cada item tem título (obrigatório) e, opcionalmente, descrição e log de destino.

**FR-5.3** — Itens do brain dump são processados manualmente pelo usuário: movidos para o log correto ou descartados. Não há migração automática.

**FR-5.4** — Quando o brain dump contém itens pendentes, um indicador visual persistente é exibido na interface até que o brain dump esteja vazio.

---

### FR-6 — Gestão de Usuários *(fase posterior)*

**FR-6.1** — O sistema suporta convite de novos usuários por email.

**FR-6.2** — Cada usuário tem seu próprio espaço de dados completamente isolado.

**FR-6.3** — [ASSUMPTION] Não há espaço compartilhado entre usuários no MVP — cada um tem sua própria instância do sistema.

**FR-6.4** — **[BACKLOG]** Competição entre amigos com base no percentual de completude de hábitos — ranking ou comparativo entre usuários do mesmo círculo.

---

## 6. Requisitos Não-Funcionais

**NFR-1 — Mobile real:** 100% das ações do fluxo diário (brain dump, marcação de hábito, saúde) são executáveis em mobile sem scroll horizontal. A experiência não é só responsividade cosmética — é um ponto de acesso funcional.

**NFR-2 — Performance:** carregamento do Daily Log e do fluxo de migrações deve ser percebido como instantâneo no uso cotidiano. [ASSUMPTION: < 2s em conexão normal]

**NFR-3 — Isolamento de dados:** nenhum dado de um usuário é acessível por outro em nenhuma circunstância.

**NFR-4 — Integridade do histórico:** logs passados são imutáveis. Nenhuma operação futura altera registros históricos (hábitos, saúde, tarefas concluídas).

**NFR-5 — Ambientes separados:** dev e prod com dados completamente isolados.

**NFR-6 — Disponibilidade:** uptime de 99% no horário de uso ativo (6h–23h). Downtime tolerável apenas em janelas de madrugada.

---

## 7. Sequência de Build (MVP)

| Fase | Módulo | Critério de saída |
|---|---|---|
| 0 | Fundação: schema multi-tenant + auth básica | Hugo consegue logar e os dados estão isolados por usuário desde o primeiro registro |
| 1 | Motor BuJo completo | Daily, Weekly, Monthly, Future Log + motor de migrações funcionando → critério de abandono do caderno |
| 1b | Brain Dump | Caixa de entrada com indicador visual; captura rápida mobile (válvula de escape, UJ-4) |
| 2 | Sistema de Hábitos | Hábitos com pesos e percentual de completude |
| 3 | Saúde e Medicamentos | Métricas dinâmicas + confirmação de medicamentos por bloco |
| 4 | Diário de Gratidão | Entradas livres + histórico navegável |
| 5 | Gestão de Usuários | Convites + onboarding de amigos |

---

## 8. Escopo e Backlog

### Dentro do escopo (MVP)
- Ciclo BuJo completo com motor de migrações e recorrentes
- Sistema de hábitos com pesos, bonus de completude e snapshot histórico
- Tracking de saúde com campos dinâmicos e visualizações
- Confirmação de medicamentos por bloco de horário
- Diário de Gratidão com histórico navegável
- Brain dump com indicador visual
- Acesso mobile responsivo e funcional
- Autenticação multi-tenant (schema + auth básica)
- Ambientes dev e prod

### Backlog (fora do MVP)
- Gestão de usuários: convites e onboarding de amigos
- Competição entre amigos por percentual de hábitos
- Dashboard de indicadores de saúde do sistema
- Análise de IA de correlações nos dados de saúde
- Resumo mensal do Diário de Gratidão por IA
- Módulo de relatórios médicos (exportação estruturada por período)
- Monitoramento automático de janela de jejum + food log
- Tracking de alimentação por foto
- Integração com calendários externos
- Notificações
- Migração de dados históricos do Notion
- PWA / modo offline
- Kindle View
