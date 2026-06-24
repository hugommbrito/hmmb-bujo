---
title: "BuJo Digital — Product Brief"
status: final
created: 2026-06-15
updated: 2026-06-15
---

# Product Brief: BuJo Digital

## Resumo Executivo

BuJo Digital é um aplicativo web pessoal que digitaliza e automatiza o sistema de Bullet Journal analógico do Hugo, eliminando o trabalho mecânico de setup e preservando a intencionalidade que torna o método eficaz. O app consolida caderno físico e Notion em uma plataforma única — acessível do desktop ao celular — e converte horas gastas em setup em tempo para o que importa: executar.

O BuJo Digital não compete com Notion ou com apps de produtividade genéricos. Compete com o caderno — e vence quando o usuário deixa de precisar dele.

## O Problema

O sistema atual combina caderno físico (BuJo) e Notion (saúde e hábitos) num fluxo que funciona, mas consome tempo demais:

- **Setup diário:** ~40 minutos para replicar estruturas e preparar o dia
- **Migração semanal:** ~1h30 para fechar a semana e abrir a próxima
- **Migração mensal:** ~2 horas adicionais
- **Migração anual:** um expediente completo (~8 horas)

O gargalo não é a decisão — é a execução. Reescrever cabeçalhos, redesenhar gráficos e recriar grids a cada ciclo é trabalho manual sem valor cognitivo. É exatamente o tipo de atrito que o método não exige.

Manter dois sistemas paralelos cria retrabalho de transcrição: registros feitos no caderno durante o dia são repassados ao Notion na manhã seguinte, multiplicando o tempo gasto e introduzindo riscos de inconsistência e perda de informação.

O caderno também não está sempre à mão. Consultas rápidas e pequenos registros fora de casa ficam pendentes ou se perdem — um custo invisível mas constante.

Com uma nova função profissional que exige mais do tempo disponível, essa equação deixou de ser tolerável.

## A Solução

Nenhum app do mercado implementa o método Bullet Journal da forma como Hugo o pratica. Ferramentas como Notion, Obsidian e TickTick são genéricas — e é exatamente essa genericidade que as torna inadequadas. Elas exigem que o usuário construa e mantenha o sistema, em vez de apenas usá-lo.

O BuJo Digital é **opinionado por design**: ele não oferece um canvas em branco. Ele implementa uma forma específica de trabalhar, com as decisões de método já embutidas — e os diferenciadores surgem diretamente dessa escolha:

- **Ciclo BuJo completo com motor de migrações** — Daily Log, Weekly Log, Monthly Log e Future Log gerados automaticamente, com migrações entre períodos que exigem confirmação do usuário mas não exigem retrabalho manual. A pergunta "essa tarefa ainda vale?" continua sendo do Hugo. A tarefa de copiá-la para a próxima semana, não.
- **Hábitos com peso** — cada hábito tem um peso configurável; o percentual de completude diário reflete o que importa mais, não apenas o que foi feito. Nenhum app de hábitos do mercado oferece isso.
- **Saúde integrada com propósito médico** — tracking diário com campos tipados (peso, gordura, passos, sono, medicamentos e outros) e medidas corporais periódicas, com gráficos de evolução. Os dados existem para comunicação com médicos em consultas — dados reais no lugar de suposições.
- **Diário de Gratidão** — múltiplas entradas por dia, histórico navegável, com funcionalidade de revisitar registros passados.
- **Acesso mobile real** — não só responsividade, mas um ponto de acesso genuíno para consultas e registros quando o desktop não está disponível.
- **Kindle View** — tela estática otimizada para e-ink, para visualização ambiente das tarefas do dia.
- **Multi-tenant nativo** — arquitetura preparada para múltiplos usuários desde o início, não como retrofit.

## Para Quem

**Primário:** Hugo — praticante comprometido do método BuJo, com caderno físico ativo há tempo suficiente para ter um sistema consolidado e personalizado. Usuário técnico, confortável com tecnologia, que usa o app intensivamente todos os dias em desktop e mobile.

**Secundário:** amigos do Hugo que queiram adotar o mesmo sistema. O app será aberto a esse círculo quando estiver estável. Abri-lo a esse círculo demanda arquitetura multi-tenant e ambientes de dev e prod separados desde o início.

O app não é um produto SaaS público — mas é construído para escalar sem refatoração estrutural quando o círculo de usuários crescer.

## Critérios de Sucesso

O app é um sucesso quando Hugo fecha o caderno físico de vez. Isso acontece quando três coisas estiverem funcionando:

1. **Ciclo BuJo completo** — Daily, Weekly, Monthly e Future Log com motor de migração entre períodos. Este é o critério primário: se estiver no ar, o caderno fecha, mesmo que o resto ainda esteja em construção.
2. **Diário de Gratidão** — múltiplas entradas por dia, histórico navegável.
3. **Saúde & Hábitos** — tracking diário com percentual ponderado de completude e dados de saúde estruturados.

Sinal de saúde do sistema: redução mensurável no tempo de setup semanal e eliminação do retrabalho de transcrição.

## Visão

Hoje, um app pessoal que elimina o atrito mecânico de um sistema analógico consolidado. Amanhã, uma ferramenta que um círculo de pessoas que trabalha da mesma forma pode adotar sem precisar montar nada do zero.

O projeto começa resolvendo o problema de uma pessoa — e está arquitetado para crescer sem se refazer.

## Escopo

**Dentro do escopo (MVP):**
- Ciclo BuJo completo com motor de migrações e recorrentes automáticos
- Sistema de hábitos com pesos e percentual de completude
- Tracking de saúde tipado (campos a finalizar)
- Diário de Gratidão
- Acesso mobile responsivo
- Autenticação multi-tenant
- Ambientes dev e prod

**Fora do escopo agora (backlog):**
- Módulo de relatórios médicos — exportação estruturada dos dados de saúde para consultas
- Tracking de alimentação por foto
- Integração com calendários externos
- Notificações
- Migração de dados históricos do Notion
- PWA / modo offline
- Kindle View
- Analytics avançado com correlações
