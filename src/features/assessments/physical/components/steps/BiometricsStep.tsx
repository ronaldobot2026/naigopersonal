import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Card } from '@/components/ui/Card'
import { NumberInput } from '@/components/ui/NumberInput'
import type { Biometrics } from '@/types/domain'
import { useSyncValidValues } from '../../hooks/useSyncValidValues'
import {
  biometricsSchema,
  setValueAsNullableNumber,
  type BiometricsFormValues,
} from '../../domain/schemas'

type BiometricsStepProps = {
  value: Biometrics
  onChange: (value: Biometrics) => void
}

export function BiometricsStep({ value, onChange }: BiometricsStepProps) {
  const { register, watch, formState } = useForm<BiometricsFormValues>({
    resolver: zodResolver(biometricsSchema),
    defaultValues: value,
    mode: 'onChange',
  })

  const numericField = (name: keyof BiometricsFormValues) =>
    register(name, { setValueAs: setValueAsNullableNumber })

  const watched = watch()

  useSyncValidValues<Biometrics>(
    {
      weightKg: watched.weightKg,
      heightCm: watched.heightCm,
      bodyFatPercent: watched.bodyFatPercent,
      muscleMassKg: watched.muscleMassKg,
    },
    formState.isValid,
    onChange,
  )

  return (
    <Card>
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
        <NumberInput
          label="Peso"
          unit="kg"
          step="0.1"
          emphasis="stat"
          error={formState.errors.weightKg?.message}
          {...numericField('weightKg')}
        />
        <NumberInput
          label="Altura"
          unit="cm"
          emphasis="stat"
          error={formState.errors.heightCm?.message}
          {...numericField('heightCm')}
        />
        <NumberInput
          label="% Gordura corporal"
          step="0.1"
          emphasis="stat"
          error={formState.errors.bodyFatPercent?.message}
          {...numericField('bodyFatPercent')}
        />
        <NumberInput
          label="Massa muscular"
          unit="kg"
          step="0.1"
          emphasis="stat"
          error={formState.errors.muscleMassKg?.message}
          {...numericField('muscleMassKg')}
        />
      </div>
    </Card>
  )
}
