import { useEffect, useState, type ReactNode } from 'react'
import type { Role } from '@/types/domain'
import { RoleContext } from './roleContext'

const STORAGE_KEY = 'windson-wood.role'

function readStoredRole(): Role {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'student' ? 'student' : 'trainer'
}

/**
 * Mecanismo provisório de troca de papel (sem autenticação real).
 * Persiste apenas a string do papel ativo — nunca dados de aluno ou credenciais.
 */
export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>(readStoredRole)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, role)
  }, [role])

  return <RoleContext.Provider value={{ role, setRole }}>{children}</RoleContext.Provider>
}
