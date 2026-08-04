/**
 * Sinônimos de academia brasileira → padrões do nome original em inglês.
 *
 * O problema que isto resolve: o vocabulário de academia no Brasil não é tradução literal do
 * dataset. "Stiff" é o exemplo canônico — o exercício que todo treinador chama de stiff aparece
 * no dataset como `straight leg deadlift`, sem a palavra "stiff" em lugar nenhum. Buscar por
 * "stiff" encontrava só 4 registros, e nenhum era o stiff com barra.
 *
 * Cada entrada acrescenta o termo em pt-BR ao texto de busca de todo exercício cujo nome
 * original contenha um dos padrões. Não altera o nome exibido — só a descoberta.
 *
 * Todos os padrões abaixo foram conferidos contra `public/data/exercises.json`: entrada que não
 * casa com nada é ruído, e `exerciseSearchAliases.test.ts` falha se alguma parar de casar.
 */

/** `[termo em pt-BR, padrões que devem aparecer no nome original em inglês]` */
export const SEARCH_ALIASES: ReadonlyArray<readonly [string, readonly string[]]> = [
  // Posterior de coxa e quadril
  ['stiff', ['straight leg deadlift', 'stiff leg deadlift', 'romanian deadlift']],
  ['levantamento terra', ['deadlift']],
  ['mesa flexora', ['leg curl']],
  ['cadeira extensora', ['leg extension']],
  ['cadeira abdutora', ['hip abduction', 'abduction']],
  ['cadeira adutora', ['hip adduction', 'adduction']],
  ['elevacao pelvica', ['hip thrust', 'glute bridge']],
  // "glúteo quatro apoios" ficou de fora de propósito: neste dataset `kickback` é sempre
  // tríceps e `donkey` é sempre panturrilha. Mapear o termo levaria a resultados errados.
  ['extensao de quadril', ['hip extension']],
  ['agachamento bulgaro', ['split squat']],
  ['bom dia', ['good morning']],

  // Peito
  ['supino', ['bench press', 'chest press']],
  ['supino inclinado', ['incline bench press', 'incline chest press']],
  ['supino declinado', ['decline bench press', 'decline chest press']],
  ['crucifixo', ['fly', 'flye']],
  ['voador', ['fly', 'flye']],
  ['peck deck', ['fly', 'flye']],
  ['paralela', ['dip']],
  ['mergulho', ['dip']],
  ['flexao de braco', ['push-up', 'push up', 'pushup']],

  // Costas
  ['puxada', ['pulldown', 'pull-down']],
  ['puxada frente', ['lat pulldown', 'pulldown']],
  ['remada', ['row']],
  ['remada baixa', ['seated row']],
  ['remada curvada', ['bent over row', 'bent-over row']],
  ['remada alta', ['upright row']],
  ['barra fixa', ['pull-up', 'pullup', 'chin-up']],
  ['encolhimento', ['shrug']],
  ['hiperextensao', ['hyperextension']],
  ['lombar', ['hyperextension', 'back extension']],
  ['pulldown', ['pulldown']],

  // Ombros
  ['desenvolvimento', ['shoulder press', 'military press', 'overhead press', 'arnold press']],
  ['desenvolvimento militar', ['military press']],
  ['elevacao lateral', ['lateral raise']],
  ['elevacao frontal', ['front raise']],
  ['crucifixo inverso', ['reverse fly', 'rear delt']],

  // Braços
  ['rosca', ['curl']],
  ['rosca direta', ['curl']],
  ['rosca scott', ['preacher curl']],
  ['rosca martelo', ['hammer curl']],
  ['rosca concentrada', ['concentration curl']],
  ['rosca punho', ['wrist curl']],
  ['triceps testa', ['skullcrusher', 'lying triceps extension']],
  ['triceps corda', ['rope pushdown', 'rope tricep', 'rope triceps']],
  ['triceps polia', ['pushdown']],
  ['triceps coice', ['kickback']],
  ['triceps frances', ['overhead triceps extension', 'french']],

  // Pernas
  ['agachamento', ['squat']],
  ['agachamento livre', ['barbell squat', 'barbell full squat']],
  ['agachamento hack', ['hack squat']],
  ['leg press', ['leg press', 'sled']],
  ['afundo', ['lunge']],
  ['avanco', ['lunge']],
  ['panturrilha', ['calf raise', 'calf press']],
  ['step up', ['step-up']],

  // Core
  ['abdominal', ['crunch', 'sit-up', 'situp']],
  ['abdominal infra', ['leg raise', 'knee raise']],
  ['abdominal obliquo', ['side bend', 'twist', 'oblique']],
  ['abdominal remador', ['sit-up', 'v-up']],
  ['prancha', ['plank']],
  ['prancha lateral', ['side plank']],
  ['rotacao russa', ['russian twist']],
  ['roda abdominal', ['wheel rollerout', 'wheel roller', 'rollerout']],

  // Condicionamento e levantamento olímpico
  ['burpee', ['burpee']],
  ['escalador', ['mountain climber']],
  ['arranco', ['snatch']],
  ['arremesso', ['jerk', 'clean and jerk']],
  ['caminhada do fazendeiro', ['farmers']],
  ['esteira', ['treadmill', 'run']],
  ['bicicleta', ['bike', 'bicycle']],
  ['eliptico', ['elliptical']],
  ['corda naval', ['battling ropes', 'rope']],

  // Mobilidade
  ['alongamento', ['stretch']],
  ['mobilidade', ['stretch', 'rotation', 'circles']],
]

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Padrões compilados com fronteira de palavra e memoizados no módulo.
 *
 * A fronteira não é detalhe: com `includes` simples, o padrão "fly" casa dentro de
 * "butter**fly** yoga pose", e a busca por "voador" devolvia 39 resultados cheios de posturas
 * de ioga. O `\b` restringe ao termo inteiro. A compilação acontece uma vez por padrão porque
 * `findAliasesForName` roda 1.324 vezes no carregamento do catálogo.
 */
const COMPILED_PATTERNS = new Map<string, RegExp>(
  SEARCH_ALIASES.flatMap(([, patterns]) =>
    patterns.map((pattern) => [pattern, new RegExp(`\\b${escapeRegExp(pattern)}\\b`)] as const),
  ),
)

/**
 * Termos em pt-BR que se aplicam a um exercício, dado seu nome original em inglês.
 * A comparação é em minúsculas — os nomes do dataset já vêm assim.
 */
export function findAliasesForName(originalName: string): string[] {
  const name = originalName.toLowerCase()
  const matched: string[] = []

  for (const [term, patterns] of SEARCH_ALIASES) {
    const hit = patterns.some((pattern) => COMPILED_PATTERNS.get(pattern)?.test(name) ?? false)
    if (hit) matched.push(term)
  }

  return matched
}
