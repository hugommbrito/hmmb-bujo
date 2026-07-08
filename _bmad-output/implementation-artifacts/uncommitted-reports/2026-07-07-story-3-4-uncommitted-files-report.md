# Explicacao dos arquivos nao commitados - Story 3.4 ordenacao manual de tarefas

## Visao geral

O conjunto de mudancas implementa a Story 3.4: reordenacao manual de tarefas do Daily Log. O backend passa a aceitar `POST /api/bujo/tasks/{id}/reorder/`, valida que tarefa movida e alvo pertencem ao mesmo conjunto de irmaos, recalcula `order_index` por indice fracionario e devolve a tarefa serializada. O frontend adiciona uma mutacao otimista, um helper puro para reordenar a arvore local, drag-and-drop HTML5 no desktop, dialogo "Mover tarefa" como alternativa acessivel, long-press no mobile e cobertura de testes unitarios, integracao e E2E.

Este relatorio analisa as mudancas ja existentes no working tree e nao reanalisa o proprio arquivo de relatorio criado por esta skill.

## Ordem logica de funcionamento

1. Artefatos de story/status registram que a Story 3.4 foi concluida e revisada.
2. `InvalidReorderTarget` entra na taxonomia de dominio para representar alvo invalido de reorder.
3. `reorder_task` calcula novo `order_index` no banco, escopado por tenant e por irmaos.
4. Serializer, view e URL expõem o endpoint `tasks/{id}/reorder/`.
5. `schema.yaml` e `types.gen.ts` propagam o contrato para o frontend.
6. `reorderTaskTree` e `useReorderTaskMutation` fazem a reordenacao otimista no cache do Daily Log.
7. `TaskRow`, `MoveTaskDialog` e `DailyPage` conectam drag, botao e long-press a mutacao.
8. Testes backend, frontend e Playwright validam servico, API, UI, acessibilidade e persistencia real.

## 1. Artefatos de planejamento, automacao e QA

### `_bmad-output/implementation-artifacts/3-4-ordenacao-manual-de-tarefas.md`

**Funcao geral do arquivo**

Artefato de story da Story 3.4. Define requisitos, tasks, notas tecnicas, registro do agente, revisao de codigo e lista de arquivos.

**Funcao geral da alteracao**

Arquivo novo de implementacao/documentacao que descreve a entrega completa da ordenacao manual de tarefas.

**Blocos principais**

- Linhas 11-29: story e acceptance criteria para drag-and-drop desktop e "Mover para..." mobile.
- Linhas 33-85: task de servico `reorder_task`, incluindo regra de irmaos por `log` + `parent_task` e testes esperados.
- Linhas 87-117: task de serializer/view/URL e codigos HTTP esperados.
- Linhas 119-176: regeneracao de contrato, helper `reorderTaskTree` e mutacao `useReorderTaskMutation`.
- Linhas 178-208: implementacao de drag-and-drop, long-press e alternativa WCAG 2.5.7.
- Linhas 210-216: plano de testes e verificacao manual.
- Linhas 220-238: decisoes tecnicas de escopo, acessibilidade, HTML5 DnD, indice fracionario e contrato por `target_task_id` + `position`.
- Linhas 292-302: completion notes com suites executadas e E2E novo.
- Linhas 304-307: code review AI, com achado de documentacao corrigido.
- Linhas 309-333: file list da story.

**Funcoes, classes e importacoes especificas**

- Nao contem codigo executavel; os simbolos citados (`reorder_task`, `TaskReorderView`, `MoveTaskDialog`) sao a especificacao/documentacao que guia os arquivos fonte.

**Comportamento de libs usadas**

- Nao usa bibliotecas em runtime. Referencia Django, DRF, React, MUI, TanStack Query, Playwright e WCAG como contexto tecnico.

### `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Funcao geral do arquivo**

Fonte de status do sprint/epicos para o fluxo BMad.

**Funcao geral da alteracao**

Marca a Story 3.4 como `done` e atualiza o comentario de `last_updated` para refletir a conclusao via code review.

**Blocos principais**

- Linha 38: `last_updated` passa a mencionar `story 3-4 -> done (code-review)`.
- Linhas 62-68: no Epic 3, `3-4-ordenacao-manual-de-tarefas` muda de backlog para done.

**Funcoes, classes e importacoes especificas**

- Arquivo YAML de controle, sem funcoes.

**Comportamento de libs usadas**

- Consumido como dado por automacoes/documentacao BMad; nao ha biblioteca de runtime diretamente no app.

### `_bmad-output/story-automator/orchestration-3-20260703-191211.md`

**Funcao geral do arquivo**

Estado e log da automacao do Epic 3.

**Funcao geral da alteracao**

Avanca o documento para a Story 3.4, registra conclusao de dev-story, automate, code review e parada aguardando decisao de commit.

**Blocos principais**

- Linhas 6-10: estado `STOPPED`, `currentStory: 3.4`, timestamp atualizado.
- Linhas 55-60: tabela mostra 3.3 concluida e 3.4 com create/dev/automate/code-review done, commit pendente.
- Linhas 110-115: action log registra commit da 3.3, PASS da review 3.4, testes, E2E e STOPPED para commit da 3.4.

**Funcoes, classes e importacoes especificas**

- Documento Markdown/YAML, sem simbolos executaveis.

**Comportamento de libs usadas**

- Consumido pelo story automator como estado persistido.

### `_bmad-output/implementation-artifacts/tests/test-summary.md`

**Funcao geral do arquivo**

Historico consolidado de cobertura e execucao de testes por story.

**Funcao geral da alteracao**

Acrescenta o resumo de automacao de testes da Story 3.4, focado no gap E2E de reorder em browser real.

**Blocos principais**

- Linhas adicionadas apos o resumo anterior: secao "Story 3.4: Ordenacao manual de tarefas".
- Tabela "Gap Descoberto e Fechado": identifica ausencia de teste E2E para drag, long-press e persistencia.
- Secao `frontend/e2e/task-reorder.spec.ts`: lista 4 testes E2E novos.
- Secao "Cobertura por AC": mapeia AC1, AC2, WCAG 2.5.7 e escopo raiz-only.
- Secao "Execucao": registra 182 backend, 215 frontend e 9 E2E verdes em execucao limpa.

**Funcoes, classes e importacoes especificas**

- Documento de QA, sem codigo executavel.

**Comportamento de libs usadas**

- Cita pytest, DRF `APIClient`, Vitest, Testing Library e Playwright como ferramentas de validacao.

## 2. Primitivos de dominio e servico backend

### `backend/core/exceptions.py`

**Funcao geral do arquivo**

Define a hierarquia de excecoes de dominio e o exception handler global do DRF.

**Funcao geral da alteracao**

Adiciona `InvalidReorderTarget` como `DomainError`, permitindo que alvos invalidos de reorder sejam tratados pelo branch generico de dominio e retornem HTTP 409.

**Blocos principais**

- Linhas 50-56: nova classe `InvalidReorderTarget`, armazenando `task_id` e `target_task_id` e montando mensagem `Invalid reorder target: ...`.
- Linhas 99-103: comportamento ja existente do handler transforma qualquer `DomainError` em `409 Conflict`; a nova excecao entra nesse fluxo sem caso especial.

**Funcoes, classes e importacoes especificas**

- `InvalidReorderTarget`: representa reorder contra a propria tarefa ou contra alvo que nao e irmao.
- `DomainError`: base de negocio usada para manter servico desacoplado de DRF.
- `custom_exception_handler`: centraliza a traducao de excecao de dominio para resposta HTTP.

**Comportamento de libs usadas**

- `rest_framework.views.exception_handler`: recebe a excecao e contexto; retorna `Response` para excecoes DRF conhecidas ou `None` para excecoes plain Python.
- `rest_framework.response.Response`: encapsula corpo e status HTTP.
- `rest_framework.status`: fornece constantes como `HTTP_409_CONFLICT`.

### `backend/bujo/services/tasks.py`

**Funcao geral do arquivo**

Camada de servico para criar, editar e agora reordenar `Task`.

**Funcao geral da alteracao**

Importa `InvalidReorderTarget` e adiciona `reorder_task`, que move uma tarefa antes/depois de outra usando bissecao de `order_index`, dentro de uma transacao.

**Blocos principais**

- Linhas 5-8: importa `transaction`, `Task` e `InvalidReorderTarget`.
- Linhas 42-50: `reorder_task` abre transacao atomica, rejeita `task_id == target_task_id` e busca tarefa/alvo por manager tenant-scoped.
- Linhas 52-60: monta lista de irmaos do mesmo `log` e mesmo `parent_task`, exclui a tarefa movida e rejeita alvo que nao esteja nessa lista.
- Linhas 62-69: calcula os vizinhos que ficarao antes/depois conforme `position`.
- Linhas 70-75: calcula novo indice: menor que o primeiro, maior que o ultimo ou ponto medio entre vizinhos.
- Linhas 77-79: salva apenas `order_index` e `updated_at`, retornando a `Task`.

**Funcoes, classes e importacoes especificas**

- `reorder_task(*, user, task_id, target_task_id, position)`: entrada principal para a view. O parametro `user` preserva a assinatura padrao, enquanto o isolamento real vem do tenant context/manager.
- `Task.objects.get`: usa o manager auto-escopado por tenant; se a tarefa ou alvo nao existe para o usuario atual, levanta `Task.DoesNotExist`.
- `InvalidReorderTarget`: diferencia conflito de regra de negocio (409) de recurso nao encontrado (404).

**Comportamento de libs usadas**

- `django.db.transaction.atomic`: executa o bloco dentro de transacao; se uma excecao ocorrer, o update de `order_index` e revertido.
- `QuerySet.filter(...).exclude(...).order_by(...)`: espera criterios ORM e retorna queryset ordenado; aqui vira `list` para permitir `in`, `index` e acesso por posicao.

## 3. Serializer, view e rota backend

### `backend/bujo/serializers.py`

**Funcao geral do arquivo**

Serializa leitura/escrita do Daily Log e valida payloads de entrada da API BuJo.

**Funcao geral da alteracao**

Adiciona `TaskReorderSerializer` para validar o corpo do endpoint de reordenacao.

**Blocos principais**

- Linhas 64-66: `target_task_id` e validado como UUID e `position` como escolha restrita a `before` ou `after`.

**Funcoes, classes e importacoes especificas**

- `TaskReorderSerializer`: serializer de entrada, nao serializa modelo diretamente.
- `serializers.UUIDField`: aceita UUID em string/campo nativo e entrega UUID validado em `validated_data`.
- `serializers.ChoiceField`: rejeita valores fora do enum com erro 400 quando `is_valid(raise_exception=True)` e chamado.

**Comportamento de libs usadas**

- DRF `Serializer`: espera `data=request.data`; `is_valid` popula `validated_data` ou levanta `ValidationError`.

### `backend/bujo/views.py`

**Funcao geral do arquivo**

Views finas da API Daily Log: validam entrada, chamam servicos e serializam saida.

**Funcao geral da alteracao**

Importa serializer/servico de reorder e adiciona `TaskReorderView`.

**Blocos principais**

- Linhas 12-21: novos imports `TaskReorderSerializer` e `reorder_task`.
- Linhas 88-102: `TaskReorderView.post` valida body, chama `reorder_task`, traduz `Task.DoesNotExist` para `NotFound` e responde `TaskSerializer`.

**Funcoes, classes e importacoes especificas**

- `TaskReorderView`: endpoint POST para mover uma tarefa relativamente a outra.
- `extend_schema`: informa ao drf-spectacular o request/response do endpoint para gerar OpenAPI.
- `NotFound`: excecao DRF que vira HTTP 404 quando tarefa ou target nao existem no tenant atual.
- `TaskSerializer`: retorna a tarefa movida com campos publicos e subtarefas.

**Comportamento de libs usadas**

- `APIView`: classe base DRF para declarar metodos HTTP.
- `Response`: encapsula payload serializado.
- `extend_schema`: nao altera runtime da view; alimenta o schema OpenAPI.

### `backend/bujo/urls.py`

**Funcao geral do arquivo**

Mapa de rotas da feature BuJo.

**Funcao geral da alteracao**

Registra a rota de reorder.

**Blocos principais**

- Linhas 3-9: importa `TaskReorderView`.
- Linha 18: adiciona `tasks/<uuid:pk>/reorder/` com nome `bujo-task-reorder`.

**Funcoes, classes e importacoes especificas**

- `path("tasks/<uuid:pk>/reorder/", ...)`: converte o segmento em UUID e passa para a view como `pk`.

**Comportamento de libs usadas**

- `django.urls.path`: espera pattern, view callable e nome; retorna objeto de URL usado pelo resolver Django.

## 4. Contrato gerado

### `schema.yaml`

**Funcao geral do arquivo**

Contrato OpenAPI gerado para backend/frontend e validacao de drift.

**Funcao geral da alteracao**

Adiciona o endpoint `/api/bujo/tasks/{id}/reorder/`, o schema `TaskReorder` e o enum `PositionEnum`.

**Blocos principais**

- Linhas adicionadas em `paths`: `POST /api/bujo/tasks/{id}/reorder/`, parametro path UUID `id`, body `TaskReorder`, resposta 200 `Task`.
- Linhas adicionadas em `components.schemas`: `PositionEnum` com `before`/`after`.
- Linhas adicionadas em `components.schemas`: `TaskReorder` com `targetTaskId` UUID e `position`, ambos obrigatorios.

**Funcoes, classes e importacoes especificas**

- Arquivo gerado, sem funcoes. O nome `targetTaskId` aparece em camelCase por conversao do contrato exposto ao frontend.

**Comportamento de libs usadas**

- Gerado por `drf-spectacular`; a lib le decorators, serializers e rotas DRF para produzir OpenAPI.

### `frontend/src/api/types.gen.ts`

**Funcao geral do arquivo**

Tipos TypeScript gerados a partir do OpenAPI.

**Funcao geral da alteracao**

Propaga para o frontend os tipos do novo endpoint, do enum de posicao e do request body.

**Blocos principais**

- Linhas adicionadas em `paths`: chave `"/api/bujo/tasks/{id}/reorder/"` com operacao POST.
- Linhas adicionadas em `components.schemas`: `PositionEnum: "before" | "after"`.
- Linhas adicionadas em `components.schemas`: `TaskReorder` com `targetTaskId` e `position`.
- Linhas adicionadas em `operations`: `bujo_tasks_reorder_create`, com path `id`, body JSON `TaskReorder` e resposta 200 `Task`.

**Funcoes, classes e importacoes especificas**

- Arquivo gerado; nao deve ser editado manualmente.

**Comportamento de libs usadas**

- Gerado por ferramenta de types OpenAPI do frontend. Espera `schema.yaml` e entrega interfaces TypeScript para uso/checagem de contrato.

## 5. Camada de dados frontend

### `frontend/src/features/bujo/taskTree.ts`

**Funcao geral do arquivo**

Helpers puros para percorrer e transformar a arvore de tarefas/subtarefas.

**Funcao geral da alteracao**

Adiciona `reorderTaskTree`, usado para refletir reorder de forma otimista no cache local.

**Blocos principais**

- Linhas 20-25: assinatura recebe lista, tarefa movida, alvo e posicao.
- Linhas 26-32: se ambos os ids existem no mesmo array, remove a tarefa movida e reinsere antes/depois do alvo.
- Linhas 34-37: se nao estao no nivel atual, recorre em `subtasks`.

**Funcoes, classes e importacoes especificas**

- `reorderTaskTree`: retorna novo array, preservando imutabilidade para React Query/React detectarem mudanca.
- `mapTaskTree` e `findTaskById`: helpers preexistentes usados por outras partes da feature.

**Comportamento de libs usadas**

- Nao usa libs externas; opera sobre arrays JavaScript. `slice`, `filter`, `findIndex` e spread retornam novas estruturas em vez de mutar o array original.

### `frontend/src/features/bujo/api.ts`

**Funcao geral do arquivo**

Hooks de API da feature BuJo usando cliente HTTP, query keys e mutacoes otimistas.

**Funcao geral da alteracao**

Importa `reorderTaskTree`, adiciona o request `reorderTask` e exporta `useReorderTaskMutation`.

**Blocos principais**

- Linha 5: passa a importar `reorderTaskTree`.
- Linhas 129-133: define `ReorderTaskVariables`.
- Linhas 135-141: faz `POST /api/bujo/tasks/${taskId}/reorder/` com `{ targetTaskId, position }`.
- Linhas 143-152: `useReorderTaskMutation` usa `useOptimisticMutation` na query `keys.bujo.todayLog()` e atualiza `current.tasks` com `reorderTaskTree`.

**Funcoes, classes e importacoes especificas**

- `client.post<Task>`: chama o backend e tipa a resposta esperada como `Task`.
- `useReorderTaskMutation`: hook consumido pela pagina, expondo `mutate`.
- `keys.bujo.todayLog()`: garante que a mesma cache do Daily Log seja atualizada/invalida.

**Comportamento de libs usadas**

- `@tanstack/react-query`: `useQuery` e a infra do wrapper de mutacao controlam pending/success/error e cache.
- `useOptimisticMutation`: wrapper local que espera `mutationFn`, `queryKey` e `updater`; aplica update otimista, reverte em erro e invalida/refaz sincronizacao conforme implementacao compartilhada do projeto.

### `frontend/src/features/bujo/index.ts`

**Funcao geral do arquivo**

Barrel export da feature BuJo.

**Funcao geral da alteracao**

Exporta `useReorderTaskMutation` para consumidores da feature.

**Blocos principais**

- Linhas 1-8: lista de hooks exportados agora inclui `useReorderTaskMutation`.

**Funcoes, classes e importacoes especificas**

- `useReorderTaskMutation`: fica disponivel para `DailyPage` via `../../features/bujo`.

**Comportamento de libs usadas**

- Nao usa libs; e uma reexportacao ES Modules.

## 6. Componentes e pagina frontend

### `frontend/src/features/bujo/components/MoveTaskDialog.tsx`

**Funcao geral do arquivo**

Componente novo de dialogo para mover uma tarefa acima/abaixo de outra tarefa irma.

**Funcao geral da alteracao**

Arquivo novo que implementa o fluxo "Mover tarefa" usado pelo botao desktop e pelo long-press mobile.

**Blocos principais**

- Linhas 1-2: importa componentes MUI e tipo `Task`.
- Linhas 4-10: define props `task`, `siblings`, `open`, `onMove`, `onClose`.
- Linhas 12-13: remove a propria tarefa da lista de alvos.
- Linhas 15-21: renderiza `Dialog` e mensagem de lista vazia.
- Linhas 23-44: para cada irmao, renderiza botoes "Acima de ..." e "Abaixo de ...", chamando `onMove` e depois `onClose`.

**Funcoes, classes e importacoes especificas**

- `MoveTaskDialog`: componente controlado por `open`; nao possui estado proprio.
- `onMove(targetTaskId, position)`: contrato que `TaskRow` converte para `onReorder(task.id, targetId, position)`.

**Comportamento de libs usadas**

- MUI `Dialog`: espera `open` booleano e `onClose`; gerencia modal, foco e semantica de dialog.
- MUI `List`/`ListItemButton`/`ListItemText`: renderizam lista de acoes clicaveis com semantica acessivel.

### `frontend/src/features/bujo/components/TaskRow.tsx`

**Funcao geral do arquivo**

Renderiza uma linha de tarefa, ciclo de status, chips, abertura de detalhes e subtarefas recursivas.

**Funcao geral da alteracao**

Adiciona suporte opcional a reorder para linhas raiz: drag-and-drop no desktop, indicador visual de destino, botao "Mover tarefa", long-press mobile e renderizacao de `MoveTaskDialog`.

**Blocos principais**

- Linhas 1-15: novos imports (`useRef`, `DragEvent`, icones de drag/menu, `MoveTaskDialog`) e constante `LONG_PRESS_MS = 500`.
- Linhas 55-61: props opcionais `siblings` e `onReorder`.
- Linhas 63-68: estados de anuncio, posicao de drag-over, dialogo e timer de long-press.
- Linhas 77-83: `isReorderable` deriva de `onReorder`; comportamento antigo de status permanece.
- Linhas 85-112: handlers HTML5 DnD gravam id em `dataTransfer`, calculam `before/after`, chamam `onReorder` no drop e limpam indicador.
- Linhas 114-124: timer de long-press abre o dialogo apos 500ms e e cancelado em fim/movimento/cancelamento de toque.
- Linhas 128-152: aplica `draggable` e handlers apenas quando reorder esta habilitado e nao e mobile; aplica handlers touch apenas em mobile.
- Linhas 154-167: indicador horizontal de 2px no topo/base da linha.
- Linhas 224-238: area desktop com botao `Mover tarefa` e icone de drag.
- Linhas 247-258: instancia `MoveTaskDialog` e converte `onMove` para `onReorder`.
- Linhas 259-268: subtarefas continuam recursivas sem `siblings`/`onReorder`, logo nao expõem reorder nesta story.

**Funcoes, classes e importacoes especificas**

- `handleDragStart`: escreve `task.id` em `event.dataTransfer`.
- `handleDragOver`: chama `preventDefault`, requisito do HTML5 DnD para permitir drop, e define `dragOverPosition`.
- `handleDrop`: le `draggedId`; ignora drop sobre si mesmo; chama `onReorder(draggedId, task.id, position)`.
- `clearLongPressTimer`/`handleTouchStart`: controlam o gesto de long-press mobile.
- `useMediaQuery('(max-width: 767px)')`: separa comportamento desktop/mobile.

**Comportamento de libs usadas**

- React `useState`: guarda estado local e dispara rerender quando muda.
- React `useRef`: guarda id do timer sem causar rerender.
- MUI `IconButton`, `Box`, `Typography`, `Chip`: componentes visuais/acessiveis usados no layout.
- MUI icons `DragIndicatorIcon` e `MoreVertIcon`: icones de drag handle e menu/acao alternativa.
- HTML5 Drag and Drop `DataTransfer`: espera dados por MIME (`text/plain`) e permite recuperar o id no drop.

### `frontend/src/pages/daily/DailyPage.tsx`

**Funcao geral do arquivo**

Pagina do Daily Log: busca dados, renderiza header/lista, cria tarefas, transiciona status e abre painel de detalhe.

**Funcao geral da alteracao**

Conecta `useReorderTaskMutation` a `TaskRow` para tarefas raiz.

**Blocos principais**

- Linhas 3-7: importa `useReorderTaskMutation`.
- Linhas 17-25: instancia `reorder` e define `handleReorder`, que chama `reorder.mutate`.
- Linhas 77-85: passa `siblings={tasks}` e `onReorder={handleReorder}` para cada tarefa raiz.

**Funcoes, classes e importacoes especificas**

- `handleReorder`: adaptador entre UI (`TaskRow`) e mutacao de API.
- `TaskRow`: recebe irmaos da raiz; chamadas recursivas de subtarefa dentro de `TaskRow` nao recebem esses props.

**Comportamento de libs usadas**

- React hooks (`useState`, `useEffect`, `useRef`) mantem estado da pagina e atalhos existentes.
- MUI `Box`/`Typography`: layout da pagina.

## 7. Testes backend

### `backend/bujo/tests/test_services.py`

**Funcao geral do arquivo**

Testa regras de servico da feature BuJo sem passar pela API HTTP.

**Funcao geral da alteracao**

Importa `reorder_task` e `InvalidReorderTarget`, adicionando 9 cenarios de servico.

**Blocos principais**

- Linhas adicionadas nos imports: inclui `reorder_task` e `InvalidReorderTarget`.
- Novos testes de ponto medio: `position="after"` entre alvo e vizinho seguinte; `position="before"` entre vizinho anterior e alvo.
- Novos testes de borda: mover para inicio produz indice menor que o primeiro; mover para fim produz indice maior que o ultimo.
- Novos testes de erro: alvo igual a propria tarefa, outro log e outro pai levantam `InvalidReorderTarget`.
- Novo teste de subtarefa: reorder de subtarefas considera apenas irmas sob o mesmo pai.
- Novo teste multi-tenant: outro tenant recebe `Task.DoesNotExist`.

**Funcoes, classes e importacoes especificas**

- `reorder_task`: unidade sob teste.
- `TaskFactory`/`LogFactory`: fabricam dados com `order_index`, `log` e `parent_task`.
- `tenant_context`: ativa o escopo do usuario para o manager tenant-scoped.

**Comportamento de libs usadas**

- `pytest.mark.django_db`: permite acesso ao banco no teste.
- `pytest.raises`: espera excecao especifica e falha se ela nao ocorrer.

### `backend/bujo/tests/test_views.py`

**Funcao geral do arquivo**

Testa endpoints HTTP da API BuJo usando cliente autenticado.

**Funcao geral da alteracao**

Adiciona 6 testes para `POST /api/bujo/tasks/{id}/reorder/`.

**Blocos principais**

- Teste valido: payload `{targetTaskId, position}` retorna 200 e persiste novo `order_index`.
- Teste outro tenant: `targetTaskId` inacessivel retorna 404.
- Teste alvo igual a propria tarefa: retorna 409.
- Teste alvo nao irmao: retorna 409.
- Testes de validacao: `position` fora do enum e `targetTaskId` ausente retornam 400.

**Funcoes, classes e importacoes especificas**

- `auth_client.post`: exercita a view completa, serializer e exception handler.
- `get_or_create_daily_log`/`today_for`: criam contexto real de Daily Log.
- `tenant_context`: usado para criar fixtures no tenant correto.

**Comportamento de libs usadas**

- DRF test client com `format="json"` serializa o body como JSON.
- `refresh_from_db`: recarrega a instancia do banco para confirmar persistencia.

## 8. Testes frontend unitarios e de integracao

### `frontend/src/features/bujo/taskTree.test.ts`

**Funcao geral do arquivo**

Testa helpers puros de arvore de tarefas.

**Funcao geral da alteracao**

Inclui `reorderTaskTree` nos imports e adiciona testes de raiz, subtarefas e caso sem alteracao.

**Blocos principais**

- Novos testes de raiz: move item antes e depois de outro.
- Novo teste de subtasks: reordena dentro do mesmo array de subtarefas.
- Novo teste negativo: quando `taskId` e `targetTaskId` nao coexistem em nenhum nivel, a ordem permanece.

**Funcoes, classes e importacoes especificas**

- `makeTask`: factory local para objetos `Task`.
- `reorderTaskTree`: helper sob teste.

**Comportamento de libs usadas**

- Vitest `describe`/`it`/`expect`: estrutura e assertivas da suite.

### `frontend/src/features/bujo/api.test.tsx`

**Funcao geral do arquivo**

Testa hooks de API e mutacoes otimistas da feature BuJo.

**Funcao geral da alteracao**

Adiciona suite `useReorderTaskMutation`.

**Blocos principais**

- Importa `useReorderTaskMutation`.
- Novo teste de sucesso: coloca log no cache, segura a promessa do `post`, chama `mutate`, verifica ordem otimista e payload HTTP.
- Novo teste de erro: simula rejeicao do `post` e verifica rollback para snapshot anterior.

**Funcoes, classes e importacoes especificas**

- `mockPost`: substitui cliente HTTP.
- `makeWrapper`: fornece `QueryClient`/provider para `renderHook`.
- `keys.bujo.todayLog()`: chave cujo cache e verificado.

**Comportamento de libs usadas**

- Testing Library `renderHook` executa hooks em ambiente de teste.
- `waitFor` reexecuta assertiva ate passar ou dar timeout, adequado para mudancas assicronas.
- Vitest `vi.fn`/`mockReturnValueOnce`/`mockRejectedValueOnce` controlam respostas do cliente.

### `frontend/src/features/bujo/components/MoveTaskDialog.test.tsx`

**Funcao geral do arquivo**

Teste unitario do novo dialogo de mover tarefa.

**Funcao geral da alteracao**

Arquivo novo com 5 testes.

**Blocos principais**

- Linhas 9-19: factory `makeTask`.
- Linhas 21-42: helper `renderDialog` com theme MUI.
- Linhas 45-52: garante que a propria tarefa e excluida das opcoes.
- Linhas 54-68: cliques em "Acima" e "Abaixo" chamam `onMove` com posicao correta.
- Linhas 70-75: estado de lista vazia.
- Linhas 77-81: teste de acessibilidade com `jest-axe`.

**Funcoes, classes e importacoes especificas**

- `MoveTaskDialog`: componente sob teste.
- `axe`: verifica violacoes automaticas de acessibilidade.
- `createBujoTheme`: aplica tema real do app no teste.

**Comportamento de libs usadas**

- Testing Library `render`, `screen`, `fireEvent`: renderiza componente, consulta DOM por texto e dispara clique.
- MUI `ThemeProvider`: fornece tema para componentes MUI.
- `jest-axe`: recebe container DOM e retorna resultado de regras axe.

### `frontend/src/features/bujo/components/TaskRow.test.tsx`

**Funcao geral do arquivo**

Testa comportamento da linha de tarefa.

**Funcao geral da alteracao**

Adiciona suite de reorder cobrindo drag/drop, indicador, long-press, botao desktop e ausencia de reorder sem props.

**Blocos principais**

- Novos helpers: `renderReorderableTaskRow`, `makeDataTransfer`, `makeDragEvent`, `mockRowRect`.
- Testes drag/drop: metade superior chama `before`; metade inferior chama `after`; drop sobre si mesmo nao chama `onReorder`.
- Teste visual: indicador aparece em `dragover` e some em `dragLeave`/`dragEnd`.
- Testes mobile: fake timers abrem dialogo apos 500ms e `touchMove` cancela.
- Testes desktop: botao "Mover tarefa" abre dialogo; sem `onReorder` nao ha botao e `draggable` e false.

**Funcoes, classes e importacoes especificas**

- `TaskRow`: componente sob teste.
- `act`: envolve dispatches que causam update de estado React.
- `Element.prototype.getBoundingClientRect`: mockado para controlar metade superior/inferior no calculo de drop.

**Comportamento de libs usadas**

- `fireEvent` e eventos manuais simulam DnD em jsdom.
- Vitest fake timers (`vi.useFakeTimers`, `vi.advanceTimersByTime`) controlam o long-press sem espera real.

### `frontend/src/pages/daily/DailyPage.test.tsx`

**Funcao geral do arquivo**

Testa integracao da pagina Daily com hooks e componentes.

**Funcao geral da alteracao**

Mocka `useReorderTaskMutation` e adiciona testes de wiring de reorder.

**Blocos principais**

- Imports passam a incluir `act`.
- Mock da feature inclui `useReorderTaskMutation`.
- Novo teste de drag/drop: dispatch em segunda linha chama `mockReorderMutate` com `{ taskId, targetTaskId, position }`.
- Novo teste raiz-only: com uma subtarefa, apenas as 2 tarefas raiz expõem botao "Mover tarefa".

**Funcoes, classes e importacoes especificas**

- `mockReorderMutate`: espia chamada da mutacao.
- `mockUseTodayLogQuery`: controla dados da pagina.
- `renderDailyPage`: helper preexistente para renderizar com tema/providers.

**Comportamento de libs usadas**

- Testing Library consulta linhas por `data-testid` e botoes por papel/nome acessivel.
- `act` sincroniza updates causados por eventos manuais.

### `frontend/src/app/router.test.tsx`

**Funcao geral do arquivo**

Testa roteamento da aplicacao.

**Funcao geral da alteracao**

Atualiza mock de `../../features/bujo` para incluir o novo hook usado por `DailyPage`.

**Blocos principais**

- Linha adicionada no mock: `useReorderTaskMutation: () => ({ mutate: vi.fn() })`.

**Funcoes, classes e importacoes especificas**

- `useReorderTaskMutation`: mock necessario para renderizacao de rotas que montam `DailyPage`.

**Comportamento de libs usadas**

- Vitest `vi.mock`: substitui modulo importado durante o teste.

### `frontend/src/app/layout/RouteAnnouncer.test.tsx`

**Funcao geral do arquivo**

Testa anuncio de rota/layout.

**Funcao geral da alteracao**

Atualiza mock de `../../features/bujo` para acompanhar a nova dependencia de `DailyPage`.

**Blocos principais**

- Linha adicionada no mock: `useReorderTaskMutation: () => ({ mutate: vi.fn() })`.

**Funcoes, classes e importacoes especificas**

- `useReorderTaskMutation`: mock sem comportamento especial; evita quebra por import ausente.

**Comportamento de libs usadas**

- Vitest `vi.mock` injeta implementacao fake do hook.

## 9. Teste E2E

### `frontend/e2e/task-reorder.spec.ts`

**Funcao geral do arquivo**

Spec Playwright novo para validar reorder em browser real contra backend real, sem mocks de rede.

**Funcao geral da alteracao**

Arquivo novo com 4 testes E2E para AC1, AC2, alternativa WCAG 2.5.7 e escopo raiz-only.

**Blocos principais**

- Linhas 1-9: imports e comentario de escopo.
- Linhas 11-24: helper `createTasks` cria tarefas pela UI e aguarda `networkidle` para evitar ids otimistas temporarios.
- Linhas 26-32: helper `expectOrder` verifica ordem visual das linhas.
- Linhas 34-56: drag desktop de C antes de A e persistencia apos reload.
- Linhas 58-76: botao "Mover tarefa" desktop move A abaixo de C e persiste.
- Linhas 78-100: viewport mobile, long-press em B, move abaixo de C e persiste.
- Linhas 102-116: cria subtarefa e confirma ausencia de `draggable` e botao "Mover tarefa".

**Funcoes, classes e importacoes especificas**

- `test`, `expect`, `syncAfter`: fixtures locais de Playwright; `syncAfter` sincroniza acao com requests do app.
- `createTasks`: usa label "Nova tarefa" e tecla Enter para criar dados reais.
- `expectOrder`: usa `data-testid="task-row"` para comparar sequencia.

**Comportamento de libs usadas**

- Playwright `locator.dragTo`: executa gesto de drag real no navegador com posicoes relativas.
- Playwright `page.reload`: recarrega a aplicacao para confirmar persistencia do servidor.
- Playwright locators (`getByRole`, `getByLabel`, `getByTestId`): consultam a UI por semantica e atributos estaveis.
- `page.waitForLoadState('networkidle')`: espera a rede assentar, util quando React Query ainda pode refazer GETs apos criacoes rapidas.

