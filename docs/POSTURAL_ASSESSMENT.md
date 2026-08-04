# Avaliação Postural — MVP (vertical slice)

## O que este módulo é — e o que não é

Este módulo calcula **indicadores geométricos visuais** a partir de pontos do corpo estimados por
um modelo de pose 2D. Ele **não** é, e nunca deve ser apresentado como:

- um diagnóstico médico ou fisioterapêutico;
- uma detecção de escoliose, hiperlordose, cifose ou qualquer patologia;
- uma afirmação de lesão;
- uma prescrição automática de tratamento.

Toda métrica carrega um campo `confidence` e um `status`, e toda observação automática usa
linguagem não conclusiva ("indicador visual de assimetria", "diferença angular estimada",
"requer validação do profissional", "resultado não conclusivo"). O treinador **sempre** valida,
edita ou rejeita cada métrica antes de salvar (`trainerValidation`) — ver
`src/features/assessments/postural/components/MetricsReview.tsx`.

Um teste automatizado (`tests/metrics.test.ts`) garante que nenhuma observação automática
contenha termos clínicos proibidos (escoliose, cifose, lordose, diagnóstico, lesão).

## Protocolo: quatro vistas obrigatórias

A avaliação exige **quatro capturas**, na ordem definida em `domain/posturalViews.ts`:

| Vista        | `PosturalView` | Posicionamento                                 | Silhueta-guia |
| ------------ | -------------- | ---------------------------------------------- | ------------- |
| Frontal      | `front`        | De frente para a câmera, braços soltos         | `facing`      |
| Lateral esq. | `left_side`    | Gira 90° à direita, lado esquerdo para a lente | `profile`     |
| Lateral dir. | `right_side`   | Gira 90° à esquerda, lado direito para a lente | `profile`     |
| Posterior    | `back`         | De costas para a câmera, braços soltos         | `facing`      |

`domain/posturalViews.ts` é a única fonte da verdade sobre quais vistas existem, em que ordem
aparecem, quais instruções cada uma exibe e quais landmarks são analisados nas laterais
(`SIDE_VIEW_LANDMARKS`). UI e domínio leem daqui — nenhuma lista literal de vistas é repetida.

O componente `ViewChecklist` é o hub do fluxo: mostra o progresso (`X de 4`), o estado de cada
vista (`Pendente` / `Refazer` / `Capturada`) e permite capturar ou rever qualquer uma delas.
`domain/posturalSession.ts` concentra as regras de composição — recapturar uma vista substitui
somente a captura e as métricas daquela vista, preservando a validação já feita nas demais.
Uma avaliação só é considerada completa com as quatro vistas capturadas **e aprovadas** no
quality gate (`isPosturalAssessmentComplete`).

## Escopo desta entrega

Implementado:

1. Consentimento explícito antes da câmera.
2. Checklist das quatro vistas, com progresso e recaptura individual.
3. Instruções de preparação específicas por vista.
4. Permissão de câmera, com fallback de upload.
5. Captura de um frame (foto congelada), com quality gate por vista.
6. Processamento via Pose Landmarker (BlazePose, modo `IMAGE`).
7. Overlay de skeleton + linhas de referência adaptadas à vista, com toggles.
8. Métricas por vista (ver seção abaixo).
9. Revisão/validação do treinador por métrica, agrupada por vista no resumo da avaliação.
10. Persistência do rascunho no IndexedDB (sobrevive a reload de página).

Fora do escopo (Fase 3+): as demais métricas do MVP completo (simetria de joelhos/tornozelos,
comparação bilateral entre as duas laterais, etc.), histórico e comparação entre avaliações,
geração de PDF.

## Métricas por vista

| Vista                      | Métrica                             | Medida                           | Threshold de atenção |
| -------------------------- | ----------------------------------- | -------------------------------- | -------------------- |
| `front` / `back`           | Inclinação dos ombros               | ombro esq.→dir. vs. horizontal   | 3°                   |
| `front` / `back`           | Inclinação dos quadris              | quadril esq.→dir. vs. horizontal | 3°                   |
| `left_side` / `right_side` | Alinhamento da cabeça sobre o ombro | orelha→ombro vs. vertical        | 12°                  |
| `left_side` / `right_side` | Alinhamento do tronco               | ombro→quadril vs. vertical       | 8°                   |

Os ids das métricas são prefixados pela vista (`front.shoulderInclination`,
`right_side.headAlignment`, …), o que permite manter as quatro vistas no mesmo array
`PosturalAssessment.metrics` sem colisão.

As métricas laterais reportam o **desvio absoluto em relação à vertical**, sem afirmar direção
(anterior/posterior): a direção depende de para que lado a pessoa está voltada no quadro, e
inferir isso automaticamente produziria uma afirmação mais forte do que os dados sustentam.

## Mapeamento dos estados de UI

O enunciado pede uma lista completa de estados
(`idle, requesting_permission, permission_denied, loading_model, model_ready, positioning,
detecting, low_quality, capturing, processing, success, error, camera_unavailable`). Como este
MVP processa **uma captura de cada vez** (modo `IMAGE`), não um stream contínuo com detecção em
tempo real (modo `VIDEO`), alguns estados foram consolidados:

| Estado do enunciado           | Implementação                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| `idle`                        | Fases `consent` e `checklist` (hub das quatro vistas)                                         |
| `loading_model`               | `usePoseLandmarker` → `status: 'loading'` (carregado em paralelo às instruções/consentimento) |
| `requesting_permission`       | `useCameraStream` → `status: 'requesting'`, exibido via `CameraPermissionState`               |
| `permission_denied`           | `useCameraStream` → `status: 'denied'`                                                        |
| `camera_unavailable`          | `useCameraStream` → `status: 'unavailable'` (sem `getUserMedia` ou sem dispositivo)           |
| `model_ready` + `positioning` | Fase `capture`: câmera ativa, modelo pronto, usuário se posiciona com o guia de silhueta      |
| `detecting`                   | Não existe como estado contínuo neste MVP — a detecção roda uma vez, disparada pela captura   |
| `capturing`                   | Botão "Capturar" pressionado, frame sendo extraído do vídeo                                   |
| `processing`                  | Fase `processing`: `detect()` + quality gate + cálculo de métricas rodando                    |
| `low_quality`                 | Fase `review` com `quality.passed === false`: motivos exibidos, oferece "Tentar novamente"    |
| `success`                     | Fase `review` com `quality.passed === true`: skeleton + métricas exibidos para validação      |
| `error`                       | `ErrorState` renderizado sobre falha de carregamento do modelo ou de processamento da captura |

Ver `src/features/assessments/postural/components/PosturalAssessmentFlow.tsx` para a máquina de
estados completa.

## Landmarks

Adaptador em `domain/landmarks.ts`: converte o array indexado (0–32, topologia BlazePose) do
modelo em um `Record` por nome semântico (`leftShoulder`, `rightHip`, etc.) via
`toDomainLandmarks`. Nenhum outro módulo referencia os índices numéricos diretamente.

## Geometria (funções puras, testadas)

`domain/geometry.ts`: `distance`, `midpoint`, `slopeDegrees`, `deviationFromHorizontal`,
`deviationFromVertical`, `angleBetweenPoints`, `normalizeBySize`, `bilateralComparison`. Todas
operam em coordenadas normalizadas [0,1] (x cresce à direita, y cresce para baixo — mesma
convenção do Pose Landmarker). 20 testes unitários cobrem casos normais e de borda (pontos
coincidentes, referência zero, etc.).

## Quality gate

`domain/qualityGate.ts` + `domain/postureThresholds.ts`. Verifica, por vista: landmarks
obrigatórios presentes e com visibilidade mínima, cabeça/pés dentro do enquadramento, extensão
corporal mínima (pessoa não pequena demais), inclinação extrema de câmera e compatibilidade
entre a orientação do corpo e a vista escolhida. Retorna sempre `{ passed, score, reasons[] }`,
nunca lança exceção.

Cada vista exige seus próprios landmarks: frente usa nariz + pares bilaterais; costas dispensa o
nariz; as laterais exigem orelha, ombro, quadril, joelho e tornozelo **do lado analisado**.

**Verificação de orientação** (nova nesta entrega, agora que existem quatro vistas): compara a
largura aparente dos ombros com a extensão vertical do corpo. Em uma foto frontal a razão fica
perto de 0,25; em uma de perfil, perto de 0,05. Os limites
(`maxShoulderSpanRatioForSideView: 0.18`, `minShoulderSpanRatioForBilateralView: 0.08`) são
deliberadamente folgados para reprovar apenas casos evidentes — "está de frente numa captura
lateral" e vice-versa — sem bloquear capturas legítimas com rotação parcial.

A heurística de câmera inclinada só roda nas vistas frontal e posterior: de perfil, os dois
pontos de cada par (ombros, quadris) quase se sobrepõem e o ângulo entre eles vira ruído.

## Thresholds

Todos centralizados em `domain/postureThresholds.ts`, com o aviso explícito de que são
heurísticas de produto, não referência médica validada, e exigem validação por profissional
qualificado antes de qualquer mudança de comportamento em produção.

## Coordenadas e espelhamento

O `<video>` ao vivo é espelhado via CSS (`-scale-x-100`) **apenas nas vistas frontal e
posterior**, para conforto visual durante o posicionamento — comum em apps de câmera frontal.
Nas laterais o espelhamento é desligado: ele inverteria o lado que a pessoa está mostrando e
contradiria a instrução ("gire 90° para a direita").

O frame realmente capturado (`canvas.drawImage(video, ...)`) usa as coordenadas **cruas** da
câmera, sem espelhamento, em todas as vistas, e é esse frame que é salvo e analisado. Isso
garante que "esquerda"/"direita" nos cálculos correspondem sempre à esquerda/direita anatômica
da pessoa, não ao que aparece espelhado na tela.

## Privacidade

- Processamento local no navegador; nenhum upload automático de imagem ou landmarks.
- Consentimento explícito obrigatório antes de qualquer acesso à câmera.
- Câmera sempre encerrada ao desmontar o componente (`useCameraStream`, cleanup no `useEffect`)
  — inclusive ao trocar de aba dentro do próprio wizard ou sair da página.
- Fotos salvas como `Blob` no IndexedDB, nunca Base64 ou `localStorage`.
- Nenhum `console.log` com imagem ou array completo de landmarks.

## Testes automatizados

46 testes em `src/features/assessments/postural/tests/`:

- `geometry.test.ts` — 20 casos das funções geométricas puras.
- `landmarks.test.ts` — adaptador de índices → nomes semânticos, incluindo entrada ausente/nula.
- `qualityGate.test.ts` — captura boa, landmarks ausentes, baixa confiança, pessoa pequena
  demais, entrada totalmente vazia, perfil válido em ambas as laterais e os dois casos de
  orientação incompatível (frontal rotulada como lateral e vice-versa).
- `metrics.test.ts` — frente/costas e as duas laterais: dentro do esperado, "attention",
  "not_available" quando a captura falhou, "low_confidence" quando a visibilidade está abaixo do
  mínimo, e a garantia de ausência de linguagem clínica conclusiva **nas quatro vistas**.
- `posturalSession.test.ts` — acúmulo das quatro vistas, recaptura substituindo apenas a vista
  afetada, preservação da validação do treinador nas demais, imutabilidade e regra de conclusão.

Fixtures estáticas em `tests/fixtures/landmarks.fixtures.ts` — nenhum teste depende do modelo de
pose real ou de rede.
