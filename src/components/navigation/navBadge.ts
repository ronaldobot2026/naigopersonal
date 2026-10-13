/** Rótulo do contador de não lidas na navegação. Acima de 99 vira "99+" para não deformar o item. */
export function formatBadgeCount(count: number): string {
  return count > 99 ? '99+' : String(count)
}
