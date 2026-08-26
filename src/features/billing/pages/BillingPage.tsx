import { ErrorState } from '@/components/feedback/ErrorState'
import { LoadingState } from '@/components/feedback/LoadingState'
import { PageHeader } from '@/components/navigation/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { useAsyncData } from '@/hooks/useAsyncData'
import { billingRepository } from '../repositories/billingRepository'

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function BillingPage() {
  const {
    status: nextInvoiceStatus,
    data: nextInvoice,
    errorMessage: nextInvoiceError,
  } = useAsyncData(() => billingRepository.getNextInvoice(), [])
  const { status: historyStatus, data: history, errorMessage: historyError } = useAsyncData(
    () => billingRepository.getInvoiceHistory(),
    [],
  )

  if (nextInvoiceStatus === 'loading' || historyStatus === 'loading') {
    return <LoadingState label="Carregando dados financeiros…" />
  }

  if (nextInvoiceStatus === 'error' || historyStatus === 'error' || !nextInvoice || !history) {
    return (
      <ErrorState
        title="Não foi possível carregar seus dados financeiros"
        description={nextInvoiceError ?? historyError ?? 'Verifique sua conexão e recarregue a página.'}
      />
    )
  }

  return (
    <div className="mx-auto max-w-container-max px-margin-mobile py-8 md:px-margin-desktop">
      <PageHeader title="Financeiro" description="Faturas, meios de pagamento e histórico." />

      <Card tone="elevated" className="mb-gutter flex flex-col gap-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-xs uppercase text-text-secondary">Próxima fatura</p>
            <h2 className="font-display text-4xl font-extrabold text-action-primary">
              {formatCurrency(nextInvoice.amount)}
            </h2>
          </div>
          <Badge tone="warning">Vence em {nextInvoice.daysLeft} dias</Badge>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-text-secondary">Vencimento</span>
            <span className="font-semibold text-text-primary">{nextInvoice.dueDateLabel}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Plano</span>
            <span className="font-semibold text-text-primary">{nextInvoice.plan}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Button>
            <Icon name="qr_code_2" filled />
            Pagar com PIX
          </Button>
          <Button variant="secondary">
            <Icon name="credit_card" />
            Cartão de crédito
          </Button>
        </div>
      </Card>

      <div className="mb-gutter grid grid-cols-1 gap-gutter md:grid-cols-2">
        <Card className="flex h-40 flex-col justify-between">
          <div className="flex items-start justify-between">
            <Icon name="contactless" className="text-3xl text-action-primary" />
            <span className="font-mono text-xs text-text-secondary">PADRÃO</span>
          </div>
          <div>
            <p className="font-mono text-action-primary">
              •••• •••• •••• {nextInvoice.cardLast4}
            </p>
          </div>
        </Card>
        <Card className="flex flex-col items-center justify-center gap-2 text-center">
          <Icon name="verified_user" className="text-3xl text-action-primary" />
          <h3 className="font-bold text-text-primary">Débito Automático Ativo</h3>
          <p className="text-sm text-text-secondary">
            Suas faturas são processadas com segurança todo dia 15.
          </p>
        </Card>
      </div>

      <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-text-secondary">
        Histórico de pagamentos
      </h3>
      <Card>
        <ul className="divide-y divide-border">
          {history.map((invoice) => (
            <li key={invoice.id} className="flex items-center justify-between gap-4 py-4">
              <div className="flex items-center gap-4">
                <Icon name="check_circle" filled className="text-success" />
                <div>
                  <p className="font-semibold text-text-primary">{invoice.monthLabel} 2026</p>
                  <p className="text-sm text-text-secondary">
                    Pago via {invoice.paidVia} • {invoice.paidOn}
                  </p>
                </div>
              </div>
              <p className="font-bold text-text-primary">{formatCurrency(invoice.amount)}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
