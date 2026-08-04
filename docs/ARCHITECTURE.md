# Arquitetura — Windson Wood Personal

## Stack

React 19 + TypeScript (strict) + Vite 8. Tailwind CSS v4 (`@tailwindcss/vite`, tokens CSS-first).
React Router 7 (data router). React Hook Form + Zod para formulários validados. IndexedDB
(wrapper próprio, sem dependência externa) para persistência local do protótipo. Vitest +
Testing Library. ESLint (flat config) + Prettier. `@mediapipe/tasks-vision` (Pose Landmarker),
importado dinamicamente.

## Camadas

```
src/
  app/            → bootstrapping: router, providers (RoleProvider), layouts/shells
  components/     → UI compartilhada e agnóstica de feature (ui/navigation/feedback)
  features/       → um diretório por domínio de produto
    auth/
    students/
    dashboard/
    assessments/
      physical/     → o fluxo "Nova Avaliação Física" (wizard de 7 etapas)
      postural/     → avaliação postural: domínio geométrico, serviços de pose, UI de captura
  lib/            → infraestrutura reutilizável (storage/IndexedDB)
  mocks/          → dados fictícios de desenvolvimento (nunca dados reais de aluno)
  types/          → tipos de domínio compartilhados entre features
  styles/         → tokens.css + globals.css
```

Cada feature segue (quando aplicável): `domain/` (tipos + regras puras + interfaces de
repositório), `repositories/` (adaptadores concretos), `services/` (integrações externas, ex.:
pose estimation), `hooks/`, `components/`, `pages/`, `tests/`.

## Regra de dependência

- Componentes de página (`pages/`) chamam **repositórios**, nunca `lib/storage/db.ts`
  diretamente.
- Componentes React **nunca** contêm lógica geométrica — toda ela vive em
  `features/assessments/postural/domain/*.ts`, funções puras e testadas.
- `features/assessments/postural` não importa nada de `features/assessments/physical` (e
  vice-versa) além de tipos compartilhados em `src/types/`. O wizard de avaliação física importa
  o componente `PosturalAssessmentFlow` da feature postural, mas o inverso nunca acontece — evita
  dependência circular entre as duas features.
- Nenhum componente importa `@mediapipe/tasks-vision` diretamente; toda a interação passa pela
  classe `MediapipePoseEstimator` (`services/mediapipePoseEstimator.ts`). Uma interface
  `PoseEstimator` separada existiu neste arquivo até a auditoria de 2026-07-21 — foi removida por
  ter uma única implementação e nenhum consumidor que precisasse do tipo abstrato; se um segundo
  motor de pose surgir, reintroduzir a interface nesse momento.

## Persistência

`src/lib/storage/db.ts` é um wrapper mínimo e promisificado sobre a IndexedDB nativa (3 object
stores: `students`, `physicalAssessments`, `assessmentPhotos`). Os repositórios de domínio
(`indexedDbStudentRepository`, `indexedDbPhysicalAssessmentRepository`,
`indexedDbPosturalAssessmentRepository`) são módulos simples de funções, sem uma interface
separada — até a auditoria de 2026-07-21 cada um tinha uma interface própria "para trocar por
REST/Supabase depois", mas com uma única implementação e zero consumidores do tipo abstrato isso
era indireção especulativa (YAGNI). Se uma segunda implementação for necessária, reintroduzir a
interface nesse momento (Repository Pattern).

Fotos (registro visual e capturas posturais) são salvas como `Blob` na store
`assessmentPhotos`, nunca como Base64 — ver `docs/DECISIONS.md`.

## Rotas e papéis

`src/app/router/routes.ts` centraliza os padrões de rota, organizados por papel (`/aluno/*`,
`/personal/*`). `RoleProvider` (`src/app/providers/`) implementa a troca de papel mockada
(sem autenticação real): a Tela de Login define o papel ativo e navega para o shell
correspondente, renderizado por `RoleShell` (`src/app/layouts/RoleShell.tsx`) — um único
componente parametrizado por `navItems`/`sidebarSubtitle`/`switchTo` (antes existiam
`StudentShell` e `TrainerShell` quase idênticos; unificados na auditoria de 2026-07-21), cada
papel com sua própria navegação (`Sidebar` no desktop, `BottomNavigation` no mobile).

Todas as rotas do MIGRATION_PLAN.md (incluindo as antes previstas para a "Fase 4") já têm páginas
reais — este documento e o `MIGRATION_PLAN.md` estavam desatualizados nesse ponto.

## Testes

Cobertura de testes nesta entrega é focada na camada de domínio postural (geometria, quality
gate, cálculo de métricas, adaptador de landmarks) — 31 testes unitários com fixtures estáticas,
sem nenhuma dependência do modelo de pose real. Ver `docs/POSTURAL_ASSESSMENT.md` para o
detalhamento dos casos cobertos.
