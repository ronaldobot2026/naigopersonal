/**
 * Armazenamento de imagens (fotos de registro visual e capturas posturais).
 *
 * Sempre como Blob — nunca Base64 (ver docs/DECISIONS.md sobre o anti-padrão encontrado
 * no export original do Stitch, que gravava Base64 inline no DOM via FileReader).
 */
import { getById, put, remove, STORE_NAMES } from './db'

interface StoredPhoto {
  key: string
  blob: Blob
  createdAt: string
}

export async function savePhoto(key: string, blob: Blob): Promise<void> {
  await put<StoredPhoto>(STORE_NAMES.assessmentPhotos, {
    key,
    blob,
    createdAt: new Date().toISOString(),
  })
}

export async function loadPhoto(key: string): Promise<Blob | undefined> {
  const record = await getById<StoredPhoto>(STORE_NAMES.assessmentPhotos, key)
  return record?.blob
}

export async function deletePhoto(key: string): Promise<void> {
  await remove(STORE_NAMES.assessmentPhotos, key)
}

/** Cria uma Object URL a partir de uma foto salva. Quem chamar é responsável por revogá-la. */
export async function loadPhotoObjectUrl(key: string): Promise<string | undefined> {
  const blob = await loadPhoto(key)
  return blob ? URL.createObjectURL(blob) : undefined
}
