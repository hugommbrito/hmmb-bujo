# Epic 16 Context: Onda 5 — Módulos: Migração + Refinos + Journalling

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Levar Hábitos, Saúde-Métricas e Medicamentos para o sistema novo já com seus refinos e fazer o Journalling nascer na linguagem nova absorvendo o Diário de Gratidão. Hábitos ganha pictogramas Phosphor, o dia "não registrado" e leituras agregadas; Saúde-Métricas recebe o pacote C3 (reordenar, editar seguro, percentual e enum multi, grupos); Medicamentos vira collection própria ao lado de Saúde no grupo visual "Saúde"; o Journalling substitui a Gratidão com migração verificada e aposentadoria da superfície antiga na mesma onda — nunca duas verdades. Épico pesado por design: stories pequenas, gate de UX por módulo, execução em lotes.

## Stories

- Story 16.0: [UX] Mockup de Hábitos no sistema novo (gate do épico — aprovado)
- Story 16.1: Hábitos no sistema novo
- Story 16.2: Campo `icon_key` e catálogo Phosphor
- Story 16.2c: Dia "não registrado" por collection (Hábitos e Medicamentos)
- Story 16.2b: Leituras agregadas de Hábitos
- Story 16.3: [UX] Mockups de Saúde-Métricas + Medicamentos (gate do lote)
- Story 16.4: Saúde-Métricas no sistema novo
- Story 16.5: Refinos C3 — reordenar e editar métricas
- Story 16.6: Refino C3 — tipos percentual e enum multi-seleção (backend)
- Story 16.7: Refino C3 — percentual e enum multi na UI
- Story 16.8: Refino C3 — grupos de métricas
- Story 16.9: Medicamentos no sistema novo
- Story 16.10: [UX] Mockup do Journalling (gate do lote)
- Story 16.11: Journalling — backend (app, campos e três âncoras)
- Story 16.12: Journalling — superfícies (config, registro e históricos)
- Story 16.13: Migração das Gratidões + freeze de escrita
- Story 16.14: Aposentadoria da superfície da Gratidão

## Requirements & Constraints

- **Paridade antes de refino.** Inventariar e preservar ações, estados, atalhos e feedback da superfície real. Regras já entregues (completude ponderada, multiplicador por tipo de dia, snapshot imutável, validação JSONB de saúde) não mudam; redesign e regra de domínio nunca na mesma story.
- **Editar seguro × destrutivo** (métricas e campos de journalling): renomear e adicionar opção são livres, com histórico preservado; mudar tipo/cadência ou remover é bloqueado na API e na UI — só desativação, com motivo acessível. Enum existente → multi é mudança de tipo: desativar e criar outra.
- **Consentimento de IA por campo:** contexto de IA nasce desligado em todo campo de journalling, inclusive o seed migrado.
- **Migração sem perda, verificada antes de aposentar:** contagem origem = destino mais amostra conferida, freeze de escrita da superfície antiga e só então remoção de rotas. Código e tabela legados ficam até a onda de remoção do legado.
- **Aceite UX por story de UI:** tokens e componentes do design system vigente sem valores locais; recomposição wide/medium/compact; estados loading/empty/error/offline/disabled/readonly; conteúdo preservado em falha com otimismo/rollback; testes semânticos, E2E representativo e regressão visual; ativação e rollback por superfície. Sem verificação formal de acessibilidade por story — teclado, foco, touch target e contraste vêm herdados dos componentes e tokens.
- **Migrations de schema:** teste de reversibilidade e banco do E2E atualizado antes da suíte.

## Technical Decisions

- **Dia "não registrado" por collection.** Presença de `(usuário, data, collection)` em `accounts`, no molde dos feriados; idempotente, data futura rejeitada. Dia marcado é tratado **exatamente** como dia sem linha materializada: completude explicitamente nula, fora de todo denominador, ponto omitido nas séries. Nenhuma linha de domínio é apagada — as entradas ficam, seguem editáveis e não desmarcam o dia; desmarcar devolve o dia às estatísticas sem recálculo. A flag de uma collection não afeta a outra; em Medicamentos, dia marcado lê "não registrado" no lugar de "dose perdida" (sinal clínico, não ausência de registro).
- **Agregações sempre server-side** sobre os pesos congelados; a interface nunca infere completude, nem agregados. Denominador é "dias com registro", nunca dias corridos; dia sem linha ou não registrado vem nulo e renderiza "sem registro", nunca barra zerada; "ano" é ano civil; dia com soma de pesos efetivos zero sai de numerador e denominador; numérico agrega por média simples; sequência atravessa inatividade, quebra em dia ativo sem registro e trata o dia corrente como neutro.
- **`icon_key` é mudança de contrato com story própria.** Guarda o nome do glifo Phosphor, nunca componente ou SVG. Catálogo aberto (~1.500 nomes da versão instalada, busca por substring em inglês); o servidor valida contra o pacote e rejeita nome inexistente. A migração converte cada `emoticon` em `iconKey` e o emoji deixa de ser renderizado; sem pictograma ou chave órfã, a coluna do glifo fica vazia — nunca tofu.
- **Refinos de métricas:** `percent` e `enum_multi` (array de rótulos válidos) entram sem migração destrutiva — valores single seguem válidos — e as queries analíticas ganham cast por tipo (percentual numérico, multi como contagem/frequência). Grupos de métricas: entidade nova com criar, renomear, reordenar e desativar, nunca deletar com métricas associadas; sem grupo = "Geral".
- **Journalling é app novo** com campos no padrão das métricas de saúde e entradas com três âncoras temporais mutuamente exclusivas — data (diário), início de semana com CHECK de segunda (semanal), timestamp (livre) — impostas por CHECK conforme a cadência. Entrada única × múltiplas validada no service e por índice único parcial; horário só gravado quando o campo pede.
- **Saúde-Métricas e Medicamentos são duas collections:** duas entradas no registro estático sob o grupo "Saúde" (agrupamento é apresentação). Collection nova = pasta + uma entrada no registro, dados puros, sem hooks/Query. O Journalling preenche o slot de card do dashboard (card único dos campos ativos); consumo real na onda da home. O resumo do dia passa a servir a última entrada do Journalling no campo genérico da última gratidão, sem breaking change. O campo de prescritor já existe no modelo de medicamentos; a migração verifica sua exposição e registra follow-up se faltar.

## UX & Interaction Patterns

- **Padrão Registro** (data → registro → feedback → histórico) com abas em ordem fixa **Hoje · Histórico · Configuração**. A variante **Registro em cards** (um Panel por grupo, duas colunas em wide, workspace além da largura de leitura) é reutilizável por qualquer superfície com dados agrupados — inclusive Saúde.
- **Semeadura:** a interface abre o dia, não cria linhas. Booleano alterna entre marcado e nulo, com nulo escrito como "Não feito" — checkbox nunca é canal único. Numérico faz commit no blur/Enter; valor inalterado não dispara requisição. Otimismo restrito ao valor da linha; porcentagens, pesos efetivos e multiplicadores só mudam com resposta do servidor.
- **Sem limite de retroatividade:** qualquer dia semeado é editável com os pesos congelados daquele dia. Histórico é somente leitura em contraste normal e leva o dia à aba Hoje para corrigir. "Não registrado" é escrito no lugar da porcentagem (sem barra em zero, nunca só cor), com o controle ao lado do de feriado e o estado nomeado no detalhe do Histórico.
- **Configuração separa identidade de dado versionado:** identidade (nome, pictograma, unidade, grupo) vale para todo o histórico; peso, meta, bônus e ativação abrem versão a partir de hoje, com aviso persistente em texto (nunca tooltip). Excluir não existe — o domínio desativa.
- **Proibição de celebração integral:** nada de chama, medalha, "não quebre a corrente", confete, som ou cor que mude com o número. Métrica factual é permitida; mecânica de recompensa não. Gráficos respeitam teto de 4 cores, degradam para série única e têm tabela equivalente permanente.
- **Pictogramas:** monocromáticos em `currentColor`, weight regular, 18/20px; decorativos com label visível, nome acessível quando sozinhos; o mesmo `iconKey` em toda superfície. Seletor é grade virtualizada com busca, tiles como radio sem controle desenhado, contagem filtrada anunciada.
- **Todo mockup inclui o estado "collection desligada/ausente".** Estados de Saúde/Medicamentos (métrica sem valor, histórico vazio, dose perdida/readonly, falha parcial) e de Journalling (vazio, salvando, falha preservando o texto, offline) fecham nos respectivos gates. Journalling não tem insights, streak nem IA.

## Cross-Story Dependencies

- **Depende das ondas anteriores:** shell do sistema novo e núcleo BuJo já migrados.
- **Gates human-in-the-loop bloqueiam os lotes:** 16.0 → [16.1, 16.2, 16.2c, 16.2b] · 16.3 → [16.4–16.9] · 16.10 → [16.11–16.14]. Nenhuma story de implementação começa antes do gate do lote aprovado e promovido aos spines.
- **16.1 → 16.2 → 16.2c → 16.2b:** a 16.1 entrega o módulo sem glifo (coluna vazia); a 16.2 traz pictograma e migração do emoji; a 16.2c cria a flag que a 16.2b consome — as leituras agregadas só são implementáveis depois dela.
- **16.6 → 16.7:** backend (migration + validação + cast analítico) e frontend dos novos tipos nunca no mesmo diff.
- **16.13 → 16.14:** a aposentadoria exige migração verificada; o AC de contagem da 16.13 é pré-condição do drop da tabela legada na onda de remoção do legado.
- **Alimenta a onda seguinte:** card de Journalling no dashboard e consumo dos indicadores dos módulos acontecem na onda da home, cuja spec de UX corre em paralelo com a cauda deste épico.
