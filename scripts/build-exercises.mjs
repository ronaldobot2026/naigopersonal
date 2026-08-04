/**
 * Prepara o catálogo de exercícios a partir do dataset público
 * https://github.com/hasaneyldrm/exercises-dataset (dados sob licença MIT).
 *
 * O arquivo original tem ~17 MB porque carrega instruções em 10 idiomas. Este script baixa,
 * remove os idiomas que não usamos e grava um catálogo enxuto em `public/data/exercises.json`,
 * carregado sob demanda pelo app (nunca embutido no bundle JS).
 *
 * A tradução para pt-BR NÃO acontece aqui: ela mora em `src/features/workouts/domain/`, onde é
 * coberta por testes unitários e pode evoluir sem reprocessar o dataset.
 *
 * Uso: `npm run build:exercises`
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const DATASET_URL =
  'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json'

/** Idioma de origem preservado no catálogo — base para a tradução feita no app. */
const SOURCE_LANGUAGE = 'en'

const OUTPUT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../public/data/exercises.json',
)

/**
 * Atribuição obrigatória da mídia (© Gym visual). É idêntica em todos os registros, então fica
 * uma única vez no envelope em vez de repetida 1.324 vezes. Ver NOTICE.md do dataset.
 */
function extractAttribution(records) {
  const values = new Set(records.map((record) => record.attribution))
  if (values.size !== 1) {
    throw new Error(
      `Esperava uma única string de atribuição, encontrei ${values.size}. Verifique o dataset antes de publicar a mídia.`,
    )
  }
  return [...values][0]
}

function trimRecord(record) {
  const steps = record.instruction_steps?.[SOURCE_LANGUAGE]
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error(`Exercício ${record.id} não tem instruções em "${SOURCE_LANGUAGE}".`)
  }

  return {
    id: record.id,
    name: record.name,
    bodyPart: record.body_part,
    equipment: record.equipment,
    target: record.target,
    muscleGroup: record.muscle_group,
    secondaryMuscles: record.secondary_muscles,
    steps,
    mediaId: record.media_id,
    image: record.image,
    gif: record.gif_url,
  }
}

async function main() {
  process.stdout.write(`Baixando ${DATASET_URL}\n`)
  const response = await fetch(DATASET_URL)
  if (!response.ok) {
    throw new Error(`Falha ao baixar o dataset: HTTP ${response.status}`)
  }

  const records = await response.json()
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('Dataset vazio ou em formato inesperado.')
  }

  const catalog = {
    source: 'https://github.com/hasaneyldrm/exercises-dataset',
    sourceLanguage: SOURCE_LANGUAGE,
    mediaAttribution: extractAttribution(records),
    generatedAt: new Date().toISOString(),
    exercises: records.map(trimRecord),
  }

  await mkdir(dirname(OUTPUT_PATH), { recursive: true })
  await writeFile(OUTPUT_PATH, JSON.stringify(catalog), 'utf8')

  const sizeMb = (Buffer.byteLength(JSON.stringify(catalog)) / 1024 / 1024).toFixed(2)
  process.stdout.write(`${catalog.exercises.length} exercícios → ${OUTPUT_PATH} (${sizeMb} MB)\n`)
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
})
