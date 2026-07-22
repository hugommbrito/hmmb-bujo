---
title: "Reconciliação do rito [PRD] — cobertura de escopo (CC 2026-07-22)"
tipo: relatório de reconciliação (read-only; nenhum arquivo editado)
gerado: 2026-07-22
autoridade: sprint-change-proposal-2026-07-22.md
fontes:
  - prds/prd-hmmb-bujo-2026-06-15/prd.md
  - prds/prd-hmmb-bujo-2026-06-15/addendum.md
  - sprint-change-proposal-2026-07-22.md
  - brainstorming/brainstorming-session-2026-07-21-1751.md
---

# Reconciliação do PRD atualizado × escopo roteado

## Veredicto

**Cobertura COMPLETA.** Todo item roteado ao rito `[PRD]` (proposal §9), toda anatomia consolidada 📦 do brainstorming, as 15 diretrizes vinculantes (§8) e as 3 decisões contra-recomendação (§2.10) têm cobertura no `prd.md`. Não há requisito órfão. As inconsistências encontradas são de **higiene documental de baixa severidade** e vivem no **addendum** (documento companheiro), não no PRD, e não afetam a cobertura de escopo.

---

## 1. Escopo do rito (proposal §9, linha "[PRD]") — item a item

| Item roteado (§9) | FR no prd.md | Status |
|---|---|---|
| Aplicar E1 (FR-4.3 reescrito) | FR-13.1–13.12 (Análises) + Anexo A | ✅ |
| Aplicar E2 (backlog §8 reconciliado) | §8 "Backlog reconciliado pelo CC" | ✅ |
| Infra collections — manifest | FR-1.3 | ✅ |
| Infra collections — #14 peça 2 (cardápio) | FR-1.4 (+ FR-15.5) | ✅ |
| Infra collections — #14 peça 3 (default all-off) | FR-1.5 (+ FR-15.5) | ✅ |
| Infra collections — #14 peça 4 (empty-state oferta) | FR-6.4 (+ FR-15.5) | ✅ |
| Infra collections — taxonomia de 4 archetypes | FR-1.2 | ✅ |
| Journalling (absorvendo FR-4.1/4.2 + Gratidão) | FR-10.1–10.7 (10.7 = absorção) | ✅ |
| C6 Custom Collections | FR-14.1–14.9 | ✅ |
| Análises fases a/b/c | FR-13.3 (a) / 13.4 (b) / 13.10 (c) | ✅ |
| Alimentação (#5a) | FR-11.1–11.6 | ✅ |
| Pressão Arterial (#20) | FR-12.1–12.8 | ✅ |
| Plataforma C5 (token + capture + summary) | FR-3.1–3.5 | ✅ |
| #15 waiting_on | FR-4.15 | ✅ |
| #23 herança de status | FR-4.16 | ✅ |
| #24 nome às categorias | FR-4.14 | ✅ |
| home/dashboard/Hoje (D4) | FR-6.1–6.6 | ✅ |
| Confirmar item anotado: relatórios médicos | FR-13.11 | ✅ |
| Confirmar item anotado: dashboard de indicadores | FR-6.6 (+ §2 nota, §3 nota) | ✅ |
| BYO key global (config de IA) | FR-2.1–2.4 | ✅ |

**Nenhuma feature roteada ficou sem FR.** Os dois itens de backlog a "confirmar" foram confirmados com destino explícito (FR-13.11 e FR-6.6).

---

## 2. Anatomias 📦 (Mergulhos 1–4 + Síntese Rodada 3 + Rodada 4)

### C6 (📦 Mergulho 1)
Todos os atributos presentes: container coded (14.1), schema do usuário + campo-array máx. 1 nível (14.2), tipos independentes do Épico 7 (14.3), sidebar grupo "Custom Collections" (14.4), edição segura/destrutiva (14.5), vazia com exemplos/sem presets (14.6), sem export (14.7), cidadania por feature (14.8), caso motor Canadá (14.9). ✅

### Journalling (📦 Mergulho 2)
Campo `{nome, prompt?, cadência, múltiplas_entradas, contexto_ia, gravar_horário, ativo}` → FR-10.1 (íntegro). Desativar-nunca-deletar/renomear seguro (10.2), contexto_ia OFF (10.3), múltiplas entradas (10.4), cadência configurável + histórico por cadência (10.5), card único no Hoje (10.6), absorção da Gratidão com campo seed + migração + aposentadoria na mesma onda (10.7). ✅

### Análises (📦 Mergulho 3)
Entidade **Modelo de Relatório** `{nome, métricas cross-collection, filtros (range + igualdade/existência), anotações por métrica (global c/ override local), conceitos, prompt de expectativa, exemplar adotado?, histórico}` → FR-13.2 (íntegro). Ancoragem por exemplar (13.5), histórico imutável (13.6), fonte desligada = fora de novos (13.9), fronteira de privacidade (13.7), geração por ação explícita (13.1/13.4), guardrail DR19 (13.1). ✅

### Alimentação (📦 Mergulho 4)
Archetype integração read-only + espelho local (11.1), resumo diário + janela de jejum (11.2), credenciais no settingsSchema (11.3), foodLog offline nunca quebra o bujo (11.4), fonte de 1ª classe em Análises + fotos nunca contexto IA (11.5), espelho completo/#5b fora do MVP (11.6). ✅

### Taxonomia + Rodada 4
4 archetypes → FR-1.2 ✅ · BYO key global (Rev. 1) → FR-2 ✅ · dois sinais de IA distintos (Rev. 2) → FR-2.3 (tag "função de IA") + FR-13.8 (badge "dado lido por IA", com afirmação explícita de que são distintos) ✅ · C6 container coded (Rev. 3) → FR-14.1 ✅.

**Nenhum atributo de anatomia consolidada ficou de fora.**

---

## 3. Diretrizes vinculantes (§8, 15 itens)

| # | Diretriz | Onde no PRD | Status |
|---|---|---|---|
| 1 | Guardrail DR19 (Análises/#20) | FR-13.1 (texto), FR-12.2 | ✅ |
| 2 | #20 human-in-the-loop | FR-12.3–12.6, 12.8 (Haiku em addendum) | ✅ |
| 3 | Editar seguro × destrutivo | FR-10.2, FR-14.5, nota FR-8 | ✅ |
| 4 | #15 flag (proibido 7º estado) | FR-4.15 | ✅ |
| 5 | #23 herda `started` | FR-4.16 | ✅ |
| 6 | Manifest fatia 1 (dados puros / pixel-idêntico / DoD) | FR-1.3 | ✅ |
| 7 | Sinais de IA distintos + índice reverso | FR-2.3 + FR-13.8 | ✅ |
| 8 | Consentimento (contexto_ia off; seleção = consentimento) | FR-10.3 + FR-13.8 | ✅ |
| 9 | BYO key global (nasce c/ 1ª feature de IA) | FR-2 (+ nota introdutória) | ✅ |
| 10 | Alimentação | FR-11 | ✅ |
| 11 | C5 payloads rasos / token escopado / rate-limit | FR-3.1–3.4 | ✅ |
| 12 | Condições da Sally (a) contrato puro / (c) off-state | (a) FR-1.3; (c) ver observação abaixo | ✅ / ⚠️ obs. |
| 13 | Épico 10 LGPD + granularidade da flag | FR-15.6 + FR-1.6 | ✅ |
| 14 | Decisões contra-recomendação | FR-14.3, 14.7, 10.5 | ✅ |
| 15 | Story x.0 de UX | §7.2 (nota de sequência) | ✅ |

**Observação sobre §8.12 condição (c)** ("todo mockup daqui em diante inclui o estado collection desligada/ausente"): é uma **diretriz de processo de design**, roteada ao bmad-ux/[CE] pela própria proposal — não um requisito funcional de produto. O comportamento de produto adjacente está coberto (FR-1.4 desativar preserva/reativar restaura; FR-6.4 empty-state). Não é lacuna; é fronteira de artefato (fica no [CE], não no PRD). Registro por completude.

---

## 4. Decisões contra-recomendação (§2 item 10 / §8.14)

| Decisão | FR | Preservada (não "corrigida")? |
|---|---|---|
| C6 tipos independentes do Épico 7 | FR-14.3 (rótulo explícito "§2.10") | ✅ Sim |
| C6 sem export no MVP | FR-14.7 (rótulo explícito "§2.10") | ✅ Sim |
| Journalling cadência configurável no MVP | FR-10.5 (rótulo explícito "§2.10") | ✅ Sim |

As três estão **preservadas e rotuladas** como decisões contra-recomendação, exatamente como a proposal exige.

---

## 5. Contradições / inconsistências da renumeração

### 5.1 — [REAL, baixa severidade] Cross-refs legadas no addendum apontam para FRs errados

A **seção original (topo) do `addendum.md`** não foi renumerada junto com o `prd.md`. Suas referências cruzadas agora apontam para FRs que, no novo esquema, significam outra coisa:

| Referência no addendum (topo) | Significava (antigo) | Aponta hoje para (novo) |
|---|---|---|
| "FR-3.1 (métricas de saúde dinâmicas)" | Saúde-Métricas | FR-3.1 = **Token de automação C5** (saúde-métricas é FR-8.1) |
| "FR-2 (hábitos dinâmicos)" / "requisitos do PRD (FR-2)" | Hábitos | FR-2 = **Config de IA / BYO key** (hábitos é FR-7) |
| "Medicamentos (FR-3.4)" | Medicamentos | FR-3.4 = **rate limiting C5** (medicamentos é FR-9) |
| "fase posterior (FR-6)" | Gestão de Usuários | FR-6 = **Home/Dashboard/Hoje** (gestão é FR-15) |
| "recorrência de tarefas (FR-1.11)" | Recorrentes | FR-1.11 = inexistente; recorrentes é FR-4.11 |
| "placement... (FR-1.12)" | Placement manual | FR-1.12 = inexistente; placement é FR-4.12 |

A **nova seção "Adendo CC 2026-07-22"** do mesmo arquivo usa corretamente a numeração nova (FR-1, FR-2, FR-3, FR-10–14). O resultado é um addendum **internamente inconsistente**: metade fala "FR-2 = hábitos", metade fala "FR-2 = config de IA". Correção sugerida (fora deste rito read-only): atualizar as 6 referências do topo do addendum para a numeração nova, ou marcar aquela seção como "numeração anterior à revisão CC 2026-07-22".

### 5.2 — [OBSERVAÇÃO, não é erro] Anexo A reutiliza rótulos hoje "vivos"

A coluna "FR antigo" do Anexo A usa rótulos (FR-4.1, FR-4.2, FR-4.3) que **no novo esquema denotam itens do Motor BuJo**. O cabeçalho da coluna ("FR antigo") desambigua corretamente, então não há erro — mas o leitor do FR Coverage Map do `epics.md` precisa estar atento a que "FR-4.1" pode significar "logs Daily/Weekly..." (novo) ou "Gratidão múltiplas entradas" (antigo, absorvido). Nuance de legibilidade, não defeito.

### 5.3 — Anexo A está COMPLETO
Todos os FRs antigos (0.1–0.4, 1.1–1.13, 2.1–2.10, 3.1–3.7, 4.1–4.3, 5.1–5.4, 6.1–6.4) têm linha de de-para; todos os FRs novos (1, 2, 3, 6, 10, 11, 12, 13, 14, 15.5–15.6, 4.14–4.16) estão listados como "Novo". As contagens batem (Motor BuJo 13→13; Hábitos 10→10; Medicamentos 4→4). Não há de-para faltante.

### 5.4 — Cross-refs internas do prd.md estão consistentes
Verificadas todas as referências FR-X dentro do `prd.md` (FR-0.4→FR-15, FR-6.6→FR-8.3/FR-7.10, FR-10.3→FR-13, FR-13.7→FR-11.5, FR-15.5→FR-1.4/1.5/6.4, FR-15.6→FR-12.8/2.4/1.6, notas §2/§3→FR-6.6/8.3/7.10, notas UJ→FR-6/FR-10.7). **Todas apontam para o alvo correto no novo esquema.** Nenhuma inconsistência de renumeração dentro do PRD propriamente dito.

---

## Conclusão

- **Cobertura de escopo: completa.** Zero requisitos órfãos; zero features roteadas sem FR; anatomias, diretrizes e decisões contra-recomendação todas refletidas.
- **Qualidade da renumeração dentro do PRD: sólida.** Anexo A completo; cross-refs internas corretas.
- **Único reparo recomendado (fora do PRD):** atualizar/anotar as 6 cross-refs legadas do topo do `addendum.md` (§5.1). Baixa severidade, não bloqueia [ARCH]/[CE].
