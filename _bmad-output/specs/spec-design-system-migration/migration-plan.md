# Plano contratual de migração

## Ordem de migração

> **Reconciliada pelo CC 2026-07-22** (`sprint-change-proposal-2026-07-22.md`): a Onda 2 original foi rachada em **2a (App Shell)** e **2b (Daily + Home)** — condição (b) da Rodada 2 do [BP] 2026-07-21; os refinos da triagem foram embutidos nas ondas; a Onda 5 muda de "nascer novo" para "migrar + refinar" (os Épicos 6–9 foram concluídos no sistema legado, antes do gate da Fundação).

| Onda | Escopo | Razão e gate de saída |
|---|---|---|
| 0 — Inventário ✅ | tokens, componentes e estilos atuais; rotas e estados implementados; divergências entre UX anterior, código e handoff | concluída — baseline do bmad-ux |
| 1 — Fundação ✅ | tokens, tema, app shell, workspace, headers, cards/panels, chips, linhas, feedback e overlays responsivos | **GATE FECHADO em 2026-07-21** |
| 2a — App Shell | shell (sidebar, bottom-nav, FAB, layout) no sistema novo, consumindo o manifest de collections (fatia 1) | destrava as ondas de superfície; paridade de navegação e acessibilidade; manifest = dados puros (sem server state) |
| 3 — Núcleo BuJo (**novo gate vertical**) | Weekly, Monthly, Future, Migração/Catch-Up, Recorrentes e Arquivo | assume a prova vertical de implementação (Daily deslocado para 2b); paridade de estados, ações, teclado e WCAG 2.2 AA sem alterar regras do Épico 4/11 |
| 4 — Captura | Brain Dump, badge, processamento, FAB e Capture Sheet | prova padrão de inbox e captura mobile mantendo server state e conectividade existentes |
| 5 — Módulos: migração + refinos | Hábitos; Saúde-Métricas com C3 (#16 reordenar → #17 editar / #18 percentual+enum multi / #22 grupos, sob regra de edição segura × destrutiva); Medicamentos (Saúde e Medicamentos = 2 collections + grupo visual "Saúde"; verificar campo "médico prescritor"); **Journalling substitui a migração da Gratidão** (campo seed "Gratidões" + migração das entradas do Épico 9 + aposentadoria da superfície na mesma onda, sem período de duas verdades) | cada módulo migra para a fundação nova já com seus refinos; não cria versão visual legada nova |
| 2b — Daily + Home (**fim da fila**) | Daily Log, Dashboard-panorama (home), Hoje (componente compartilhado de tasks do dia), UI do #15 (flag "Aguardando Terceiro"), desenho do empty-state do dashboard (a oferta de collections implementa no Épico 10) | **pré-requisito: spec da nova home aprovada (bmad-ux)**; a revogação parcial do UX-DR16 (home = dashboard) é aplicada aqui |
| 6 — Consolidação | configurações (incl. #24 nome às categorias), auth e superfícies residuais; remoção planejada de tokens/componentes legados | nenhuma rota ativa depende do sistema antigo e exceções foram eliminadas ou formalizadas |

## Critérios por onda

- Inventariar todos os estados e ações da superfície no código e nas histórias concluídas antes de redesenhar.
- Manter equivalência de navegação, dados, comandos, atalhos, permissões, estados vazios/loading/error/offline e comportamento otimista.
- Validar desktop e mobile; incluir tablet quando a composição divergir.
- Demonstrar contraste, foco, tab order, leitura por tecnologia assistiva, targets e ausência de comunicação somente por cor.
- Não avançar quando a onda exige alterar regra de produto; registrar a divergência para o artefato upstream adequado.
- Não duplicar um padrão compartilhado já aprovado; extensões precisam declarar a variação de domínio que as justifica.
- Conservar uma rota segura de rollback por superfície enquanto o sistema legado ainda existir.

## Riscos de desenvolvimento paralelo

| Risco | Controle exigido antes das histórias |
|---|---|
| Novas features criarem padrões legados | gate de UI: após Fundação aprovada, toda nova story referencia o sistema novo ou registra exceção temporária |
| Alterações simultâneas nos mesmos componentes | matriz de ownership e sequência por superfície; evitar migração e feature work no mesmo componente no mesmo sprint |
| Dois sistemas contaminarem tokens globais | arquitetura define namespaces, fronteiras e ordem de ativação sem troca global irreversível |
| Regressão funcional mascarada como redesign | baseline de estados e testes de caracterização antes de cada onda; aceite mede paridade, não apenas screenshot |
| Handoff introduzir escopo funcional | rastreabilidade obrigatória de toda ação/estado a PRD, épico ou código aprovado; ausência significa exclusão |
| Divergência entre UX anterior e nova | UX anterior preserva contratos de interação/acessibilidade até decisão explícita; nova UX substitui somente a expressão visual aprovada |
| Componentes prematuros ficarem genéricos demais | validar primeiro no gate Daily e depois no núcleo BuJo antes de congelar APIs amplas |
| Migração atrasar módulos futuros | separar fundação mínima necessária de consolidação; módulos futuros podem iniciar após o gate da Onda 1 |
| Testes acoplados a detalhes visuais | arquitetura define camadas de teste por semântica, interação, visual regression e E2E representativo |
| Gate vertical deslocado (Daily migra por último — CC 2026-07-22) | mockups Daily + Planner já provados nos gates de UX da SPEC; a Onda 3 (Núcleo BuJo) assume a prova de implementação; baseline de estados por onda cobre regressão de paridade |

## Artefatos downstream e sequência

1. **bmad-ux:** produzir UX atualizada, direção visual, tokens, catálogo de padrões, anatomias/variantes/estados, regras responsivas e protótipos dos gates Daily + Planner/Migração.
2. **Arquitetura:** registrar decisão sobre estratégia de coexistência, limites de shared/feature, theming, rollout/rollback, teste visual, deprecação e remoção do legado.
3. **Correct Course:** reconciliar o novo trabalho com PRD/arquitetura/épicos sem reabrir funcionalidades e propor impacto no plano ativo.
4. **Epics & Stories:** decompor ondas em fundação, migração por superfície e consolidação; cada story inclui rastreabilidade, paridade e critérios acessíveis/responsivos.
5. **Sprint Planning:** inserir apenas histórias prontas e ordenar conflitos com desenvolvimento de produto; módulos futuros dependem da fundação, não da migração total.

## Definition of Ready para histórias de implementação

- decisão de UX vinculada a componente/padrão identificado;
- superfície e estados inventariados contra código e histórias concluídas;
- impacto arquitetural e fronteira legado/novo definidos;
- critérios de paridade funcional, responsiva e acessível testáveis;
- dependências, ownership, rollout, rollback e remoção do legado explícitos;
- nenhuma funcionalidade originada apenas no handoff.

