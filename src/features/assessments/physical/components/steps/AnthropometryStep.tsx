import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Card } from '@/components/ui/Card'
import { NumberInput } from '@/components/ui/NumberInput'
import type { Anthropometry } from '@/types/domain'
import { useSyncValidValues } from '../../hooks/useSyncValidValues'
import {
  anthropometrySchema,
  setValueAsNullableNumber,
  type AnthropometryFormValues,
} from '../../domain/schemas'

type AnthropometryStepProps = {
  value: Anthropometry
  onChange: (value: Anthropometry) => void
}

export function AnthropometryStep({ value, onChange }: AnthropometryStepProps) {
  const { register, watch, formState } = useForm<AnthropometryFormValues>({
    resolver: zodResolver(anthropometrySchema),
    defaultValues: value,
    mode: 'onChange',
  })

  const numericField = (name: keyof AnthropometryFormValues) =>
    register(name, { setValueAs: setValueAsNullableNumber })

  const watched = watch()

  useSyncValidValues<Anthropometry>(
    {
      chestCm: watched.chestCm,
      waistCm: watched.waistCm,
      hipCm: watched.hipCm,
      rightArmCm: watched.rightArmCm,
      leftArmCm: watched.leftArmCm,
      rightThighCm: watched.rightThighCm,
      leftThighCm: watched.leftThighCm,
      calvesCm: watched.calvesCm,
    },
    formState.isValid,
    onChange,
  )

  return (
    <Card>
      <div className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 md:grid-cols-4">
        <NumberInput
          label="Peitoral"
          unit="cm"
          step="0.1"
          error={formState.errors.chestCm?.message}
          {...numericField('chestCm')}
        />
        <NumberInput
          label="Cintura"
          unit="cm"
          step="0.1"
          error={formState.errors.waistCm?.message}
          {...numericField('waistCm')}
        />
        <NumberInput
          label="Quadril"
          unit="cm"
          step="0.1"
          error={formState.errors.hipCm?.message}
          {...numericField('hipCm')}
        />
        <NumberInput
          label="Braço (D)"
          unit="cm"
          step="0.1"
          error={formState.errors.rightArmCm?.message}
          {...numericField('rightArmCm')}
        />
        <NumberInput
          label="Braço (E)"
          unit="cm"
          step="0.1"
          error={formState.errors.leftArmCm?.message}
          {...numericField('leftArmCm')}
        />
        <NumberInput
          label="Coxa (D)"
          unit="cm"
          step="0.1"
          error={formState.errors.rightThighCm?.message}
          {...numericField('rightThighCm')}
        />
        <NumberInput
          label="Coxa (E)"
          unit="cm"
          step="0.1"
          error={formState.errors.leftThighCm?.message}
          {...numericField('leftThighCm')}
        />
        <NumberInput
          label="Panturrilhas"
          unit="cm"
          step="0.1"
          error={formState.errors.calvesCm?.message}
          {...numericField('calvesCm')}
        />
      </div>
    </Card>
  )
}
