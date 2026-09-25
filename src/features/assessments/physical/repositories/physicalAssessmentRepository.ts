import { getSupabase } from '@/lib/supabase/client'
import type { Database, Json } from '@/lib/supabase/database.types'
import type { PosturalAssessment } from '@/features/assessments/postural/domain/posturalAssessment.types'
import {
  createEmptyAnthropometry,
  createEmptyBiometrics,
  type Anthropometry,
  type Biometrics,
  type PhysicalAssessment,
  type PhysicalAssessmentStatus,
  type VisualRecordEntry,
  type VisualRecordView,
} from '@/types/domain'

/**
 * Formato das linhas do Supabase (snake_case), a partir de `database.types.ts` (gerado via
 * `supabase gen types typescript --linked` — regenerar depois de toda migration nova). O
 * Postgres não tem enum para `status`/`view` (só `check` constraint) nem tipo estruturado para o
 * `jsonb` de `postural_assessment`, então o gerador devolve `string`/`Json`; as duas linhas
 * abaixo estreitam de volta para os tipos de domínio que a migration garante na prática. Nunca
 * vaza para fora deste arquivo — só os tipos de `src/types/domain.ts` saem daqui, via `toDomain`.
 */
type PhysicalAssessmentRow = Omit<
  Database['public']['Tables']['physical_assessments']['Row'],
  'status' | 'postural_assessment'
> & {
  status: PhysicalAssessmentStatus
  postural_assessment: PosturalAssessment | null
}

type BodyMetricsRow = Database['public']['Tables']['body_metrics']['Row']

type AssessmentPhotoRow = Omit<
  Pick<Database['public']['Tables']['assessment_photos']['Row'], 'assessment_id' | 'view' | 'storage_path'>,
  'view'
> & { view: VisualRecordView }

function toBiometrics(row: BodyMetricsRow | undefined): Biometrics {
  if (!row) return createEmptyBiometrics()
  return {
    weightKg: row.weight_kg,
    heightCm: row.height_cm,
    bodyFatPercent: row.body_fat_percent,
    muscleMassKg: row.muscle_mass_kg,
  }
}

function toAnthropometry(row: BodyMetricsRow | undefined): Anthropometry {
  if (!row) return createEmptyAnthropometry()
  return {
    chestCm: row.chest_cm,
    waistCm: row.waist_cm,
    hipCm: row.hip_cm,
    rightArmCm: row.right_arm_cm,
    leftArmCm: row.left_arm_cm,
    rightThighCm: row.right_thigh_cm,
    leftThighCm: row.left_thigh_cm,
    calvesCm: row.calves_cm,
  }
}

function toVisualRecords(rows: AssessmentPhotoRow[]): VisualRecordEntry[] {
  return rows.map((row) => ({ view: row.view, imageStorageKey: row.storage_path }))
}

function toDomain(
  row: PhysicalAssessmentRow,
  metricsRow: BodyMetricsRow | undefined,
  photoRows: AssessmentPhotoRow[],
): PhysicalAssessment {
  return {
    id: row.id,
    studentId: row.student_id,
    evaluatorId: row.evaluator_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    generalNotes: row.general_notes ?? undefined,
    biometrics: toBiometrics(metricsRow),
    anthropometry: toAnthropometry(metricsRow),
    visualRecords: toVisualRecords(photoRows),
    posturalAssessment: row.postural_assessment ?? undefined,
  }
}

function toBodyMetricsPayload(assessment: PhysicalAssessment) {
  return {
    assessment_id: assessment.id,
    student_id: assessment.studentId,
    weight_kg: assessment.biometrics.weightKg,
    height_cm: assessment.biometrics.heightCm,
    body_fat_percent: assessment.biometrics.bodyFatPercent,
    muscle_mass_kg: assessment.biometrics.muscleMassKg,
    chest_cm: assessment.anthropometry.chestCm,
    waist_cm: assessment.anthropometry.waistCm,
    hip_cm: assessment.anthropometry.hipCm,
    right_arm_cm: assessment.anthropometry.rightArmCm,
    left_arm_cm: assessment.anthropometry.leftArmCm,
    right_thigh_cm: assessment.anthropometry.rightThighCm,
    left_thigh_cm: assessment.anthropometry.leftThighCm,
    calves_cm: assessment.anthropometry.calvesCm,
  }
}

/**
 * `visualRecords` não é persistido por `persist()` — não existe coluna para isso em
 * `physical_assessments`. As fotos já são gravadas de forma durável e imediata pelo
 * `assessmentPhotoRepository` assim que o personal seleciona o arquivo (mesma decisão de
 * `VisualRecordStep.tsx`/`photoStorage.ts` que este repositório substitui); `saveDraft`/`complete`
 * só ecoam de volta o array recebido, para o estado local do wizard continuar coerente sem uma
 * viagem extra ao banco.
 */
async function persist(
  assessment: PhysicalAssessment,
  status: PhysicalAssessmentStatus,
): Promise<PhysicalAssessment> {
  const supabase = getSupabase()
  const updatedAt = new Date().toISOString()

  const { error: assessmentError } = await supabase.from('physical_assessments').upsert({
    id: assessment.id,
    student_id: assessment.studentId,
    evaluator_id: assessment.evaluatorId,
    status,
    general_notes: assessment.generalNotes ?? null,
    // `PosturalAssessment` não tem index signature (é um tipo de domínio estruturado), então o
    // TS não o vê como subtipo estrutural de `Json` mesmo sendo serializável — daí o cast.
    postural_assessment: (assessment.posturalAssessment ?? null) as unknown as Json | null,
    updated_at: updatedAt,
  })
  if (assessmentError) throw assessmentError

  const { error: metricsError } = await supabase
    .from('body_metrics')
    .upsert(toBodyMetricsPayload(assessment), { onConflict: 'assessment_id' })
  if (metricsError) throw metricsError

  return { ...assessment, status, updatedAt }
}

export const physicalAssessmentRepository = {
  async findById(id: string): Promise<PhysicalAssessment | null> {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('physical_assessments')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    const row = data as PhysicalAssessmentRow | null
    if (!row) return null

    const [metricsResult, photosResult] = await Promise.all([
      supabase.from('body_metrics').select('*').eq('assessment_id', id).maybeSingle(),
      supabase.from('assessment_photos').select('assessment_id, view, storage_path').eq('assessment_id', id),
    ])
    if (metricsResult.error) throw metricsResult.error
    if (photosResult.error) throw photosResult.error

    const metricsRow = metricsResult.data as BodyMetricsRow | null
    const photoRows = (photosResult.data ?? []) as AssessmentPhotoRow[]

    return toDomain(row, metricsRow ?? undefined, photoRows)
  },

  async findByStudentId(studentId: string): Promise<PhysicalAssessment[]> {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('physical_assessments')
      .select('*')
      .eq('student_id', studentId)
    if (error) throw error
    const rows = (data ?? []) as PhysicalAssessmentRow[]
    if (rows.length === 0) return []

    const ids = rows.map((row) => row.id)
    const [metricsResult, photosResult] = await Promise.all([
      supabase.from('body_metrics').select('*').in('assessment_id', ids),
      supabase.from('assessment_photos').select('assessment_id, view, storage_path').in('assessment_id', ids),
    ])
    if (metricsResult.error) throw metricsResult.error
    if (photosResult.error) throw photosResult.error

    const metricsByAssessment = new Map<string, BodyMetricsRow>()
    for (const row of (metricsResult.data ?? []) as BodyMetricsRow[]) {
      if (row.assessment_id) metricsByAssessment.set(row.assessment_id, row)
    }

    const photosByAssessment = new Map<string, AssessmentPhotoRow[]>()
    for (const row of (photosResult.data ?? []) as AssessmentPhotoRow[]) {
      const list = photosByAssessment.get(row.assessment_id) ?? []
      list.push(row)
      photosByAssessment.set(row.assessment_id, list)
    }

    return rows.map((row) =>
      toDomain(row, metricsByAssessment.get(row.id), photosByAssessment.get(row.id) ?? []),
    )
  },

  /**
   * Salvamento incremental do wizard (auto-save).
   *
   * NUNCA rebaixa uma avaliação já concluída: o mesmo wizard serve para preencher um rascunho e
   * para reabrir uma avaliação do histórico, e o auto-save dispara a cada alteração de campo. Se
   * este método forçasse `'draft'`, tocar em qualquer campo de uma avaliação concluída a
   * rebaixaria para rascunho — e a RLS do aluno (que só lê `status='completed'`) faria o relatório
   * dele desaparecer sem aviso. Só quem promove para `completed` é `complete()`.
   */
  async saveDraft(assessment: PhysicalAssessment): Promise<PhysicalAssessment> {
    return persist(assessment, assessment.status === 'completed' ? 'completed' : 'draft')
  },

  async complete(assessment: PhysicalAssessment): Promise<PhysicalAssessment> {
    return persist(assessment, 'completed')
  },

  async delete(id: string): Promise<void> {
    const supabase = getSupabase()
    const { data: photoRows } = await supabase
      .from('assessment_photos')
      .select('storage_path')
      .eq('assessment_id', id)

    const { error } = await supabase.from('physical_assessments').delete().eq('id', id)
    if (error) throw error

    const paths = ((photoRows ?? []) as { storage_path: string }[]).map((row) => row.storage_path)
    if (paths.length > 0) {
      await supabase.storage.from('assessment-photos').remove(paths)
    }
  },
}
