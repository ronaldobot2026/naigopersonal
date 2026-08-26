import { MOCK_INVOICE_HISTORY, MOCK_NEXT_INVOICE } from '@/mocks/billing'
import type { Invoice, NextInvoice } from '../domain/billing.types'

/**
 * Fonte de dados de faturas do aluno. Hoje devolve o fixture de `@/mocks/billing`; cutover para
 * gateway de pagamento real (PIX/cartão, webhook) é a Fase 17 do roadmap.
 */
export const billingRepository = {
  async getNextInvoice(): Promise<NextInvoice> {
    return MOCK_NEXT_INVOICE
  },

  async getInvoiceHistory(): Promise<Invoice[]> {
    return MOCK_INVOICE_HISTORY
  },
}
