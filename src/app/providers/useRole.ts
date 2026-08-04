import { useContext } from 'react'
import { RoleContext, type RoleContextValue } from './roleContext'

export function useRole(): RoleContextValue {
  const context = useContext(RoleContext)
  if (!context) {
    throw new Error('useRole deve ser usado dentro de <RoleProvider>.')
  }
  return context
}
