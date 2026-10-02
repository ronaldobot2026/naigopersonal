import { getSupabase } from '@/lib/supabase/client'
import type { Database, Json } from '@/lib/supabase/database.types'
import type { CorrectivePlan, CorrectivePlanItem, PosturalFinding } from '../domain/correctivePrescription.types'

/**
 * Formato das linhas do Supabase (snake_case). `corrective_plans`/`corrective_plan_items` não
 * saíram de `supabase gen types` de verdade (CLI sem projeto linkado/autenticado neste ambiente)
 * — os tipos em `database.types.ts` foram adicionados à mão a partir da migration
 * `20260922120000_corrective_plans.sql` (ver comentário lá). `status`/`origin`/`validation` são
 * `text` com `check` no Postgres, então o gerador devolveria `string`; as linhas abaixo estreitam
 * de volta para os tipos de domínio que a migration garante na prática — mesmo padrão de
 * `physicalAssessmentRepository.ts`. Nunca vaza para fora deste arquivo — só `CorrectivePlan`/
 * `CorrectivePlanItem` saem daqui, via `toDomain`.
 */
type CorrectivePlanRow = Omit<
  Database['public']['Tables']['corrective_plans']['Row'],
  'status' | 'findings'
> & {
  status: CorrectivePlan['status']
  findings: PosturalFinding[]
}

type CorrectivePlanItemRow = Omit<
  Database['public']['Tables']['corrective_plan_items']['Row'],
  'origin' | 'validation'
> & {
  origin: CorrectivePlanItem['origin']
  validation: CorrectivePlanItem['validation']
}

function toItemDomain(row: CorrectivePlanItemRow): CorrectivePlanItem {
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    exerciseName: row.exercise_name,
    findingId: row.finding_id,
    targetMuscles: row.target_muscles,
    sets: row.sets,
    reps: row.reps,
    origin: row.origin,
    validation: row.validation,
    trainerNote: row.trainer_note ?? undefined,
  }
}

function toDomain(row: CorrectivePlanRow, itemRows: CorrectivePlanItemRow[]): CorrectivePlan {
  return {
    id: row.id,
    studentId: row.student_id,
    assessmentId: row.assessment_id,
    findings: row.findings,
    items: itemRows.map(toItemDomain),
    status: row.status,
    createdAt: row.created_at,
    publishedAt: row.published_at ?? undefined,
    prescriptionVersion: row.prescription_version,
  }
}

/**
 * Sem `id`: a coluna é uuid gerado pelo banco, e o id de domínio montado no cliente
 * (`${findingId}:${exerciseId}`, ver `buildCorrectivePlanFromSuggestions`) não é uuid. Como os itens
 * são recriados a cada gravação (delete + insert em `persist`), o id da linha é efêmero de qualquer
 * forma — quem lê de volta recebe o uuid real via `toItemDomain`.
 */
function toItemPayload(item: CorrectivePlanItem, planId: string) {
  return {
    plan_id: planId,
    exercise_id: item.exerciseId,
    exercise_name: item.exerciseName,
    finding_id: item.findingId,
    target_muscles: item.targetMuscles,
    sets: item.sets,
    reps: item.reps,
    origin: item.origin,
    validation: item.validation,
    trainer_note: item.trainerNote ?? null,
  }
}

/**
 * Grava o plano como `draft` ou `published`. Idempotente por `assessment_id`: se já existe um
 * plano para a avaliação, reusa o `id` dele (upsert) e substitui os itens (delete + insert) em
 * vez de acumular — nunca cria uma segunda linha para a mesma avaliação. Ao republicar um plano
 * já publicado antes, preserva o `published_at` original (só carimba data nova na primeira vez que
 * o status vira `published`).
 */
async function persist(
  plan: CorrectivePlan,
  evaluatorId: string,
  status: CorrectivePlan['status'],
): Promise<CorrectivePlan> {
  const supabase = getSupabase()

  const { data: existing, error: findError } = await supabase
    .from('corrective_plans')
    .select('id, published_at')
    .eq('assessment_id', plan.assessmentId)
    .maybeSingle()
  if (findError) throw findError

  const id = existing?.id ?? plan.id
  const publishedAt =
    status === 'published' ? (existing?.published_at ?? new Date().toISOString()) : (existing?.published_at ?? null)

  const { error: planError } = await supabase.from('corrective_plans').upsert({
    id,
    student_id: plan.studentId,
    assessment_id: plan.assessmentId,
    evaluator_id: evaluatorId,
    status,
    prescription_version: plan.prescriptionVersion,
    // `PosturalFinding[]` não tem index signature (tipo de domínio estruturado), então o TS não o
    // vê como subtipo estrutural de `Json` mesmo sendo serializável — daí o cast, igual ao
    // `postural_assessment` de `physicalAssessmentRepository.ts`.
    findings: plan.findings as unknown as Json,
    published_at: publishedAt,
  })
  if (planError) throw planError

  const { error: deleteError } = await supabase.from('corrective_plan_items').delete().eq('plan_id', id)
  if (deleteError) throw deleteError

  if (plan.items.length > 0) {
    const { error: itemsError } = await supabase
      .from('corrective_plan_items')
      .insert(plan.items.map((item) => toItemPayload(item, id)))
    if (itemsError) throw itemsError
  }

  return { ...plan, id, status, publishedAt: publishedAt ?? undefined }
}

export const correctivePlanRepository = {
  async findByAssessmentId(assessmentId: string): Promise<CorrectivePlan | null> {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('corrective_plans')
      .select('*')
      .eq('assessment_id', assessmentId)
      .maybeSingle()
    if (error) throw error
    const row = data as CorrectivePlanRow | null
    if (!row) return null

    const { data: itemRows, error: itemsError } = await supabase
      .from('corrective_plan_items')
      .select('*')
      .eq('plan_id', row.id)
    if (itemsError) throw itemsError

    return toDomain(row, (itemRows ?? []) as CorrectivePlanItemRow[])
  },

  async findByStudentId(studentId: string): Promise<CorrectivePlan[]> {
    const supabase = getSupabase()
    const { data, error } = await supabase.from('corrective_plans').select('*').eq('student_id', studentId)
    if (error) throw error
    // Cast em duas etapas: `findings` estreita de `Json` (união recursiva) para `PosturalFinding[]`
    // — TS recusa o cast direto em arrays por "não sobrepor o suficiente" mesmo sendo o mesmo
    // estreitamento válido que funciona objeto a objeto (ver `toDomain`/`CorrectivePlanRow`).
    const rows = (data ?? []) as unknown as CorrectivePlanRow[]
    if (rows.length === 0) return []

    const ids = rows.map((row) => row.id)
    const { data: itemRows, error: itemsError } = await supabase
      .from('corrective_plan_items')
      .select('*')
      .in('plan_id', ids)
    if (itemsError) throw itemsError

    const itemsByPlan = new Map<string, CorrectivePlanItemRow[]>()
    for (const row of (itemRows ?? []) as CorrectivePlanItemRow[]) {
      const list = itemsByPlan.get(row.plan_id) ?? []
      list.push(row)
      itemsByPlan.set(row.plan_id, list)
    }

    return rows.map((row) => toDomain(row, itemsByPlan.get(row.id) ?? []))
  },

  async saveDraft(plan: CorrectivePlan, evaluatorId: string): Promise<CorrectivePlan> {
    return persist(plan, evaluatorId, 'draft')
  },

  async publish(plan: CorrectivePlan, evaluatorId: string): Promise<CorrectivePlan> {
    return persist(plan, evaluatorId, 'published')
  },
}
