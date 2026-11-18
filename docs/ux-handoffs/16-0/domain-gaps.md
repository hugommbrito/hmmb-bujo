# Lacunas de domínio — leituras pedidas na revisão da 16.0

As quatro leituras abaixo foram **desenhadas** (âncora `#2l` e a grade agregada de `#2h`) a pedido da revisão, e **nenhuma delas é implementável hoje**: não existem no domínio, e a interface tem proibição explícita de inferir completude. Este documento é a entrada para a story de domínio.

## Pré-condição de produto
Duas frases dos contratos vigentes precisam ser revogadas ou qualificadas antes de qualquer implementação:
- `epics.md` — "não criar streaks, rankings, conquistas, recompensas, gamificação";
- `EXPERIENCE.md` / voz e tom — "nada de streak"; "sucesso comunicado pela mudança da lista/contagem".

O desenho entregue tenta caber no espírito do contrato: contagem factual, sem chama colorida, sem medalha, sem "não quebre a corrente", sem mudança de cor conforme o número. Mesmo assim, **é métrica nova** e depende de decisão de produto.

## As quatro leituras

### 1. Sequência por hábito (F15)
- Por hábito, no intervalo: **sequência atual** e **maior sequência do período**.
- Definição proposta: dias consecutivos com o hábito feito (booleano) ou com `metaAtTime` atingida (numérico). Dia sem registro **interrompe** a sequência.
- Decisões pendentes: a sequência atravessa períodos de inatividade do hábito? uma correção retroativa recalcula a sequência? o "hoje" ainda não registrado conta como interrupção?
- Apresentação: ícone `fire` monocromático + número; sequência zerada não exibe chama nem "0" — exibe travessão. Texto completo no hover e no nome acessível.

### 2. Contagem de dias com 100% de completude (F14)
- Por período (semana, mês, ano): quantos dias tiveram completude = 100%.
- Definição proposta: **denominador = dias com registro no período**, não dias corridos — dia sem registro não entra nem como falha.
- Decisões pendentes: o ano é ano civil ou últimos 365 dias? a semana começa na segunda (padrão do produto)? um dia com `Σ peso efetivo = 0` conta como 100% ou é excluído?

### 3. Série de completude por grupo e por data (F13)
- Por data, no intervalo: a contribuição de cada grupo na completude do dia e o total do dia.
- Rota sugerida: `GET /api/habits/history/by-group/?start&end`.
- Requisitos de payload: contribuição já **calculada no servidor** sobre os pesos congelados; dia sem linha vem explicitamente nulo (para render "sem registro" em vez de barra zerada).
- Restrição de leitura: 4 cores de grupo é o teto legível. Acima disso, o gráfico mostra só o total do dia e a leitura por grupo fica na tabela.
- O filtro de grupos do gráfico é **de leitura**: ocultar um grupo tira o segmento e a coluna, mas o total do dia continua sendo o do dia inteiro.

### 4. Completude agregada por hábito e período (grade de `#2h`, Q10)
- Por hábito × semana (ou quinzena): um número que resume o período.
- Definições pendentes, todas necessárias:
  - **booleano** — denominador é o número de dias do período ou só os dias com registro? (a tela mostra dias do período: "5/7")
  - **numérico** — média simples entre os dias ou ponderada pelo peso efetivo?
  - **dia sem registro** — entra como zero ou é excluído do cálculo?
  - **semana parcial** no fim do intervalo — a tela rotula os dias reais ("4 dias"); confirmar se é o comportamento desejado.
- Alternador semana/quinzena implica dois tamanhos de bucket na mesma rota.

## O que a interface **não** vai fazer
Nenhuma dessas quatro leituras pode ser calculada no cliente. A regra vigente — "peso, completude e multiplicadores devem seguir estritamente o domínio existente e nunca ser inferidos apenas pela interface" — vale igualmente para agregações. Enquanto a story de domínio não existir, os blocos de `#2l` e a grade agregada permanecem **desenho aprovado, não implementável**, e a 16.0 pode ser implementada sem eles: as superfícies 2e–2j não dependem de nada disso.
