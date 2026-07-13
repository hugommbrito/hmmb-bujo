# Explicacao dos arquivos nao commitados - Story 4.2 migracao diaria

## Visao geral

O conjunto de mudancas implementa a Story 4.2: uma fila de migracao diaria para tarefas `pending`/`started` do Daily Log de ontem, um fluxo explicito de decisao por Migration Card, linhagem de migracao no backend e cobertura backend/frontend/E2E. A mudanca segue a ordem produtor-consumidor: servico de dominio cria a nova regra, views/URLs expõem a API, `schema.yaml` e `types.gen.ts` publicam o contrato, hooks React Query consomem os endpoints, a UI compoe banner/modal/card no Daily Log e os testes validam o fluxo.

Tambem existem artefatos de automacao da story/status e um arquivo `docs/futureIdeas.md` nao relacionado diretamente a story.

## Ordem logica de funcionamento

1. Artefatos de story/status registram que a Story 4.2 foi criada, implementada, testada e revisada.
2. `backend/bujo/services/migration.py` define a regra atomica de migrar/cancelar/postergar tarefas e subarvores.
3. Serializers, views e URLs validam payloads, expõem a fila de ontem e acionam o servico.
4. `schema.yaml` e `frontend/src/api/types.gen.ts` propagam os novos endpoints e schemas para o frontend.
5. Query keys, tipos e hooks React Query buscam a fila e executam a mutacao de migracao.
6. `MigrationBanner`, `MigrationFlow` e `MigrationCard` criam a experiencia: banner no Daily Log, dialog, atalhos e pickers.
7. `DailyPage` integra o banner na rota `/today`.
8. Testes backend, frontend e E2E validam servico, API, UI, acessibilidade, cache e fluxo real de navegador.

## 1. Artefatos de planejamento, automacao e status

### `_bmad-output/implementation-artifacts/4-2-migracao-diaria-com-migration-card-e-linhagem.md`

**Funcao geral do arquivo**

Artefato de implementacao da Story 4.2. E documento de story/status, nao codigo executavel.

**Funcao geral da alteracao**

Novo arquivo untracked que documenta a story completa como `Status: done`, incluindo ACs, tasks, dev notes, debug log, completion notes, senior review e file list.

**Blocos principais**

- Linhas 1-8: metadados, baseline commit e status final da story.
- Linhas 11-35: user story e acceptance criteria para banner, Migration Card e linhagem.
- Linhas 37-145: plano tecnico detalhado para servico, serializers/views/URLs e contrato gerado.
- Linhas 147-168: tarefas de testes de servico e camada de dados frontend.
- Linhas 160-190: especificacao dos componentes de migracao e decisao sobre `Dialog` real.
- Linhas 250-296: Dev Agent Record, debug logs, completion notes e resultado da revisao adversarial.
- Linhas 298-323: File List reconciliado, listando os arquivos de codigo, contrato, testes e E2E envolvidos.

**Funcoes, classes e importacoes especificas**

- Nao define simbolos executaveis. Produz contexto consumido por manutencao humana e pelo story automator.

**Comportamento de libs usadas**

- Markdown/YAML front matter: usado como formato leve de documentacao; o front matter carrega metadados e o corpo em Markdown preserva rastreabilidade.

### `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Funcao geral do arquivo**

Controle de progresso do sprint/epic em YAML.

**Funcao geral da alteracao**

Atualiza a Story 4.2 de `backlog` para `done` e altera o comentario de `last_updated` para indicar revisao concluida pelo `story-automator-review`.

**Blocos principais**

- Linhas 38-39: `last_updated` passa a referenciar Story 4.2 concluida.
- Linhas 70-73: `4-2-migracao-diaria-com-migration-card-e-linhagem` passa para `done`.

**Funcoes, classes e importacoes especificas**

- Nao ha simbolos de codigo. A chave da story e consumida por automacoes de sprint/status.

**Comportamento de libs usadas**

- YAML: estrutura chave-valor legivel por scripts e por humanos; a alteracao preserva o formato existente.

### `_bmad-output/story-automator/orchestration-4-20260712-232806.md`

**Funcao geral do arquivo**

Log de orquestracao do automator para o Epic 4.

**Funcao geral da alteracao**

Move a automacao de `currentStory: 4.1` para `4.2`, marca 4.1 como completa, deixa 4.2 em finalizacao e registra os eventos de create-story, dev-story, QA, review e commit gate.

**Blocos principais**

- Linhas 4-10: metadados da orquestracao atualizados para Story 4.2 e timestamp de 2026-07-13.
- Linhas 54-62: tabela passa 4.1 para `done` e 4.2 para `in-progress` no commit gate.
- Linhas 76-92: action log registra commit da 4.1, criacao da 4.2, tentativas de dev-story, automacao de testes e code review aprovado.

**Funcoes, classes e importacoes especificas**

- Nao ha simbolos executaveis. O arquivo e consumido como trilha operacional.

**Comportamento de libs usadas**

- Markdown com front matter: mantem estado e historico em um formato simples para automacao e revisao manual.

### `_bmad-output/implementation-artifacts/tests/test-summary.md`

**Funcao geral do arquivo**

Resumo acumulado das execucoes de teste por story.

**Funcao geral da alteracao**

Adiciona uma secao da Story 4.2, descrevendo o gap E2E encontrado e fechado, os novos testes Playwright, a cobertura por AC e a execucao final.

**Blocos principais**

- Linhas 727-738: contexto da Story 4.2 e gap fechado.
- Linhas 740-759: novos artefatos E2E (`seedYesterdayQueue.ts`, `migration-flow.spec.ts`).
- Linhas 761-770: mapeamento de ACs para testes.
- Linhas 772-795: observacoes, execucao e checklist.
- Linhas 797-801: proximos passos e gap de CI para E2E local.

**Funcoes, classes e importacoes especificas**

- Nao define codigo. Documenta como os testes produzidos nesta mudanca validam os contratos.

**Comportamento de libs usadas**

- Markdown: tabelas e checklists organizam evidencias de QA sem depender de tooling adicional.

## 2. Servico de dominio backend

### `backend/bujo/services/migration.py`

**Funcao geral do arquivo**

Novo arquivo de fonte backend. Centraliza a regra de migracao diaria e linhagem de tarefas.

**Funcao geral da alteracao**

Adiciona `migrate_task`, uma operacao transacional que decide uma tarefa para hoje, mes corrente, futuro ou cancelamento. Para migracoes/postergacoes, recria a tarefa no container de destino, atualiza `migration_count`, grava `migrated_to_task` na origem e migra recursivamente apenas filhos ainda nao dispostos.

**Blocos principais**

- Linhas 1-6: docstring registra FR/ADs e explicita que o servico reaproveita `create_task`, `update_task` e `transition_task`.
- Linhas 8-14: imports de transacao Django, modelo `Task`, servicos de logs/tasks/state machine e `today_for`.
- Linhas 17-50: `_migrate_subtree` transiciona a origem, cria o novo registro, conecta linhagem e recursa por filhos `pending`/`started`.
- Linhas 53-88: `migrate_task` escolhe o destino, trata cancelamento sem linhagem, materializa Daily/Monthly Log de destino e retorna a origem recarregada.

**Funcoes, classes e importacoes especificas**

- `transaction.atomic`: garante que transicao da origem, criacao do destino e atualizacao da linhagem sejam commitadas ou revertidas juntas.
- `_migrate_subtree`: helper privado recursivo; recebe `container_field` para escrever em `log` ou `monthly_log` sem duplicar a logica.
- `transition_task`: valida a matriz de estados existente; espera `user`, `task_id`, `to_status` e retorna a tarefa transicionada ou levanta `InvalidTransition`.
- `create_task`: cria a tarefa no container correto e calcula `order_index` conforme os servicos existentes.
- `update_task`: atualiza campos como `migration_count` e `migrated_to_task` sem criar uma API nova.
- `today_for`: fonte de data por usuario, usada para o destino "today".

**Comportamento de libs usadas**

- `django.db.transaction.atomic`: abre uma transacao; excecoes dentro do bloco abortam o conjunto inteiro.
- QuerySet reverso `source.subtasks.filter(...)`: espera filtros ORM e retorna filhos relacionados ao `Task`; aqui seleciona somente estados migraveis.

## 3. Serializers, views e rotas backend

### `backend/bujo/serializers.py`

**Funcao geral do arquivo**

Define serializers DRF para transformar modelos/payloads entre Python e JSON.

**Funcao geral da alteracao**

Adiciona os serializers do fluxo de migracao: um para responder a fila de ontem e outro para validar a decisao enviada pelo cliente.

**Blocos principais**

- Linhas 100-102: `MigrationQueueSerializer` retorna `log_date` e `tasks`.
- Linhas 105-108: `TaskMigrateSerializer` declara `destination`, `month_first` e `scheduled_date`.
- Linhas 110-133: `validate` aplica regras condicionais: mes corrente exige `scheduled_date`; futuro exige `month_first` no primeiro dia do mes; `scheduled_date`, se existir, deve cair no mesmo mes de `month_first`.

**Funcoes, classes e importacoes especificas**

- `MigrationQueueSerializer`: usa `TaskSerializer(many=True)` para serializar a mesma arvore de tarefas ja usada nos logs.
- `TaskMigrateSerializer`: `ChoiceField` limita destinos a `today`, `month`, `future`, `cancel`; `DateField` converte strings ISO para `date`.
- `validate`: hook DRF chamado apos validacao de campos individuais; retorna `attrs` normalizado ou levanta `serializers.ValidationError`.

**Comportamento de libs usadas**

- DRF `serializers.Serializer`: define schema sem depender diretamente de `ModelSerializer`.
- DRF `ValidationError`: produz resposta HTTP 400 quando usado em views com `is_valid(raise_exception=True)`.

### `backend/bujo/views.py`

**Funcao geral do arquivo**

Camada HTTP fina do app `bujo`: valida entrada, chama servicos e serializa respostas.

**Funcao geral da alteracao**

Importa o modelo `Log`, os serializers de migracao e o servico `migrate_task`; adiciona duas views: `MigrationQueueView` para listar a fila de ontem e `TaskMigrateView` para executar uma decisao.

**Blocos principais**

- Linhas 15-37: novos imports (`Log`, `MigrationQueueSerializer`, `TaskMigrateSerializer`, `migrate_task`).
- Linhas 217-229: `MigrationQueueView.get` calcula ontem via `today_for`, consulta `Log.objects.filter(...).first()` sem criar log inexistente e retorna apenas tarefas-raiz `pending`/`started`.
- Linhas 232-263: `TaskMigrateView.post` valida o payload, resolve `month_first` do mes corrente no servidor, rejeita futuro que nao seja posterior ao mes corrente, chama `migrate_task` e transforma `Task.DoesNotExist` em 404.

**Funcoes, classes e importacoes especificas**

- `MigrationQueueView`: endpoint de leitura da fila; produz dados consumidos por `useMigrationQueueQuery`.
- `TaskMigrateView`: endpoint de escrita; produz `TaskSerializer` da origem atualizada.
- `extend_schema`: informa ao drf-spectacular o request/response para gerar OpenAPI correto.
- `Log.objects.filter(...).first()`: retorna `None` se nao ha Daily Log de ontem; evita `get_or_create_daily_log`.
- `serializers.ValidationError`: usado na view para uma regra que depende de `today_for(request.user)`, nao apenas do payload.
- `NotFound`: mapeia acesso a tarefa inexistente ou de outro tenant para HTTP 404.

**Comportamento de libs usadas**

- DRF `APIView`: chama metodos HTTP (`get`, `post`) e integra excecoes DRF ao renderer de respostas.
- Django ORM `filter`: constroi consultas lazy; `.first()` executa e retorna o primeiro item ou `None`.
- drf-spectacular `extend_schema`: espera serializers/classes e entrega metadados OpenAPI para `schema.yaml`.

### `backend/bujo/urls.py`

**Funcao geral do arquivo**

Registro das rotas HTTP do app `bujo`.

**Funcao geral da alteracao**

Adiciona imports e paths para fila de migracao e mutacao de migracao por tarefa.

**Blocos principais**

- Linhas 3-14: importa `MigrationQueueView` e `TaskMigrateView`.
- Linhas 17-28: registra `migration/queue/` e `tasks/<uuid:pk>/migrate/`.

**Funcoes, classes e importacoes especificas**

- `path("migration/queue/", ...)`: liga GET `/api/bujo/migration/queue/` a `MigrationQueueView`.
- `path("tasks/<uuid:pk>/migrate/", ...)`: liga POST de decisao a `TaskMigrateView` e converte `pk` para UUID.

**Comportamento de libs usadas**

- Django `path`: espera um padrao, uma view e um nome; resolve a URL e injeta parametros tipados na view.

## 4. Contratos gerados

### `schema.yaml`

**Funcao geral do arquivo**

Contrato OpenAPI gerado para backend e frontend.

**Funcao geral da alteracao**

Adiciona dois paths e tres schemas relacionados a migracao, mantendo `security: jwtAuth` nos endpoints novos.

**Blocos principais**

- Linhas 134-147: novo GET `/api/bujo/migration/queue/`.
- Linhas 194-220: novo POST `/api/bujo/tasks/{id}/migrate/`.
- Linhas 323-335: `DestinationEnum`.
- Linhas 381-393: `MigrationQueue`.
- Linhas 543-556: `TaskMigrate`.

**Funcoes, classes e importacoes especificas**

- Nao ha funcoes executaveis. Os schemas sao consumidos pelo gerador TypeScript.

**Comportamento de libs usadas**

- OpenAPI 3: descreve paths, parametros, request bodies e responses para geracao de cliente/tipos.
- drf-spectacular: gera o YAML a partir das views/serializers anotados.

### `frontend/src/api/types.gen.ts`

**Funcao geral do arquivo**

Tipos TypeScript gerados a partir do OpenAPI.

**Funcao geral da alteracao**

Adiciona paths, operations e schemas para fila e mutacao de migracao.

**Blocos principais**

- Linhas 124-140: path `/api/bujo/migration/queue/`.
- Linhas 172-188: path `/api/bujo/tasks/{id}/migrate/`.
- Linhas 252-259: `DestinationEnum`.
- Linhas 280-285: `MigrationQueue`.
- Linhas 342-348: `TaskMigrate`.
- Linhas 560-585 e 627-657: operations `bujo_migration_queue_retrieve` e `bujo_tasks_migrate_create`.

**Funcoes, classes e importacoes especificas**

- `components["schemas"]["MigrationQueue"]`: tipo fonte para `MigrationQueue` em `features/bujo/types.ts`.
- `components["schemas"]["TaskMigrate"]`: shape aceito pela mutacao.
- `operations[...]`: descreve parametros e responses por endpoint.

**Comportamento de libs usadas**

- `openapi-typescript`: gera interfaces estaticas; nao executa chamadas HTTP, mas permite ao frontend tipar payloads e respostas.

## 5. Camada de dados frontend

### `frontend/src/api/keys.ts`

**Funcao geral do arquivo**

Centraliza query keys usadas pelo TanStack Query.

**Funcao geral da alteracao**

Adiciona `keys.bujo.migrationQueue()` para cachear a fila de migracao.

**Blocos principais**

- Linhas 13-19: secao `bujo` agora contem `migrationQueue: ['bujo', 'migrationQueue', 'list']`.

**Funcoes, classes e importacoes especificas**

- `migrationQueue`: factory de chave `as const`, consumida por `useMigrationQueueQuery` e invalidadas em `useMigrateTaskMutation`.

**Comportamento de libs usadas**

- TanStack Query usa arrays como identificadores de cache; invalidacoes por prefixo podem atingir grupos de queries.

### `frontend/src/features/bujo/types.ts`

**Funcao geral do arquivo**

Exporta aliases de tipos do contrato gerado para a feature `bujo`.

**Funcao geral da alteracao**

Exporta `MigrationQueue` a partir de `components['schemas']['MigrationQueue']`.

**Blocos principais**

- Linha 12: novo alias `MigrationQueue`.

**Funcoes, classes e importacoes especificas**

- `MigrationQueue`: tipa a resposta de `fetchMigrationQueue` e os mocks de teste.

**Comportamento de libs usadas**

- TypeScript type aliases: desaparecem em runtime e servem apenas para checagem estatica.

### `frontend/src/features/bujo/api.ts`

**Funcao geral do arquivo**

Hooks e funcoes HTTP da feature `bujo`, usando Axios client e TanStack Query.

**Funcao geral da alteracao**

Adiciona query para fila de migracao e mutacao para decidir uma tarefa, com invalidacao de todos os caches afetados.

**Blocos principais**

- Linhas 6-16: importa `MigrationQueue`.
- Linhas 229-239: `fetchMigrationQueue` e `useMigrationQueueQuery`.
- Linhas 241-248: tipo `MigrationDestination` e variaveis da mutacao.
- Linhas 250-253: `migrateTask` posta no endpoint por tarefa.
- Linhas 255-268: `useMigrateTaskMutation` invalida fila, log de hoje, monthly logs e future log apos sucesso.

**Funcoes, classes e importacoes especificas**

- `client.get`: espera URL e retorna resposta Axios; aqui entrega `MigrationQueue`.
- `client.post`: envia `destination`, `monthFirst` e/ou `scheduledDate` para o backend.
- `useQuery`: executa `fetchMigrationQueue`, gerencia loading/error/success e cacheia pela query key.
- `useMutation`: executa POST sob demanda e chama `onSuccess`.
- `queryClient.invalidateQueries`: marca queries como stale; com prefixos `['bujo','monthlyLog']` e `['bujo','futureLog']`, cobre meses especificos sem recalcular qual foi afetado.

**Comportamento de libs usadas**

- TanStack Query `useQuery`: espera `queryKey` e `queryFn`; retorna estados reativos (`isPending`, `data`, etc.).
- TanStack Query `useMutation`: espera `mutationFn`; `mutate` dispara a operacao e callbacks atualizam cache.
- Axios: `response.data` carrega o JSON ja parseado.

### `frontend/src/features/bujo/index.ts`

**Funcao geral do arquivo**

Barrel export da feature `bujo`.

**Funcao geral da alteracao**

Exporta os novos hooks, o componente `MigrationBanner`, o tipo `MigrationDestination` e o tipo `MigrationQueue`.

**Blocos principais**

- Linhas 1-14: hooks de migracao entram nos exports de API.
- Linhas 15-16: exporta `MigrationBanner` e `MigrationDestination`.
- Linhas 17-28: adiciona `MigrationQueue` aos tipos exportados.

**Funcoes, classes e importacoes especificas**

- `MigrationBanner`: exportado para consumo por `DailyPage`.
- `useMigrationQueueQuery`/`useMigrateTaskMutation`: disponiveis para testes e outros componentes via barrel.

**Comportamento de libs usadas**

- ES module re-export: simplifica imports dos consumidores sem alterar runtime dos modulos originais.

## 6. Componentes e integracao de UI

### `frontend/src/features/bujo/components/MigrationBanner.tsx`

**Funcao geral do arquivo**

Novo componente de UI da feature. Mostra o banner de tarefas pendentes de ontem e abre o fluxo de migracao.

**Funcao geral da alteracao**

Cria o ponto unico que `DailyPage` precisa compor. Ele consulta a fila, nao renderiza enquanto carrega ou quando vazia, e controla o estado local de abertura do `MigrationFlow`.

**Blocos principais**

- Linhas 1-4: imports React, MUI, hook de fila e `MigrationFlow`.
- Linhas 8-14: busca `tasks`, controla `flowOpen` e retorna `null` quando nao deve aparecer.
- Linhas 15-37: renderiza banner com texto de contagem, botao `Iniciar` e `MigrationFlow`.

**Funcoes, classes e importacoes especificas**

- `useState`: guarda se o modal esta aberto.
- `useMigrationQueueQuery`: fornece `data` e `isPending`.
- `MigrationFlow`: recebe snapshot da fila e callbacks de fechamento.

**Comportamento de libs usadas**

- MUI `Box`, `Button`, `Typography`: componentes visuais com prop `sx` para estilo baseado no tema.
- React conditional rendering: `return null` remove o banner do DOM.

### `frontend/src/features/bujo/components/MigrationCard.tsx`

**Funcao geral do arquivo**

Novo componente visual de um item da fila de migracao.

**Funcao geral da alteracao**

Renderiza titulo, descricao, subtarefas, indicador `N de M revisadas`, quatro acoes, atalhos visuais e pickers inline para mes/futuro com confirmacao automatica no `onChange`.

**Blocos principais**

- Linhas 1-18: imports, tipo `MigrationDecisionExtra` e props.
- Linhas 20-30: `currentMonthBounds` calcula min/max do mes corrente para o input de data.
- Linhas 32-44: estado local `futureDay`, refs de botoes e subtarefas.
- Linhas 45-56: handlers de pickers confirmam `month` ou `future`.
- Linhas 58-70: setas movem foco entre botoes quando nenhum picker esta aberto.
- Linhas 72-91: layout do card, indicador acessivel, titulo, descricao e subtarefas.
- Linhas 92-177: botoes e pickers de cada decisao.

**Funcoes, classes e importacoes especificas**

- `currentMonthBounds`: usa `new Date()` local para limitar UI; a validacao de dominio fica no backend.
- `handleMonthDateChange`: converte valor `YYYY-MM-DD` para `scheduledDate` e chama `onDecide('month')`.
- `handleFutureMonthChange`: transforma input `YYYY-MM` em `monthFirst: YYYY-MM-01`; combina com `futureDay` se preenchido.
- `handleArrowKeyDown`: usa refs para implementar navegacao por `ArrowUp`/`ArrowDown`.
- `TextField`: inputs nativos `date`, `month` e `number` encapsulados pelo MUI.

**Comportamento de libs usadas**

- React `useRef`: mantem referencias de botoes sem rerender.
- React `useState`: guarda o dia opcional de futuro.
- MUI `TextField`: renderiza input rotulado e repassa atributos por `slotProps`.
- DOM `document.activeElement`: usado para descobrir o botao focado e mover foco.

### `frontend/src/features/bujo/components/MigrationFlow.tsx`

**Funcao geral do arquivo**

Novo orquestrador do dialog de migracao.

**Funcao geral da alteracao**

Captura a fila ao abrir, mostra um card por vez, dispara a mutacao da decisao, avanca para o proximo card ou fecha ao terminar. Tambem implementa atalhos `1`-`4` em nivel de janela e usa `key={currentTask.id}` para resetar estado local do card entre tarefas.

**Blocos principais**

- Linhas 1-7: imports React, MUI Dialog/media query, hook de mutacao e `MigrationCard`.
- Linhas 8-12: props do fluxo.
- Linhas 17-23: estado local de snapshot, indice e picker ativo.
- Linhas 24-34: effect captura a fila somente quando abre.
- Linhas 36-55: `handleDecide` chama `migrate.mutate`, limpa picker, avanca indice ou fecha.
- Linhas 57-78: effect de teclado global para atalhos, ignorando inputs/editaveis.
- Linhas 80-101: renderiza `Dialog` MUI e `MigrationCard`.

**Funcoes, classes e importacoes especificas**

- `useMediaQuery('(max-width: 767px)')`: escolhe `fullScreen` em mobile.
- `useMigrateTaskMutation`: fornece `mutate` para persistir a decisao.
- `useCallback`: estabiliza `handleDecide` para o effect de teclado.
- `window.addEventListener('keydown', ...)`: permite atalhos mesmo sem foco em botao.
- `Dialog`: recebe `open`, `onClose`, `maxWidth`, `fullWidth`, `fullScreen` e `aria-label`.

**Comportamento de libs usadas**

- MUI `Dialog`: renderiza modal acessivel com backdrop e trata `Escape` via `onClose`.
- React effect cleanup: remove listener de teclado ao fechar/desmontar para evitar handlers duplicados.

### `frontend/src/pages/daily/DailyPage.tsx`

**Funcao geral do arquivo**

Pagina principal do Daily Log.

**Funcao geral da alteracao**

Importa e renderiza `MigrationBanner` no topo do `<main>`, antes do `DayHeader`, para que a migracao seja o primeiro sinal quando houver pendencias de ontem.

**Blocos principais**

- Linhas 1-8: `MigrationBanner` entra no import da feature.
- Linhas 68-71: `<MigrationBanner />` e composto no topo da pagina.

**Funcoes, classes e importacoes especificas**

- `MigrationBanner`: consome a query de fila e, quando necessario, controla `MigrationFlow`.

**Comportamento de libs usadas**

- React composition: a pagina nao conhece detalhes de card/mutacao; apenas monta o componente exportado pela feature.

## 7. Testes backend

### `backend/bujo/tests/test_services.py`

**Funcao geral do arquivo**

Testes de servicos de dominio do app `bujo`.

**Funcao geral da alteracao**

Adiciona cobertura de `migrate_task` para hoje, mes, futuro, cancelamento, transicoes invalidas, tenant scoping, contagem encadeada e subarvores.

**Blocos principais**

- Linhas 1-18: imports novos (`date`, `migrate_task`, `today_for`).
- Linhas 365-430: teste ancora AD-08: pai com filho concluido e pendente migra apenas o pendente.
- Linhas 433-455: destino `today`.
- Linhas 458-481: destino `month`.
- Linhas 484-514: destino `future` com e sem dia.
- Linhas 517-529: destino `cancel`.
- Linhas 532-541: estados nao migraveis levantam `InvalidTransition`.
- Linhas 544-555: migracao encadeada preserva incremento de `migration_count`.
- Linhas 558-580: subarvore de dois niveis preserva hierarquia.
- Linhas 583-591: tarefa de outro tenant resulta em `Task.DoesNotExist`.

**Funcoes, classes e importacoes especificas**

- `tenant_context`: coloca as queries no contexto do usuario correto.
- `LogFactory`/`TaskFactory`: criam dados de teste.
- `get_or_create_daily_log`/`get_or_create_monthly_log`: verificam containers criados pelo servico.
- `pytest.mark.parametrize`: roda o mesmo teste para multiplos estados invalidos.

**Comportamento de libs usadas**

- Pytest `mark.django_db`: habilita acesso ao banco de teste.
- Factory Boy/factories locais: constroem modelos com defaults para reduzir boilerplate.
- Django model `refresh_from_db`: recarrega estado persistido para assertions confiaveis.

### `backend/bujo/tests/test_views.py`

**Funcao geral do arquivo**

Testes de views/API do app `bujo`.

**Funcao geral da alteracao**

Adiciona cobertura dos endpoints `/migration/queue/` e `/tasks/{id}/migrate/`, incluindo validacoes HTTP 400/404/409.

**Blocos principais**

- Linhas 1-18: imports novos (`timedelta`, `Log`, `LogFactory`).
- Linhas 700-708: fila vazia sem materializar log de ontem.
- Linhas 711-738: fila retorna apenas raizes `pending`/`started` de ontem.
- Linhas 741-761: POST `destination=today`.
- Linhas 764-775: `month` sem `scheduledDate` retorna 400.
- Linhas 778-801: `month` com data cria destino no Monthly Log corrente.
- Linhas 804-819: `future` com mes corrente retorna 400.
- Linhas 822-842: `future` com data fora do mes retorna 400.
- Linhas 845-864: `future` sem dia cria tarefa sem `scheduled_date`.
- Linhas 867-880: `cancel` nao cria linhagem.
- Linhas 883-893: estados nao migraveis retornam 409.
- Linhas 896-906: outro tenant retorna 404.

**Funcoes, classes e importacoes especificas**

- `auth_client`: fixture autenticada que exerce a API como usuario real.
- `APIClient`: cliente de testes DRF usado pelas fixtures.
- `AccessToken`: autentica as chamadas nos testes existentes.
- `get_or_create_*`: confirma efeitos persistidos no banco.

**Comportamento de libs usadas**

- DRF test client `post(..., format="json")`: serializa payload como JSON e retorna objeto com `status_code` e `data`.
- Pytest parametrizacao: valida varios estados invalidos com o mesmo comportamento esperado.

## 8. Testes frontend unitarios e integracao

### `frontend/src/features/bujo/api.test.tsx`

**Funcao geral do arquivo**

Testa hooks de dados da feature `bujo`.

**Funcao geral da alteracao**

Adiciona testes para `useMigrationQueueQuery` e `useMigrateTaskMutation`.

**Blocos principais**

- Linhas 20-29: imports de novos hooks e tipo `MigrationQueue`.
- Linhas 438-461: fixture `MIGRATION_QUEUE` e teste do GET `/migration/queue/`.
- Linhas 463-542: testes da mutacao para `today`, `month`, `future` e `cancel`.

**Funcoes, classes e importacoes especificas**

- `renderHook`: executa hooks React em isolamento.
- `waitFor`: aguarda estado assíncrono `isSuccess`.
- `vi.spyOn(qc, 'invalidateQueries')`: verifica invalidacoes de cache.

**Comportamento de libs usadas**

- Vitest `vi.fn`/mocks: substituem `client.get` e `client.post`.
- React Testing Library `renderHook`: monta hook com wrapper de QueryClient.
- TanStack Query `QueryClient`: usado para verificar invalidacoes reais.

### `frontend/src/features/bujo/components/MigrationBanner.test.tsx`

**Funcao geral do arquivo**

Novo teste unitario do banner de migracao.

**Funcao geral da alteracao**

Valida ausencia em loading/fila vazia, texto exato, abertura do fluxo e acessibilidade.

**Blocos principais**

- Linhas 1-18: imports e mocks dos hooks de API.
- Linhas 20-35: fixture de task e helper de render com tema.
- Linhas 37-55: nao renderiza com fila vazia ou pending.
- Linhas 57-68: renderiza contagem correta.
- Linhas 70-82: clique em `Iniciar` abre card.
- Linhas 84-93: `jest-axe` sem violacoes.

**Funcoes, classes e importacoes especificas**

- `useMigrationQueueQuery`: mockado para controlar estados.
- `useMigrateTaskMutation`: mockado porque `MigrationFlow` e renderizado pelo banner.
- `axe`: analise automatica basica de acessibilidade.

**Comportamento de libs usadas**

- Testing Library `screen` e `fireEvent`: localizam elementos como usuario e disparam eventos DOM.
- MUI `ThemeProvider`: fornece tema necessario aos componentes.

### `frontend/src/features/bujo/components/MigrationCard.test.tsx`

**Funcao geral do arquivo**

Novo teste unitario do Migration Card.

**Funcao geral da alteracao**

Valida renderizacao de conteudo, indicador, quatro acoes, pickers automaticos e acessibilidade.

**Blocos principais**

- Linhas 9-26: task fixture com descricao e subtarefa.
- Linhas 28-48: helper `renderCard`.
- Linhas 50-96: conteudo e acoes basicas.
- Linhas 97-128: pickers de mes/futuro confirmam no `onChange`.
- Linhas 130-134: axe.

**Funcoes, classes e importacoes especificas**

- `onDecide`: spy que recebe `destination` e campos extras.
- `onOpenPicker`: spy que confirma abertura dos pickers.
- `fireEvent.change`: simula preenchimento de inputs nativos.

**Comportamento de libs usadas**

- Testing Library `getByLabelText`: garante labels acessiveis para inputs.
- Vitest `expect(...).toHaveBeenCalledWith`: verifica payloads produzidos pela UI.

### `frontend/src/features/bujo/components/MigrationFlow.test.tsx`

**Funcao geral do arquivo**

Novo teste unitario/integracao do dialog de migracao.

**Funcao geral da alteracao**

Valida avancar cards, `Esc`, atalhos, fechamento final, regressao de estado herdado entre cards e acessibilidade.

**Blocos principais**

- Linhas 1-13: imports e mock de `useMigrateTaskMutation`.
- Linhas 15-27: fila fixture e helper `renderFlow`.
- Linhas 34-43: avanco de card e chamada da mutacao.
- Linhas 45-54: `Esc` fecha sem mutar.
- Linhas 56-78: atalhos `1`, `4` e `2`.
- Linhas 80-86: fecha apos ultima tarefa.
- Linhas 88-101: regressao para `key={currentTask.id}`; dia de futuro nao vaza para o proximo card.
- Linhas 103-107: axe.

**Funcoes, classes e importacoes especificas**

- `MigrationFlow`: testado com fila real de objetos `Task`.
- `mockMutate`: captura payloads para backend.
- `fireEvent.keyDown(window, ...)`: simula atalhos globais.

**Comportamento de libs usadas**

- MUI `Dialog` no ambiente de teste: renderiza role `dialog` e reage a eventos de teclado.
- jest-axe: verifica problemas comuns de acessibilidade no DOM renderizado.

### `frontend/src/pages/daily/DailyPage.test.tsx`

**Funcao geral do arquivo**

Testes da pagina Daily Log.

**Funcao geral da alteracao**

Deixa `MigrationBanner` real no teste da pagina, adiciona `QueryClientProvider`, mocka `client`, define fila vazia como default e cria uma secao de integracao do banner.

**Blocos principais**

- Linhas 1-7: adiciona `waitFor` e `QueryClientProvider`.
- Linhas 10-35: mock parcial do barrel `features/bujo`, preservando componentes reais.
- Linhas 37-58: mock do client e helper `renderDailyPage` com QueryClient.
- Linhas 65-69: default de fila vazia.
- Linhas 354-443: testes de integracao do banner: aparece, abre fluxo e some apos invalidacao/refetch.

**Funcoes, classes e importacoes especificas**

- `importOriginal`: mantem exports reais exceto hooks do Daily Log.
- `QueryClientProvider`: necessario porque `MigrationBanner` usa React Query real.
- `mockGet`/`mockPost`: simulam fila e mutacao.

**Comportamento de libs usadas**

- TanStack Query em teste: o QueryClient controla cache/invalidation localmente.
- Testing Library `waitFor`: aguarda a UI refletir refetch apos mutacao.

### `frontend/src/app/layout/RouteAnnouncer.test.tsx`

**Funcao geral do arquivo**

Testa anuncio de mudanca de rota.

**Funcao geral da alteracao**

Mocka `MigrationBanner` como `null` nos testes que nao fornecem QueryClientProvider.

**Blocos principais**

- Linhas 14-24: comentario explica o motivo; mock do barrel inclui `MigrationBanner: () => null`.

**Funcoes, classes e importacoes especificas**

- `MigrationBanner`: mockado para isolar o teste de navegacao da query de migracao.

**Comportamento de libs usadas**

- Vitest module mocking: substitui exports do modulo para limitar o escopo do teste.

### `frontend/src/app/router.test.tsx`

**Funcao geral do arquivo**

Testa roteamento e protecao de rotas.

**Funcao geral da alteracao**

Segue o mesmo ajuste de `RouteAnnouncer.test.tsx`: mocka `MigrationBanner` para evitar dependencia de React Query nesses testes.

**Blocos principais**

- Linhas 18-28: comentario e mock do `MigrationBanner`.

**Funcoes, classes e importacoes especificas**

- `MigrationBanner`: removido do DOM neste teste porque o objetivo e rota/auth, nao fila de migracao.

**Comportamento de libs usadas**

- Vitest mock: permite que DailyPage seja renderizada em testes de roteador sem montar todo o grafo de dados.

## 9. E2E Playwright

### `frontend/e2e/fixtures.ts`

**Funcao geral do arquivo**

Fixtures compartilhadas para testes Playwright.

**Funcao geral da alteracao**

Faz `signUpAndLandOnToday` retornar o email do usuario criado e adiciona fixture `email` para seeds E2E por backend.

**Blocos principais**

- Linhas 2-17: `signUpAndLandOnToday` agora retorna `Promise<string>`.
- Linhas 20-31: `WeakMap<Page, string>` associa pagina ao email.
- Linhas 23-31: fixture `page` salva o email; fixture `email` o expõe aos specs.

**Funcoes, classes e importacoes especificas**

- `signUpAndLandOnToday`: cria usuario por UI, espera `/today` e retorna email.
- `emailByPage`: evita compartilhar estado global por string unica entre paginas.
- `base.extend<{ email: string }>`: adiciona fixture tipada ao Playwright.

**Comportamento de libs usadas**

- Playwright fixtures: compoem dependencias por teste; `page` roda antes de `email` porque `email` depende de `page`.
- `WeakMap`: associa dados a objetos sem impedir coleta de memoria.

### `frontend/e2e/seedYesterdayQueue.ts`

**Funcao geral do arquivo**

Novo helper E2E para popular tarefas de ontem no banco usado pelo backend real.

**Funcao geral da alteracao**

Executa `uv run python manage.py shell -c <script>` para criar Daily Log de ontem, tarefas-raiz e subtarefas para o usuario criado no teste.

**Blocos principais**

- Linhas 1-3: imports Node para executar processo e resolver caminho do backend.
- Linhas 5-12: comentario de escopo e `backendDir`.
- Linhas 14-19: tipo `SeedTaskInput`.
- Linhas 21-24: assinatura `seedYesterdayQueue(email, rootTasks)`.
- Linhas 25-54: script Python cria log de ontem via `today_for` e arvores de tarefas.
- Linhas 56-60: `execFileSync` roda o shell Django com settings de dev.

**Funcoes, classes e importacoes especificas**

- `execFileSync`: executa comando sincrono e falha o teste se o seed falhar.
- `fileURLToPath`/`path.resolve`: calculam caminho absoluto do backend em ambiente ESM.
- `tenant_context`: no script Python, garante isolamento do tenant correto.
- `today_for`: mesma autoridade temporal do endpoint real.

**Comportamento de libs usadas**

- Node `child_process.execFileSync`: espera binario e args separados, reduz risco de shell quoting.
- Django `manage.py shell -c`: executa codigo Python dentro do contexto da app.

### `frontend/e2e/migration-flow.spec.ts`

**Funcao geral do arquivo**

Novo spec E2E do fluxo de migracao diaria contra frontend e backend reais.

**Funcao geral da alteracao**

Adiciona cinco cenarios cobrindo banner, dialog, atalho, pausa por `Esc`, linhagem de subarvore e picker de mes.

**Blocos principais**

- Linhas 1-14: imports e comentario de escopo.
- Linhas 16-39: banner conta raizes e nao abre dialog automaticamente.
- Linhas 41-61: atalho `1` migra para hoje e remove banner apos reload.
- Linhas 63-83: `Esc` pausa e retoma a mesma fila.
- Linhas 85-115: pai migrado recria apenas filho pendente no destino.
- Linhas 117-141: `Adiar no mes` confirma no preenchimento do input de data.

**Funcoes, classes e importacoes especificas**

- `seedYesterdayQueue`: prepara dados fora da UI para criar a condicao "ontem".
- `syncAfter`: fixture existente que aguarda resposta/revalidacao apos a acao.
- `page.getByRole`/`getByText`/`getByTestId`: locators semanticos e por test id existente.
- `page.keyboard.press`: valida atalho real de navegador.

**Comportamento de libs usadas**

- Playwright `test`: isola cada caso com fixtures.
- Playwright `expect(locator).toBeVisible()`/`toHaveCount()`: aguarda estado assíncrono ate timeout.
- Browser real: valida Dialog/backdrop, inputs nativos e cache/refetch com mais fidelidade que testes unitarios.

## 10. Arquivo nao relacionado a Story 4.2

### `docs/futureIdeas.md`

**Funcao geral do arquivo**

Novo documento de notas futuras. E documentacao/ideacao, nao fonte de runtime.

**Funcao geral da alteracao**

Lista ideias futuras sobre logs de viagem/moradia/empregos, resumo diario, observacoes, integracao com food log, UI alternativa, shortcuts no iPhone e app mobile/widgets.

**Blocos principais**

- Linhas 1-14: checklist simples de ideias.

**Funcoes, classes e importacoes especificas**

- Nao ha simbolos executaveis.

**Comportamento de libs usadas**

- Markdown checklist: representa ideias como itens marcaveis. O arquivo nao e consumido pelo fluxo de migracao.

## 11. Encadeamento entre arquivos

- `backend/bujo/services/migration.py` e o produtor de comportamento de dominio.
- `backend/bujo/views.py` chama esse servico e usa `backend/bujo/serializers.py` para validar/responder.
- `backend/bujo/urls.py` torna as views alcancaveis por HTTP.
- `schema.yaml` e gerado a partir de views/serializers; `frontend/src/api/types.gen.ts` e gerado a partir dele.
- `frontend/src/features/bujo/types.ts` cria aliases do contrato gerado.
- `frontend/src/api/keys.ts` e `frontend/src/features/bujo/api.ts` definem cache, queries e mutations.
- `MigrationBanner` consome `useMigrationQueueQuery`; `MigrationFlow` e `MigrationCard` consomem `useMigrateTaskMutation` via callbacks.
- `DailyPage` monta `MigrationBanner`, expondo a feature em `/today`.
- Testes backend validam regra e API; testes frontend validam hooks/componentes; E2E valida o fluxo real fim a fim.

## 12. Inventario dos arquivos nao commitados

**Modificados**

- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/tests/test-summary.md`
- `_bmad-output/story-automator/orchestration-4-20260712-232806.md`
- `backend/bujo/serializers.py`
- `backend/bujo/tests/test_services.py`
- `backend/bujo/tests/test_views.py`
- `backend/bujo/urls.py`
- `backend/bujo/views.py`
- `frontend/e2e/fixtures.ts`
- `frontend/src/api/keys.ts`
- `frontend/src/api/types.gen.ts`
- `frontend/src/app/layout/RouteAnnouncer.test.tsx`
- `frontend/src/app/router.test.tsx`
- `frontend/src/features/bujo/api.test.tsx`
- `frontend/src/features/bujo/api.ts`
- `frontend/src/features/bujo/index.ts`
- `frontend/src/features/bujo/types.ts`
- `frontend/src/pages/daily/DailyPage.test.tsx`
- `frontend/src/pages/daily/DailyPage.tsx`
- `schema.yaml`

**Novos**

- `_bmad-output/implementation-artifacts/4-2-migracao-diaria-com-migration-card-e-linhagem.md`
- `backend/bujo/services/migration.py`
- `docs/futureIdeas.md`
- `frontend/e2e/migration-flow.spec.ts`
- `frontend/e2e/seedYesterdayQueue.ts`
- `frontend/src/features/bujo/components/MigrationBanner.test.tsx`
- `frontend/src/features/bujo/components/MigrationBanner.tsx`
- `frontend/src/features/bujo/components/MigrationCard.test.tsx`
- `frontend/src/features/bujo/components/MigrationCard.tsx`
- `frontend/src/features/bujo/components/MigrationFlow.test.tsx`
- `frontend/src/features/bujo/components/MigrationFlow.tsx`

