# Validation Report — hmmb-bujo

- **DESIGN.md:** `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-06-15/DESIGN.md`
- **EXPERIENCE.md:** `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-06-15/EXPERIENCE.md`
- **Run at:** 2026-06-15T00:00:00-03:00

## Overall verdict

The spine pair is substantially complete and defensible for downstream consumers. DESIGN.md is exceptionally well-crafted — every token is defined, every component has a real spec, and the brand rationale is load-bearing prose, not decoration. EXPERIENCE.md covers the full FR matrix, all eight UJs, and has a rare asset: a 100%-coverage cross-reference table (Section 10). The pair's main weaknesses are mechanical: five of eight UJs lack a Key Flow in EXPERIENCE.md, the `imports/` directory is empty despite the decision-log referencing a scan of `My BuJo.pdf`, and a handful of component inconsistencies between the two files create small but real developer friction.

## Category verdicts

- Flow coverage — thin
- Token completeness — strong
- Component coverage — strong
- State coverage — adequate
- Visual reference coverage — broken
- Bloat & overspecification — adequate
- Inheritance discipline — strong
- Shape fit — strong

## Findings by severity

### High (3)

**[Flow coverage]** — UJ-5, UJ-6, UJ-7, UJ-8 have no Key Flow in EXPERIENCE.md (§ EXPERIENCE.md §9)
UJ-5 (Future Log), UJ-6 (Diário de Gratidão), UJ-7 (Saúde e Medicamentos), and UJ-8 (Configuração de Hábitos) have no Key Flow in EXPERIENCE.md §9. These surfaces have non-trivial behavioral rules (UJ-7 has a two-day review ritual; UJ-8 has weight-change semantics; UJ-6 has multiple-entries-per-day). A developer sourcing these flows has only the State Patterns tables and the FR cross-reference — correct but thin for story-level implementation guidance.
Fix: Add Fluxo 4–7 covering each missing UJ. Each needs: named protagonist, numbered steps, one climax beat, one failure or error path.

**[State coverage]** — Offline state not covered for any surface (§ EXPERIENCE.md §5 — omission across all surfaces)
The PRD does not require offline-first (PWA is backlog), but the app will be used on mobile in connectivity-constrained environments (UJ-4 is explicitly "Hugo no metrô"). A developer needs to know: does the app fail silently? Show a banner? Block writes?
Fix: Add a §5.8 Global / Connectivity state table: offline detection → non-blocking toast (one-time); write-on-offline → behavior (queue? block? reject?). "Block writes with inline error" is the minimum acceptable spec.

**[Visual reference coverage]** — `imports/My BuJo.pdf` referenced in decision-log but absent from filesystem (§ .decision-log.md §Import; imports/ directory empty)
`imports/My BuJo.pdf` is referenced in `.decision-log.md` as the visual source for the caderno vocabulary extraction (colors, symbols, layout density) — but the file is absent from `imports/`. Its absence means no future contributor can audit whether the color extraction was accurate.
Fix: Either commit `My BuJo.pdf` to `imports/`, or add a note in DESIGN.md §2 stating that the caderno scan informed the palette but the original is not retained digitally (intentional omission).

### Medium (6)

**[Flow coverage]** — Fluxo 1 covers Monday variant only; non-Monday daily path undocumented (§ EXPERIENCE.md §9, Fluxo 1)
Fluxo 1 covers UJ-1 on a Monday specifically, but UJ-1 is a daily ritual — the non-Monday path (no semanal banner, no monthly banner) is the most common execution and has no flow.
Fix: Add a parenthetical step list for the non-Monday, non-first-week variant within Fluxo 1, or note explicitly that the Monday scenario is a superset.

**[Token completeness]** — WCAG AA contrast claim is unverified — no contrast ratios cited (§ DESIGN.md §2, Accessibility sub-section)
DESIGN.md §2 states "Contraste mínimo WCAG 2.2 AA aplicado em todos os pares ink/surface" but no actual contrast ratios are cited. The most risky combination — `ink-secondary` (#6B6359) on `surface-base` (#FDFAF4) — is used for ghost chip text and inactive nav items.
Fix: Add a contrast ratio table for the four load-bearing pairings: `ink-primary/surface-base`, `ink-secondary/surface-base`, `cat-*/surface-base` (lowest-contrast, likely `cat-yellow`), and `priority-i/surface-base`.

**[Component coverage]** — Future Log Item, Health Metric Row, Medication Block have no visual spec in DESIGN.md (§ DESIGN.md §7 — gap; EXPERIENCE.md §4.7, §4.8, §4.9)
These three components have behavioral specs in EXPERIENCE.md §4.7–4.9 but no corresponding visual spec in DESIGN.md §7. A developer has behavioral rules but no token assignments.
Fix: Add §7.9 Future Log Item, §7.10 Health Metric Row, §7.11 Medication Block to DESIGN.md with at minimum: padding token, typography role, and color tokens that differentiate state.

**[State coverage]** — Future Log surface has no state coverage in §5 (§ EXPERIENCE.md §5 — no §5.x for Future Log)
Future Log empty state, cold-load state, and the "date-partial item with no day assigned" in-context state are all missing from §5.
Fix: Add §5.x Future Log with: empty ("Nenhum item no Futuro."), cold-load (skeleton rows), date-partial visual treatment.

**[State coverage]** — Health Metrics surface has no state coverage (§ EXPERIENCE.md §5 — omission)
This surface has two temporal states (day-in-review: "Ontem" fields, and day-current: "Hoje" fields). The "all fields filled" vs. "fields pending" vs. "no fields configured" states are load-bearing for implementation.
Fix: Add §5.x Saúde / Métricas covering: no fields configured, fields pending, fields complete, cold-load skeleton.

**[Visual reference coverage]** — `.working/color-themes-1.html` is an orphaned artifact with no context (§ .working/color-themes-1.html — orphan)
This artifact is in the workspace but is not linked from either spine. A developer encountering it has no context for whether it is authoritative, exploratory, or superseded.
Fix: Either link it from DESIGN.md §2 or add a note to `.decision-log.md` marking it as exploratory/superseded.

### Low (10)

**[Flow coverage]** — Fluxo 3 has no failure path for zero-item Future Log pull (§ EXPERIENCE.md §9, Fluxo 3)
No failure path is stated for UJ-3 when the Future Log pull returns zero items or the mês anterior had zero open tasks.
Fix: Add a "zero-item" failure beat to Fluxo 3 — system should confirm "Junho fechado" even if there were no pending tasks.

**[Token completeness]** — Status chip opacity expressions not computed — MUI `alpha()` call undocumented (§ DESIGN.md YAML frontmatter, components.status-chip.variants)
The `status-chip` component uses expressions like `"cat-yellow + 15% opacity"` rather than a computed hex. Implementation in MUI requires deriving the value.
Fix: Add a note in §7.5 (Status Chip) that these tint values should be computed as `alpha(token, 0.15)` using MUI's `alpha()` utility.

**[Token completeness]** — `fab-bg` dark-mode inversion uncommented in YAML (§ DESIGN.md YAML frontmatter)
`fab-bg` inverts the ink/surface relationship in dark mode (light-colored FAB on dark surface). Intentional and correct, but unexplained in YAML.
Fix: Add inline YAML comment: `# FAB inverts in dark mode — maximum contrast against dark surface-base`.

**[Component coverage]** — "Concluída" icon mismatch: `CheckBox` vs. `TaskAlt` (§ DESIGN.md §7.1; EXPERIENCE.md §4.1)
Different icons with materially different visual semantics for the same task state.
Fix: Align to `TaskAlt` as canonical and update DESIGN.md §7.1.

**[Component coverage]** — "Rápida" icon mismatch: `FlashOn` vs. `Bolt` (§ DESIGN.md §7.1; EXPERIENCE.md §4.1)
Effectively the same icon by different MUI names. `FlashOn` is the correct MUI v5 identifier.
Fix: Standardize on `FlashOn` in both documents.

**[Component coverage]** — Category chip referenced in EXPERIENCE.md but absent from DESIGN.md (§ EXPERIENCE.md §4.1; DESIGN.md §7)
EXPERIENCE.md §4.1 mentions "chip de categoria (se exibido)" but DESIGN.md §7 defines no such component.
Fix: Either add a `category-chip` entry to DESIGN.md or reword EXPERIENCE.md §4.1 to "the tooltip or aria-label on the border."

**[State coverage]** — Migration Flow zero-tasks path not specified in §5.1 (§ EXPERIENCE.md §5.1)
§5.1 describes the banner for "N tarefas pendentes" but does not specify behavior when N=0.
Fix: Add one row to §5.1: "Sem tarefas pendentes de ontem — nenhum banner exibido."

**[Bloat & overspecification]** — §8 (Do's and Don'ts) duplicates constraints already stated in §5 and §6 (§ DESIGN.md §5, §8)
No-ripple override code snippet and no-shadow rule appear in both §5 and §8. Mild maintenance surface.
Fix: In §8, convert restated constraints to cross-references: "Sem sombra — ver §5."

**[Bloat & overspecification]** — §10 FR table mixes UI and infrastructure FRs without visual separation (§ EXPERIENCE.md §10)
FR-0.x infrastructure rows mixed with UI surface rows can create false confidence that infrastructure FRs have been UX-specified.
Fix: Add a visual separator or sub-header to distinguish "UI Surface" rows from "Infrastructure (no UX surface)" rows.

**[Visual reference coverage]** — Mockup deferral note lacks a trigger condition (§ EXPERIENCE.md, header note)
Story-dev teams consuming the document before Finalize will have no visual composition reference and no stated deadline for when mockups will be available.
Fix: Change the note to: "Mockups serão produzidos na fase Finalize, antes de iniciar o desenvolvimento dos Épicos 1–3."

**[Inheritance discipline]** — FAB icon has three different values across the two documents (§ DESIGN.md §7.4; EXPERIENCE.md §4.5)
EXPERIENCE.md specifies "`AddCircle` ou `FlashOn`"; DESIGN.md specifies `AddComment`. Three icons, no decision.
Fix: Align to `AddComment` (DESIGN.md) as the canonical icon.

**[Shape fit]** — Key Flows and Inspirations/Anti-patterns order inverts canonical reference shape (§ EXPERIENCE.md §9, §11)
BuJo ordering (Flows §9, FR matrix §10, Anti-patterns §11) is intentional and defensible — no consumer impact.
Fix: No action required unless the team wants strict canonical compliance.

## Reviewer files

- `review-rubric.md`
