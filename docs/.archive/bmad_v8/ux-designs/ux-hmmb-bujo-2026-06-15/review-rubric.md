# Spine Pair Review — hmmb-bujo

## Overall verdict

The spine pair is substantially complete and defensible for downstream consumers. DESIGN.md is exceptionally well-crafted — every token is defined, every component has a real spec, and the brand rationale is load-bearing prose, not decoration. EXPERIENCE.md covers the full FR matrix, all eight UJs, and has a rare asset: a 100%-coverage cross-reference table (Section 10). The pair's main weaknesses are mechanical: five of eight UJs lack a Key Flow in EXPERIENCE.md, the `imports/` directory is empty despite the decision-log referencing a scan of `My BuJo.pdf`, and a handful of component inconsistencies between the two files create small but real developer friction.

---

## 1. Flow coverage — thin

EXPERIENCE.md defines three Key Flows. PRD defines eight User Journeys (UJ-1 through UJ-8). Five UJs have no corresponding Key Flow with a named protagonist, numbered steps, climax beat, or failure path.

| UJ | PRD Title | Key Flow present? |
|---|---|---|
| UJ-1 | O Dia de Hugo | Partially — Fluxo 1 covers the Monday variant of UJ-1, but the single-step non-Monday variant (no semanal/mensal migration) has no dedicated flow |
| UJ-2 | A Semana de Hugo | No (absorbed into Fluxo 1 step 6, but without standalone coverage) |
| UJ-3 | Abertura do Mês | Yes — Fluxo 3 |
| UJ-4 | Captura Rápida no Mobile | Yes — Fluxo 2 |
| UJ-5 | Future Log | No |
| UJ-6 | Diário de Gratidão | No |
| UJ-7 | Saúde e Medicamentos | No |
| UJ-8 | Configuração de Hábitos | No |

### Findings

- **high** UJ-5 (Future Log), UJ-6 (Diário de Gratidão), UJ-7 (Saúde e Medicamentos), and UJ-8 (Configuração de Hábitos) have no Key Flow in EXPERIENCE.md §9. These surfaces have non-trivial behavioral rules (UJ-7 has a two-day review ritual; UJ-8 has weight-change semantics; UJ-6 has multiple-entries-per-day). A developer sourcing these flows has only the State Patterns tables and the FR cross-reference — correct but thin for story-level implementation guidance. (EXPERIENCE.md §9). *Fix:* Add Fluxo 4–7 covering each missing UJ. Each needs: named protagonist, numbered steps, one climax beat, one failure or error path (UJ-7 form-validation error, UJ-8 numeric habit with wrong meta, etc.).

- **medium** Fluxo 1 (EXPERIENCE.md §9) covers UJ-1 on a Monday specifically, but UJ-1 is a daily ritual — the non-Monday path (no semanal banner, no monthly banner) is the most common execution and has no flow. A developer could infer it, but the "Monday version first" precedent suggests the simpler path is what ships daily, not the edge case. *Fix:* Add a parenthetical step list for the non-Monday, non-first-week variant within Fluxo 1, or note explicitly that the Monday scenario is a superset.

- **low** Fluxo 1 failure path covers the migration picker and one save failure. No failure path is stated for UJ-3 (what if the Future Log pull returns zero items? what if the mês anterior had zero open tasks?). (EXPERIENCE.md §9, Fluxo 3). *Fix:* Add a "zero-item" failure beat to Fluxo 3 — system should confirm "Junho fechado" even if there were no pending tasks, without presenting an empty migration flow.

---

## 2. Token completeness — strong

All tokens defined in DESIGN.md YAML frontmatter have both light and dark hex pairs. No undefined token references found in prose or component specs.

**Token audit:**

- Surface tokens: `surface-base`, `surface-raised`, `surface-header` — all defined with light/dark pairs. Prose usage correct.
- Ink tokens: `ink-primary`, `ink-secondary`, `ink-disabled` — all defined. Prose references consistent.
- Border: `border-hairline` — defined. Used correctly in component table and prose.
- Category tokens: `cat-teal`, `cat-purple`, `cat-pink`, `cat-yellow`, `cat-green`, `cat-blue` — all six defined with light/dark pairs.
- Priority tokens: `priority-ui`, `priority-u`, `priority-i`, `priority-none` — all four defined with light/dark pairs.
- Brand: `brand-primary` / `fab-bg` — defined. Usage precise.
- Typography tokens: `display`, `heading`, `body`, `body-sm`, `label` — all five defined with full properties.
- Spacing: 10-step scale defined. Referenced as `spacing.N` in prose.
- Rounded: `xs`, `sm`, `md`, `lg` — four levels defined.

### Findings

- **medium** DESIGN.md §2 states: "Contraste mínimo WCAG 2.2 AA aplicado em todos os pares ink/surface" but no actual contrast ratios are cited for any pairing. The most risky combination — `ink-secondary` (#6B6359) on `surface-base` (#FDFAF4) — is used for ghost chip text and inactive nav items. This is a load-bearing accessibility claim that a developer cannot verify without running the numbers themselves. (DESIGN.md §2, Accessibility sub-section). *Fix:* Add a contrast ratio table for the four load-bearing pairings: `ink-primary/surface-base`, `ink-secondary/surface-base`, `cat-*/surface-base` (use the lowest-contrast example, likely `cat-yellow`), and `priority-i/surface-base`.

- **low** The `status-chip` component in YAML uses string expressions like `"cat-yellow + 15% opacity"` rather than a computed hex. This is intentional shorthand, but a developer implementing in MUI will need to derive the value. Acceptable if the implementation doc acknowledges this, but currently it is silently deferred. (DESIGN.md YAML frontmatter, `components.status-chip.variants`). *Fix:* Add a note in §7.5 (Status Chip) that these tint values should be computed as `alpha(token, 0.15)` using MUI's `alpha()` utility — one line prevents ambiguity.

- **low** `fab-bg` token in YAML is defined as `"#1A1612"` light / `"#EDE8E0"` dark, which inverts the ink/surface relationship (dark mode FAB is light-colored). This is intentional and consistent with the "maximum contrast" note in the spec, but no comment in the YAML explains the inversion. *Fix:* Add inline YAML comment: `# FAB inverts in dark mode — maximum contrast against dark surface-base`.

---

## 3. Component coverage — strong

**Component inventory across both spines:**

| Component | DESIGN.md Visual Spec | EXPERIENCE.md Behavioral Spec |
|---|---|---|
| Task Row | §7.1 — full anatomy, hover, padding, icon map | §4.1 — states, cycles, drag, long-press, a11y |
| Day Header | §7.2 — full spec | §4.4 — anatomy, behavior, collapse |
| Sidebar Nav Item | §7.3 — active/inactive/hover states | §4.6 — groups, collapse, tooltip |
| FAB | §7.4 — full spec | §4.5 — capture sheet, badge, position |
| Status Chip | §7.5 — all 6 variants | Referenced in §4.1 |
| Eisenhower Chip | §7.6 — all 4 variants | §4.1 — label table |
| Habit Tracker Grid/Row | §7.7 — grid anatomy | §4.3 — boolean/numeric, grouping, touch target |
| Migration Modal/Card | §7.8 — layout, 4 buttons | §4.2 — rules, keyboard, pause behavior |
| Future Log Item | — | §4.7 — anatomy, date-partial behavior |
| Health Metric Row | — | §4.8 — anatomy, fill states |
| Medication Block | — | §4.9 — anatomy, block/individual states |

### Findings

- **medium** `Future Log Item`, `Health Metric Row`, and `Medication Block` have behavioral specs in EXPERIENCE.md §4.7–4.9 but have no corresponding visual spec in DESIGN.md §7. A developer implementing these three components has behavioral rules but no token assignments — no background, border, padding, or typography tokens are specified. (DESIGN.md §7 — gap; EXPERIENCE.md §4.7, §4.8, §4.9). *Fix:* Add §7.9 Future Log Item, §7.10 Health Metric Row, §7.11 Medication Block to DESIGN.md with at minimum: padding token, typography role, and any color tokens that differentiate state (filled vs. unfilled metric field, confirmed vs. pending medication).

- **low** EXPERIENCE.md §4.1 lists `TaskAlt` as the MUI icon for "Concluída", while DESIGN.md §7.1 lists `CheckBox` for the same state. These are different icons with materially different visual semantics. (DESIGN.md §7.1 icon table; EXPERIENCE.md §4.1 states table). *Fix:* Align both documents to the same icon. `TaskAlt` (circle with check) maps more faithfully to the BuJo X symbol than `CheckBox` (square with check) — recommend `TaskAlt` as canonical; update DESIGN.md §7.1.

- **low** EXPERIENCE.md §4.1 lists `Bolt` for the "Rápida" state; DESIGN.md §7.1 lists `FlashOn`. These are effectively the same icon by different MUI names — `FlashOn` is the correct MUI v5 identifier for the bolt/lightning icon. Minor but worth aligning to prevent a developer picking the wrong one. (DESIGN.md §7.1; EXPERIENCE.md §4.1). *Fix:* Standardize on `FlashOn` in both documents.

- **low** EXPERIENCE.md §4.1 mentions "chip de categoria (se exibido)" as the secondary indicator alongside the border color, but DESIGN.md §7 never defines a "category chip" component — only the border is specified. If a category chip is a required a11y affordance, it needs a visual spec. If it is optional or not a distinct component, EXPERIENCE.md should clarify "category text label" rather than "chip". (EXPERIENCE.md §4.1 Acessibilidade note; DESIGN.md §7 — no category chip entry). *Fix:* Either add a `category-chip` entry to DESIGN.md or reword EXPERIENCE.md §4.1 to "the tooltip or aria-label on the border" as the secondary indicator.

---

## 4. State coverage — adequate

EXPERIENCE.md §5 covers the most critical surfaces with explicit state tables. Coverage is good but uneven.

**Surface-by-surface audit:**

| Surface | Empty | Cold-load | Focus/Active | Error | Offline | Permission-denied |
|---|---|---|---|---|---|---|
| Daily Log | Yes (§3.3) | Yes (§5.6) | Implicit (current-day is always focus) | Yes (§5.6 rollback) | Not covered | N/A (single-user MVP) |
| Weekly Log | Implicit (zero tasks = normal) | Yes (§5.6) | Not covered | Not covered | Not covered | N/A |
| Monthly Log | Not covered | Yes (§5.6) | Not covered | Not covered | Not covered | N/A |
| Future Log | Not covered | Not covered | Not covered | Not covered | Not covered | N/A |
| Habits | Partial (§5.5) | Not covered | N/A | Not covered | Not covered | N/A |
| Health Metrics | Not covered | Not covered | Not covered | Not covered | Not covered | N/A |
| Medications | Yes (§4.9 pending/partial/confirmed) | Not covered | Not covered | Not covered | Not covered | N/A |
| Gratitude | Yes (§3.3) | Not covered | Not covered | Not covered | Not covered | N/A |
| Brain Dump | Yes (§5.4) | Not covered | N/A | Not covered | Not covered | N/A |
| Auth | Yes (§5.7) | N/A | N/A | Yes (§5.7) | Not covered | Yes (§5.7 expired) |
| Migration Flow | Implicit (zero tasks = flow skips) | N/A | Yes (§4.2 keyboard active state) | Not covered | Not covered | N/A |

### Findings

- **high** Offline state is not covered for any surface. The PRD does not require offline-first (PWA is backlog), but the app will be used on mobile in connectivity-constrained environments (UJ-4 is explicitly "Hugo no metrô"). A developer needs to know: does the app fail silently? Show a banner? Block writes? The example spine (Drift) covers this explicitly with a Toast pattern. (EXPERIENCE.md §5 — omission across all surfaces). *Fix:* Add a §5.8 Global / Connectivity state table: offline detection → non-blocking toast (one-time); write-on-offline → behavior (queue? block? reject?). Given backlog status of PWA/offline, "block writes with inline error" is the minimum acceptable spec.

- **medium** Future Log surface has no state coverage at all in §5. Its empty state (valid — Future Log can be empty, especially at project start), cold-load state, and the "date-partial item with no day assigned" in-context state are missing. (EXPERIENCE.md §5 — no §5.x for Future Log). *Fix:* Add §5.x Future Log with: empty ("Nenhum item no Futuro."), cold-load (skeleton rows), date-partial visual treatment (already partially covered in §4.7 but should be surfaced as a state).

- **medium** Health Metrics surface has no state coverage. Given that this surface has two temporal states (day-in-review: "Ontem" fields, and day-current: "Hoje" fields), and that filling in metrics is part of the morning ritual (UJ-7 step 2), the "all fields filled" vs. "fields pending" vs. "no fields configured" states are load-bearing for implementation. (EXPERIENCE.md §5 — omission). *Fix:* Add §5.x Saúde / Métricas covering: no fields configured (empty state, prompt to Configurações > Métricas), fields pending (default state), fields complete, cold-load skeleton.

- **low** Migration Flow zero-tasks path: if UJ-1 is opened on a day where the previous day had zero incomplete tasks, the system detects no migration needed and should NOT show the banner. EXPERIENCE.md §5.1 describes the banner for "N tarefas pendentes" but does not specify behavior when N=0 (banner suppressed). A developer could over-implement and show "0 tarefas pendentes de ontem. Iniciar migração?". (EXPERIENCE.md §5.1). *Fix:* Add one row to §5.1: "Sem tarefas pendentes de ontem — nenhum banner exibido."

---

## 5. Visual reference coverage — broken

**Directory audit:**
- `mockups/` — does not exist
- `wireframes/` — does not exist
- `imports/` — exists but is empty (0 files)
- `.working/color-themes-1.html` — exists but not linked from either spine

The decision-log references a scan of `My BuJo.pdf` ("Arquivo: `imports/My BuJo.pdf` — 18 páginas") as having been imported and analyzed. The file is not present in `imports/`.

EXPERIENCE.md header note states: "Mockups ficam em `mockups/` (a produzir na fase Finalize)." This is a deliberate deferral, not an oversight.

### Findings

- **high** `imports/My BuJo.pdf` is referenced in `.decision-log.md` as the visual source for the caderno vocabulary extraction (colors, symbols, layout density) — but the file is absent from `imports/`. If that PDF informed design decisions now baked into DESIGN.md, its absence means no future contributor can audit whether the color extraction was accurate. (`.decision-log.md` §Import; `imports/` directory empty). *Fix:* Either commit `My BuJo.pdf` to `imports/`, or add a note in DESIGN.md §2 stating that the caderno scan informed the palette but the original is not retained digitally (intentional omission).

- **medium** `.working/color-themes-1.html` is an artifact in the workspace but is not linked from either DESIGN.md or EXPERIENCE.md, and is not listed in any "see also" section. A developer encountering it has no context for whether it is authoritative, exploratory, or superseded. (`.working/color-themes-1.html` — orphan). *Fix:* Either link it from DESIGN.md §2 as "exploração de paleta — ver `.working/color-themes-1.html`" or add a note to `.decision-log.md` marking it as exploratory/superseded.

- **low** EXPERIENCE.md header note defers all mockups to "fase Finalize." This is a defensible sequencing decision (experience-first, mockups after), but the note uses future tense without a trigger condition. Story-dev teams consuming this document before Finalize will have no visual composition reference. (EXPERIENCE.md, header note). *Fix:* Change the note to be explicit about what is missing and when it will be available: "Mockups serão produzidos na fase Finalize, antes de iniciar o desenvolvimento dos Épicos 1–3."

---

## 6. Bloat & overspecification — adequate

Both documents are disciplined. DESIGN.md has no pixel specs where tokens would cover it, and EXPERIENCE.md's FR cross-reference table (§10) earns its length as a genuine consumer artifact. A few areas are worth attention.

### Findings

- **low** DESIGN.md §8 (Do's and Don'ts) restates several constraints already in §5 (Elevation), §6 (Shapes), and §7 (Components) — notably the no-ripple override code snippet and the no-shadow rule appear in both §5 and §8. Duplication is mild but creates a maintenance surface where updating one may miss the other. (DESIGN.md §5, §8). *Fix:* In §8, convert restated constraints to cross-references: "Sem sombra — ver §5" rather than re-specifying.

- **low** EXPERIENCE.md §11 (Inspirações e Anti-padrões) is substantive — the caderno heritage section is load-bearing context for why certain decisions were made. The Linear and anti-pattern sections are useful. The section earns its place. No cut recommended.

- **low** EXPERIENCE.md §10 FR table is 45 rows — unusually complete for this format. This is a net positive (architecture and story-dev can map directly), but the table mixes infrastructure FRs (FR-0.x — "Fundação, infraestrutura") with UI FRs, which can create false confidence that a story has been UX-specified when it has only been acknowledged as infrastructure. (EXPERIENCE.md §10). *Fix:* Add a visual separator or sub-header in the table to distinguish "UI Surface" rows from "Infrastructure (no UX surface)" rows.

---

## 7. Inheritance discipline — strong

### Sources frontmatter

DESIGN.md `sources` references:
- `prd: "_bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md"` — file exists and matches. Correct.
- `decisions: "_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-06-15/.decision-log.md"` — file exists. Correct.

EXPERIENCE.md `sources` references:
- `prd: "_bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md"` — Correct.
- `decision-log: ".decision-log.md"` — relative path, resolves correctly within the workspace. Correct.
- `design: "DESIGN.md"` — relative path, resolves correctly. Correct.

### UJ naming

PRD uses: UJ-1, UJ-2, UJ-3, UJ-4, UJ-5, UJ-6, UJ-7, UJ-8 (plus subtitles in Portuguese).

EXPERIENCE.md Key Flows reference: "UJ-1" in Fluxo 1, "UJ-4" in Fluxo 2, "UJ-3" in Fluxo 3. Verbatim identifiers match PRD. Correct.

### Glossary consistency

BuJo vocabulary is consistent across both documents: Daily Log, Weekly Log, Monthly Log, Future Log, Brain Dump, Eisenhower, motor de migrações — same terms, same capitalization.

### Component names across files

Minor inconsistencies found (see §3 findings above): `CheckBox` vs. `TaskAlt`, `FlashOn` vs. `Bolt`. All other component names are consistent.

### EXPERIENCE.md token references to DESIGN.md

EXPERIENCE.md references DESIGN.md tokens via "ver DESIGN.md" callouts rather than inline `{token}` syntax. This is defensible — the behavioral spine correctly delegates visual details to the design spine without duplicating values. No broken references.

### Findings

- **low** EXPERIENCE.md §4.5 (FAB) specifies the icon as "`AddCircle` ou `FlashOn`" — two options without a decision. DESIGN.md §7.4 specifies `AddComment`. Three different icons for the same component across the two documents. (DESIGN.md §7.4; EXPERIENCE.md §4.5). *Fix:* Align to `AddComment` (DESIGN.md) as the canonical icon. The "captura rápida" semantic is better served by `AddComment` (implies note/capture) than `AddCircle` (generic add) or `FlashOn` (speed/bolt).

---

## 8. Shape fit — strong

### DESIGN.md section order (canonical reference: design-example-shadcn.md pattern)

Reference shape: Brand & Style → Colors → Typography → Layout & Spacing → Elevation & Depth → Shapes → Components → Do's and Don'ts.

DESIGN.md sections: Marca e Estilo (§1) → Cores (§2) → Tipografia (§3) → Layout e Espaçamento (§4) → Elevação e Profundidade (§5) → Formas (§6) → Componentes (§7) → Do's e Don'ts (§8). Canonical order matched exactly.

### EXPERIENCE.md required sections (canonical reference: experience-example-shadcn.md pattern)

Reference shape: Foundation → IA → Voice/Tone → Component Patterns → State Patterns → Interaction Primitives → Accessibility → Responsive → Inspiration/Anti-patterns → Key Flows.

EXPERIENCE.md sections: Fundação (§1) → Arquitetura de Informação (§2) → Voz e Tom (§3) → Padrões de Componentes (§4) → Padrões de Estado (§5) → Primitivos de Interação (§6) → Acessibilidade (§7) → Responsividade e Plataforma (§8) → Fluxos Principais (§9) → Rastreamento de Cobertura de Requisitos (§10) → Inspirações e Anti-padrões (§11).

All required sections present. Two additions: §10 (FR Coverage Matrix) and §11 (Inspirações e Anti-padrões). Both earn their place — §10 is a high-value downstream artifact; §11 provides decision rationale that prevents future regressions.

### Findings

- **low** EXPERIENCE.md places Key Flows (§9) before Inspirations/Anti-patterns (§11), with the FR matrix (§10) between them. The reference shape places Inspirations/Anti-patterns before Key Flows. The BuJo ordering is defensible (flows are more load-bearing than anti-patterns; the FR matrix needs to follow the flows it maps), but it breaks canonical order. Not a consumer-impact issue. *Fix:* No action required unless the team wants strict canonical compliance — the ordering choice is intentional and the content is correct.

---

## Mechanical notes

1. **Icon mismatch (3 locations):** "Concluída" icon is `CheckBox` (DESIGN.md §7.1), `TaskAlt` (EXPERIENCE.md §4.1). FAB icon is `AddComment` (DESIGN.md §7.4), `AddCircle` or `FlashOn` (EXPERIENCE.md §4.5). "Rápida" icon is `FlashOn` (DESIGN.md §7.1), `Bolt` (EXPERIENCE.md §4.1). Developer will encounter three conflicting pairs on first implementation day.

2. **Missing `imports/My BuJo.pdf`:** Referenced in `.decision-log.md` as the primary visual source. File absent. Audit trail broken.

3. **Orphan `.working/color-themes-1.html`:** Unlinked from both spines. Status (exploratory vs. authoritative) unknown.

4. **`mockups/` directory absent:** EXPERIENCE.md promises it "a produzir na fase Finalize." No mockup references exist in prose; no spine-wins-on-conflict rule is needed yet. Low risk now, but downstream architecture/story phases may begin before Finalize.

5. **EXPERIENCE.md frontmatter `sources.decision-log`:** Uses relative path `.decision-log.md`. Consistent with workspace-relative convention, but different format from DESIGN.md which uses full relative paths from repo root. Not a broken reference but creates a convention inconsistency.

6. **DESIGN.md YAML frontmatter `title` field:** Present. EXPERIENCE.md YAML `title` field: present. Both `status: final`. Both `created/updated: 2026-06-15`. Frontmatter is complete and consistent.

7. **`priority-none` reuses `cat-green` value (#4A8C5C / #6BB880):** Intentional semantic reinforcement noted in DESIGN.md §2. Not a bug. No action needed, but a developer scanning the token list may flag it as duplication — a YAML comment would prevent that question.
