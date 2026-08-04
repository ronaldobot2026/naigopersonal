import { count, getAll, getById, put, remove, STORE_NAMES } from '@/lib/storage/db'
import { MOCK_STUDENTS } from '@/mocks/students'
import type { Student } from '@/types/domain'

async function seedIfEmpty(): Promise<void> {
  const existingCount = await count(STORE_NAMES.students)
  if (existingCount > 0) return
  await Promise.all(MOCK_STUDENTS.map((student) => put<Student>(STORE_NAMES.students, student)))
}

export const indexedDbStudentRepository = {
  async findAll(): Promise<Student[]> {
    await seedIfEmpty()
    return getAll<Student>(STORE_NAMES.students)
  },

  async findById(id: string): Promise<Student | null> {
    await seedIfEmpty()
    const student = await getById<Student>(STORE_NAMES.students, id)
    return student ?? null
  },

  async create(student: Student): Promise<Student> {
    await put<Student>(STORE_NAMES.students, student)
    return student
  },

  async update(id: string, patch: Partial<Student>): Promise<Student> {
    const existing = await getById<Student>(STORE_NAMES.students, id)
    if (!existing) {
      throw new Error(`Aluno ${id} não encontrado.`)
    }
    const updated: Student = { ...existing, ...patch }
    await put<Student>(STORE_NAMES.students, updated)
    return updated
  },

  async delete(id: string): Promise<void> {
    await remove(STORE_NAMES.students, id)
  },
}
