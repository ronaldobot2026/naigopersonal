/**
 * Wrapper mínimo e promisificado sobre a IndexedDB nativa do navegador.
 *
 * Deliberadamente não usamos uma biblioteca de terceiros aqui: o esquema é pequeno
 * (4 object stores) e a API nativa promisificada cobre 100% da necessidade do protótipo.
 * Repositórios de domínio (StudentRepository, PhysicalAssessmentRepository, ...) usam este
 * módulo por baixo — nenhuma página ou componente deve importar `db.ts` diretamente.
 */

const DB_NAME = 'windson-wood-personal'
const DB_VERSION = 2

export const STORE_NAMES = {
  students: 'students',
  physicalAssessments: 'physicalAssessments',
  assessmentPhotos: 'assessmentPhotos',
  workoutPlans: 'workoutPlans',
} as const

export type StoreName = (typeof STORE_NAMES)[keyof typeof STORE_NAMES]

export const INDEX_NAMES = {
  studentId: 'studentId',
} as const

let dbPromise: Promise<IDBDatabase> | null = null

function upgrade(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(STORE_NAMES.students)) {
    db.createObjectStore(STORE_NAMES.students, { keyPath: 'id' })
  }
  if (!db.objectStoreNames.contains(STORE_NAMES.physicalAssessments)) {
    const store = db.createObjectStore(STORE_NAMES.physicalAssessments, { keyPath: 'id' })
    store.createIndex(INDEX_NAMES.studentId, 'studentId', { unique: false })
  }
  if (!db.objectStoreNames.contains(STORE_NAMES.assessmentPhotos)) {
    db.createObjectStore(STORE_NAMES.assessmentPhotos, { keyPath: 'key' })
  }
  if (!db.objectStoreNames.contains(STORE_NAMES.workoutPlans)) {
    const store = db.createObjectStore(STORE_NAMES.workoutPlans, { keyPath: 'id' })
    store.createIndex(INDEX_NAMES.studentId, 'studentId', { unique: false })
  }
}

export function openDatabase(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => upgrade(request.result)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Falha ao abrir o IndexedDB.'))
    })
  }
  return dbPromise
}

function runRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Falha na operação do IndexedDB.'))
  })
}

export async function getAll<T>(storeName: StoreName): Promise<T[]> {
  const db = await openDatabase()
  const tx = db.transaction(storeName, 'readonly')
  return runRequest(tx.objectStore(storeName).getAll())
}

export async function getById<T>(storeName: StoreName, id: string): Promise<T | undefined> {
  const db = await openDatabase()
  const tx = db.transaction(storeName, 'readonly')
  return runRequest(tx.objectStore(storeName).get(id))
}

export async function getAllByIndex<T>(
  storeName: StoreName,
  indexName: string,
  value: string,
): Promise<T[]> {
  const db = await openDatabase()
  const tx = db.transaction(storeName, 'readonly')
  return runRequest(tx.objectStore(storeName).index(indexName).getAll(value))
}

export async function put<T>(storeName: StoreName, value: T): Promise<void> {
  const db = await openDatabase()
  const tx = db.transaction(storeName, 'readwrite')
  await runRequest(tx.objectStore(storeName).put(value))
}

export async function remove(storeName: StoreName, id: string): Promise<void> {
  const db = await openDatabase()
  const tx = db.transaction(storeName, 'readwrite')
  await runRequest(tx.objectStore(storeName).delete(id))
}

export async function count(storeName: StoreName): Promise<number> {
  const db = await openDatabase()
  const tx = db.transaction(storeName, 'readonly')
  return runRequest(tx.objectStore(storeName).count())
}
