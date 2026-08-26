import { useEffect, useRef, useState, type ReactNode } from 'react'

/** Caminho servido a partir de `public/` — não passa pelo bundler. */
const INTRO_SOURCE = '/intro-naigo.mp4'

/**
 * Teto absoluto de espera, em ms. O vídeo tem ~10 s; a margem cobre decodificação lenta e
 * conexões ruins. Existe só como rede de segurança: se `ended` nunca chegar (autoplay
 * bloqueado, arquivo corrompido, aba em segundo plano), o app entra assim mesmo em vez de
 * ficar preso numa tela preta para sempre.
 */
const WATCHDOG_MS = 15000

type IntroGateProps = {
  children: ReactNode
}

/**
 * Trava o app numa intro em vídeo até ela terminar, a cada carregamento da página.
 *
 * Decisões deliberadas, a pedido do produto:
 * - **Sem botão de avançar.** A intro é institucional e roda inteira.
 * - **Sem som.** `muted` não é só preferência: navegadores só liberam autoplay sem
 *   interação prévia quando o vídeo está mudo. O arquivo tem trilha de áudio, então a
 *   marcação é o que garante o silêncio.
 * - **Sem memória entre sessões.** Nada de `sessionStorage`: toda entrada mostra a intro.
 *
 * Os filhos só montam depois do fim. Renderizá-los atrás do vídeo faria as animações de
 * entrada (`Reveal` e afins) dispararem escondidas e a primeira tela aparecer já gasta.
 *
 * O enquadramento é `object-contain`, e não `object-cover`: o arquivo é vertical (720×1280) e
 * cobrir uma janela horizontal corta a arte ao meio — no desktop sobrava só a faixa de cima, com
 * o anel dourado do centro fora da tela. Contendo, o vídeo aparece inteiro e as laterais ficam na
 * cor de fundo.
 *
 * O `absolute inset-0` no vídeo não é decorativo. Com o pai centralizando por grid, o item não
 * era esticado, `h-full` não resolvia contra nada e a proporção intrínseca do arquivo esticava a
 * caixa para 1440×2560 numa janela de 900px de altura — `object-contain` não tinha o que conter e
 * o excedente saía da tela, com a mesma aparência de um corte. Ancorar nas quatro bordas prende a
 * caixa ao tamanho da janela.
 */
export function IntroGate({ children }: IntroGateProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasFinished, setHasFinished] = useState(false)

  useEffect(() => {
    if (hasFinished) return

    const watchdog = window.setTimeout(() => setHasFinished(true), WATCHDOG_MS)
    const video = videoRef.current

    // React aplica `muted` como propriedade e não emite o atributo no HTML. Parte dos
    // navegadores consulta o atributo ao decidir a política de autoplay, e sem ele o vídeo
    // é barrado — ou pior, toca com som. Reforçar os dois fecha as duas pontas.
    if (video) {
      video.muted = true
      video.setAttribute('muted', '')
    }

    // Alguns navegadores também ignoram `autoplay` quando o elemento entra via React.
    // A chamada explícita cobre esse caso; a rejeição (política de autoplay) libera o app.
    video?.play().catch(() => setHasFinished(true))

    return () => window.clearTimeout(watchdog)
  }, [hasFinished])

  if (hasFinished) return <>{children}</>

  return (
    <div className="fixed inset-0 z-50 bg-background" role="presentation" aria-hidden="true">
      <video
        ref={videoRef}
        src={INTRO_SOURCE}
        className="absolute inset-0 h-full w-full object-contain"
        autoPlay
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        onEnded={() => setHasFinished(true)}
        onError={() => setHasFinished(true)}
      />
    </div>
  )
}
