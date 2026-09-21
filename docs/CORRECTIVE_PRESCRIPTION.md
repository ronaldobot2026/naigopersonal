# Correção Postural — Prescrição de Exercícios (Fase 14)

> **Status**: especificação para implementação. Ainda não codificado: `grep -ri "corretiv|corrective|prescric" src/` = **0 resultados**.
> **Depende de**: Avaliação Postural (Fase 9, concluída) · Catálogo de Exercícios (concluído) · Supabase (Fase 6, concluída).

## 1. Origem da demanda — o que o Windson pediu

Fonte: **3 áudios + 3 fotos enviados em 2026-09-21, 17h11–17h17** (transcritos com Whisper `small`, pt).

**Áudio 1 (60s) — análise incompleta:**
> *"na avaliação postural lá, ele faz a avaliação postural ali, só que ele não está 100% porque na parte de baixo ali, **do joelho para baixo**, ele tem uma **hiperextensão** da parte de baixo ali. Ele não fala isso, ele só fala do quadril, alinhamento da cabeça..."*
>
> *"E não está dando diagnóstico do treinamento para ele fazer... **logo em seguida, eu fazia a avaliação ali e já tinha os exercícios** para essa avaliação postural, para ele melhorar..."*

**Áudio 2 (38s) — o vínculo que falta:**
> *"Só que ele não dá o diagnóstico correto ali, que tá um pouco mais alto... Quando termina de fazer a avaliação, **ele não dá o treino que antigamente dava**. Ó, você tem que fazer a **elevação puxada, remada alta**, por exemplo, pra solucionar esse caso dele, do ombro, sabe? Então, na avaliação, não tá aparecendo isso. **O treino que tem que é montado pra ele executar pra melhorar essa postura dele**."*

**Áudio 3 (8s) — o objetivo:**
> *"Agora consegui fazer o diagnóstico e a prescrição de treino para a avaliação postural."*

**Tradução em requisito, em 3 frases:**
1. A análise precisa enxergar **do joelho para baixo** (hoje os landmarks existem, mas não há métrica).
2. Ao terminar a avaliação, o app deve **vincular cada alteração a exercícios corretivos concretos** — o exemplo dele: **ombro elevado → remada alta / elevação puxada**.
3. O resultado é um **treino corretivo montado para o aluno executar**, integrado ao fluxo (não uma tela separada).

⚠️ **Limite que a implementação NÃO pode cruzar:** o módulo postural já declara em
`postureThresholds.ts` que os valores são *"heurísticas de produto, não referência médica
validada... nunca um diagnóstico"*. A prescrição mantém isso: **o app sugere, o profissional
decide.** Nenhum texto gerado pode afirmar diagnóstico clínico.

---

## 2. O vínculo alteração → exercício (núcleo do pedido)

### 2.1 Modelo conceitual

```
Achado (finding)          →  Regra de correção       →  Grupos musculares      →  Exercícios
─────────────────            ────────────────────       ──────────────────        ───────────
kneeHyperextension           de `FindingKind`           `target` do catálogo      filtrados por
(attention, lado, grau)      para lista de alvos        + `equipment` disponível  região/equip.
```

O vínculo **não é hardcoded no código de UI** — é uma **tabela declarativa** em
`domain/correctivePrescription.ts`, versionada e auditável, porque é conhecimento de treino
(não código) e o Windson vai querer ajustar.

### 2.2 Tabela de vínculos (concreta, com alvos REAIS do catálogo)

Alvos disponíveis no catálogo (1324 exercícios, 19 `target`):
`abs(169) · pectorals(158) · biceps(151) · glutes(144) · delts(143) · triceps(141) ·
upper back(88) · lats(81) · calves(59) · quads(44) · forearms(37) · cardiovascular system(29) ·
hamstrings(28) · spine(19) · traps(15) · adductors(6) · serratus anterior(5) · abductors(5) ·
levator scapulae(2)`

| Achado (`FindingKind`) | O que é | Alvos corretivos (`target`) | Exemplo de exercício |
|---|---|---|---|
| `shoulder_elevation` | ombro acima da linha (o caso do áudio) | `traps`, `levator scapulae`, `delts` | **remada alta**, elevação puxada, encolhimento |
| `shoulder_depression` | ombro abaixo da linha | `delts`, `traps` | elevação lateral, desenvolvimento |
| `hip_inclination` | quadril fora da horizontal | `glutes`, `abs`, `adductors`, `abductors` | elevação pélvica, prancha lateral, abdução |
| `head_forward` | cabeça anteriorizada | `levator scapulae`, `traps`, `neck`* | retração cervical, encolhimento |
| `trunk_lateral_deviation` | tronco inclinado | `abs`, `spine`, `lats`, `upper back` | prancha, remada, dead bug |
| **`knee_hyperextension`** | **joelho além de 180° (o que ele pediu)** | `hamstrings`, `glutes`, `quads` | flexora, stiff, leg curl nórdico |
| `knee_valgus` | joelho para dentro | `glutes`, `abductors`, `quads` | abdução com banda, agachamento com banda |
| `knee_varus` | joelho para fora | `adductors`, `quads` | adutora, agachamento sumô |
| `pelvic_tilt_anterior` | bacia anteriorizada | `abs`, `glutes`, `hamstrings` | prancha, ponte, dead bug |
| `pelvic_tilt_posterior` | bacia retroversa | `spine`, `quads`, `abs` | extensão de tronco, hip thrust |

\* `neck` existe como `bodyPart` (2 exercícios), não como `target` — filtrar por `bodyPart`.

### 2.3 Interfaces

```ts
// domain/correctivePrescription.types.ts
export type FindingKind =
  | 'shoulder_elevation' | 'shoulder_depression'
  | 'hip_inclination' | 'head_forward' | 'trunk_lateral_deviation'
  | 'knee_hyperextension' | 'knee_valgus' | 'knee_varus'
  | 'pelvic_tilt_anterior' | 'pelvic_tilt_posterior'

export type FindingSide = 'left' | 'right' | 'bilateral'

/** Um achado derivado das métricas. NUNCA um diagnóstico. */
export interface PosturalFinding {
  id: string
  kind: FindingKind
  side: FindingSide
  /** Métrica de origem (id em PosturalMetric) — rastreabilidade. */
  sourceMetricId: string
  view: PosturalView
  /** Valor medido e limiar cruzado, para o treinador conferir. */
  measuredValue: number
  thresholdValue: number
  /** Frase não-conclusiva, ex.: "ombro direito ~4,2° acima da linha dos ombros". */
  evidence: string
  /** Grupo muscular-alvo sugerido (alvos do catálogo). */
  targetMuscles: string[]
  /** Justificativa em 1 linha, revisável pelo treinador. */
  rationale: string
}

/** Item do plano corretivo — exercício do catálogo + prescrição de treino. */
export interface CorrectivePlanItem {
  id: string
  exerciseId: string          // id do catálogo (ex.: "0001")
  exerciseName: string
  findingId: string           // vínculo com o achado que o originou
  targetMuscles: string[]
  sets: number
  reps: string                // "12-15" — string por admitir faixa
  /** Como o app chegou aqui: 'suggested' (automático) | 'added'/'replaced' (treinador). */
  origin: 'suggested' | 'added' | 'replaced'
  /** Treinador pode aceitar/trocar/remover — espelha TrainerValidation do módulo postural. */
  validation: 'pending' | 'accepted' | 'edited' | 'rejected'
  trainerNote?: string
}

export interface CorrectivePlan {
  id: string
  studentId: string
  assessmentId: string
  findings: PosturalFinding[]
  items: CorrectivePlanItem[]
  status: 'draft' | 'published'
  createdAt: string
  publishedAt?: string
  /** Versão do motor de regras que gerou as sugestões. */
  prescriptionVersion: string
}

export const CORRECTIVE_PRESCRIPTION_VERSION = '2026.1'
```

---

## 3. Seleção de exercícios (o algoritmo)

### 3.1 Entrada
- `finding.targetMuscles` (alvos definidos na tabela 2.2)
- `availableEquipment`: equipamentos do local de treino (perfil do aluno) — **obrigatório**,
  senão o app sugere exercício que ele não consegue executar
- catálogo (`exerciseCatalogRepository`)

### 3.2 Regras de seleção

```ts
// domain/correctiveExerciseSelection.ts
selectCorrectiveExercises(finding, catalog, { availableEquipment, perFinding = 3 })
```

0. **Excluir** exercícios que não são de fortalecimento — **antes de qualquer outro filtro**:
   - alongamentos (nome original com `stretch`) — **57 no catálogo**
   - saltos / impacto (nome original com `jump`) — **17 no catálogo**
   O exercício corretivo prescrito é de **fortalecimento**. Alongar o músculo encurtado é *outra
   etapa* do protocolo, não substituto do exercício corretivo — e salto é contraindicado para
   achado de joelho (impacto em articulação já em desalinhamento).
   > **Por que esta regra existe** (defeito encontrado na validação de 21/09): sem ela, o filtro
   > de peso corporal escolhia `rear deltoid stretch` / `neck side stretch` para "ombro elevado",
   > enquanto as **83 opções com barra e halteres** (incluindo as 9 variantes de *remada alta*
   > que o Windson citou) nunca apareciam. Alongamento dominava a sugestão de fortalecimento.
1. **Filtrar** exercícios cujo `target` ∈ `finding.targetMuscles`.
2. **Filtrar** por `equipment` ∈ `availableEquipment` (normalizar `body weight` como sempre
   disponível). Equipamento é critério de **disponibilidade, nunca de prioridade**: peso corporal
   não é melhor para corrigir postura, é apenas mais acessível.
3. **Priorizar** (ordem decrescente):
   a. exercícios cujo `secondaryMuscles` também tocam os alvos do achado (sinergia)
   b. exercícios com `steps` mais curtos (mais simples de executar sozinho)
   c. desempate final pelo `id` — estável, garante determinismo
4. **Diversificar**: não repetir o mesmo `muscleGroup` no mesmo achado, se houver alternativa.
5. **Cortar** em `perFinding` (padrão **3**).
6. **Fallback**, nesta ordem, se o resultado for vazio:
   - relaxar `equipment` (aceitar qualquer um, marcando `origin: 'suggested'` + aviso)
   - relaxar para `bodyPart` em vez de `target`
   - **devolver vazio e dizer o motivo na tela** — nunca inventar exercício fora do catálogo.

> **Critério de aceite desta seção:** para o achado `shoulder_elevation` com equipamento de casa
> (barra, halteres, elástico, peso corporal), a sugestão **precisa incluir uma variação de remada
> alta ou elevação puxada** — é o exemplo que o Windson deu no áudio de 21/09.

### 3.3 Prescrição padrão (ajustável pelo treinador)
- Achado `attention` → `3 × 12-15`
- Correção de padrão (joelho, pelve) → `3 × 10-12`
- O treinador edita séries/reps livremente; o app só sugere.

### 3.4 Guardas
- **Determinismo**: mesma entrada (achado + equipamento + catálogo) → mesma saída. Nada de
  `Math.random()` — o treinador precisa poder confiar e reconferir.
- **Testável sem rede**: a seleção é função pura sobre a lista do catálogo; o teste usa um
  recorte fixo do JSON.

---

## 4. Métricas que faltam (o "joelho para baixo" do áudio)

Os landmarks de **joelho (25/26), tornozelo (27/28), calcanhar (29/30) e pé (31/32)** já são
capturados pelo MediaPipe (33 pontos) — **falta só a métrica**.

Adicionar em `domain/metrics.ts` + limiares em `postureThresholds.ts`:

| id | label (pt-BR, não-conclusiva) | vista | medida | limiar sugerido |
|---|---|---|---|---|
| `kneeAngle` | "Alinhamento do joelho" | `left_side` / `right_side` | ângulo quadril–joelho–tornozelo; hiperextensão se > 180° | `> 185°` = attention |
| `kneeTrackingDeviation` | "Alinhamento do joelho em relação ao pé" | `front` / `back` | desvio lateral joelho ↔ linha tornozelo–quadril (valgo/varo) | `> 3%` da largura do corpo = attention |
| `pelvicTilt` | "Inclinação da pelve" | `left_side` / `right_side` | ângulo ombro–quadril–joelho | `> 10°` de desvio = attention |

`kneeAngle` precisa de **validação humana antes de ir a produção** (o próprio módulo exige isso):
um profissional de educação física confirma o limiar. Deixar **comentário explícito** no código,
como os outros limiares já têm.

---

## 5. Fluxo e telas

```
[Fase 9 já existe]                       [NOVO — Fase 14]
Captura 4 vistas → Métricas → Revisão → Achados → Sugestão → Revisão do treinador → Publicar → Aluno
```

**5.1 Tela "Achados"** (pós-avaliação, dentro de `PosturalAssessmentFlow`)
- Lista os achados em `attention` com: vista, valor medido × limiar, frase de evidência, miniatura da foto
- Achados `within_expected_range` ficam recolhidos ("sem alteração relevante")
- Se **nenhum** achado: mensagem neutra, sem inventar problema

**5.2 Tela "Sugestão corretiva"** (por achado)
- Mostra os exercícios sugeridos (com mídia 180×180 + `ExerciseAttribution` "© Gym visual")
- Botões: **Aceitar** · **Trocar** (abre busca no catálogo) · **Remover** · **Adicionar outro**
- Campo de séries/reps por item + nota do treinador
- Múltiplos achados podem compartilhar exercício — **deduplicar** ao montar o plano final

**5.3 Tela "Plano corretivo do aluno"**
- Lista os itens publicados, agrupados por achado
- Aluno pode marcar **"executado"** (vira histórico simples)
- Sempre visível: **o que o app detectou não é diagnóstico médico**

---

## 6. Dados (Supabase)

O ROADMAP já registra que a avaliação postural vive como `jsonb` em
`physical_assessments.postural_assessment` e que a normalização é Fase 14. Mínimo para esta entrega:

```sql
corrective_plans        (id, student_id, assessment_id, status, prescription_version,
                         created_at, published_at, findings jsonb)
corrective_plan_items   (id, plan_id, exercise_id, finding_id, target_muscles text[],
                         sets int, reps text, origin text, validation text, trainer_note text)
```

- **RLS**: aluno lê apenas o próprio plano (`student_id = auth.uid()` via vínculo de treinador);
  treinador escreve apenas nos planos dos próprios alunos. Seguir a policy já corrigida no
  pentest de 2026-09-21 (`evaluator_id = auth.uid()` é o precedente correto).
- Publicar é **ação explícita** do treinador (`draft` → `published`); nada vai pro aluno sozinho.

---

## 7. Definição de pronto (DoD)

- [ ] `FindingKind` cobre os 10 achados da tabela 2.2, com tabela de vínculo declarativa e versionada
- [ ] `kneeAngle` implementado, com teste unitário e limiar comentado como "revisar com profissional"
- [ ] `selectCorrectiveExercises` é função pura, determinística, com teste cobrindo: exclusão de alongamento/salto, filtro por equipamento, fallback, corte em 3, catálogo vazio
- [ ] **Teste de aceite do cliente**: achado `shoulder_elevation` + equipamento de casa retorna uma variação de **remada alta** ou **elevação puxada** (exemplo do áudio do Windson)
- [ ] Tela de achados + tela de revisão + plano publicado
- [ ] Deduplicação de exercícios entre achados
- [ ] `ExerciseAttribution` em toda tela com mídia (exigência de licença Gym visual)
- [ ] Nenhum texto afirmando diagnóstico clínico
- [ ] `npm run typecheck`, `lint`, `test:run`, `build` verdes
- [ ] Migration + RLS com teste de isolamento entre dois alunos (padrão do pentest)

## 8. Fora de escopo (não cortar escopo aqui sem falar com o Windson)
- Histórico/comparação de planos entre avaliações (Fase 14 completa)
- PDF do plano corretivo (Fase 13)
- Prescrição nutricional (Fase 16 — ato do CFN, o app não prescreve)
