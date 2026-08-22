---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments:
  - _bmad-output/planning-artifacts/plano-de-acao-ui-e-ideias-2026-07-21.md
  - _bmad-output/brainstorming/brainstorming-session-2026-07-21-1751.md
  - docs/futureIdeas.md
workflowType: 'research'
lastStep: 6
research_type: 'technical'
research_topic: 'Viabilidade técnica dos [TR] da Trilha B: C5 mobile/Shortcuts/widgets (#7/#8), query IA persistida / Modelo de Relatório (#12, C2 fases b-c) e Pressão Arterial por foto+IA (#20)'
research_goals: 'Resolver a viabilidade dos três [TR] definidos no brainstorming de 2026-07-21 para fechar a Trilha B e destravar o gate de convergência rumo ao correct-course: (1) C5 — Shortcuts iPhone com JWT, widgets sem app nativo, PWA/deep links; (2) #12 — segurança de query gerada por IA, agendamento de Modelos de Relatório e formato de saída da fase b; (3) #20 — acurácia/custo/privacidade de vision LLM lendo monitor de PA e modelo de dados'
user_name: 'HugoMMBrito'
date: '2026-07-22'
web_research_enabled: true
source_verification: true
---

# Research Report: technical

**Date:** 2026-07-22
**Author:** HugoMMBrito
**Research Type:** technical

---

## Research Overview

Esta pesquisa resolve a viabilidade técnica das três investigações [TR] pendentes da Trilha B do plano de ação 2026-07-21, com dados web atuais (2024–2026) verificados em fontes oficiais (Apple/WebKit, OWASP, Anthropic, HL7/FHIR, AHA, Planalto/LGPD) e literatura acadêmica. A metodologia usou três agentes de pesquisa paralelos (um por investigação), com citação de URL e nível de confiança por achado, seguidos de síntese cruzada.

**Veredicto em uma linha por TR:** (1) **C5 Mobile** — Shortcuts chamando a API diretamente é o caminho de captura rápida (esforço P), com **token de automação dedicado** em vez de JWT refresh; widgets de PWA **não existem no iOS** (hipótese confirmada, incl. iOS 26) — o widget "resumo do dia" viável sem app é via **Scriptable**; o wrapper nativo fica adiado (esforço G + US$ 99/ano). (2) **#12 Análises** — **nunca persistir SQL gerado por IA**; o Modelo de Relatório deve ser um **DSL JSON compilado server-side** (mini semantic layer); formato da fase b decidido: **texto + gráficos** com a IA devolvendo blocos estruturados que referenciam séries pré-computadas pelo backend, renderizados com Recharts; fase c viável com **django-q2**; custo < US$ 1/mês. (3) **#20 Pressão Arterial** — foto+IA é **viável e barata** (~US$ 0,002/leitura no Haiku 4.5), **somente com confirmação humana obrigatória** (o modo de falha típico de vision LLM é alucinar um número plausível); LGPD não se aplica hoje (exceção doméstica, art. 4º I), mas o Épico 10 exige consentimento; modelo de dados definido segundo FHIR/HealthKit + protocolo 7-2-2.

O sumário executivo completo, os veredictos detalhados por pergunta e o handoff para o `[CC] bmad-correct-course` estão na seção **Research Synthesis** ao final do documento.

---

## Technical Research Scope Confirmation

**Research Topic:** Viabilidade técnica dos [TR] da Trilha B: C5 mobile/Shortcuts/widgets (#7/#8), query IA persistida / Modelo de Relatório (#12, C2 fases b-c) e Pressão Arterial por foto+IA (#20)

**Research Goals:** Resolver a viabilidade dos três [TR] definidos no brainstorming de 2026-07-21 para fechar a Trilha B e destravar o gate de convergência rumo ao correct-course.

**Escopo herdado (pré-confirmado pelo usuário na seção "Escopo dos [TR]" do doc de brainstorming 2026-07-21):**

1. **C5 (#7/#8) — Mobile/automação:**
   - Shortcuts do iPhone chamando a API REST diretamente: autenticação JWT em Shortcuts (armazenamento do token, refresh, expiração), payloads de captura rápida.
   - Widgets de home screen sem app nativo: existe caminho (iOS)? Hipótese: não — confirmar e estimar custo de um app wrapper mínimo (Capacitor/Expo) só para widgets.
   - PWA instalável + deep links / share sheet como alternativa de captura sem app.
2. **#12 (C2 fase c) — Query IA persistida:** segurança (role read-only, sandbox, validação/allowlist de SQL), versionamento das queries salvas, custo de tokens, mecanismo de refresh do gráfico do dashboard. Alvo concreto: entidade **Modelo de Relatório** (Mergulho 3); fase c = rodar modelos em agenda. Inclui o **formato de saída da fase b** (texto vs texto+gráficos gerados pela IA).
3. **#20 — Pressão arterial foto+IA:** acurácia de vision LLM/OCR lendo display de monitor de PA, custo por leitura, privacidade (dado de saúde), fluxo de confirmação/fallback manual, modelo de dados (N medições/dia com sistólica/diastólica/pulso).

**Fora de escopo:** #5a (consumir foodLog — dispensado de TR; decisão arquitetural leve no CC).

**Research Methodology:**

- Dados web atuais (2024–2026) com verificação rigorosa de fontes; três agentes de pesquisa paralelos, um por TR
- Validação multi-fonte para afirmações críticas; fontes oficiais priorizadas (Apple/WebKit/MDN, OWASP, Anthropic, HL7, AHA, Planalto)
- Nível de confiança (Alto/Médio/Baixo) por achado; extrapolações e inferências marcadas explicitamente
- Preços de modelos de IA verificados na documentação vigente da Anthropic (referência oficial carregada em 2026-07-22)

**Scope Confirmed:** 2026-07-22 (escopo herdado da sessão de brainstorming 2026-07-21, rito executado autonomamente conforme plano de ação)

---

## Technology Stack Analysis

_Contexto de versões: pesquisa feita em julho/2026. iOS 26 (anunciado na WWDC25) é a versão corrente; fatos herdados de iOS 16.4/17/18 seguem válidos salvo indicação. Stack do produto: Django REST Framework + Postgres, React SPA (Vite, TanStack Query), JWT (access+refresh), 1 container/VPS, single-user hoje._

### TR-1 (C5) — Plataformas de captura mobile no iOS

**iOS Shortcuts (nativo, sem custo):**

- A ação **"Get Contents of URL"** suporta GET/POST/PUT/PATCH/DELETE, headers customizados (incl. `Authorization: Bearer`) e corpo JSON/Form/File; parsing de resposta via "Get Dictionary from Input" + "Get Value for Key".
  _Fonte: [Request your first API in Shortcuts — Apple Support](https://support.apple.com/guide/shortcuts/request-your-first-api-apd58d46713f/ios)_ · Confiança: **Alto**
- **Gatilhos de automação que rodam sem confirmação** (guia iOS 26): horário, alarme, sono, chegar/sair de local, NFC, foco, carregador, nível de bateria, Wi-Fi/Bluetooth, app abrir/fechar, transação Wallet, e-mail/mensagem, entre outros. **Back Tap** (toque duplo/triplo na traseira) executa atalho imediatamente — excelente para captura rápida. Ponto único listado como incapaz de rodar automático: "Before I Commute".
  _Fontes: [Enable or disable a personal automation — Apple Support (iOS 26)](https://support.apple.com/guide/shortcuts/enable-or-disable-a-personal-automation-apd602971e63/ios), [Run shortcuts by tapping the back of your iPhone — Apple Support](https://support.apple.com/guide/shortcuts/run-shortcuts-tapping-iphone-apd897693606/ios)_ · Confiança: **Alto**
- **Limites**: timeout curto e não configurável (~25 s segundo relatos de fórum — número com confiança Baixa); sem retry nativo; montagem de JSON aninhado no editor visual é penosa/bugada → payloads rasos são obrigatórios na prática.
  _Fontes: [Apple Community thread 254691588](https://discussions.apple.com/thread/254691588), [Automators Talk](https://talk.automators.fm/t/get-contents-from-url/17822), [Apple Developer Forums 720728](https://developer.apple.com/forums/thread/720728)_ · Confiança: **Médio**

**Scriptable / Widgy / Pushcut (widgets sem app próprio):**

- **Scriptable** (grátis): API `Request` (métodos, headers, body, `timeoutInterval`, `loadJSON()`), API **`Keychain`** (armazenamento criptografado do token — mais seguro que campo de texto num atalho) e `ListWidget` para montar o widget. Ecossistema maduro de widgets consumindo APIs JSON.
  _Fontes: [Request — Scriptable Docs](https://docs.scriptable.app/request/), [Keychain — Scriptable Docs](https://docs.scriptable.app/keychain/), [ListWidget — Scriptable Docs](https://docs.scriptable.app/listwidget/)_ · Confiança: **Alto**
- **Widgy**: widgets visuais com fonte JSON via URL + campo Bearer Token (menos programável). **Pushcut**: widgets alimentados por webhook (push) + notificações que disparam atalhos.
  _Fontes: [nocodesaas.io — iOS widget via JSON](https://www.nocodesaas.io/p/how-to-create-an-ios-widget-to-track), [Widgets — Pushcut](https://www.pushcut.io/support/widgets)_ · Confiança: **Médio/Alto**
- **Orçamento de refresh do WidgetKit** (vale para qualquer widget, incl. Scriptable): 40–70 refreshes/dia ≈ um reload a cada 15–60 min. Widget "resumo do dia" com atraso de até ~1 h é o cenário realista; tocar no widget pode rodar o script/abrir URL (widget = vitrine + botão).
  _Fonte: [Keeping a widget up to date — Apple Developer](https://developer.apple.com/documentation/widgetkit/keeping-a-widget-up-to-date)_ · Confiança: **Alto**

**Wrapper nativo (Capacitor/Expo) só para widgets:**

- O widget é **sempre nativo (SwiftUI + WidgetKit)** — nem Capacitor nem React Native renderizam UI de widget em JS. Capacitor: plugin da comunidade (Capgo) adiciona o target + ponte via App Group; Expo: config plugin `@bacons/apple-targets` gera o target, mas o código do widget continua Swift.
  _Fontes: [Cap-go/capacitor-widget-kit — GitHub](https://github.com/Cap-go/capacitor-widget-kit), [EvanBacon/expo-apple-targets — GitHub](https://github.com/EvanBacon/expo-apple-targets)_ · Confiança: **Alto**
- Custos: Apple Developer Program **US$ 99/ano**; TestFlight com builds expirando em 90 dias; conta gratuita re-assina a cada 7 dias (inviável como solução permanente); sideloading DMA é só UE (usuário no Brasil).
  _Fontes: [Choosing a Membership — Apple Developer](https://developer.apple.com/support/compare-memberships/), [myByways — free account limitations](https://mybyways.com/blog/new-limitations-imposed-on-free-apple-developer-account)_ · Confiança: **Alto**

**PWA no iOS/Safari (2025-2026):**

- **Novidade do iOS 26**: todo site adicionado à Home Screen abre como web app standalone por padrão (mesmo sem manifest), com toggle para sair. Push para PWA instalada desde iOS 16.4 (+ Declarative Web Push no Safari 18.4); badging OK; **sem Background Sync/Periodic Sync**.
  _Fontes: [News from WWDC25: WebKit in Safari 26 beta — webkit.org](https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/), [MagicBell — PWA iOS guide (mar/2026)](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)_ · Confiança: **Alto**
- **Eviction de 7 dias — nuance**: PWAs instaladas têm contador próprio de "dias de uso" resetado pelo uso real; uma PWA usada regularmente não sofre eviction (o risco real é abandono prolongado).
  _Fonte: [Full Third-Party Cookie Blocking and More — WebKit Blog](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/)_ · Confiança: **Alto**

### TR-2 (#12) — Stack para Análises com IA

- **Parsing/validação SQL**: sqlglot (parser AST Python, sem dependências) — camada de validação se SQL cru fosse mantido; `statement_timeout` do Postgres contra queries caras.
  _Fonte: [sqlglot — GitHub](https://github.com/tobymao/sqlglot)_ · Confiança: **Alto**
- **Semantic layers** (padrão de mercado 2025-2026 para IA consultar dados): Cube ("LLMs query through the semantic layer, not around it"), dbt Semantic Layer/MetricFlow (métricas em YAML versionado) — precedentes diretos do "DSL de métricas registradas".
  _Fontes: [Semantic Layer for AI Agents (2026) — Cube](https://cube.dev/articles/semantic-layer-for-ai-agents-2026), [dbt Semantic Layer vs Cube](https://unwinddata.com/dbt-semantic-layer-vs-cube)_ · Confiança: **Alto**
- **Structured outputs**: decodificação restrita garante conformidade a JSON Schema (benchmark JSONSchemaBench, 10 mil schemas reais); na API Anthropic, `output_config.format` com `json_schema` (sem schemas recursivos; `additionalProperties: false`; limites numéricos validados server-side).
  _Fontes: [JSONSchemaBench (arXiv 2501.10868)](https://arxiv.org/pdf/2501.10868), [Structured Outputs — Anthropic Docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs.md)_ · Confiança: **Alto**
- **Schedulers Django** (deploy de 1 container): **django-q2** (broker no ORM/Postgres — zero infra nova, retries, admin) > Celery Beat (exige Redis/RabbitMQ + processos extras — overkill) > APScheduler (in-process, frágil com múltiplos workers Gunicorn) > cron do host (sem retry/visibilidade) > pg_cron (só SQL, não faz HTTP → inadequado).
  _Fontes: [Celery vs Django Q2 — TechNetExperts](https://www.technetexperts.com/celery-vs-django-q2-architecture/), [Lightweight Django Task Queues in 2025 — Medium](https://medium.com/@g.suryawanshi/lightweight-django-task-queues-in-2025-beyond-celery-74a95e0548ec), [APScheduler vs Celery Beat — Leapcell](https://leapcell.io/blog/scheduling-tasks-in-python-apscheduler-vs-celery-beat)_ · Confiança: **Alto**
- **Charting**: Recharts (ecossistema React já usado no produto, sem linguagem de expressão embutida) vs Vega-Lite (alvo padrão da literatura NL2VIS, porém com CVEs recentes de XSS via expressões Vega — "declarativo ≠ inerte").
  _Fontes: [Vega XSS advisory GHSA-829q-m3qg-ph8r](https://github.com/vega/vega/security/advisories/GHSA-829q-m3qg-ph8r), [CVE-2025-59840](https://github.com/advisories/GHSA-7f2v-3qq3-vvjf)_ · Confiança: **Alto**

### TR-3 (#20) — Stack para leitura de display por IA

- **Vision LLMs vs alternativas** para displays de 7 segmentos:

| Abordagem | Acurácia | Esforço | Observação |
|---|---|---|---|
| Tesseract (OCR tradicional) | 20,2%/14,3% em fotos boas — inutilizável | baixo | Espera glifos contíguos; 7 segmentos têm lacunas |
| ssocr (dedicado 7-seg) | boa só em condições controladas | baixo-médio | Frágil para foto casual de celular |
| Modelo treinado (YOLO/CNN) | 90–99% (estado da arte) | **alto** (dataset+treino+MLOps) | Over-engineering para app pessoal |
| **Vision LLM generalista** | sem número publicado p/ este nicho | **mínimo** (1 chamada API) | Melhor relação esforço/resultado **com confirmação humana** |

  _Fontes: [CNN-Based LCD Transcription of Blood Pressure From a Mobile Phone Camera (Frontiers in AI, 2021)](https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2021.543176/full), [Automated Digit Recognition from BP Monitor Images (MDPI Algorithms 18(7):377, 2025)](https://www.mdpi.com/1999-4893/18/7/377), [ssocr](https://www.unix-ag.uni-kl.de/~auerswal/ssocr/)_ · Confiança: **Alto** (dedicados) / **Médio** (LLMs, evidência indireta)
- **Preços vigentes Anthropic** (confirmados 2026-07-22, por MTok input/output): **Haiku 4.5 $1/$5 · Sonnet 4.6 $3/$15 (Sonnet 5 intro $2/$10 até 31/08/2026) · Opus 4.8 $5/$25 · Batch API −50%**. Tokens de imagem: patches de 28×28 px (`⌈w/28⌉ × ⌈h/28⌉`); 1000×1000 px ≈ 1.296 tokens; modelos high-res chegam a 4.784 tokens se a foto for enviada em alta resolução (evitável redimensionando).
  _Fontes: [Pricing — Anthropic Docs](https://platform.claude.com/docs/en/about-claude/pricing), [Vision — Claude Docs](https://platform.claude.com/docs/en/build-with-claude/vision)_ · Confiança: **Alto**

---

## Integration Patterns Analysis

### Autenticação para automação (C5, reaproveitada pelo #20)

- **Padrão recomendado: token de automação dedicado de longa duração** (o padrão consagrado do Home Assistant — caso mais documentado de Shortcuts + API autenticada: token de 10 anos, `Authorization: Bearer TOKEN`). Tradução para DRF + simplejwt: **modelo próprio "AutomationToken"** (ou DRF TokenAuth/Knox) com escopo restrito aos endpoints de captura/resumo, revogável, sem refresh.
  _Fontes: [REST API — Home Assistant Developer Docs](https://developers.home-assistant.io/docs/api/rest/), [Authentication — Home Assistant](https://www.home-assistant.io/docs/authentication/)_ · Confiança: **Alto**
- **JWT refresh dentro de atalho: evitar.** Tecnicamente possível (chamada ao endpoint de refresh → extrair JSON → reusar), mas nenhum exemplo real publicado foi encontrado, e com `ROTATE_REFRESH_TOKENS` o atalho precisaria persistir o novo refresh token entre execuções (só via Data Jar/arquivo — frágil). Confiança: **Médio** (inferência; a ausência de exemplos é um sinal).
- **Armazenamento do token**: no app Atalhos, o token fica em campo de texto legível (risco se o atalho for compartilhado/telefone desbloqueado); no **Scriptable, usar a API Keychain** (banco criptografado). Exemplo real do padrão completo (POST /api/auth → colar token no atalho): _[Grimoire discussion #140 — GitHub](https://github.com/goniszewski/grimoire/discussions/140)_ · Confiança: **Alto**

### Endpoints de integração (pré-requisitos de backend consolidados)

1. **`POST /api/capture`** (ou por domínio): payload **raso** `{type, text, value?}` (o editor de JSON aninhado do Shortcuts é penoso), resposta curta `201` — amigável ao "Get Dictionary from Input".
2. **`GET /api/summary/today`**: JSON raso e agregado (tarefas pendentes, hábitos do dia, última gratidão) — 1 chamada alimenta o widget Scriptable.
3. **Rate limiting + logging** (DRF throttling) nos endpoints de automação, já pensando no Épico 10.
4. **Ingestão preparada para `source: import`** (#20): o mesmo endpoint de medições aceita POST vindo de Shortcuts→Apple Health (futuro monitor Bluetooth), sem retrabalho de modelo.

### Captura via share sheet e deep links (C5)

- **Web Share Target API: NÃO suportada no iOS/Safari** (2025-2026; bug WebKit aberto desde 2019) — a PWA não pode receber compartilhamentos.
  _Fontes: [share_target — MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/share_target), [Bug 194593 — bugs.webkit.org](https://bugs.webkit.org/show_bug.cgi?id=194593)_ · Confiança: **Alto**
- **Deep links para PWA instalada: não funcionam no iOS** — qualquer URL aberta de fora (incluindo "Open URL" de um atalho) abre no **Safari**, não no app standalone (única exceção: tap em notificação push). Agravante: Safari e PWA standalone têm storage separado (sessões distintas). Consequência: captura a partir de atalho deve ir **direto na API**, nunca via navegação para `/capture?...`.
  _Fontes: [Complete Guide to PWA Deep Links — Progressier](https://intercom.help/progressier/en/articles/6902113-complete-guide-to-pwa-deep-links), [WICG/pwa-url-handler issue #43](https://github.com/WICG/pwa-url-handler/issues/43)_ · Confiança: **Alto**
- **Substituto do share target: um atalho exposto na share sheet** recebe o input compartilhado (URL/texto/imagem) e faz POST na API — replica o Web Share Target sem depender do Safari.
  _Fonte: [Understanding input types in Shortcuts — Apple Support](https://support.apple.com/guide/shortcuts/input-types-apd7644168e1/ios)_ · Confiança: **Alto**

### Integração com IA (padrão comum a #12 e #20)

- **Structured outputs com JSON Schema estrito** em ambas as features (garantia de parse; campos `null` + flag de legibilidade no #20; blocos tipados no #12). A **BYO key global** (decisão da Rodada 4 do brainstorming) serve as duas — a capability `ai_available` gateia os dois fluxos.
- **Ponte Shortcuts → Apple Health → API (#20, alternativa sem foto)**: a ação "Find Health Samples" existe e cobre pressão arterial; há precedente documentado da ponte completa Shortcuts→Health→POST em API própria. Vale um teste de 10 min no iPhone antes de decidir — não foi achada demonstração específica com PA.
  _Fonte: [Using Shortcuts and serverless to build a personal Apple Health API — Maxime Heckel](https://blog.maximeheckel.com/posts/build-personal-health-api-shortcuts-serverless/)_ · Confiança: **Médio**
- **APIs de fabricantes (#20)**: **Withings** tem API pública real (OAuth2, gratuita para indivíduos, endpoint de medidas com sis/dia) — a melhor do segmento; Omron ("Connect Create") é B2B/burocrática; Qardio sem API pública (caminho = Apple Health).
  _Fontes: [Withings Developer Portal](https://developer.withings.com/), [Omron Connect Create](https://omron-connect-create.readme.io/docs/getting-started)_ · Confiança: **Alto/Médio**

---

## Architectural Patterns and Design

### Segurança de query gerada por IA (#12) — o coração do TR

**Riscos comprovados de persistir SQL gerado por LLM:**

- **OWASP Top 10 for LLM Applications 2025**: LLM01 (Prompt Injection — instruções e dados no mesmo canal; texto salvo pelo usuário em anotações/journalling pode ser interpretado como instrução) + LLM05 (Improper Output Handling — executar saída do LLM como confiável → SQL injection). As duas se compõem: injeção no prompt → saída maliciosa → aplicação executa. Um SQL **persistido e re-executado automaticamente** (fase c) amplia a janela de ataque.
  _Fonte: [OWASP Top 10 for LLM Applications 2025 (PDF oficial)](https://owasp.org/www-project-top-10-for-large-language-model-applications/assets/PDF/OWASP-Top-10-for-LLMs-v2025.pdf)_ · Confiança: **Alto**
- Ataques **prompt-to-SQL demonstrados academicamente** em apps web reais (ICSE 2025); defesas avaliadas: restrição de roles, reescrita de query, pré-carregar dados autorizados, LLM guard.
  _Fonte: [Prompt-to-SQL Injections in LLM-Integrated Web Applications (ICSE'25)](https://syssec.dpss.inesc-id.pt/papers/pedro_icse25.pdf)_ · Confiança: **Alto**
- O NCSC alerta: **prompt injection não tem equivalente a prepared statements** — a arquitetura deve assumir que a saída do LLM pode ser hostil.
  _Fonte: [Prompt injection is not SQL injection — NCSC](https://www.ncsc.gov.uk/blog-post/prompt-injection-is-not-sql-injection)_ · Confiança: **Alto**

**Arquitetura recomendada — DSL compilado (mini semantic layer):**

> O Modelo de Relatório persiste uma **spec JSON** `{metricas: [do catálogo registrado em código], agregacao, periodo, filtros: [range de datas + igualdade/existência]}`, validada por **JSON Schema + allowlist de métricas**, e **compilada server-side para QuerySets do ORM** — nunca SQL cru. A IA (ou o usuário via UI) produz/edita a spec; o backend é o único que toca o banco. Defesa em profundidade barata mesmo com DSL: **role Postgres read-only** para o caminho de leitura de relatórios + **`statement_timeout`**; **RLS** quando o app virar multi-usuário (Épico 10).
  _Fontes: mitigações e RLS — [Row Level Security for Tenants — Crunchy Data](https://www.crunchydata.com/blog/row-level-security-for-tenants-in-postgres), [Multi-tenant RLS — AWS](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security)_ · Confiança: **Alto**

### Formato de saída da fase b (#12) — decisão amarrada a este TR

Três padrões existem na literatura/indústria: (1) LLM devolve **código executável** (LIDA) — inseguro por definição (LLM05) e caro de sandboxar; (2) LLM devolve **spec declarativa** (Vega-Lite — padrão dominante nos benchmarks NL2VIS: VisEval, nvBench); (3) LLM devolve **só texto** sobre agregados do backend. LLMs de ponta geram specs Vega-Lite majoritariamente válidas, mas com erros residuais de "legalidade" (gráfico válido porém errado) — e Vega tem linguagem de expressão embutida com CVEs recentes de XSS.
_Fontes: [LIDA (arXiv 2303.02927)](https://arxiv.org/abs/2303.02927), [VisEval (arXiv 2407.00981)](https://arxiv.org/pdf/2407.00981), [Visualization Generation with LLMs (arXiv 2401.11255)](https://arxiv.org/abs/2401.11255)_ · Confiança: **Alto**

**Decisão recomendada: texto + gráficos, com divisão de responsabilidade.** O backend computa as séries/agregados (a partir do DSL — dados determinísticos, nunca inventados pela IA); o LLM devolve JSON estruturado com blocos ordenados:

```json
{ "blocos": [
  {"tipo": "texto", "markdown": "..."},
  {"tipo": "grafico", "chart": {"tipo": "linha|barra|area|heatmap", "serie_ref": "adesao_medicamento_x", "titulo": "...", "anotacoes": []}},
  {"tipo": "tabela", "serie_ref": "...", "colunas": []}
]}
```

Ponto-chave: o LLM referencia séries pré-computadas por ID (`serie_ref`) — **não embute dados nem escreve spec Vega completa**; escolhe tipo de gráfico, título e destaques. Frontend renderiza com **Recharts**. Isso preserva o guardrail DR19 do produto (IA analisa/explica; números vêm do backend), garante parse confiável e evita tanto código executável quanto a superfície de expressões do Vega. Vega-Lite fica como opção futura para gráficos ad-hoc mais ricos (com `renderer: 'canvas'` e interpretador seguro). · Confiança: **Alto**

### Versionamento e ancoragem por exemplar (#12)

- **Padrão prompt-registry**: cada mudança de prompt/spec é uma versão **imutável**; cada geração grava snapshot congelado de {prompt renderizado, versão da spec do DSL, exemplar/versão usado, modelo, usage} — no app pessoal, uma tabela `GeracaoRelatorio` com snapshots (não FKs "vivas"). O **exemplar adotado** vira entidade versionada própria; trocá-lo cria nova versão do modelo.
  _Fontes: [What is prompt versioning — Braintrust](https://www.braintrust.dev/articles/what-is-prompt-versioning), [MLflow Prompt Registry](https://mlflow.org/prompt-registry)_ · Confiança: **Alto**
- **Custo do exemplar**: relatório de 800–1.500 palavras ≈ 1.100–2.000 tokens (a estimativa de ~2k do produto é um bom teto). **Prompt caching só ajuda em bursts** (TTL máx. 1 h; cache read 0,1×, write 1,25–2×): gerações **semanais nunca reaproveitam cache entre si** — o cache paga em regenerações na mesma sessão ou quando o scheduler roda vários Modelos em sequência com o mesmo prefixo. Estruturar o prompt com conteúdo estável primeiro (system + instruções + exemplar + anotações) e dados do período por último.
  _Fonte: [Prompt caching — Anthropic Docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)_ · Confiança: **Alto**

### Modelo de dados de Pressão Arterial (#20)

Referências que fundamentam o schema:

- **FHIR Observation "Blood Pressure Profile"**: painel LOINC `85354-9` com components obrigatórios sistólica (`8480-6`) e diastólica (`8462-4`) em mmHg — **par atômico**; pulso é Observation separada (`8867-4`).
  _Fonte: [FHIR bp profile — hl7.org](http://hl7.org/fhir/bp.html)_ · Confiança: **Alto**
- **Apple HealthKit**: `HKCorrelationTypeIdentifier.bloodPressure` agrupa os dois samples numa correlação atômica.
  _Fonte: [bloodPressure — Apple Developer](https://developer.apple.com/documentation/healthkit/hkcorrelationtypeidentifier/bloodpressure)_ · Confiança: **Alto**
- **Guidelines de automedição (AHA/AMA, protocolo "7-2-2")**: 2 medições com ≥1 min de intervalo, manhã e noite, por 7 dias; decisão clínica pela **média** — a unidade clínica é a *sessão*, não a leitura isolada.
  _Fontes: [Self-Measured BP Monitoring: AHA/AMA Policy Statement (Circulation, 2020)](https://www.ahajournals.org/doi/10.1161/CIR.0000000000000803), [722 protocol (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC9532917/)_ · Confiança: **Alto**

**Schema derivado (Django):**

```
BPMeasurement: id, session_fk (nullable), systolic int, diastolic int, pulse int?,
               measured_at, arm enum{left,right}?, position enum{sentado,deitado,em_pé}?,
               moment enum{manhã,noite,ad_hoc}?, source enum{photo_ai, manual, import},
               photo FK?, ai_confidence?, ai_raw_response JSON?, notes
               constraints: systolic > diastolic; ranges plausíveis (sis 70–250, dia 40–150, pulso 30–220)
BPSession:     id, started_at, médias calculadas (mean_systolic, mean_diastolic)
Dashboard:     média móvel de 7 dias (a métrica clínica), não a leitura isolada
```

Sessão **opcional** (leitura avulsa permitida); par sis/dia **na mesma linha** (nunca registros separados); `source` desde o início para acomodar o caminho Bluetooth/import futuro sem retrabalho. · Confiança: **Alto** (derivação direta das referências)

### Privacidade e LGPD (#20)

- **Hoje (uso pessoal, BYO key): a LGPD não se aplica** — art. 4º, I exclui tratamento "realizado por pessoa natural para fins exclusivamente particulares e não econômicos". Pressão arterial é dado **sensível** (art. 5º, II), o que importa quando a exceção deixar de valer.
  _Fonte: [Lei 13.709/2018, art. 4º — Planalto](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)_ · Confiança: **Alto**
- **Épico 10 (convidados)**: a exceção doméstica fica frágil com dados sensíveis *de terceiros*; qualquer traço de finalidade econômica a derruba (→ art. 11 consentimento específico e destacado, art. 46 segurança, art. 33 transferência internacional — APIs de IA processam nos EUA). **Recomendação: consentimento explícito do convidado para "leitura por IA em nuvem" + fluxo 100% manual como padrão para terceiros.** · Confiança: **Médio** (interpretação; sem decisão da ANPD sobre o cenário)
- **Políticas das APIs de IA** (verificadas): Anthropic API — não treina com Customer Content, deleta em ~30 dias, ZDR disponível; OpenAI API — não treina por padrão, retenção ≤30 dias; **Google Gemini free tier — USA os dados para treino, com possível revisão humana** → **descartado para dado de saúde**.
  _Fontes: [API and data retention — Claude Docs](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention), [Enterprise privacy — OpenAI](https://openai.com/enterprise-privacy/), [Gemini API Terms](https://ai.google.dev/gemini-api/terms)_ · Confiança: **Alto**
- Mitigações adicionais: recortar só o display (sem ambiente/rosto), strip de EXIF antes do envio. Alternativa 100% local (ssocr/modelo dedicado) fica como upgrade futuro — esforço desproporcional hoje.

### Fluxo human-in-the-loop (#20) — compatibilidade com UX-DR19

Vision LLMs **alucinam números plausíveis** quando a imagem é ilegível (o pior modo de falha possível para PA), e mesmo a CNN dedicada do estudo de campo manteve "revisão humana essencial". O fluxo obrigatório:

1. Foto (com guia de enquadramento/crop do display) → chamada de IA → **formulário pré-preenchido** com os 3 valores editáveis — **nunca salvar direto**;
2. **Confiança por campo** (badge verde/âmbar; campo `null` = vazio com foco);
3. Salvar **só após confirmação explícita** (1 tap se tudo verde);
4. **Fallback manual sempre visível** (mesmo formulário sem foto; `legible: false` ou timeout → cai no manual);
5. Guardar foto original + JSON bruto da IA (evidência auditável, recalibragem de prompt);
6. Validação de plausibilidade + alerta de outlier vs. média de 7 dias.

Precedentes reais em apps de nicho (ZenScan BP, Feeltracker "scan your reading"); Omron/Withings não oferecem scan por foto — apostam em Bluetooth.
_Fontes: [Hallucination in GPT-4V (arXiv 2311.03287)](https://arxiv.org/pdf/2311.03287), [Frontiers in AI 2021](https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2021.543176/full), [ZenScan BP — Google Play](https://play.google.com/store/apps/details?id=com.zenchang.zenscanocr)_ · Confiança: **Alto/Médio**

**Nota DR19**: o fluxo "IA transcreve → humano confirma antes de salvar" mantém a captura como ato deliberado do usuário — a IA não sugere nem automatiza; transcreve sob confirmação. Coerente com a fronteira registrada no brainstorming (análise/leitura ≠ sugestão).

---

## Implementation Approaches and Technology Adoption

### TR-1 (C5) — Matriz comparativa e ordem de adoção

| Critério | A) Shortcuts puro → API | B) PWA instalada | C) Widget via Scriptable | D) App wrapper nativo |
|---|---|---|---|---|
| **Esforço** | **P** (1 endpoint + 2-4 atalhos) | P-M (manifest/ícones; push = M) | P-M (1 script JS ~100-200 linhas) | **G** (Xcode, Swift, assinatura, manutenção anual) |
| **Custo** | R$ 0 | R$ 0 | ~US$ 3 (Scriptable grátis) | **US$ 99/ano** + tempo contínuo |
| **Captura sem abrir o site** | Sim (Back Tap, Action Button, share sheet, NFC, automações) | Não (share target inexiste; deep link abre Safari) | Tap no widget roda script | Sim (widget interativo) |
| **Widget "resumo do dia"** | Não | **Não existe no iOS** (confirmado, incl. iOS 26) | **Sim** (refresh ~15-60 min) | Sim (mesma limitação de refresh) |
| **Riscos** | Token em texto no atalho; sem retry; timeout curto | Sem background sync; contexto Safari≠PWA | Cadência imprevisível; app de terceiro | Custo recorrente; re-assinatura; desproporcional p/ 1 usuário |

**Ordem de adoção recomendada:**

1. **Agora (P): Shortcuts puro** — backend ganha token de automação + `POST /api/capture`; atalhos via Back Tap/Action Button/share sheet/widget de Atalhos. Maior valor por hora investida; tudo nativo e documentado no iOS 26.
2. **Em seguida (P-M): widget "resumo do dia" via Scriptable** — mesmo token (no Keychain do Scriptable) + `GET /api/summary/today`; aceitar atraso de ~1 h.
3. **Oportunista (P): polir a PWA** — manifest completo (iOS 26 já abre standalone por padrão), badge, Declarative Web Push para lembretes. **Não tratar a PWA como canal de captura rápida.**
4. **Adiar indefinidamente: wrapper nativo para widgets** — só reavaliar se surgir necessidade de widget interativo de primeira classe/Live Activities.

### TR-2 (#12) — Arquitetura recomendada e fases

**Arquitetura consolidada:** "DSL compilado + agregados no backend + IA só narra e escolhe visualizações".

- **Fase a/b (sob demanda)**: spec JSON validada (JSON Schema + allowlist do catálogo de métricas) → compilação para ORM → backend computa séries → chamada Anthropic com structured outputs → blocos `{texto, grafico(serie_ref), tabela}` → Recharts. Snapshot imutável por geração.
- **Fase c (agendada)**: **django-q2** (broker no Postgres, zero infra nova, cron schedules no admin, retries) rodando os Modelos de Relatório; **Batch API da Anthropic (−50%)** é adequadíssima (sem sensibilidade a latência). Controle de custo BYO key: **cap mensal configurável** (tokens×preço lidos do `usage`) + **skip por hash** (SHA-256 do payload agregado + versão do modelo + versão do prompt — não gera se os dados não mudaram).
  _Fontes (padrão de budget): [Budget and spend limits — agentgateway](https://docs.solo.io/agentgateway/2.2.x/llm/budget-limits/), [LLM Budget Management — Maxim](https://www.getmaxim.ai/articles/llm-budget-management-virtual-keys-and-hierarchical-spend-controls/)_ · Confiança: **Alto** (padrão) / **Médio** (aplicação single-user)

**Custos por geração** (input ≈ 5–9k tokens, output ≈ 1,5–3k; preços vigentes 2026-07-22):

| Modelo | Custo/geração | Mensal (4 ger.) | Mensal (8 ger.) |
|---|---|---|---|
| Haiku 4.5 ($1/$5) | $0,012–0,024 | ~$0,05–0,10 | ~$0,10–0,19 |
| Sonnet 5 intro ($2/$10) | $0,025–0,048 | ~$0,10–0,19 | ~$0,20–0,38 |
| Sonnet padrão ($3/$15) | $0,037–0,072 | ~$0,15–0,29 | ~$0,30–0,58 |
| Opus 4.8 ($5/$25) | $0,062–0,120 | ~$0,25–0,48 | ~$0,50–0,96 |

**Conclusão de custo: < US$ 1/mês mesmo no Opus com uso semanal — custo não é fator decisório.** Escolher modelo pela qualidade da análise (Sonnet é o sweet spot; Haiku para rascunho/preview; Batch API corta pela metade na fase c).

### TR-3 (#20) — Forma recomendada de implementação

1. **Provedor/modelo**: Claude **Haiku 4.5** via BYO key (≈ US$ 0,002/leitura; ~US$ 0,18/mês com 3 medições/dia). Redimensionar/cropar a foto para ≤ ~1.100 px de lado antes de enviar (evita tier high-res, reduz reflexo/fundo). Se a taxa de erro incomodar, subir para Sonnet (ainda < US$ 1/mês).
2. **Prompt**: structured output estrito `{systolic: int|null, diastolic: int|null, pulse: int|null, confidence, legible: bool, notes}` + **instrução de recusa** ("null em vez de adivinhar; NUNCA estime valor ilegível") + descrição do layout do monitor do usuário (1 monitor conhecido ≈ elimina confusão de campos) + imagem antes do texto no bloco de conteúdo.
3. **Fluxo**: human-in-the-loop obrigatório (seção Architectural Patterns) — foto → IA → form pré-preenchido com badges → confirmação explícita → salvar; fallback manual sempre disponível.
4. **Modelo de dados**: par sis/dia atômico + sessões opcionais + média de 7 dias no dashboard + `source` enum desde o início (photo_ai/manual/import).
5. **Não usar** free tier do Gemini (dados de saúde usados em treino com revisão humana).
6. **Preparar junto (não em vez de)**: endpoint de ingestão aceitando POST de Shortcuts→Apple Health — um futuro monitor Bluetooth (Omron connect/Withings) elimina foto e IA sem retrabalho.

### Riscos e mitigações (consolidado)

| Risco | TR | Mitigação |
|---|---|---|
| Token de automação exposto no atalho | C5 | Escopo restrito + revogável; Keychain no Scriptable; rate limiting |
| SQL gerado por IA persistido (LLM01+LLM05) | #12 | **Eliminado por arquitetura** (DSL compilado); read-only role + statement_timeout como defesa extra |
| XSS via spec Vega | #12 | JSON próprio fechado + Recharts (sem linguagem de expressão) |
| Custo descontrolado na fase c | #12 | Cap mensal + skip por hash + Batch API |
| Alucinação de valores plausíveis de PA | #20 | Confirmação humana obrigatória + instrução de recusa + validação de plausibilidade/outlier server-side |
| Privacidade de dado de saúde com convidados | #20 | Consentimento explícito no Épico 10 + manual como padrão para terceiros + crop/EXIF strip |
| Dependência de app de terceiro (Scriptable) | C5 | Caminho A (Shortcuts puro) independe; widget é aditivo |

---

## Research Synthesis — Entregável para o Correct-Course

### Executive Summary

Os três [TR] estão **resolvidos** — nenhum bloqueia as features investigadas, mas todos **mudam a forma** com que elas devem ser especificadas:

1. **C5 (#7/#8)**: a captura rápida mobile é **viável hoje com esforço P** via Shortcuts + API, sem app nativo — desde que o backend ofereça **token de automação dedicado** (não JWT de sessão) e **endpoint de captura com payload raso**. A hipótese sobre widgets foi **confirmada**: PWA não tem widget no iOS (nem no iOS 26); o widget "resumo do dia" sem app é via **Scriptable** (refresh 15–60 min); o wrapper nativo (Capacitor/Expo + WidgetKit Swift, US$ 99/ano, esforço G) fica **adiado indefinidamente**. A PWA vale polir (iOS 26 abre standalone por padrão; push/badge), mas **não é canal de captura** (sem Web Share Target, deep links abrem no Safari).
2. **#12 (C2 fases b/c)**: a ideia original ("IA gera SQL salvo no banco") é **rejeitada por segurança** (OWASP LLM01+LLM05; ataques P2SQL demonstrados; prompt injection sem mitigação equivalente a prepared statements) e **substituída por DSL JSON compilado server-side** — que preserva integralmente o valor do Modelo de Relatório. A **decisão de formato da fase b, amarrada a este TR: texto + gráficos**, com a IA devolvendo blocos estruturados que **referenciam séries pré-computadas** pelo backend (`serie_ref`), renderizados com Recharts — a IA nunca produz números (guardrail DR19 preservado por construção). Fase c viável com django-q2 + Batch API; custo total **< US$ 1/mês**.
3. **#20**: foto+IA é **viável, barata (~US$ 0,20/mês no Haiku 4.5) e de implementação pequena** — mas **somente com human-in-the-loop obrigatório**, porque não há acurácia publicada de vision LLMs neste nicho e o modo de falha típico é alucinar um número plausível. Modelo de dados definido (par sis/dia atômico, sessões opcionais, média de 7 dias, `source` enum). LGPD não se aplica hoje (exceção doméstica); Épico 10 exige consentimento explícito. Alternativa Bluetooth/Apple Health deve ser **acomodada no schema desde o início** (`source: import`), não implementada agora.

### Respostas diretas às perguntas dos TR (veredictos)

| Pergunta do TR | Veredicto |
|---|---|
| C5: JWT em Shortcuts (armazenamento, refresh, expiração)? | **Não usar JWT de sessão.** Token de automação dedicado de longa duração, escopado e revogável (padrão Home Assistant). Refresh de JWT em atalho é frágil e sem precedentes publicados. |
| C5: payloads de captura rápida? | `POST /api/capture` com payload **raso** `{type, text, value?}`; resposta curta. Disparo por Back Tap, Action Button, share sheet, NFC, automações. |
| C5: widget sem app nativo — existe caminho? | **Não para PWA** (confirmado, incl. iOS 26). **Sim via Scriptable** (JS + Keychain + ListWidget; refresh 15–60 min). |
| C5: custo do wrapper mínimo (Capacitor/Expo)? | Esforço **G**: widget é sempre Swift/WidgetKit mesmo com wrapper; US$ 99/ano + TestFlight 90 dias + manutenção Xcode/iOS. **Adiar.** |
| C5: PWA + deep links / share sheet? | PWA instalável e melhorada no iOS 26, mas **sem Web Share Target** e **deep links abrem no Safari** → não é canal de captura. Share sheet → atalho → API substitui. |
| #12: segurança de query IA persistida? | **SQL cru: rejeitado.** DSL JSON + JSON Schema + allowlist compilado para ORM; read-only role + statement_timeout; RLS no multi-user. |
| #12: versionamento das queries salvas? | Padrão prompt-registry: versões imutáveis de {spec, prompt, exemplar}; snapshot congelado por geração (`GeracaoRelatorio`). |
| #12: custo de tokens? | Irrisório: US$ 0,01–0,12/geração conforme modelo; < US$ 1/mês em uso semanal; Batch API −50% na fase c; caching só paga em bursts (TTL ≤ 1h). |
| #12: mecanismo de refresh do dashboard? | django-q2 (broker no Postgres, zero infra nova) rodando os Modelos em agenda; cap mensal + skip por hash de dados. |
| #12: formato de saída da fase b? | **Texto + gráficos**: blocos JSON `{texto, grafico(serie_ref), tabela}` via structured outputs; backend computa séries; Recharts renderiza. |
| #20: acurácia de vision LLM em display de PA? | Sem benchmark publicado no nicho (achado em si); dedicados chegam a 90–99%, Tesseract é inutilizável (~20%). Viável para 1 usuário/1 monitor **com confirmação humana obrigatória**. |
| #20: custo por leitura? | ≈ US$ 0,002 (Haiku 4.5, foto ~1 MP redimensionada); ~US$ 0,18/mês com 3 medições/dia. Irrelevante. |
| #20: privacidade? | LGPD art. 4º I cobre o uso pessoal hoje; Anthropic/OpenAI API não treinam e retêm ~30 dias; **Gemini free tier proibido** (treina com revisão humana); Épico 10 → consentimento + manual por padrão. |
| #20: fluxo de confirmação/fallback? | Foto → IA → form pré-preenchido com badges de confiança por campo → confirmação explícita → salvar; fallback manual sempre; foto+JSON bruto guardados. |
| #20: modelo de dados? | `BPMeasurement` (par sis/dia atômico + pulso, `source` enum, contexto opcional) + `BPSession` opcional (protocolo 7-2-2) + média móvel de 7 dias no dashboard. |

### Implicações para o [CC] (deltas que esta pesquisa adiciona ao handoff do brainstorming)

1. **Pré-requisitos de backend do C5 são pequenos e compartilháveis**: token de automação + `POST /api/capture` + `GET /api/summary/today` servem Shortcuts, widget Scriptable **e** a futura ponte Apple Health do #20. Candidatos a story(s) de plataforma enxutas — o CC decide a onda.
2. **A fase c do #12 deixa de ser incógnita**: a entidade Modelo de Relatório (Mergulho 3) é implementável com segurança; o CC pode formalizar C2 fases a→b→c com a arquitetura DSL + django-q2 + Batch API. O texto do FR-4.3 reescrito deve mencionar que **a IA não gera nem executa queries** — compõe specs validadas.
3. **Formato da fase b está decidido** (texto+gráficos com `serie_ref`) — remove a pendência deliberadamente amarrada ao TR na Rodada 3.
4. **#20 ganha guardrails de story**: confirmação humana obrigatória (nunca salvar direto), instrução de recusa no prompt, validação de plausibilidade server-side, `source` enum desde a primeira migration, e cláusula de consentimento condicionada ao Épico 10.
5. **Decisão de arquitetura registrada**: nenhum investimento em app nativo/wrapper no horizonte atual — remove a incerteza de esforço de C5 que a triagem marcou como "alto × ?" (agora: **alto valor × esforço P/P-M** para os caminhos recomendados).
6. **BYO key global (Rodada 4) é reforçada**: #12 e #20 usam a mesma chave e o mesmo padrão de structured outputs; a capability `ai_available` gateia ambos. Custo agregado de IA das duas features: **< R$ 10/mês** — irrelevante para decisão de priorização.

### Metodologia e verificação de fontes

- **Coleta**: 3 agentes de pesquisa paralelos (2026-07-22), ~79 chamadas de busca/fetch; fontes oficiais priorizadas (Apple/WebKit/MDN, OWASP, NCSC, Anthropic, OpenAI, Google, HL7/FHIR, AHA/Circulation, Planalto) + literatura acadêmica (ICSE'25, arXiv, Frontiers, MDPI) + docs de produtos (Scriptable, Home Assistant, Cube, dbt, Withings).
- **Confiança**: achados estruturais (capacidades do Shortcuts, ausência de widget/share target de PWA, orçamento WidgetKit, OWASP LLM Top 10, preços Anthropic, FHIR/AHA, LGPD) = **Alto**, em fontes primárias. Marcados como **Médio/Baixo**: timeout exato do Shortcuts (~25 s, fórum), inviabilidade do refresh JWT em atalho (inferência + ausência de exemplos), "iOS 26 não mudou deep links de PWA" (ausência de evidência em contrário), acurácia de vision LLM em display de PA (extrapolação — não há estudo direto), interpretação da exceção doméstica da LGPD com convidados (sem decisão da ANPD), ponte Shortcuts→Health com PA especificamente (testar 10 min no iPhone).
- **Limitações**: preços de IA e políticas de retenção mudam — revalidar na implementação; comportamento do iOS re-verificar a cada major release; estimativas de custo dependem das premissas de tamanho de prompt do enunciado.

### Conclusão

A Trilha B está completa: lista madura, priorizada **e com viabilidade resolvida**. O gate de convergência do plano de ação pode fechar. Próximo rito: **[CC] bmad-correct-course** (janela nova), alimentado por este documento + [`brainstorming-session-2026-07-21-1751.md`](../../brainstorming/brainstorming-session-2026-07-21-1751.md) + SPEC/plano da migração + PRD/épicos/sprint-status.

---

**Technical Research Completion Date:** 2026-07-22
**Research Period:** dados atuais 2024–2026, verificados em 2026-07-22
**Source Verification:** todas as afirmações críticas citadas com URL e nível de confiança
**Confidence Level:** Alto nos achados estruturais e de decisão; pontos de confiança Média/Baixa explicitamente marcados

_Este documento é o entregável [TR] da Trilha B (plano de ação 2026-07-21) e insumo direto do rito [CC] bmad-correct-course._
