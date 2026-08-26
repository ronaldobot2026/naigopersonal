import type { Invoice, NextInvoice } from '@/features/billing/domain/billing.types'

export type { Invoice, NextInvoice } from '@/features/billing/domain/billing.types'

/** Dados fictícios — faturamento ainda não integra um gateway de pagamento real. */
export const MOCK_NEXT_INVOICE: NextInvoice = {
  amount: 289.9,
  dueDateLabel: '15 de Outubro',
  daysLeft: 12,
  plan: 'Plano Premium Elite • Semestral com Acompanhamento Nutricional',
  cardLast4: '4492',
}

export const MOCK_INVOICE_HISTORY: Invoice[] = [
  { id: 'inv-set', monthLabel: 'Setembro', amount: 289.9, paidVia: 'Cartão', paidOn: '15/09' },
  { id: 'inv-ago', monthLabel: 'Agosto', amount: 289.9, paidVia: 'PIX', paidOn: '14/08' },
  { id: 'inv-jul', monthLabel: 'Julho', amount: 289.9, paidVia: 'Cartão', paidOn: '15/07' },
]
