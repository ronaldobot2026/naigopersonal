import { z } from 'zod'

function nullableMeasurement(max: number) {
  return z
    .number()
    .min(0, 'Deve ser maior ou igual a 0')
    .max(max, `Deve ser menor que ${max}`)
    .nullable()
}

export const biometricsSchema = z.object({
  weightKg: nullableMeasurement(400),
  heightCm: nullableMeasurement(250),
  bodyFatPercent: nullableMeasurement(80),
  muscleMassKg: nullableMeasurement(200),
})

export type BiometricsFormValues = z.infer<typeof biometricsSchema>

export const anthropometrySchema = z.object({
  chestCm: nullableMeasurement(300),
  waistCm: nullableMeasurement(300),
  hipCm: nullableMeasurement(300),
  rightArmCm: nullableMeasurement(100),
  leftArmCm: nullableMeasurement(100),
  rightThighCm: nullableMeasurement(150),
  leftThighCm: nullableMeasurement(150),
  calvesCm: nullableMeasurement(100),
})

export type AnthropometryFormValues = z.infer<typeof anthropometrySchema>

/**
 * `setValueAs` para campos numéricos opcionais: inputs HTML number entregam string ("" quando
 * limpos). Convertido aqui, antes da validação, para manter o schema com input/output idênticos
 * (número | null), o que o zodResolver exige para tipagem correta com useForm.
 */
export function setValueAsNullableNumber(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null
  const num = Number(value)
  return Number.isNaN(num) ? null : num
}
