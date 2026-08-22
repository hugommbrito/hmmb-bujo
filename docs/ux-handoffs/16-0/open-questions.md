# Questões abertas — Story 16.0 (decisão antes das stories de implementação)

| # | Questão | Situação no mockup | Tipo de decisão |
|---|---|---|---|
| Q1 | **Carga do catálogo Phosphor.** Com o catálogo inteiro disponível (~1.500 nomes), a lista de nomes válidos precisa vir de uma fonte única (o pacote instalado) e a grade precisa de virtualização para não montar ~1.500 nós. | Grade de tiles com rolagem e nota de virtualização obrigatória; contador em `aria-live`. | Implementação |
| Q1b | **Glifo removido numa atualização do Phosphor.** Um `iconKey` válido hoje pode deixar de existir. | Não desenhado. Regra proposta: servidor valida contra a versão instalada; chave órfã cai para coluna de glifo vazia (o layout não muda). | Domínio |
| Q2 | **Migração do `emoticon`.** O campo de emoji sai da interface e cada hábito precisa receber um `iconKey`. Sem fallback desenhado — decisão do Hugo, produto de usuário único. | Nenhum fallback de emoji na interface. | **Bloqueia:** a story de implementação precisa incluir o passo de migração do dado |
| Q3 | **Ordenação de grupos e hábitos.** `display_order` existe no schema, sem UI e sem endpoint. | Ordem do servidor, sem controle. Cards em duas colunas tornam a ordem mais visível. | Domínio (story própria se virar requisito) |
| Q4 | **Largura de leitura do tracker.** Os cards em duas colunas rompem a coluna única de 800px do padrão Registro; cada card mantém ~520px de leitura. | Adotado, com a exceção declarada. | Design system (ratificar como variante "Registro em cards" ou manter local a Hábitos) |
| Q5 | **Edição de dias passados.** Confirmado como comportamento desejado na revisão: a navegação de data edita qualquer dia já semeado, com os pesos congelados daquele dia. | Navegação de data no tracker + "Abrir este dia para edição" no histórico. | **Bloqueia:** falta decidir se existe limite de retroatividade (ex.: 30 dias) ou se qualquer data passada é editável |
| Q6 | **Entrada decimal do multiplicador.** `input type="number"` rejeita a vírgula pt-BR. | Campos com `inputmode="decimal"`. | Implementação (parser aceita vírgula e ponto? como normaliza antes do PUT?) |
| Q7 | **Sequência, dias 100% e completude por grupo — desenhados a pedido da revisão, fora das stories.** Colidem com dois limites vigentes ("sem streak/gamificação" e "nenhuma métrica nova") e nenhuma das três existe no domínio. | Desenhados e isolados em `#2l`, com aviso de "não está nas stories" abrindo e fechando o bloco. | **Bloqueia a 2l:** revogar o limite no epics.md e no EXPERIENCE.md + story de domínio (ver `domain-gaps.md`) |
| Q8 | **Visões do gráfico de evolução.** Três visões usam só o payload que `GET /api/habits/{id}/series/` já devolve. | Valor diário · % da meta · contribuição na completude. | Resolvida (sem API nova). Qualquer visão além dessas exige payload novo |
| Q9 | **Checkbox automático no hábito numérico.** Indicador, não controle: desabilitado, com nome acessível "meta atingida / meta não atingida — marcação automática". | Adotado, marcado quando a meta é atingida. | UX (confirmar se reflete a meta atingida ou a contribuição cheia pós-bônus — coincidem hoje, divergem se o bônus mudar de regra) |
| Q10 | **Completude por hábito e período — agregação.** Cada célula agrega vários dias num número só: métrica nova. | Booleano mostra dias feitos / dias do período ("5/7"); numérico mostra a média ("71%"); semana parcial rotula os dias reais. | **Bloqueia a grade agregada:** definir denominador do booleano, média simples vs. ponderada no numérico, tratamento do dia sem registro e da semana parcial |

## Recusado por falta de requisito
- Exclusão de hábito — o domínio desativa, nunca deleta.
- Tipo de hábito novo, métrica nova, regra de completude nova, campo, filtro, busca, ordenação manual.
- Reordenação de grupos e hábitos por arraste (Q3).
- Fila offline, rascunho local, autosave, sincronização posterior, indicador de "pendente de envio".
- Toast de sucesso, celebração, confete, som, contador motivacional.
- Recomendação, insight, sugestão de meta, IA, análise de tendência, comparação entre períodos.
- Streak, ranking, conquista, recompensa **nas superfícies 2e–2j** (o desenho pedido está isolado na 2l — Q7).
- Edição de registros dentro do histórico — o histórico é read-only; a correção acontece na aba Hoje.
- Lembrete, notificação, agendamento de hábito por dia da semana.
- Compartilhamento, exportação, importação.

## Bloqueios, em ordem
1. **Q2** — sem o passo de migração de `iconKey`, os hábitos existentes ficam sem pictograma na entrada da tela.
2. **Q5** — o limite de retroatividade muda o que a navegação de data pode oferecer.
3. **Q7 + Q10 + `domain-gaps.md`** — bloqueiam **apenas** a 2l e a grade agregada. As superfícies 2e–2j são implementáveis sem eles.
4. **Q4** — ratificação de design system; não bloqueia código, mas evita divergência no catálogo.
