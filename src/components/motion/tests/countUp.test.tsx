import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { MetricCard } from '@/components/ui/MetricCard'
import { resetCountUpMemory } from '../countUpMemory'

/**
 * Regressão do bug visto no vídeo de demo: o mesmo cartão "EVOLUÇÃO ATUAL" aparecia com 19,7 /
 * 66,7 / 74,4 / 78,4 kg porque a contagem recomeçava do zero a cada volta para a aba Ficha.
 */

/**
 * `useReducedMotion` do motion guarda a preferência num singleton inicializado uma única vez por
 * processo, então mexer em `window.matchMedia` entre testes não tem efeito. O hook é substituído
 * por uma leitura de flag.
 */
const reducedMotion = vi.hoisted(() => ({ value: false }))
vi.mock('motion/react', async () => {
  const actual = await vi.importActual<typeof import('motion/react')>('motion/react')
  return { ...actual, useReducedMotion: () => reducedMotion.value }
})

/** jsdom não implementa IntersectionObserver, que é o gatilho do `useInView`. */
function stubInView() {
  class ObserverStub {
    root = null
    rootMargin = ''
    thresholds: number[] = []
    #callback: IntersectionObserverCallback

    constructor(callback: IntersectionObserverCallback) {
      this.#callback = callback
    }

    observe(target: Element) {
      this.#callback(
        [{ isIntersecting: true, target } as unknown as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      )
    }
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return []
    }
  }
  vi.stubGlobal('IntersectionObserver', ObserverStub)
}

function stubReducedMotion(reduce: boolean) {
  reducedMotion.value = reduce
}

const animated = () => document.querySelector<HTMLElement>('[data-countup-value]')!

describe('MetricCard / CountUp', () => {
  beforeEach(() => {
    resetCountUpMemory()
    stubInView()
    stubReducedMotion(false)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    resetCountUpMemory()
  })

  it('expõe o valor final no primeiro frame, mesmo com a contagem rodando', () => {
    render(<MetricCard label="Peso" value={78.4} unit="kg" />)

    expect(animated()).toHaveAttribute('data-countup-value', '78,4')
    // O número que o leitor de tela recebe já é o final; o texto animado fica escondido da AT.
    expect(animated().textContent).toContain('78,4')
    expect(animated().firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })

  it('não reanima quando a tela é remontada com o mesmo valor', () => {
    const first = render(<MetricCard label="Peso" value={78.4} unit="kg" />)
    expect(animated().firstElementChild?.textContent).toBe('0,0')
    first.unmount()

    // Volta para a aba Ficha: sem contagem, valor final imediato, sem esperar 4s.
    render(<MetricCard label="Peso" value={78.4} unit="kg" />)
    expect(animated().firstElementChild?.textContent).toBe('78,4')
    expect(animated().firstElementChild).not.toHaveAttribute('aria-hidden')
    expect(animated().textContent).toBe('78,4')
  })

  it('anular a memória volta a animar (nova sessão do app)', () => {
    const first = render(<MetricCard label="Peso" value={78.4} unit="kg" />)
    first.unmount()
    resetCountUpMemory()

    render(<MetricCard label="Peso" value={78.4} unit="kg" />)
    expect(animated().firstElementChild?.textContent).toBe('0,0')
  })

  it('quando o valor muda, conta a partir do valor anterior e não do zero', () => {
    const view = render(<MetricCard label="Peso" value={78.4} unit="kg" />)
    act(() => {
      view.rerender(<MetricCard label="Peso" value={79.1} unit="kg" />)
    })

    expect(animated().firstElementChild?.textContent).toBe('78,4')
    expect(animated()).toHaveAttribute('data-countup-value', '79,1')
  })

  it('respeita prefers-reduced-motion: nenhuma contagem', () => {
    stubReducedMotion(true)
    render(<MetricCard label="Peso" value={78.4} unit="kg" />)

    expect(animated().firstElementChild?.textContent).toBe('78,4')
    expect(animated().firstElementChild).not.toHaveAttribute('aria-hidden')
  })

  it('a contagem inicial ainda roda e termina no valor final', async () => {
    render(<MetricCard label="Peso" value={78.4} unit="kg" />)
    expect(animated().firstElementChild?.textContent).toBe('0,0')

    await waitFor(
      () => {
        expect(animated().firstElementChild?.textContent).toBe('78,4')
        expect(animated().textContent).toBe('78,4')
      },
      { timeout: 4000 },
    )
  })

  it('métricas diferentes não compartilham a memória', () => {
    render(
      <>
        <MetricCard label="Peso" value={78.4} unit="kg" />
        <MetricCard label="Massa magra" value={78.4} unit="kg" />
      </>,
    )

    const cards = document.querySelectorAll<HTMLElement>('[data-countup-value]')
    expect(cards).toHaveLength(2)
    cards.forEach((card) => expect(card.firstElementChild?.textContent).toBe('0,0'))
  })
})
