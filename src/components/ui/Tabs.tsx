/* eslint-disable react-refresh/only-export-components -- compound component (Tabs.List/Trigger/Panel) intencional, ver react/patterns.md */
import { createContext, useContext, useId, type ReactNode } from 'react'

interface TabsContextValue {
  value: string
  setValue: (value: string) => void
  idPrefix: string
}

const TabsContext = createContext<TabsContextValue | null>(null)

function useTabsContext(componentName: string): TabsContextValue {
  const context = useContext(TabsContext)
  if (!context) {
    throw new Error(`${componentName} deve ser usado dentro de <Tabs>.`)
  }
  return context
}

type TabsRootProps = {
  value: string
  onValueChange: (value: string) => void
  children: ReactNode
  className?: string
}

function TabsRoot({ value, onValueChange, children, className = '' }: TabsRootProps) {
  const idPrefix = useId()
  return (
    <TabsContext.Provider value={{ value, setValue: onValueChange, idPrefix }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

type TabsListProps = { children: ReactNode; className?: string }

function TabsList({ children, className = '' }: TabsListProps) {
  return (
    <div role="tablist" className={`flex gap-2 overflow-x-auto ${className}`}>
      {children}
    </div>
  )
}

type TabsTriggerProps = { value: string; children: ReactNode; disabled?: boolean }

function TabsTrigger({ value, children, disabled }: TabsTriggerProps) {
  const ctx = useTabsContext('Tabs.Trigger')
  const isActive = ctx.value === value
  return (
    <button
      type="button"
      role="tab"
      id={`${ctx.idPrefix}-tab-${value}`}
      aria-selected={isActive}
      aria-controls={`${ctx.idPrefix}-panel-${value}`}
      disabled={disabled}
      onClick={() => ctx.setValue(value)}
      className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-[background-color,color,box-shadow,transform] duration-200 ease-out-quint active:scale-[0.97] disabled:opacity-40 ${
        isActive
          ? 'bg-action-primary text-action-primary-foreground shadow-glass-sm'
          : 'glass text-text-secondary hover:text-text-primary'
      }`}
    >
      {children}
    </button>
  )
}

type TabsPanelProps = { value: string; children: ReactNode; className?: string }

function TabsPanel({ value, children, className = '' }: TabsPanelProps) {
  const ctx = useTabsContext('Tabs.Panel')
  if (ctx.value !== value) return null
  return (
    <div
      role="tabpanel"
      id={`${ctx.idPrefix}-panel-${value}`}
      aria-labelledby={`${ctx.idPrefix}-tab-${value}`}
      className={className}
    >
      {children}
    </div>
  )
}

export const Tabs = Object.assign(TabsRoot, {
  List: TabsList,
  Trigger: TabsTrigger,
  Panel: TabsPanel,
})
