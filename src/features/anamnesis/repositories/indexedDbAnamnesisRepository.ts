import { getAllByIndex, getById, INDEX_NAMES, put, remove, STORE_NAMES } from '@/lib/storage/db'
import type {
  Anamnesis,
  AnamnesisAnswers,
  AnamnesisFilledBy,
  AnamnesisTemplateId,
} from '../domain/anamnesis.types'

interface CreateAnamnesisInput {
  studentId: string
  trainerId: string
  templateId: AnamnesisTemplateId
  filledBy: AnamnesisFilledBy
}

export const indexedDbAnamnesisRepository = {
  async findById(id: string): Promise<Anamnesis | null> {
    const record = await getById<Anamnesis>(STORE_NAMES.anamneses, id)
    return record ?? null
  },

  async findByStudentId(studentId: string): Promise<Anamnesis[]> {
    const records = await getAllByIndex<Anamnesis>(
      STORE_NAMES.anamneses,
      INDEX_NAMES.studentId,
      studentId,
    )
    return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },

  /** Personal preenche → `draft`; aluno preenche → `pending_student` (aparece no app do aluno). */
  async create(input: CreateAnamnesisInput): Promise<Anamnesis> {
    const now = new Date().toISOString()
    const anamnesis: Anamnesis = {
      id: crypto.randomUUID(),
      ...input,
      status: input.filledBy === 'student' ? 'pending_student' : 'draft',
      answers: {},
      createdAt: now,
      updatedAt: now,
    }
    await put<Anamnesis>(STORE_NAMES.anamneses, anamnesis)
    return anamnesis
  },

  async saveAnswers(anamnesis: Anamnesis, answers: AnamnesisAnswers): Promise<Anamnesis> {
    const updated: Anamnesis = { ...anamnesis, answers, updatedAt: new Date().toISOString() }
    await put<Anamnesis>(STORE_NAMES.anamneses, updated)
    return updated
  },

  async complete(anamnesis: Anamnesis, answers: AnamnesisAnswers): Promise<Anamnesis> {
    const now = new Date().toISOString()
    const completed: Anamnesis = {
      ...anamnesis,
      answers,
      status: 'completed',
      updatedAt: now,
      completedAt: now,
    }
    await put<Anamnesis>(STORE_NAMES.anamneses, completed)
    return completed
  },

  async delete(id: string): Promise<void> {
    await remove(STORE_NAMES.anamneses, id)
  },
}
