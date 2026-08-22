# Epic 16 Context: Onda 5 — Módulos: Migração + Refinos + Journalling

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Levar os módulos diários — Hábitos, Saúde-Métricas e Medicamentos — para o sistema novo já com seus refinos, e fazer o Journalling nascer diretamente na linguagem nova absorvendo o Diário de Gratidão. Não é só migração de superfície: Hábitos ganha pictogramas Phosphor e leituras agregadas; Saúde-Métricas ganha o pacote de refinos C3 (reordenação, edição segura, tipos percentual e enum multi-seleção, grupos de métricas); Medicamentos passa a ser collection própria ao lado de Saúde no grupo visual "Saúde"; e o Journalling substitui a Gratidão com migração verificada e aposentadoria da superfície antiga na mesma onda, para que nunca exista um período de duas verdades. É um épico pesado por design — stories pequenas, gates de UX por módulo e execução em lotes.

## Stories

- Story 16.0: [UX] Mockup de Hábitos no sistema novo (gate do épico — já aprovado)
- Story 16.1: Hábitos no sistema novo
- Story 16.2: Campo `icon_key` e catálogo Phosphor
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

- **Paridade antes de refino.** Migrar uma superfície significa inventariar ações, estados, atalhos e feedback da superfície real e preservá-los integralmente. Regras de domínio já entregues (completude ponderada, multiplicador por tipo de dia, snapshot imutável, validação JSONB de saúde) não mudam nas stories de migração.
- **Editar seguro × destrutivo.** Em métricas de saúde e em campos de journalling: renomear e adicionar opção de enum são livres, com histórico preservado e sem migração de dados; mudar tipo/cadência ou remover é bloqueado na API e na UI — só desativação, com o motivo escrito e acessível. Converter enum existente em multi-seleção é mudança de tipo (bloqueada); o caminho suportado é desativar a métrica e criar outra.
- **Consentimento de IA por campo.** Todo campo de journalling nasce com contexto de IA desligado (opt-in explícito), incluindo o campo seed migrado.
- **Migração sem perda, verificada antes de aposentar.** A absorção da Gratidão exige contagem origem = destino mais amostra conferida registrada na story, freeze de escrita da superfície antiga e só então remoção de rotas. Código e tabela legados permanecem até a onda de remoção do legado.
- **Aceite UX por story de UI:** rastreia FR/épico e padrão do spine; consome tokens e componentes do design system vigente sem valores estruturais locais injustificados; demonstra recomposição wide/medium/compact; cobre loading, empty, error, offline, disabled e readonly; preserva conteúdo em falha e o comportamento otimista/rollback; inclui testes semânticos/interação, E2E representativo e regressão visual; define ativação e rollback por superfície.
- **Sem verificação formal dedicada de acessibilidade por story.** Teclado, foco, touch target e contraste vêm herdados dos componentes e tokens compartilhados.
- **Migrations que mexem em schema exigem teste de reversibilidade** e atualização do banco usado pelo E2E antes de rodar a suíte.

## Technical Decisions

- **Journalling é um app novo** com definições de campo no mesmo padrão das métricas de saúde e entradas com **três âncoras temporais mutuamente exclusivas** — data (diário), início de semana com CHECK de segunda-feira (semanal) e timestamp de ocorrência (livre) — impostas por CHECK conforme a cadência do campo. Entrada única × múltiplas é validada no service e reforçada por índice único parcial. Horário só é gravado quando o campo pede.
- **`icon_key` é mudança de contrato com story própria.** Guarda o **nome do glifo** Phosphor, nunca componente React ou SVG. Catálogo **aberto** (~1.500 nomes da versão instalada, busca por substring do nome em inglês); o servidor valida contra o pacote instalado e rejeita nome inexistente com 400. A migração converte cada `emoticon` existente em `iconKey` e **o emoji deixa de ser renderizado**; hábito sem pictograma ou chave órfã cai para coluna de glifo vazia — nunca tofu ou quadrado de erro.
- **Agregações são sempre server-side.** A interface nunca infere completude, e a regra vale igual para métricas agregadas: cálculo sobre os pesos congelados, dia sem linha materializada vem explicitamente nulo e renderiza "sem registro", nunca barra zerada. Denominador é "dias com registro", nunca dias corridos; período "ano" é ano civil; dia com soma de pesos efetivos zero sai de numerador e denominador; hábito numérico agrega por média simples; sequência atravessa inatividade, quebra em dia ativo sem registro e trata o dia corrente como neutro. A série por grupo é exposta em `GET /api/habits/history/by-group/?start&end`.
- **Novos tipos de métrica:** `percent` valida 0–100; `enum_multi` grava array de rótulos válidos contra as opções do enum. Valores single existentes continuam válidos — sem migração destrutiva. As queries analíticas ganham cast por tipo para os dois casos (percentual numérico, multi como contagem/frequência).
- **Grupos de métricas** são entidade nova com CRUD (criar, renomear, reordenar, desativar; nunca deletar com métricas associadas); associação opcional, sem grupo = "Geral".
- **Saúde-Métricas e Medicamentos são duas collections** — duas entradas no registro estático de collections sob o grupo de navegação "Saúde"; o agrupamento é apresentação, não entidade. Toda collection nova é pasta + **uma** entrada no registro, com dados puros (sem hooks/Query no registro).
- **Journalling preenche o slot de card de dashboard** no registro (card único agregando os campos ativos); o consumo real acontece na onda da home.
- **O endpoint de resumo do dia** passa a servir a última entrada do Journalling no campo genérico onde hoje serve a última gratidão — troca sem breaking change.
- **Exposição do prescritor:** o modelo de medicamentos já tem o campo; a story verifica se ele aparece no detalhe da substância vigente e registra follow-up se houver lacuna.

## UX & Interaction Patterns

- **Padrão Registro** (data → registro → feedback → histórico) com três abas em ordem canônica e invariável: **Hoje · Histórico · Configuração**. Em Hábitos, a variante canônica **Registro em cards** (um Panel por grupo, duas colunas em wide, workspace ampliado além da largura de leitura) é reutilizável por qualquer superfície com dados agrupados de mesma forma — inclusive Saúde.
- **Semeadura:** a interface abre o dia, não cria linhas. Booleano alterna entre marcado e nulo, com nulo apresentado como "Não feito" em texto — checkbox nunca é canal único. Numérico faz commit no blur/Enter; valor inalterado não dispara requisição.
- **Otimismo restrito ao valor da linha.** Porcentagens, pesos efetivos e multiplicadores só mudam com resposta do servidor.
- **Sem limite de retroatividade:** qualquer dia já semeado é editável, com os pesos congelados daquele dia. O histórico é somente leitura em contraste normal (readonly nunca parece disabled) e leva o dia selecionado para a aba Hoje para correção.
- **Configuração separa identidade de dado versionado.** Identidade (nome, pictograma, unidade, grupo) vale para todo o histórico; peso, meta, bônus e ativação abrem versão válida a partir de hoje, com aviso persistente em texto (nunca tooltip). Excluir não existe em nenhuma superfície — o domínio desativa.
- **Proibição de celebração permanece integral:** nada de chama colorida, medalha, "não quebre a corrente", confete, som ou cor que mude conforme o número. Métrica agregada factual é permitida; mecânica de recompensa não. Gráficos respeitam teto de 4 cores e degradam para série única, sempre com tabela equivalente permanente ao lado.
- **Pictogramas:** monocromáticos em `currentColor`, weight regular, 18/20px; decorativos quando há label visível, com nome acessível quando sozinhos; o mesmo `iconKey` em cadastro, tracker, grids e histórico. O seletor é grade de tiles virtualizada com busca, tiles como radio sem controle desenhado, contagem filtrada anunciada.
- **Todo mockup inclui o estado "collection desligada/ausente"**, além dos estados obrigatórios.
- Estados de Saúde/Medicamentos (métrica sem valor, histórico vazio, dose perdida/readonly, falha parcial) e de Journalling (vazio, salvando, falha preservando o texto digitado, offline) são fechados nos respectivos gates de UX. Journalling não tem insights, streak nem IA.

## Cross-Story Dependencies

- **Depende das ondas anteriores:** o shell do sistema novo e o núcleo BuJo já migrados.
- **Gates human-in-the-loop bloqueiam os lotes.** A automação roda em quatro blocos: 16.0 → [16.1–16.2] · 16.3 → [16.4–16.9] · 16.10 → [16.11–16.14]. Nenhuma story de implementação começa antes do gate do seu lote estar aprovado e promovido aos spines de design.
- **16.1 → 16.2 → 16.2b:** a 16.1 entrega o módulo sem glifo (coluna vazia, layout inalterado); a 16.2 traz o pictograma e a migração do emoji; as leituras agregadas só são implementáveis na 16.2b.
- **16.6 → 16.7:** backend (migration + validação + cast analítico) e frontend dos novos tipos nunca no mesmo diff.
- **16.13 → 16.14:** a aposentadoria da superfície da Gratidão exige a migração verificada; o AC de contagem da 16.13 é também pré-condição do drop da tabela legada na onda de remoção do legado.
- **Alimenta a onda seguinte:** a UI do card de Journalling no dashboard e o consumo dos indicadores dos módulos acontecem na onda da home, cuja spec de UX roda em paralelo com a cauda deste épico.
