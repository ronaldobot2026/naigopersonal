import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { PosturalPhotoUpload, type PhotoSlot } from '../components/PosturalPhotoUpload'

function emptySlots(): PhotoSlot[] {
  return [
    { view: 'front', status: 'empty' },
    { view: 'left_side', status: 'empty' },
    { view: 'right_side', status: 'empty' },
    { view: 'back', status: 'empty' },
  ]
}

function renderUpload(props: Partial<ComponentProps<typeof PosturalPhotoUpload>> = {}) {
  return render(
    <PosturalPhotoUpload
      slots={emptySlots()}
      modelStatus="ready"
      analyzingView={null}
      onSelectPhotos={() => {}}
      onSelectPhoto={() => {}}
      onUseCamera={() => {}}
      {...props}
    />,
  )
}

function file(name: string): File {
  return new File([name], `${name}.jpg`, { type: 'image/jpeg' })
}

describe('PosturalPhotoUpload', () => {
  it('mostra as quatro vistas do protocolo numa única tela', () => {
    renderUpload()

    expect(screen.getByText('Vista frontal')).toBeInTheDocument()
    expect(screen.getByText('Vista lateral esquerda')).toBeInTheDocument()
    expect(screen.getByText('Vista lateral direita')).toBeInTheDocument()
    expect(screen.getByText('Vista posterior')).toBeInTheDocument()
  })

  it('aceita as quatro fotos de uma vez pela galeria', async () => {
    const onSelectPhotos = vi.fn()
    renderUpload({ onSelectPhotos })
    const files = [file('1'), file('2'), file('3'), file('4')]

    await userEvent.upload(screen.getByLabelText(/selecionar as 4 fotos/i), files)

    expect(onSelectPhotos).toHaveBeenCalledWith(files)
  })

  it('permite escolher ou trocar a foto de uma vista específica', async () => {
    const onSelectPhoto = vi.fn()
    renderUpload({ onSelectPhoto })
    const photo = file('lateral')

    await userEvent.upload(screen.getByLabelText(/foto da vista lateral direita/i), photo)

    expect(onSelectPhoto).toHaveBeenCalledWith('right_side', photo)
  })

  it('mantém a câmera como opção por vista', async () => {
    const onUseCamera = vi.fn()
    renderUpload({ onUseCamera })

    await userEvent.click(screen.getByRole('button', { name: /câmera — vista posterior/i }))

    expect(onUseCamera).toHaveBeenCalledWith('back')
  })

  it('não tem botão para disparar a análise — ela começa sozinha', () => {
    renderUpload()

    expect(screen.queryByRole('button', { name: /analisar|ver achados/i })).not.toBeInTheDocument()
    expect(screen.getByText(/análise começa sozinha/i)).toBeInTheDocument()
  })

  it('mostra o progresso enquanto analisa e bloqueia novas escolhas', () => {
    const slots: PhotoSlot[] = emptySlots().map((slot) => ({ ...slot, status: 'selected' }))
    slots[0] = { view: 'front', status: 'done' }
    slots[1] = { view: 'left_side', status: 'analyzing' }
    renderUpload({ slots, analyzingView: 'left_side' })

    expect(screen.getByRole('status')).toHaveTextContent(/analisando vista lateral esquerda/i)
    expect(screen.getByRole('status')).toHaveTextContent(/1 de 4/i)
    expect(screen.getByLabelText(/selecionar as 4 fotos/i)).toBeDisabled()
  })

  it('explica por que uma foto foi recusada e pede outra', () => {
    const slots = emptySlots()
    slots[2] = {
      view: 'right_side',
      status: 'low_quality',
      messages: ['Corpo não aparece por inteiro no enquadramento.'],
    }
    renderUpload({ slots })

    expect(screen.getByText('Corpo não aparece por inteiro no enquadramento.')).toBeInTheDocument()
    expect(screen.getByText(/trocar foto/i)).toBeInTheDocument()
  })

  it('avisa quando o modelo de pose não carregou', () => {
    renderUpload({ modelStatus: 'error' })

    expect(screen.getByText(/não foi possível carregar o modelo de pose/i)).toBeInTheDocument()
  })
})
