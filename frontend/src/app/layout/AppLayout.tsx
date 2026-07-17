import { useState, useEffect } from 'react'
import { Box, useMediaQuery } from '@mui/material'
import { Outlet, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { RouteAnnouncer } from './RouteAnnouncer'

export function AppLayout() {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)')
  const isMobile = useMediaQuery('(max-width: 767px)')

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const navigate = useNavigate()

  // Tablet: sidebar começa colapsada
  useEffect(() => {
    if (isTablet) {
      setSidebarCollapsed(true)
    }
  }, [isTablet])

  // Atalho [ para toggle da sidebar / B para o Brain Dump — ambos globais,
  // só no desktop
  useEffect(() => {
    if (!isDesktop) return

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      const isEditable =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      if (isEditable) return

      if (event.key === '[') {
        setSidebarCollapsed((prev) => !prev)
      } else if (event.key === 'b' || event.key === 'B') {
        // Sem o guard de ctrlKey/metaKey/altKey, Cmd+B/Ctrl+B (atalhos
        // nativos do navegador/OS em algumas plataformas) seriam
        // sequestrados — mesmo cuidado do atalho `N` em DailyPage.tsx.
        if (event.ctrlKey || event.metaKey || event.altKey) return
        navigate('/brain-dump')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDesktop, navigate])

  if (isMobile) {
    return (
      <Box>
        <RouteAnnouncer />
        <Box sx={{ pb: 'calc(56px + env(safe-area-inset-bottom, 0px) + 8px)' }}>
          <Outlet />
        </Box>
        <BottomNav />
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex' }}>
      <RouteAnnouncer />
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((prev) => !prev)}
      />
      <Box sx={{ flexGrow: 1, minWidth: 0, overflow: 'auto' }}>
        <Outlet />
      </Box>
    </Box>
  )
}
