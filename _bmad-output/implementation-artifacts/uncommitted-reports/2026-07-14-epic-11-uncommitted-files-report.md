# Explicacao dos arquivos nao commitados - Epic 11 / Story 11.1

## Visao geral

O conjunto de mudancas cria e documenta o isolamento da suite E2E em uma branch Neon dedicada (`e2e`), conclui a Story 11.1, prepara a Story 11.2 e registra a orquestracao BMAD usada para o Epic 11. A mudanca funcional principal e de infraestrutura: Playwright e scripts de seed deixam de apontar para `config.settings.dev` e passam a usar `config.settings.e2e`; um management command versionado limpa usuarios `@e2e.test` e suas linhas tenant-scoped; documentacao e testes protegem esse fluxo.

## Ordem logica de funcionamento

1. Planejamento BMAD adiciona o Epic 11 e suas stories em `epics.md`, `sprint-status.yaml` e nos artefatos de story/orquestracao.
2. Configuracao local passa a reconhecer `.env.e2e` como segredo git-ignored e `config.settings.e2e` como settings Django da suite E2E.
3. Playwright importa um ponto unico (`frontend/e2e/backendEnv.ts`) para iniciar o backend real sob `config.settings.e2e`.
4. Scripts de seed E2E reutilizam a mesma constante para que os dados preparados por `manage.py shell` caiam no mesmo banco usado pelo backend do teste.
5. O runbook explica criacao/reset da branch Neon `e2e` e referencia o comando destrutivo de limpeza.
6. O management command `purge_e2e_users` apaga usuarios de teste e, antes disso, remove explicitamente as linhas tenant-scoped sem depender de cascade.
7. Testes backend cobrem os guardrails do comando: filtro por sufixo, dry-run, preservacao de usuarios reais e varredura cross-tenant via `all_objects`.

## 1. Artefatos de planejamento e status

### `_bmad-output/planning-artifacts/epics.md`

**Funcao geral do arquivo**

Fonte de planejamento dos epicos e stories do produto.

**Funcao geral da alteracao**

Adiciona o Epic 11, "Refinamento do Planner & Recorrentes", como refinamento pos-Epic 4 a executar antes do Epic 5.

**Blocos principais**

- Linhas 271-275: insere o resumo do Epic 11 na lista de epicos, explicando origem em `docs/futureIdeas.md`, dependencia do Epic 4 e motivo de manter a numeracao 11.
- Linhas 752-895: adiciona o corpo completo do Epic 11, com as Stories 11.1 a 11.6 e seus acceptance criteria.

**Funcoes, classes e importacoes especificas**

- Nao ha codigo executavel. O arquivo e artefato de planejamento.

**Comportamento de libs usadas**

- Nao aplica.

### `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Funcao geral do arquivo**

Rastreia estado de desenvolvimento por epic/story no fluxo BMAD.

**Funcao geral da alteracao**

Marca o Epic 4 como `done`, adiciona o Epic 11 e posiciona a Story 11.1 como concluida, com 11.2 pronta para dev.

**Blocos principais**

- Linhas 35-40: atualiza `last_updated` para refletir trabalho da Story 11.1.
- Linhas 68-80: muda `epic-4` para `done`.
- Linhas 81-90: adiciona `epic-11`, stories 11.1-11.6 e retrospectiva opcional.

**Funcoes, classes e importacoes especificas**

- Nao ha codigo executavel. E um contrato YAML de status.

**Comportamento de libs usadas**

- Consumidores YAML esperam chaves estaveis (`development_status`) e valores de workflow (`done`, `ready-for-dev`, `backlog`, `in-progress`).

### `_bmad-output/implementation-artifacts/11-1-isolamento-de-teste-via-branch-neon-dedicada.md`

**Funcao geral do arquivo**

Story implementada da 11.1, com ACs, tarefas, notas tecnicas, evidencias, file list e review.

**Funcao geral da alteracao**

Arquivo novo que documenta a entrega do isolamento E2E por branch Neon dedicada.

**Blocos principais**

- Linhas 5-37: titulo, status `done`, narrativa e ACs.
- Linhas 38-60: checklist das tarefas executadas: settings `e2e`, `.env.e2e`, repointing dos seeds, runbook e limpeza one-shot.
- Linhas 64-102: notas de arquitetura sobre split settings, branch por ambiente, `user_id` sem FK e uso de `all_objects`.
- Linhas 125-181: Dev Agent Record com evidencias de comandos, completion notes, decisoes, riscos e lista de arquivos.
- Linhas 183-203: Senior Developer Review com ACs verificados, auto-fixes e testes reexecutados.

**Funcoes, classes e importacoes especificas**

- Nao ha codigo executavel. O arquivo atua como evidencia e memoria tecnica para mantenedores.

**Comportamento de libs usadas**

- Nao aplica.

### `_bmad-output/implementation-artifacts/11-2-recorrentes-no-planner-com-abas-e-filtro.md`

**Funcao geral do arquivo**

Story pronta para desenvolvimento da 11.2, ainda sem implementacao de codigo.

**Funcao geral da alteracao**

Arquivo novo que especifica mover a gestao de recorrentes de Configuracoes para Planner, com abas por grupo e filtro de inativos.

**Blocos principais**

- Linhas 5-31: story, status `ready-for-dev` e dois ACs.
- Linhas 33-76: tarefas detalhadas para UI, rota, navegacao, remocao de SettingsPage e testes.
- Linhas 80-129: Dev Notes delimitam escopo frontend-only, consumo de hooks existentes, uso de MUI Tabs e filtragem client-side.
- Linhas 131-157: referencias e placeholders do Dev Agent Record.

**Funcoes, classes e importacoes especificas**

- Nao ha codigo executavel. Cita futuros componentes e hooks (`RecurringTemplateManager`, `useRecurringTemplatesQuery`, `Tabs`, `Switch`) como instrucoes para implementacao posterior.

**Comportamento de libs usadas**

- `@mui/material` `Tabs`/`Tab`: espera `value` e `onChange`; entrega semantica de tabs para teclado/ARIA.
- TanStack Query, via hook citado: retorna dados/cache e deve continuar sendo consultado uma vez, com filtragem client-side.

### `_bmad-output/implementation-artifacts/tests/test-summary.md`

**Funcao geral do arquivo**

Acumula resumos de automacao/testes por story.

**Funcao geral da alteracao**

Adiciona o resumo de testes da Story 11.1.

**Blocos principais**

- Linhas 1095-1116: contexto da story e gap identificado no comando destrutivo.
- Linhas 1118-1130: lista dos seis testes criados para `purge_e2e_users`.
- Linhas 1137-1145: matriz AC -> cobertura.
- Linhas 1149-1152: resultado `6 passed` e `ruff` limpo.
- Linhas 1157-1168: checklist de validacao.

**Funcoes, classes e importacoes especificas**

- Nao ha codigo executavel. Resume testes implementados em `backend/core/tests/test_purge_e2e_users.py`.

**Comportamento de libs usadas**

- Cita `pytest-django`, `factory-boy` e Playwright. `pytest-django` executa testes com banco Django; `factory-boy` cria instancias de models; Playwright executa E2E reais de browser.

## 2. Artefatos do story automator

### `_bmad-output/story-automator/init-log-20260714-185432.md`

**Funcao geral do arquivo**

Log minimo de inicializacao da automacao de stories.

**Funcao geral da alteracao**

Arquivo novo registrando que a orquestracao iniciou como `fresh-epic-11`.

**Blocos principais**

- Linha 1: timestamp, `stop-hook=false` e estado inicial.

**Funcoes, classes e importacoes especificas**

- Nao ha codigo executavel.

**Comportamento de libs usadas**

- Nao aplica.

### `_bmad-output/story-automator/preflight-11-20260714-185707.md`

**Funcao geral do arquivo**

Snapshot de preflight da automacao para o Epic 11.

**Funcao geral da alteracao**

Arquivo novo com epic selecionado, seis stories e classificacao de complexidade.

**Blocos principais**

- Linhas 3-9: timestamp, path do epic, contagem de stories e instrucao customizada.
- Linhas 11-17: sumario de complexidade por story.

**Funcoes, classes e importacoes especificas**

- Nao ha codigo executavel.

**Comportamento de libs usadas**

- Nao aplica.

### `_bmad-output/story-automator/complexity-orchestration-11-20260714-185946.json`

**Funcao geral do arquivo**

JSON com classificacao de complexidade para cada story do Epic 11.

**Funcao geral da alteracao**

Arquivo novo usado pela orquestracao para decidir paralelismo/prioridade.

**Blocos principais**

- Linha 1: array `stories`, cada item contendo `storyId`, `title`, `complexity.score`, `complexity.level` e `complexity.reasons`.

**Funcoes, classes e importacoes especificas**

- Nao ha codigo executavel.

**Comportamento de libs usadas**

- Consumidores JSON esperam objeto parseavel com array `stories`. `score` e `level` sao dados para politica de orquestracao, nao runtime de produto.

### `_bmad-output/story-automator/orchestration-11-20260714-185946.md`

**Funcao geral do arquivo**

Estado principal da orquestracao BMAD do Epic 11.

**Funcao geral da alteracao**

Arquivo novo que registra configuracao, progresso e eventos das stories 11.1 e 11.2.

**Blocos principais**

- Linhas 1-34: frontmatter com epic, range de stories, status, step atual, paths de arquivos auxiliares e policy snapshot.
- Linhas 36-50: configuracao legivel da orquestracao.
- Linhas 53-62: tabela de progresso por story.
- Linhas 86-96: log de aprendizados/eventos, incluindo 11.1 dev/automation/review e 11.2 create-story.

**Funcoes, classes e importacoes especificas**

- Nao ha codigo executavel.

**Comportamento de libs usadas**

- Nao aplica no runtime do app; a automacao espera campos de frontmatter e tabelas/logs persistidos.

### `_bmad-output/story-automator/agents/agents-orchestration-11-20260714-185946.md`

**Funcao geral do arquivo**

Plano de agentes para criar, desenvolver, automatizar e revisar cada story do Epic 11.

**Funcao geral da alteracao**

Arquivo novo com JSON embutido indicando `claude` como primary agent e sem fallback.

**Blocos principais**

- Linhas 1-4: frontmatter apontando para o state file.
- Linhas 8-155: JSON com `version`, `stateFile`, epic e lista de stories.
- Linhas 16-153: cada story declara tarefas `create`, `dev`, `auto` e `review`.

**Funcoes, classes e importacoes especificas**

- Nao ha codigo executavel.

**Comportamento de libs usadas**

- JSON embutido precisa ser parseavel por tooling de orquestracao; campos `primary` e `fallback` controlam despacho de agentes.

### `_bmad-output/story-automator/policy-snapshots/20260714-185946-79b3b368.json`

**Funcao geral do arquivo**

Snapshot versionado da politica de orquestracao.

**Funcao geral da alteracao**

Arquivo novo que congela versao, prompts, schemas e verificadores usados no ciclo do automator.

**Blocos principais**

- Linhas 2-15: runtime de merge/parser e local de snapshots.
- Linhas 16-53: configuracao do step `auto`.
- Linhas 54-99: configuracao do step `create`.
- Linhas 100-138: configuracao do step `dev`.
- Linhas 139-175: configuracao de `retro`.
- Linhas 176-221: configuracao de `review`.
- Linhas 223-244: versao e workflow (`create`, `dev`, `auto`, `review`, `retro`).

**Funcoes, classes e importacoes especificas**

- Nao ha codigo executavel do produto.

**Comportamento de libs usadas**

- Consumidores JSON leem `schemaPath`, `templatePath` e `verifier` para reproduzir ou auditar a execucao da automacao.

## 3. Configuracao e documentacao de ambiente

### `.gitignore`

**Funcao geral do arquivo**

Define arquivos locais que o Git nao deve versionar.

**Funcao geral da alteracao**

Adiciona `.env.e2e` ao bloco de env files.

**Blocos principais**

- Linha 5: `.env.e2e` impede commit acidental da connection string real da branch Neon E2E.

**Funcoes, classes e importacoes especificas**

- Nao ha codigo executavel. Tipo: config.

**Comportamento de libs usadas**

- Git usa os padroes do `.gitignore` para excluir arquivos do status/index quando nao rastreados.

### `README.md`

**Funcao geral do arquivo**

Documentacao de onboarding e operacao local do monorepo.

**Funcao geral da alteracao**

Atualiza o mapeamento de ambientes para incluir branch Neon `e2e` e `.env.e2e`.

**Blocos principais**

- Linhas 4-6: descricao do banco passa a mencionar `dev`, `main` e `e2e`.
- Linhas 39-49: instrucoes de ambientes incluem `.env.e2e`, link para o runbook e `config.settings.e2e`.

**Funcoes, classes e importacoes especificas**

- Nao ha codigo executavel. Tipo: documentacao.

**Comportamento de libs usadas**

- Markdown e links relativos sao renderizados por leitores GitHub/IDE; o link `docs/e2e-neon-reset.md` aponta para o runbook novo.

### `backend/.env.example`

**Funcao geral do arquivo**

Template versionado das variaveis de ambiente do backend.

**Funcao geral da alteracao**

Documenta `.env.e2e` e `config.settings.e2e` como terceira opcao de ambiente.

**Blocos principais**

- Linhas 1-5: comentario de topo passa a instruir copia para `.env.dev`, `.env.prod` ou `.env.e2e`.
- Linhas 7-11: lista os tres settings modules e associa `e2e` a uma branch Neon isolada.

**Funcoes, classes e importacoes especificas**

- Nao ha codigo executavel, mas seus valores sao lidos por `django-environ`.

**Comportamento de libs usadas**

- `django-environ` espera pares `KEY=value` e disponibiliza esses valores para `config/settings/base.py`.

### `backend/config/settings/e2e.py`

**Funcao geral do arquivo**

Settings module Django usado pela suite E2E.

**Funcao geral da alteracao**

Arquivo novo que espelha `dev.py`, mas le `.env.e2e` antes de importar `base`.

**Blocos principais**

- Linhas 1-7: docstring explica que o modulo aponta para branch Neon `e2e` e que `read_env` e seguro se o arquivo nao existir.
- Linhas 9-15: calcula `_BASE_DIR` e chama `environ.Env.read_env(_BASE_DIR / ".env.e2e")`.
- Linhas 17-19: importa tudo de `.base` e mantem `DEBUG = True`.

**Funcoes, classes e importacoes especificas**

- `Path`: resolve o caminho absoluto do projeto backend.
- `environ.Env.read_env`: carrega variaveis de `.env.e2e` no ambiente do processo.
- `from .base import *`: reutiliza toda configuracao comum, inclusive `DATABASES`.

**Comportamento de libs usadas**

- `django-environ` espera arquivo dotenv e injeta valores em `os.environ`; depois `base.py` consome `DATABASE_URL` via `env.db(...)`.
- `pathlib.Path.resolve()` retorna caminho normalizado; `parent.parent.parent` sobe de `backend/config/settings/e2e.py` ate `backend/`.

### `docs/e2e-neon-reset.md`

**Funcao geral do arquivo**

Runbook operacional para criar e resetar a branch Neon `e2e`.

**Funcao geral da alteracao**

Arquivo novo que documenta fluxo manual de branch, reset por Neon ou Django, e encerramento de conexoes presas.

**Blocos principais**

- Linhas 9-25: explica por que a branch `e2e` existe e mapeia `main`, `dev`, `e2e` para `.env` e settings modules.
- Linhas 28-56: instrui criacao manual da branch e migracoes.
- Linhas 60-88: descreve reset via Neon ou via `purge_e2e_users`.
- Linhas 98-115: documenta SQL `pg_terminate_backend` para conexoes presas.
- Linhas 119-131: registra a limpeza one-shot historica da branch dev.
- Linhas 135-144: tabela de referencias cruzadas.

**Funcoes, classes e importacoes especificas**

- Nao ha codigo de app. Contem comandos shell e SQL operacionais.

**Comportamento de libs usadas**

- `neonctl branches create/reset` cria ou reseta branches Neon.
- `uv run python manage.py migrate` executa comando Django dentro do ambiente Python gerenciado por `uv`.
- `pg_terminate_backend(pid)` encerra sessoes PostgreSQL identificadas em `pg_stat_activity`.

## 4. Backend: comando de limpeza e testes

### `backend/core/management/__init__.py`

**Funcao geral do arquivo**

Marca `backend/core/management` como pacote Python.

**Funcao geral da alteracao**

Arquivo novo vazio para habilitar a hierarquia de management commands do app `core`.

**Blocos principais**

- Arquivo vazio: a presenca e o comportamento relevante.

**Funcoes, classes e importacoes especificas**

- Nao ha simbolos definidos.

**Comportamento de libs usadas**

- Django descobre commands em `<app>/management/commands/`; Python precisa tratar os diretorios como pacotes importaveis.

### `backend/core/management/commands/__init__.py`

**Funcao geral do arquivo**

Marca `backend/core/management/commands` como pacote Python.

**Funcao geral da alteracao**

Arquivo novo vazio para que Django descubra `purge_e2e_users.py`.

**Blocos principais**

- Arquivo vazio: a presenca e o comportamento relevante.

**Funcoes, classes e importacoes especificas**

- Nao ha simbolos definidos.

**Comportamento de libs usadas**

- O loader de management commands do Django varre esse pacote e registra arquivos `.py` como comandos invocaveis por `manage.py`.

### `backend/core/management/commands/purge_e2e_users.py`

**Funcao geral do arquivo**

Management command Django destrutivo para limpar usuarios de teste E2E e linhas tenant-scoped associadas.

**Funcao geral da alteracao**

Arquivo novo que implementa o reset reutilizavel para branch `e2e` e a limpeza one-shot da branch `dev`.

**Blocos principais**

- Linhas 1-20: docstring detalha usos, risco de ausencia de cascade e necessidade de `all_objects`.
- Linhas 22-26: imports de `BaseCommand`, `transaction`, `User` e models tenant-scoped.
- Linhas 28-35: define `E2E_EMAIL_SUFFIX` e `TENANT_MODELS`.
- Linhas 38-46: classe `Command` e argumento `--dry-run`.
- Linhas 48-60: coleta usuarios cujo email termina em `@e2e.test` e imprime contagem.
- Linhas 62-65: conta linhas por model usando `model.all_objects`.
- Linhas 67-75: encerra sem apagar se nao ha usuarios ou se `--dry-run` foi usado.
- Linhas 77-82: transacao atomica apaga linhas tenant-scoped e depois `User`.
- Linhas 84-89: valida contagem remanescente e imprime sucesso.

**Funcoes, classes e importacoes especificas**

- `BaseCommand`: base do Django para comandos `manage.py`; chama `add_arguments` e `handle`.
- `transaction.atomic`: agrupa deletes em uma transacao; se uma delecao falhar, tudo e revertido.
- `User.objects.filter(email__endswith=...)`: identifica usuarios de teste por sufixo de email.
- `model.all_objects.filter(user_id__in=user_ids)`: contorna o `TenantManager` escopado e permite varredura cross-tenant.
- `QuerySet.delete()`: remove registros e retorna tupla `(quantidade, detalhes_por_model)`.

**Comportamento de libs usadas**

- Django ORM espera filtros por campos validos (`email__endswith`, `user_id__in`) e retorna lazy `QuerySet`.
- `values_list("id", flat=True)` entrega lista de UUIDs sem materializar objetos completos.
- `self.style.SUCCESS/WARNING` formata mensagens no output do management command.

### `backend/core/tests/test_purge_e2e_users.py`

**Funcao geral do arquivo**

Teste backend do comando destrutivo `purge_e2e_users`.

**Funcao geral da alteracao**

Arquivo novo com seis testes que travam comportamento critico de seguranca de dados.

**Blocos principais**

- Linhas 1-16: docstring explica guardrails de ausencia de cascade, filtro por sufixo e uso de `all_objects`.
- Linhas 18-32: imports de pytest, `call_command`, models, factories e `tenant_context`.
- Linhas 34-61: helpers `_seed_tenant_rows`, `_tenant_row_count` e `_run`.
- Linhas 64-68: fixture `e2e_user`.
- Linhas 71-81: happy path apaga usuario e todas as linhas tenant-scoped.
- Linhas 84-97: preserva usuario real e suas linhas.
- Linhas 99-107: near-miss `e2e-fake@example.com` nao e apagado.
- Linhas 110-119: `--dry-run` nao apaga nada.
- Linhas 122-131: sem alvos encerra limpo.
- Linhas 134-152: varredura cross-tenant sem contexto apaga multiplos usuarios E2E.

**Funcoes, classes e importacoes especificas**

- `call_command("purge_e2e_users", ...)`: invoca o command como Django faria pelo CLI.
- `StringIO`: captura stdout para assercoes.
- `tenant_context(user)`: ativa tenant para factories que salvam via manager escopado.
- `UserFactory`, `TaskFactory`, `LogFactory`, `WeeklyLogFactory`, `MonthlyLogFactory`, `RecurringTaskTemplateFactory`: criam registros de teste consistentes.
- `model.all_objects.filter(...).count()`: conta linhas ignorando contexto tenant.

**Comportamento de libs usadas**

- `pytest.fixture` entrega dados reutilizaveis por teste.
- `pytest-django` fornece acesso transacional ao banco de teste Django.
- `factory-boy` constroi models validos sem depender de chamadas HTTP.
- Django `call_command` espera nome do comando e argumentos CLI; retorna apos `handle`.

## 5. Frontend E2E: settings compartilhado e Playwright

### `frontend/e2e/backendEnv.ts`

**Funcao geral do arquivo**

Ponto unico do settings module Django usado pelos E2E.

**Funcao geral da alteracao**

Arquivo novo que exporta `DJANGO_SETTINGS_MODULE = 'config.settings.e2e'`.

**Blocos principais**

- Linhas 1-4: comentario explica que Playwright e seeds devem importar daqui para nao divergir.
- Linha 5: exporta a constante.

**Funcoes, classes e importacoes especificas**

- `DJANGO_SETTINGS_MODULE`: constante TypeScript consumida por `playwright.config.ts` e seeds.

**Comportamento de libs usadas**

- ES modules esperam `export const` e import por caminho relativo; TypeScript valida o tipo literal como `string`.

### `frontend/playwright.config.ts`

**Funcao geral do arquivo**

Configuracao da suite Playwright E2E.

**Funcao geral da alteracao**

Passa o backend real dos E2E para `config.settings.e2e` e aumenta timeout de expect para operacoes com round-trip real ao Neon.

**Blocos principais**

- Linhas 1-3: importa `defineConfig`, `devices` e `DJANGO_SETTINGS_MODULE`.
- Linhas 5-8: comentario atualiza o contexto para branch Neon `e2e`.
- Linhas 15-19: adiciona `expect: { timeout: 10_000 }`.
- Linhas 38-41: webServer do backend recebe `env: { DJANGO_SETTINGS_MODULE }`.

**Funcoes, classes e importacoes especificas**

- `defineConfig`: helper Playwright que tipa e valida configuracao.
- `devices`: presets de browsers/dispositivos; ja existia e continua usado nos projects.
- `DJANGO_SETTINGS_MODULE`: agora substitui literal `config.settings.dev`.

**Comportamento de libs usadas**

- Playwright `webServer` inicia comandos antes dos testes e verifica `url` ate `timeout`.
- `reuseExistingServer` evita reiniciar servidores locais fora de CI.
- `expect.timeout` define o tempo padrao para assercoes auto-retry, retornando falha somente apos 10s.

### `frontend/e2e/seedArchiveScenario.ts`

**Funcao geral do arquivo**

Seed E2E para montar cenario de Arquivo/fechamento de ciclos.

**Funcao geral da alteracao**

Importa `DJANGO_SETTINGS_MODULE` de `backendEnv.ts` e atualiza comentarios de dev branch para e2e branch.

**Blocos principais**

- Linha 5: importa a constante compartilhada.
- Linhas 7-15: comentario passa a falar em banco de teste/branch `e2e`.
- Linhas 84-88: `execFileSync` roda `manage.py shell` com `env: { ...process.env, DJANGO_SETTINGS_MODULE }`.

**Funcoes, classes e importacoes especificas**

- `execFileSync`: executa `uv run python manage.py shell -c <script>` de forma bloqueante.
- `path.resolve` e `fileURLToPath`: localizam o diretorio `backend` a partir do arquivo E2E.
- `DJANGO_SETTINGS_MODULE`: garante que o shell escreva na mesma branch do backend E2E.

**Comportamento de libs usadas**

- Node `child_process.execFileSync` espera binario e args separados; retorna buffer/stdout ou lanca erro em exit non-zero.
- Django `manage.py shell -c` executa script Python com settings do ambiente.

### `frontend/e2e/seedCatchUpScenario.ts`

**Funcao geral do arquivo**

Seed E2E para montar dados de catch-up de dias/ciclos pulados.

**Funcao geral da alteracao**

Substitui literais `config.settings.dev` pela constante compartilhada.

**Blocos principais**

- Linha 5: importa `DJANGO_SETTINGS_MODULE`.
- Linhas 84-88: primeiro shell command usa a constante.
- Linhas 109-113: segundo shell command tambem usa a constante.

**Funcoes, classes e importacoes especificas**

- `execFileSync`: roda comandos Python de seed.
- `DJANGO_SETTINGS_MODULE`: direciona os seeds para `config.settings.e2e`.

**Comportamento de libs usadas**

- Igual ao seed de arquivo: Node executa processo filho; Django shell aplica ORM e `tenant_context` definidos no script Python embutido.

### `frontend/e2e/seedReviewScenario.ts`

**Funcao geral do arquivo**

Seed E2E para montar filas de revisao semanal/mensal e pull do Future Log.

**Funcao geral da alteracao**

Importa a constante compartilhada e atualiza comentarios para banco de teste `e2e`.

**Blocos principais**

- Linha 5: importa `DJANGO_SETTINGS_MODULE`.
- Linhas 7-15: comentario corrige a origem dos dados de dev para teste/e2e.
- Linhas 77-81: `execFileSync` passa a usar a constante.

**Funcoes, classes e importacoes especificas**

- `SeedTaskInput`: interface de dados usada pelo seed.
- `execFileSync`: invoca `manage.py shell`.
- `DJANGO_SETTINGS_MODULE`: direciona escrita do seed.

**Comportamento de libs usadas**

- TypeScript usa interface em tempo de typecheck; no runtime, o objeto vira JS normal.
- Django shell executa script em processo separado com env recebido.

### `frontend/e2e/seedYesterdayQueue.ts`

**Funcao geral do arquivo**

Seed E2E para montar fila de migracao diaria de tarefas de ontem.

**Funcao geral da alteracao**

Passa de `config.settings.dev` para `config.settings.e2e` via constante.

**Blocos principais**

- Linha 5: importa `DJANGO_SETTINGS_MODULE`.
- Linhas 7-16: comentario documenta branch Neon `e2e`.
- Linhas 58-62: `execFileSync` usa `env: { ...process.env, DJANGO_SETTINGS_MODULE }`.

**Funcoes, classes e importacoes especificas**

- `SeedTaskInput`: contrato de entrada do seed.
- `execFileSync`: executa seed Python sincrono.
- `DJANGO_SETTINGS_MODULE`: seleciona settings module.

**Comportamento de libs usadas**

- Node resolve caminhos com `path.dirname(fileURLToPath(import.meta.url))`; isso funciona em ES modules onde `__dirname` nao existe.

## 6. Contratos entre os arquivos

### Produtores e consumidores principais

- `backend/.env.example` e `README.md` ensinam a criar `.env.e2e`; `.gitignore` garante que esse arquivo real nao entre no Git.
- `backend/config/settings/e2e.py` consome `.env.e2e` e fornece a configuracao Django para banco Neon `e2e`.
- `frontend/e2e/backendEnv.ts` define o mesmo settings module para todos os consumidores frontend E2E.
- `frontend/playwright.config.ts` consome `backendEnv.ts` para subir o backend real sob `config.settings.e2e`.
- `frontend/e2e/seed*.ts` consomem `backendEnv.ts` para executar `manage.py shell` contra o mesmo banco do backend.
- `docs/e2e-neon-reset.md` referencia `purge_e2e_users` como ferramenta de reset cirurgico.
- `backend/core/tests/test_purge_e2e_users.py` valida `backend/core/management/commands/purge_e2e_users.py`.

### Tipo dos arquivos

- Source backend: `backend/config/settings/e2e.py`, `backend/core/management/**`, `backend/core/tests/test_purge_e2e_users.py`.
- Source/config frontend E2E: `frontend/e2e/backendEnv.ts`, `frontend/playwright.config.ts`, `frontend/e2e/seed*.ts`.
- Config/documentacao: `.gitignore`, `README.md`, `backend/.env.example`, `docs/e2e-neon-reset.md`.
- Artefatos BMAD: `_bmad-output/planning-artifacts/epics.md`, `_bmad-output/implementation-artifacts/**`, `_bmad-output/story-automator/**`.

