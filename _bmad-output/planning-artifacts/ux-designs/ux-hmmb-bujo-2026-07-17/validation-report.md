# Validation Report — hmmb-bujo

- **DESIGN.md:** `DESIGN.md`
- **EXPERIENCE.md:** `EXPERIENCE.md`
- **Run at:** 2026-07-19

## Overall verdict

O par define uma direção coerente, mas ainda não está liberável para desenvolvimento nem para produção indiscriminada de todos os mockups. Primeiro é necessário escolher a direção visual e corrigir divergências funcionais, tokens, catálogo bilateral de componentes, jornadas e matriz de estados.

A revisão de produto confirmou que o maior risco não é expansão pelo handoff, mas substituição silenciosa de contratos já entregues. O produto real vence: Recorrentes permanece no Planner, migração desktop preserva o padrão aprovado, interações existentes viram baseline explícita e dark mode continua no escopo até correct-course em contrário.

## Category verdicts

- Flow coverage — broken
- Token completeness — thin
- Component coverage — broken
- State coverage — broken
- Visual reference coverage — broken
- Bloat & overspecification — adequate
- Inheritance discipline — broken
- Shape fit — strong
- Accessibility — adequate, not releasable
- Product fidelity — broken in specific load-bearing decisions

## Findings by severity

### Critical (4)

- **Flow coverage:** UJ-1–UJ-8 não possuem cobertura completa por jornadas nomeadas. Fix: adicionar mapa UJ/FR → Key Flow, clímax e falhas.
- **Token completeness:** `{colors.overlay}` usa formato incompatível com a especificação. Fix: hexadecimal de oito dígitos.
- **Component coverage:** nomes divergem entre YAML, DESIGN e EXPERIENCE. Fix: glossário bilateral canônico.
- **Visual references:** nenhum mockup novo estava promovido. Fix: escolher direção e executar plano integral de cobertura.

### High (21)

- Auth ausente da IA e dos estados.
- Recorrentes e navegação contradizem Epic 11/UX-DR8.
- Migração full-screen desktop contradiz UX-DR3.
- Atalhos, FAB, long-press, detalhe responsivo e drag existentes não estão comprometidos como baseline.
- Warning foreground/soft e bordas interativas não cumprem contraste necessário.
- Tokens de densidade, breakpoints, estado, elevação e borda estão incompletos.
- Page Header, Item Row, Section Header, Date/Range, Grid/Calendar, overlays e feedback não possuem contratos bilaterais completos.
- Falta declaração precisa do que é herdado e sobrescrito em MUI.
- Estados globais não estão mapeados por superfície.
- Estados específicos de ritual, placement, ciclos, recorrentes e medicação estão incompletos.
- Fontes dos dois spines e identificadores UJ/CAP/FR não estão alinhados.
- Imports do handoff não estão referenciados/rejeitados arquivo a arquivo.

### Medium (12)

- Falhas ausentes em vários Key Flows.
- Inter/fallback ainda sem contrato de carregamento.
- Modelo de teclado de grids/calendários indefinido.
- Chips/rows densos conflitam com hit-area mínima sem distinção display/action.
- Responsividade por família de superfície ainda não é demonstrável.
- Dark mode diverge de UX-DR1 e deve permanecer até decisão upstream.
- Saúde deve nomear o Resumo de período de FR-3.3 sem importar analytics.
- Estados interativos não têm matriz por componente.
- Parte da estratégia de migração repete fontes upstream.

### Low (4)

- `ink-disabled` merece maior contraste operacional.
- Validar orientação, font scaling e zoom estreito nos boards.
- Breakpoints estão repetidos entre spines.
- Seções downstream podem ser reduzidas após fechamento da rastreabilidade.

## Reviewer files

- `review-rubric.md`
- `review-accessibility-product.md`

## Gate

1. Escolher uma das quatro direções visuais.
2. Corrigir achados críticos e altos independentes de estética.
3. Completar/prometer dark mode e matriz de contraste.
4. Produzir os 24 conjuntos do plano de cobertura.
5. Promover os mockups e reler decisões para os spines.
6. Revalidar antes de mudar `status: draft` para `final`.
