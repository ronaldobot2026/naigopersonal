/**
 * Origem: ReactBits (`@react-bits/CountUp-TS-TW`), instalado via registry shadcn.
 *
 * Adaptações locais, nenhuma presente no original:
 * 1. **Locale.** O original formata sempre em `en-US`, o que renderiza "78.4" em vez de "78,4".
 *    Agora o locale é parâmetro, com pt-BR como padrão.
 * 2. **`prefers-reduced-motion`.** O original anima sempre. Aqui, quando o usuário pede menos
 *    movimento, o valor final aparece direto — sem contagem.
 * 3. **Uma contagem por valor, por sessão.** O original reanima em toda montagem. Como as abas
 *    do aluno desmontam a página, voltar para a Ficha fazia o número cair para zero e subir de
 *    novo (flicker, e número errado durante a contagem). Com `memoryKey`, a contagem roda na
 *    primeira vez e depois só quando o valor realmente muda — e, nesse caso, partindo do valor
 *    anterior, não do zero. A marca vive em memória do app (`countUpMemory`).
 * 4. **Valor final disponível desde o primeiro frame.** `data-countup-value` carrega sempre o
 *    valor final formatado, e enquanto a contagem roda o texto animado fica `aria-hidden` com um
 *    nó `sr-only` expondo o valor final. Leitor de tela e teste não precisam esperar a animação.
 */
import { useInView, useMotionValue, useReducedMotion, useSpring } from 'motion/react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { recallCountUpValue, rememberCountUpValue } from './countUpMemory'

interface CountUpProps {
  to: number
  from?: number
  direction?: 'up' | 'down'
  delay?: number
  duration?: number
  className?: string
  startWhen?: boolean
  separator?: string
  /** Locale usado na formatação. pt-BR usa vírgula como separador decimal. */
  locale?: string
  /**
   * Identidade da métrica (ex.: `"aluno.inicio.peso"`). Com ela, a contagem roda uma vez por
   * sessão para cada valor; sem ela, o componente anima em toda montagem (comportamento antigo).
   */
  memoryKey?: string
  onStart?: () => void
  onEnd?: () => void
}

type CountUpDecision = { id: string; animate: boolean; startAt: number }

function decide(
  id: string,
  target: number,
  origin: number,
  prefersReducedMotion: boolean | null,
  memoryKey?: string,
): CountUpDecision {
  const alreadyShown = memoryKey ? recallCountUpValue(memoryKey) : null
  return {
    id,
    animate: !prefersReducedMotion && alreadyShown !== target,
    // Valor de partida: o último já exibido (troca de valor) ou `from` (primeira vez).
    startAt: alreadyShown ?? origin,
  }
}

export default function CountUp({
  to,
  from = 0,
  direction = 'up',
  delay = 0,
  duration = 2,
  className = '',
  startWhen = true,
  separator = '',
  locale = 'pt-BR',
  memoryKey,
  onStart,
  onEnd,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const prefersReducedMotion = useReducedMotion()

  const target = direction === 'down' ? from : to
  const origin = direction === 'down' ? to : from

  /**
   * A decisão de animar é tomada uma vez por (valor, preferência de movimento) e guardada em
   * estado: ela consulta a memória de sessão, e a própria animação escreve nessa memória. Se
   * fosse recalculada em cada render, o registro feito ao iniciar a contagem a cortaria no meio.
   */
  const decisionId = `${target}|${prefersReducedMotion ? 'reduced' : 'full'}`
  const [decision, setDecision] = useState(() =>
    decide(decisionId, target, origin, prefersReducedMotion, memoryKey),
  )
  useEffect(() => {
    setDecision((current) =>
      current.id === decisionId
        ? current
        : decide(decisionId, target, origin, prefersReducedMotion, memoryKey),
    )
  }, [decisionId, memoryKey, origin, prefersReducedMotion, target])

  const { animate: shouldAnimate, startAt } = decision

  const [counting, setCounting] = useState(shouldAnimate)

  const motionValue = useMotionValue(shouldAnimate ? startAt : target)

  const damping = 20 + 40 * (1 / duration)
  const stiffness = 100 * (1 / duration)

  const springValue = useSpring(motionValue, {
    damping,
    stiffness,
  })

  const isInView = useInView(ref, { once: true, margin: '0px' })

  const callbacksRef = useRef({ onStart, onEnd })
  useEffect(() => {
    callbacksRef.current = { onStart, onEnd }
  }, [onStart, onEnd])

  const getDecimalPlaces = (num: number): number => {
    const str = num.toString()
    if (str.includes('.')) {
      const decimals = str.split('.')[1]
      if (parseInt(decimals) !== 0) {
        return decimals.length
      }
    }
    return 0
  }

  const maxDecimals = Math.max(getDecimalPlaces(from), getDecimalPlaces(to))

  const formatValue = useCallback(
    (latest: number) => {
      const hasDecimals = maxDecimals > 0

      const options: Intl.NumberFormatOptions = {
        useGrouping: !!separator,
        minimumFractionDigits: hasDecimals ? maxDecimals : 0,
        maximumFractionDigits: hasDecimals ? maxDecimals : 0,
      }

      const formattedNumber = Intl.NumberFormat(locale, options).format(latest)

      return separator ? formattedNumber.replace(/,/g, separator) : formattedNumber
    },
    [maxDecimals, separator, locale],
  )

  // Texto já no primeiro frame pintado: o valor final quando não há contagem, o ponto de partida
  // quando há.
  useLayoutEffect(() => {
    if (ref.current) {
      ref.current.textContent = formatValue(shouldAnimate ? startAt : target)
    }
  }, [formatValue, shouldAnimate, startAt, target])

  const playedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!startWhen) return

    if (!shouldAnimate) {
      // Sem contagem (valor já visto nesta sessão, ou `prefers-reduced-motion`): valor final direto.
      motionValue.jump(target)
      springValue.jump(target)
      if (ref.current) ref.current.textContent = formatValue(target)
      setCounting(false)
      if (memoryKey) rememberCountUpValue(memoryKey, target)
      return
    }

    if (!isInView) return
    if (playedRef.current === decisionId) return
    playedRef.current = decisionId

    // Parte do valor anterior (ou de `from`, na primeira vez), nunca do zero depois de uma troca.
    motionValue.jump(startAt)
    springValue.jump(startAt)
    setCounting(true)
    // A marca é escrita ao iniciar: quem sair da tela no meio da contagem volta ao valor final.
    if (memoryKey) rememberCountUpValue(memoryKey, target)
    callbacksRef.current.onStart?.()

    const startTimeoutId = setTimeout(() => {
      motionValue.set(target)
    }, delay * 1000)

    const endTimeoutId = setTimeout(
      () => {
        // O spring converge de forma assintótica: sem cravar o fim, o número parava em 78,3 em
        // vez de 78,4.
        springValue.jump(target)
        if (ref.current) ref.current.textContent = formatValue(target)
        setCounting(false)
        callbacksRef.current.onEnd?.()
      },
      delay * 1000 + duration * 1000,
    )

    return () => {
      clearTimeout(startTimeoutId)
      clearTimeout(endTimeoutId)
    }
  }, [
    decisionId,
    delay,
    duration,
    formatValue,
    isInView,
    memoryKey,
    motionValue,
    shouldAnimate,
    springValue,
    startAt,
    startWhen,
    target,
  ])

  useEffect(() => {
    const unsubscribe = springValue.on('change', (latest: number) => {
      if (ref.current) {
        ref.current.textContent = formatValue(latest)
      }
    })

    return () => unsubscribe()
  }, [springValue, formatValue])

  const finalText = formatValue(target)

  return (
    <span className={className} data-countup-value={finalText}>
      <span ref={ref} aria-hidden={counting ? true : undefined} />
      {counting && <span className="sr-only">{finalText}</span>}
    </span>
  )
}
