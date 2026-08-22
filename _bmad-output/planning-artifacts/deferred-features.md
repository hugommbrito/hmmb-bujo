# Funcionalidades deferidas

Catálogo transversal de ideias que surgem durante descoberta, UX, implementação e revisão, mas não entram automaticamente no contrato da story ou do épico em curso.

## Como usar

1. Registrar a ideia sem transformá-la em requisito aprovado.
2. Identificar benefício, superfície, dependências e origem.
3. No gate do épico relacionado, decidir explicitamente entre:
   - incluir no escopo;
   - manter deferida;
   - encaminhar para outro épico;
   - descartar, registrando o motivo.
4. Somente itens aprovados e reconciliados com produto/arquitetura podem entrar nos spines e mocks canônicos.
5. Explorações visuais não contratuais ficam em `.working/future-vision/` no workspace UX correspondente.

## Estados

| Estado | Significado |
|---|---|
| Proposta | Ideia capturada; ainda não passou por descoberta suficiente |
| Em descoberta | Problema, benefício e alternativas estão sendo investigados |
| Aprovada | Produto e arquitetura autorizaram inclusão em escopo identificado |
| Descartada | Não será perseguida; o motivo permanece registrado |

## Catálogo

### DF-001 — Daily Logs anteriores no Arquivo

| Campo | Valor |
|---|---|
| Estado | Proposta |
| Superfície | Arquivo / Núcleo BuJo |
| Benefício | Permitir a consulta ocasional de dias anteriores e dos históricos de collections com registros diários a partir da superfície histórica |
| Origem | Story 14.0, brain dump de Hugo em 2026-07-24 |
| Contrato atual | O índice do Arquivo contém somente semanas e meses finalizados |
| Dependências | Decidir se Daily é entidade indexada no Arquivo ou deep link obtido por outra navegação; integrar somente collections disponíveis com histórico diário; definir composição, período, estados e API |
| Épico candidato | A definir no gate do Núcleo BuJo ou em evolução posterior do Arquivo |
| Exploração | `.working/future-vision/archive-future-vision.html` no workspace UX de 2026-07-17 |

#### Direção de experiência capturada

- A visão futura do Arquivo começa por abas temporais: **Diário**, **Semanal** e **Mensal**.
- **Diário** também dá acesso aos históricos de collections que mantêm registros diários, como Hábitos, Medicamentos e Métricas.
- **Diário** usa uma linha do tempo cronológica unificada por data, em vez de exigir a escolha prévia de uma collection.
- Cada data apresenta resumos separados dos módulos disponíveis, permitindo reconhecer o conteúdo antes de abrir o dia ou um módulo.
- Os resumos diários são **objetivos e calculados a partir dos dados**, não textos gerados por IA.
- O resumo de Hábitos mostra contagem concluída/esperada e percentual de completude do dia.
- Collections desligadas, indisponíveis ou sem superfície histórica contratada não aparecem como controles disabled.
- Cada collection disponível possui uma única preferência **Compartilhar com o Arquivo**.
- O compartilhamento é integral: quando ligado, a collection participa da linha do tempo, da busca histórica e dos resumos por IA; quando desligado, não participa de nenhuma dessas funções.
- Collections começam compartilhadas por padrão e podem ser excluídas em Configurações.
- Daily, Weekly e Monthly pertencem ao núcleo BuJo e participam sempre do Arquivo; a preferência existe somente para collections opcionais.

### DF-002 — Busca histórica por tarefa

| Campo | Valor |
|---|---|
| Estado | Proposta |
| Superfície | Arquivo / Núcleo BuJo |
| Benefício | Localizar uma tarefa específica e abrir diretamente seu período/container histórico |
| Origem | Story 14.0, brain dump de Hugo em 2026-07-24 |
| Contrato atual | O índice retorna apenas tipo e chave temporal; não existe busca histórica contratada |
| Dependências | Indexação/query de tarefas do núcleo BuJo, resultados, estados vazios/erro e localizador universal de tarefa |
| Épico candidato | A definir |
| Exploração | `.working/future-vision/archive-future-vision.html` no workspace UX de 2026-07-17 |

#### Escopo capturado

- A busca encontra somente tarefas do núcleo BuJo.
- Registros das collections compartilhadas não entram nos resultados, mesmo quando aparecem na linha do tempo ou alimentam resumos por IA.
- Selecionar um resultado abre primeiro um resumo readonly da linhagem, em vez de navegar imediatamente para um período.

### DF-003 — Navegação bidirecional da linhagem

| Campo | Valor |
|---|---|
| Estado | Proposta |
| Superfície | Task Row / detalhe histórico |
| Benefício | Percorrer tanto o sucessor quanto a origem de uma tarefa migrada |
| Origem | Story 14.0, brain dump de Hugo em 2026-07-24 |
| Contrato atual | Navegação aprovada somente da origem para o sucessor imediato |
| Dependências | Exposição da relação inversa, regras para cadeias, localizador universal, retorno e foco |
| Épico candidato | A definir |
| Exploração | `.working/future-vision/archive-future-vision.html` no workspace UX de 2026-07-17 |

#### Direção de experiência capturada

- A entrada pela busca mostra primeiro a cadeia de origem, migrações e destino atual.
- Todos os pontos da cadeia são navegáveis.
- A navegação para um log ocorre somente depois que Hugo escolhe um ponto; abre o período correspondente, posiciona e destaca aquela versão da tarefa.
- O retorno preserva busca, aba e posição.

### DF-004 — Resumo de período por IA

| Campo | Valor |
|---|---|
| Estado | Proposta |
| Superfície | Arquivo |
| Benefício | Produzir síntese factual de um período, por exemplo: “Resuma minhas atividades do último mês.” |
| Origem | Story 14.0, brain dump de Hugo em 2026-07-24 |
| Contrato atual | Não existe requisito, endpoint, agregação ou serviço de IA para o Arquivo |
| Dependências | Objetivo e formato do resumo; fontes e limites temporais; privacidade; consentimento; custo; retenção; disponibilidade; estados de loading/erro; persistência; arquitetura e provedor |
| Épico candidato | A definir |
| Exploração | `.working/future-vision/archive-future-vision.html` no workspace UX de 2026-07-17 |

#### Fronteira capturada

- A IA não gera automaticamente os resumos de cada data ou módulo.
- O resumo por IA permanece uma intenção separada e sob demanda para um período escolhido.
- O conjunto de módulos elegíveis deriva da preferência única **Compartilhar com o Arquivo** de cada collection.
- Todos os módulos compartilhados entram no resumo por padrão; a função deixa claro quais fontes serão usadas antes de gerar.
- Não existem permissões separadas para linha do tempo, busca e IA: a collection compartilha com todo o Arquivo ou com nada.
- A solicitação é híbrida: Hugo escolhe um período por controles estruturados e usa um prompt livre para dizer o que deseja extrair ou compreender.
- O período usa exclusivamente intervalo personalizado por data inicial e data final; não há presets.
- O prompt é opcional; vazio solicita um resumo factual geral do intervalo.
- Datas podem ficar vazias para representar intervalo aberto até a extremidade correspondente.
- Data inicial vazia usa o registro mais antigo disponível; data final vazia usa hoje.
- O período estruturado facilita montar o payload de contexto para a API de IA, mas o mock não define schema ou endpoint.
