# Prompts de handoff — janelas pós-[IR] (2026-07-23)

> Gerados ao fim do rito [IR] (`implementation-readiness-report-2026-07-23.md`, veredicto **READY**).
> Ordem recomendada: **1 → 2 → 4 → 5**, com o **3 em paralelo** (precisa estar pronto antes de o automator chegar à story 14.1).
> Cada prompt abre uma **janela de contexto nova**; copiar e colar o bloco inteiro.

---

## Janela 1 — [PRD] update curto (resolve os issues 1, 4 e 5 do IR)

```
/bmad-prd

Intent: UPDATE do PRD (_bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md) — 3 correções cirúrgicas roteadas pelo rito [IR] de 2026-07-23 (relatório: _bmad-output/planning-artifacts/implementation-readiness-report-2026-07-23.md, seção "Sumário e Recomendações").

1) NOVO FR — Recuperação de senha (issue crítico do IR; pendência auto-sinalizada no epics.md, preâmbulo do Épico 10):
   - Fluxo de reset por email (esqueci minha senha → token/link com validade → redefinição), necessário ANTES do Épico 10 — convidado trancado para fora é falha de onboarding.
   - Alocar no grupo FR-0 (Fundação/auth) ou FR-15 (Gestão de Usuários) — decidir no rito; registrar no Anexo A como novo.
2) RENAME "cardápio" → "Index" (decisão Hugo 2026-07-23, registrada no epics.md): aplicar em FR-1.4, FR-6.4 e FR-15.5 (+ ocorrências correlatas). Manter a nota de que o rótulo pt-BR final (Index × Índice) é decidido na story x.0 10.3.
3) NFR-8 — alinhar à decisão do dono de 2026-07-22 (já registrada no epics.md, seção NonFunctional Requirements): REMOVER do NFR transversal a cláusula "fotos de pressão arterial passam por crop do display + strip de EXIF antes do envio". O pipeline de foto permanece como requisito de feature em FR-12.8/AD-27 — nada muda lá.

Restrições: mudanças cirúrgicas — não reabrir escopo, não renumerar FRs existentes, texto dos FRs entregues preservado. Ao final, atualizar o Anexo A (de-para) com o FR novo.
```

---

## Janela 2 — epics.md: refresh do Épico 10 (resolve os issues 1 e 2 do IR)

```
/bmad-create-epics-and-stories

Intent: UPDATE CIRÚRGICO do epics.md (_bmad-output/planning-artifacts/epics.md) — correções roteadas pelo [IR] 2026-07-23 (relatório: implementation-readiness-report-2026-07-23.md, achados 🔴 1 e 🟠 1). Pré-requisito: o [PRD] update de 2026-07-23 já criou o FR de recuperação de senha e aplicou o rename Index — se ainda não rodou, PARAR e avisar.

1) Refresh das Stories 10.1 e 10.2 (escritas em 2026-06-22, pré-renumeração):
   - Corrigir citações de FR: "FR-6.1" → FR-15.1; "FR-6.2, FR-6.3" → FR-15.2, FR-15.3 (a numeração antiga hoje colide com o FR-6 Home/Dashboard — risco real de confusão na implementação).
   - Elevar os ACs ao padrão do ciclo pós-MVP: adicionar estados de erro — convite expirado/inválido (mensagem + caminho de reenvio), falha no envio do email (visível ao operador), convite já aceito.
2) NOVA story de recuperação de senha no Épico 10, ANTES da 10.1 na ordem interna (10.0 → 10.3 → 10.4 → 10.5 → 10.6 → 10.7 → [nova] → 10.1 → 10.2), citando o FR novo do PRD. Padrão pt-BR (Como/Quero/Para que; Dado que/Quando/Então/E). Incluir estados de erro: token expirado/reutilizado; email inexistente SEM enumeração de contas (coerente com o AC de login "401 sem revelar se o email existe"); e migration/branch e2e se houver modelo novo.
3) Atualizar o banner "🚨 Pendência de PRD" do preâmbulo do Épico 10: marcar como resolvida (PRD + story criadas 2026-07-23 via [IR]→[PRD]→[CE]).
4) Atualizar o FR Coverage Map: FR novo → Épico 10 · story nova.

Não tocar em mais nada — Épicos 1–9/11 são registro histórico; os demais épicos já estão aprovados e auditados pelo [IR].
```

---

## Janela 3 — [ARCH] adendo leve: deltas M06–M10 (resolve o issue 3 do IR) + nota no migration-plan

> Alternativa sem janela: se preferir NÃO escrever o AD, basta registrar aceite formal da modelagem no nível da story 14.1 (uma linha no epics.md). O IR recomenda o AD — o Épico 14 é o caminho crítico.

```
/bmad-create-architecture

Intent: UPDATE pontual do architecture.md — 1 AD curto roteado pelo [IR] 2026-07-23 (relatório: implementation-readiness-report-2026-07-23.md, achado 🟠 "Deltas M06–M10 sem AD dedicado").

Contexto: o EXPERIENCE.md 2026-07-17 (seção "Decisions for Architecture and Stories", M06/M07/M10) exige que os deltas de domínio dos spines passem por arquitetura antes da implementação. O CC 2026-07-22 aprovou o lado de produto e as stories 14.1–14.3 do epics.md especificam gates/constraints — mas não há AD registrando a FORMA da modelagem. O Épico 14 é o gate vertical e caminho crítico do roadmap.

Tarefa: escrever o AD-28 (seção §3b, seguindo o formato dos AD-17..27: Contexto / Decisões / Schema / Casos-âncora) decidindo:
1) Ciclos de vida de Weekly/Monthly ("Em planejamento" / "Em andamento" / "Finalizada(o)" + marco "planejamento concluído"): estado em colunas nos próprios weekly/monthly logs × tabela própria de ciclo; constraints de unicidade (máx. UM "Em andamento" e UM "Em planejamento" por tipo); forma da data migration retroativa (fechados → Finalizado; corrente → Em andamento; monthlies usados só como storage do Future Log fora da navegação operacional — ACs da story 14.1).
2) Decisões-snapshot dos rituais ("Manter", "Não alocar nesta semana", "Manter sem dia" — story 14.2): shape da entidade (por ritual × por item), persistência imediata, progresso sem mutação de Task.
3) Fila unificada de migração (story 14.3): serviço/endpoint único mês→semana→dia; aliases finos dos endpoints legados (/migration/queue/ + /catch-up/queue/) sobre o serviço novo, mesmos contratos de resposta, remoção no Épico 18.
Convenções §6 aplicam-se integralmente (TextChoices+CheckConstraint, service layer, tenant fail-closed, today_for). NÃO alterar decisões de produto — só a forma arquitetural.

Tarefa secundária (1 parágrafo): anotar em _bmad-output/specs/spec-design-system-migration/migration-plan.md a estratégia de promoção a prod (decisão Hugo 2026-07-23, registrada no epics.md): durante as ondas, prod permanece no sistema atual; coexistência por rota e rollback por superfície são mecanismos de dev/homologação; o rollback de prod é NÃO PROMOVER; promoção única ≈ Épico 18. Reconciliação já registrada no relatório do [IR] (§Step 4).
```

---

## Janela 4 — [SP] sprint planning (próximo required da Fase 4)

> Rodar após as Janelas 1–2, para a story de recuperação de senha já entrar no plano.

```
/bmad-sprint-planning

Intent: gerar/atualizar o sprint-status para o ciclo pós-MVP a partir do epics.md (atualizado pelo [CE] 2026-07-23 + refresh do Épico 10; gate [IR] READY 2026-07-23 — relatório: implementation-readiness-report-2026-07-23.md).

Requisitos de sequenciamento (ordem mestre do sprint-change-proposal-2026-07-22.md §4 — a numeração dos épicos é IDENTIFICADOR, não ordem):
- Fila: Épico 12 → 13 → 14 → 15 → 16 → 17 → 18 → 10 → 19 → 20 → 21 (fases a/b: 21.0–21.9) → 22 → 21 (fase c: 21.10–21.11).
- Épico 10 roda DEPOIS do 18 (D8). Épico 21 PAUSA após a 21.9 — as stories 21.10/21.11 têm gate ⛔ e só entram após o Épico 22 completo (D7).
- Stories x.0 de UX são gates human-in-the-loop (rito bmad-ux — NUNCA dev-story/automator): 13.0, 14.0, 15.0, 16.0, 16.3, 16.10, 17.0, 18.0, 19.0, 20.0, 21.0, 22.0 e 10.3. Nenhuma story de implementação do épico antes da x.0 done. Épico 12 não tem x.0 (sem UI).
- Épico 16 em lotes de automação: 16.0 → [16.1–16.2] · 16.3 → [16.4–16.9] · 16.10 → [16.11–16.14].
- Ordem interna do Épico 10: 10.0 → 10.3 → 10.4 → 10.5 → 10.6 → 10.7 → [recuperação de senha] → 10.1 → 10.2.
- 17.0 (spec da home) pode rodar em paralelo com a cauda do Épico 16 (mitigação registrada no epics.md).

Notas do [IR] a carregar no plano: story 14.5 é candidata a split na criação (Task Row base como story própria); Épicos 1–9 e 11 são histórico — não entram na fila.
```

---

## Janela 5 — [SA] story-automator: Épico 12

> Rodar após o [SP]. Épico 12 é ideal para abrir o ciclo: Tier 0, sem UI, sem gate x.0.

```
/bmad-story-automator

Rodar o ciclo automatizado do Épico 12 (Tier 0 — Plataforma e Quick Wins, sem UI; sem gate x.0), conforme o sprint-status gerado pelo [SP] de 2026-07-23.

Lembretes de ambiente (memória do projeto):
- Frontend/e2e: rodar `nvm use 22.15.1` antes de qualquer comando (a sessão inicia em Node 18).
- Toda migration nova deve ser aplicada TAMBÉM à branch Neon e2e antes do Playwright (bug recorrente; os ACs das stories já cobram).
- Full-suite pytest local (Postgres via docker-compose) é o gate padrão.
- Commits: 1 por story; protocolo do report (/bmad-uncommitted-report antes de commitar, sem pedir confirmação); git add ESCOPADO (nunca -A cru); nunca amendar commits já pushados; 1Password SSH indisponível no orquestrador → usar --no-gpg-sign e deferir o push para sessão interativa.
- NÃO usar ScheduleWakeup durante o automator (colide com as sessões tmux filhas).
- Retrospective do épico nunca é pulada; ações de retro viram persistent_facts em _bmad/custom/bmad-dev-story.toml (append).
- Trabalho na branch dev (homologação); prod não recebe nada até a promoção única (≈ Épico 18).
```
