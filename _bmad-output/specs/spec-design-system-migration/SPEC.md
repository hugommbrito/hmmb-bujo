---
id: SPEC-design-system-migration
companions:
  - design-system-contract.md
  - migration-plan.md
  - ../../planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md
  - ../../planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/addendum.md
  - ../../planning-artifacts/epics.md
  - ../../planning-artifacts/architecture.md
  - ../../planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/DESIGN.md
  - ../../planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md
sources: []
---

> **Contrato canônico.** Esta SPEC e os arquivos em `companions:` formam o contrato completo e validado por preservação para planejar, projetar e verificar a migração. Os artefatos brownfield adotados continuam sendo autoridade para funcionalidades, regras de domínio e comportamentos existentes.

# Migração do Design System do hmmb-bujo

## Why

O produto precisa substituir sua linguagem visual antes da expansão dos módulos para evitar que novas superfícies consolidem um sistema que será descartado. A migração deve capturar a oportunidade estrutural demonstrada no handoff completo — composição, hierarquia, densidade e padrões de superfície — sem alterar o produto definido pelo PRD nem interromper o desenvolvimento brownfield já concluído ou em andamento.

## Capabilities

- id: CAP-1
  intent: O produto pode expressar todas as superfícies atuais e futuras por uma fundação visual reutilizável e coerente.
  success: bmad-ux documenta tokens, primitivas, variantes, estados e regras responsivas suficientes para representar cada padrão listado em `design-system-contract.md` sem estilos estruturais exclusivos por tela.

- id: CAP-2
  intent: As superfícies já implementadas podem migrar em uma sequência segura, mantendo suas funcionalidades e contratos de interação.
  success: cada onda de `migration-plan.md` possui inventário da superfície, critérios de equivalência funcional e acessível, dependências e estratégia de convivência antes de virar história.

- id: CAP-3
  intent: Novos módulos podem nascer no novo design system sem depender da conclusão da migração de todas as telas legadas.
  success: histórias de UI abertas após a aprovação da fundação referenciam apenas componentes e tokens novos, salvo exceção registrada com dívida e remoção planejada.

- id: CAP-4
  intent: Consumidores downstream podem distinguir decisões vinculantes desta SPEC de decisões ainda pertencentes a UX, arquitetura e planejamento.
  success: bmad-ux resolve as questões reservadas, arquitetura define a estratégia técnica de coexistência e os épicos/histórias derivam critérios rastreáveis às capacidades, sem reabrir requisitos de produto.

- id: CAP-5
  intent: A equipe pode validar que a nova linguagem preserva os fluxos reais do hmmb-bujo em diferentes tamanhos de tela.
  success: as superfícies representativas definidas como gates em `migration-plan.md` demonstram paridade de estados, ações, teclado, responsividade e WCAG 2.2 AA antes da expansão para a onda seguinte.

## Constraints

- PRD, addendum, arquitetura vigente e épicos continuam sendo a autoridade para funcionalidades, dados, estados e sequência de produto; esta SPEC só governa a migração visual e seus impactos de composição.
- O handoff é referência estrutural, não código, backlog funcional ou especificação visual final; fluxos, métricas, campos e entidades sem correspondência no produto real não entram por inferência.
- A estética lo-fi, o chrome de papel/caderno, a camada de anotações, a toolbar de revisão, SVGs e CSS/JavaScript do handoff não podem ser portados literalmente.
- Composição, hierarquia, distribuição, densidade, cards, grids, headers, chips, navegação lateral e superfícies de trabalho do handoff devem informar o novo sistema, sujeitos à reconciliação com acessibilidade, mobile real e funcionalidades existentes.
- A migração deve preservar WCAG 2.2 AA, touch targets de 44 px, ausência de scroll horizontal nos fluxos diários mobile, estados de foco, semântica, anúncios assistivos e uso de texto/ícone além de cor.
- A convivência entre sistemas deve ser incremental e reversível por superfície; nenhuma onda pode exigir uma reescrita total do frontend nem bloquear desenvolvimento de domínio não relacionado.
- A implementação só entra no sprint após bmad-ux, decisão arquitetural, correct-course, decomposição em épicos/histórias e sprint planning; este artefato não autoriza implementação.

## Non-goals

- Implementar componentes, tokens, estilos, páginas, testes ou migrações de código.
- Reescrever, ampliar ou simplificar funcionalidades, regras de domínio, estados de tarefa, jornadas ou modelo de informação do produto.
- Reproduzir automaticamente os fluxos de produtividade, streaks, fasting, analytics ou outras ideias presentes apenas no handoff.
- Adotar HTML, CSS, JavaScript, fontes, ícones ou valores visuais do handoff como ativos de produção.
- Definir nesta etapa a identidade visual final, valores exatos de tokens, fonte, iconografia, motion ou tema claro/escuro; essas decisões pertencem ao bmad-ux.
- Inserir trabalho no sprint atual ou alterar status, ordem e aceite das histórias existentes.
- Migrar backend, contratos de API ou modelos de domínio, exceto se uma análise arquitetural posterior provar impacto indispensável para suportar o sistema visual.

## Success signal

- A migração está pronta para planejamento quando bmad-ux entrega uma especificação visual que cobre a fundação e os gates representativos, arquitetura aprova uma estratégia de coexistência sem big bang, e correct-course consegue gerar histórias ordenadas com paridade funcional verificável. A migração termina quando superfícies existentes usam a nova fundação, módulos novos deixam de criar padrões legados e não há regressão aceita nas jornadas do PRD.

## Assumptions

- O slug canônico desta iniciativa é `design-system-migration`.
- O estado brownfield de referência é o sprint status de 2026-07-17: Épicos 1–5 e 11 concluídos; os módulos seguintes devem adotar a nova fundação desde sua primeira história de UI.
- A arquitetura continuará baseada em React, MUI e composição por `features/`, `pages/` e `app/`; qualquer troca de biblioteca exige decisão arquitetural explícita fora desta SPEC.
