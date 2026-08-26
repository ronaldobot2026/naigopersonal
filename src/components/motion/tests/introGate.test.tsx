import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { IntroGate } from '../IntroGate'

/**
 * jsdom não implementa reprodução de mídia: `HTMLMediaElement.play` lança
 * "Not implemented". O stub devolve uma promessa resolvida, que é o caminho feliz
 * (autoplay liberado); os testes que precisam do caminho de rejeição sobrescrevem.
 */
function stubPlayback(result: Promise<void>) {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockReturnValue(result)
}

function renderIntro() {
  return render(
    <IntroGate>
      <p>conteúdo do app</p>
    </IntroGate>,
  )
}

const appContent = () => screen.queryByText('conteúdo do app')
const introVideo = () => document.querySelector('video')

describe('IntroGate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    stubPlayback(Promise.resolve())
  })

  afterEach(() => {
    // O projeto não usa `globals: true` no Vitest, então a limpeza automática da
    // Testing Library nunca se registra e o DOM vaza de um teste para o outro.
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('segura o app enquanto a intro roda', () => {
    renderIntro()

    expect(introVideo()).toBeInTheDocument()
    expect(appContent()).not.toBeInTheDocument()
  })

  it('reproduz sem som, já que o arquivo tem trilha de áudio', () => {
    renderIntro()

    // Propriedade e atributo: navegadores divergem sobre qual consultam na política
    // de autoplay, e o componente força os dois.
    expect(introVideo()).toHaveProperty('muted', true)
    expect(introVideo()).toHaveAttribute('muted')
  })

  it('não oferece nenhum controle de avançar ou pular', () => {
    renderIntro()

    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(introVideo()).not.toHaveAttribute('controls')
  })

  it('libera o app quando o vídeo chega ao fim', () => {
    renderIntro()

    fireEvent.ended(introVideo() as HTMLVideoElement)

    expect(appContent()).toBeInTheDocument()
    expect(introVideo()).not.toBeInTheDocument()
  })

  it('libera o app quando o vídeo falha ao carregar', () => {
    renderIntro()

    fireEvent.error(introVideo() as HTMLVideoElement)

    expect(appContent()).toBeInTheDocument()
  })

  it('libera o app quando o navegador bloqueia o autoplay', async () => {
    stubPlayback(Promise.reject(new Error('NotAllowedError')))
    renderIntro()

    await vi.waitFor(() => expect(appContent()).toBeInTheDocument())
  })

  it('libera o app pelo watchdog se o fim nunca for sinalizado', () => {
    renderIntro()

    expect(appContent()).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(15000))

    expect(appContent()).toBeInTheDocument()
  })

  it('mostra a intro em toda montagem, sem lembrar de sessões anteriores', () => {
    const first = renderIntro()
    fireEvent.ended(introVideo() as HTMLVideoElement)
    expect(appContent()).toBeInTheDocument()
    first.unmount()

    renderIntro()

    expect(introVideo()).toBeInTheDocument()
    expect(appContent()).not.toBeInTheDocument()
  })
})
