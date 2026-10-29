// Story 16.1 — deep link antigo `/habits/history` → aba Histórico da superfície
// única. A rota continua existindo no manifest de collections (o registro é a
// fonte das rotas E dos destinos de navegação); só o componente muda.
//
// `replace` para que o back do navegador não caia de volta no redirect.
import { Navigate } from 'react-router-dom'

export function HabitHistoryRedirect() {
  return <Navigate to="/habits?tab=historico" replace />
}
