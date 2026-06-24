---
name: ux-decisions
description: Decisões de design do BuJo Digital tomadas na sessão de UX em 2026-06-15
metadata:
  type: project
---

Decisões finais da sessão bmad-ux em 2026-06-15. Fonte: `.decision-log.md` no workspace de UX.

**Why:** Registrar para não re-abrir decisões já tomadas em sessões futuras (arquitetura, epics, dev).

**How to apply:** Ao discutir implementação ou arquitetura, estas decisões estão fechadas. Não reabrir sem sinalizar explicitamente.

## Visual

- Direção: Digital-nativo com DNA do caderno (não fidelidade ao analógico)
- Paleta: "Papel & Tinta" — bg #FDFAF4 (light) / #2A2420 (dark carvão-quente)
- Tipografia: Inter, apenas Regular 400 e SemiBold 600
- UI Framework: Material UI com theming agressivo (zero elevation, zero ripple, border-radius máx 8px)
- Dark mode: incluído via MUI palette.mode
- Cabeçalhos de dia: tom-sobre-tom do bg (#F0EBE0), NÃO azul pastel
- Brand primary: #2BADA0 (teal)
- Cores Eisenhower: sugestões adaptáveis à paleta (não fixas)

## Navegação

- Desktop: sidebar fixa colapsável (ícones+labels → só ícones)
- Mobile: bottom nav 4 abas (Hoje · Planner · Hábitos · Saúde) + FAB para Brain Dump
- FAB: sempre visível, badge numérico quando Brain Dump tem itens pendentes

## Símbolos

- Ícones modernos MUI Icons substituem símbolos do caderno físico
- ○ pendente · ⏳ iniciada · ✓ concluída · → migrada · →→ adiada · ⚡ rápida

## Cores semânticas (task categories)

- cat-teal #2BADA0, cat-purple #7B5EA7, cat-pink #D95F78
- cat-yellow #C89B00, cat-green #4A8C5C, cat-blue #3D72B4
- Aparecem APENAS como borda esquerda de 3px em task-rows
