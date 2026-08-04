---
title: Experiência
aliases:
  - Experience
  - UX
type: moc
status: current
source_files:
  - _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md
source_updated: 2026-07-24
tags:
  - kb/experience
  - kb/moc
---

# Experiência

A experiência trata o produto como um workspace sereno: reduz esforço mecânico, mantém contexto temporal visível e reserva decisões irreversíveis ou intencionais ao usuário.

## Princípios

- Capturar primeiro, organizar depois.
- O sistema sugere estrutura e estado; não toma decisões BuJo pelo usuário.
- Desktop favorece densidade e planejamento; mobile preserva as ações diárias essenciais.
- Estados de loading, vazio, erro, offline e leitura são parte do contrato.

## Padrões principais

- App shell responsivo com sidebar, rail e bottom navigation.
- Page/Period Header explicita período e ciclo de vida.
- Workspace Surface contém boards e rituais.
- Task Row e detalhes mantêm ações consistentes entre superfícies.
- Dialog no desktop e sheet no mobile.
- [[Captura mobile]] preserva o registro rápido sem transportar toda a densidade do planejamento para telas pequenas.
- [[Planejamento e fechamento de ciclos]] organiza os rituais semanal e mensal.

## Acessibilidade

O piso é WCAG 2.2 AA: teclado, foco visível, landmarks, anúncios de rota, alvos adequados e ausência de dependência exclusiva de cor.

## Migração visual

O novo design system usa tokens `--ds-*` e coexiste por rota com o legado até a consolidação do Épico 18. Veja [[Roadmap]].

## Fontes

- `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md` — fluxos, estados e critérios.
- `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/DESIGN.md` — tokens e componentes.
