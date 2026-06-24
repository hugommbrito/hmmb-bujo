---
name: project-bujo-digital
description: BuJo Digital — status do projeto, fases concluídas e artefatos
metadata:
  type: project
---

Aplicativo web pessoal de Bullet Journal para Hugo (e futuramente amigos). Compete com o caderno físico, não com Notion.

**Why:** Eliminar atrito mecânico do ciclo BuJo (reescrever headers, recriar grids, repassar tarefas) sem eliminar o julgamento que o método exige.

**How to apply:** Ao sugerir features ou abordagens, sempre verificar se preserva a intencionalidade das migrações (100% das decisões requerem ação explícita do usuário — counter-métrica do PRD).

## Fases concluídas (2026-06-15)

- **PRD:** `_bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md` (status: final)
- **UX Design:** `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-06-15/` (status: final)
  - DESIGN.md — paleta Papel & Tinta, Inter, MUI theming
  - EXPERIENCE.md — 17 superfícies, 7 Key Flows, Motor de Migrações especificado
  - mockups/: Daily Log desktop, Migration Modal, FAB Capture Sheet mobile

## Próximos passos naturais

- `bmad-create-architecture` — arquitetura técnica
- `bmad-create-epics-and-stories` — epics e stories para implementação
- Fase 0 (PRD): schema multi-tenant + auth básica
