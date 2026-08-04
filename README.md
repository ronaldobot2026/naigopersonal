# Windson Wood Personal

Frontend do aplicativo Windson Wood Personal — plataforma de personal trainer com fluxo de
Avaliação Física, Avaliação Postural por landmarks (visão computacional no navegador) e
prescrição de treinos sobre um catálogo de 1.324 exercícios.

Este repositório é uma migração incremental de um export estático do Google Stitch
(`reference/stitch-original/`) para uma aplicação React real, componentizada e testável. Ver
`docs/MIGRATION_PLAN.md` para a auditoria completa e o plano de fases.

## Stack

React 19 · TypeScript (strict) · Vite 8 · Tailwind CSS v4 · React Router 7 · React Hook Form +
Zod · IndexedDB · Vitest + Testing Library · ESLint + Prettier · `@mediapipe/tasks-vision`
(Pose Landmarker).

## Como instalar

```bash
npm install
```

## Como executar em desenvolvimento

```bash
npm run dev
```

Abre em `http://localhost:5173`. A câmera exige um contexto seguro — `localhost` funciona sem
HTTPS; para testar em outro dispositivo na rede, é necessário HTTPS ou um túnel.

## Como testar

```bash
npm run test        # modo watch
npm run test:run    # execução única (CI)
```

## Como verificar tipos e lint

```bash
npm run typecheck
npm run lint
npm run lint:fix
npm run format         # aplica Prettier
npm run format:check   # verifica sem alterar
```

## Como atualizar o catálogo de exercícios

```bash
npm run build:exercises   # baixa o dataset e regrava public/data/exercises.json
```

O arquivo gerado é versionado — rode este comando apenas para atualizar a partir da origem. Ver
[`docs/EXERCISE_CATALOG.md`](docs/EXERCISE_CATALOG.md), inclusive sobre a licença da mídia.

## Como gerar o build de produção

```bash
npm run build      # tsc -b && vite build → dist/
npm run preview     # serve o build de dist/ localmente
```

## Fluxo de demonstração (vertical slice desta entrega)

1. Abra a aplicação → tela de Login.
2. Clique em **"Entrar como Personal"** (troca de papel mockada, sem autenticação real).
3. No Dashboard, clique em **"Nova avaliação"** ao lado de um aluno.
4. No wizard de Avaliação Física, navegue até a aba **"Avaliação postural"**.
5. Aceite o consentimento → escolha uma das quatro vistas no checklist (frente, lateral
   esquerda, lateral direita, costas) → leia as instruções → permita a câmera (ou envie uma foto).
6. Capture a vista escolhida. O quality gate valida a captura; se reprovar, oferece
   "Tentar novamente" com o motivo exato.
7. Com captura aprovada, veja o skeleton sobreposto à imagem e as métricas daquela vista, cada
   uma com confiança e observação não conclusiva.
8. Valide, edite ou rejeite cada métrica e volte ao checklist para capturar as vistas restantes.
9. Recarregue a página a qualquer momento — o rascunho (biometria, antropometria, captura
   postural) é recuperado do IndexedDB automaticamente.

## Documentação

- [`docs/MIGRATION_PLAN.md`](docs/MIGRATION_PLAN.md) — auditoria do export original e plano de
  fases.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — estrutura de pastas, camadas, regras de
  dependência.
- [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) — tokens de design e sua origem.
- [`docs/POSTURAL_ASSESSMENT.md`](docs/POSTURAL_ASSESSMENT.md) — limites do sistema, thresholds,
  mapeamento de estados, testes.
- [`docs/EXERCISE_CATALOG.md`](docs/EXERCISE_CATALOG.md) — origem dos 1.324 exercícios, licença da
  mídia, pipeline de dados e estado da tradução para pt-BR.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — decisões técnicas e premissas registradas durante a
  implementação.

## Limites importantes

Este é um protótipo de desenvolvimento: não há autenticação real, não há backend, e nenhum dado
real de aluno deve ser usado. A Avaliação Postural é um indicador visual auxiliar — nunca um
diagnóstico médico. Ver `docs/POSTURAL_ASSESSMENT.md` para os limites explícitos do sistema.
