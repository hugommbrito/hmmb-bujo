# Story 16.0: [UX] Mockup de Hábitos no sistema novo (x.0 — gate do épico)

Status: done
baseline_commit: 86ae2210575a526ed347daaa1ea69ac9b179b153

> **Gate de execução:** apesar do status padronizado `ready-for-dev`, esta é uma story `x.0` de UX. Executar exclusivamente pelo rito **`bmad-ux` human-in-the-loop**. **Não executar com `dev-story` nem com story-automator.** As Stories 16.1–16.2 permanecem bloqueadas até esta story ser aprovada, promovida aos artefatos canônicos e marcada `done`.
>
> **Dependência de fila:** Épico 15 está `done` (retrospectiva concluída em 2026-07-31); esta é a primeira story do Épico 16, sem pendência upstream. Esta x.0 cobre **somente Hábitos** — Saúde-Métricas/Medicamentos ficam para a Story 16.3 (mesma sessão de `bmad-ux`, story separada) e Journalling/Gratidão para a Story 16.10.

## Story

Como Hugo,
Quero o mockup de Hábitos (tracker, config, histórico/gráfico) aprovado no bmad-ux,
Para que o módulo migre com pictogramas e padrão de registro definidos (UX-DR31, UX-DR27, DIR-15).

## Acceptance Criteria

1. **Escopo estrito das 3 superfícies do padrão Registro**

   **Dado que** o padrão Registro (data → registro → feedback → histórico) rege Hábitos/Saúde/Medicamentos/Gratidão e o módulo hoje vive em 3 rotas legado (`/habits` tracker, `/habits/history` histórico+gráfico, `/settings/habits` configuração),
   **Quando** a x.0 rodar,
   **Então** cobre exatamente essas 3 superfícies — tracker diário (booleano/numérico, agrupado, completude ponderada em %), configuração (grupos, hábitos, multiplicador por tipo de dia, ativar/desativar) e histórico (detalhe por-data, grade hábitos×dias, gráfico de evolução) —,
   **E** não redesenha Saúde, Medicamentos ou Gratidão (Stories 16.3/16.10) nem inventa superfície, rota ou dado ausente do inventário real.

2. **`iconKey` Phosphor + fallback emoji**

   **Dado que** a mudança de contrato do `iconKey` é story própria (16.2, UX-DR27), mas o mockup da 16.0 já precisa representar o resultado visual esperado,
   **Quando** cadastro, tracker, grade e histórico forem desenhados,
   **Então** cada hábito mostra um pictograma Phosphor monocromático (`currentColor`, decorativo quando há label) escolhido de um catálogo fechado e pesquisável, com fallback ao emoticon atual quando o hábito não tiver `iconKey` mapeado,
   **E** o mesmo pictograma/emoji aparece de forma consistente nas 4 superfícies (nenhuma usa emoji enquanto outra usa Phosphor para o mesmo hábito).

3. **Estados obrigatórios + "collection desligada/ausente" (DIR-12c)**

   **Dado que** DIR-12(c) exige o estado "collection desligada/ausente" em todo mockup e o módulo já tem estados funcionais próprios em produção,
   **Quando** os frames cobrirem as 3 superfícies,
   **Então** demonstra loading, vazio (sem hábito ativo no dia / sem grupo cadastrado / sem registro no período), erro de leitura e de escrita com retry, offline e o padrão "hábito inativo" (menor ênfase + chip textual "inativo", visível só com "Mostrar inativos", efeito prospectivo),
   **E** demonstra o destino "Hábitos" ausente da navegação quando a collection está desligada, sem link fantasma nem módulo disabled.

4. **Regras de domínio preservadas sem redesenho**

   **Dado que** completude ponderada (AD-06), multiplicador por tipo de dia (AD-10), versionamento prospectivo (mudança de peso/meta/bonus/ativação vale só a partir de hoje) e snapshot imutável por dia já são regras corretas no legado,
   **Quando** o mockup representar tracker, configuração e histórico,
   **Então** nenhuma dessas regras muda de comportamento — só a linguagem visual é substituída —,
   **E** o aviso "alteração vale a partir de hoje" e o override avulso de dia (tratar fim de semana/feriado como dia útil) permanecem representados.

5. **Gráfico de evolução preserva as decisões da Story 6.4**

   **Dado que** a Story 6.4 já fixou as decisões do primeiro gráfico do produto (eixo único, mudanças de configuração sempre anotadas em texto — AD-11 —, sombreamento de ritmo em vez de 2ª escala, sem linha de meta),
   **Quando** o mockup desenhar o gráfico de evolução,
   **Então** preserva essas decisões (sem dual-axis, sem linha de meta fabricada, com a grade acessível equivalente como tabela e não o gráfico),
   **E** qualquer divergência proposta é registrada explicitamente como decisão nova, nunca silenciosa.

6. **Promoção canônica e aprovação**

   **Dado que** o resultado aprovado precisa virar contrato antes da implementação,
   **Quando** Hugo aprovar o mockup,
   **Então** `DESIGN.md` e `EXPERIENCE.md` são atualizados somente com o que for novo/aprovado (catálogo de `iconKey` sugerido, anatomia do Registro para Hábitos, estados),
   **E** a story só fecha `done` após a promoção sem divergência silenciosa, liberando as Stories 16.1–16.2.

## Tasks / Subtasks

- [x] **1. Executar o rito `bmad-ux` e congelar o escopo** (AC: 1, 6)
  - [x] Confirmar que é x.0 human-in-the-loop, nunca `dev-story`/story-automator; nenhuma alteração em `frontend/`/`backend/` nesta story.
  - [x] Confirmar as 3 superfícies-alvo e a exclusão explícita de Saúde/Medicamentos/Gratidão (ficam para 16.3/16.10).
  - [x] Usar como autoridades, nesta ordem: `DESIGN.md`/`EXPERIENCE.md` vigentes, arquitetura (AD-06/AD-10/AD-11), PRD FR-7, comportamento real inventariado.
  - [x] Registrar toda divergência proposta; se exigir regra de produto nova, encaminhar upstream em vez de resolver visualmente.

- [x] **2. Inventariar as 3 superfícies legado e a regra de domínio** (AC: 1, 4, 5)
  - [x] Percorrer `/habits` (tracker), `/habits/history` (histórico + grade + gráfico) e `/settings/habits` (configuração).
  - [x] Documentar o tracker: grupos com `%` de completude, linha booleana (checkbox) e numérica (valor/meta/bonus/`%`), toggle "Feriado", override "tratar como dia útil", legenda de multiplicador quando ≠1.
  - [x] Documentar a configuração: criar grupo, criar hábito (booleano/numérico com campos condicionais), editar peso/meta/bonus/unidade com aviso "vale a partir de hoje", ativar/desativar, "Mostrar inativos".
  - [x] Documentar o histórico: controle de intervalo (período anterior/próximo), detalhe por-data read-only agrupado, seletor de hábito + gráfico de evolução, grade hábito×dia com alternativa em lista no mobile.
  - [x] Confirmar que nenhum desses comportamentos já existentes fica de fora do mockup — paridade é pré-requisito da Story 16.1, não desta.

- [x] **3. Produzir e aprovar o mockup canônico do módulo** (AC: 1, 2, 3, 5)
  - [x] Criar a exploração em `.working/` e promover a versão aprovada como `mockups/key-habitos.html` (confirmar nome exato com Sally durante o rito).
  - [x] Aplicar o padrão Registro (data → registro → feedback → histórico) às 3 superfícies com componentes canônicos do `DESIGN.md` vigente.
  - [x] Representar `iconKey` Phosphor + fallback emoji de forma consistente (AC2).
  - [x] Não inventar endpoint, schema, tipo de hábito, streak, ranking ou gamificação (voz factual, sem celebração).

- [x] **4. Fechar a matriz de estados funcionais** (AC: 3)
  - [x] Loading com skeleton da geometria real; shell/header estáveis.
  - [x] Vazio: sem grupo (config), sem hábito ativo no dia (tracker), sem registro no período (histórico/grade/gráfico) — nunca 0% fabricado.
  - [x] Erro de leitura com retry local e de escrita com entrada preservada.
  - [x] Offline: leitura/cache disponível quando existir; escrita indisponível com motivo.
  - [x] Hábito inativo: menor ênfase + chip textual "inativo", visível só com "Mostrar inativos".
  - [x] Collection "Hábitos" desligada/ausente: destino ausente da navegação, núcleo e Planner intactos, sem heading vazio nem item disabled (DIR-12c).

- [x] **5. Auditar regras de domínio sem redesenho** (AC: 4, 5)
  - [x] Completude ponderada (AD-06): booleano 100% do peso quando marcado; numérico proporcional 0%–(100%−bonus%) até a meta, 100% ao atingi-la; hábito inativo não entra no denominador.
  - [x] Multiplicador por tipo de dia (AD-10): vive no grupo, `weekday`=1.0 implícito, precedência `holiday > weekend > weekday` sem acumular; override avulso "tratar como dia útil" continua disponível.
  - [x] Snapshot imutável/versionamento prospectivo (AD-06): mudança de peso/meta/bonus/ativação só vale a partir de hoje; edição de dia passado é avulsa e não retroage a configuração.
  - [x] Gráfico (AD-11): mudanças reais sempre anotadas por texto; ritmo (fim de semana/feriado) é sombreamento, nunca confundido com mudança de config.

- [x] **6. Promover, reconciliar e obter aprovação explícita** (AC: 6)
  - [x] Atualizar `DESIGN.md` somente com anatomia/variantes/estados visuais aprovados que ainda não sejam canônicos.
  - [x] Atualizar `EXPERIENCE.md` somente com o comportamento/estados aprovados, substituindo as entradas "diferido à Story 16.0".
  - [x] Atualizar decision-log/requirements-traceability/validation-report apenas se o rito `bmad-ux` exigir e houver conteúdo novo.
  - [x] Obter aprovação explícita de Hugo; marcar `done` somente após promoção sem divergência silenciosa; só então liberar 16.1–16.2.

## Dev Notes

### Natureza desta story e fronteiras

- Esta story produz **decisões e artefatos UX**, não código de aplicação.
- **Não alterar `frontend/`, `backend/`, schema, OpenAPI, dependências ou testes automatizados nesta story.**
- Executor único: `bmad-ux` com aprovação humana de Hugo. **Não executar com `dev-story` nem story-automator** (mesma regra de 13.0/14.0).
- Escopo estrito: só Hábitos. Saúde-Métricas/Medicamentos ficam para a Story 16.3 (mesma sessão `bmad-ux`, story separada); Journalling/Gratidão fica para a 16.10. Não redesenhar essas três nem antecipar decisões delas.
- A Story 16.2 (mudança de contrato do `icon_key`) é implementação separada; esta x.0 só **representa** o resultado visual esperado, não define schema/migration.

### Inventário das 3 superfícies atuais (referência obrigatória, não alvo de edição nesta x.0)

- `frontend/src/pages/habits/HabitsPage.tsx` + `HabitsTabs.tsx` (abas "Hoje"/"Histórico"; **não** é item de Sidebar/BottomNav) → renderiza `HabitTracker`.
- `frontend/src/features/habits/components/HabitTracker.tsx`: grupos com `"{nome} · {completion}%"`, linha booleana (`Checkbox`) e numérica (`TextField` + `"X / meta (Y%)"` + `"Meta atingida"`), toggle "Feriado", botão "Tratar este dia como dia útil (peso cheio)" só quando `dayType≠weekday`, legenda `"peso ×N"` quando multiplicador≠1, vazio `"Nenhum hábito ativo hoje."`.
- `frontend/src/pages/habits/HabitHistoryPage.tsx` → renderiza `HabitHistory`.
- `frontend/src/features/habits/components/HabitHistory.tsx`: controle de intervalo (30 dias, período anterior/próximo), seletor de data com dia anterior/próximo, `DayDetail` read-only agrupado por `%`, seletor de hábito + `HabitEvolutionChart`, `HabitHistoryGrid`.
- `frontend/src/features/habits/components/HabitEvolutionChart.tsx`: `recharts` `LineChart`, eixo único (Y=`value`), `ReferenceArea` para bandas de fim de semana/feriado, `ReferenceLine` + lista textual "Mudanças no período" para cada `HabitVersion` nova, tooltip com data/valor/tipo de dia/mudança, `figcaption` com resumo textual (`role="img"` no container).
- `frontend/src/features/habits/components/HabitHistoryGrid.tsx`: tabela semântica hábito×dia (`<th scope="row">`/`<th scope="col">`), célula `"—"` para lacuna, `"✓"`/`"—"` para booleano, tag textual `"FDS"`/`"FER"` (nunca só cor), alternativa em lista por dia no mobile (`<768px`, sem scroll horizontal).
- `frontend/src/pages/settings/HabitsSettingsPage.tsx` → renderiza `HabitsManager` (rota `/settings/habits`).
- `frontend/src/features/habits/components/HabitsManager.tsx`: criar grupo, config de multiplicador por grupo (`"Fim de semana ×"`/`"Feriado ×"` com aviso "Alteração válida a partir de hoje..."), lista de hábitos por grupo com edição inline de peso/meta/bonus/unidade, toggle "Ativar"/"Desativar", "Mostrar inativos", criação de hábito com tipo booleano/numérico (campos condicionais meta/bonus/unidade só para numérico).
- `frontend/src/app/collections/registry.ts:96-119`: manifest atual da collection `habits` — ícone MUI `RepeatIcon` (será substituído pelo catálogo Phosphor `check-square` do App Shell, distinto do `iconKey` por-hábito), rotas `habits` e `habits/history`; `/settings/habits` é rota de Configurações, fora do manifest de collections.
- `backend/habits/models.py`: `HabitType` (`boolean`/`numeric`), `HabitGroup`, `Habit` (identidade), `HabitVersion` (config prospectiva versionada por `effective_from`), `HabitGroupDayMultiplier` (`weekend`/`holiday`, `weekday`=1.0 implícito), `HabitDayEntry` (snapshot congelado: `weight_at_time`/`meta_at_time`/`bonus_at_time`/`day_type`/`multiplier_at_time`). Nenhuma mudança de schema nesta story.

### Guardrails de arquitetura e produto

- **AD-06** (Snapshot de Hábitos): completude ponderada — booleano 100% do peso quando feito; numérico `0%→(100%−bonus%)` proporcional à meta, 100% ao atingi-la; hábito inativo não entra no denominador; edição de dia passado é avulsa (não retroage `habit_versions`).
- **AD-10** (Pesos por tipo de dia): multiplicador vive no **grupo**, não no hábito; `weekday`=1.0 implícito; precedência `holiday > weekend > weekday` sem acumular; congelado separado de `weight_at_time`.
- **AD-11** (Apresentação de mudanças de peso): mudanças reais de peso/meta/bonus/ativação são **sempre** anotadas em texto no gráfico (nunca só um marcador visual); `day_type`/`multiplier` são estilo/sombreamento, nunca confundidos com evento de mudança.
- **DIR-12(c):** todo mockup a partir de agora inclui o estado "collection desligada/ausente".
- **UX-DR27:** `iconKey` é mudança de contrato com story própria (16.2) — mockup representa o resultado, não implementa.
- **UX-DR31/DIR-15:** mockups de módulo são deliberadamente diferidos para a x.0 de cada onda — esta é a x.0 do lote de Hábitos (16.1–16.2).
- Épico 6 (Sistema de Hábitos) é MVP histórico e já `done` — as regras de negócio acima são autoridade herdada, não hipótese; qualquer mudança de regra é fora de escopo desta x.0.
- **Decisão de 2026-07-31 (retro Épico 15 + `bmad-correct-course`, formalizada no `epics.md`):** a verificação **formal** de acessibilidade (matriz axe-core por viewport, story dedicada de fechamento no molde de 13.4/15.3) foi **descontinuada a partir do Épico 16** — não propor essa matriz nem cobrar "axe-core + estados obrigatórios passam" como AC de fechamento. O comportamento acessível já embutido nos componentes compartilhados (tokens, foco, teclado, semântica MUI) permanece — só a verificação formal caiu. "Estados obrigatórios" (funcionais) continuam exigidos — é paridade, não a11y.

### Contrato visual e de voz

- Workspace canônico: `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/` (`DESIGN.md`/`EXPERIENCE.md` `status: final` vencem o workspace LEGACY 2026-06-15).
- Padrão **Registro** (`EXPERIENCE.md`): data → registro → feedback → histórico — mesmo padrão de Saúde/Medicamentos/Gratidão; esta story é a primeira aplicação prática.
- Pictogramas de domínio (`DESIGN.md`): Phosphor monocromático `currentColor`, decorativo quando há label, nome acessível quando sozinho; catálogo fechado e pesquisável; troca `regular`→`fill` reservada ao estado selecionado do App Shell (não se aplica ao `iconKey` de hábito). Ícone atual do destino "Hábitos" no App Shell é `check-square` (`DESIGN.md`, Catálogo Phosphor) — não confundir com o `iconKey` por-hábito (ex.: um hábito "Corrida" pode escolher outro ícone Phosphor).
- Emoji é fallback de migração, nunca o padrão novo — hábito sem `iconKey` mapeado continua exibindo o emoticon atual.
- Padrão "recorrente inativo" (State Patterns, `EXPERIENCE.md`) é o molde a reaplicar em "hábito inativo": menor ênfase + chip textual "inativo" (não só opacidade), visível apenas com "Mostrar inativos", efeito prospectivo.
- Voz pt-BR direta e factual — sem streaks, ranking, celebração ou gamificação (confirmado em "Módulos futuros previstos e estados diferidos": "Hábitos — Story 16.0: ... Sem streaks/ranking.").

### File Structure Requirements

Entregáveis esperados do futuro rito `bmad-ux`:

- `NEW` `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/mockups/key-habitos.html` (nome sugerido; confirmar convenção exata no rito — precedentes pt-BR: `key-recorrentes.html`, `key-migracao.html`)
- `UPDATE` `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/DESIGN.md` (somente itens novos/aprovados: catálogo `iconKey` de hábitos se definido nesta sessão, anatomia do Registro)
- `UPDATE` `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md` (substituir as entradas "diferido à Story 16.0" em "Módulos futuros previstos e estados diferidos", "Rastreabilidade UJ e aliases" (UJ-8) e "Rastreabilidade FR agrupada" (FR-7) pelo comportamento aprovado)
- `UPDATE` `.decision-log.md`, `requirements-traceability.md`, `validation-report.md` **somente se** o rito exigir e houver conteúdo novo
- Explorações ficam em `.working/`; só a versão aprovada entra em `mockups/`
- Nenhum arquivo de runtime (`frontend/`/`backend/`) deve constar na File List de conclusão desta story

### Testing Requirements

Nesta x.0, "teste" é validação de contrato UX, não execução de testes automatizados:

- aprovação visual explícita de Hugo;
- matriz AC → frame/anotação → fonte canônica → evidência;
- comparação direta com o comportamento real das 3 superfícies legado (Task 2) — nenhum comportamento existente pode desaparecer sem virar decisão registrada;
- estados funcionais cobertos: loading, vazio (3 variantes), erro de leitura/escrita, offline, hábito inativo, collection desligada/ausente;
- reconciliação final entre mockup, `DESIGN.md` e `EXPERIENCE.md`.

**Não inclui** matriz axe-core por viewport nem passo de fechamento de acessibilidade dedicado (descontinuado desde a retro do Épico 15 — ver Guardrails acima); responsividade básica (wide/medium/tablet/compact) permanece parte do `DESIGN.md` vigente, não é um gate novo desta story.

Os testes automatizados (Vitest/Playwright) entram na Story 16.1, que deve cobrir as 3 superfícies + o manifest da collection (`registry.ts`).

### Inteligência do trabalho anterior

- Stories 13.0/14.0: precedente direto do rito desta x.0 — exploração `.working/` → aprovação explícita → promoção a `mockups/` + `DESIGN`/`EXPERIENCE` → reconciliação. A 14.0 é o molde estrutural mais próximo (também uma x.0 de complemento pontual, não de fundação).
- Retro Épico 15 (2026-07-31) + `bmad-correct-course` no mesmo dia: descontinuou a verificação formal de acessibilidade a partir deste épico — ver Guardrails acima. Não reintroduzir esse escopo nesta story nem nas seguintes.
- Épico 6 (6.1–6.4, histórico, `done`): estabeleceu todas as regras de domínio auditadas na Task 5 e as decisões do gráfico — a Story 6.4 foi o 1º gráfico do produto e a origem das decisões da AD-11.

### Pesquisa técnica atual

- `package.json`: React `^19.2.0`, MUI `^6.1.0`, `@phosphor-icons/react` `^2.1.10`, `recharts` (mesma versão já usada por `HabitEvolutionChart.tsx`), TanStack Query `^5.59.0`.
- O gráfico atual já segue a prática recomendada de eixo único + tabela acessível equivalente — o mockup deve preservar essa decisão, não desenhar do zero.
- WCAG 2.2 permanece referência de bom design (não de verificação formal, ver Guardrails): [WCAG 2.2](https://www.w3.org/TR/WCAG22/)

### Project Structure Notes

- Habits já usa o manifest de collections (AD-17, `registry.ts`) para roteamento — a Story 16.1 troca só a linguagem visual das 3 páginas existentes, não a mecânica de roteamento/lazy-loading.
- `/settings/habits` fica fora do manifest de collections (é rota de Configurações), mas faz parte do mesmo módulo visual — o mockup deve tratar as 3 rotas como uma unidade coerente mesmo que fisicamente estejam em árvores de rota diferentes.
- Se a auditoria não encontrar necessidade de mudança em algum comportamento herdado, "cobertura suficiente" é o resultado correto — não produzir frame por volume.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-16-Onda-5--Módulos-Migração--Refinos--Journalling]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-16.0-UX-Mockup-de-Hábitos-no-sistema-novo-x.0--gate-do-épico]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-16.1-Hábitos-no-sistema-novo]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-16.2-Campo-icon_key-e-catálogo-Phosphor-mudança-de-contrato]
- [Source: _bmad-output/planning-artifacts/prds/prd-hmmb-bujo-2026-06-15/prd.md#FR-7--Hábitos]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-hmmb-bujo-2026-07-29/ARCHITECTURE-SPINE.md#AD-06--Snapshot-de-Hábitos-materialização-ansiosa--timeline-de-configuração]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-hmmb-bujo-2026-07-29/ARCHITECTURE-SPINE.md#AD-10--Pesos-Diferenciados-por-Tipo-de-Dia]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-hmmb-bujo-2026-07-29/ARCHITECTURE-SPINE.md#AD-11--Apresentação-de-Mudanças-de-Peso-anotação-por-stream-de-versões]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md#Padrões-de-página] (padrão Registro)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md#Pictogramas-de-hábitos-e-saúde]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md#Módulos-futuros-previstos-e-estados-diferidos]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md#State-Patterns]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md#Rastreabilidade-UJ-e-aliases]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/EXPERIENCE.md#Rastreabilidade-FR-agrupada]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/DESIGN.md#Catálogo-Phosphor-do-App-Shell]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/DESIGN.md#Pictogramas-de-domínio]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-07-31.md]
- [Source: _bmad-output/implementation-artifacts/epic-15-retro-2026-07-31.md]
- [Source: _bmad-output/implementation-artifacts/14-0-ux-mockups-complementares-do-nucleo-bujo.md]
- [Source: frontend/src/features/habits/components/HabitTracker.tsx]
- [Source: frontend/src/features/habits/components/HabitsManager.tsx]
- [Source: frontend/src/features/habits/components/HabitHistory.tsx]
- [Source: frontend/src/features/habits/components/HabitHistoryGrid.tsx]
- [Source: frontend/src/features/habits/components/HabitEvolutionChart.tsx]
- [Source: frontend/src/app/collections/registry.ts]
- [Source: backend/habits/models.py]

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (1M) — rito `bmad-ux` human-in-the-loop via `bmad-build`, sessão interativa de 2026-08-21. **Não** executado por `dev-story` nem story-automator, conforme o gate.

### Debug Log References

Entrada: handoff produzido por Hugo no Claude Design, em `docs/ux-handoffs/16-0`, copiado para `imports/story-16-0-habitos-handoff/` no workspace canônico. Decisões da sessão registradas em `.memlog.md` (entradas 16–30).

### Completion Notes List

**Doze decisões de Hugo destravaram o gate.** O handoff chegou com quatro bloqueios declarados (Q2, Q5, Q7+Q10, Q4) e seis definições de domínio pendentes; todas foram decididas nesta sessão antes de qualquer escrita em artefato.

1. **Q2 — o emoji sai da interface.** O handoff venceu o AC2 original desta story: `iconKey` é obrigatório, sem fallback de emoji. Consequência real: a Story 16.2 deixa de ser uma adição retrocompatível de campo e passa a carregar **migração de dado** (`emoticon` → `iconKey`); a 16.1 não exibe emoji. O AC2 acima permanece com o texto original congelado — o `epics.md` e os spines carregam a versão aprovada.
2. **Q5 — sem limite de retroatividade** na edição de dias passados. Nenhuma regra nova de backend.
3. **Q4 — "Registro em cards" é variante canônica**, não exceção local: Saúde-Métricas (16.3) reaproveita.
4. **Q7+Q10 — o limite "sem streaks/gamificação" foi revogado** como proibição de *métrica agregada*; a proibição de *celebração* permanece integralmente válida. As quatro leituras viraram a **Story 16.2b** (nova), posterior a 16.1/16.2. As superfícies 2e–2j seguem implementáveis na 16.1 sem depender disso.
5. Definições de domínio fixadas para a 16.2b: sequência atravessa inatividade, quebra em dia ativo sem registro, hoje é neutro; denominador é sempre "dias com registro"; numérico agrega por média simples; ano civil; dia com Σ pesos efetivos = 0 sai da contagem; teto de 4 cores com degradação para série única; semana parcial rotula os dias reais.

**Divergência de contrato encontrada e corrigida:** `architecture-and-story-handoff.md` chamava `iconKey` de "mudança contratual isolada, retrocompatível" — deixa de ser, pela decisão Q2.

**Divergência do delta de design system:** o pacote afirmava "nenhum token novo". Verdadeiro para **cores** (nenhuma cor nova), falso para geometria — 1120px, 520px, 44px de coluna de controle, 104px de campo, 8px/6px de barra e 6/4 colunas de grade não tinham endereço. Como Q4 promove "Registro em cards" a variante reutilizável, medida sem token seria inendereçável; 4 blocos foram adicionados com valores literais do handoff.

**Verificação formal de acessibilidade não foi reintroduzida** — descontinuada desde a retro do Épico 15. Os estados funcionais obrigatórios (paridade) foram cobertos normalmente.

**Reviewer Gate (rubric walker, lente escolhida por Hugo):** 0 critical, 3 high, 3 medium, 4 low. O critical da rodada 15.0 (referências de token quebradas) **não reincidiu** — 452 tokens, 0 quebras. Os 3 high foram corrigidos nesta sessão: (1) UJ-8/FR-7 saíram de "diferido" sem Key Flow → criado o **Fluxo 9 — Configurar e registrar hábitos**; (2) catálogo bilateral dessincronizado (5 linhas no DESIGN, 1 no EXPERIENCE) → 4 linhas comportamentais adicionadas e `Hábitos` renomeado para `Hábitos (Registro)` para casar por nome; (3) **DIR-12c ausente** — o handoff não cobriu "collection desligada/ausente" apesar de ser AC3 desta story, e a recusa da 15.0 não valia porque Hábitos **é** collection gateável → fechado por contrato comportamental (linha em State Patterns), decisão de Hugo. Relatório completo em `review-rubric.md`.

**Decisão posterior à revisão visual (2026-08-22):** Hugo inverteu o canal de leitura da grade hábitos × períodos — o **tom** virou canal primário, em **escala contínua** (alpha = completude da própria célula; booleano usa a razão real da fração), com o número recuando para a cor do próprio fundo um degrau mais escura. Isso revogou duas regras escritas horas antes neste mesmo gate ("o número é o canal primário" e "nenhuma célula abaixo de 4,5:1") e criou a **única exceção nomeada ao piso de contraste** do produto, registrada em `EXPERIENCE.md.Accessibility Floor` e sustentada pela tabela equivalente permanente em `details`.

**Nenhum arquivo de runtime foi tocado:** `frontend/`, `backend/`, schema, OpenAPI, dependências e testes automatizados permanecem intactos, como exige a fronteira desta x.0.

### File List

**Promoção canônica (workspace `_bmad-output/planning-artifacts/ux-designs/ux-hmmb-bujo-2026-07-17/`):**

- `UPDATE` `DESIGN.md` — seções novas `Hábitos (Registro)` e `Seleção de pictograma`; `Grid/Calendar`, `Dialog/Sheet` e `Pictogramas de domínio` estendidos/reescritos; 5 linhas no catálogo bilateral; 4 blocos de token de geometria; `updated: 2026-08-21`
- `UPDATE` `EXPERIENCE.md` — seção nova `Hábitos`; `Pictogramas de hábitos e saúde` reescrita; 5 linhas em State Patterns; 1 em Component Patterns; fronteira de Voice and Tone; 1 em Decisions for Architecture; todas as marcações "diferido à Story 16.0" substituídas; `updated: 2026-08-21`
- `UPDATE` `architecture-and-story-handoff.md` — seção `M12 — Hábitos`; correção da linha "retrocompatível" no Checklist
- `UPDATE` `requirements-traceability.md` — FR-7 de `diferido` para `coberto`; UJ-8 fechada
- `NEW` `reconcile-story-16-0-habitos.md` — reconciliação da entrada, decisões Q1–Q10, Reviewer Gate, divergências resolvidas e escopo não promovido
- `NEW` `review-rubric.md` — relatório do Reviewer Gate (o da rodada 15.0 preservado como `review-rubric-15-0-brain-dump.md`)
- `UPDATE` `EXPERIENCE.md` — **Fluxo 9** acrescentado aos Key Flows
- `NEW` `mockups/key-habitos.html` — mockup canônico (F1–F12, O1–O2, E1–E6 + F13–F15 isolados como alvo da 16.2b)
- `NEW` `imports/story-16-0-habitos-handoff/` — pacote de origem preservado como evidência
- `UPDATE` `.memlog.md` — 15 entradas novas (decisões e mudanças)

**Planejamento:**

- `UPDATE` `_bmad-output/planning-artifacts/epics.md` — bloco de resultado do gate na 16.0; AC da 16.1 e da 16.2 corrigidos; **Story 16.2b nova**; UX-DR13 e UX-DR19 qualificadas
- `UPDATE` `_bmad-output/implementation-artifacts/sprint-status.yaml` — chave `16-2b-leituras-agregadas-de-habitos` adicionada

Nenhum arquivo em `frontend/` ou `backend/`.
