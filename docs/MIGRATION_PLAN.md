# Plano de Migração — Windson Wood Personal

> Origem: export estático do Google Stitch em `reference/stitch-original/stitch_windson_wood_personal_app/`.
> Este documento registra a auditoria da Fase 0 e o plano de migração por fases. Não é um documento vivo de tarefas de sprint — para status atual, ver o código e os commits.

## Telas inventariadas (13)

| Pasta original             | Título encontrado                                | Nomenclatura          | Papel          | Fase de migração                         |
| -------------------------- | ------------------------------------------------ | --------------------- | -------------- | ---------------------------------------- |
| `login_welcome`            | "Windsom Wood - Elite Training"                  | Windsom               | Pública        | 1                                        |
| `home_do_aluno`            | "WINDSON WOOD - Dashboard do Aluno"              | WINDSON WOOD          | Aluno          | 4                                        |
| `meus_treinos`             | "Treinos - WINDSON WOOD PERSONAL"                | WINDSON WOOD          | Aluno          | 4                                        |
| `detalhes_do_exerc_cio`    | "Detalhes do Exercício - Windsone Wood"          | Windsone (typo único) | Aluno          | 4                                        |
| `plano_alimentar`          | "Plano Alimentar \| Windsom Wood Personal"       | Windsom               | Aluno          | 4                                        |
| `chat_com_personal`        | "Chat - Windsom Wood Personal"                   | Windsom               | Aluno/Personal | 4                                        |
| `pagamentos_faturas`       | (sem match de título no grep)                    | —                     | Aluno          | 4                                        |
| `corre_o_postural`         | "Correção Postural \| Windson Wood"              | Windson               | Aluno          | 4 (reaproveita componentes de card/chip) |
| `dashboard_do_personal`    | "Trainer Dashboard \| WINDSON WOOD"              | WINDSON WOOD          | Personal       | 1                                        |
| `meus_alunos`              | "Windsom Wood - Meus Alunos"                     | Windsom               | Personal       | 4                                        |
| `biblioteca_de_exerc_cios` | (sem match de título no grep)                    | —                     | Personal       | 4                                        |
| `criador_de_treinos`       | "Workout Creator \| Windsom Wood Personal"       | Windsom               | Personal       | 4                                        |
| `nova_avalia_o_f_sica`     | "Nova Avaliação Física \| Windsom Wood Personal" | Windsom               | Personal       | 1 + 2/3 (vertical slice postural)        |

Nomenclatura oficial adotada em toda a Fase 1+: **Windson Wood Personal**.

## Inconsistências identificadas

- **Idioma**: `dashboard_do_personal` e `meus_alunos`/`criador_de_treinos` misturam rótulos em inglês ("Students", "Workout Builder", "Analytics") com o restante do app em pt-BR. A migração usa pt-BR consistente.
- **Nome da marca**: 4 grafias diferentes (Windsom / Windson / WINDSON WOOD / Windsone) espalhadas em 12 dos 13 arquivos.
- **Tokens de design**: o bloco `tailwind.config` inteiro (cores M3, radius, spacing, fontFamily, fontSize) é duplicado literalmente em todos os 13 arquivos — nenhuma fonte única de verdade além do `DESIGN.md`.
- **URLs externas**: 43 ocorrências de imagens hospedadas em `lh3.googleusercontent.com/aida-public/...` (fotos de alunos, avatares, hero images) em todos os 13 arquivos. Nenhuma é local ao repositório.
- **JavaScript apenas demonstrativo** (não deve ser portado como está):
  - `login_welcome`: fade-in de entrada via `setTimeout` inline.
  - `dashboard_do_personal`: hover em `.bento-card` via JS (deveria ser CSS `:hover`).
  - `corre_o_postural`: toggle de filter chips manipulando classes diretamente no DOM.
  - `nova_avalia_o_f_sica`: preview de foto via `FileReader.readAsDataURL` — grava **Base64 inline no `style.backgroundImage`**. Prática a evitar: a nova implementação usa `Blob`/`ObjectURL`.
  - `home_do_aluno`: feedback de toque (`touchstart`/`touchend`) trocando classe de opacidade — vira estado de componente.

## Confusão conceitual identificada (crítica para o objetivo do projeto)

- `corre_o_postural` (Correção Postural), tal como já exportado, **não contém nenhuma lógica de avaliação** — é uma tela de biblioteca de sessões de mobilidade/alongamento/fortalecimento com chips de categoria e progresso semanal. Isso confirma a instrução do projeto: esta tela deve permanecer como área de **exercícios prescritos pós-avaliação**, migrada na Fase 4 reaproveitando os componentes de Card/Chip/ProgressBar já criados na Fase 1.
- `nova_avalia_o_f_sica`, tal como exportado, é um **formulário único não segmentado** (Biometria Vital + Registro Visual de 3 fotos + Antropometria + botão "Gerar Relatório"). Não existe hoje nenhuma etapa de avaliação postural — ela é **criada do zero** nesta execução, como uma aba/etapa dentro do mesmo fluxo de avaliação física (não como app paralela).

## Componentes repetidos candidatos a extração (Fase 1)

- `TopBar` (avatar circular + título de marca + ação de notificação)
- `BottomNavigation` (mobile, 4–5 itens, ícone Material Symbols + rótulo `label-caps`)
- `Sidebar`/`TrainerShell` (desktop, `aside` fixo com nav vertical)
- `Card` tonal com borda 1px `outline-variant` (variantes: `surface-container`, `surface-container-low`, `surface-container-high`)
- `MetricCard`/stat bento (label caps + valor `stat-lg` + indicador de tendência)
- `ProgressBar` linear fina
- `Badge`/Chip de status e categoria
- `Input`/`NumberInput` com borda inferior apenas, foco em `primary`

## Fases

- **Fase 0 — Auditoria**: concluída (este documento).
- **Fase 1 — Fundação**: scaffold Vite+React+TS, Tailwind local, tokens, router, shells, componentes fundamentais, ESLint/Prettier/Vitest, mocks, migração de Login + Dashboard do Personal + estrutura em etapas da Nova Avaliação Física.
- **Fase 2 — Vertical slice postural**: consentimento, câmera/upload, Pose Landmarker, skeleton overlay, captura frontal, quality gate, inclinação de ombros/quadris, rascunho em IndexedDB, testes de geometria.
- **Fase 3 — Fluxo completo** (fora do escopo desta execução): capturas lateral/posterior, revisão das 3 vistas, validação do treinador, histórico e comparação.
- **Fase 4 — Demais telas** (fora do escopo desta execução): Home do aluno, Meus Treinos, Detalhes do Exercício, Plano Alimentar, Chat, Pagamentos, Correção Postural (exercícios), Meus Alunos, Biblioteca de Exercícios, Criador de Treinos.

## Pendências explícitas desta entrega

- Imagens: usamos placeholders locais neutros (SVG/gradiente) em vez de baixar as URLs `googleusercontent.com` do export — elas não pertencem a este repositório e podem expirar. Migrar assets reais é tarefa da Fase 4.
- Autenticação real, backend, pagamentos, chat funcional, PDF de relatório: fora do escopo.
