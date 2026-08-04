/**
 * Vocabulário usado para traduzir os nomes dos exercícios do dataset para pt-BR.
 *
 * Os nomes seguem um padrão bem regular em inglês — `[modificadores] [equipamento] [movimento]`
 * — o que permite traduzi-los por regras em vez de manter 1.324 traduções manuais. O algoritmo
 * está em `exerciseNaming.ts`; aqui ficam apenas os dados.
 *
 * Gênero gramatical importa: "supino inclinado" mas "rosca inclinada". Por isso cada movimento
 * declara seu gênero e cada modificador tem as duas formas.
 */

/** Termo de movimento em pt-BR, com o gênero que rege a concordância dos modificadores. */
export interface MovementTerm {
  pt: string
  gender: 'm' | 'f'
}

/**
 * Movimentos reconhecidos, das expressões mais longas para as mais curtas — o algoritmo aplica
 * correspondência por maior comprimento, então "bench press" vence "press".
 */
export const MOVEMENTS: ReadonlyArray<readonly [string, MovementTerm]> = [
  // Peito
  ['bench press', { pt: 'supino', gender: 'm' }],
  ['chest press', { pt: 'supino', gender: 'm' }],
  ['chest fly', { pt: 'crucifixo', gender: 'm' }],
  ['pec deck fly', { pt: 'crucifixo na máquina', gender: 'm' }],
  ['push-up', { pt: 'flexão de braço', gender: 'f' }],
  ['push up', { pt: 'flexão de braço', gender: 'f' }],
  ['pushup', { pt: 'flexão de braço', gender: 'f' }],
  ['pullover', { pt: 'pullover', gender: 'm' }],
  ['fly', { pt: 'crucifixo', gender: 'm' }],
  ['flye', { pt: 'crucifixo', gender: 'm' }],
  ['crossover', { pt: 'cross-over', gender: 'm' }],
  ['cross-over', { pt: 'cross-over', gender: 'm' }],

  // Costas
  ['lat pulldown', { pt: 'puxada alta', gender: 'f' }],
  ['pulldown', { pt: 'puxada', gender: 'f' }],
  ['pull-down', { pt: 'puxada', gender: 'f' }],
  ['upright row', { pt: 'remada alta', gender: 'f' }],
  ['bent-over row', { pt: 'remada curvada', gender: 'f' }],
  ['row', { pt: 'remada', gender: 'f' }],
  ['pull-up', { pt: 'barra fixa', gender: 'f' }],
  ['pullup', { pt: 'barra fixa', gender: 'f' }],
  ['chin-up', { pt: 'barra fixa supinada', gender: 'f' }],
  ['muscle-up', { pt: 'muscle-up', gender: 'm' }],
  ['shrug', { pt: 'encolhimento', gender: 'm' }],
  ['hyperextension', { pt: 'hiperextensão', gender: 'f' }],
  ['good morning', { pt: 'bom dia', gender: 'm' }],

  // Ombros
  ['shoulder press', { pt: 'desenvolvimento', gender: 'm' }],
  ['military press', { pt: 'desenvolvimento militar', gender: 'm' }],
  ['overhead press', { pt: 'desenvolvimento', gender: 'm' }],
  ['arnold press', { pt: 'desenvolvimento Arnold', gender: 'm' }],
  ['lateral raise', { pt: 'elevação lateral', gender: 'f' }],
  ['front raise', { pt: 'elevação frontal', gender: 'f' }],
  ['rear delt fly', { pt: 'crucifixo inverso', gender: 'm' }],
  ['rear delt row', { pt: 'remada para deltoide posterior', gender: 'f' }],
  ['face pull', { pt: 'face pull', gender: 'm' }],

  // Bíceps e antebraço
  ['preacher curl', { pt: 'rosca scott', gender: 'f' }],
  ['concentration curl', { pt: 'rosca concentrada', gender: 'f' }],
  ['hammer curl', { pt: 'rosca martelo', gender: 'f' }],
  ['zottman curl', { pt: 'rosca Zottman', gender: 'f' }],
  ['spider curl', { pt: 'rosca spider', gender: 'f' }],
  ['drag curl', { pt: 'rosca drag', gender: 'f' }],
  ['wrist curl', { pt: 'rosca de punho', gender: 'f' }],
  ['curl', { pt: 'rosca', gender: 'f' }],

  // Tríceps
  ['skullcrusher', { pt: 'tríceps testa', gender: 'm' }],
  ['skull crusher', { pt: 'tríceps testa', gender: 'm' }],
  ['triceps extension', { pt: 'extensão de tríceps', gender: 'f' }],
  ['tricep extension', { pt: 'extensão de tríceps', gender: 'f' }],
  ['triceps pushdown', { pt: 'tríceps na polia', gender: 'm' }],
  ['pushdown', { pt: 'tríceps na polia', gender: 'm' }],
  ['kickback', { pt: 'tríceps coice', gender: 'm' }],
  ['dip', { pt: 'mergulho', gender: 'm' }],

  // Pernas
  ['leg press', { pt: 'leg press', gender: 'm' }],
  ['leg extension', { pt: 'cadeira extensora', gender: 'f' }],
  ['leg curl', { pt: 'mesa flexora', gender: 'f' }],
  ['hack squat', { pt: 'agachamento hack', gender: 'm' }],
  ['sissy squat', { pt: 'agachamento sissy', gender: 'm' }],
  ['split squat', { pt: 'agachamento búlgaro', gender: 'm' }],
  ['squat', { pt: 'agachamento', gender: 'm' }],
  ['romanian deadlift', { pt: 'levantamento terra romeno', gender: 'm' }],
  ['stiff leg deadlift', { pt: 'levantamento terra stiff', gender: 'm' }],
  ['sumo deadlift', { pt: 'levantamento terra sumô', gender: 'm' }],
  ['deadlift', { pt: 'levantamento terra', gender: 'm' }],
  ['lunge', { pt: 'afundo', gender: 'm' }],
  ['step-up', { pt: 'step-up', gender: 'm' }],
  ['calf raise', { pt: 'elevação de panturrilha', gender: 'f' }],
  ['calf press', { pt: 'panturrilha no leg press', gender: 'f' }],
  ['hip thrust', { pt: 'elevação pélvica', gender: 'f' }],
  ['glute bridge', { pt: 'ponte de glúteo', gender: 'f' }],
  ['bridge', { pt: 'ponte', gender: 'f' }],
  ['abduction', { pt: 'abdução', gender: 'f' }],
  ['adduction', { pt: 'adução', gender: 'f' }],

  // Core
  ['russian twist', { pt: 'abdominal russo', gender: 'm' }],
  ['sit-up', { pt: 'abdominal completo', gender: 'm' }],
  ['situp', { pt: 'abdominal completo', gender: 'm' }],
  ['crunch', { pt: 'abdominal', gender: 'm' }],
  ['plank', { pt: 'prancha', gender: 'f' }],
  ['leg raise', { pt: 'elevação de pernas', gender: 'f' }],
  ['knee raise', { pt: 'elevação de joelhos', gender: 'f' }],
  ['mountain climber', { pt: 'escalador', gender: 'm' }],
  ['rollerout', { pt: 'rollout abdominal', gender: 'm' }],
  ['roll-out', { pt: 'rollout abdominal', gender: 'm' }],
  ['v-up', { pt: 'abdominal em V', gender: 'm' }],
  ['jackknife', { pt: 'abdominal canivete', gender: 'm' }],
  ['scissor', { pt: 'tesoura', gender: 'f' }],
  ['windmill', { pt: 'moinho de vento', gender: 'm' }],

  // Levantamento olímpico e condicionamento
  ['power clean', { pt: 'power clean', gender: 'm' }],
  ['clean', { pt: 'clean', gender: 'm' }],
  ['snatch', { pt: 'arranco', gender: 'm' }],
  ['jerk', { pt: 'arremesso', gender: 'm' }],
  ['thruster', { pt: 'thruster', gender: 'm' }],
  ['burpee', { pt: 'burpee', gender: 'm' }],
  ['jumping jack', { pt: 'polichinelo', gender: 'm' }],
  ['jump', { pt: 'salto', gender: 'm' }],
  ['swing', { pt: 'swing', gender: 'm' }],
  ['throw', { pt: 'arremesso', gender: 'm' }],
  ['slam', { pt: 'slam', gender: 'm' }],
  ['run', { pt: 'corrida', gender: 'f' }],
  ['sprint', { pt: 'tiro de velocidade', gender: 'm' }],
  ['walk', { pt: 'caminhada', gender: 'f' }],
  ['carry', { pt: 'caminhada com carga', gender: 'f' }],
  ['crawl', { pt: 'deslocamento no solo', gender: 'm' }],

  // Mobilidade e genéricos
  ['stretch', { pt: 'alongamento', gender: 'm' }],
  ['rotation', { pt: 'rotação', gender: 'f' }],
  ['twist', { pt: 'rotação de tronco', gender: 'f' }],
  ['extension', { pt: 'extensão', gender: 'f' }],
  ['flexion', { pt: 'flexão', gender: 'f' }],
  ['raise', { pt: 'elevação', gender: 'f' }],
  ['press', { pt: 'pressão', gender: 'f' }],
  ['pull', { pt: 'puxada', gender: 'f' }],
]

/** Modificadores, com as duas formas de concordância. */
export const MODIFIERS: ReadonlyArray<readonly [string, { m: string; f: string }]> = [
  ['close-grip', { m: 'com pegada fechada', f: 'com pegada fechada' }],
  ['close grip', { m: 'com pegada fechada', f: 'com pegada fechada' }],
  ['wide-grip', { m: 'com pegada aberta', f: 'com pegada aberta' }],
  ['wide grip', { m: 'com pegada aberta', f: 'com pegada aberta' }],
  ['narrow grip', { m: 'com pegada fechada', f: 'com pegada fechada' }],
  ['neutral grip', { m: 'com pegada neutra', f: 'com pegada neutra' }],
  ['reverse-grip', { m: 'com pegada pronada', f: 'com pegada pronada' }],
  ['reverse grip', { m: 'com pegada pronada', f: 'com pegada pronada' }],
  ['underhand', { m: 'com pegada supinada', f: 'com pegada supinada' }],
  ['overhand', { m: 'com pegada pronada', f: 'com pegada pronada' }],
  ['behind neck', { m: 'atrás da nuca', f: 'atrás da nuca' }],
  ['behind the neck', { m: 'atrás da nuca', f: 'atrás da nuca' }],
  ['one arm', { m: 'unilateral', f: 'unilateral' }],
  ['single arm', { m: 'unilateral', f: 'unilateral' }],
  ['one leg', { m: 'unilateral', f: 'unilateral' }],
  ['single leg', { m: 'unilateral', f: 'unilateral' }],
  ['bent-over', { m: 'curvado', f: 'curvada' }],
  ['bent over', { m: 'curvado', f: 'curvada' }],
  ['incline', { m: 'inclinado', f: 'inclinada' }],
  ['decline', { m: 'declinado', f: 'declinada' }],
  ['seated', { m: 'sentado', f: 'sentada' }],
  ['sitted', { m: 'sentado', f: 'sentada' }],
  ['standing', { m: 'em pé', f: 'em pé' }],
  ['lying', { m: 'deitado', f: 'deitada' }],
  ['kneeling', { m: 'ajoelhado', f: 'ajoelhada' }],
  ['prone', { m: 'em decúbito ventral', f: 'em decúbito ventral' }],
  ['supine', { m: 'em decúbito dorsal', f: 'em decúbito dorsal' }],
  ['hanging', { m: 'na barra', f: 'na barra' }],
  ['inverted', { m: 'invertido', f: 'invertida' }],
  ['reverse', { m: 'inverso', f: 'inversa' }],
  ['alternate', { m: 'alternado', f: 'alternada' }],
  ['alternating', { m: 'alternado', f: 'alternada' }],
  ['overhead', { m: 'acima da cabeça', f: 'acima da cabeça' }],
  ['front', { m: 'frontal', f: 'frontal' }],
  ['rear', { m: 'posterior', f: 'posterior' }],
  ['lateral', { m: 'lateral', f: 'lateral' }],
  ['side', { m: 'lateral', f: 'lateral' }],
  ['oblique', { m: 'oblíquo', f: 'oblíqua' }],
  ['isometric', { m: 'isométrico', f: 'isométrica' }],
  ['walking', { m: 'caminhando', f: 'caminhando' }],
  ['jumping', { m: 'com salto', f: 'com salto' }],
  ['twisting', { m: 'com rotação', f: 'com rotação' }],
  ['weighted', { m: 'com carga', f: 'com carga' }],
  ['assisted', { m: 'assistido', f: 'assistida' }],
  ['wall', { m: 'na parede', f: 'na parede' }],
  ['floor', { m: 'no solo', f: 'no solo' }],
  ['bench', { m: 'no banco', f: 'no banco' }],
  ['straight arm', { m: 'com braços estendidos', f: 'com braços estendidos' }],
  ['straight leg', { m: 'com pernas estendidas', f: 'com pernas estendidas' }],
  ['bent knee', { m: 'com joelhos flexionados', f: 'com joelhos flexionados' }],
  ['on knees', { m: 'ajoelhado', f: 'ajoelhada' }],
  ['wide', { m: 'aberto', f: 'aberta' }],
  ['narrow', { m: 'fechado', f: 'fechada' }],
  ['internal', { m: 'interno', f: 'interna' }],
  ['external', { m: 'externo', f: 'externa' }],
  ['high', { m: 'alto', f: 'alta' }],
  ['low', { m: 'baixo', f: 'baixa' }],
  ['half', { m: 'parcial', f: 'parcial' }],
  ['full', { m: 'completo', f: 'completa' }],
  ['split', { m: 'unilateral', f: 'unilateral' }],
  ['jump', { m: 'com salto', f: 'com salto' }],
  ['static', { m: 'estático', f: 'estática' }],
  ['dynamic', { m: 'dinâmico', f: 'dinâmica' }],
  ['negative', { m: 'negativo', f: 'negativa' }],
  ['close', { m: 'fechado', f: 'fechada' }],
  ['parallel', { m: 'paralelo', f: 'paralela' }],
]

/**
 * Substantivos anatômicos que aparecem soltos nos nomes ("cable front shoulder raise"). Sem
 * eles, sobrariam palavras em inglês no meio do nome traduzido.
 */
export const BODY_NOUNS_IN_NAME: ReadonlyArray<readonly [string, string]> = [
  ['shoulder', 'de ombro'],
  ['shoulders', 'de ombros'],
  ['biceps', 'de bíceps'],
  ['bicep', 'de bíceps'],
  ['triceps', 'de tríceps'],
  ['tricep', 'de tríceps'],
  ['chest', 'de peito'],
  ['calf', 'de panturrilha'],
  ['calves', 'de panturrilhas'],
  ['glute', 'de glúteo'],
  ['glutes', 'de glúteos'],
  ['hamstring', 'de posteriores'],
  ['hamstrings', 'de posteriores'],
  ['quads', 'de quadríceps'],
  ['hip', 'de quadril'],
  ['knee', 'de joelho'],
  ['knees', 'de joelhos'],
  ['ankle', 'de tornozelo'],
  ['wrist', 'de punho'],
  ['neck', 'de pescoço'],
  ['back', 'de costas'],
  ['lat', 'de dorsal'],
  ['abs', 'abdominal'],
  ['leg', 'de perna'],
  ['legs', 'de pernas'],
  ['arm', 'de braço'],
  ['arms', 'de braços'],
]

/**
 * Equipamento como aparece no nome, mapeado para o complemento em pt-BR. Ordenado da expressão
 * mais longa para a mais curta, pelo mesmo motivo dos movimentos.
 */
export const EQUIPMENT_IN_NAME: ReadonlyArray<readonly [string, string]> = [
  ['olympic barbell', 'com barra olímpica'],
  ['ez-barbell', 'com barra W'],
  ['ez barbell', 'com barra W'],
  ['ez-bar', 'com barra W'],
  ['trap bar', 'com barra hexagonal'],
  ['smith machine', 'no Smith'],
  ['smith', 'no Smith'],
  ['leverage machine', 'na máquina'],
  ['leverage', 'na máquina'],
  ['lever', 'na máquina'],
  ['resistance band', 'com faixa elástica'],
  ['stability ball', 'na bola suíça'],
  ['medicine ball', 'com medicine ball'],
  ['bosu ball', 'no Bosu'],
  ['wheel roller', 'com roda abdominal'],
  ['kettlebell', 'com kettlebell'],
  ['dumbbells', 'com halteres'],
  ['dumbbell', 'com halteres'],
  ['barbell', 'com barra'],
  ['cable', 'no cabo'],
  ['sled', 'no leg press'],
  ['band', 'com elástico'],
  ['rope', 'na corda'],
  ['roller', 'com rolo'],
  ['bodyweight', 'com peso corporal'],
  ['body weight', 'com peso corporal'],
]
