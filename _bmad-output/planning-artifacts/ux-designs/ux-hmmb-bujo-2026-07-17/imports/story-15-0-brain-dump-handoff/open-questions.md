# Questões abertas — Story 15.0 (decisão antes de 15.1)

| # | Questão | Situação no mockup | Tipo de decisão |
|---|---|---|---|
| Q1 | **Conflito de contrato:** o AC da 15.1 exige paridade de “edição” do item, mas o domínio não tem atualização — só criar, listar, processar, descartar e contar. Editar exigiria endpoint novo. | **Resolvida (Hugo, 2026-07-29):** adicionar edição — endpoint novo. O sheet do item ganha os mesmos três campos da captura (Título, Descrição, Destino). Endpoint de atualização (`PATCH /api/brain-dump/items/{id}/`) é obrigação downstream de arquitetura antes da 15.1. | Domínio (bloqueava UX) |
| Q2 | **Descartar sem confirmação:** o comportamento atual apaga no clique, sem dialog e sem desfazer — perda irreversível de conteúdo capturado. | **Resolvida (Hugo, 2026-07-29):** manter paridade — descarta direto, sem dialog, sem desfazer, igual ao legado. | Comportamento |
| Q3 | **Exibir a data de captura:** `created_at` existe e define a ordenação, mas nenhuma fonte upstream pede que apareça. | **Resolvida (Hugo, 2026-07-29):** manter, como no handoff — exibida em `meta` tabular no ponteiro e no sheet do item. | UX |
| Q4 | **“Esta Semana” e data:** o processamento aceita `scheduled_date` opcional e a UI atual nunca envia esse campo. | **Resolvida (Hugo, revisão do handoff):** a escolha de dia passa a ser exposta — Esta Semana oferece os sete dias da semana corrente + Sem dia definido; Este Mês oferece o calendário do mês corrente + Sem dia definido. Usa o `scheduled_date` que o contrato já aceita, sem API nova. **Divergência de paridade a registrar na 15.3.** | Resolvida |
| Q5 | **Lacuna documental:** EXPERIENCE.md e architecture-and-story-handoff.md não têm seção própria de Brain Dump/captura. | **Resolvida (esta promoção, 2026-07-29):** este pacote é a fonte que virou a seção “Brain Dump e captura” em EXPERIENCE.md e a seção “Brain Dump (Inbox)” em DESIGN.md. | Documentação |
| Q6 | **Cópia legada com “você”:** o texto atual diz “Salvo no Brain Dump até você processar”, contra a regra de voz. | **Adotada (2026-07-29):** reescrita para “Fica no Brain Dump até ser processado.”, consistente com a Voice and Tone já vigente em EXPERIENCE.md (sistema descreve estado e consequência, não se dirige à pessoa). | Copy |
| Q7 | **Locale do campo de mês:** o controle nativo rotula o valor pelo locale do dispositivo, enquanto o contrato exige pt-BR com mês por extenso. | **Resolvida (Hugo, 2026-07-29):** manter o controle nativo (input month) pela entrada de teclado e suporte a leitores de tela. | UX |

## Recusado por falta de requisito
- Busca, filtros, ordenação manual, seleção múltipla, “processar em lote”, arrastar para reordenar.
- Sugestão automática de destino, priorização, categorização, Eisenhower ou tags no item.
- Contador de itens em qualquer lugar além do badge do shell (FR-6 diferido).
- Estado “collection desligada/ausente” — o núcleo não é gateável; DIR-12c não se aplica.
- Fila offline, rascunho local, autosave, sincronização posterior, indicador de “pendente de envio”.
- Desfazer/lixeira do descarte, arquivamento de itens, histórico do que foi processado.
- Notificação, lembrete, streak, contagem de dias com inbox vazio, qualquer celebração.
- Captura por voz, anexos, links ou colagem estruturada.

## Bloqueios para 15.1 — status pós-promoção
- **Q1** decidida: a 15.1 (ou uma story de arquitetura anterior a ela) precisa entregar o endpoint de atualização antes de a edição do item poder ser implementada.
- **Q2** decidida: nenhuma ação adicional — a 15.1 implementa descarte direto.
- **Q4** já carregava a nota: registrar a divergência de paridade na 15.3.
