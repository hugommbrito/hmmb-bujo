# Epic 15 Context: Onda 4 — Captura no Sistema Novo

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Migrate the Brain Dump surface (inbox + manual processing), the shell's persistent capture badge, and the mobile Capture Sheet to the new design system/shell, while preserving the existing server state model, optimistic UI, and connectivity behavior proven in earlier waves. This epic proves the Inbox pattern and mobile capture on the new foundation — Brain Dump is the product's "escape valve," especially on mobile, so continuity of behavior matters more than visual novelty.

## Stories

- Story 15.0: [UX] Mockup da captura e do Brain Dump (x.0 — gate do épico)
- Story 15.1: Brain Dump no sistema novo (inbox + processamento)
- Story 15.2: Capture Sheet e captura persistente no sistema novo
- Story 15.3: Passe de paridade, estados e acessibilidade da captura

## Requirements & Constraints

- Brain Dump is a dateless, no-required-destination inbox; its normal/healthy state is empty ("Brain Dump vazio." — one sentence, never an incentive to add content).
- Each item has a required title, optional description, and optional destination log hint (`target_log`); the hint never auto-places the item.
- Items are processed manually only — moved to the correct log (creating the Task there) or discarded. No auto-migration, no suggested destination, no AI, no categories/priority/tags/filter/search/manual ordering; the item has no task state machine.
- Discard executes immediately with no confirmation dialog and no undo (deliberate legacy parity).
- A persistent visual indicator (badge) must be shown whenever Brain Dump has pending items, until it's empty; must remain accurate and keyboard/screen-reader accessible.
- Mobile rapid capture is a first-class use case: title-only capture must be completable in a few taps/seconds while away from desktop, with no planning/migration expected in that flow.
- Item editing is now in scope (new in this wave, decided at the 15.0 gate — see Cross-Story Dependencies): the item gains parity-level editing (title, description, destination) via a new update endpoint, not just create/list/process/discard/count.
- Full behavioral parity with the legacy Brain Dump surface (actions, states, shortcuts, feedback) is required; any unavoidable divergence must be explicitly documented rather than silently dropped.

## Technical Decisions

- Any frontend state whose source of truth is the backend (the Brain Dump badge is the anchor case) must be server state derived via TanStack Query, never a client store; mutations invalidate the corresponding query key rather than manually incrementing/decrementing counts. Ephemeral UI state (modals, selection) stays in Context/local state, never mixed with server state. `userId` is part of every such query key; `queryClient.clear()` runs on logout.
- The badge is powered by a lightweight count endpoint with query key `['brainDump','count',userId]`; every mutation (capture, process, discard, edit) invalidates this key. Capture is optimistic on the count, with rollback on write failure. The item list and the badge count are independent sources — one can fail while the other keeps working.
- A backend update endpoint was required before Story 15.1 could deliver item editing and is now **implemented**: `PATCH /api/brain-dump/items/{id}/` accepts `title`/`description`/`target_log` (`BrainDumpItemDetailView.patch`). (Stale note, kept for history: this file originally compiled before the endpoint existed, when the domain only supported create/list/process/discard/count.)
- Processing should also accept an optional `scheduled_date` for the `week`/`month` destinations (contracted at the API level but never exercised by the legacy UI — a known, intentional parity divergence to log explicitly in Story 15.3, not silently resolve).
- Existing legacy contract to preserve: routes `GET/POST items/`, `DELETE items/{id}/`, `POST items/{id}/process/`, `GET count/`; fields `id`, `title` (max 500), `description`, `target_log` (`today|week|month|future`/null), `created_at`; list ordered by `created_at`; destinations `today·week·month·future` (`future` requires `month_first` after the current month; `month` resolves current month server-side); processing creates the Task and deletes the item; discard deletes with no confirmation/undo.
- Multi-tenant isolation is authoritative at the application layer (tenant-scoped manager, fail-closed) — applies to any new endpoint/query added here.

## UX & Interaction Patterns

- Brain Dump is the only surface using the **Inbox** page pattern: no Page/Period Header stepper/cycle-status/period-selector. Fixed reading order: Panel **Capturar** → Section Header **Pendências** (with count) → Item Row list.
- Item Row uses the Brain Dump variant: title, one-line-truncated description, neutral left border (no category, no Eisenhower, no status icon — the item has no state machine), capture-date meta, optional destination-hint chip. Trailing has two always-visible actions (Mover, Descartar) on pointer; on compact, the whole row is the touch target and actions move into an item sheet.
- The shell's persistent capture control (nav on wide/medium/tablet, FAB on compact) opens a **Capture Sheet** (Dialog/Sheet variant) that never navigates: closes and returns focus to whatever triggered it, even from the Brain Dump page itself. Initial focus on Título; `Enter` saves; after capture, Título clears and refocuses for the next entry.
- **Mover** reuses the migration ritual's destination selector with a `radiogroup` of four destinations (Hoje/Esta Semana/Este Mês/Futuro) instead of tabs; Futuro uses native `input type="month"` and rejects the current month. Confirming creates the Task and removes the row; count and badge drop together, no toast.
- New this wave: the item gains parity editing via a sheet with the same three fields, pre-filled. Save is non-optimistic (row updates only after server confirmation, unlike the count). Closing the Capture Sheet with a filled title always prompts "Descartar item?"; the edit sheet only prompts "Descartar alterações?" on unsaved changes vs. the loaded value (not merely on text present, since an existing item always has text). Both default focus to "Continuar editando"; `Escape` never discards.
- State contract: badge hidden at 0/loading/error while nav/capture stay functional; shows literal count 1–9, `9+` above, exact count in accessible name. Offline disables capture/item actions with reason in accessible name; no local queue or deferred-send. Loading preserves shell/header/capture with a 5-row skeleton; read errors sit by the list with local retry, not blocking capture; writes preserve the entry and show "Salvando…" (`aria-busy`), duplicate submit blocked.
- Reference mockup: `mockups/key-brain-dump.html` in the 2026-07-17 UX workspace (status: final), which supersedes the 2026-06-15 workspace (marked legacy).

## Cross-Story Dependencies

- Depends on Epic 13 (new shell): the persistent capture control/badge placement in the shell (Story 13.3, "Bottom-nav e captura persistente mobile") is the anchor Story 15.2 wires the Capture Sheet into.
- Story 15.0 (UX gate) is done and promoted into DESIGN.md/EXPERIENCE.md (2026-07-17 workspace). During that gate, question Q1 ("does the item expose editable fields?") was resolved as **yes** — reversing the original handoff's "no editable fields" assumption. This added item editing to Story 15.1's scope and created a new architecture obligation, documented as **M11 — Brain Dump/Captura** in `architecture-and-story-handoff.md`.
- **M11 status (verified against code, not just docs):** **implemented** as of Story 15.1 — `PATCH /api/brain-dump/items/{id}/` exists (`BrainDumpItemDetailView.patch`, `backend/braindump/views.py`), accepting partial `title`/`description`/`target_log`, plus real `scheduled_date` handling for `week`/`month`/`future` destinations on `POST .../process/`. (Stale note, kept for history: at the time this context file was first compiled, the endpoint did not yet exist and was tracked as a blocking prerequisite for Story 15.1 — that gap is closed.)
- Story 15.1 requires the existing server-state contract (query keys, invalidation, optimistic-count-with-rollback) to be preserved unchanged — no new client-side state introduced.
- Story 15.3 is the wave's closing parity/accessibility gate and depends on 15.1 and 15.2 being functionally complete; it must explicitly log the `scheduled_date` parity divergence (contracted but never exercised by the legacy UI) rather than silently resolving it, and must remove the legacy capture route from active use only after parity is demonstrated.
