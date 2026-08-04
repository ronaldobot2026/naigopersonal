import type { SilhouetteGuide as SilhouetteGuideKind } from '../domain/posturalViews'

type SilhouetteGuideProps = {
  kind: SilhouetteGuideKind
}

/** Contorno de corpo inteiro visto de frente/costas: cabeça, tronco, braços e pernas. */
const FACING_PATH =
  'M50 15 a12 12 0 1 0 0.01 0 M30 45 q20 -10 40 0 l-5 55 q-15 8 -30 0 z M25 55 l-10 40 M75 55 l10 40 M35 100 l-4 40 M65 100 l4 40'

/** Contorno de perfil: cabeça, linha das costas, braço à frente e pernas sobrepostas. */
const PROFILE_PATH =
  'M52 15 a12 12 0 1 0 0.01 0 M44 45 q12 -8 18 2 l-2 53 q-10 6 -18 0 z M58 55 l4 40 M48 100 l-3 40 M54 100 l3 40'

/** Linha de prumo vertical, exibida apenas nas vistas laterais. */
const PLUMB_LINE = { x: 50, top: 8, bottom: 148 }

export function SilhouetteGuide({ kind }: SilhouetteGuideProps) {
  return (
    <svg
      viewBox="0 0 100 150"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-40"
      aria-hidden="true"
    >
      {kind === 'profile' && (
        <line
          x1={PLUMB_LINE.x}
          y1={PLUMB_LINE.top}
          x2={PLUMB_LINE.x}
          y2={PLUMB_LINE.bottom}
          stroke="white"
          strokeWidth="0.75"
          strokeDasharray="4 3"
        />
      )}
      <path
        d={kind === 'profile' ? PROFILE_PATH : FACING_PATH}
        fill="none"
        stroke="white"
        strokeWidth="1.5"
      />
    </svg>
  )
}
