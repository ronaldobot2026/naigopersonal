import { RouterProvider } from 'react-router-dom'
import { RoleProvider } from './app/providers/RoleProvider'
import { router } from './app/router/router'

export function App() {
  return (
    <RoleProvider>
      <RouterProvider router={router} />
    </RoleProvider>
  )
}
