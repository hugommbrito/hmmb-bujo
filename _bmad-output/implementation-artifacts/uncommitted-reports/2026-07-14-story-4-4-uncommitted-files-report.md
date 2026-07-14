# Explicacao dos arquivos nao commitados - Story 4.4 Catch-Up de dias pulados

## Visao geral

O conjunto de mudancas implementa a Story 4.4: um fluxo de Catch-Up para reconciliar tarefas antigas que ficaram fora das janelas ja cobertas por migracao diaria, revisao semanal e revisao mensal. A solucao e aditiva: cria uma fila backend propria para itens mais antigos que ontem, semana anterior e mes anterior; expoe o contrato OpenAPI; adiciona hook/tipos/chave de cache no frontend; orquestra um unico dialog em ordem mes -> semana -> dia; integra o banner na DailyPage; e amplia testes unitarios, de view, de servico e E2E.

## Ordem logica de funcionamento

1. A story/status em `_bmad-output` registra que a 4.4 foi criada, implementada, testada e revisada.
2. O backend serializa e publica `GET /api/bujo/catch-up/queue/`.
3. A view calcula as fronteiras de ontem, semana anterior e mes anterior, mas usa comparacao estritamente anterior para evitar sobreposicao com os banners existentes.
4. O schema OpenAPI e os tipos gerados levam `CatchUpQueue` para o frontend.
5. A camada API frontend busca a fila e invalida esse cache apos cada migracao.
6. `MigrationFlow` ganha `onExhausted` para avisar que uma subfila acabou sem fechar obrigatoriamente o dialog.
7. `CatchUpFlow` usa esse sinal para encadear mensal, semanal e diario no mesmo dialog.
8. `CatchUpBanner` soma as tres filas, abre o fluxo e e renderizado na DailyPage.
9. Testes validam isolamento de janelas, nao-materializacao, tenant, contagem de migracao, contrato do hook, acessibilidade, integracao e browser real.

## 1. Artefatos de planejamento e automacao

### `_bmad-output/implementation-artifacts/4-4-catch-up-de-dias-pulados.md`

**Funcao geral do arquivo**

Arquivo de story da 4.4. E um artefato de implementacao, nao codigo de runtime.

**Funcao geral da alteracao**

Novo arquivo documentando ACs, tarefas, decisoes de design, evidencias de execucao, lista de arquivos e revisao final da story.

**Blocos principais**

- Linhas 1-8: metadata, baseline commit e status final `done`.
- Linhas 11-29: historia e acceptance criteria para Catch-Up generalizado e lacunas honestas.
- Linhas 31-170: checklist implementado, com ordem backend -> contrato -> frontend -> E2E.
- Linhas 172-232: Dev Notes explicando por que Catch-Up e aditivo, por que `onExhausted` foi escolhido e quais componentes/servicos devem ser reaproveitados.
- Linhas 234-259: Dev Agent Record com modelo usado, debug log e resultados de verificacao.
- Linhas 260-285: File List da story.
- Linhas 287-297: Senior Developer Review aprovando a implementacao sem achados remanescentes.

**Funcoes, classes e importacoes especificas**

- Nao define simbolos executaveis. Serve como contrato humano para as alteracoes seguintes.

**Comportamento de libs usadas**

- Nao usa bibliotecas em runtime.

### `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Funcao geral do arquivo**

Status consolidado do sprint/epico usado pelo workflow BMad.

**Funcao geral da alteracao**

Atualiza a story 4.4 de `backlog` para `done` e troca o comentario `last_updated` de story 4.3 para story 4.4.

**Blocos principais**

- Linhas alteradas perto de `last_updated`: indicam que a ultima story concluida por code-review e a 4.4.
- Linha de `development_status.4-4-catch-up-de-dias-pulados`: passa para `done`.

**Funcoes, classes e importacoes especificas**

- Nao ha simbolos; e configuracao/artefato YAML.

**Comportamento de libs usadas**

- Consumido por automacoes BMad como YAML estruturado.

### `_bmad-output/story-automator/orchestration-4-20260712-232806.md`

**Funcao geral do arquivo**

Diario de orquestracao automatica do Epic 4.

**Funcao geral da alteracao**

Avanca `currentStory` para 4.4, registra a conclusao da 4.3 e o ciclo de criacao, review, dev-story e automacao da 4.4.

**Blocos principais**

- Linhas 4-11: metadata do orquestrador agora apontando para story 4.4.
- Linhas 56-63: tabela mostra 4.3 concluida e 4.4 em fluxo.
- Linhas 94-106: log operacional registra commit da 4.3, criacao da 4.4, review gate, dev-story, retries de automacao e sucesso do teste E2E adicional.

**Funcoes, classes e importacoes especificas**

- Nao ha simbolos executaveis.

**Comportamento de libs usadas**

- Markdown consumido por humanos e/ou automacoes de acompanhamento.

### `_bmad-output/implementation-artifacts/tests/test-summary.md`

**Funcao geral do arquivo**

Historico de resumo de testes das stories.

**Funcao geral da alteracao**

Adiciona a secao da Story 4.4, destacando um gap E2E fechado: Esc pausa o Catch-Up inteiro e reabrir retoma no estagio correto.

**Blocos principais**

- Nova secao `Resumo de Automacao de Testes - Story 4.4`.
- Tabela de gap: falta de prova em browser real para pausa/retomada entre estagios.
- Secao de testes gerados: adiciona teste em `frontend/e2e/catch-up.spec.ts`.
- Matriz de AC: mapeia AC1/AC2 para testes de view, servico, componente e E2E.
- Execucao: documenta execucoes isoladas e flakiness ambiental conhecida.

**Funcoes, classes e importacoes especificas**

- Nao ha simbolos executaveis.

**Comportamento de libs usadas**

- Documenta `pytest`, DRF `APIClient`, Vitest, Testing Library, `jest-axe` e Playwright como ferramentas de validacao.

## 2. Backend: serializacao, view e rota

### `backend/bujo/serializers.py`

**Funcao geral do arquivo**

Define serializers DRF da app BuJo. Eles transformam models/estruturas Python em payloads JSON e validam payloads de entrada.

**Funcao geral da alteracao**

Adiciona `CatchUpQueueSerializer`, que expõe tres listas separadas para preservar o nivel de origem das tarefas: mensal, semanal e diaria.

**Blocos principais**

- Linhas 101-114: serializers existentes das filas `MigrationQueue`, `WeeklyReviewQueue` e `MonthlyReviewQueue`, usados como molde.
- Linhas 116-119: `CatchUpQueueSerializer` com `monthly_tasks`, `weekly_tasks` e `daily_tasks`, todas usando `TaskSerializer(many=True)`.

**Funcoes, classes e importacoes especificas**

- `TaskSerializer`: serializa cada tarefa e subtarefas recursivamente.
- `CatchUpQueueSerializer`: estrutura a resposta agregada do endpoint novo sem achatar a origem das tarefas.

**Comportamento de libs usadas**

- `serializers.Serializer`: classe DRF para payloads que nao precisam mapear diretamente para um model.
- `TaskSerializer(many=True)`: DRF espera um iteravel/queryset de tarefas e retorna lista serializada. E usado porque as filas podem receber querysets lazy do Django.

### `backend/bujo/views.py`

**Funcao geral do arquivo**

Contem views finas da app BuJo: recebem requests, calculam/validam entradas simples, chamam services ou querysets e retornam serializers.

**Funcao geral da alteracao**

Importa `CatchUpQueueSerializer` e adiciona `CatchUpQueueView`, que detecta tarefas antigas por query sem criar logs novos.

**Blocos principais**

- Linhas 15-31: import da nova serializer junto das serializers de filas existentes.
- Linhas 238-282: views existentes de migracao diaria, revisao semanal e revisao mensal; elas cobrem exatamente ontem, semana anterior e mes anterior.
- Linhas 285-291: `CatchUpQueueView.get` calcula `today`, `yesterday`, `previous_week_start` e `previous_month_first`.
- Linhas 293-296: helper local `undisposed_roots` filtra apenas tarefas raiz com status `pending` ou `started`.
- Linhas 298-306: querysets de catch-up usando `<` para buscar periodos mais antigos que as tres janelas existentes.
- Linhas 308-313: monta o payload e retorna `CatchUpQueueSerializer(data).data`.

**Funcoes, classes e importacoes especificas**

- `CatchUpQueueView`: APIView nova para `GET /api/bujo/catch-up/queue/`.
- `today_for(request.user)`: respeita calendario/timezone do usuario; evita `date.today()` global.
- `week_start_of(today)`: normaliza o inicio da semana para comparar semanas.
- `Task.objects.filter(...)`: consulta tarefas por relacao `monthly_log`, `weekly_log` ou `log`.
- `undisposed_roots`: garante que subtarefas nao aparecam como itens independentes no banner.

**Comportamento de libs usadas**

- `APIView` do DRF espera metodos HTTP como `get` e retorna `Response`.
- `extend_schema(responses=CatchUpQueueSerializer)` do drf-spectacular alimenta o OpenAPI gerado.
- Querysets Django sao lazy: os filtros so sao avaliados quando o serializer itera os dados.
- `order_by("...")` ordena por data de origem, mais antigo primeiro dentro de cada nivel.

### `backend/bujo/urls.py`

**Funcao geral do arquivo**

Mapeia rotas da app BuJo para views Django/DRF.

**Funcao geral da alteracao**

Registra o endpoint `catch-up/queue/`.

**Blocos principais**

- Linhas 3-18: importa `CatchUpQueueView`.
- Linhas 20-39: adiciona `path("catch-up/queue/", CatchUpQueueView.as_view(), name="bujo-catch-up-queue")`.

**Funcoes, classes e importacoes especificas**

- `path`: cria entrada de roteamento.
- `CatchUpQueueView.as_view()`: converte a classe DRF em callable compatível com URLConf.

**Comportamento de libs usadas**

- Django resolve `/api/bujo/catch-up/queue/` combinando este path com o prefixo configurado no projeto.

## 3. Backend: testes

### `backend/bujo/tests/test_services.py`

**Funcao geral do arquivo**

Testa servicos de dominio da app BuJo, especialmente migracao de tarefas.

**Funcao geral da alteracao**

Adiciona cobertura para provar que `migration_count` aumenta por decisao, nao por quantidade de dias pulados.

**Blocos principais**

- Linha 4: importa `timedelta`.
- Linhas 603-619: novo teste cria um `Log` de 10 dias atras, uma task pendente com `migration_count=0`, chama `migrate_task(..., destination="today")` uma vez e espera `migration_count == 1` na tarefa criada.

**Funcoes, classes e importacoes especificas**

- `tenant_context(user)`: garante isolamento multi-tenant na criacao/leitura.
- `today_for(user)`: calcula data base do usuario.
- `LogFactory` e `TaskFactory`: factories de teste.
- `migrate_task`: service reaproveitado pela UI; retorna resultado com `migrated_to_task`.

**Comportamento de libs usadas**

- `pytest.mark.django_db`: permite acesso ao banco no teste.
- `timedelta(days=10)`: cria uma lacuna de calendario longa sem exigir chamadas repetidas.

### `backend/bujo/tests/test_views.py`

**Funcao geral do arquivo**

Testa endpoints DRF da app BuJo via cliente autenticado.

**Funcao geral da alteracao**

Adiciona uma secao `CatchUpQueueView` cobrindo nao sobreposicao, filtros por status/raiz, nao-materializacao de logs e tenant.

**Blocos principais**

- Linhas 1055-1089: regressao de sobreposicao; itens de ontem, semana anterior e mes anterior nao aparecem no Catch-Up.
- Linhas 1092-1121: fila diaria traz apenas raizes `pending`/`started` mais antigas que ontem.
- Linhas 1124-1154: equivalente para `weekly_tasks`.
- Linhas 1157-1187: equivalente para `monthly_tasks`.
- Linhas 1190-1206: confirma que chamar o endpoint nao cria `Log`, `WeeklyLog` ou `MonthlyLog`.
- Linhas 1209-1223: confirma escopo por tenant.

**Funcoes, classes e importacoes especificas**

- `auth_client.get("/api/bujo/catch-up/queue/")`: exercita a rota real.
- `LogFactory`, `WeeklyLogFactory`, `MonthlyLogFactory`, `TaskFactory`: constroem cenarios por tipo de log.
- `Task.Status.PENDING`, `STARTED`, `COMPLETED`, `CANCELLED`: validam inclusao/exclusao por estado.

**Comportamento de libs usadas**

- DRF `APIClient` retorna `response.status_code` e `response.data` ja parseado.
- Django ORM `objects.count()` e usado antes/depois para provar ausencia de materializacao.

## 4. Contrato OpenAPI e tipos gerados

### `schema.yaml`

**Funcao geral do arquivo**

Contrato OpenAPI gerado para o backend.

**Funcao geral da alteracao**

Inclui o path `GET /api/bujo/catch-up/queue/` e o schema `CatchUpQueue`.

**Blocos principais**

- Linhas adicionadas perto de 57: novo path com `operationId: bujo_catch_up_queue_retrieve`, tag `bujo`, `jwtAuth` e resposta 200.
- Linhas adicionadas perto de 349: schema `CatchUpQueue` com `monthlyTasks`, `weeklyTasks`, `dailyTasks`, todas arrays de `Task` e todas obrigatorias.

**Funcoes, classes e importacoes especificas**

- Nao define funcoes; e contrato gerado.

**Comportamento de libs usadas**

- drf-spectacular converte nomes snake_case do serializer para camelCase no schema conforme convencao do projeto.

### `frontend/src/api/types.gen.ts`

**Funcao geral do arquivo**

Tipos TypeScript gerados a partir do OpenAPI.

**Funcao geral da alteracao**

Adiciona a rota, o schema e a operation de Catch-Up.

**Blocos principais**

- Linhas 60-75: adiciona `"/api/bujo/catch-up/queue/"` em `paths`.
- Linhas 290-295: adiciona `components.schemas.CatchUpQueue`.
- Linhas 527-545: adiciona `operations.bujo_catch_up_queue_retrieve`.

**Funcoes, classes e importacoes especificas**

- `components["schemas"]["CatchUpQueue"]`: tipo gerado consumido por `frontend/src/features/bujo/types.ts`.
- `operations["bujo_catch_up_queue_retrieve"]`: descreve a resposta 200 do endpoint.

**Comportamento de libs usadas**

- `openapi-typescript` gera interfaces estruturais; o frontend nao edita este arquivo manualmente.

## 5. Frontend: chaves, tipos e API

### `frontend/src/api/keys.ts`

**Funcao geral do arquivo**

Centraliza query keys do TanStack Query.

**Funcao geral da alteracao**

Adiciona a chave `catchUpQueue`.

**Blocos principais**

- Linha adicionada na secao `bujo`: `catchUpQueue: () => ['bujo', 'catchUpQueue', 'list'] as const`.

**Funcoes, classes e importacoes especificas**

- `keys.bujo.catchUpQueue()`: chave estavel usada no hook e na invalidacao apos migracao.

**Comportamento de libs usadas**

- TanStack Query compara `queryKey` estruturalmente; `as const` preserva tupla literal para tipos mais precisos.

### `frontend/src/features/bujo/types.ts`

**Funcao geral do arquivo**

Reexporta tipos de dominio da feature BuJo a partir dos tipos OpenAPI gerados.

**Funcao geral da alteracao**

Adiciona `CatchUpQueue`.

**Blocos principais**

- Linha final: `export type CatchUpQueue = components['schemas']['CatchUpQueue']`.

**Funcoes, classes e importacoes especificas**

- `components`: namespace gerado por OpenAPI.

**Comportamento de libs usadas**

- TypeScript type alias nao gera codigo em runtime; apenas valida chamadas e props em build/test.

### `frontend/src/features/bujo/api.ts`

**Funcao geral do arquivo**

Camada de dados da feature BuJo: hooks de query/mutation que chamam o client HTTP e mantem caches sincronizados.

**Funcao geral da alteracao**

Adiciona fetch/hook para a fila de Catch-Up e invalida esse cache quando uma tarefa e migrada.

**Blocos principais**

- Linhas 6-19: importa `CatchUpQueue`.
- Linhas 278-288: `fetchCatchUpQueue` faz GET em `/api/bujo/catch-up/queue/`; `useCatchUpQueueQuery` registra a query com `keys.bujo.catchUpQueue()`.
- Linhas 304-320: `useMigrateTaskMutation` passa a invalidar `catchUpQueue` junto das demais filas e logs.

**Funcoes, classes e importacoes especificas**

- `client.get<CatchUpQueue>`: espera resposta JSON no shape do tipo gerado e retorna `response.data`.
- `useQuery`: expõe estados `isPending`, `data`, `isSuccess`, etc. para componentes.
- `useMutation`: executa POST de migracao.
- `queryClient.invalidateQueries`: marca caches como stale e dispara refetch quando apropriado.

**Comportamento de libs usadas**

- TanStack Query usa `queryKey` para deduplicar/cachear GETs.
- Axios-like `client.get` retorna objeto com `data`; o hook devolve apenas o payload.

### `frontend/src/features/bujo/index.ts`

**Funcao geral do arquivo**

Barrel export da feature BuJo.

**Funcao geral da alteracao**

Exporta o hook, o componente e o tipo novos para consumidores externos da feature.

**Blocos principais**

- Exporta `useCatchUpQueueQuery`.
- Exporta `CatchUpBanner`.
- Exporta tipo `CatchUpQueue`.

**Funcoes, classes e importacoes especificas**

- `CatchUpBanner`: usado por `DailyPage`.
- `CatchUpQueue`: usado por testes e consumidores tipados.

**Comportamento de libs usadas**

- ES modules reexportam simbolos sem criar nova logica de runtime.

## 6. Frontend: fluxo e componentes

### `frontend/src/features/bujo/components/MigrationFlow.tsx`

**Funcao geral do arquivo**

Renderiza o dialog de migracao para uma fila de tarefas de um unico nivel (`daily`, `weekly` ou `monthly`).

**Funcao geral da alteracao**

Adiciona prop opcional `onExhausted` para permitir que um orquestrador externo continue para outra fila quando a fila atual acabar.

**Blocos principais**

- Linhas 8-14: `MigrationFlowProps` inclui `onExhausted?: () => void`.
- Linhas 19-25: destructuring recebe a nova prop.
- Linhas 46-67: `handleDecide` chama `migrate.mutate`, limpa picker e, se acabou o snapshot, chama `onExhausted ?? onClose`.
- Linhas 76-110: atalhos continuam por `flowType`; Esc continua sob `Dialog.onClose`, sem acionar `onExhausted`.
- Linhas 115-133: `Dialog` MUI renderiza `MigrationCard` com `key={currentTask.id}`.

**Funcoes, classes e importacoes especificas**

- `onExhausted`: callback para o caso de exaustao natural da fila.
- `handleDecide`: ponto unico que decide migrar/cancelar/adiar uma tarefa.
- `useMigrateTaskMutation`: executa a mutacao backend.
- `MigrationCard`: componente de apresentacao dos botoes por contexto.

**Comportamento de libs usadas**

- `useCallback` memoiza o handler conforme dependencias.
- `useEffect` captura snapshot apenas ao abrir (`open`) para evitar mudanca da fila durante refetch.
- MUI `Dialog` chama `onClose` para Esc/backdrop; isso preserva pausa sem decisao.

### `frontend/src/features/bujo/components/CatchUpFlow.tsx`

**Funcao geral do arquivo**

Novo componente de orquestracao do Catch-Up. Ele nao decide tarefas diretamente; encadeia instancias de `MigrationFlow`.

**Funcao geral da alteracao**

Arquivo novo.

**Blocos principais**

- Linhas 6-12: props recebem tres filas, `open` e `onClose`.
- Linha 14: `STAGE_ORDER` fixa a ordem `monthly`, `weekly`, `daily`.
- Linhas 26-31: mapeia cada stage para sua fila e mantém `stageIndex`.
- Linhas 33-39: ao abrir, escolhe o primeiro stage com tarefas.
- Linhas 41-49: `handleExhausted` pula stages vazios ou fecha quando nao ha mais filas.
- Linhas 51-63: renderiza `MigrationFlow` com `key={stage}`, `flowType={stage}` e `onExhausted={handleExhausted}`.

**Funcoes, classes e importacoes especificas**

- `STAGE_ORDER`: codifica a AC de ordem mes -> semana -> dia.
- `queuesByStage`: preserva a associacao fila/nivel para passar o `flowType` correto.
- `handleExhausted`: transicao entre subfilas.
- `MigrationFlow`: motor reaproveitado para cada subfila.

**Comportamento de libs usadas**

- `useEffect` recalcula o primeiro stage somente quando `open` muda; reabrir usa dados frescos vindos do pai/query.
- `useState` controla apenas o indice de stage.
- React `key={stage}` força remount do `MigrationFlow` ao mudar de nivel, limpando `snapshot` e `currentIndex` internos.

### `frontend/src/features/bujo/components/CatchUpBanner.tsx`

**Funcao geral do arquivo**

Novo banner exibido na DailyPage quando existe fila de Catch-Up.

**Funcao geral da alteracao**

Arquivo novo.

**Blocos principais**

- Linhas 1-4: importa React state, MUI, hook de API e `CatchUpFlow`.
- Linhas 8-14: busca a fila e calcula `total` somando mensal, semanal e diaria.
- Linha 16: nao renderiza enquanto pendente ou sem tarefas.
- Linhas 20-38: renderiza box com mensagem e botao `Iniciar Catch-Up`.
- Linhas 39-45: monta `CatchUpFlow` com as tres listas e controla `open`.

**Funcoes, classes e importacoes especificas**

- `useCatchUpQueueQuery`: fonte de dados do banner.
- `setFlowOpen`: controla abertura/fechamento local do fluxo.
- `CatchUpFlow`: consumidor das listas agregadas.

**Comportamento de libs usadas**

- MUI `Box`, `Button`, `Typography` compoem a UI.
- React `useState` persiste o estado de abertura entre renders.

## 7. Frontend: integracao na pagina

### `frontend/src/pages/daily/DailyPage.tsx`

**Funcao geral do arquivo**

Pagina principal do Daily Log, compondo banners, cabecalho, lista de tarefas, criacao, reorder e painel de detalhe.

**Funcao geral da alteracao**

Importa e renderiza `CatchUpBanner` abaixo dos tres banners existentes.

**Blocos principais**

- Linhas 3-11: import do `CatchUpBanner` pelo barrel da feature.
- Linhas 73-79: ordem visual dos banners: migracao diaria, semanal, mensal, catch-up.

**Funcoes, classes e importacoes especificas**

- `DailyPage`: agora inclui o ponto de entrada visual do Catch-Up.
- `CatchUpBanner`: unico componente novo exposto para a pagina.

**Comportamento de libs usadas**

- React renderiza todos os banners; cada um decide internamente se retorna `null` conforme sua query.

### `frontend/src/app/layout/RouteAnnouncer.test.tsx`

**Funcao geral do arquivo**

Testa anuncio de navegacao/rota, mockando partes da DailyPage que nao sao foco do teste.

**Funcao geral da alteracao**

Atualiza comentario e mock do barrel `features/bujo` para incluir `CatchUpBanner`.

**Blocos principais**

- Comentario passa a listar quatro banners.
- Mock adiciona `CatchUpBanner: () => null`.

**Funcoes, classes e importacoes especificas**

- `vi.mock('../../features/bujo', ...)`: evita que o teste precise de `QueryClientProvider`.

**Comportamento de libs usadas**

- Vitest substitui o modulo importado por implementacao fake durante o teste.

### `frontend/src/app/router.test.tsx`

**Funcao geral do arquivo**

Testa roteamento da aplicacao.

**Funcao geral da alteracao**

Adiciona `CatchUpBanner` ao mock de `features/bujo`.

**Blocos principais**

- Mock do barrel agora inclui `CatchUpBanner: () => null`.

**Funcoes, classes e importacoes especificas**

- `vi.mock('../features/bujo', ...)`: isola os testes de router das queries do banner.

**Comportamento de libs usadas**

- Vitest hoista mocks de modulo, garantindo que imports da pagina usem o fake.

## 8. Frontend: testes de API e componentes

### `frontend/src/features/bujo/api.test.tsx`

**Funcao geral do arquivo**

Testa hooks de API da feature BuJo com client HTTP mockado e QueryClient de teste.

**Funcao geral da alteracao**

Verifica que migracao invalida a fila de Catch-Up e que `useCatchUpQueueQuery` chama o endpoint correto.

**Blocos principais**

- Imports adicionam `useCatchUpQueueQuery` e tipo `CatchUpQueue`.
- Teste de `useMigrateTaskMutation` passa a esperar invalidacao de `keys.bujo.catchUpQueue()`.
- Linhas 640-667: define `CATCH_UP_QUEUE` e testa GET em `/api/bujo/catch-up/queue/`.

**Funcoes, classes e importacoes especificas**

- `renderHook`: monta hook isolado.
- `waitFor`: aguarda transicao assíncrona para sucesso.
- `mockGet`: comprova URL chamada.

**Comportamento de libs usadas**

- Testing Library `renderHook` executa hooks em componente de teste.
- TanStack Query resolve promise da query e atualiza `result.current`.

### `frontend/src/features/bujo/components/MigrationFlow.test.tsx`

**Funcao geral do arquivo**

Testa comportamento do dialog de migracao.

**Funcao geral da alteracao**

Adiciona testes para a nova prop `onExhausted`.

**Blocos principais**

- Helper `renderFlow` passa a aceitar `onExhausted`.
- Novos testes validam: ultima decisao chama `onExhausted` e nao `onClose`; sem `onExhausted`, comportamento antigo chama `onClose`; Esc chama apenas `onClose`.

**Funcoes, classes e importacoes especificas**

- `fireEvent.click`: simula decisoes nos botoes.
- `fireEvent.keyDown`: simula Esc.
- `vi.fn`: espiona chamadas de callbacks.

**Comportamento de libs usadas**

- Testing Library consulta elementos por role/nome, testando comportamento acessivel observavel.

### `frontend/src/features/bujo/components/CatchUpFlow.test.tsx`

**Funcao geral do arquivo**

Novo teste unitario do orquestrador de Catch-Up.

**Funcao geral da alteracao**

Arquivo novo.

**Blocos principais**

- Linhas 8-12: mocka `useMigrateTaskMutation`.
- Linhas 14-20: helper `makeTask` e fixtures mensal/semanal/diaria.
- Linhas 22-40: helper `renderFlow` com `ThemeProvider`.
- Linhas 47-56: somente mensal abre em mensal e fecha ao esgotar.
- Linhas 58-72: semanal + diario pula mensal vazio, avanca de semanal para diario e fecha no fim.
- Linhas 74-82: mensal para semanal mantem dialog aberto.
- Linhas 84-94: Esc no semanal pausa o fluxo sem migrar e sem pular para diario.

**Funcoes, classes e importacoes especificas**

- `CatchUpFlow`: componente sob teste.
- `mockMutate`: verifica destino enviado (`week`, `today`, `cancel`).

**Comportamento de libs usadas**

- `ThemeProvider` fornece tema MUI necessario para componentes filhos.
- Vitest `beforeEach` limpa mocks para evitar vazamento entre casos.

### `frontend/src/features/bujo/components/CatchUpBanner.test.tsx`

**Funcao geral do arquivo**

Novo teste do banner de Catch-Up.

**Funcao geral da alteracao**

Arquivo novo.

**Blocos principais**

- Linhas 9-14: mocka hook de fila e mutacao.
- Linhas 20-27: fixture de task.
- Linhas 29-35: render com tema.
- Linhas 37-55: nao renderiza com filas vazias ou query pendente.
- Linhas 57-70: soma contagem das filas.
- Linhas 72-84: clique no botao abre `CatchUpFlow`.
- Linhas 86-95: `jest-axe` verifica acessibilidade.

**Funcoes, classes e importacoes especificas**

- `useCatchUpQueueQuery`: mockado para cenarios de dados.
- `CatchUpBanner`: componente real sob teste.
- `axe`: auditoria automatizada de acessibilidade no DOM renderizado.

**Comportamento de libs usadas**

- `jest-axe` espera um container DOM e retorna violacoes; `toHaveNoViolations` falha o teste se houver problemas detectados.

### `frontend/src/pages/daily/DailyPage.test.tsx`

**Funcao geral do arquivo**

Testa integracao da DailyPage com dados, banners e interacoes.

**Funcao geral da alteracao**

Inclui o quarto endpoint/banner no roteamento de mocks e valida aparicao independente do Catch-Up.

**Blocos principais**

- Comentario e `GET_DEFAULTS` passam de tres para quatro filas, incluindo `/api/bujo/catch-up/queue/`.
- Suite renomeada para incluir `CatchUpBanner`.
- Novo fixture `CATCH_UP_TASK`.
- Teste de banners independentes espera tambem a mensagem de Catch-Up.
- Novo teste abre Catch-Up sozinho e verifica fluxo diario.
- Teste de nenhum banner agora cobre quatro filas vazias.

**Funcoes, classes e importacoes especificas**

- `setGetResponse`: roteia respostas mockadas por URL.
- `renderDailyPage`: monta pagina com providers.
- `fireEvent.click`: abre o fluxo.

**Comportamento de libs usadas**

- TanStack Query dispara quatro GETs independentes; o mock por URL evita contaminar uma fila com resposta de outra.

## 9. E2E Playwright

### `frontend/e2e/seedCatchUpScenario.ts`

**Funcao geral do arquivo**

Helper E2E novo para semear cenarios antigos diretamente no backend via ORM.

**Funcao geral da alteracao**

Arquivo novo.

**Blocos principais**

- Linhas 1-3: imports Node para executar processo e resolver caminho.
- Linhas 12-23: interfaces do seed.
- Linhas 25-88: `seedCatchUpScenario` monta script Python e executa `uv run python manage.py shell -c`.
- Linhas 39-44 do script embutido: helper `months_before`.
- Linhas 46-80 do script embutido: cria `MonthlyLog`, `WeeklyLog`, `Log` antigos e arvores de tasks.
- Linhas 93-117: `queryMigrationCount` consulta a tarefa viva nao-migrated e retorna `migration_count`.

**Funcoes, classes e importacoes especificas**

- `execFileSync`: executa `uv` sem shell intermediario.
- `tenant_context`: garante seed no tenant do usuario do teste.
- `Task.objects.create`: cria raizes e filhos.
- `queryMigrationCount`: verifica AC de contagem por decisao.

**Comportamento de libs usadas**

- Node `child_process.execFileSync` espera comando, args e opcoes; retorna buffer stdout ou lanca erro se o processo falhar.
- `JSON.stringify` e usado para embutir dados no script Python com quoting seguro.

### `frontend/e2e/catch-up.spec.ts`

**Funcao geral do arquivo**

Spec E2E novo da Story 4.4 contra frontend e backend reais.

**Funcao geral da alteracao**

Arquivo novo com caminho feliz e teste adicional de pausa/retomada.

**Blocos principais**

- Linhas 1-2: importa fixture Playwright e helpers de seed/consulta.
- Linhas 17-111: teste do fluxo mes -> semana -> dia em um unico dialog.
- Linhas 24-28: captura erros de console/pageerror.
- Linhas 30-42: semeia uma tarefa mensal, uma semanal com subtarefas e uma diaria.
- Linhas 47-52: garante que so o banner Catch-Up aparece.
- Linhas 54-91: decide mensal, semanal e diaria verificando transicoes no mesmo dialog.
- Linhas 93-108: banner some, tarefa diaria aparece hoje e `migration_count` e 1.
- Linhas 121-183: teste de Esc pausa o Catch-Up inteiro, contagem cai de 3 para 2 e reabrir retoma direto no semanal.

**Funcoes, classes e importacoes especificas**

- `test.setTimeout(90_000)`: aumenta orcamento por depender de backend real.
- `page.waitForResponse`: sincroniza clique com POST `/migrate/` bem-sucedido.
- `page.getByRole` e `page.getByText`: locators semanticos.
- `queryMigrationCount`: verificacao ORM pos-fluxo.

**Comportamento de libs usadas**

- Playwright `expect(locator).toBeVisible()` espera automaticamente ate timeout.
- `Promise.all([waitForResponse, click])` evita race entre disparar a acao e registrar a espera.

## 10. Fluxo de consumo entre arquivos

1. `CatchUpQueueView` em `backend/bujo/views.py` produz tres querysets.
2. `CatchUpQueueSerializer` em `backend/bujo/serializers.py` transforma esses querysets em JSON.
3. `backend/bujo/urls.py` expõe o JSON em `/api/bujo/catch-up/queue/`.
4. `schema.yaml` descreve o endpoint e `frontend/src/api/types.gen.ts` gera `CatchUpQueue`.
5. `frontend/src/features/bujo/types.ts` reexporta o tipo.
6. `frontend/src/api/keys.ts` cria a query key.
7. `frontend/src/features/bujo/api.ts` busca o endpoint por `useCatchUpQueueQuery`.
8. `CatchUpBanner.tsx` consome o hook, soma as filas e abre `CatchUpFlow`.
9. `CatchUpFlow.tsx` passa cada fila para `MigrationFlow.tsx` com o `flowType` correto.
10. `MigrationFlow.tsx` chama `useMigrateTaskMutation`; no sucesso, `api.ts` invalida a fila Catch-Up, permitindo que o banner reflita tarefas ja decididas.
11. `DailyPage.tsx` torna o banner acessivel no fluxo normal do usuario.
12. Testes backend/frontend/E2E validam cada camada e a integracao.

## 11. Natureza dos arquivos

- Artefatos/docs: `_bmad-output/implementation-artifacts/4-4-catch-up-de-dias-pulados.md`, `_bmad-output/implementation-artifacts/sprint-status.yaml`, `_bmad-output/story-automator/orchestration-4-20260712-232806.md`, `_bmad-output/implementation-artifacts/tests/test-summary.md`.
- Source backend: `backend/bujo/serializers.py`, `backend/bujo/views.py`, `backend/bujo/urls.py`.
- Testes backend: `backend/bujo/tests/test_services.py`, `backend/bujo/tests/test_views.py`.
- Contrato gerado: `schema.yaml`, `frontend/src/api/types.gen.ts`.
- Source frontend data layer: `frontend/src/api/keys.ts`, `frontend/src/features/bujo/api.ts`, `frontend/src/features/bujo/types.ts`, `frontend/src/features/bujo/index.ts`.
- Source frontend UI: `frontend/src/features/bujo/components/MigrationFlow.tsx`, `frontend/src/features/bujo/components/CatchUpFlow.tsx`, `frontend/src/features/bujo/components/CatchUpBanner.tsx`, `frontend/src/pages/daily/DailyPage.tsx`.
- Testes frontend: `frontend/src/features/bujo/api.test.tsx`, `frontend/src/features/bujo/components/MigrationFlow.test.tsx`, `frontend/src/features/bujo/components/CatchUpFlow.test.tsx`, `frontend/src/features/bujo/components/CatchUpBanner.test.tsx`, `frontend/src/pages/daily/DailyPage.test.tsx`, `frontend/src/app/layout/RouteAnnouncer.test.tsx`, `frontend/src/app/router.test.tsx`.
- E2E/helper: `frontend/e2e/catch-up.spec.ts`, `frontend/e2e/seedCatchUpScenario.ts`.
