# Reconciliação — Story 13.0 · App Shell

Data: 2026-07-24
Insumo: [`../../../implementation-artifacts/13-0-ux-spec-do-app-shell-novo.md`](../../../implementation-artifacts/13-0-ux-spec-do-app-shell-novo.md)

## Promovido aos spines

- Phosphor Icons como biblioteca iconográfica de toda a plataforma, preservando o vocabulário de status de tarefa.
- Catálogo fechado do App Shell: Hoje `calendar-dot`; Brain Dump `brain`; Arquivo `archive`; Configurações `gear`; Esta Semana `calendar-dots`; Este Mês `calendar`; Futuro `calendar-plus`; Recorrentes `repeat`; Hábitos `check-square`; Gratidão `heart`; Saúde `first-aid-kit`; Métricas `chart-line`; Medicamentos `pill`; sidebar `sidebar-simple`; captura `note-pencil`; Menu `list`.
- Destino inativo `regular`; ativo `fill` mais indicador lateral, fundo, label forte e estado acessível.
- Wide/medium com sidebar inicial de 240px; tablet com rail de 64px; estado de colapso somente na sessão.
- Planner e Saúde expandidos no início da sessão, estado preservado entre rotas; grupo recolhido não reabre ao conter rota ativa.
- Topbar B, “superfície como protagonista”, com 56px.
- Captura ancorada à navegação em desktop/tablet e FAB circular icon-only no mobile, respeitando safe-area.
- Bottom nav com três atalhos configuráveis e Menu fixo; menu completo como sheet alto contendo todos os destinos disponíveis, inclusive os atalhos.
- Foco inicial do menu no destino ativo; fechamento por Fechar, backdrop, Escape ou gesto; retorno de foco a Menu.
- Nav mínima com Planner completo; Saúde permanece com um filho e desaparece quando vazio.
- Badge Brain Dump: oculto em zero/loading/erro; 1–9 literal e 9+ acima, contagem exata acessível.
- Seam legado A: aviso editorial persistente no início do conteúdo, sem dispensar ou toggle.
- Famílias Mineral, Horizonte Azul, Bosque Sálvia e Ameixa Editorial, cada uma com Light e Dark completos.
- Configurações com Claro/Escuro/Sistema; sem preview imediato; aplica depois de Salvar e persiste no banco por conta/todos os dispositivos.
- Falha de aparência preserva o draft e mantém o tema anterior aplicado.
- Configuração dos três atalhos sem duplicatas; desligamento voluntário de collection usada bloqueia Salvar até substituição.
- Remoção externa usa o primeiro destino canônico disponível ainda não usado; conta nova recebe os três primeiros disponíveis.
- Estados, acessibilidade, referências de revisão e journeys de aparência/navegação mobile.

## Não promovido / rejeitado

- Argila Solar.
- Ícone `house` para Hoje.
- Saúde como destino navegável ou superfície própria.
- Preferência de sidebar persistida no navegador ou banco.
- Captura integrada à topbar ou dock sobre o workspace.
- FAB estendido com label visual.
- Seam legado na topbar, contorno do conteúdo, toggle Legado/Moderno ou aviso dispensável.
- Drawer lateral e tela modal completa para o menu mobile.
- Foco inicial no botão Fechar.
- Badge com contagem exata acima de 9.
- Atalho de aparência no App Shell.
- Preview imediato de tema.
- Substituição automática durante o desligamento voluntário de collection.
- Remoção de Planner/Recorrentes na nav com zero collections.
- Achatamento de Métricas ou Medicamentos quando Saúde tem um único filho.
- Expansão automática de grupo recolhido que contém a rota ativa.

## Ideias qualitativas descartadas ou não vinculantes

- Glyphs provisórios dos mockups antigos e ícones MUI existentes como escolha visual.
- Argila Solar como quarta família nova.
- Layouts alternativos apresentados nas pranchas de captura, seam, topbar e menu; permanecem registro de exploração, não contrato.
- Textos, exemplos de conteúdo e proporções internas dos mocks que não estejam explicitamente nos spines.

## Conflitos reconciliados

- A nota antiga “tema escuro não é requisito” foi superada pela aprovação explícita de Light/Dark para quatro famílias.
- A fronteira antiga “Phosphor apenas para domínio; MUI para navegação e ações” foi superada por Phosphor em toda a plataforma; MUI permanece infraestrutura de comportamento.
- A leitura antiga de nav mínima como “somente núcleo BuJo” foi superada: Planner permanece completo e Recorrentes é destino-base.
- A prancha exploratória do menu enviava foco inicial a Fechar; a decisão posterior determina foco no destino ativo.

## Questões abertas

Nenhuma questão funcional bloqueadora foi encontrada no delta aprovado da Story 13.0. Os dois mocks foram promovidos após aprovação e validação.

## Índice das explorações da Story 13.0

| Prancha | Escolhida | Rejeitadas / disposição |
|---|---|---|
| [Famílias cromáticas](.working/color-themes-app-shell-13-0.html) | Mineral + Horizonte Azul + Bosque Sálvia + Ameixa Editorial, Light/Dark | Argila Solar |
| [Catálogo Phosphor](.working/icon-catalog-app-shell-13-0.html) | catálogo registrado no DESIGN; Hoje `calendar-dot` | `house` e glyphs provisórios |
| [Captura persistente](.working/directions-captura-app-shell-13-0.html) | A: ancorada na navegação; FAB circular mobile | topbar e dock |
| [Seam legado](.working/directions-seam-legado-app-shell-13-0.html) | A: aviso editorial persistente | topbar e contorno/contexto |
| [Topbar](.working/directions-topbar-app-shell-13-0.html) | B: superfície protagonista | marca fixa e breadcrumb/localizador |
| [Menu mobile](.working/directions-menu-mobile-app-shell-13-0.html) | A: sheet alto; foco posterior no destino ativo | drawer e tela completa; foco inicial em Fechar |
| [Key App Shell aprovado](mockups/key-app-shell-13-0.html) | aprovado por Hugo em 2026-07-24 | promovido |
| [Key Settings aprovado](mockups/key-settings-appearance-nav-13-0.html) | aprovado por Hugo em 2026-07-24 | promovido |

As alternativas rejeitadas permanecem apenas como histórico de decisão. DESIGN.md e EXPERIENCE.md vencem em qualquer conflito.
