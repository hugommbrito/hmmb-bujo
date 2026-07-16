- [ ] Implementar aqui os logs de viagem, moradia e empregos que devo manter para o cadastro do canadá.
- [ ] Implementar um resumo diário? Uma opção para descrever um pouco do que aconteceu no dia de diferente.
  - A ideia é que esse resumo possa ser usado para gerar análises com IA, explicando fatos Ex.: Nesse dia houve pouca produtividade, mas pode ser explicada pela forte notícia recebida no dia anterior.
- [ ] Seção de observação nos logs diários, para eventos importantes que devam ser lavdos em consideração na análise.
- [ ] Fundir com o foodLog ou consumir dele.
- [ ] Fazer uma segunda opção de UI ( Mais moderna e atrativa para quem não tiver necessidade de conexão com o caderno físico )
- [ ] Implementação de automações com shortcuts no iphone
- [ ] AppMobile? É possível fazer widgets sem um app?
- [ ] Aba de "Histórico", para ver logs, weeks e months passados.


BUGs Epico 4 (resolvidos no Épico 11 — ver `_bmad-output/implementation-artifacts/epic-11-retro-*.md`):
- [x] Testes poluindo o banco de dados. O banco atualmente possui mais de 200 usuários, mas eu sou o único cadastrado na plataforma. — Story 11.1
- [x] Recorrentes: Remover de dentro de configurações (Criar aba "Recorrentes" dentro de "Planner") — Story 11.2
- [x] Recorrentes: Filtros e abas (ativo, recorrência, etc.) — Story 11.2
- [x] Recorrentes: Na aba este mês esta semana, o recorrente deve desaparecer ao ser definido o placemente (Filtro para exibir apenas os recorrentes que não estejam citados como ) — Story 11.3
- [ ] Recorrentes: Exibir no modal as informações daquela recorrência ao fazer o placement e mostrar um calendário do mês com indicador de quantas taks já tem previstas para aquele dia — Story 11.3 (Falta exibir as informações da task no modal - descrição, etc.)
- [x] Recorrentes: Na aba Logs Futuros deve conter os Recorrentes anuais que ainda não foram "placed" nesse ano. — Story 11.4
- [ ] Este mês / Esta Semnana: Possibilidade de deletar / editar tasks. — Story 11.5 (Edição não está salvando)
- [x] Esta Semana: Devo poder adicionar uma task em um dia desta semana. — Story 11.5
- [x] Uma task em qualquer lugar (log, esta semana, este mês ou futuro) deve poder ser migrada ou adiada — Story 11.6
  - Premissa: Se eu quero antecipar para hoje uma tarefa de amanhã (esta semana) ou da próxima semana (este mês), devo ter essa opção e o mesmo acontece ao contrário, caso uma tarefa do log deva ser feita amanhã, na próxima semana ou no próximo mês, devo poder adiá-la.


Bugs:
- [ ] Story 11.3 (Falta exibir as informações da task no modal - descrição, categoria, eisenhower, etc.)
- [ ] Story 11.5 (Edição não está salvando). Não tem um botão de salvar e quanto fecho a aba, não está persistindo.
- [ ] Story 11.6 O modal de migração não está funcionando em Esta Semana
- [ ] Modal de mover tarefas deve ter as seguintes opções/abas:
    - [ ] Hoje (mover para o log de hoje)
    - [ ] Esta semana - exibe calendário de densidade do mês (dando a opção de escolher um dia específico ou de alocar na semana sem data certa)
    - [ ] Este mês  - exibe calendário de densidade do mês (dando a opção de escolher um dia específico ou de alocar na semana sem data certa)
    - [ ] Futuro (Como já está)

Melhorias de UX/UI:
- [ ] O calendário do modal de edição deve mostrar algum tipo de higlight na semana atual e no dia de hoje
- [ ] Ao clicar em um dia no calendário, ele deve preencer o campo do seletor de data.
- [ ] Todos os cards de task que possuírem descrição, devem mostar a descrição (mesmo que seja só o início truncado). Isso também serve par os recorrentes.
- [ ] Na exibição "esta semana", dividir os dias da semana em duas linhas. 7 dias em uma linha só está ficando muito apertado.
- [ ] Aplicar um hover sobre os cards de tasks
- [ ] centralizar um pouco mais os carts que se extendem de lado a lado da tela. Os botões e chips estão ficando muito distante do título do card, acabam ficando desconexos.
- [ ] O modal de migração deve ter um botão "Migrar" para dispara a ação, não só disparar automaticamente no preenchimento. Mudar também o título para Migrar Tarefa.
- [ ] O modal de migração deve conter mais informações da task (Descrição, data atual, etc.)