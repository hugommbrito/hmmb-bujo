import { describe, it, expect } from 'vitest'

import {
  appShell,
  breakpoints,
  chip,
  colorModes,
  colorRoles,
  colorTokenName,
  completionBar,
  domainIcon,
  focusRing,
  habitTrackerRow,
  legacySeam,
  mediaQueries,
  mineralDark,
  mineralLight,
  futureBoard,
  monthlyBoard,
  monthlyPlanning,
  palettes,
  panel,
  pictogramPicker,
  radius,
  recordCards,
  resolvePalette,
  shellCssVariables,
  spacing,
  taskRow,
  typography,
  weeklyBoard,
  weeklyPlanning,
} from './tokens'

describe('tokens — estruturais do App Shell', () => {
  it('test_tokens_estruturais_do_app_shell_batem_com_o_design_md', () => {
    expect(appShell.sidebarExpanded).toBe('240px')
    expect(appShell.sidebarCollapsed).toBe('64px')
    expect(appShell.topbarHeight).toBe('56px')
    expect(appShell.workspaceMaxWidth).toBe('1440px')
    expect(appShell.readingWidth).toBe('800px')
    expect(appShell.gutterWide).toBe('32px')
    expect(appShell.gutterMedium).toBe('24px')
    expect(appShell.gutterCompact).toBe('16px')
    expect(appShell.touchTargetMin).toBe('44px')
    expect(appShell.bottomNavItems).toBe(4)
    expect(appShell.bottomNavConfigurableItems).toBe(3)
  })

  it('test_escala_de_espacamento_e_de_4px', () => {
    expect(spacing).toMatchObject({
      1: '4px',
      2: '8px',
      3: '12px',
      4: '16px',
      6: '24px',
      8: '32px',
    })
    for (const value of Object.values(spacing)) {
      expect(Number.parseInt(value, 10) % 4).toBe(0)
    }
  })

  it('test_raios_seguem_o_frontmatter_do_design_md', () => {
    expect(radius).toEqual({ xs: '2px', sm: '4px', md: '6px', lg: '8px', full: '9999px' })
  })

  it('test_focus_ring_2px_offset_2px_na_cor_focus', () => {
    expect(focusRing.width).toBe('2px')
    expect(focusRing.offset).toBe('2px')
    expect(mineralLight.focus).toBe('#166C9C')
  })

  it('test_faixas_responsivas_e_media_queries_derivadas', () => {
    expect(breakpoints).toEqual({ wideMin: 1440, mediumMin: 1024, tabletMin: 768, compactMax: 767 })
    // As strings precisam ser IDÊNTICAS às do AppLayout legado: os mocks de
    // matchMedia dos testes compartilhados casam por string exata.
    expect(mediaQueries.desktop).toBe('(min-width: 1024px)')
    expect(mediaQueries.tablet).toBe('(min-width: 768px) and (max-width: 1023px)')
    expect(mediaQueries.compact).toBe('(max-width: 767px)')
  })

  it('test_tokens_ainda_nao_aplicados_ja_estao_exportados_para_13_2_a_13_4', () => {
    // AC1: sidebar 240/64, badge, capture-action e mobile sheet são consumidos
    // pelas Stories 13.2–13.4, mas nascem aqui.
    expect(appShell.badge.minHeight).toBe('18px')
    expect(appShell.badge.radius).toBe(radius.full)
    expect(appShell.captureAction.icon).toBe('note-pencil')
    expect(appShell.captureAction.mobileSize).toBe('52px')
    expect(appShell.mobileNavigationSheet.form).toBe('high-sheet')
    expect(appShell.mobileNavigationSheet.radiusTop).toBe(radius.lg)
  })

  it('test_escala_tipografica_e_inter_com_as_seis_variantes_do_design_md', () => {
    expect(Object.keys(typography).sort()).toEqual(
      ['body', 'body-strong', 'label', 'meta', 'page-title', 'section-title'].sort(),
    )
    expect(typography['section-title'].fontSize).toBe('16px')
    expect(typography.meta.fontSize).toBe('12px')
    for (const variant of Object.values(typography)) {
      expect(variant.fontFamily).toBe('Inter')
    }
  })

  it('test_legacy_seam_usa_info_soft_info_e_borda_esquerda_3px', () => {
    expect(legacySeam.background).toBe('info-soft')
    expect(legacySeam.foreground).toBe('info')
    expect(legacySeam.borderLeftWidth).toBe('3px')
  })
})

describe('tokens — componentes do Épico 14 (Story 14.5)', () => {
  it('test_task_row_bate_com_o_design_md', () => {
    expect(taskRow.minHeightPointer).toBe('36px')
    expect(taskRow.minHeightTouch).toBe('48px')
    expect(taskRow.padding).toBe('8px 12px')
    expect(taskRow.radius).toBe(radius.sm)
    expect(taskRow.hover).toBe('surface-subtle')
    expect(taskRow.categoryBorderWidth).toBe('3px')
    expect(taskRow.categoryBorderFallback).toBe('border')
    expect(taskRow.description).toBe(typography.meta)
    expect(taskRow.statusIconSize).toBe('20px')
  })

  it('test_weekly_board_bate_com_o_design_md', () => {
    expect(weeklyBoard.gap).toBe('8px')
    expect(weeklyBoard.weekdayMinWidth).toBe('240px')
    expect(weeklyBoard.unscheduledMinWidth).toBe('235px')
    expect(weeklyBoard.dayScroll).toBe('internal')
    expect(weeklyBoard.terminalOpacity).toBe(0.58)
  })

  it('test_weekly_planning_bate_com_o_design_md', () => {
    expect(weeklyPlanning.sourceRail).toBe('190px')
    expect(weeklyPlanning.contextRail).toBe('315px')
    expect(weeklyPlanning.densityPosition).toBe('sticky')
  })

  it('test_monthly_board_bate_com_o_design_md', () => {
    expect(monthlyBoard.columns).toBe(7)
    expect(monthlyBoard.gap).toBe(spacing[2])
    expect(monthlyBoard.undatedWidth).toBe('268px')
    expect(monthlyBoard.dayScroll).toBe('internal')
    expect(monthlyBoard.terminalOpacity).toBe(0.58)
    // Não documentado no DESIGN.md — piso de altura por linha adicionado para
    // corrigir um achado real do axe (`target-size`), Story 14.6.
    expect(monthlyBoard.minCellHeight).toBe('140px')
  })

  it('test_monthly_planning_bate_com_o_design_md', () => {
    expect(monthlyPlanning.sourceRail).toBe('188px')
    expect(monthlyPlanning.contextRail).toBe('310px')
    expect(monthlyPlanning.densityPosition).toBe('sticky')
  })

  it('test_future_board_bate_com_o_design_md', () => {
    expect(futureBoard.trailWidth).toBe('230px')
    expect(futureBoard.horizonMonths).toBe(8)
    expect(futureBoard.focusScroll).toBe('internal')
    expect(futureBoard.terminalOpacity).toBe(0.58)
  })

  it('test_panel_bate_com_o_design_md', () => {
    expect(panel.background).toBe('surface')
    expect(panel.borderWidth).toBe('1px')
    expect(panel.borderColor).toBe('border')
    expect(panel.radius).toBe(radius.md)
    expect(panel.padding).toBe(spacing[4])
  })

  it('test_chip_bate_com_o_design_md', () => {
    expect(chip.height).toBe('24px')
    expect(chip.radius).toBe(radius.sm)
    expect(chip.typography).toBe(typography.label)
  })

  it('test_domain_icon_bate_com_o_design_md', () => {
    expect(domainIcon.library).toBe('@phosphor-icons/react')
    expect(domainIcon.weight).toBe('regular')
    expect(domainIcon.sizeCompact).toBe('18px')
    expect(domainIcon.sizeDefault).toBe('20px')
    expect(domainIcon.color).toBe('currentColor')
  })

  it('test_domain_icon_emite_as_duas_medidas_em_shellCssVariables', () => {
    // Primeiro consumidor CSS é a coluna (vazia) do pictograma da Habit
    // Tracker Row (Story 16.1) — antes disso `domainIcon` era só dado puro.
    const vars = shellCssVariables('light')
    expect(vars['--ds-domain-icon-size-default']).toBe(domainIcon.sizeDefault)
    expect(vars['--ds-domain-icon-size-compact']).toBe(domainIcon.sizeCompact)
  })

  it('test_cada_token_de_componente_novo_aparece_em_shellCssVariables', () => {
    const vars = shellCssVariables('light')
    expect(vars['--ds-task-row-min-height-pointer']).toBe(taskRow.minHeightPointer)
    expect(vars['--ds-task-row-min-height-touch']).toBe(taskRow.minHeightTouch)
    expect(vars['--ds-task-row-category-border-width']).toBe(taskRow.categoryBorderWidth)
    expect(vars['--ds-task-row-status-icon-size']).toBe(taskRow.statusIconSize)
    expect(vars['--ds-task-row-terminal-opacity']).toBe(String(weeklyBoard.terminalOpacity))
    expect(vars['--ds-weekly-board-gap']).toBe(weeklyBoard.gap)
    expect(vars['--ds-weekly-board-weekday-min-width']).toBe(weeklyBoard.weekdayMinWidth)
    expect(vars['--ds-weekly-board-unscheduled-min-width']).toBe(weeklyBoard.unscheduledMinWidth)
    expect(vars['--ds-weekly-planning-source-rail']).toBe(weeklyPlanning.sourceRail)
    expect(vars['--ds-weekly-planning-context-rail']).toBe(weeklyPlanning.contextRail)
    expect(vars['--ds-panel-padding']).toBe(panel.padding)
    expect(vars['--ds-chip-height']).toBe(chip.height)
  })

  it('test_cada_token_de_monthly_board_planning_aparece_em_shellCssVariables', () => {
    const vars = shellCssVariables('light')
    expect(vars['--ds-monthly-board-columns']).toBe(String(monthlyBoard.columns))
    expect(vars['--ds-monthly-board-gap']).toBe(monthlyBoard.gap)
    expect(vars['--ds-monthly-board-undated-width']).toBe(monthlyBoard.undatedWidth)
    expect(vars['--ds-monthly-board-min-cell-height']).toBe(monthlyBoard.minCellHeight)
    expect(vars['--ds-monthly-planning-source-rail']).toBe(monthlyPlanning.sourceRail)
    expect(vars['--ds-monthly-planning-context-rail']).toBe(monthlyPlanning.contextRail)
    // day-scroll/density-position/terminal-opacity REUSAM as vars já emitidas
    // pela 14.5 — não há `--ds-monthly-board-day-scroll` própria.
    expect(vars['--ds-task-row-terminal-opacity']).toBe(String(monthlyBoard.terminalOpacity))
  })

  it('test_future_board_emite_so_a_trail_width_em_shellCssVariables', () => {
    const vars = shellCssVariables('light')
    expect(vars['--ds-future-board-trail-width']).toBe(futureBoard.trailWidth)
    // `horizonMonths`/`focusScroll` são DADOS PUROS (AC8): não são estilo, então
    // não viram CSS var — quem consome o 8 é lógica TS, não o CSS.
    expect(vars['--ds-future-board-horizon-months']).toBeUndefined()
    expect(vars['--ds-future-board-focus-scroll']).toBeUndefined()
    // `terminalOpacity` REUSA a var da Task Row (compartilhada por design entre
    // Weekly/Monthly/Future) — nenhuma var própria do future-board.
    expect(vars['--ds-future-board-terminal-opacity']).toBeUndefined()
    expect(vars['--ds-task-row-terminal-opacity']).toBe(String(futureBoard.terminalOpacity))
  })
})

describe('tokens — componentes do Épico 16 (Story 16.1, gate 16.0)', () => {
  it('test_record_cards_bate_com_o_design_md', () => {
    expect(recordCards.maxWidth).toBe('1120px')
    expect(recordCards.columnsWide).toBe(2)
    expect(recordCards.cardMinWidth).toBe('520px')
    expect(recordCards.gap).toBe(spacing[4])
    // A variante ROMPE deliberadamente a largura de leitura (DESIGN.md L708):
    // se um dia empatarem, a variante perdeu o sentido.
    expect(recordCards.maxWidth).not.toBe(appShell.readingWidth)
  })

  it('test_completion_bar_bate_com_o_design_md', () => {
    expect(completionBar.heightDay).toBe('8px')
    expect(completionBar.heightGroup).toBe('6px')
    expect(completionBar.track).toBe('surface-subtle')
    expect(completionBar.trackBorderWidth).toBe('1px')
    expect(completionBar.trackBorderColor).toBe('border')
    expect(completionBar.fill).toBe('primary')
    expect(completionBar.radius).toBe(radius.xs)
    // `track`/`fill`/`trackBorderColor` são PAPÉIS de cor, não valores crus.
    expect(colorRoles).toContain(completionBar.track)
    expect(colorRoles).toContain(completionBar.fill)
    expect(colorRoles).toContain(completionBar.trackBorderColor)
  })

  it('test_habit_tracker_row_bate_com_o_design_md', () => {
    expect(habitTrackerRow.controlColumn).toBe('44px')
    expect(habitTrackerRow.numericFieldWidth).toBe('104px')
    expect(habitTrackerRow.categoryBorder).toBe('none')
    expect(habitTrackerRow.terminalOpacity).toBe(0.58)
    // Mede igual à Task Row (DESIGN.md L710) — as alturas NÃO são próprias.
    expect(taskRow.minHeightPointer).toBe('36px')
    expect(taskRow.minHeightTouch).toBe('48px')
  })

  it('test_pictogram_picker_bate_com_o_design_md', () => {
    expect(pictogramPicker.columnsDialog).toBe(6)
    expect(pictogramPicker.columnsSheet).toBe(4)
    // ALIAS do alvo de toque mínimo, não medida própria.
    expect(pictogramPicker.tileMinSize).toBe(appShell.touchTargetMin)
  })

  it('test_cada_medida_de_geometria_da_16_1_aparece_em_shellCssVariables', () => {
    const vars = shellCssVariables('light')
    expect(vars['--ds-record-cards-max-width']).toBe(recordCards.maxWidth)
    expect(vars['--ds-record-cards-columns-wide']).toBe(String(recordCards.columnsWide))
    expect(vars['--ds-record-cards-card-min-width']).toBe(recordCards.cardMinWidth)
    expect(vars['--ds-record-cards-gap']).toBe(recordCards.gap)
    expect(vars['--ds-completion-bar-height-day']).toBe(completionBar.heightDay)
    expect(vars['--ds-completion-bar-height-group']).toBe(completionBar.heightGroup)
    expect(vars['--ds-completion-bar-track-border-width']).toBe(completionBar.trackBorderWidth)
    expect(vars['--ds-habit-tracker-row-control-column']).toBe(habitTrackerRow.controlColumn)
    expect(vars['--ds-habit-tracker-row-numeric-field-width']).toBe(
      habitTrackerRow.numericFieldWidth,
    )
    expect(vars['--ds-pictogram-picker-columns-dialog']).toBe(
      String(pictogramPicker.columnsDialog),
    )
    expect(vars['--ds-pictogram-picker-columns-sheet']).toBe(String(pictogramPicker.columnsSheet))
  })

  it('test_o_que_reusa_var_existente_nao_ganha_var_propria', () => {
    const vars = shellCssVariables('light')
    // Raio da barra = `--ds-radius-xs`; papéis de cor = `--ds-<papel>`.
    expect(vars['--ds-completion-bar-radius']).toBeUndefined()
    expect(vars['--ds-completion-bar-track']).toBeUndefined()
    expect(vars['--ds-completion-bar-fill']).toBeUndefined()
    expect(vars['--ds-radius-xs']).toBe(completionBar.radius)
    expect(vars[`--ds-${completionBar.track}`]).toBe(mineralLight['surface-subtle'])
    expect(vars[`--ds-${completionBar.fill}`]).toBe(mineralLight.primary)
    // Opacidade terminal compartilhada com Weekly/Monthly/Future.
    expect(vars['--ds-habit-tracker-row-terminal-opacity']).toBeUndefined()
    expect(vars['--ds-task-row-terminal-opacity']).toBe(String(habitTrackerRow.terminalOpacity))
    // `categoryBorder: 'none'` é dado puro (decisão), não medida.
    expect(vars['--ds-habit-tracker-row-category-border']).toBeUndefined()
    // Tile do seletor = alvo de toque mínimo.
    expect(vars['--ds-pictogram-picker-tile-min-size']).toBeUndefined()
    expect(vars['--ds-touch-target-min']).toBe(pictogramPicker.tileMinSize)
  })
})

describe('tokens — papéis semânticos de cor', () => {
  it('test_mineral_light_traz_os_papeis_canonicos_do_frontmatter', () => {
    expect(mineralLight.canvas).toBe('#F5F2EA')
    expect(mineralLight.surface).toBe('#FBFAF6')
    expect(mineralLight['surface-subtle']).toBe('#EEEBE2')
    expect(mineralLight['surface-strong']).toBe('#E3DFD5')
    expect(mineralLight.ink).toBe('#25231F')
    expect(mineralLight['ink-muted']).toBe('#666159')
    expect(mineralLight['ink-disabled']).toBe('#969087')
    expect(mineralLight.border).toBe('#D6D1C7')
    expect(mineralLight['border-strong']).toBe('#AAA399')
    expect(mineralLight['control-border']).toBe('#666159')
    expect(mineralLight.primary).toBe('#315F5A')
    expect(mineralLight['primary-hover']).toBe('#274D49')
    expect(mineralLight['primary-soft']).toBe('#DDEAE7')
    expect(mineralLight['on-primary']).toBe('#FFFFFF')
    expect(mineralLight.info).toBe('#3D6488')
    expect(mineralLight['info-soft']).toBe('#E2EBF3')
    expect(mineralLight.overlay).toBe('#25231F7A')
  })

  it('test_mineral_dark_traz_a_coluna_mineral_dark_do_frontmatter', () => {
    expect(mineralDark.canvas).toBe('#151613')
    expect(mineralDark.surface).toBe('#1D1F1B')
    expect(mineralDark.ink).toBe('#F2F0E9')
    expect(mineralDark.primary).toBe('#72B7AE')
    expect(mineralDark.info).toBe('#8DB9DE')
    expect(mineralDark['info-soft']).toBe('#223747')
    expect(mineralDark.focus).toBe('#65BCE8')
    expect(mineralDark.overlay).toBe('#000000A3')
  })

  it('test_as_duas_paletas_cobrem_exatamente_os_mesmos_papeis', () => {
    expect(Object.keys(mineralLight).sort()).toEqual([...colorRoles].sort())
    expect(Object.keys(mineralDark).sort()).toEqual([...colorRoles].sort())
  })

  it('test_forma_familia_modo_papel_com_mineral_light_como_alias_sem_prefixo', () => {
    expect(colorTokenName('mineral', 'light', 'canvas')).toBe('canvas')
    expect(colorTokenName('mineral', 'dark', 'canvas')).toBe('mineral-dark-canvas')
    expect(colorTokenName('horizonte', 'light', 'primary')).toBe('horizonte-light-primary')
    expect(colorTokenName('ameixa', 'dark', 'ink')).toBe('ameixa-dark-ink')
  })

  it('test_somente_mineral_esta_wirado_nesta_story', () => {
    expect(Object.keys(palettes).sort()).toEqual(['mineral-dark', 'mineral-light'])
    expect(resolvePalette('mineral', 'light')).toBe(mineralLight)
    expect(resolvePalette('mineral', 'dark')).toBe(mineralDark)
    for (const mode of colorModes) {
      expect(() => resolvePalette('horizonte', mode)).toThrow(/18\.1/)
    }
  })
})

describe('tokens — CSS custom properties do shell', () => {
  it('test_todas_as_variaveis_usam_o_prefixo_ds', () => {
    const vars = shellCssVariables('light')
    expect(Object.keys(vars).length).toBeGreaterThan(0)
    for (const name of Object.keys(vars)) {
      expect(name.startsWith('--ds-')).toBe(true)
    }
  })

  it('test_variaveis_estruturais_e_de_cor_do_modo_pedido', () => {
    const light = shellCssVariables('light')
    expect(light['--ds-topbar-height']).toBe('56px')
    expect(light['--ds-workspace-max-width']).toBe('1440px')
    expect(light['--ds-gutter-wide']).toBe('32px')
    expect(light['--ds-gutter-medium']).toBe('24px')
    expect(light['--ds-gutter-compact']).toBe('16px')
    expect(light['--ds-canvas']).toBe(mineralLight.canvas)
    expect(light['--ds-info-soft']).toBe(mineralLight['info-soft'])

    const dark = shellCssVariables('dark')
    expect(dark['--ds-canvas']).toBe(mineralDark.canvas)
    expect(dark['--ds-topbar-height']).toBe(light['--ds-topbar-height'])
  })

  it('test_todo_papel_semantico_vira_uma_variavel_ds', () => {
    const vars = shellCssVariables('light')
    for (const role of colorRoles) {
      expect(vars[`--ds-${role}`]).toBe(mineralLight[role])
    }
  })
})
