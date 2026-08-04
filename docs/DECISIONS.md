# Decisões técnicas e premissas

Registro das decisões tomadas durante a Fase 0/1/2 (vertical slice) e o racional por trás de
cada uma. Decisões reversíveis foram resolvidas pela alternativa mais simples, conforme
orientado — ver anotação "reversível" em cada item.

## Estrutura do repositório

- **A raiz do repositório virou a raiz do app Vite** (não uma subpasta `app/`), já que não
  havia projeto pré-existente. _Reversível: mover para subpasta depois é um `git mv` trivial._
- **Originais do Stitch movidos** (não copiados) para `reference/stitch-original/`. Como o
  repositório não tinha histórico git antes desta sessão, mover em vez de copiar não perde
  nada e evita duplicar ~13 telas. _Reversível: é apenas uma reorganização de pastas._
- Um `git init` foi executado no início da sessão para permitir rastrear esta migração grande
  incrementalmente — nenhum commit foi criado automaticamente.

## Stack

- **Tailwind v4** via `@tailwindcss/vite`, com tokens declarados em CSS puro (`@theme` em
  `src/styles/tokens.css`) em vez de `tailwind.config.js`. É a abordagem "CSS-first" oficial da
  v4 e mapeia diretamente para o pedido de ter `tokens.css` como fonte única de verdade.
- **ESLint (flat config) substituiu o `oxlint`** que o scaffold do Vite trouxe por padrão — o
  enunciado pede ESLint explicitamente.
- **IndexedDB via wrapper próprio** (`src/lib/storage/db.ts`, ~90 linhas) em vez de uma
  biblioteca como `idb`. O esquema é pequeno (3 object stores) e a API nativa promisificada
  cobre 100% da necessidade — evita uma dependência para um problema resolvido em poucas
  dezenas de linhas (YAGNI).
- **Zod v4 sem `z.preprocess`** nos formulários de Biometria/Antropometria: preprocess criava
  um schema com tipo de entrada (`unknown`) diferente do tipo de saída, o que quebra a
  inferência de tipos do `zodResolver` com `useForm<T>`. A conversão "string vazia → null" foi
  movida para `setValueAs` no `register()` do react-hook-form, mantendo o schema com
  input/output idênticos.

## Nomenclatura

- Adotado **"Windson Wood Personal"** em todo o código novo. O export original tinha 4 grafias
  diferentes (Windsom, Windson, WINDSON WOOD, Windsone) — catalogadas em `MIGRATION_PLAN.md`.

## Design system

- Os ~30 tokens M3-like do "Iron Elite" original foram **consolidados nos 13 tokens semânticos**
  pedidos (`background`, `surface`, `surface-elevated`, `surface-high`, `border`, `text-primary`,
  `text-secondary`, `action-primary`, `action-secondary`, `success`, `warning`, `error`,
  `informative`). O DESIGN.md original não definia `success`/`warning`/`informative` como cores
  distintas — foram derivadas preservando a paleta industrial: `warning` reaproveita o dourado
  de destaque (`#f2ca50`) já usado como acento nas telas originais (glow de "personal best",
  hover de card); `success` é um verde-oliva dessaturado consistente com a paleta; `informative`
  reaproveita o `tertiary` (basalto) do sistema original. Ver `docs/DESIGN_SYSTEM.md`.
- **Dark-mode fixo, sem tema claro.** O produto original é deliberadamente dark industrial —
  construir um tema claro não solicitado seria especulativo (YAGNI) e o próprio DESIGN.md exige
  "strict dark-mode-first palette".
- **Ícones**: mantido o Material Symbols Outlined via Google Fonts (`<link>` no `index.html`,
  uma única vez — não mais duplicado por tela). Rebuildar ~30 ícones como SVGs locais estava fora
  do escopo desta entrega.
- **Imagens**: as ~43 URLs `googleusercontent.com` do export original **não foram baixadas** —
  não pertencem a este repositório e podem expirar/mudar de política de acesso. As telas migradas
  nesta entrega (Login, Dashboard, Avaliação Física) não dependem de fotos de estoque; onde havia
  fotos de alunos/hero, foram substituídas por ícones/placeholders neutros. Migrar assets reais é
  tarefa da Fase 4.

## Autenticação e papéis

- **Sem autenticação real.** `RoleProvider` guarda apenas a string do papel ativo
  (`'trainer' | 'student'`) em `localStorage` — nunca credenciais ou dados de aluno. A tela de
  Login virou o mecanismo de troca de papel mockada, com um atalho adicional (ícone
  "trocar papel") em cada shell para facilitar testes manuais.

## Avaliação Física / Postural

- **Seleção do aluno acontece na lista (Dashboard), não como um passo de busca dentro do
  wizard.** A rota `/personal/alunos/:studentId/avaliacoes/nova` já chega com o aluno definido;
  o primeiro passo do wizard ("Dados gerais") apenas confirma a seleção. Isso evita duplicar a
  futura tela "Meus Alunos" (Fase 4) dentro do wizard.
- **Rascunho por aluno, não por sessão de navegador**: ao entrar na rota de nova avaliação, o
  hook `usePhysicalAssessmentDraft` procura um rascunho (`status: 'draft'`) já existente para
  aquele `studentId`; se não achar, cria um novo e já persiste imediatamente. É isso que permite
  recarregar a página no meio do preenchimento sem perder o progresso.
- **Formulários de Biometria/Antropometria usam React Hook Form + Zod**, propagando valores
  válidos para o estado do wizard via `watch()` + `useEffect`. Os demais passos (Dados gerais,
  Registro visual, Observações, Revisão) não precisam de validação de schema complexa e usam
  estado simples — evita RHF onde não agrega valor.
- **Fotos como Blob, nunca Base64.** O export original gravava preview de foto como Base64 inline
  (`FileReader.readAsDataURL` + `style.backgroundImage`) — identificado na auditoria como
  anti-padrão. A implementação nova salva `Blob`/`File` diretamente no IndexedDB
  (`assessmentPhotos` store) e usa `Object URL` apenas durante a sessão, revogada no cleanup dos
  `useEffect`.

## Pose estimation

- **Modo `IMAGE`, não `VIDEO`.** O MVP processa uma captura por vez (foto congelada da câmera ou
  upload), não um stream contínuo com overlay de skeleton em tempo real durante o
  posicionamento. Isso simplifica bastante o `PoseEstimator` (sem gestão de timestamps de vídeo,
  sem loop de `requestAnimationFrame`) e ainda atende a todos os critérios de aceite desta
  entrega. Overlay em tempo real durante a captura fica para a Fase 3, se necessário.
- **`PoseEstimator.detect()` aceita apenas `ImageBitmap`**, não `HTMLVideoElement` — consequência
  direta da decisão acima. A interface do enunciado era um exemplo conceitual ("Use interfaces de
  domínio como..."), não um contrato literal obrigatório.
- **`@mediapipe/tasks-vision` é importado dinamicamente** (`await import(...)`) dentro do
  `MediapipePoseEstimator`, gerando um chunk separado (~40KB gzip) do bundle principal — só é
  baixado quando o treinador realmente abre a aba de Avaliação Postural.
- **WASM e o arquivo `.task` do modelo vêm dos CDNs oficiais do MediaPipe/Google
  (`cdn.jsdelivr.net`, `storage.googleapis.com`)**, carregados em runtime — não fazem parte do
  bundle. Isso é diferente do anti-padrão "Tailwind via CDN" identificado na auditoria: ali o
  problema era não instalar uma dependência de build no projeto; aqui é a distribuição normal de
  um artefato binário de ML (~poucos MB) que não faz sentido versionar no repositório. Self-host
  do arquivo `.task` em `public/models/` para capacidade 100% offline fica como pendência futura.
- **Espelhamento é só visual (CSS `-scale-x-100` no `<video>`)**; o frame realmente capturado e
  analisado (via `canvas.drawImage(video, ...)`) usa as coordenadas cruas da câmera, não
  espelhadas, para manter esquerda/direita anatômicas consistentes com os cálculos de domínio.
- **Quality gate e métricas são funções puras** (`domain/qualityGate.ts`, `domain/metrics.ts`),
  sem nenhuma dependência de React, canvas ou da lib de pose — testadas com fixtures estáticas de
  landmarks, não com o modelo real.

## Escopo cortado conscientemente nesta entrega

- Verificação de "orientação selecionada compatível com a captura" (ex.: detectar se o usuário
  selecionou "frontal" mas está de lado) não foi implementada como heurística automática — é
  inerentemente instável (alto risco de falso positivo/negativo) e, como esta entrega só liga o
  fluxo de captura frontal, o caso nem se aplica ainda. Registrado como pendência para quando as
  vistas lateral/posterior forem implementadas (Fase 3).
- Um componente `FormField` genérico (listado na especificação) não foi criado: `Input`,
  `NumberInput` e `Select` já embutem label/erro/aria internamente, e não havia nenhum consumidor
  real que precisasse de um wrapper genérico adicional — evita código morto.
- `PosturalAssessmentRepository` e `PhysicalAssessmentRepository` são interfaces desacopladas,
  mas ambas operam sobre o mesmo object store (`physicalAssessments`) do IndexedDB, já que
  `PosturalAssessment` é um sub-registro de `PhysicalAssessment`, não uma entidade própria — assim
  como modelado no esquema de dados do enunciado.
