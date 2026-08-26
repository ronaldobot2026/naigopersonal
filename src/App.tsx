import { RouterProvider } from 'react-router-dom'
import { IntroGate } from './components/motion/IntroGate'
import { RoleProvider } from './app/providers/RoleProvider'
import { router } from './app/router/router'

export function App() {
  return (
    <IntroGate>
      <RoleProvider>
        <RouterProvider router={router} />
      </RoleProvider>
    </IntroGate>
  )
}
