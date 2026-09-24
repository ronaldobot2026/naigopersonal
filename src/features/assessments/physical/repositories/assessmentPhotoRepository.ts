import { getSupabase } from '@/lib/supabase/client'
import type { VisualRecordView } from '@/types/domain'

const BUCKET = 'assessment-photos'
const SIGNED_URL_TTL_SECONDS = 60 * 5

function extensionFromFile(file: File): string {
  const fromName = file.name.split('.').pop()
  if (fromName && fromName.length <= 5) return fromName.toLowerCase()
  const fromType = file.type.split('/').pop()
  return fromType && fromType.length <= 5 ? fromType.toLowerCase() : 'jpg'
}

function buildStoragePath(
  studentId: string,
  assessmentId: string,
  view: VisualRecordView,
  file: File,
): string {
  return `${studentId}/assessments/${assessmentId}/${view}.${extensionFromFile(file)}`
}

/**
 * Fotos de registro visual: o arquivo vive no bucket privado `assessment-photos` (RLS por
 * `{student_id}/...`, ver migration da Fase 6); o metadado (qual vista, qual avaliação) vive na
 * tabela `assessment_photos`. Chamado direto pelo componente `VisualRecordStep`, mesmo padrão de
 * `photoStorage.ts` (IndexedDB) que ele substitui — ver docs/ARCHITECTURE.md.
 */
export const assessmentPhotoRepository = {
  /** Envia (ou substitui) a foto de uma vista e devolve o path salvo, para persistir no wizard. */
  async upload(
    studentId: string,
    assessmentId: string,
    view: VisualRecordView,
    file: File,
  ): Promise<string> {
    const supabase = getSupabase()
    const path = buildStoragePath(studentId, assessmentId, view, file)

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' })
    if (uploadError) throw uploadError

    const { error: rowError } = await supabase
      .from('assessment_photos')
      .upsert(
        { assessment_id: assessmentId, student_id: studentId, view, storage_path: path },
        { onConflict: 'assessment_id,view' },
      )
    if (rowError) throw rowError

    return path
  },

  /** Remove a foto do storage e o registro da tabela. */
  async remove(storagePath: string): Promise<void> {
    const supabase = getSupabase()
    await supabase.storage.from(BUCKET).remove([storagePath])
    await supabase.from('assessment_photos').delete().eq('storage_path', storagePath)
  },

  /** Signed URL de curta duração — o bucket é privado, nunca servido publicamente (LGPD). */
  async getSignedUrl(storagePath: string): Promise<string | undefined> {
    const supabase = getSupabase()
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS)
    if (error) return undefined
    return data.signedUrl
  },
}
