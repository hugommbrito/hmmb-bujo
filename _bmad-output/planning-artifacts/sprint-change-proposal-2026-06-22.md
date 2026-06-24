---
type: sprint-change-proposal
date: '2026-06-22'
project_name: hmmb-bujo
author: HugoMMBrito
trigger: 'Reconciliação do PRD com decisões da arquitetura (AD-11, AD-15)'
scope: Minor
status: aprovado e aplicado
---

# Sprint Change Proposal — Reconciliação PRD ↔ Arquitetura

## 1. Resumo da Questão

Durante a sessão de arquitetura (resolução dos tópicos em aberto), duas decisões
divergiram do que o PRD especificava, gerando inconsistência entre os documentos
de planejamento:

1. **AD-11** confirmou que o **gráfico de evolução de hábitos** entra no MVP. O PRD,
   porém, só previa FR-2.9 ("histórico consultável por data"); gráficos apareciam
   apenas no módulo de Saúde (FR-3.3). O requisito do gráfico de hábitos não tinha
   rastreabilidade no FR-2.
2. **AD-15** decidiu **antecipar o Brain Dump da Fase 5 para a Fase 1b** (logo após o
   Daily Log), por ser trivial, desacoplado e ser a válvula de escape mobile
   (UJ-4 / NFR-1). O roadmap do PRD (seção 7) ainda o posicionava na Fase 5.

Descoberta durante a sessão `bmad-create-architecture` de 2026-06-22.

## 2. Análise de Impacto

- **Épicos:** nenhum impacto — não existem épicos/histórias ainda (quebra não realizada).
- **Histórias:** nenhuma — idem.
- **Arquitetura:** nenhuma mudança necessária; a arquitetura é a **origem** das decisões
  (AD-11, AD-15). Esta proposta apenas alinha o PRD a ela.
- **UX:** sem conflito. O EXPERIENCE já trata captura mobile (FAB/badge, Fluxo 2) e o
  gráfico é detalhe a ser especificado na UX spec na fase de finalização.
- **Técnico:** nenhum ripple de código (pré-implementação).

## 3. Abordagem Recomendada

**Direct Adjustment** — edição direta no PRD. Escopo **Minor**: sem reorganização de
backlog, sem replanejamento. Risco baixo; sem impacto de cronograma (não há sprint ativa).

## 4. Mudanças Detalhadas (aplicadas)

### Mudança 1 — FR-2 (Sistema de Hábitos)

**Arquivo:** `_bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md`
**Seção:** FR-2, após FR-2.9.

**ADICIONADO:**
> **FR-2.10** — O histórico de hábitos também é consultável como **gráfico de evolução
> por hábito** ao longo do tempo. Mudanças reais de configuração (peso, meta, bonus,
> ativação/desativação) são anotadas no gráfico como eventos datados; variações
> periódicas por tipo de dia (multiplicador de fim de semana/feriado) **não** são
> tratadas como mudança de configuração. (Ver arquitetura AD-10 e AD-11.)

**Rationale:** torna o gráfico de hábitos (confirmado no MVP pela AD-11) um requisito
rastreável, com a semântica de anotação alinhada às AD-10/AD-11.

### Mudança 2 — Seção 7 (Sequência de Build)

**Arquivo:** mesmo PRD, seção 7.

**ANTES:** Brain Dump na Fase 5; Gestão de Usuários na Fase 6.

**DEPOIS:**
| Fase | Módulo | Critério de saída |
|---|---|---|
| 1b | Brain Dump | Caixa de entrada com indicador visual; captura rápida mobile (válvula de escape, UJ-4) |
| 5 | Gestão de Usuários | Convites + onboarding de amigos |

(Brain Dump movido para **1b** logo após a Fase 1; Gestão de Usuários renumerada 6 → 5
para fechar o gap. Fases 2, 3 e 4 inalteradas.)

**Rationale:** AD-15 — Brain Dump é trivial, desacoplado, e é a válvula de escape mobile;
antecipá-lo torna o produto utilizável em trânsito desde os primeiros estágios.

## 5. Handoff de Implementação

- **Classificação:** Minor.
- **Destino:** nenhuma ação de implementação pendente — mudanças são documentais e já
  aplicadas no PRD.
- **Critério de sucesso:** PRD consistente com a arquitetura (AD-11, AD-15). ✅ Atendido.
- **Observação:** quando a quebra em épicos/histórias for realizada, o gráfico de hábitos
  (FR-2.10) e o Brain Dump em Fase 1b já estarão refletidos no PRD-fonte.
