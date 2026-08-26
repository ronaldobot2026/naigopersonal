export interface Invoice {
  id: string
  monthLabel: string
  amount: number
  paidVia: string
  paidOn: string
}

export interface NextInvoice {
  amount: number
  dueDateLabel: string
  daysLeft: number
  plan: string
  cardLast4: string
}
