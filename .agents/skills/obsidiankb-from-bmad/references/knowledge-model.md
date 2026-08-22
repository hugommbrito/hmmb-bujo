# Knowledge model

## Purpose

Optimize the vault for orientation, retrieval, reasoning, and change impact. Organize durable project knowledge by meaning rather than by BMad workflow or artifact location.

## Vault layout

```text
_knowledge/
├── Home.md
├── 01-Product/
│   ├── Product.md
│   ├── Capabilities/
│   ├── Concepts/
│   └── Journeys/
├── 02-Architecture/
│   ├── Architecture.md
│   ├── Components/
│   ├── Data/
│   ├── Integrations/
│   └── Quality-Attributes/
├── 03-Experience/
│   ├── Experience.md
│   ├── Patterns/
│   └── Accessibility/
├── 04-Delivery/
│   ├── Delivery.md
│   ├── Epics/
│   └── Operations/
├── 05-Decisions/
│   └── Decisions.md
├── 06-Quality/
│   ├── Quality.md
│   └── Risks/
├── 07-Research/
│   └── Research.md
├── 90-sources/
│   ├── Source Index.md
│   └── Archive/
└── .obsidiankb/
    └── state.json
```

Create only directories justified by actual knowledge. Keep `Home.md` and the top-level MOCs that have content.

## Note classes

| Class | Answers | Typical source evidence |
|---|---|---|
| MOC | Where do I start and how is this area connected? | Synthesized from all linked notes |
| Capability | What can the product do, for whom, and under which rules? | PRD, epics, stories |
| Concept | What does this domain term mean? | PRD, architecture, stories |
| Journey | How does a user achieve an outcome? | UX specs, scenarios, stories |
| Component | What owns this responsibility and how does it interact? | Architecture, implementation specs |
| Decision | What was decided, why, and with what consequences? | ADR-like passages, retrospectives, specs |
| Delivery | What is implemented, pending, deferred, or risky? | Sprint status, stories, retrospectives |
| Quality | Which constraints, checks, and known gaps govern the system? | Test summaries, accessibility, reviews |
| Research | What evidence or exploration informs the project? | Research and brainstorming artifacts |

Do not create one note per source artifact. A source may update many concepts, and one canonical note may cite many sources.

## Frontmatter contract

Use this minimum contract on canonical notes:

```yaml
---
title: Canonical human title
aliases:
  - Search synonym
type: capability
status: current
source_files:
  - _bmad-output/path/to/source.md
source_updated: 2026-07-29
tags:
  - kb/product
---
```

Allowed `type` values: `moc`, `capability`, `concept`, `journey`, `component`, `decision`, `delivery`, `quality`, `risk`, `research`.

Allowed `status` values: `current`, `proposed`, `partial`, `deprecated`, `superseded`, `uncertain`.

Quote YAML strings when punctuation could make parsing ambiguous. Use repository-relative paths in `source_files`. Keep the list sorted and deduplicated.

## Body contract

Begin with a concise answer or definition. Use only sections that add value:

- `## Em resumo`
- `## Como funciona`
- `## Regras e invariantes`
- `## Relações`
- `## Estado de entrega`
- `## Decisões`
- `## Riscos e lacunas`
- `## Histórico`
- `## Fontes`

Link meaningful first mentions with `[[Canonical note|natural phrase]]`. Avoid link saturation.

## Navigation

- Make `Home.md` an orientation page, not a file dump.
- Give every canonical note at least one incoming MOC link.
- Link horizontally when a relationship aids reasoning: capability → journey → component → decision → quality constraint.
- Add a brief relationship label around links; unexplained “related” lists are weak.
- Keep `90-sources/Source Index.md` as provenance navigation grouped by source family. Do not reproduce raw artifacts.

## Source priority

Prefer current canonical artifacts over operational byproducts:

1. Current PRD, product brief, architecture, UX/design, epics, and project context.
2. Current sprint status, accepted stories/specs, decisions, retrospectives, and test summaries.
3. Research and brainstorming with durable conclusions.
4. Reports, review traces, orchestration logs, generated prototypes, and rejected artifacts only when they contain unique evidence.

Treat `_deprecados`, `archive`, `.rejected-*`, timestamped orchestration logs, and raw test/CI output as historical or operational evidence, not current truth.

## Human and AI readability

- Expand local acronyms on first use.
- State temporal validity and delivery status explicitly.
- Prefer concrete invariants and examples over vague prose.
- Preserve identifiers that connect requirements, stories, APIs, schemas, and code.
- Surface contradictions and confidence directly.
- Keep generated summaries attributable: every consequential claim must be traceable to at least one `source_files` entry.
