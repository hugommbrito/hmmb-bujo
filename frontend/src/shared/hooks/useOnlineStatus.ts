import { useEffect, useState } from 'react'

// Wrapper fino sobre a Web API nativa (navigator.onLine + eventos
// online/offline) — sem lib nova. Não é suporte offline (arquitetura §Technical
// Constraints: "Sem offline no MVP"), só detecção de conectividade para
// desabilitar o FAB (AC #3/UX-DR15).
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true)
    }
    function handleOffline() {
      setIsOnline(false)
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}
