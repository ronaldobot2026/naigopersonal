import { createContext } from 'react'
import type { Role } from '@/types/domain'

export interface RoleContextValue {
  role: Role
  setRole: (role: Role) => void
}

export const RoleContext = createContext<RoleContextValue | null>(null)
