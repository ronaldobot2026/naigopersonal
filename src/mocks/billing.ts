export interface Invoice {
  id: string
  monthLabel: string
  amount: number
  paidVia: string
  paidOn: string
}

/** Dados fictícios — faturamento ainda não integra um gateway de pagamento real. */
export const MOCK_NEXT_INVOICE = {
  amount: 289.9,
  dueDateLabel: '15 de Outubro',
  daysLeft: 12,
  plan: 'Premium • Semestral',
  cardLast4: '4492',
}

export const MOCK_INVOICE_HISTORY: Invoice[] = [
  { id: 'inv-set', monthLabel: 'Setembro', amount: 289.9, paidVia: 'Cartão', paidOn: '15/09' },
  { id: 'inv-ago', monthLabel: 'Agosto', amount: 289.9, paidVia: 'PIX', paidOn: '14/08' },
  { id: 'inv-jul', monthLabel: 'Julho', amount: 289.9, paidVia: 'Cartão', paidOn: '15/07' },
]
