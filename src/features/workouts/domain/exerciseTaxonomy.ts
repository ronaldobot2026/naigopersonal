/**
 * Tradução pt-BR da taxonomia do dataset de exercícios.
 *
 * O dataset original (https://github.com/hasaneyldrm/exercises-dataset) usa vocabulários
 * fechados em inglês para região do corpo, equipamento e músculos. Aqui eles viram os rótulos
 * que o app exibe e pelos quais o usuário filtra. Os mapas cobrem 100% dos valores presentes
 * no dataset — `exerciseTaxonomy.test.ts` falha se algum valor ficar sem tradução.
 */

/** Região do corpo — vocabulário fechado de 10 valores no dataset. */
export const BODY_PART_PT_BR: Record<string, string> = {
  back: 'Costas',
  cardio: 'Cardio',
  chest: 'Peito',
  'lower arms': 'Antebraços',
  'lower legs': 'Panturrilhas',
  neck: 'Pescoço',
  shoulders: 'Ombros',
  'upper arms': 'Braços',
  'upper legs': 'Coxas',
  waist: 'Core',
}

/** Equipamento necessário — 28 valores no dataset. */
export const EQUIPMENT_PT_BR: Record<string, string> = {
  assisted: 'Assistido',
  band: 'Elástico',
  barbell: 'Barra',
  'body weight': 'Peso corporal',
  'bosu ball': 'Bosu',
  cable: 'Cabo',
  dumbbell: 'Halteres',
  'elliptical machine': 'Elíptico',
  'ez barbell': 'Barra W',
  hammer: 'Martelo',
  kettlebell: 'Kettlebell',
  'leverage machine': 'Máquina articulada',
  'medicine ball': 'Medicine ball',
  'olympic barbell': 'Barra olímpica',
  'resistance band': 'Faixa elástica',
  roller: 'Rolo',
  rope: 'Corda',
  'skierg machine': 'SkiErg',
  'sled machine': 'Leg press',
  'smith machine': 'Smith',
  'stability ball': 'Bola suíça',
  'stationary bike': 'Bicicleta ergométrica',
  'stepmill machine': 'Simulador de escada',
  tire: 'Pneu',
  'trap bar': 'Barra hexagonal',
  'upper body ergometer': 'Ergômetro de braços',
  weighted: 'Com carga',
  'wheel roller': 'Roda abdominal',
}

/**
 * Músculos — cobre `target`, `muscle_group` e `secondary_muscles` num único mapa, porque os
 * três campos compartilham o mesmo vocabulário anatômico.
 */
export const MUSCLE_PT_BR: Record<string, string> = {
  abdominals: 'Abdômen',
  abductors: 'Abdutores',
  abs: 'Abdômen',
  adductors: 'Adutores',
  'ankle stabilizers': 'Estabilizadores do tornozelo',
  ankles: 'Tornozelos',
  back: 'Costas',
  biceps: 'Bíceps',
  brachialis: 'Braquial',
  calves: 'Panturrilhas',
  'cardiovascular system': 'Sistema cardiovascular',
  chest: 'Peitoral',
  core: 'Core',
  deltoids: 'Deltoides',
  delts: 'Deltoides',
  feet: 'Pés',
  forearms: 'Antebraços',
  glutes: 'Glúteos',
  'grip muscles': 'Musculatura de pegada',
  groin: 'Virilha',
  hamstrings: 'Posteriores de coxa',
  hands: 'Mãos',
  'hip flexors': 'Flexores do quadril',
  'inner thighs': 'Face interna da coxa',
  'latissimus dorsi': 'Grande dorsal',
  lats: 'Dorsais',
  'levator scapulae': 'Levantador da escápula',
  'lower abs': 'Abdômen inferior',
  'lower back': 'Lombar',
  obliques: 'Oblíquos',
  pectorals: 'Peitoral',
  quadriceps: 'Quadríceps',
  quads: 'Quadríceps',
  'rear deltoids': 'Deltoide posterior',
  rhomboids: 'Romboides',
  'rotator cuff': 'Manguito rotador',
  shins: 'Tibiais',
  shoulders: 'Ombros',
  soleus: 'Sóleo',
  'serratus anterior': 'Serrátil anterior',
  spine: 'Coluna',
  sternocleidomastoid: 'Esternocleidomastóideo',
  traps: 'Trapézio',
  trapezius: 'Trapézio',
  triceps: 'Tríceps',
  'upper back': 'Dorsal superior',
  'upper chest': 'Peitoral superior',
  'wrist extensors': 'Extensores do punho',
  'wrist flexors': 'Flexores do punho',
  wrists: 'Punhos',
}

/** Capitaliza a primeira letra — usado quando um termo não está no dicionário. */
function humanize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function translateBodyPart(value: string): string {
  return BODY_PART_PT_BR[value] ?? humanize(value)
}

export function translateEquipment(value: string): string {
  return EQUIPMENT_PT_BR[value] ?? humanize(value)
}

export function translateMuscle(value: string): string {
  return MUSCLE_PT_BR[value] ?? humanize(value)
}
