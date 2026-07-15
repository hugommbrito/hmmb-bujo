# Explicacao dos arquivos nao commitados - Story 11.3

## Visao geral

O conjunto de mudancas implementa a Story 11.3: dedup de templates recorrentes ja colocados no periodo, exibicao de informacoes da recorrencia no modal de placement, calendario informativo de densidade de tarefas por dia do mes, endpoint backend para essa densidade e contrato/tipos gerados. Tambem atualiza artefatos BMad de status, resumo de testes e orquestracao.

## Ordem logica de funcionamento

1. Artefatos de story/status registram que a 11.3 saiu de backlog/review para done.
2. O backend passa a serializar `Task.source_template`, permitindo ao frontend deduzir quais templates ja foram colocados.
3. O backend adiciona `GET /api/bujo/task-density/`, que agrega tarefas daily, weekly e monthly por dia do mes.
4. `schema.yaml` e `types.gen.ts` refletem o campo novo e o endpoint novo.
5. A camada de dados frontend adiciona query key, hook `useTaskDensityQuery`, tipos reexportados e invalidacoes de cache.
6. `MonthDensityCalendar` renderiza a densidade como calendario reutilizavel e informativo nesta story.
7. `RecurringPlacementDialog` mostra titulo/descricao/recorrencia e injeta o calendario.
8. `RecurringPlacementSection` esconde templates ja colocados por padrao e oferece o switch "Mostrar ja colocados".
9. `MonthlyPage` e `WeeklyPage` calculam `placedTemplateIds`, passam o template inteiro ao dialog e informam o mes de densidade.
10. Testes backend, unitarios frontend, testes de pagina e E2E cobrem serializacao, agregacao, dedup, calendario, acessibilidade e fluxo real.

## 1. Artefatos de planejamento, status e validacao

### `_bmad-output/implementation-artifacts/11-3-placement-de-recorrentes-dedup-e-calendario-de-densidade.md`

**Funcao geral do arquivo**

Arquivo de story/implementacao da Story 11.3. E um artefato de documentacao, nao codigo executavel.

**Funcao geral da alteracao**

Arquivo novo que registra ACs, tarefas, notas de desenvolvimento, evidencias de teste, file list, changelog e senior developer review da implementacao.

**Blocos principais**

- Linhas 1-8: metadados e status da story, incluindo `baseline_commit` e `Status: done`.
- Linhas 17-37: AC1, AC2 e AC3, definindo dedup, modal com recorrencia/densidade e calendario reutilizavel.
- Linhas 43-125: tarefas backend, contrato e testes de backend.
- Linhas 66-118: tarefas frontend, incluindo hook de densidade, calendario, dialog, dedup e paginas.
- Linhas 216-242: Dev Agent Record, debug log e completion notes.
- Linhas 244-274: File List dos arquivos alterados/novos.
- Linhas 283-307: Senior Developer Review com verificacao independente e outcome `Approve`.

**Funcoes, classes e importacoes especificas**

- Nao define simbolos runtime. O arquivo funciona como contrato humano/operacional para manutencao futura.

**Comportamento de libs usadas**

- Nao usa bibliotecas diretamente.

### `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Funcao geral do arquivo**

Arquivo de tracking do sprint/epico usado pelo fluxo BMad.

**Funcao geral da alteracao**

Atualiza o status da Story 11.3 de `backlog` para `done` e ajusta `last_updated` para apontar a revisao automatizada.

**Blocos principais**

- Linhas 35-38: `last_updated` passa a documentar "story 11.3 -> done".
- Linhas 81-84: `11-3-placement-de-recorrentes-dedup-e-calendario-de-densidade` muda para `done`.

**Funcoes, classes e importacoes especificas**

- Nao ha simbolos de codigo. E configuracao/estado.

**Comportamento de libs usadas**

- YAML e lido por tooling BMad; chaves escalares representam estado do workflow.

### `_bmad-output/story-automator/orchestration-11-20260714-185946.md`

**Funcao geral do arquivo**

Registro de orquestracao do story automator para o Epico 11.

**Funcao geral da alteracao**

Avanca `currentStory` para 11.3, marca 11.2 como done/commitada, marca 11.3 como em progresso no quadro e adiciona eventos de execucao, automacao e review da 11.3.

**Blocos principais**

- Linhas 4-10: `currentStory` muda de 11.2 para 11.3 e `lastUpdated` e atualizado.
- Linhas 55-63: tabela de progresso passa 11.2 para done e 11.3 para in-progress.
- Linhas 99-106: log adiciona inicio, gates, dev-story, automacao E2E e code review da 11.3.

**Funcoes, classes e importacoes especificas**

- Nao ha simbolos runtime.

**Comportamento de libs usadas**

- Markdown estruturado usado como log operacional.

### `_bmad-output/implementation-artifacts/tests/test-summary.md`

**Funcao geral do arquivo**

Resumo acumulado de automacao de testes do projeto.

**Funcao geral da alteracao**

Adiciona a secao da Story 11.3, descrevendo a lacuna E2E encontrada e o novo teste real-stack para densidade cross-source.

**Blocos principais**

- Linhas 1258-1273: escopo e diferenca entre cobertura existente e lacuna real de browser/backend.
- Linhas 1275-1293: lacunas fechadas pelo novo E2E.
- Linhas 1295-1307: novo teste em `recurring-templates.spec.ts`.
- Linhas 1309-1316: mapeamento AC -> cobertura.
- Linhas 1318-1330: comandos e resultado da execucao.
- Linhas 1332-1349: checklist e proximos passos.

**Funcoes, classes e importacoes especificas**

- Nao define simbolos runtime.

**Comportamento de libs usadas**

- Cita pytest-django, Vitest, Testing Library, jest-axe e Playwright como ferramentas de validacao.

## 2. Backend: serializers e contrato de dados

### `backend/bujo/serializers.py`

**Funcao geral do arquivo**

Define serializers DRF para tarefas, logs, comandos e contratos de resposta do app Bujo.

**Funcao geral da alteracao**

Adiciona `source_template` ao `TaskSerializer` para dedup client-side e cria serializers do endpoint de densidade.

**Blocos principais**

- Linhas 25-34: `TaskSerializer.Meta.fields` passa a incluir `source_template`. O campo vem da FK ja existente em `Task` e sai como PK/null.
- Linhas 196-207: `TaskDensityQuerySerializer` valida `month_first` como data e exige dia 1.
- Linhas 210-216: `TaskDensityEntrySerializer` e `TaskDensityResponseSerializer` tipam o payload de resposta `{ density: [...] }`.

**Funcoes, classes e importacoes especificas**

- `TaskSerializer`: `ModelSerializer` que serializa `Task`; agora tambem expoe a linhagem de template.
- `validate_month_first`: recebe `date`, rejeita datas cujo `day != 1`, retorna o proprio valor validado.
- `TaskDensityEntrySerializer`: descreve um item `{date, count}`.
- `TaskDensityResponseSerializer`: descreve a lista `density`.

**Comportamento de libs usadas**

- `serializers.ModelSerializer`: infere campos do model e serializa FKs como primary key por padrao.
- `serializers.DateField`: espera string de data ISO ou `date`, entrega `datetime.date` validado em `validated_data`.
- `serializers.ValidationError`: produz erro 400 via `is_valid(raise_exception=True)` nas views.

## 3. Backend: endpoint de densidade

### `backend/bujo/views.py`

**Funcao geral do arquivo**

Contem views DRF do dominio Bujo.

**Funcao geral da alteracao**

Adiciona `TaskDensityView`, leitura agregada por dia do mes, e importa `defaultdict` e os serializers de densidade.

**Blocos principais**

- Linhas 3-8 e 27-34: novos imports `defaultdict`, `TaskDensityQuerySerializer` e `TaskDensityResponseSerializer`.
- Linhas 313-336: docstring e schema do endpoint com `extend_schema`.
- Linhas 337-341: valida query params e extrai ano/mes.
- Linhas 343-354: query daily agrupa tarefas raiz por `log__log_date`.
- Linhas 356-371: queries weekly/monthly agrupam tarefas raiz por `scheduled_date`.
- Linhas 373-374: monta lista ordenada e serializa resposta.

**Funcoes, classes e importacoes especificas**

- `TaskDensityView.get`: recebe `request`, valida `month_first`, calcula `counts` e retorna `Response`.
- `defaultdict(int)`: cria contador por data, iniciando em zero.
- `Task.objects`: manager tenant-scoped; restringe por usuario atual via contexto, evitando vazamento multi-tenant.
- `Count("id")`: agregacao SQL que retorna quantidade de tarefas por grupo.

**Comportamento de libs usadas**

- `APIView`: classe base DRF para declarar handlers HTTP.
- `extend_schema`: do drf-spectacular; descreve parametros e resposta para gerar OpenAPI.
- `.filter(...).values(...).annotate(...)`: QuerySet Django; filtra no banco, agrupa pelos campos de `.values` e adiciona `count`.
- `Response`: serializa dados Python para resposta HTTP usando renderer DRF.

### `backend/bujo/urls.py`

**Funcao geral do arquivo**

Registra rotas URL do app Bujo.

**Funcao geral da alteracao**

Importa `TaskDensityView` e adiciona a rota `task-density/`.

**Blocos principais**

- Linhas 12-20: novo import de view.
- Linhas 41-43: `path("task-density/", TaskDensityView.as_view(), name="bujo-task-density")`.

**Funcoes, classes e importacoes especificas**

- `TaskDensityView.as_view()`: converte a classe DRF em callable de URL.

**Comportamento de libs usadas**

- `django.urls.path`: espera pattern, view callable e nome; entrega rota resolvivel pelo Django.

## 4. Contrato OpenAPI e tipos gerados

### `schema.yaml`

**Funcao geral do arquivo**

Contrato OpenAPI gerado a partir do backend.

**Funcao geral da alteracao**

Adiciona path `/api/bujo/task-density/`, campo `sourceTemplate` em `Task` e schemas `TaskDensityEntry`/`TaskDensityResponse`.

**Blocos principais**

- Linhas 279-313: novo endpoint GET com query obrigatoria `month_first`, security `jwtAuth` e resposta `TaskDensityResponse`.
- Linhas 825-864: `Task.sourceTemplate` como `uuid nullable`.
- Linhas 889-908: schemas gerados para item e resposta de densidade.

**Funcoes, classes e importacoes especificas**

- Nao ha funcoes runtime; componentes OpenAPI nomeiam contratos consumidos pelo gerador de tipos.

**Comportamento de libs usadas**

- drf-spectacular gera este YAML a partir de serializers/views; `security: jwtAuth` informa clientes e docs que JWT e exigido.

### `frontend/src/api/types.gen.ts`

**Funcao geral do arquivo**

Tipos TypeScript gerados a partir de `schema.yaml`.

**Funcao geral da alteracao**

Adiciona o path tipado de densidade, `Task.sourceTemplate`, os schemas de densidade e a operacao `bujo_task_density_retrieve`.

**Blocos principais**

- Linhas 236-267: novo path `"/api/bujo/task-density/"`.
- Linhas 513-546: schema `Task` ganha `sourceTemplate?: string | null`.
- Linhas 553-560: `TaskDensityEntry` e `TaskDensityResponse`.
- Linhas 959-979: operacao `bujo_task_density_retrieve` com query `month_first` e resposta 200.

**Funcoes, classes e importacoes especificas**

- `paths`, `components`, `operations`: interfaces geradas usadas para tipar API client e aliases do dominio.

**Comportamento de libs usadas**

- `openapi-typescript` traduz schemas OpenAPI em interfaces TS; campos nullable viram `string | null`, datas ficam `string` com anotacao de formato.

## 5. Frontend: camada de dados e exports

### `frontend/src/api/keys.ts`

**Funcao geral do arquivo**

Centraliza query keys do React Query.

**Funcao geral da alteracao**

Adiciona `keys.bujo.taskDensity(monthFirst?)`.

**Blocos principais**

- Linhas 21-24: query key `['bujo', 'taskDensity', monthFirst ?? 'current']`.

**Funcoes, classes e importacoes especificas**

- `taskDensity`: fabrica key estavel para cachear densidade por mes.

**Comportamento de libs usadas**

- React Query usa arrays como identificadores de cache; invalidar por prefixo `['bujo', 'taskDensity']` alcanca todos os meses.

### `frontend/src/features/bujo/api.ts`

**Funcao geral do arquivo**

Hooks e chamadas HTTP do dominio Bujo no frontend.

**Funcao geral da alteracao**

Importa tipos de densidade, invalida cache de densidade quando tarefas mudam, cria `fetchTaskDensity` e exporta `useTaskDensityQuery`.

**Blocos principais**

- Linhas 15-22: novos imports `TaskDensityEntry` e `TaskDensityResponse`.
- Linhas 238-245: `useCreateMonthlyTaskMutation` invalida `['bujo', 'taskDensity']`.
- Linhas 429-438: `usePlaceRecurringTemplateMutation` tambem invalida densidade.
- Linhas 442-448: `fetchTaskDensity` faz GET em `/api/bujo/task-density/` com `month_first`.
- Linhas 454-460: `useTaskDensityQuery` encapsula `useQuery` e repassa `enabled`.

**Funcoes, classes e importacoes especificas**

- `fetchTaskDensity`: espera `monthFirst`, retorna `TaskDensityEntry[]`.
- `useTaskDensityQuery`: hook consumidor do endpoint, usado pelo dialog.
- `queryClient.invalidateQueries`: marca queries como stale para refletir novas tarefas.

**Comportamento de libs usadas**

- `client.get<T>`: chamada HTTP tipada; `response.data` e interpretado como `T`.
- `useQuery`: espera `queryKey`, `queryFn` e flags como `enabled`; retorna estado/data/cache.
- `useMutation` callbacks `onSuccess`: executam invalidacoes apos criacao/placement bem-sucedidos.

### `frontend/src/features/bujo/types.ts`

**Funcao geral do arquivo**

Aliases de tipos do dominio Bujo gerados a partir de `components['schemas']`.

**Funcao geral da alteracao**

Reexporta tipos de densidade para uso local.

**Blocos principais**

- Linhas 15-18: `TaskDensityEntry` e `TaskDensityResponse`.

**Funcoes, classes e importacoes especificas**

- `TaskDensityEntry`: alias para item `{ date: string; count: number }`.
- `TaskDensityResponse`: alias para `{ density: TaskDensityEntry[] }`.

**Comportamento de libs usadas**

- TypeScript `type` aliases nao geram runtime; servem para checagem estatica.

### `frontend/src/features/bujo/index.ts`

**Funcao geral do arquivo**

Barrel de exports publicos da feature Bujo.

**Funcao geral da alteracao**

Exporta `useTaskDensityQuery`, `MonthDensityCalendar` e tipos de densidade.

**Blocos principais**

- Linhas 18-22: hook novo entra no export da API.
- Linhas 26-30: componente `MonthDensityCalendar` entra no barrel.
- Linhas 43-48: tipos de densidade entram nos exports.

**Funcoes, classes e importacoes especificas**

- `useTaskDensityQuery`: disponibilizado para consumidores da feature.
- `MonthDensityCalendar`: componente reutilizavel preparado para Story 11.6.

**Comportamento de libs usadas**

- ES module reexports preservam uma API de importacao centralizada para a feature.

## 6. Frontend: calendario e dialog

### `frontend/src/features/bujo/components/MonthDensityCalendar.tsx`

**Funcao geral do arquivo**

Componente novo que renderiza um calendario mensal com contagem de tarefas por dia.

**Funcao geral da alteracao**

Cria um componente reutilizavel, informativo por padrao, com props opcionais para selecao futura.

**Blocos principais**

- Linhas 1-2: imports MUI e nomes de meses.
- Linhas 4-18: contrato de props e nota de reuso para Story 11.6.
- Linhas 20-32: labels segunda-feira-first e helpers `parseLocalDate`/`isoOf`.
- Linhas 35-59: calcula ano, mes, dias, blanks e semanas.
- Linhas 61-82: renderiza `<table>`, `<thead>` e cabecalhos.
- Linhas 83-155: renderiza dias, labels acessiveis, contagem, modo informativo ou `ButtonBase` interativo.

**Funcoes, classes e importacoes especificas**

- `MonthDensityCalendar`: componente React principal.
- `parseLocalDate`: evita `new Date(isoString)` para nao sofrer shift UTC.
- `isoOf`: formata `YYYY-MM-DD` com `padStart`.
- `ButtonBase`: so aparece quando `onSelectDay` existe; chama `onSelectDay(iso)`.

**Comportamento de libs usadas**

- MUI `Box`: renderiza elementos semanticos via `component`, mantendo `sx`.
- MUI `Typography`: aplica variantes de tema.
- MUI `ButtonBase`: base acessivel clicavel, recebe `aria-label` e `aria-pressed`.
- `Map<string, number>`: entrega lookup O(1) de contagem por ISO date.

### `frontend/src/features/bujo/components/RecurringPlacementDialog.tsx`

**Funcao geral do arquivo**

Dialog que coleta data/dia opcional para colocar template recorrente.

**Funcao geral da alteracao**

Passa a receber o template e `monthFirst`, buscar densidade quando aberto, exibir informacoes da recorrencia e renderizar o calendario.

**Blocos principais**

- Linhas 1-7: imports de `Typography`, hook de densidade, tipo do template e calendario.
- Linhas 9-16: props novas `template` e `monthFirst`.
- Linhas 17-35: estado local do input e chamada `useTaskDensityQuery(monthFirst, { enabled: open })`.
- Linhas 44-68: `Dialog` `fullWidth maxWidth="xs"` e bloco de titulo/descricao/recorrencia.
- Linhas 69-82: campo `Data` ou `Dia` preservado.
- Linhas 84-86: calendario com `densityByDate`.

**Funcoes, classes e importacoes especificas**

- `RecurringPlacementDialog`: componente React de coleta e exibicao.
- `handleConfirm`: chama `onConfirm(value)` e limpa estado.
- `handleClose`: limpa estado e chama `onClose`.
- `useTaskDensityQuery`: busca densidade somente quando `open` esta true.

**Comportamento de libs usadas**

- MUI `Dialog`: portal/modal; `fullWidth maxWidth="xs"` restringe largura.
- MUI `TextField`: input controlado para data/dia.
- `new Map(array.map(...))`: converte lista da API em mapa consumido pelo calendario.

## 7. Frontend: dedup e paginas do planner

### `frontend/src/features/bujo/components/RecurringPlacementSection.tsx`

**Funcao geral do arquivo**

Lista templates recorrentes disponiveis para placement em uma superficie semanal/mensal.

**Funcao geral da alteracao**

Troca `onPlace(templateId)` por `onPlace(template)`, adiciona `placedTemplateIds`, esconde colocados por padrao e cria o switch "Mostrar ja colocados".

**Blocos principais**

- Linhas 1-6: imports de `useState`, `FormControlLabel`, `Switch` e tipo `RecurringTaskTemplate`.
- Linhas 8-15: props atualizadas.
- Linhas 24-37: estado `showPlaced`, query de templates ativos, filtro por grupo e dedup.
- Linhas 39-42: secao so some se nao ha nenhum template no grupo.
- Linhas 45-59: heading e switch.
- Linhas 60-82: render de cada template, sufixo "(ja colocado)" e callback `onPlace(template)`.

**Funcoes, classes e importacoes especificas**

- `RecurringPlacementSection`: componente que delega placement para a pagina.
- `useRecurringTemplatesQuery`: busca templates ativos.
- `placedTemplateIds.has(template.id)`: determina se o template ja tem instancia no periodo.

**Comportamento de libs usadas**

- React `useState`: controla o switch local.
- MUI `Switch`: controle booleano acessivel.
- MUI `FormControlLabel`: associa label "Mostrar ja colocados" ao switch.

### `frontend/src/pages/planner/MonthlyPage.tsx`

**Funcao geral do arquivo**

Pagina "Este Mes"/monthly log do planner.

**Funcao geral da alteracao**

Guarda o template inteiro em placement, calcula templates ja colocados a partir de `tasks.sourceTemplate`, passa dados ao section/dialog e usa `placingTemplate.id` no mutation.

**Blocos principais**

- Linhas 9-16: importa `RecurringTaskTemplate`.
- Linhas 57-60: estado `placingTemplate`.
- Linhas 85-91: `placedTemplateIds` via `tasks.map(task.sourceTemplate).filter(Boolean)`.
- Linhas 224-229: `RecurringPlacementSection` recebe `onPlace={setPlacingTemplate}` e `placedTemplateIds`.
- Linhas 230-246: `RecurringPlacementDialog` recebe `template`, `monthFirst`, fecha limpando estado e confirma usando `placingTemplate.id`.

**Funcoes, classes e importacoes especificas**

- `MonthlyPage`: compoe log mensal, seccoes e dialog.
- `usePlaceRecurringTemplateMutation`: cria instancia do template no mes.
- `Set<string>`: remove duplicatas de `sourceTemplate`.

**Comportamento de libs usadas**

- React `useState`: guarda objeto do template para evitar re-resolver por id.
- `Array.filter((id): id is string => Boolean(id))`: type guard TS para remover null/undefined.

### `frontend/src/pages/planner/WeeklyPage.tsx`

**Funcao geral do arquivo**

Pagina "Esta Semana"/weekly log do planner.

**Funcao geral da alteracao**

Mesma fiação da mensal, mas calcula dedup a partir de tarefas dos dias e sem dia, e define `monthFirst` como o mes de `weekStart`.

**Blocos principais**

- Linhas 6-14: importa `RecurringTaskTemplate`.
- Linhas 20-23: estado `placingTemplate`.
- Linhas 35-45: calcula `placedTemplateIds` em `days.flatMap(...)+unscheduled`.
- Linhas 46-49: define `monthFirst = \`${weekStart.slice(0, 7)}-01\``.
- Linhas 115-139: passa props para section/dialog e confirma usando `placingTemplate.id`.

**Funcoes, classes e importacoes especificas**

- `WeeklyPage`: compoe semana e placement semanal.
- `usePlaceRecurringTemplateMutation`: cria instancia weekly com `weekStart` e `scheduledDate`.

**Comportamento de libs usadas**

- `flatMap`: concatena tarefas de todos os dias em uma lista.
- Template string com `slice`: deriva primeiro dia do mes exibido no calendario.

## 8. Backend: testes

### `backend/bujo/tests/test_serializers.py`

**Funcao geral do arquivo**

Testa serializers de log/tarefa.

**Funcao geral da alteracao**

Atualiza lista de campos esperados e adiciona testes para `source_template` nulo e preenchido apos placement.

**Blocos principais**

- Linhas 1-16: imports novos de `date`, `place_template`, `MonthlyLogFactory` e `RecurringTaskTemplateFactory`.
- Linhas 43-53: campo `source_template` entra no set esperado.
- Linhas 56-66: tarefa comum serializa `source_template is None`.
- Linhas 69-87: placement mensal serializa `source_template == template.id`.

**Funcoes, classes e importacoes especificas**

- `place_template`: service que cria `Task` a partir de `RecurringTaskTemplate` e grava FK `source_template`.
- `tenant_context`: define usuario corrente para manager tenant-scoped.

**Comportamento de libs usadas**

- `pytest.mark.django_db`: habilita acesso ao banco nos testes.
- Factories criam registros de teste consistentes.

### `backend/bujo/tests/test_views.py`

**Funcao geral do arquivo**

Testa views/endpoints Bujo.

**Funcao geral da alteracao**

Adiciona suite de `TaskDensityView`.

**Blocos principais**

- Linhas 1521-1545: agregacao das tres fontes e soma de datas coincidentes.
- Linhas 1548-1563: ordenacao ascendente e ausencia de dias vazios.
- Linhas 1566-1580: `scheduled_date=None` nao conta.
- Linhas 1583-1597: subtarefas nao inflam contagem.
- Linhas 1600-1615: apenas mes pedido entra.
- Linhas 1618-1640: `month_first` ausente, invalido ou fora do dia 1 retorna 400.
- Linhas 1643-1655: isolamento entre tenants.
- Linhas 1658-1664: sem autenticacao retorna 401.

**Funcoes, classes e importacoes especificas**

- `auth_client.get`: chama endpoint autenticado.
- `APIClient`: cliente DRF sem autenticacao no teste 401.
- `week_start_of`: calcula segunda-feira da semana para factories weekly.

**Comportamento de libs usadas**

- DRF test client retorna `response.status_code` e `response.data`.
- Django ORM factories montam cenarios daily/weekly/monthly com datas controladas.

## 9. Frontend: testes unitarios e de pagina

### `frontend/src/features/bujo/components/MonthDensityCalendar.test.tsx`

**Funcao geral do arquivo**

Teste novo do componente `MonthDensityCalendar`.

**Funcao geral da alteracao**

Valida calendario monday-first, dias do mes, contagens, labels acessiveis, ausencia de interatividade por padrao, modo interativo futuro e axe.

**Blocos principais**

- Linhas 1-7: imports Vitest, Testing Library, ThemeProvider, jest-axe e componente.
- Linhas 8-18: helper `renderCalendar`.
- Linhas 20-26: cabecalho `Seg` a `Dom`.
- Linhas 28-64: dias, densidade, singular/plural e off-by-one.
- Linhas 66-79: modo informativo vs. modo clicavel com `onSelectDay`.
- Linhas 81-85: acessibilidade sem violacoes.

**Funcoes, classes e importacoes especificas**

- `renderCalendar`: aplica tema real da app.
- `within(cell)`: consulta conteudo dentro da celula encontrada.
- `vi.fn`: spy para callback de selecao.

**Comportamento de libs usadas**

- Testing Library consulta por role/label, aproximando uso acessivel.
- `jest-axe` analisa violacoes automatizadas de acessibilidade.

### `frontend/src/features/bujo/components/RecurringPlacementDialog.test.tsx`

**Funcao geral do arquivo**

Teste novo do dialog de placement enriquecido.

**Funcao geral da alteracao**

Mocka `useTaskDensityQuery`, valida info da recorrencia, calendario, `enabled`, coleta de valores, ausencia de info quando `template=null` e axe.

**Blocos principais**

- Linhas 1-15: imports e mock de API.
- Linhas 17-25: template fixture.
- Linhas 27-45: helper `renderDialog`.
- Linhas 47-56: setup do mock de densidade.
- Linhas 58-78: info do template, calendario e chamada `enabled: true`.
- Linhas 80-96: coleta de `date` e `day`.
- Linhas 98-110: template nulo e acessibilidade.

**Funcoes, classes e importacoes especificas**

- `mockUseTaskDensityQuery`: substitui hook real por dados deterministas.
- `fireEvent.change/click`: simula input e confirmacao.

**Comportamento de libs usadas**

- `vi.mock`: intercepta modulo `../api`.
- MUI Dialog porta conteudo para `document.body`; por isso axe roda em `document.body`.

### `frontend/src/features/bujo/components/RecurringPlacementSection.test.tsx`

**Funcao geral do arquivo**

Testa a lista de placement recorrente.

**Funcao geral da alteracao**

Atualiza callback para receber template inteiro e adiciona testes de dedup, switch de recolocacao e compatibilidade sem `placedTemplateIds`.

**Blocos principais**

- Linhas 34-48: helper `renderSection` recebe `placedTemplateIds`.
- Linhas 100-110: clique chama `onPlace(WEEKLY_TEMPLATE)`.
- Linhas 112-118: template colocado nao aparece por padrao.
- Linhas 120-133: switch revela item "(ja colocado)" e permite recolocar.
- Linhas 135-141: sem `placedTemplateIds`, comportamento antigo.

**Funcoes, classes e importacoes especificas**

- `mockUseRecurringTemplatesQuery`: fornece templates fake ao componente.
- `getByRole('checkbox', { name: 'Mostrar ja colocados' })`: encontra o switch por label acessivel.

**Comportamento de libs usadas**

- Testing Library valida comportamento pelo DOM e acessibilidade, nao por implementacao interna.

### `frontend/src/pages/planner/MonthlyPage.test.tsx`

**Funcao geral do arquivo**

Testa a pagina mensal do planner.

**Funcao geral da alteracao**

Adiciona bloco Story 11.3 para dedup via `sourceTemplate` e fetch de densidade com `month_first` correto.

**Blocos principais**

- Linhas 383-452: novo describe `Dedup + densidade`.
- Linhas 392-424: mocka tarefa com `sourceTemplate: 'tpl-1'` e verifica ausencia do template na lista.
- Linhas 426-452: abre dialog e espera GET `/api/bujo/task-density/` com `month_first: '2026-07-01'`.

**Funcoes, classes e importacoes especificas**

- `routeRecurringTemplatesGet`: mocka endpoint/lista de templates.
- `mockUseMonthlyLogQuery`: fornece monthly log fake.
- `mockGet`: spy do cliente HTTP.

**Comportamento de libs usadas**

- `vi.useFakeTimers`/`setSystemTime`: fixa data corrente para testes deterministas.
- `waitFor`: espera efeito assincrono da query HTTP.

### `frontend/src/pages/planner/WeeklyPage.test.tsx`

**Funcao geral do arquivo**

Testa a pagina semanal do planner.

**Funcao geral da alteracao**

Adiciona bloco Story 11.3 para dedup via tarefas semanais e fetch de densidade com mes derivado de `weekStart`.

**Blocos principais**

- Linhas 248-312: novo describe `Dedup + densidade`.
- Linhas 256-289: tarefa semanal com `sourceTemplate` esconde template.
- Linhas 291-312: abre dialog e espera `month_first: '2026-07-01'`.

**Funcoes, classes e importacoes especificas**

- `mockUseWeeklyLogQuery`: fornece weekly log fake.
- `mockMatchMedia`: controla layout mobile/desktop no teste.

**Comportamento de libs usadas**

- `waitFor`: sincroniza com o fetch disparado ao abrir o dialog.

## 10. Frontend: E2E

### `frontend/e2e/recurring-templates.spec.ts`

**Funcao geral do arquivo**

Spec Playwright que cobre templates recorrentes em fluxos reais do navegador.

**Funcao geral da alteracao**

Atualiza testes existentes para o novo modal/dedup e adiciona teste E2E de densidade real cross-source Daily -> Monthly.

**Blocos principais**

- Linhas 54-64: no fluxo weekly, verifica titulo, recorrencia e cabecalho do calendario no dialog.
- Linhas 185-205: apos editar template ja colocado, liga "Mostrar ja colocados" para recolocar.
- Linhas 220-297: novo teste cria tarefa daily, template mensal com descricao, abre monthly placement, aguarda `/task-density/`, verifica celula com `1 tarefa`, confirma que o calendario nao tem botoes e cancela sem criar instancia.

**Funcoes, classes e importacoes especificas**

- `page.waitForResponse`: espera round-trip real do endpoint novo.
- `page.getByRole/getByLabel/getByTestId`: localizadores acessiveis/semanticos.
- `test.setTimeout(120_000)`: amplia timeout para fluxo real-stack.

**Comportamento de libs usadas**

- Playwright executa no browser real, validando integracao frontend/backend.
- `expect(locator).toBeVisible()` e `toHaveCount()` aguardam estado esperado antes de falhar.

## Encadeamento produtor-consumidor

- `backend/bujo/serializers.py` produz `source_template`, que vira `sourceTemplate` em `schema.yaml` e `types.gen.ts`.
- `MonthlyPage.tsx` e `WeeklyPage.tsx` consomem `Task.sourceTemplate` para montar `placedTemplateIds`.
- `RecurringPlacementSection.tsx` consome `placedTemplateIds` para deduplicar e oferece recolocacao via switch.
- `backend/bujo/views.py` produz `/api/bujo/task-density/`, registrado em `urls.py` e documentado no contrato.
- `frontend/src/features/bujo/api.ts` consome esse endpoint via `useTaskDensityQuery`.
- `RecurringPlacementDialog.tsx` consome o hook e transforma a lista em `Map`.
- `MonthDensityCalendar.tsx` consome o `Map` para renderizar contagens por dia.
- Testes backend validam produtores; testes frontend validam consumidores; E2E valida o fluxo integrado.

## Observacoes finais

Todos os arquivos de codigo alterados sao aditivos ou ajustes de fiacao para a Story 11.3; nao ha migracao de banco nem alteracao de modelo. Este relatorio foi criado como artefato novo do pedido e nao reanalisa a si mesmo como mudanca original.
