# Anexos de handoff — Story 16.0 (Mockup de Hábitos no sistema novo)

Gerados a partir de `Story 16.0 - Habitos.dc.html` (pacote visual, fonte das âncoras `#2a`…`#2l`, frames `F1`…`F15`, overlays `O1`/`O2`, estados `E1`…`E6`).

| Arquivo | Destino no bmad-ux |
|---|---|
| `story-16.0-habitos.md` | `docs/ux/story-16.0-habitos.md` — especificação normativa (escopo, superfícies, tracker, configuração, pictograma, histórico, estados, interação, a11y, aceite) |
| `traceability.md` | `docs/ux/traceability-16.0.md` — requisito → decisão visual, inventário de paridade e cobertura estado → frame |
| `design-system-delta.md` | issue/PR no design system — variantes e composições a documentar antes das stories de implementação |
| `open-questions.md` | `docs/ux/open-questions-16.0.md` — Q1–Q10, recusas e bloqueios |
| `domain-gaps.md` | `docs/prd/` — as quatro leituras de servidor que a 2l e a Q10 exigem; **nada da 2l é implementável sem isso** |

**Anexo visual:** `Story 16.0 — Handoff visual.html` (arquivo único, offline). Referencie por âncora: `#2a`…`#2l`.

## Ordem de leitura sugerida para o dev agent
1. `story-16.0-habitos.md` §1 (contrato) e §1.4 (domínio congelado) — nada fora disso.
2. `open-questions.md` — **Q2 e Q5 bloqueiam** o início; Q7 e Q10 bloqueiam só a 2l.
3. `domain-gaps.md` se a 2l entrar em escopo.
4. `traceability.md` §2 (inventário de paridade) antes de tocar em qualquer arquivo de `frontend/src/features/habits/`.

## Não incluído de propósito
A seção **2b** do pacote é inventário de paridade e está reproduzida em `traceability.md` §2 — as anotações internas de frame (`aside`) são raciocínio de design, não requisito.
