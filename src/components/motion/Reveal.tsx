import { useEffect, useRef, useState, type ReactNode } from 'react'

type RevealProps = {
  children: ReactNode
  /** Atraso em ms, para escalonar itens de uma mesma lista. */
  delay?: number
  className?: string
}

/**
 * Revela o conteúdo quando ele entra na viewport: sobe alguns pixels e aparece.
 *
 * Escrito à mão em vez de instalar `gsap` — os componentes equivalentes do ReactBits
 * (`AnimatedContent`, `FadeContent`) exigem a biblioteca inteira, ~28 kB gzip, para um efeito
 * que cabe em um `IntersectionObserver` e duas propriedades de CSS. O projeto já tem `motion`
 * para o que precisa de mola; uma segunda biblioteca de animação não se paga aqui.
 *
 * Anima só `transform` e `opacity` (compositor), dispara uma única vez e respeita
 * `prefers-reduced-motion` — nesse caso o conteúdo já nasce visível, sem deslocamento.
 */
export function Reveal({ children, delay = 0, className = '' }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      setIsVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          setIsVisible(true)
          observer.disconnect()
        }
      },
      // Dispara um pouco antes de entrar de fato, para o movimento terminar já visível.
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-[opacity,transform] duration-500 ease-out-quint ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
      } ${className}`}
    >
      {children}
    </div>
  )
}
