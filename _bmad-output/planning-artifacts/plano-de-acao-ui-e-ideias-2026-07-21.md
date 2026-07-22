# Plano de ação — Migração de UI + Triagem de `futureIdeas`

> **Criado:** 2026-07-21 · **Dono:** HugoMMBrito · **Tipo:** roadmap rastreável (marque as etapas conforme concluir)
>
> Conecta duas frentes: fechar a migração do design system (trilha A, em curso no `bmad-ux`) e amadurecer/triar as ideias de [`docs/futureIdeas.md`](../../docs/futureIdeas.md) (trilha B). As duas convergem num único ponto: o `correct-course`.

## Legenda

- `- [ ]` etapa pendente · `- [x]` concluída
- ✅ aprovado · ▶ fazer agora · ⏸ diferido · 🚦 gate (não avançar sem cumprir)
- Códigos entre colchetes (ex.: `[CC]`) são menu-codes BMad; nome do rito em `code`.
- Recomendação geral: rodar cada rito numa **janela de contexto nova**.

---

## Decisões-chave (por que o plano é assim)

1. **Convergência única.** Ideias novas e nova UI **não** são trilhas separadas até o fim — encontram-se no `correct-course`, que reconcilia tudo com o produto já construído.
2. **`bmad-ux` fecha no *gate*, não nas 23 telas.** O `bmad-ux` cumpre seu papel ao provar a Fundação nos gates da SPEC (Daily ✅ + Planner/Migração). Faltam só **M09 + M10**. Mockups de módulo/config (M11–M23) migram **onda a onda**.
3. **Mockups de módulo são diferidos.** Detalhá-los agora, no conjunto antigo de features, geraria retrabalho — a triagem de ideias pode alterá-los (Saúde/métricas #16–19, Config #13/#14, etc.). Desenhar cada um **na sua onda de migração**, com as features já decididas.
4. **Toda UI nova nasce no design system novo.** Nenhuma story com UI é implementada antes do gate da Fundação — senão consolida o sistema que está sendo descartado (risco nomeado na `migration-plan.md`).

---

## Mapa das trilhas

```
Trilha A (em curso) ─ fechar gate do bmad-ux (M09+M10) ─┐
                                                         ├─► 🚦 CONVERGÊNCIA ─► [CC] ─► [PRD] ─► [CE]/[IR] ─► [SP] ─► implementar
Trilha B ─ triagem de ideias ([BP] + [TR]) ─────────────┘
```

---

## FASE 0 — Em paralelo (agora)

### Trilha A · Fechar o gate da Fundação no `bmad-ux`
_Sessão de `bmad-ux` já aberta — escopo reduzido ao gate._

- [x] ✅ **M09 — Recorrentes** (biblioteca por abas, detalhe criar/editar, soft delete, alocação por referência, empty) — promovido + spines atualizados
- [x] ✅ **M10 — Migração / Catch-Up** — banner discreto unificado + ritual dentro do shell (fontes=níveis) + aba "Esta semana" + resumo; promovido
- [x] Promover as decisões de M09/M10 para `DESIGN.md` e `EXPERIENCE.md` — feito; spines em `status: final`
- [x] *Check leve:* catálogo de padrões da Fundação expressa os **arquétipos** de superfície das ideias (captura/coleções/listas) — coberto pelas primitivas aprovadas
- [x] ⏸ **Não** desenhar M11–M23 (ficam para a onda de cada superfície) — respeitado
- [x] **Saída:** Fundação aprovável ✅ — **GATE FECHADO em 2026-07-21**

### Trilha B · Triagem das ideias
_Janela de contexto nova — independente da trilha A._

- [x] **[BP]** `bmad-brainstorming` sobre [`docs/futureIdeas.md`](../../docs/futureIdeas.md) — amadurecer, expandir, classificar/priorizar (impacto × esforço) — **concluído 2026-07-21**: [`brainstorming-session-2026-07-21-1751.md`](../brainstorming/brainstorming-session-2026-07-21-1751.md)
  - [x] Marcar sobreposições: #6/#21 (colidem com o design system → theming/variante), #9 (parcial na 11.11), #16–19 (refino do Épico 7) — + achados novos: guardrail **UX-DR19** p/ C2 (DR proíbe *sugestões* de IA em fluxos de captura; *análises* sobre dados preenchidos são compatíveis — registrar fronteira no CC), C2 retoma **FR-4.3**, #15 × schema congelado (→ flag), #14 × Épico 10 (sinergia)
- [x] **[TR]** `bmad-technical-research` — **concluído 2026-07-22**: [`technical-viabilidade-c5-mobile-query-ia-pressao-arterial-research-2026-07-22.md`](research/technical-viabilidade-c5-mobile-query-ia-pressao-arterial-research-2026-07-22.md) — veredictos: C5 = Shortcuts+token de automação (esforço P; widget via Scriptable; PWA sem widget confirmado; wrapper nativo adiado) · #12 = DSL compilado (nunca SQL de IA); fase b = texto+gráficos via `serie_ref`; fase c = django-q2 + Batch API; < US$ 1/mês · #20 = viável (~US$ 0,20/mês, Haiku 4.5) com confirmação humana obrigatória; schema FHIR/7-2-2 definido (#5a dispensado de TR)
- [x] **Saída:** lista madura, priorizada e com viabilidade resolvida ✅ ([BP] 2026-07-21 + [TR] 2026-07-22)

---

## 🚦 GATE DE CONVERGÊNCIA
_Não avançar sem os dois lados prontos._

- [x] Trilha A concluída (Fundação aprovada — gate fechado 2026-07-21)
- [x] Trilha B concluída ([BP] ✅ 2026-07-21 + [TR] ✅ 2026-07-22) — **🚦 GATE DE CONVERGÊNCIA ABERTO: próximo rito é o [CC]**

---

## FASE 1 — Reconciliação
_Janela de contexto nova._

- [x] **[CC]** `bmad-correct-course` — **concluído 2026-07-22**: [`sprint-change-proposal-2026-07-22.md`](sprint-change-proposal-2026-07-22.md) — ordem mestre definida (Tier 0 → ondas 2a/3/4/5 → spec da home → 2b → 6 → Épico 10 ampliado → Tier 3: C6 → Alimentação → Análises a/b → #20 → Análises c); FR-4.3 reescrito (Modelos de Relatório); UX-DR16 revogado parcialmente (home = dashboard; Hoje = trabalhar / Dashboard = ver, componente compartilhado); fronteira DR19 registrada; #15 backend-já/UI-na-onda-2b; Journalling substitui a migração da Gratidão na Onda 5; 15 diretrizes de story para o [CE] (incl. story x.0 de UX por épico com UI)
- [x] **Saída:** proposta de mudança com escopo real e ordem ✅

## FASE 2 — Escopo formal
_Conforme o CC rotear; cada rito em janela nova._

- [ ] **[PRD]** `bmad-prd` (*update*) — aplicar E1/E2 do proposal (FR-4.3 Modelos de Relatório + backlog reconciliado, já editados no PRD) e escrever os **FRs novos por onda**: infraestrutura de collections (manifest, #14 peças 2–4, taxonomia de archetypes), Journalling (absorve FR-4.1/4.2), C6, Análises (fases a/b/c), Alimentação (#5a), Pressão Arterial (#20), plataforma C5 (token + capture + summary), #15, #23, #24, home/dashboard/Hoje; confirmar itens anotados do backlog (relatórios médicos; dashboard de indicadores)
- [ ] **[ARCH]** `bmad-create-architecture` (*update*) — decisões roteadas (proposal §9): registry/manifest; token de automação; django-q2; DSL dos Modelos de Relatório (JSON Schema + allowlist + compilação ORM + role read-only + `statement_timeout`); JSONB/aninhamento máx. 1 nível em C6; 3 âncoras temporais do Journalling; espelho do foodLog (fotos: copiar × referenciar); chave IA global criptografada + `ai_available`; índice reverso métrica→modelos; filhas dinâmicas do container na sidebar (mocks nos 3 testes compartilhados); granularidade da flag (espaço × usuário); schema BPMeasurement/BPSession com `source` enum
- [ ] **[CE]** `bmad-create-epics-and-stories` — decompor as **ondas reordenadas** (2a App Shell, 3 Núcleo BuJo, 4 Captura, 5 Módulos+refinos+Journalling, 2b Daily+Home, 6 Consolidação) + **épicos novos** (Tier 0/plataforma, Épico 10 ampliado, Tier 3); **épicos com UI nascem com story x.0 de UX** (proposal §8, diretriz 15); diretrizes de story do proposal §8 embutidas; toda story com UI referencia o sistema novo
- [ ] **[IR]** `bmad-check-implementation-readiness` — alinhar PRD/UX/Arquitetura/Épicos
- [ ] **bmad-ux pontual:** spec da nova home **antes da Onda 2b** (é a x.0 ampliada da onda; detalha Hoje = trabalhar / Dashboard = ver + empty-state/cardápio + valida a sub-condição "≥1 collection")

## FASE 3 — Implementar
_O ciclo já dominado._

- [ ] **[SP]** `bmad-sprint-planning`
- [ ] Execução via **[SA]** `bmad-story-automator` (ou CS→DS→CR→ER manual)
- [ ] **Padrão por onda/épico (formalizado pelo CC 2026-07-22 como story x.0):** todo épico com superfície de UI abre com uma **story x.0 de UX** — bmad-ux produz o mockup/spec (M11–M23) com as features já decididas, human-in-the-loop — e só então as stories de implementação rodam (o story-automator entra no épico após a x.0 `done`)

---

## Referências

- SPEC da migração: [`_bmad-output/specs/spec-design-system-migration/SPEC.md`](specs/spec-design-system-migration/SPEC.md)
- Plano de migração (ondas/gates): [`.../migration-plan.md`](specs/spec-design-system-migration/migration-plan.md)
- Plano de cobertura de mockups (linha de corte): [`.../ux-hmmb-bujo-2026-07-17/.working/mockup-coverage-plan.md`](planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/.working/mockup-coverage-plan.md)
- Design novo em curso: [`.../ux-hmmb-bujo-2026-07-17/DESIGN.md`](planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/DESIGN.md)
- Épicos: [`planning-artifacts/epics.md`](planning-artifacts/epics.md) · Sprint: [`implementation-artifacts/sprint-status.yaml`](implementation-artifacts/sprint-status.yaml)
- Ideias-fonte: [`docs/futureIdeas.md`](../../docs/futureIdeas.md)

---

## Apêndice — Inventário de ideias (preenchido na triagem [BP] 2026-07-21)

_Destinos decididos no `[BP]`; ordem final e escopo de story pertencem ao `[CC]`. Detalhes completos (clusters, tiers, contradições, escopo dos TR): [`brainstorming-session-2026-07-21-1751.md`](../brainstorming/brainstorming-session-2026-07-21-1751.md)._

| # | Ideia (resumo) | Toca superfície | Destino | Notas |
|---|----------------|-----------------|---------|-------|
| 1 | Logs de viagem/moradia/empregos (cadastro Canadá) | módulo novo | absorvida → C6 | 1ª coleção customizada; exige listas estruturadas em C6 |
| 2 | Resumo diário (base p/ análise IA) | Hoje (aditivo) | agora (onda Hoje) | C1, fundido c/ #4; pré-requisito de dados de C2 |
| 3 | Análise IA explicando fatos do dia | Analytics (novo) | backlog | C2 fase b; guardrail DR19 (análise ≠ sugestão); retoma FR-4.3 |
| 4 | Seção de observação nos logs diários | Hoje (aditivo) | agora (onda Hoje) | C1, fundido c/ #2 |
| 5 | Fundir com / consumir do foodLog | integração | 5a backlog-alto / 5b icebox | consumir via API primeiro; reimplementar depois se provar valor |
| 6 | Segunda UI mais moderna | design system | absorvida → migração | C4: requisito de theming (tokens semânticos) |
| 7 | Automações com Shortcuts (iPhone) | plataforma | backlog + [TR] | C5 |
| 8 | App mobile? widgets sem app? | plataforma | backlog + [TR] | C5; widgets provavelmente exigem app nativo |
| 9 | Aba de "Histórico" | navegação | backlog-baixo | parcial (11.11); reavaliar pós-migração |
| 10 | Aba de coleções (padrão BuJo) | superfície nova | backlog (Tier 3, 1º sugerido) | C6; absorve #1 |
| 11 | Aba de análises com IA (métricas → dataviz) | Analytics (novo) | backlog | C2 fase a; guardrail DR19 (análise ≠ sugestão) |
| 12 | Relatórios periódicos com query salva auto-atualizável | Analytics (novo) | backlog + [TR] | C2 fase c; segurança de query gerada por IA |
| 13 | Timer de foco (auto start/pausa por foco da janela) | transversal/config | icebox | baixo impacto |
| 14 | Habilitar/desabilitar módulos | Config-índice + transversal | backlog-alto | casar com Épico 10 (antes de 10.1) |
| 15 | Estado "Aguardando Terceiro" | tarefa (aditivo) | agora (onda Daily) | como FLAG, não estado; schema congelado (3.1); uso frequente |
| 16 | Métricas de saúde: reordenar | Saúde/Config-métricas | agora (onda Saúde) | C3; quick win — `display_order` já existe |
| 17 | Métricas de saúde: editar | Saúde/Config-métricas | agora (onda Saúde) | C3; separar edição segura (nome) × destrutiva (tipo) |
| 18 | Métricas: percentual + enum multi-seleção | Saúde/Config-métricas | agora (onda Saúde) | C3; enum multi = valor→array |
| 19 | (agrupado com 16–18) | Saúde/Config-métricas | agora (onda Saúde) | C3 |
| 20 | Módulo de Pressão Arterial (foto + IA) | módulo novo | backlog + [TR] | N medições/dia não cabe no log 1×/dia |
| 21 | Outro padrão de cores | design system | absorvida → migração | C4: paleta trocável via tokens |
| 22 | Dividir itens de saúde em grupos | Saúde/Config-métricas | agora (onda Saúde) | C3; nova entidade de agrupamento |
| 23 | Task migrada herda status da origem | domínio (service) | agora (Tier 0, sem UI) | quick win; sucessor herda `started` (regra 4.2/11.6) |
| 24 | Dar nome às categorias | Config | agora (onda Config) | label por usuário sobre as 6 cores fixas |
