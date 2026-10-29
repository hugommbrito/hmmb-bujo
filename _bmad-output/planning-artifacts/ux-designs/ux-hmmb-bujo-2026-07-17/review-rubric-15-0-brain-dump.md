# Spine Pair Review — hmmb-bujo

## Overall verdict

The spine pair is mechanically sound and unusually rigorous for a brownfield migration: canonical section order is exact, sources resolve, state coverage is exhaustive, and cross-doc anchors check out against GitHub's slug algorithm. The pre-existing 13.0/14.0 content holds up to the prior review round. The newly promoted Brain Dump material is largely faithful to its handoff and reconciliation trail, but it introduced two broken token references and dropped two Hugo-decided fidelity items (Q6 copy, Q7 control-type) between the decision log and the committed spine text — plus one component-catalog table that wasn't updated to match its DESIGN.md sibling. None of this blocks architecture from starting, but the broken references and the missing table row should be fixed before a story-dev consumer literally resolves `{path.to.token}` against the frontmatter.

## 1. Flow coverage — Adequate

Checked: extracted UJ-1–UJ-8 from the "Rastreabilidade UJ e aliases" table (EXPERIENCE.md:599-608) and matched each against the 8 Key Flows (EXPERIENCE.md:628-708), verifying protagonist, numbered steps, a climax beat, and a failure path. Gave Flow 3 (the Brain Dump-mapped flow, UJ-4) extra scrutiny.

### Findings
- **medium** FR-5.3 (processamento manual: Mover/Descartar) and the Q1-added item-edit capability have no dedicated Key Flow — only capture into the inbox is walked through end-to-end (Flow 3, EXPERIENCE.md:651-656). The interaction rules exist in Component Patterns/State Patterns prose, but no narrative anchors the Mover round-trip, Descartar, or edit-and-save sequencing the way Flow 1/2/5 anchor their rituals. (EXPERIENCE.md:367-377, 651-656). *Fix:* add a short Key Flow (or extend Flow 3) walking a capture → Mover-to-destination or capture → edit round-trip.
- **low** Flow 3 folds its failure case into step 3 ("Salva; em falha, o texto permanece e retry fica disponível") instead of the standalone "Falha:" paragraph every other flow uses (Flows 1, 2, 4, 5, 6, 7, 8 all have one). No content is lost, but the shape is inconsistent. (EXPERIENCE.md:651-656). *Fix:* pull the failure sentence into a trailing "Falha:" line to match the other seven flows.

## 2. Token completeness — Adequate

Checked: extracted every frontmatter token in DESIGN.md (8 color palettes, 6 typography roles, 5 rounded scales, 9 spacing steps, 20 component entries) and every `{path.to.token}` reference in both files' prose (85 unique paths in DESIGN.md, 14 in EXPERIENCE.md), then verified each resolves against the literal YAML structure.

### Findings
- **critical** `{workspace.reading-width}` (DESIGN.md:668) and `{task-row.min-height-touch}` (DESIGN.md:670) do not resolve. The frontmatter has no top-level `workspace` or `task-row` key — both live under `components.workspace.reading-width` (DESIGN.md:358-362) and `components.task-row.min-height-touch` (DESIGN.md:395-404). Both broken refs sit inside the new Brain Dump (Inbox) section; the correct prefixed form `{components.workspace}` is used one clause earlier in the very same sentence (DESIGN.md:668), confirming this is a dropped-prefix slip, not an alternate convention. `components.task-row.*` is never referenced correctly anywhere else in either file. *Fix:* prefix both with `components.` — `{components.workspace.reading-width}` and `{components.task-row.min-height-touch}`.
- **low** `rounded.xs` (2px, DESIGN.md:298) is defined but never referenced by path anywhere in either file; the Shapes section only states the aggregate range "2–8px" in prose (DESIGN.md:502), which covers `xs` implicitly but leaves no explicit consumer. *Fix:* cite `{rounded.xs}` at whatever component actually uses 2px, or fold it into `rounded.sm` if nothing does.

## 3. Component coverage — Adequate

Checked: diffed DESIGN.md's "Catálogo bilateral canônico" (31 rows, DESIGN.md:508-541) against EXPERIENCE.md's "Component Patterns" table (30 rows, EXPERIENCE.md:104-136), confirming every DESIGN.md row has a matching behavioral row and vice versa.

### Findings
- **medium** "Brain Dump (Inbox)" has a row in DESIGN.md's catalog (DESIGN.md:541) but no matching row in EXPERIENCE.md's Component Patterns table, which ends at Archive History (EXPERIENCE.md:136). The behavioral spec does exist, as the "Brain Dump e captura" subsection (EXPERIENCE.md:367-377), but a consumer scanning the Component Patterns table — the rubric-mandated cross-reference surface, and the one every other cataloged component uses — won't discover it there. *Fix:* add a "Brain Dump (Inbox)" row to EXPERIENCE.md's Component Patterns table pointing at the subsection, matching how Weekly Board/Monthly Board/Archive History etc. are each represented both in the DESIGN.md catalog and the EXPERIENCE.md table.

## 4. State coverage — Adequate

Checked: walked every Brain Dump surface (Inbox list, Capture Sheet, destination selector, item edit sheet, shell badge) against empty/cold-load/focus/error/offline/saving/disabled, using EXPERIENCE.md's State Patterns table (EXPERIENCE.md:409-452) and the Brain Dump prose (EXPERIENCE.md:367-377), cross-checked against the source handoff's own state matrix (imports/story-15-0-brain-dump-handoff/story-15.0-brain-dump.md §5).

### Findings
- **medium** The item edit sheet's save path is unspecified. EXPERIENCE.md:373 documents the discard-confirmation path (closing with unsaved text) in detail but never states what happens after a *successful* save — does the sheet close, does the list row update in place, is there a "Salvando…"/`aria-busy` state analogous to the Capture Sheet's? The Capture Sheet's full save lifecycle is fully specified (Fluxo 3; O1/O2 in the handoff); the parallel edit lifecycle — a Q1 decision added mid-promotion — is not. *Fix:* add one sentence stating the edit sheet's post-save behavior, mirroring the Capture Sheet pattern.
- **medium** The Q6-decided replacement copy "Fica no Brain Dump até ser processado." — recorded as adopted in `.memlog.md:14` and `reconcile-story-15-0-brain-dump.md:29` — was never actually written into DESIGN.md or EXPERIENCE.md; it is absent from both files (verified by search). The Voice and Tone table (EXPERIENCE.md:92-98) lists other verbatim microcopy ("Brain Dump vazio.", etc.) but not this string, and the Brain Dump section only describes the dica de destino functionally ("aparece como dica textual", EXPERIENCE.md:371) without giving the actual sentence. A consumer building the UI has no committed source for this copy inside the spine itself — only in the decision log. *Fix:* add the decided string to the Voice and Tone table or inline in the Brain Dump section.

## 5. Visual reference coverage — Adequate

Checked: listed every file under `mockups/` (8 HTML), `imports/mybujo-full-handoff/` (9 wireframes + JS/fonts/README), and `imports/story-15-0-brain-dump-handoff/` (4 markdown files); confirmed each is linked from both spines; checked for orphans and unspecific references; confirmed `.working/key-brain-dump.html` does not yet exist.

### Findings
- **low** `mockups/key-migracao.html` and `mockups/key-recorrentes.html` are linked inline at their DESIGN.md sections (DESIGN.md:664, 656) but EXPERIENCE.md only links them from the legacy-wireframe-substitution table at the bottom (EXPERIENCE.md:588-589) — not inline in the "Migração e Catch-Up" (EXPERIENCE.md:359-365) or "Recorrentes" (EXPERIENCE.md:349-357) sections themselves, unlike Weekly/Monthly/Future Log/Archive, each of which carries a "→ Composição e estados aprovados" callout in-section. Not an orphan — both mockups are linked twice each — just not where a reader would look first. *Fix:* add the same inline callout line to those two sections.
- **low** `imports/story-15-0-brain-dump-handoff/` is linked only at directory level from DESIGN.md (DESIGN.md:674); the four individual files inside (story-15.0-brain-dump.md, traceability.md, design-system-delta.md, open-questions.md) aren't named or distinguished inline in either spine — a reader has to open the directory's own README.md to learn which file covers what. EXPERIENCE.md does link the primary spec file directly (EXPERIENCE.md:377). *Fix:* optional — the directory's README already does this job adequately, so treat as low priority.
- **note, not a finding** `.working/key-brain-dump.html` does not exist yet (confirmed via directory listing). Per task framing this is pending/in-progress work by a concurrent process, not a gap in the spine pair.

## 6. Bloat & overspecification — Adequate

Checked: scanned for pixel specs duplicating tokens, restated source content, and repeated boilerplate.

### Findings
- **low** The "spine wins on conflict" precedence statement is restated 9 times in DESIGN.md and 7 times in EXPERIENCE.md — once per mockup/handoff reference — on top of the same statement already appearing in each file's opening blockquote (DESIGN.md:428, EXPERIENCE.md:22). Harmless but adds no information per repetition; the rubric calls for stating it once. *Fix:* keep the top-level statement as the single authority and shorten individual mockup-link lines to a bare link, or at minimum stop repeating the full sentence every time.

## 7. Inheritance discipline — Adequate

Checked: verified all `sources:` frontmatter paths resolve on disk (11/11 across both files), verified EXPERIENCE.md's `{path.to.token}` references resolve to DESIGN.md tokens by name, and verified the seven Q1–Q7 handoff decisions in `imports/story-15-0-brain-dump-handoff/open-questions.md` actually landed in the committed spine text rather than only in the decision log.

### Findings
- **medium** Q7's decision — "manter o controle nativo (input month)" for the Futuro destination's month field, resolved by Hugo per `open-questions.md:11` and `.memlog.md:13` — is not stated anywhere in DESIGN.md or EXPERIENCE.md. The Futuro tab of the destination selector (EXPERIENCE.md:371, DESIGN.md:672) describes the `future`/`month_first` contract but not the control type, even though this decision was specifically an accessibility-vs-locale tradeoff that overrides the project's usual pt-BR-native-select convention. *Fix:* add "input month nativo" (or equivalent) next to the existing `radiogroup`/`grid` ARIA notes in DESIGN.md's Brain Dump section.
- Cross-reference only, not double-counted in severity totals: the Component coverage gap in §3 (Brain Dump missing from EXPERIENCE.md's Component Patterns table) is also an inheritance-discipline symptom — DESIGN.md and EXPERIENCE.md's component catalogs briefly diverged during promotion.

## 8. Shape fit — Strong

Checked: DESIGN.md section order against the canonical 8-section order; EXPERIENCE.md's required-default sections and any additional sections against the "earns its place" bar.

### Findings

None. DESIGN.md follows Brand & Style → Colors → Typography → Layout & Spacing → Elevation & Depth → Shapes → Components → Do's and Don'ts exactly (DESIGN.md:430, 444, 475, 481, 496, 500, 504, 727), with no gaps or reordering. EXPERIENCE.md carries all eight required-default sections (Foundation, Information Architecture, Voice and Tone, Component Patterns, State Patterns, Interaction Primitives, Accessibility Floor, Key Flows) plus Responsive & Platform, Migration Strategy, UX Acceptance Criteria, Decisions for Architecture and Stories, and Inspiration & Anti-patterns — all justified by the brownfield-migration nature of this project (rollout waves, legacy reconciliation, explicit downstream obligations to architecture). No invented section reads as decorative.

## Mechanical notes

- **Broken token references** (critical, restated from §2): `{workspace.reading-width}` and `{task-row.min-height-touch}` in DESIGN.md:668/670 must become `{components.workspace.reading-width}` / `{components.task-row.min-height-touch}`.
- **Sources frontmatter**: all 11 unique paths across both files' `sources:` blocks were resolved on disk and exist. The DESIGN.md/EXPERIENCE.md asymmetry (`addendum.md` and `sprint-status.yaml` appear only in EXPERIENCE.md's sources) is deliberate and explained inline in both files (DESIGN.md:473, EXPERIENCE.md:40) — not a defect.
- **Internal cross-doc anchors**: every `architecture-and-story-handoff.md#mNN--...` link used in EXPERIENCE.md's "Decisions for Architecture and Stories" table (EXPERIENCE.md:569-575) was hand-verified against GitHub's slug algorithm (em-dash stripped, spaces collapsed to hyphens) and resolves correctly, including the newly added `#m11--brain-dumpcaptura` pointing at `architecture-and-story-handoff.md:53`.
- DESIGN.md:684 references "M09" as bare text with no hyperlink, where EXPERIENCE.md consistently hyperlinks its M06–M11 cross-references elsewhere. Cosmetic only.
- No Mermaid diagrams appear in either file — nothing to validate there.
- Component naming is consistent between DESIGN.md's catalog and EXPERIENCE.md's Component Patterns table for every entry except the one gap noted in §3 ("Brain Dump (Inbox)").
- Frontmatter completeness: DESIGN.md's `colors` block carries full light/dark pairs for all four families (Mineral, Horizonte Azul, Bosque Sálvia, Ameixa Editorial) with structurally identical token sets per palette (~29 tokens × 8 palettes); spot-checked, no missing hex values found.
