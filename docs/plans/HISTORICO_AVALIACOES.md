# Plano de engenharia — Histórico e evolução de avaliações

Escopo: mostrar evolução entre avaliações físicas (peso, % gordura, circunferências), delta na
lista do personal, gráfico temporal, comparação postural e exportação em PDF.

Estado verificado do repo (lido antes de planejar):

- `physicalAssessmentRepository.findByStudentId(studentId)` já devolve **todas** as avaliações do
  aluno com `body_metrics` (uma linha por avaliação, `onConflict: 'assessment_id'`) e
  `assessment_photos` montados no domínio. **Nenhuma etapa deste plano precisa de query nova ao
  banco** — só de ordenação e cálculo no cliente.
- `PhysicalAssessment.biometrics` = `Biometrics` (`weightKg`, `heightCm`, `bodyFatPercent`,
  `muscleMassKg`) e `.anthropometry` = `Anthropometry` (`chestCm`, `waistCm`, `hipCm`,
  `rightArmCm`, `leftArmCm`, `rightThighCm`, `leftThighCm`, `calvesCm`) — todos `number | null`.
- `posturalAssessment` (JSONB) carrega `metrics: PosturalMetric[]` com `id` no formato
  `${view}.${nome}` (ex.: `front.shoulderInclination`, `left_side.pelvicTilt`,
  `left_side.headAlignment`, `front.kneeTrackingDeviationLeft`), `value: number | null`,
  `unit: 'degree' | 'normalized_distance' | 'ratio'`, `status`, `confidence`.
- `package.json` **não tem** nenhuma lib de chart nem de PDF (`jspdf`/`html2canvas` ausentes).
  Deps relevantes: `motion`, `@mediapipe/tasks-vision`, `zod`, `react-hook-form`.
- `MetricCard` já suporta `trend: { direction: 'up' | 'down', label: string }` — reaproveitar em
  vez de criar componente de delta novo do zero.
- Testes existentes em `src/features/assessments/physical/tests/` (vitest + testing-library):
  `studentAssessmentsPage.test.tsx` é o ponto de extensão natural da Etapa 2.

**Nenhuma migration é necessária em nenhuma das 5 etapas.** Todos os dados exibidos já existem em
`body_metrics` e em `physical_assessments.postural_assessment`.

Ordenação: o código atual ordena por `updatedAt`. Para histórico isso é **errado** — reeditar uma
avaliação antiga a joga para o topo da linha do tempo. Ver "Decisões em aberto" (D1): a
recomendação é ordenar por `created_at` (data da coleta) em todo o módulo de histórico.

Dados hoje: 9 avaliações em 5 alunos; só o aluno `867d018a-bec2-412b-a1db-c875f7bc4edd` tem
histórico útil (4 `completed` + 1 `draft`). Com 4 pontos, gráfico e timeline são testáveis;
qualquer coisa que exija 10+ pontos não é verificável ainda.

---

## Etapa 1 — Timeline de evolução na aba Avaliação do aluno

**Objetivo:** transformar a lista de cards simples em uma linha do tempo onde cada avaliação
mostra a variação de peso, % de gordura e circunferências em relação à avaliação anterior.

### Arquivos

Criar:

- `src/features/assessments/physical/domain/assessmentEvolution.ts` — cálculo puro dos deltas.
- `src/features/assessments/physical/tests/assessmentEvolution.test.ts` — testes do cálculo.
- `src/features/assessments/physical/components/EvolutionDelta.tsx` — badge de variação
  (seta + valor + unidade), com semântica de cor configurável.
- `src/features/assessments/physical/components/AssessmentTimelineCard.tsx` — card de uma
  avaliação na linha do tempo.

Alterar:

- `src/features/assessments/physical/pages/StudentMyAssessmentsPage.tsx` — passa a renderizar a
  timeline; troca a ordenação por `createdAt` (ver D1).

### Consulta Supabase

Nenhuma nova. Continua `physicalAssessmentRepository.findByStudentId(userId)`, que já executa:

```ts
supabase.from('physical_assessments').select('*').eq('student_id', studentId)
supabase.from('body_metrics').select('*').in('assessment_id', ids)
supabase.from('assessment_photos').select('assessment_id, view, storage_path').in('assessment_id', ids)
```

O filtro `status === 'completed'` continua no cliente (RLS do aluno já barra o resto, o filtro é
defesa em profundidade). O cálculo de delta usa **só avaliações `completed`** — encadear um
rascunho do personal na timeline do aluno seria inconsistente com o que ele enxerga.

### Contrato de tipos

Em `src/features/assessments/physical/domain/assessmentEvolution.ts`:

```ts
export type EvolutionDirection = 'up' | 'down' | 'flat'
/** Como interpretar a variação visualmente. 'neutral' = sem cor de juízo. */
export type EvolutionPolarity = 'lower_is_better' | 'higher_is_better' | 'neutral'

export interface MetricDelta {
  key: string                 // 'weightKg' | 'waistCm' | ...
  label: string               // 'Peso', 'Cintura'
  unit: 'kg' | '%' | 'cm'
  current: number | null
  previous: number | null
  absolute: number | null     // current - previous; null se faltar qualquer lado
  percent: number | null      // absolute / previous; null se previous for 0 ou null
  direction: EvolutionDirection
  polarity: EvolutionPolarity
}

export interface AssessmentEvolutionEntry {
  assessment: PhysicalAssessment
  previousAssessment: PhysicalAssessment | null
  /** Dias corridos desde a avaliação anterior; null na primeira. */
  daysSincePrevious: number | null
  deltas: MetricDelta[]
}

export function buildEvolutionTimeline(
  assessments: PhysicalAssessment[],
): AssessmentEvolutionEntry[]
```

Regras: a função ordena internamente por `createdAt` ascendente para parear, e devolve
**descendente** (mais recente primeiro). Métrica sem valor em um dos lados ⇒ `absolute: null`
e a UI mostra `—`, nunca `0`. Tolerância de "flat": `Math.abs(absolute) < 0.05`.

Polaridade proposta (confirmar em D2): `weightKg` e `heightCm` ⇒ `neutral`; `bodyFatPercent` e
`waistCm` ⇒ `lower_is_better`; `muscleMassKg` ⇒ `higher_is_better`; demais circunferências ⇒
`neutral`.

### Critério de aceite

Logar como o aluno demo `867d018a-bec2-412b-a1db-c875f7bc4edd` em `/aluno/avaliacoes`:

1. Aparecem exatamente **4 cards** (as 4 `completed`; o rascunho não aparece).
2. O card mais antigo não mostra nenhum delta (mostra "Primeira avaliação").
3. Os 3 cards seguintes mostram delta de peso cujo valor confere com a subtração manual de
   `body_metrics.weight_kg` entre as duas avaliações consecutivas — conferir com um
   `select weight_kg, body_fat_percent, waist_cm from body_metrics ... order by created_at`.
4. Métrica nula no banco aparece como `—`, não como `0,0 kg`.
5. `npx tsc --noEmit` e `npm run test:run` limpos; no Safari iPhone (390px) nenhum card estoura
   horizontalmente.

### Esforço

4–6 h (2 h domínio + testes, 2–3 h UI e ajuste mobile, 1 h verificação/deploy).

### Riscos e pitfalls

- **Ordenação por `updatedAt`** (bug latente hoje): reeditar avaliação antiga reordena a
  timeline e inverte todos os deltas. Trocar por `createdAt`.
- `created_at` vem como ISO em UTC; `new Date(...).toLocaleDateString('pt-BR')` num horário
  perto da meia-noite mostra o dia anterior para UTC-3. Formatar com
  `timeZone: 'America/Sao_Paulo'` explícito.
- Divisão por zero / `previous === 0` no percentual.
- Sinal: perder 2 kg é `-2` mas visualmente "bom"; não amarrar cor a `direction`, amarrar a
  `direction + polarity`.
- `MetricCard.trend` só aceita `'up' | 'down'` — não representa `flat`. Por isso o
  `EvolutionDelta` é componente próprio, não uma extensão forçada do `MetricCard`.

---

## Etapa 2 — Delta na lista de avaliações do personal

**Objetivo:** cada linha da lista do personal mostra, ao lado da data, a variação de peso (e % de
gordura) para a avaliação imediatamente anterior daquele aluno.

### Arquivos

Alterar:

- `src/features/assessments/physical/pages/StudentAssessmentsPage.tsx`
- `src/features/assessments/physical/tests/studentAssessmentsPage.test.tsx`

Reutiliza sem alteração: `assessmentEvolution.ts` e `EvolutionDelta.tsx` da Etapa 1.

### Consulta Supabase

Nenhuma nova — mesma `findByStudentId(studentId)` já usada na página.

### Contrato de tipos

Nenhum tipo novo. Reaproveita `MetricDelta` / `AssessmentEvolutionEntry`.

Detalhe importante: a lista do personal inclui **rascunhos**. Decisão proposta (ver D3): o
rascunho é exibido na lista (com badge "Rascunho — continuar") mas é **excluído do
encadeamento** de deltas; o delta de uma `completed` é sempre contra a `completed` anterior.

### Critério de aceite

Em `/personal/alunos/867d018a-.../avaliacoes`:

1. Continuam **5 linhas** (4 completed + 1 draft) e o botão excluir segue funcional.
2. A linha do rascunho não mostra delta.
3. O delta exibido em cada `completed` é idêntico ao mostrado na tela do aluno para a mesma data
   (comparação direta entre as duas telas — é a prova de que as duas usam o mesmo cálculo).
4. Teste novo em `studentAssessmentsPage.test.tsx` cobrindo: lista com 1 avaliação (sem delta),
   com 2 (delta correto), com rascunho no meio (ignorado no encadeamento).
5. Em 390px a linha não quebra o layout do botão de excluir.

### Esforço

2–3 h.

### Riscos e pitfalls

- Densidade: a linha já tem data + badge + botão excluir. Em iPhone, delta na mesma linha vira
  amontoado; provavelmente precisa ir para uma segunda linha dentro do `<li>`.
- Excluir uma avaliação no meio muda os deltas das seguintes — recalcular a timeline após o
  `setAssessments` do delete (já é recálculo derivado se o cálculo ficar em `useMemo` sobre o
  estado, e não em estado separado).
- Mesma armadilha de ordenação por `updatedAt` da Etapa 1 — aqui é mais grave porque rascunhos
  são atualizados com frequência.

---

## Etapa 3 — Gráfico de linha (peso / % gordura / circunferência)

**Objetivo:** um gráfico temporal com seletor de métrica, mostrando a série completa do aluno.

### Decisão técnica: SVG puro, sem dependência nova

Não instalar `recharts`/`chart.js`. Justificativa concreta: a série tem 4–10 pontos, uma única
linha, sem zoom, sem tooltip complexo. `recharts` adiciona ~95 kB gzip (mais `d3-*` transitivo) a
um bundle mobile que hoje já carrega `@mediapipe/tasks-vision`. Uma polyline SVG com escala linear
são ~120 linhas de código testável e zero peso.

### Arquivos

Criar:

- `src/features/assessments/physical/domain/evolutionSeries.ts` — monta série e escalas.
- `src/features/assessments/physical/tests/evolutionSeries.test.ts`
- `src/components/charts/LineChart.tsx` — componente genérico SVG (viewBox responsivo).
- `src/features/assessments/physical/components/EvolutionChart.tsx` — seletor de métrica
  (`Tabs` ou `Select` existentes) + `LineChart`.

Alterar:

- `src/features/assessments/physical/pages/StudentMyAssessmentsPage.tsx` (gráfico acima da
  timeline).
- `src/features/assessments/physical/pages/StudentAssessmentsPage.tsx` — **opcional**, decidir em
  D4 se o personal também vê o gráfico.

### Consulta Supabase

Nenhuma nova.

### Contrato de tipos

Em `evolutionSeries.ts`:

```ts
export interface SeriesPoint {
  assessmentId: string
  /** ISO de created_at. */
  date: string
  value: number
}

export interface MetricSeries {
  key: string
  label: string
  unit: 'kg' | '%' | 'cm'
  points: SeriesPoint[]   // ascendente por data, já sem nulos
  min: number
  max: number
}

export function buildMetricSeries(
  assessments: PhysicalAssessment[],
  key: string,
): MetricSeries
export function listAvailableMetrics(assessments: PhysicalAssessment[]): { key: string; label: string }[]
```

Em `src/components/charts/LineChart.tsx`:

```ts
export interface LineChartProps {
  points: { x: number; y: number; label: string }[]  // x/y já em coordenadas de domínio
  unit: string
  ariaLabel: string
  className?: string
}
```

`listAvailableMetrics` só devolve métricas com **≥2 pontos não nulos** — sem isso o seletor
oferece métricas que renderizam um gráfico vazio.

### Critério de aceite

1. Para o aluno demo, o seletor lista apenas as métricas que realmente têm ≥2 valores no banco.
2. O gráfico de peso mostra 4 pontos, e o valor do último ponto (lido no rótulo) é igual ao
   `weight_kg` da avaliação mais recente em `body_metrics`.
3. Eixo Y não é fixado em 0: com variação de 1 kg em 80 kg a linha tem inclinação visível.
4. Métrica com 1 ponto: gráfico mostra estado vazio explicativo, não quebra.
5. Rotacionar o iPhone não estoura o SVG (viewBox + `width: 100%`).
6. `npm run build` sem dependência nova no `package.json` (`git diff package.json` vazio).

### Esforço

6–8 h (a maior parte em escalas, rótulos legíveis em 390px e estados de borda).

### Riscos e pitfalls

- Espaçamento temporal desigual: usar eixo X por **data real**, não por índice, senão um intervalo
  de 6 meses fica do mesmo tamanho de um de 1 semana e o gráfico mente.
- Valores nulos no meio da série: quebrar a linha ou pular o ponto — decidir e testar (proposta:
  pular o ponto e ligar os vizinhos, com marcador de "sem dado").
- Rótulos de data sobrepostos em tela estreita quando houver 8+ pontos.
- Acessibilidade: SVG precisa de `role="img"` + `aria-label` com resumo textual, e uma tabela
  visualmente escondida com os valores.
- Não usar `motion` para animar a linha na primeira versão; anima depois se sobrar tempo.

---

## Etapa 4 — Comparação postural entre avaliações

**Objetivo:** comparar, entre duas avaliações, as métricas posturais de joelho, pelve e cabeça
anteriorizada, mostrando variação em graus/porcentagem e mudança de status.

### Arquivos

Criar:

- `src/features/assessments/postural/domain/posturalComparison.ts`
- `src/features/assessments/postural/tests/posturalComparison.test.ts`
- `src/features/assessments/physical/components/PosturalComparison.tsx`

Alterar:

- `src/features/assessments/physical/pages/StudentMyAssessmentsPage.tsx` e/ou
  `StudentAssessmentsPage.tsx` (onde a comparação aparece — ver D5).

Reutiliza: `formatMetricValue` de
`src/features/assessments/postural/domain/measurementFormat.ts` (já formata grau vs. razão em
pt-BR com uma casa) e `POSTURAL_PROCESSING_VERSION` de `posturalAssessment.types.ts`.

### Consulta Supabase

Nenhuma nova. `physical_assessments.postural_assessment` (JSONB) já vem no `select('*')` de
`findByStudentId` e é desserializado em `PhysicalAssessment.posturalAssessment`.

### Contrato de tipos

Em `posturalComparison.ts`:

```ts
export interface PosturalMetricComparison {
  metricId: string            // ex.: 'left_side.pelvicTilt'
  label: string
  unit: PosturalMetric['unit']
  currentValue: number | null
  previousValue: number | null
  /** |current| - |previous|: negativo = desvio menor = melhora. */
  absoluteChange: number | null
  currentStatus: PosturalMetricStatus
  previousStatus: PosturalMetricStatus
  /** true quando alguma das duas medidas tem confiança baixa — exibir com ressalva. */
  lowConfidence: boolean
}

export interface PosturalComparisonResult {
  comparable: boolean
  /** Motivo em pt-BR quando comparable === false. */
  reason?: string
  metrics: PosturalMetricComparison[]
}

export function comparePosturalAssessments(
  current: PhysicalAssessment,
  previous: PhysicalAssessment,
): PosturalComparisonResult
```

Métricas no escopo desta etapa (IDs reais, conferidos em `metrics.ts`):
`front.kneeTrackingDeviationLeft`, `front.kneeTrackingDeviationRight`, `*.kneeAngle`,
`*.pelvicTilt`, `*.headAlignment` — sempre na mesma `view` dos dois lados; métrica presente em
uma avaliação e ausente na outra **não** é comparada.

`comparable: false` quando: falta `posturalAssessment` em um dos lados, ou as duas avaliações têm
`processingVersion` diferente (o texto deve dizer isso: comparar saídas de pipelines diferentes
é comparar coisas distintas).

### Critério de aceite

1. Selecionando duas avaliações do aluno demo que tenham `postural_assessment` preenchido, a tela
   lista as métricas de joelho/pelve/cabeça com valor atual, anterior e variação.
2. A variação de uma métrica confere com a subtração manual dos `value` lidos direto no JSONB
   (`select postural_assessment->'metrics' from physical_assessments where id = '...'`).
3. Comparar uma avaliação com postural contra uma sem postural mostra mensagem explícita, não
   lista vazia.
4. Métrica com `status = 'low_confidence'` aparece com ressalva visual e texto não conclusivo
   (obrigação do `docs/POSTURAL_ASSESSMENT.md`: nunca linguagem de diagnóstico).
5. Nenhuma métrica com `value: null` exibida como `0°`.

### Esforço

5–7 h. **Caveat honesto:** depende de quantas das 4 avaliações completed do aluno demo realmente
têm `postural_assessment` populado. Se forem menos de 2, essa etapa não é verificável com dados
reais e exige criar avaliações posturais de teste antes — some 1–2 h.

### Riscos e pitfalls

- Sinal dos ângulos codifica **lado**, não gravidade (documentado em `measurementFormat.ts`).
  Comparar valores crus inverte o significado; comparar módulos.
- Unidades misturadas: `kneeTrackingDeviation*` é `ratio` (mostrar em %), o resto é grau.
- `processingVersion` diferente entre avaliações antigas e novas.
- Vistas diferentes: uma avaliação pode ter só `front`, outra as 4. Parear por `id` completo
  (`view` + nome), nunca pelo nome da métrica isolado.
- Confiança baixa (`confidence`) transforma "melhora de 2°" em ruído de medição — não afirmar
  evolução sem ressalva.

---

## Etapa 5 — Exportar histórico em PDF

**Objetivo:** gerar um PDF com o histórico do aluno (dados, tabela de evolução, gráfico e
comparação postural) para entrega/impressão.

### Decisão técnica (a confirmar em D6)

Duas rotas:

- **A — `window.print()` + CSS `@media print` (recomendada para a v1).** Zero dependência nova,
  imprime o SVG do gráfico com qualidade vetorial, funciona no Safari iOS ("Compartilhar →
  Salvar em Arquivos / PDF"). Contras: não controla nome do arquivo nem quebra de página com
  precisão, e o usuário passa pela caixa de impressão do sistema.
- **B — `jspdf` (~130 kB gzip) + render manual.** Controla nome e paginação; exige redesenhar
  todo o layout no canvas do jsPDF (o gráfico SVG teria de ser reconstruído ou rasterizado) e
  adiciona peso permanente ao bundle mobile. Estimativa 2–3× maior que a rota A.

Recomendação: rota A. Se o dono exigir arquivo baixado com nome definido, é rota B.

### Arquivos (rota A)

Criar:

- `src/features/assessments/physical/pages/AssessmentHistoryPrintPage.tsx` — layout de impressão
  (uma coluna, sem navegação).
- `src/styles/print.css` (ou bloco `@media print` no CSS global existente — conferir
  `src/index.css` antes de criar arquivo novo).

Alterar:

- `src/app/router/routes.ts` e `src/app/router/router.tsx` — rota nova, ex.:
  `/personal/alunos/:studentId/avaliacoes/historico/imprimir` (e a variante do aluno, se D6 disser
  que o aluno também exporta).
- `StudentAssessmentsPage.tsx` / `StudentMyAssessmentsPage.tsx` — botão "Exportar PDF" em
  `PageHeader actions`.

### Consulta Supabase

Nenhuma nova para os dados numéricos. **Se o PDF incluir fotos**, é preciso chamar
`assessmentPhotoRepository.getSignedUrl(storagePath)` por foto (bucket privado) — URLs assinadas
expiram, então têm de ser geradas na hora da renderização, e isso adiciona latência e pontos de
falha. Ver D7.

### Contrato de tipos

Nenhum tipo novo obrigatório; a página consome `AssessmentEvolutionEntry[]`, `MetricSeries` e
`PosturalComparisonResult` das etapas anteriores. Se surgir necessidade de um agregado:

```ts
export interface AssessmentHistoryReport {
  studentName: string
  generatedAt: string
  timeline: AssessmentEvolutionEntry[]
  series: MetricSeries[]
  postural: PosturalComparisonResult | null
}
```

em `src/features/assessments/physical/domain/assessmentHistoryReport.ts`.

### Critério de aceite

1. Clicar em "Exportar PDF" abre a página de impressão sem bottom navigation, sem botões e sem
   fundo escuro (impressão em papel = fundo branco, texto escuro).
2. O PDF gerado para o aluno demo tem as 4 avaliações, com peso de cada uma igual ao banco.
3. O gráfico aparece no PDF (não uma área em branco).
4. Testado de fato no Safari do iPhone: Compartilhar → Salvar em Arquivos produz PDF legível.
5. Nenhuma dependência nova em `package.json` (rota A).

### Esforço

Rota A: 5–7 h. Rota B (`jspdf`): 12–16 h. A maior parte do custo em qualquer rota é acertar
quebra de página e o tema claro de impressão, não a geração em si.

### Riscos e pitfalls

- O app é dark-theme por tokens CSS; imprimir sem um override de tema claro gasta tinta e fica
  ilegível. Precisa de um conjunto de overrides `@media print`.
- Safari iOS tem suporte irregular a `break-inside: avoid` — tabela longa pode partir feio.
- Fotos via URL assinada: expiração e carregamento assíncrono podem disparar o `print()` antes
  das imagens carregarem. Esperar `img.decode()` de todas antes de imprimir.
- LGPD/privacidade: um PDF com fotos corporais sai do controle de acesso do app no instante em
  que é salvo. Decisão do dono, não técnica (D7).
- `window.print()` dentro de webview/PWA instalada pode se comportar diferente do Safari normal.

---

## Ordem de execução e dependências

| Etapa | Depende de | Pode ir sozinha ao ar? |
|---|---|---|
| 1 — Timeline do aluno | nada | Sim |
| 2 — Delta no personal | **Etapa 1** (`assessmentEvolution.ts`, `EvolutionDelta.tsx`) | Sim, depois da 1 |
| 3 — Gráfico | nada de código, mas idealmente a 1 (mesma ordenação por `createdAt` e mesmo vocabulário de métricas) | Sim |
| 4 — Comparação postural | nada das anteriores (usa só o JSONB) | Sim |
| 5 — PDF | **1, 3 e 4** para ter conteúdo; tecnicamente roda só com a 1 | Só depois das outras |

Caminho crítico real: **1 → 2**. As Etapas 3 e 4 são independentes entre si e da 2 — se o dono
quiser trocar a ordem depois da 2, dá, sem retrabalho. A Etapa 5 é a última porque o PDF é a
embalagem do que as outras produzem.

Fundação que a Etapa 1 estabelece e as demais herdam: ordenação por `createdAt`, formatação de
data com `timeZone: 'America/Sao_Paulo'`, e a regra de "nulo vira `—`, nunca `0`".

---

## Decisões em aberto (responder antes da Etapa 1)

- **D1 — Ordenar por `created_at` ou `updated_at`?** Recomendo `created_at` (data da coleta) em
  todo o módulo de histórico. Consequência: se uma avaliação hoje aparece fora de ordem para o
  dono, é porque foi reeditada, e a ordem vai mudar depois do deploy da Etapa 1. Confirma?
  (Alternativa mais correta e mais cara: criar coluna `assessed_on date` — **isso sim exigiria
  migration**; hoje ela não existe.)
- **D2 — Polaridade das métricas.** Peso caindo é "verde" ou neutro? O objetivo do aluno
  (emagrecer / ganhar massa) não está no banco, então ou fixamos uma convenção global (proposta:
  peso neutro, % gordura e cintura menor = melhor, massa magra maior = melhor) ou não colorimos
  nada. Qual?
- **D3 — Rascunho entra no encadeamento de deltas na tela do personal?** Proposta: não.
- **D4 — Quais circunferências aparecem na timeline por padrão?** São 8. Mostrar todas em iPhone
  vira parede de números. Proposta: peso, % gordura e cintura sempre; o resto atrás de
  "Ver todas as medidas".
- **D5 — A comparação postural (Etapa 4) aparece para o aluno, só para o personal, ou para os
  dois?** Impacta o texto (para o aluno tem de ser ainda menos conclusivo).
- **D6 — PDF: rota `window.print()` (sem dependência) ou `jspdf` (arquivo baixado com nome
  definido, +130 kB e 2–3× o esforço)?**
- **D7 — O PDF inclui as fotos da avaliação?** Se sim, muda esforço e cria questão de
  privacidade (arquivo fora do controle de acesso do app).
- **D8 — Quantas das 4 avaliações completed do aluno demo têm `postural_assessment` preenchido?**
  Se for menos de 2, a Etapa 4 precisa de dados de teste criados antes para ser verificável.

---

## DECISÕES FECHADAS (25/09/2026, pelo dono)

- **D1 — ordenação:** usar `createdAt`, não `updatedAt` (corrige inversão de delta ao reeditar avaliação antiga).
- **D2 — polaridade:** peso **neutro**; % gordura e cintura **menor = verde**; massa magra **maior = verde**.
- **D3 — rascunho:** fora do encadeamento de deltas.
- **D4 — medidas na timeline (mobile):** peso, % gordura e cintura sempre; as outras 5 circunferências atrás de "Ver todas as medidas".
- **D5 — comparação postural (Etapa 4):** só na visão do **personal**, linguagem técnica.
- **D6 — PDF:** `window.print()` (sem dependência nova).
- **D8 — RESPONDIDO:** as 4 avaliações `completed` do aluno demo **têm** `postural_assessment` preenchido → Etapa 4 é verificável.

### Bloqueio atual da Etapa 1
`body_metrics` do aluno demo está **100% nula** (peso, % gordura, cintura = NULL nas 5 avaliações).
Decisão: o dono preenche a biometria **pela UI do personal** em ao menos 2-3 avaliações antes da Etapa 1 começar
(não seedar via script — quer dado real para validar o fluxo de gravação também).
