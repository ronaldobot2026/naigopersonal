import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { Biometrics } from '@/types/domain'
import { BiometricsStep } from '../components/steps/BiometricsStep'

const VAZIO: Biometrics = { weightKg: null, heightCm: null, bodyFatPercent: null, muscleMassKg: null }

describe('BiometricsStep', () => {
  it('propaga o peso digitado para o onChange', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<BiometricsStep value={VAZIO} onChange={onChange} />)

    await user.type(screen.getByLabelText(/peso/i), '80')

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ weightKg: 80 }))
    })
  })

  /**
   * Regressao: o wizard passa `onChange` inline, entao ela e uma funcao nova a cada
   * render. Quando estava no array de dependencias do efeito, salvar re-renderizava o
   * pai -> nova funcao -> efeito de novo -> loop infinito, e o dado nunca era gravado.
   */
  it('nao entra em loop quando o pai recria o onChange a cada render', async () => {
    const user = userEvent.setup()
    const chamadas = vi.fn()

    function Pai() {
      const [valor, setValor] = useState<Biometrics>(VAZIO)
      return (
        <BiometricsStep
          value={valor}
          onChange={(b) => {
            chamadas(b)
            setValor(b)
          }}
        />
      )
    }

    render(<Pai />)
    await user.type(screen.getByLabelText(/peso/i), '80')
    await new Promise((r) => setTimeout(r, 300))

    // Digitar "80" gera poucas chamadas ("8", depois "80"), nao dezenas.
    expect(chamadas.mock.calls.length).toBeGreaterThan(0)
    expect(chamadas.mock.calls.length).toBeLessThan(10)
    expect(chamadas).toHaveBeenLastCalledWith(expect.objectContaining({ weightKg: 80 }))
  })
})
