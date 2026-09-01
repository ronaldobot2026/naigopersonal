import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

/**
 * O auto-cleanup do testing-library só se registra sozinho quando o vitest roda com
 * `globals: true`, que não é o caso aqui. Sem isto, o DOM de um teste sobrevive para o
 * seguinte e as queries passam a encontrar elementos duplicados.
 */
afterEach(cleanup)
