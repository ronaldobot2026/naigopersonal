import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react'

interface PointerSpotlight {
  ref: React.RefObject<HTMLDivElement | null>
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void
}

/**
 * Realce que acompanha o ponteiro sobre uma superfície.
 *
 * As coordenadas são escritas direto em `--spot-x` / `--spot-y` no elemento, e a
 * utility `.spotlight` (globals.css) desenha o degradê a partir delas. Escrever em
 * custom property em vez de estado do React é deliberado: `pointermove` dispara
 * dezenas de vezes por segundo e um `setState` por evento re-renderizaria a árvore
 * inteira a cada movimento do mouse.
 *
 * A escrita é agendada em `requestAnimationFrame` para no máximo uma por quadro,
 * e ignorada em ponteiros grosseiros (toque), onde não existe hover.
 */
export function usePointerSpotlight(): PointerSpotlight {
  const ref = useRef<HTMLDivElement | null>(null)
  const frameRef = useRef<number | null>(null)

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse') return

    const element = ref.current
    if (!element) return

    const bounds = element.getBoundingClientRect()
    const x = ((event.clientX - bounds.left) / bounds.width) * 100
    const y = ((event.clientY - bounds.top) / bounds.height) * 100

    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(() => {
      element.style.setProperty('--spot-x', `${x}%`)
      element.style.setProperty('--spot-y', `${y}%`)
      frameRef.current = null
    })
  }, [])

  return { ref, onPointerMove }
}
