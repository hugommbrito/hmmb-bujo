# Requirements Traceability — HMMB BuJo

Companion canônico do `EXPERIENCE.md`. Nomes preservam a nomenclatura upstream do PRD; faixas agrupam apenas subrequisitos com superfície, status e gate homogêneos.

| ID + nomenclatura upstream | Superfície / fluxo | Status | Gate / fonte |
|---|---|---|---|
| FR-0.1 — isolamento de dados; FR-0.3 — ambientes dev/prod; FR-0.4 — múltiplos usuários | fundação | obrigação técnica | arquitetura + PRD |
| FR-0.2 — autenticação email/senha; FR-0.5 — recuperação de senha | Auth | UX diferida | x.0 do Épico 18 |
| FR-1.1 — núcleo BuJo não-gateável | App Shell Navigation | coberto | Story 13.0 |
| FR-1.2 — taxonomia de collections; FR-1.3 — manifest/registro | Index + App Shell | contrato de plataforma | PRD/addendum/arquitetura |
| FR-1.4 — Index; FR-1.5 — default all-off; FR-1.6 — granularidade da flag | Index/onboarding | diferido | gate UX do Épico 10 |
| FR-2.1 — BYO key; FR-2.2 — `ai_available`; FR-2.3 — tag função de IA; FR-2.4 — dados sensíveis | Configurações/IA | diferido | gate UX de IA/Análises |
| FR-3.1 — credencial de automação; FR-3.2 — captura por automação; FR-3.3 — resumo do dia; FR-3.4 — rate limit/auditoria; FR-3.5 — PWA não é captura | automação externa | handoff técnico | PRD/addendum |
| FR-4.1 — quatro tipos de log; FR-4.2 — data parcial no Future | Planner/Future | coberto | Fluxos 2, 5 e 6 |
| FR-4.3 — campos de tarefa; FR-4.4 — estados; FR-4.5 — `/` + `\\` = X; FR-4.6 — ordenação manual | Task Row + Dialog/Sheet | coberto | fluxos BuJo |
| FR-4.7 — migração diária | Hoje / ritual | coberto como subfluxo | Fluxo 1; UJ-1 integral no Épico 17 |
| FR-4.8 — migração semanal; FR-4.10 — semana fechada | Weekly | coberto | Fluxo 2 |
| FR-4.9 — abertura do mês | Monthly | coberto | Fluxo 5 |
| FR-4.11 — templates recorrentes; FR-4.12 — placement manual | Recorrentes/rituais | coberto | Fluxos 2 e 5 |
| FR-4.13 — arquivo | Arquivo | coberto | Fluxo 4 |
| FR-4.14 — nome às categorias; FR-4.15 — `waiting_on`; FR-4.16 — herança `started` | Task Row/detalhe/migração | obrigação downstream | architecture-and-story-handoff |
| FR-5.1 — inbox independente/vazia; FR-5.2 — campos; FR-5.3 — processamento manual; FR-5.4 — indicador persistente | Brain Dump + Capture Sheet + App Shell Badge | coberto | Fluxo 3 + Story 13.0 + Story 15.0 (`EXPERIENCE.md.Brain Dump e captura`) |
| FR-6.1 — Dashboard ponto de entrada; FR-6.2 — Dashboard=ver; FR-6.3 — Hoje=trabalhar; FR-6.4 — empty-state=Index; FR-6.5 — card por collection; FR-6.6 — indicadores | Dashboard-panorama + Hoje | diferido | x.0 ampliada do Épico 17 |
| FR-7.1 — grupos; FR-7.2 — campos; FR-7.3 — meta/bonus; FR-7.4 — completude; FR-7.5 — pesos; FR-7.6 — snapshot; FR-7.7 — desativação; FR-7.8 — reativação; FR-7.9 — histórico; FR-7.10 — gráfico/eventos | Hábitos | diferido | Story 16.0 |
| FR-8.1 — campos dinâmicos; FR-8.2 — log diário; FR-8.3 — histórico em três visualizações | Saúde-Métricas | diferido | Story 16.3 |
| FR-9.1 — entidade Medicamento; FR-9.2 — múltiplos blocos/doses; FR-9.3 — confirmação lote/individual; FR-9.4 — ativo/inativo e histórico | Medicamentos | diferido | Story 16.3 |
| FR-10.1 — campos de relato; FR-10.2 — ciclo seguro; FR-10.3 — `contexto_ia` off; FR-10.4 — múltiplas entradas; FR-10.5 — cadência/histórico; FR-10.6 — card no Hoje; FR-10.7 — absorção da Gratidão | Journalling/Gratidões | diferido | Story 16.10 |
| FR-11.1 — espelho foodLog; FR-11.2 — resumo/jejum; FR-11.3 — credenciais; FR-11.4 — resiliência; FR-11.5 — fonte de Análises; FR-11.6 — fora do MVP | Alimentação | diferido | gate UX da collection |
| FR-12.1 — medições/sessão; FR-12.2 — foto+IA; FR-12.3 — human-in-the-loop; FR-12.4 — fallback manual; FR-12.5 — evidência; FR-12.6 — média 7 dias; FR-12.7 — source; FR-12.8 — privacidade | Pressão Arterial | diferido | gate UX da collection |
| FR-13.1 — guardrail; FR-13.2 — Modelo de Relatório; FR-13.3 — dicionário; FR-13.4 — geração; FR-13.5 — exemplar; FR-13.6 — histórico; FR-13.7 — privacidade; FR-13.8 — consentimento/badges; FR-13.9 — source off; FR-13.10 — agendamento; FR-13.11 — relatórios médicos; FR-13.12 — resumo mensal | Análises | diferido | x.0 do Épico 21 |
| FR-14.1 — container coded; FR-14.2 — schema; FR-14.3 — tipos próprios; FR-14.4 — navegação; FR-14.5 — edição segura; FR-14.6 — empty-state; FR-14.7 — sem export; FR-14.8 — cidadania; FR-14.9 — logs do Canadá | Custom Collections | diferido | gate UX do Épico 19 |
| FR-15.1 — convites; FR-15.2 — isolamento; FR-15.3 — sem espaço compartilhado; FR-15.4 — competição no backlog; FR-15.5 — observabilidade/Index/onboarding; FR-15.6 — LGPD/consentimento | Gestão de Usuários | diferido ou em backlog, conforme o item | gate UX do Épico 10 + PRD |

## Jornadas

UJ-1 integral está diferida à x.0 ampliada do Épico 17; o Fluxo 1 do EXPERIENCE é somente o subfluxo Hoje. UJ-2–UJ-5 possuem Key Flows atuais. UJ-6, UJ-7 e UJ-8 permanecem diferidas a 16.10, 16.3 e 16.0.
