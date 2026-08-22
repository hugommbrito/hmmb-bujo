# Handoff: BuJo Digital — Full App Wireframes

## Overview
BuJo Digital is a single-user desktop web app — a dashboard adaptation of the Bullet Journal (BuJo) methodology. This package bundles **lo-fi wireframes for the entire app**: Daily Dashboard, Weekly View, Monthly & Future Log, Migration Ritual (cycle closure), Recurrents Engine, Habits Tracker, Gratitude Journal, Health Tracking, and Analytics Dashboard.

## About the Design Files
All bundled HTML/JS files are **design references**, not production code. They share one lo-fi "wireframe" visual language (sketchy accents, boxes-and-labels, paper/ink palette) purely to communicate structure, content, and interaction — not final visual design. Each file also ships a toggleable **annotation layer** (numbered pins + a floating legend explaining every region's purpose) for design review; **do not port the annotation system, toolbar, or paper/notebook chrome into the product** — only the actual screen content below the toolbar matters for implementation.

The task is to **recreate each screen's structure and behavior inside the existing BuJo Digital codebase**, using its real component library, styling system, and state management — not by porting this HTML/CSS as-is. Restyle everything with the target app's actual design system; treat colors/type/spacing here as placeholders standing in for real ones.

## Fidelity
**Low-fidelity (lofi) wireframes throughout.** Boxes, labels, and illustrative sample data. Layout structure, navigation, component composition, and the interaction/state logic documented per screen below ARE intentional and should be preserved; visual styling (colors, fonts, shadows, border weights) is a wireframe placeholder only.

## Shared app shell (every screen)
- **Left icon rail** (78px wide): logo + nav items — Daily (sun), Weekly (week grid), Monthly (calendar), Recurrents (repeat), Habits, Gratitude (heart), Health. Active screen highlighted (dark fill, white icon). Screens link to each other via these icons.
- **App frame**: bordered card (2.25px border, 16px radius, drop shadow) containing rail + main content, centered on a lined-paper background — wireframe chrome only, discard in the real app.
- **Region pattern**: every content block is a bordered white card with a small uppercase label tag at the top-left corner (wireframe annotation only).
- **Priority system** (consistent across all screens — this IS real product logic, keep it):
  - Pink `#e0559b` (some screens use Red `#d6453c` for this slot — see per-screen note) — Urgent + Important
  - Purple `#8b5cf6` (or Orange `#e07b1a`) — Urgent only
  - Yellow `#dca200` — Important only
  - Green `#3aa861` — Neither / Personal
  - Note: Daily/Weekly/Monthly/Habits/Health/Analytics wireframes use **Red/Orange/Yellow/Green**; Recurrents Engine and Migration Ritual use **Pink/Purple/Yellow/Green**. Reconcile to one 4-color set in the real design system — treat Pink+Purple and Red+Orange as the same two semantic slots (Urgent+Important, Urgent-only).
- Fonts: **Sora** (400/500/600/700, self-hosted) for UI text, **Architects Daughter** (Google Font) for hand-written-style annotative/muted labels, captions, and status text.

---

## Screen 1 — Daily Dashboard
**Purpose:** The single-day working surface — today's tasks, productivity scoring, habits snapshot, gratitude.
**Two layout variants** (tab-switchable in wireframe — pick one for production, or keep as a user preference):
- Layout A: task list + score band full-width, habits/gratitude sidebar below-right.
- Layout B: task list + sidebar (score rail, habits, gratitude) side-by-side.

**Components:**
- **Header**: weekday + full date + week number, optional small liturgical-calendar line, prev/next day nav, "Today" button, CTA to Weekly View.
- **Productivity score widget**: Morning / Afternoon / Night, each scored 0–10 **or marked N/A** (explicitly "chose not to be productive" ≠ scored 0). Current period highlighted; daily average shown.
- **Task list (main working surface)**: manually numbered (renumbered each morning), drag-to-reorder, priority dot, status (open / doing "half-filled box" / done "check" / migrated "→" / cancelled "×"), optional tag, and an **origin badge** on every task — `migrated` / `recurrent` (+ frequency) / `+ new` — reflecting how it got there. Quick-add row at bottom. A priority + status + origin key/legend belongs in the UI (as a hover legend or settings help, not literal on-screen key).
- **Daily ritual gate**: when the day's setup ritual hasn't run yet, the task list is locked/veiled behind a CTA card: "Score yesterday" → "Pull in recurrents (auto)" → "Number & prioritize today's tasks", plus (Mondays only) a link out to the separate Migration Ritual screen. Two actions: "Begin daily ritual" / "Skip just for today". This is intentional friction, mirroring the Migration Ritual pattern but lighter — never auto-completed.
- **Habits snapshot** ("Tous les Jours"): ~12 daily habits, two-column checklist, live "n / 12" count + progress bar, link to full Habits Tracker.
- **Gratitude snapshot**: today's freeform entries (quote-style), count, inline quick-add, link to full Gratitude Journal.

**Interactions:** toggle daily-ritual-pending state; task checkbox cycles open→doing→done (click); drag-reorder tasks; quick-add; habit checkboxes toggle; gratitude quick-add. Score sliders are 0–10 with an N/A toggle per period.

---

## Screen 2 — Weekly View
**Purpose:** Plan and review the current week; entry point to the weekly Migration Ritual.
**Components:**
- **Week header**: Mon–Sun date range, "this week" chip, **week-of-month** and **week-of-year** indicators (rule: a week belongs to whichever cycle its **Sunday/last day** falls in — so a week containing the 1st of the next month/year counts as week 1 of that next cycle; each cycle's last week is its last **whole** week), quick stats (tasks / done / % complete), prev/next week nav.
- **Weekly ritual banner** (Monday, when pending): "N of M unfinished tasks from last week still need a decision. The week stays locked until the migration ritual is done." CTA links out to the **Migration Ritual screen** (its own page now, not an inline panel).
- **Weekly grid**: 7 day-columns (Mon→Sun, weekend columns narrower), each showing day label+date, today-highlight, a compact M/A/N productivity score strip, compact task rows (priority dot, title, recurrence icon, status mark), and a per-day quick-add. Tasks drag between day columns to reschedule within the week.
- **Sidebar cards**: Week score (avg of all scored periods + N/21 periods scored), Week intention (freeform goals not tied to a day, with add), Recurrents injected this week (auto list + link to Recurrents Engine), Jump-to nav (Daily / Monthly / Future Log).

**Interactions:** drag tasks between day columns; per-day quick-add; ritual banner links to Migration Ritual; sidebar goal add.

---

## Screen 3 — Monthly & Future Log
Two tab-switched views in one screen.

### 3a. Monthly Log
- **Month header**: month/year, prev/next, "this month", link to Future Log.
- **Month summary stats band**: productivity avg, tasks completed/total, habits completion %, monthly goals met — each with a mini progress bar.
- **Monthly calendar**: traditional 6×7 grid (Mon-start), each day cell shows day number + up to 3 colored item dots (+N overflow), today highlighted, **click a day → opens Daily Dashboard for that date**.
- **Monthly intention card**: freeform start-of-month note + end-of-month review note (empty state placeholder until written).
- **Monthly collection list**: items not yet pinned to a specific day, grouped into **Events** (◇ marker) / **Tasks** / **Goals-Intentions**, each with priority dot + optional date chip + status. **Drag onto a calendar day to schedule.** Quick-add at bottom.

### 3b. Future Log
- **Header**: title + subtitle explaining these are items parked via "Schedule → Future Log", reviewed and pulled in when the month arrives; toggle back to Monthly Log.
- **Year-ahead strip**: 12-month row showing item count per month, current month highlighted, past months dimmed.
- **Future months list**: one collapsible block per upcoming month (open by default for near months), each item row shows kind (event/task/goal) and **scheduling granularity** — a blue "date chip" (pinned to a specific day, will surface in daily/weekly logs) vs. a dashed "no date" chip (lives at month-level only). Both originate from a Schedule action offering a date-picker or month-picker. Per-month quick-add.

**Interactions:** tab switch Monthly↔Future; calendar day click → daily dashboard; drag collection items onto calendar days; collapse/expand future months.

---

## Screen 4 — Migration Ritual (cycle closure)
*(Full detailed spec already delivered separately — see `design_handoff_migration_ritual/README.md` in this same project for the exhaustive breakdown. Summary below for completeness.)*

Three tab variants — Daily / Weekly / Monthly — each closing one period and opening the next. Core rule: every **incomplete** task from the closing period needs an explicit decision (Migrate / Schedule / Cancel) before the cycle can close; **recurrents** auto-inject with no action needed; a **pool** column (weekly/monthly/future log items not yet assigned) is optional to pull in (Include / Schedule). Header shows Closing→Opening periods, a live progress bar ("X of Y resolved"), and a status pill. A destination zone shows resulting chips (recurrent vs. migrated/included) with a live counter. Footer: Save draft / warning-or-ready message / Close button disabled until all incomplete tasks are resolved.

This screen is reached from the daily ritual gate (Mondays) and the Weekly View ritual banner (and analogously the Monthly Log at month-end) — **it is a modal-like full ritual screen, not an inline panel**, per the latest design direction.

---

## Screen 5 — Recurrents Engine
**Purpose:** Manage the library of recurring tasks that auto-inject into daily/weekly/monthly logs, and preview/audit their injections.
**Components:**
- **Header**: title, subtitle, a "synced" status pill (green pulse dot + count) confirming the engine ran.
- **Tabs**: likely Daily / Weekly / Monthly / Yearly recurrence scopes (tab bar with counts per tab).
- **Two-column layout**: main list (left, wider) + injections/history sidebar (right).
- **Recurrents list**: each row = priority dot, title + meta line (category tag etc.), a **pattern display** — day-of-week chips (M/T/W/T/F/S/S, "on" days filled dark) for weekly patterns, a time-of-day pill (morning/evening icon), or plain pattern text for monthly/yearly — plus a category tag and hover-revealed edit/delete tools.
- **Inline add/edit form**: opens as a highlighted (blue-bordered) panel — title field, optional description, priority picker (radio-style colored chips), a type segmented control (daily/weekly/monthly/yearly), a day-picker (bigger day chips) for weekly, a time-of-day picker, save/cancel actions.
- **Injections preview panel** (sidebar): grouped by destination period, each showing the injected task with a checkbox-style status and a "when" timestamp; a link to view the full period.
- **Injection history table**: columns date / task / result badge (✓ injected, — skipped, ✕ missed, pending) — an audit trail proving the engine ran without manual action.

**Interactions:** tab switch by recurrence scope; open add/edit form; toggle day-of-week / time-of-day pickers; hover row reveals edit/delete; history table is read-only.

---

## Screen 6 — Habits Tracker
**Purpose:** Full habit-tracking surface ("Tous les Jours" — daily habits), primary = today's checklist, secondary = month-long history grid.
**Components:**
- **Header**: title + month nav (prev/next, showing "today" sub-label).
- **Today widget (primary, large)**: two-column checklist of all ~12 habits (big tappable checkbox + name + category tag + current streak flame-icon count), paired with a **completion summary card** (big "N / Total done today", progress bar, checked/open/N-A breakdown).
- **Monthly grid (secondary)**: rows = habits, columns = days 1–30 (horizontally scrollable), cell states: filled=done, empty-outlined=missed, hatched=N/A, dashed=future/not-yet-tracked, bold-outline=today-pending. Row hover reveals drag-handle (reorder) + edit/delete. Right-edge per-habit totals: done/tracked, completion rate %, best-ever streak. Footer row: per-day completion count across all habits. Today's column is boxed/tinted down the whole grid. Header actions: Reorder, Add habit.
- **Summary stats row** (4 cards): overall monthly score %, best streak (habit name + day count), perfect-days count, top-consistency ranking (mini bar list of top habits by rate).

**Interactions:** today-checklist tap toggles done; month nav; grid horizontal scroll; row-hover reveals drag/edit/delete; add habit.

---

## Screen 7 — Gratitude Journal
**Purpose:** A calm, low-density daily gratitude log — primary action is composing an entry; secondary is browsing past days.
**Components:**
- **Header**: title + reflective subtitle, live "N entries today" count pill, date stepper (prev/next day, calendar-jump label) defaulting to today.
- **Compose box (primary, most prominent element)**: large free-text area with placeholder prompt, ⌘Return / "Add entry" button to commit.
- **Today's entries list**: chronological (newest at bottom, nearest the composer), each row = timestamp + text + hover-only edit/delete tools.
- **Insights widget** (compact, secondary): current streak (consecutive days with ≥1 entry), total entries logged, average per day.
- **Past entries browser**: scrollable reverse-chronological list, grouped into day-blocks (date header + entry count + that day's entries); the most recent past day can expand all entries, older ones truncate to one line with an "open" action that jumps that day into the main editor; infinite-scroll-style "loads more" cap at the bottom. A small date-jump stepper sits in this panel's header too.

**Interactions:** compose + submit new entry; edit/delete on hover; expand/collapse day blocks; "open" a past day into the editor; scroll to load older days.

---

## Screen 8 — Health Tracking
**Purpose:** Intermittent fasting + weight/body-composition data journal, with monthly/annual trend review.
**Components:**
- **Header**: title + subtitle, date stepper (defaults to today) — daily-entry panels write to whichever date is selected.
- **Daily entry, 2-column (primary)**:
  - **Fasting log**: protocol chip picker (16:8 / 18:6 / 20:4 / custom, single-select), fast-start time + eating-window-opened time fields, an auto-calculated **duration readout** (large number + donut progress ring showing % of goal + Completed/Ongoing status badge), and a **7-day sparkline** (filled bar = met goal, outlined = short).
  - **Weight & body composition**: weight (kg) + body-fat % as core required fields; muscle mass % and visceral fat level as optional fields; an auto-computed, read-only BMI field (calculated from weight+height). Shows yesterday's entry inline for reference (with delta e.g. "−0.2 kg"). One "Log today's data" button commits.
- **Monthly trend chart (full width)**: dual-axis line chart — weight (kg, left axis, solid line) + body-fat % (right axis, dashed line) across the current month; future days shaded; points clickable to open that day's entry; mini-stat footer (min/max/avg/change for weight, body-fat point change).
- **Annual trend + Fasting history (50/50 row)**:
  - Annual: same dual-series line chart, smaller, monthly averages across the year, with a year stepper.
  - Fasting history: 30-day bar chart (filled=goal met, outlined=short), a dashed average-line overlay and a faint goal-threshold line; mini-stats (days met goal, 30-day avg).
- **Summary stats row** (4 cards): weight vs. start-of-year (delta + direction), longest fasting streak (consecutive goal-met days), 30-day average fast duration + hit-rate, body-fat trend (Improving/Stable/Worsening + mini sparkline).

**Interactions:** protocol chip select (single-select); date stepper; chart point click opens that day's entry; log-today button; month/year chart steppers.

---

## Screen 9 — Analytics Dashboard
**Purpose:** Cross-cutting review dashboard — productivity, tasks/migration, habits, correlations — over a selectable date range.
**Components:**
- **Header + sticky controls bar**: date-range segmented control (e.g. 7d/30d/90d/custom), a "custom range" indicator chip; the controls bar stays sticky below the toolbar while scrolling.
- **KPI row**: 6 cards (one styled "dark"/highlighted) — headline numbers with up/down delta indicators (colored green=good/red=bad) and a short caption; one card uses a flame icon (streak-related).
- **Chart regions** (multiple, each with a legend-keys row — some legend keys are **click-to-toggle series** on/off):
  - Productivity trend: multi-series line chart (Morning/Afternoon/Night + average), with a shaded "N/A" band for unscored periods, toggleable series legend.
  - Task/migration funnel: horizontal stacked funnel bars (e.g. New → Done / Migrated / Cancelled) with % + colored segments and a label column.
  - Habit consistency: horizontal bar list, one bar per habit, % complete, sorted.
  - Streak leaderboard: ranked card list (rank badge, habit name, flame + streak count), top entry visually emphasized.
  - Correlation/insight chart: scatter plot with a dashed trend-fit line, plus a callout note box (dashed border) with a plain-language insight sentence referencing the correlation.
- **Footer actions**: contextual note (e.g. data range summary) + action buttons (export, etc. — implement per product needs).

**Interactions:** date-range segmented control switch; legend-key click toggles a chart series visibility; scatter/points show tooltips on hover.

---

## Design Tokens (wireframe placeholder values — restyle with real brand tokens)
- Backgrounds: paper `#eceae4`, card/box `#ffffff`, fill `#dedbd3`, fill-2 `#e8e6df`
- Ink: `#2c2a26` (primary text), `#6f6c64` (soft), `#a6a299` (faint)
- Lines: `#9b978d` (line), `#cbc8c0` (line-soft)
- Priority/semantic: red `#d6453c`, orange `#e07b1a`, yellow `#dca200`, green `#3aa861`, pink `#e0559b`, purple `#8b5cf6` (see priority-system reconciliation note above)
- Annotation-only accent (discard): pin/blue `#2f5fa6`
- Radius: 7–11px cards/buttons/chips, 16px app frame
- Border weights: 1.5–2.5px (heavier than typical hifi UI — a wireframe convention, not a directive)
- Fonts: Sora (UI, self-hosted TTF, weights 400/500/600/700), Architects Daughter (Google Font, annotative accents only)

## Assets
No image/photo assets. All icons are inline stroke-based SVGs (~11–24px, 1.8–2.6px stroke). Recreate with the target codebase's existing icon library rather than copying these SVGs. Fonts: `fonts/Sora-*.ttf` (bundled) + Architects Daughter via Google Fonts CDN.

## Files in this package
- `Daily Dashboard Wireframe.html`
- `Weekly View Wireframe.html`
- `Monthly & Future Log Wireframe.html`
- `Migration Ritual Wireframe.html` + `migration.js` (see also the dedicated `design_handoff_migration_ritual/` package for full spec-level detail on this screen)
- `Recurrents Engine Wireframe.html` + `recurrents.js`
- `Habits Tracker Wireframe.html`
- `Gratitude Journal Wireframe.html`
- `Health Tracking Wireframe.html`
- `Analytics Dashboard Wireframe.html` + `analytics-charts.js` + `analytics-build.js`
- `fonts/` — Sora TTF family used by every screen
