# Validation Report — hmmb-bujo / Story 14.0

- **DESIGN.md:** `DESIGN.md`
- **EXPERIENCE.md:** `EXPERIENCE.md`
- **Run at:** 2026-07-24T21:51:42-03:00

## Overall verdict

O par de spines está forte e pronto para o handoff da Story 14.0 após a rodada de correções. O Rubric Walker encontrou um link de promoção ausente e uma lacuna no catálogo bilateral; ambos foram resolvidos.

A lente de acessibilidade confirmou contraste load-bearing nas oito paletas e cobertura forte de estados. Seus achados de mock/contrato foram corrigidos antes da promoção; testes no app real continuam sendo obrigação da Story 14.10.

## Category verdicts

- Flow coverage — **strong**
- Token completeness — **strong**
- Component coverage — **strong após correção**
- State coverage — **strong**
- Visual reference coverage — **strong após promoção**
- Bloat & overspecification — **adequate**
- Inheritance discipline — **strong**
- Shape fit — **strong**

## Findings by severity

### Critical (0)

Nenhum.

### High (5 — resolvidos)

1. **Visual reference coverage** — `mockups/key-archive.html` ausente.
   Resolução: versão aprovada promovida e verificada contra `.working/key-archive.html`.
2. **Acessibilidade** — status readonly renderizados como botões.
   Resolução: status não navegáveis viraram conteúdo semântico fora da ordem de foco; somente a seta de linhagem permanece botão.
3. **Acessibilidade** — texto essencial abaixo de 14px.
   Resolução: conteúdo, labels, feedback, datas, estados e navegação do mock usam no mínimo 14px.
4. **Acessibilidade** — padrão programático de abas indefinido.
   Resolução: `Archive History` contrata tabs in-page completas; o mock demonstra `tablist`/`tab`/`tabpanel`.
5. **Acessibilidade** — categoria dependia somente de cor.
   Resolução: nome da categoria integra texto/nome acessível; forced-colors ganha distinção de borda/padrão.

### Medium (5 — resolvidos)

1. **Component coverage** — `Archive History` ausente dos catálogos bilaterais.
   Resolução: componente adicionado a `DESIGN.md.Components` e `EXPERIENCE.md.Component Patterns`.
2. **Acessibilidade** — alvos abaixo de 44×44px.
   Resolução: filtros, retry, status e demais controles ajustados para o piso de 44px.
3. **Acessibilidade** — forced-colors apenas declarado.
   Resolução: contrato detalhado e mapa ilustrativo `@media (forced-colors: active)` adicionado ao mock.
4. **Acessibilidade** — foco no sucessor ambíguo.
   Resolução: foco vai à Task Row sucessora com anúncio de período+tarefa; retorno espera a origem ser remontada.
5. **Acessibilidade** — anúncios do Arquivo incompletos.
   Resolução: `aria-busy`, skeleton oculto, alerta único de erro e status offline persistente foram contratados.

### Low (3 — resolvidos ou encaminhados)

1. Labels de filtros associados por `for`/`id` no mock.
2. Seleção de período demonstra `aria-pressed`; lista e detalhe são associados pelo contrato.
3. Skip link permanece obrigação explícita do App Shell e deve ser verificado na Story 14.10, não duplicado na prancha com múltiplos frames.

## Accessibility verification

- Contraste matemático passou nas oito paletas:
  - `ink/canvas`: 13.13–16.31:1;
  - `ink/surface`: 14.26–15.02:1;
  - `on-primary/primary`: 6.83–8.32:1;
  - semânticos/soft: 4.51–6.40:1;
  - `control-border/surface`: 5.70–8.68:1;
  - `focus` contra canvas/surface: 5.13–9.32:1.
- O contrato cobre teclado, foco não encoberto, retorno, 320 CSS px, zoom 200%, forced-colors e touch.
- A validação final de comportamento deve ocorrer no app renderizado pela Story 14.10.

## Reviewer files

- `review-rubric.md`
- `review-accessibility-archive.md`
