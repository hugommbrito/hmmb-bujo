# Rastreabilidade — Story 16.0 (Mockup de Hábitos)

Âncoras (`#2e`, `#2f`, `F1`, `E3`, `O1`…) apontam para `Story 16.0 - Habitos.dc.html`.

## 1. Requisito → decisão visual

| Requisito | Decisão visual / de composição | Onde ver |
|---|---|---|
| FR-7.1 / FR-7.2 — grupos, nome, pictograma, peso, tipo | Configuração no padrão Coleção: Section Header por grupo → Item Rows → formulário de criação ao fim, com tipo por radio group (não select) e campos numéricos revelados só no tipo numérico. | 2f |
| FR-7.4 — completude ponderada | Uma leitura por escopo: porcentagem em texto tabular + barra de mesma largura em todas as faixas, com o denominador nomeado ("peso efetivo do dia"). A barra é redundante à porcentagem, nunca a única fonte. | 2e |
| FR-7.5 / FR-7.6 — mudança prospectiva e snapshot imutável | O aviso de prospectividade é texto persistente sob os campos versionados, não tooltip. Campos de identidade ficam visualmente separados dos versionados. | 2f |
| FR-7.7 / FR-7.8 — desativar e reativar | Tratamento terminal (opacidade 0,58 preservando contraste do texto essencial) + chip textual "Inativo". Ações nomeiam a consequência. Excluir não existe. | 2f |
| FR-7.9 / FR-7.10 — histórico por data e evolução | Date/Range Control no topo, detalhe por data readonly com contraste normal, gráfico com tabela equivalente sempre presente, eventos de configuração como lista datada. | 2h |
| AR-17 / AD-10 — multiplicador por tipo de dia | Fatores separados na leitura: `Peso 3 × 0,5 = 1,5` na linha e legenda no cabeçalho do grupo. Precedência declarada onde a config é editada. | 2e · 2f |
| Pictogramas de hábitos (EXPERIENCE) + `{components.domain-icon}` | Catálogo Phosphor completo (~1.500 nomes) buscável pelo nome em inglês, peso `regular` fixo no front; 20px na configuração e no tracker, 18px em grade e histórico, sempre `currentColor`. O mesmo `iconKey` em todas as superfícies; nunca sozinho. | 2g |
| Padrão Registro (EXPERIENCE §4) | Ordem de leitura idêntica nas três faixas: data e tipo de dia → completude → registro por grupo → histórico. Cards de grupo substituem a coluna única de 800px (exceção registrada em Q4). | 2e |
| Hoje — lente Foco / Dia completo | Em Foco, Hábitos é totalizador navegável com total realizado/esperado e estado de preenchimento; em Dia completo, lista densa editável (checkbox + pictograma + nome) sem duplicar o cabeçalho de completude. | 2i |
| UX-DR4 — Habit Tracker Row / Grid | Anatomia mantida: booleano por checkbox, numérico por campo com unidade e percentual da meta, cabeçalho de grupo com porcentagem ponderada e total no topo. Recomposta sobre tokens novos, sem borda de categoria (hábito não tem categoria). | 2e |
| UX-DR13 — voz e tom | Estado e consequência, sem julgamento: "Não feito", "Sem registro neste dia.", "7 de 11 registros preenchidos". Nenhum "parabéns", nenhum alvo motivacional. | 2j |
| UX-DR14 / UX-DR15 — loading, escrita e conectividade | Skeleton com a geometria real das linhas; erro inline junto à linha que falhou, preservando o valor digitado; offline desabilita marcação e configuração com motivo, sem promessa de fila. | 2j |
| UX-DR18 / UX-DR20 — responsividade e piso de acessibilidade | Recomposição, nunca compressão: a grade densa vira lista por dia no compact e o gráfico mantém a tabela equivalente em todas as faixas. Alvos 44/48px, foco de 2px com offset, cor nunca sozinha. | 2h · 2j |

## 2. Inventário de paridade — comportamento vigente a preservar

Extraído do módulo entregue (Épico 6, stories 6.1–6.4). Cada linha é **obrigação de paridade**: a recomposição visual não pode removê-la sem decisão explícita registrada em `open-questions.md`.

| Comportamento vigente | Regra preservada | Onde ver |
|---|---|---|
| Semeadura do dia | A primeira abertura do dia materializa uma linha por hábito ativo, congelando peso, meta, bônus, tipo de dia e multiplicador. A interface não cria linhas: ela abre o dia. | 2e |
| Marcação booleana | Checkbox alterna entre `1` e nulo. Nulo é "não feito", não é ausência de registro. | 2e |
| Registro numérico | Commit no `blur` e no `Enter`; campo vazio grava nulo; só envia quando o valor muda. Linha mostra `valor / meta unidade (percentual da meta)` e "Meta atingida" ao alcançar. | 2e |
| Completude | Porcentagem do dia e por grupo vem do servidor. A marcação é otimista no valor da linha; a porcentagem reconcilia depois do refetch. | 2e · 2j |
| Tipo de dia e multiplicador | Feriado marcado por data. Legenda do grupo só quando o dia não é útil e o multiplicador difere de 1. Override avulso grava `multiplierAtTime = 1,00` em cada linha do dia. | 2e |
| Mudança de configuração | Peso, meta, bônus e ativação abrem versão a partir de hoje, com o aviso literal. Nome, pictograma, grupo e unidade são identidade e mudam direto. | 2f |
| Criação | Grupo obrigatório; sem grupo, criar hábito indisponível. Nome, grupo, tipo e peso inicial obrigatórios; meta, bônus e unidade só no numérico. Tipo não muda depois. | 2f |
| Inativos | Fora da lista por padrão, aparecem com "Mostrar inativos", somem do dia ativo, permanecem no histórico. Reativar vale a partir do dia da reativação. | 2f |
| Multiplicadores do grupo | Dois campos por grupo — fim de semana e feriado — preenchidos pela config vigente e salvos prospectivamente. Campo vazio remove a config e devolve 1,00. | 2f |
| Histórico | Intervalo padrão de 30 dias; período anterior/próximo desloca o intervalo inteiro; a data do detalhe fica presa ao intervalo. Somente leitura. Dia sem registro diz "Sem registro neste dia." — nunca 0% fabricado. | 2h |
| Grade do período | Célula sem registro como "—", tags textuais FDS e FER, nome acessível por célula com hábito, data completa e estado. No compact, lista por dia. **Divergência decidida:** a grade hábitos × dias passou a agregar por semana/quinzena (Q10). | 2h |
| Evolução | Um hábito por vez, selecionado explicitamente; sem seleção, nada é buscado. Mudanças reais de configuração como eventos datados em texto. | 2h |
| Mensagens | Strings literais mantidas — ver `story-16.0-habitos.md` §8.1. | 2j |

## 3. Cobertura de estado → frame

| Estado | Frame(s) |
|---|---|
| tracker populated (wide · tablet · compact) | F1 · F3 · F4 |
| feriado, multiplicador e override avulso | F2 |
| configuração populated + edição versionada + inativo | F5 |
| configuração compact | F6 |
| sem grupo (criar hábito indisponível) | F7 |
| histórico populated + dia-lacuna + evolução + grade por período | F8 |
| histórico compact (lista por dia) | F9 |
| Hoje — lente Foco | F10 |
| Hoje — lente Dia completo (lista densa) | F11 |
| Hoje — sem hábito ativo e falha isolada do bloco | F12 |
| seletor de pictograma (dialog · sheet) | O1 · O2 |
| loading | E1 |
| saving na linha | E2 |
| erro de escrita com retry | E3 |
| offline | E4 |
| falha parcial | E5 |
| vazios (cinco frases distintas) | E6 |
| **leituras pedidas na revisão — fora das stories** | F13 · F14 · F15 |

## 4. Lacunas conhecidas de rastreabilidade
- **Q7 / Q10:** F13–F15 e a agregação por semana/quinzena **não** têm requisito upstream e não existem no domínio. Ver `domain-gaps.md`.
- **Q4:** os cards de grupo em duas colunas rompem a largura de leitura do padrão Registro — exceção a ratificar no DESIGN.
- **Q2:** a remoção do `emoticon` legado exige passo de migração de dado, ausente das stories atuais.
- `display_order` existe no schema e não tem UI nem endpoint (Q3) — a ordem exibida é a do servidor.
