# Explicação dos arquivos não commitados — Story 14.0 / rito bmad-ux

## Visão geral

Este conjunto de mudanças documenta e fecha o gate UX da Story 14.0. O trabalho audita M06–M10, inventaria o Arquivo legado, separa funcionalidades futuras do contrato implementável, produz e promove o mock canônico Semanal/Mensal, atualiza os spines `DESIGN.md` e `EXPERIENCE.md`, valida o resultado por Rubric Walker e Acessibilidade e registra a aprovação final.

O escopo deste relatório é deliberadamente restrito aos arquivos relacionados ao rito. Mudanças não commitadas do Épico 13 e arquivos de runtime foram excluídos. `sprint-status.yaml` também foi excluído porque não aparece como modificado no inventário Git atual.

## Ordem lógica de funcionamento

1. A story define ACs, guardrails, tarefas e evidências de conclusão.
2. A auditoria e o decision log registram inventário, decisões e aprovação humana.
3. `deferred-features.md` e `.working/future-vision/` separam ideias futuras do contrato vigente.
4. `.working/key-archive.html` materializa o Arquivo implementável e é promovido, sem alteração, para `mockups/key-archive.html`.
5. `DESIGN.md` e `EXPERIENCE.md` tornam o padrão `Archive History` canônico.
6. Reconciliação e matriz de evidências ligam story, mock, spines e ACs.
7. Rubric Walker e Acessibilidade revisam o contrato; o relatório consolidado registra achados e correções.
8. As revisões editoriais confirmam estrutura e clareza, encerrando o rito.

## 1. Planejamento, escopo e estado do gate

### `_bmad-output/implementation-artifacts/14-0-ux-mockups-complementares-do-nucleo-bujo.md`

**Função geral do arquivo**

Story de UX que funciona como gate do Épico 14. É um artefato de implementação/documentação, não código executável.

**Função geral da alteração**

Cria a story completa e registra sua conclusão como `done`, com todas as tarefas marcadas, notas de fechamento, relatórios de validação e File List.

**Blocos principais**

- Linhas 1–57: objetivo e seis Acceptance Criteria.
- Linhas 59–110: tarefas concluídas do rito, inventário, mock, estados, auditoria M06–M10 e promoção.
- Linhas 112–247: guardrails de produto/arquitetura, comportamento legado inventariado, critérios de teste UX e referências.
- Linhas 268–312: registro do agente, relatórios usados, notas de conclusão e arquivos produzidos.

**Funções, classes e importações específicas**

- Não possui funções ou imports; os identificadores `AD-16`, `AD-17`, `AD-28`, `FR-4.13` e `UX-DR30/31` ligam a story a requisitos upstream.

**Comportamento de libs usadas**

- Não usa bibliotecas. Referências a React, MUI, TanStack Query e React Router descrevem o contexto futuro da Story 14.10, sem executar essas dependências.

### `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/.working/archive-14-0-coverage-audit.md`

**Função geral do arquivo**

Auditoria factual de cobertura e inventário produzida durante Discovery.

**Função geral da alteração**

Demonstra que M06–M10 continuam suficientes e que somente o Arquivo exige novo frame.

**Blocos principais**

- Linhas 7–12: dependência do Épico 13 e fronteira sem runtime.
- Linhas 14–22: matriz M06–M10 → mock → evidência → decisão.
- Linhas 24–34: diferenças entre `/archive`, Weekly/Monthly legados, `TaskRow`, rotas e backend.
- Linhas 36–52: lacuna visual confirmada e restrições que impedem inventar APIs.

**Funções, classes e importações específicas**

- Não possui símbolos de código; nomes como `weekStart`, `monthFirst` e `finalized` documentam contratos existentes.

**Comportamento de libs usadas**

- Não usa bibliotecas.

### `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/.decision-log.md`

**Função geral do arquivo**

Registro cronológico canônico das decisões do workspace UX.

**Função geral da alteração**

Acrescenta todo o percurso da Story 14.0, da abertura ao fechamento, sem reescrever decisões anteriores.

**Blocos principais**

- Linhas 1368–1390: abertura, inventário e conflitos do brain dump.
- Linhas 1392–1418: governança de Future Vision e composição diária unificada.
- Linhas 1420–1449: busca, linhagem e resumo híbrido por IA.
- Linhas 1451–1470: aprovação da visão futura e do mock canônico.
- Linhas 1472–1488: Reviewer Gate, achados e correções.
- Linhas 1490–1501: revisão editorial e aprovação final.

**Funções, classes e importações específicas**

- Não possui código. As entradas referenciam os artefatos que materializam cada decisão e preservam rastreabilidade human-in-the-loop.

**Comportamento de libs usadas**

- Não usa bibliotecas.

## 2. Governança das funcionalidades futuras

### `_bmad-output/planning-artifacts/deferred-features.md`

**Função geral do arquivo**

Catálogo transversal para ideias que não devem entrar automaticamente no contrato da story atual.

**Função geral da alteração**

Cria o mecanismo de governança solicitado por Hugo e registra quatro propostas do Arquivo.

**Blocos principais**

- Linhas 5–15: processo para registrar, revisar, aprovar, adiar ou descartar ideias.
- Linhas 17–24: estados `Proposta`, `Em descoberta`, `Aprovada` e `Descartada`.
- Linhas 28–53: DF-001, Daily Logs e compartilhamento de collections com o Arquivo.
- Linhas 55–72: DF-002, busca somente de tarefas.
- Linhas 74–92: DF-003, linhagem bidirecional.
- Linhas 94–119: DF-004, resumo de período por IA.

**Funções, classes e importações específicas**

- Os IDs `DF-001`–`DF-004` são chaves estáveis para futuros épicos e explorações.
- `Compartilhar com o Arquivo` é uma proposta tudo-ou-nada por collection; Daily, Weekly e Monthly permanecem no núcleo.

**Comportamento de libs usadas**

- Não usa bibliotecas; não define endpoint, schema ou provedor de IA.

### `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/.working/future-vision/README.md`

**Função geral do arquivo**

Política local da pasta de explorações não contratuais.

**Função geral da alteração**

Impede que Future Vision seja confundida com mock promovido ou requisito implementável.

**Blocos principais**

- Linhas 1–13: regras de isolamento, rastreabilidade para `deferred-features.md` e precedência dos spines.

**Funções, classes e importações específicas**

- Não possui código.

**Comportamento de libs usadas**

- Não usa bibliotecas.

### `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/.working/future-vision/archive-lineage-options.html`

**Função geral do arquivo**

Prancha HTML comparativa para decidir a navegação da linhagem futura.

**Função geral da alteração**

Mostra a opção A, com todos os pontos navegáveis, e a opção B, com somente origem/destino navegáveis. Hugo aprovou A.

**Blocos principais**

- Linhas 1–77: documento, tokens CSS, responsividade e estilos das duas alternativas.
- Linhas 80–86: aviso explícito de Future Vision.
- Linhas 88–131: dois frames comparáveis com a mesma tarefa e cadeia.
- Linhas 134–141: trade-offs das opções.

**Funções, classes e importações específicas**

- Classes `.node`, `.marker` e `.go` representam etapas e ações da cadeia.
- `aria-label` e `aria-current` demonstram intenção semântica, mas o arquivo é mock estático.

**Comportamento de libs usadas**

- Usa somente HTML/CSS nativos, sem JavaScript, imports ou rede. O navegador interpreta Grid/Flex e media queries; nenhum controle executa navegação real.

### `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/.working/future-vision/archive-future-vision.html`

**Função geral do arquivo**

Exploração integrada da visão futura aprovada do Arquivo.

**Função geral da alteração**

Materializa abas Diário/Semanal/Mensal, linha do tempo unificada, resumos objetivos, compartilhamento por collection, busca de tarefas, linhagem completa e resumo por IA.

**Blocos principais**

- Linhas 1–80: tokens, estilos wide/compact e composição responsiva.
- Linhas 83–87: escopo e aviso não contratual.
- Linhas 91–106: linha do tempo diária; Hábitos mostra razão e percentual.
- Linhas 109–113: resumo por IA com datas personalizadas, prompt opcional e fontes explícitas.
- Linhas 115–119: busca de tarefas e todos os pontos da linhagem navegáveis.
- Linhas 121–122: configuração `Compartilhar com o Arquivo`.
- Linhas 124–126: recomposição compacta.

**Funções, classes e importações específicas**

- `.summary` diferencia módulos; `.chain`/`.node` expressam linhagem; `.settings` ilustra preferências.
- Não há lógica de agregação, busca ou IA: os valores são espécimes visuais.

**Comportamento de libs usadas**

- Usa HTML/CSS nativos, Grid/Flex e media queries. Não usa React, MUI, API de IA ou JavaScript.

## 3. Mock implementável e promoção

### `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/.working/key-archive.html`

**Função geral do arquivo**

Mock de trabalho aprovado do Arquivo implementável.

**Função geral da alteração**

Define abas Semanal/Mensal, filtros de data, lista de períodos, detalhe readonly, linhagem, estados e recomposição responsiva sem criar contrato novo.

**Blocos principais**

- Linhas 1–58: tokens e CSS, inclusive tipografia mínima, targets de 44px e `forced-colors`.
- Linhas 61–83: frame wide Semanal com tabs ARIA, filtros, lista, Task Rows, sucessor e detalhe readonly.
- Linhas 86–105: frame wide Mensal, grupos por data e `Sem dia definido`.
- Linhas 108–118: loading, empties, error, offline, readonly, zero collections, retorno e alto contraste.
- Linhas 121–124: tablet e compact.
- Linhas 127–132: anotações implementáveis de dados, detalhe, linhagem e acessibilidade.

**Funções, classes e importações específicas**

- `role="tablist"`, `role="tab"` e `role="tabpanel"` documentam a semântica contratada.
- `aria-selected`, `aria-controls`, `aria-pressed` e `tabindex="-1"` demonstram seleção e foco.
- `.status` é não interativo em readonly; somente `.status.link` representa a seta navegável.

**Comportamento de libs usadas**

- HTML/CSS nativos, sem JavaScript. `@media (forced-colors: active)` usa cores do sistema; media queries recompõem a prancha. A implementação real consumirá MUI como infraestrutura, mas este arquivo não importa MUI.

### `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/mockups/key-archive.html`

**Função geral do arquivo**

Referência visual promovida consumida pelos spines e pelo futuro handoff da Story 14.10.

**Função geral da alteração**

Adiciona o primeiro mock canônico do Arquivo.

**Blocos principais**

- Linhas 1–136: conteúdo idêntico a `.working/key-archive.html`, preservando o original como audit trail.

**Funções, classes e importações específicas**

- Mesmos elementos e estados do arquivo de trabalho.

**Comportamento de libs usadas**

- Mesma pilha HTML/CSS nativa. O arquivo ilustra; `DESIGN.md` e `EXPERIENCE.md` vencem qualquer conflito.

## 4. Contratos canônicos de design e experiência

### `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/DESIGN.md`

**Função geral do arquivo**

Spine visual canônico: tokens, anatomia e regras de aparência.

**Função geral da alteração**

Inclui a Story 14.0 como source, cria tokens `archive-history`, cataloga `Archive History` e adiciona a seção visual do Arquivo.

**Blocos principais**

- Linha 15: nova source da Story 14.0.
- Linhas 385–393: tokens de lista/detalhe e recomposição por faixa.
- Linha 540: componente no catálogo bilateral.
- Linhas 635–646: abas, layout, readonly, estados e links para mock/Future Vision.

**Funções, classes e importações específicas**

- `{components.archive-history}` é o namespace consumido pela seção.
- `{colors.info}` e `{colors.info-soft}` governam destaque de linhagem.

**Comportamento de libs usadas**

- O documento referencia MUI como infraestrutura comportamental e Phosphor como catálogo iconográfico; não executa bibliotecas.

### `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md`

**Função geral do arquivo**

Spine comportamental canônico: IA, estados, interações, acessibilidade e jornadas.

**Função geral da alteração**

Adiciona a Story 14.0 como source, cataloga `Archive History` e fecha o contrato implementável do Arquivo.

**Blocos principais**

- Linha 15: nova source da story.
- Linha 136: componente `Archive History` no catálogo comportamental.
- Linhas 367–394: filtros/lista/detalhe, tabs ARIA, readonly, linhagem, foco, anúncios, categoria redundante, forced-colors e breakpoints.

**Funções, classes e importações específicas**

- `tablist`/`tab`/`tabpanel` definem o widget de abas.
- `aria-busy`, `aria-live="polite"` e `alert` definem anúncios.
- `weekStart` e `monthFirst` limitam o filtro ao contrato atual do índice.

**Comportamento de libs usadas**

- Especifica o comportamento que MUI/React deverão implementar depois: props ARIA, foco programático e carregamento pelas queries existentes. Não altera código dessas bibliotecas.

## 5. Reconciliação e rastreabilidade

### `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/reconcile-story-14-0.md`

**Função geral do arquivo**

Reconcilia a story de entrada com os artefatos finais.

**Função geral da alteração**

Mostra onde cada tema foi promovido, quais ideias ficaram deferidas e como divergências do legado foram resolvidas.

**Blocos principais**

- Linhas 6–18: story → destino canônico → resultado.
- Linhas 20–29: ideias preservadas fora do contrato atual.
- Linhas 31–40: diferenças entre inventário e spine aprovado.

**Funções, classes e importações específicas**

- Não possui código; conecta arquivos produtores e consumidores.

**Comportamento de libs usadas**

- Não usa bibliotecas.

### `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/story-14-0-evidence-matrix.md`

**Função geral do arquivo**

Matriz compacta de aceite.

**Função geral da alteração**

Liga cada AC a frame/anotação, fonte canônica e evidência de aprovação.

**Blocos principais**

- Linhas 3–10: AC1–AC6 com cobertura e status.

**Funções, classes e importações específicas**

- Não possui código.

**Comportamento de libs usadas**

- Não usa bibliotecas.

## 6. Revisões e síntese de validação

### `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/review-rubric.md`

**Função geral do arquivo**

Saída independente do Rubric Walker.

**Função geral da alteração**

Substitui a revisão anterior do workspace por uma rodada específica que considera a Story 14.0 e registra os achados pré-correção.

**Blocos principais**

- Linhas 3–5: veredito adequado, próximo de forte.
- Linhas 7–70: oito categorias da rubrica.
- Linhas 23–29: lacuna do componente `Archive History`.
- Linhas 39–45: mock ainda não promovido durante a revisão.
- Linhas 72–79: notas mecânicas e contagens.

**Funções, classes e importações específicas**

- Não possui código; `strong`, `adequate` e `thin` são vereditos do processo.

**Comportamento de libs usadas**

- Não usa bibliotecas. Os achados são históricos; `validation-report.*` registra sua resolução posterior.

### `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/review-accessibility-archive.md`

**Função geral do arquivo**

Revisão independente de acessibilidade do Arquivo.

**Função geral da alteração**

Documenta quatro achados altos, quatro médios, três baixos e verificações matemáticas de contraste.

**Blocos principais**

- Linhas 3–15: veredito, escopo e método.
- Linhas 17–56: achados sobre status readonly, tipografia, tabs, categoria, targets, forced-colors, foco e anúncios.
- Linhas 58–91: contraste nas oito paletas, teclado, landmarks, reflow e estados.
- Linhas 93–102: contagem e recomendação de gate.

**Funções, classes e importações específicas**

- Cita atributos ARIA, `forced-colors` e limites WCAG que orientaram as correções.

**Comportamento de libs usadas**

- Não usa biblioteca de teste; é uma análise documental. As razões de contraste foram calculadas sobre tokens, não sobre screenshots.

### `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/validation-report.md`

**Função geral do arquivo**

Síntese Markdown das duas lentes.

**Função geral da alteração**

Atualiza o relatório anterior para a Story 14.0, preserva os achados históricos e registra cada resolução.

**Blocos principais**

- Linhas 1–22: escopo, veredito e categorias.
- Linhas 24–60: achados críticos/altos/médios/baixos e correções.
- Linhas 62–72: verificação de contraste e obrigações da Story 14.10.
- Linhas 74–77: arquivos dos revisores.

**Funções, classes e importações específicas**

- Não possui código; é o gêmeo textual do HTML.

**Comportamento de libs usadas**

- Não usa bibliotecas.

### `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/validation-report.html`

**Função geral do arquivo**

Versão navegável da síntese de validação.

**Função geral da alteração**

Substitui a versão anterior por um relatório focado na Story 14.0, com cartões de veredito e achados resolvidos.

**Blocos principais**

- Linhas 1–15: metadados e CSS do relatório.
- Linhas 17–21: síntese e oito categorias.
- Linha 22: achados do Rubric Walker.
- Linha 23: achados de Acessibilidade.
- Linhas 24–26: verificações fortes e referências.

**Funções, classes e importações específicas**

- `.verdict`, `.badge`, `.resolved` e `.section` codificam visualmente vereditos, severidades e resolução.

**Comportamento de libs usadas**

- HTML/CSS nativos, sem JavaScript ou dependências externas.

## 7. Revisão editorial

### `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/editorial-review-structure-14-0.md`

**Função geral do arquivo**

Relatório do padrão editorial estrutural.

**Função geral da alteração**

Confirma que o modelo Reference/Database dos spines está adequado e não recomenda cortes ou reorganização.

**Blocos principais**

- Linhas 1–7: propósito, audiência, tipo de leitor e tamanho.
- Linhas 9–13: nenhuma alteração substantiva recomendada.
- Linhas 15–21: impacto e trade-offs.

**Funções, classes e importações específicas**

- Não possui código.

**Comportamento de libs usadas**

- Não usa bibliotecas.

### `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/editorial-review-prose-14-0.md`

**Função geral do arquivo**

Relatório clínico de copy-editing.

**Função geral da alteração**

Registra duas correções mínimas já aplicadas: concordância das datas e atributo `aria-live="polite"` explícito.

**Blocos principais**

- Linhas 1–5: tabela original → revisão → justificativa.

**Funções, classes e importações específicas**

- Não possui código.

**Comportamento de libs usadas**

- Não usa bibliotecas.

## Relações produtor → consumidor

- A story e a auditoria alimentam `.decision-log.md`.
- O decision log alimenta Future Vision e o mock canônico.
- Future Vision aponta para `deferred-features.md`, mas não é consumida como contrato.
- `.working/key-archive.html` é a fonte promovida de `mockups/key-archive.html`.
- O mock promovido é referenciado por `DESIGN.md` e `EXPERIENCE.md`.
- Os spines e o mock alimentam `reconcile-story-14-0.md`, `story-14-0-evidence-matrix.md` e as duas revisões.
- As revisões alimentam `validation-report.md` e `validation-report.html`.
- As revisões editoriais confirmam o estado final dos spines.

## Observações de escopo

- Nenhum arquivo de aplicação, backend, frontend, schema, OpenAPI, dependência ou teste foi alterado por este rito.
- Os HTMLs são artefatos estáticos; controles e dados ilustram contratos, não executam funcionalidades.
- O relatório atual não se inclui na própria análise.
