# Roadmap — Windson Wood Personal

> Continuação do `MIGRATION_PLAN.md` (Fases 0–4, concluídas — protótipo frontend completo,
> mocks/IndexedDB). Este documento é o plano vivo até o app atender 100% do PRD. Gerado em
> 2026-08-14 por análise de arquitetura (`architect`) + planejamento de fases (`planner`); ver
> `docs/BACKEND_PLAN.md` para o detalhamento de schema/RLS citado nas fases 6+.

**Correção de status**: `MIGRATION_PLAN.md` marca Fases 3 e 4 como "fora do escopo". A Fase 4 está
concluída (todas as rotas têm página real). A Fase 3 está **parcial** — as 4 vistas posturais e a
validação do treinador existem; histórico/comparação/PDF ficam na Fase 14 abaixo.

**DoD transversal** (todas as fases): `npm run typecheck`, `npm run lint`, `npm run test:run` e
`npm run build` verdes; nenhuma página nova importando `@/mocks/*` diretamente; nenhum secret no
bundle.

## Decisão de plataforma (ver `docs/BACKEND_PLAN.md`)

**Supabase** (Postgres + Auth + Storage + Realtime + RLS + Edge Functions, região `sa-east-1`),
consumido direto do SPA — sem servidor próprio. **Mercado Pago** para PIX/cartão (Fase 17).
**Confirmado com o usuário em 2026-08-14.**

## Fases

| # | Fase | Depende de | Bloqueio externo | Risco |
|---|---|---|---|---|
| 5 | Camada de dados agnóstica de plataforma (repositórios + hook `useAsyncData` para workouts/chat/nutrition/billing, tipos movidos para `domain/`) | — | não | baixo |
| 6 | Fundação de backend (Supabase: schema inicial, RLS, bucket privado, migrations) | 5 | **sim** — conta/projeto Supabase | alto |
| 7 | Autenticação real (email/senha, Google, Apple, recuperação, guarda de rota) | 6 | **sim** — e-mail transacional, OAuth Google, Apple Developer (US$99/ano) | alto |
| 8 | Alunos reais: cadastro, convite, vínculo | 6, 7 | e-mail transacional (mesmo item da 7) | médio |
| 9 | Avaliações no backend (física + postural + fotos, rascunho local preservado) | 6, 7, 8 | jurídico — texto de consentimento LGPD | médio-alto |
| 10 | Treinos: prescrição e execução (loop diário completo) — **maior fase; split 10a/10b se estourar** | 8, 9 | não | médio |
| 11 | Periodização, volume e carga | 10 | não | médio |
| 12 | Chat realtime (texto → mídia → broadcast) | 6, 7, 8 | não | médio |
| 13 | Evolução, relatórios e PDF | 9, 10, 11 | não | médio |
| 14 | Correção postural end-to-end (histórico, comparação, prescrição corretiva) | 9, 10, 13 | não | médio |
| 15 | PWA e notificações (Web Push VAPID) | 10, 12, 13 | parcial — só se virar app nativo de loja | médio |
| 16 | Nutrição real (plano editável pelo personal) | 8, 10, 15 | nota: prescrição nutricional é ato do CFN — personal só repassa plano de terceiro | baixo-médio |
| 17 | Financeiro e pagamentos (PIX/cartão, webhook idempotente) | 7, 8 | **sim** — conta gateway + CNPJ + KYC | alto |
| 18 | Conteúdo: vídeo HD, Biblioteca Premium por plano | 8, 10, 17 | **sim** — host de vídeo + produção/licenciamento + resposta da Gym visual | alto |
| 19 | Qualidade, conformidade e go-live (LGPD, E2E, a11y, performance, observabilidade) | todas | **sim** — domínio, Sentry, revisão jurídica | médio |

**Núcleo de valor, não cortar**: 10, 12, 13. Se precisar cortar escopo, cortar por trás
(18 → 17 → 16). Paralelizáveis depois da 15: 16, 17, 18 (não dependem entre si).

## Checklist de bloqueios externos (só o usuário cria — o agente não cria contas nem paga por serviços)

| Fase | Item | Custo |
|---|---|---|
| 6 | Conta + projeto Supabase, região São Paulo | plano Pro ~US$25/mês recomendado |
| 7 | Provedor de e-mail transacional (Resend/Postmark) + DNS do domínio | baixo |
| 7 | OAuth client no Google Cloud Console | grátis |
| 7 | Apple Developer Program (Sign in with Apple) | US$99/ano |
| 15 | Apple Developer + Google Play + Firebase — só se for app nativo de loja | US$99 + US$25 |
| 17 | Conta Mercado Pago + CNPJ/CPF + chave PIX + KYC | % por transação |
| 18 | Host de vídeo (Mux/Cloudflare Stream/Bunny) + produção/licenciamento do acervo | recorrente |
| 18 | Confirmação com a Gym visual sobre uso dos GIFs atuais (`docs/EXERCISE_CATALOG.md`) | grátis |
| 19 | Hospedagem/domínio, Sentry, revisão jurídica da política de privacidade | variável |

Podem começar **em paralelo à Fase 5/6**, já que KYC de gateway de pagamento leva dias: itens das
Fases 6, 7 e 17.

## Status de execução

- [x] Fase 5 — concluída em 2026-08-14. `useAsyncData` + repositórios de
      workouts/chat/nutrition/billing + tipos movidos para `domain/*.types.ts`. Único import de
      `@/mocks/*` restante em página: `MOCK_CURRENT_STUDENT_ID` em `StudentHomePage.tsx` — é
      placeholder de identidade de sessão (mesma categoria de `MOCK_TRAINER_ID`), propositalmente
      não resolvido aqui; é escopo da Fase 7 (`auth.uid()` substitui os dois).
- [x] Fase 6 — plataforma confirmada (Supabase + Mercado Pago) e projeto criado pelo usuário em
      2026-08-14 (`cohzcqdvikzlnzhnqiqf`, região informada pelo painel). Aplicado em produção:
      migration `supabase/migrations/20260814120000_identity_foundation.sql` (`profiles`,
      `students`, RLS, trigger de bootstrap de identidade, bucket privado `assessment-photos` +
      policies). Cliente tipado em `src/lib/supabase/client.ts` + `src/lib/config/env.ts`,
      `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` em `.env.local` (gitignored) e
      documentados em `.env.example`. `@supabase/supabase-js` instalado.
      **Pendente desta fase, adiado para a Fase 7/8** (precisa de usuários reais autenticados
      para existir): teste de integração de isolamento entre alunos (aluno A não lê dado de
      aluno B). Nenhum repositório fez cutover ainda — app continua 100% em cima dos repositórios
      mock, como o DoD pede. A `service_role key` do projeto não foi solicitada nem armazenada
      pelo agente (só entra em secret de Edge Function, mais adiante).
- [~] Fase 7 — **só a fatia mínima**, para destravar a Fase 9 (abaixo): `LoginPage.tsx` agora
      autentica de verdade (`supabase.auth.signInWithPassword`, sem mais botão de "entrar como
      X" instantâneo) e `useAuthUser` expõe `auth.uid()` para quem precisa. **Falta para a Fase 7
      completa**: Google/Apple OAuth, recuperação de senha, convite, `RequireRole` como guarda de
      rota (hoje `RoleShell`/`RoleProvider` continuam como troca de papel mockada, decorativa —
      quem autoriza de verdade é só a RLS). `scripts/seed-demo-users.mjs` cria as duas contas
      reais (personal + aluno) via `service_role key` — passada só na hora de rodar o script,
      nunca armazenada. Teste de isolamento entre alunos (aluno A não lê dado de aluno B) segue
      pendente — só dá para escrever com um segundo aluno real, que ainda não existe.
- [x] Fase 8 — concluída em 2026-09-21. **Leitura**: `studentRepository.ts` (Supabase) substitui
      o antigo `indexedDbStudentRepository.ts`/`MOCK_STUDENTS`; `StudentsListPage.tsx` lista e
      `StudentDetailPage.tsx`/`NewPhysicalAssessmentPage.tsx` leem pelo `id` real. A RLS
      (`students_all_trainer`, Fase 6) já garante o isolamento: um personal só vê os próprios
      alunos, sem filtro extra no cliente. **Cadastro/convite pela UI**: Edge Function
      `supabase/functions/invite-student/` — a única peça que pode chamar
      `auth.admin.inviteUserByEmail` (exige `service_role`, nunca exposta ao cliente). O vínculo
      trainer↔aluno (linha em `public.students`, `trainer_id`) não vem mais de metadata enviada
      pelo cliente nem do trigger `handle_new_user()` — desde o hardening de segurança do commit
      `9fa594c` (ver `docs/PENTEST_REPORT.md`), esse trigger sempre cria `profiles.role =
      'student'` sem vínculo nenhum, de propósito. É a própria função que verifica, a partir do
      JWT de quem chama (nunca de um campo do corpo da requisição), que `profiles.role =
      'trainer'`, e só então grava `students.trainer_id = auth.uid()` do chamador. `StudentsListPage.tsx`
      ganhou o formulário "Adicionar aluno" (`InviteStudentForm.tsx`) chamando
      `studentRepository.invite()` → `supabase.functions.invoke('invite-student', ...)`. Validado
      de ponta a ponta contra um Supabase local (Docker): convite por um trainer autenticado cria
      `profiles`+`students` corretamente vinculados; aluno tentando convidar → 403; sem sessão →
      401; e-mail inválido → 400; e-mail já cadastrado → 409. **Fora do escopo**: página de
      "definir senha" para o aluno completar o convite (o e-mail de convite do Supabase aponta
      para uma rota que ainda não existe no app — mesma lacuna que "recuperação de senha", Fase 7
      completa) e reenvio/cancelamento de convite pendente.
- [x] Fase 9 (parcial) — Avaliação Física com salvamento real, concluída em 2026-09-21. Migration
      `supabase/migrations/20260921140000_physical_assessment_backend.sql`: tabelas
      `physical_assessments`, `body_metrics`, `assessment_photos` + RLS + policy de `update` no
      bucket `assessment-photos` (upsert de foto). `indexedDbPhysicalAssessmentRepository.ts`
      deletado; `physicalAssessmentRepository.ts` (mesmas assinaturas) + `assessmentPhotoRepository.ts`
      (Storage, signed URL) tomam o lugar. Rascunho continua salvando a cada alteração (agora no
      Supabase) e resume ao voltar — validado de ponta a ponta contra um Supabase local (Docker):
      login real, criação/resumo de rascunho, biometria/antropometria, upload de foto com preview
      via signed URL, conclusão, e RLS bloqueando escrita do aluno na própria avaliação.
      **Decisões de escopo, não pedidas explicitamente mas necessárias para não quebrar nada**:
      `usePosturalFindings.ts` (feature Treinos) also migrado, só porque consumia o repositório
      deletado. **Fora do escopo desta entrega** (não pedido, ficou como dívida explícita):
      avaliação postural continua como `jsonb` em `physical_assessments.postural_assessment`, não
      nas tabelas normalizadas do `BACKEND_PLAN.md` (`postural_assessments`/`postural_captures`/
      `postural_metrics`) — isso é Fase 14; fila local de upload pendente de foto (offline-first,
      citada no `BACKEND_PLAN.md`) não foi construída, upload é direto; `indexedDbPosturalAssessmentRepository.ts`
      ficou órfão (sem nenhum consumidor desde antes desta entrega) — removido em 2026-09-21 por
      já não ter nenhum uso.
- [~] Fase 10 — **loop diário fecha de ponta a ponta**, concluída como fatia de execução em
      2026-10-07 (branch `feat/espelho-aluno`, commits `a438396`…`52cd796`). O que está pronto e
      provado em navegador real contra o Supabase de produção:
      **Prescrição (já existia, PR #3)**: construtor `/personal/alunos/:id/treino` com divisões
      A–E, `workout_plans` em duas linhas por aluno (`draft`/`published`,
      `unique(student_id,status)`), botões Salvar rascunho / Publicar; o aluno só lê `published`
      (RLS). **Dados de execução**: migrations `20261007120000_workout_plans.sql`,
      `20261007130000_workout_execution_logs.sql` (`workout_logs` + `set_logs` com RLS — o aluno
      escreve só o próprio log, o personal **só lê**) e `20261007131000_set_logs_upsert_key.sql`
      (índice único `(workout_log_id, exercise_id, set_index)`, que faz o upsert ser idempotente),
      mais `workoutLog.types.ts`/`workoutLogRepository.ts`. **Aluno executa**:
      `/aluno/treinos/:divisao` tem Iniciar treino, uma linha por série com repetições, carga e
      check "feita", auto-save com debounce de 400 ms (o check fura o debounce), retomada da sessão
      aberta ao recarregar a página e Concluir treino com resumo honesto — séries feitas sobre
      prescritas, volume só do que foi marcado e duração medida de `started_at` a `completed_at`,
      nunca a estimativa da ficha. **Home do aluno**: card "Treino de hoje" com estado real (A
      fazer / Em andamento / Concluído hoje) e semana contada das sessões gravadas; o volume fixo
      de 78,4 kg que nunca existiu saiu da tela. **Histórico de carga**: a última carga aparece na
      execução ("última: 47,5 kg × 8, 3 dias atrás") e cada exercício tem painel sob demanda com as
      últimas sessões; é lido só do que está denormalizado em `set_logs`, então sobrevive à ficha
      apagada (provado). **Personal vê a aderência** em `/personal/alunos/:id`: semana corrente
      contra a frequência prescrita (pela mesma `summarizeWeek` da home do aluno, para os dois
      nunca discordarem), últimas sessões e drill-down série por série com a carga usada ao lado da
      prescrita (↓ abaixo / ↑ acima, "não registrado" para exercício prescrito e não tocado).
      Somente leitura por desenho: zero campos de edição na tela e `PATCH` com o token do personal
      recusado pela RLS. **Prova de ponta a ponta**: `scripts/e2e-loop-treino.cjs` roda o loop do
      zero em Chromium (cria aluno limpo, personal monta e publica a ficha pela UI, aluno treina
      registrando carga, recarrega no meio e retoma, conclui, home passa a dizer "Concluído hoje",
      personal vê 2 de 5 séries · 890 kg com 45 kg abaixo e 55 kg acima do prescrito, e ficha em
      `draft` não aparece para o aluno) e apaga todo o dado de teste no fim: **27/27 asserts
      verdes** em 2026-10-07.
      **Dívida explícita desta fase — NÃO foi feito**, nada disto está no app hoje: cronômetro de
      descanso entre séries (o `restSeconds` é prescrito e exibido, mas nada conta o tempo);
      trocar ou pular exercício durante a execução (o aluno só registra, ou deixa em branco, o que
      o personal prescreveu); sugestão automática de progressão de carga → **Fase 11**; gráfico de
      evolução de carga/volume → **Fase 13** (hoje o histórico é lista de números, de propósito: a
      decisão do aluno é "subo de 32 para 35?", e isso pede número, não curva); notificação ao
      personal quando o aluno conclui, filtro por período e exportação na visão do personal; fila
      offline de séries (registrar exige rede). Nada disto foi prometido como pronto em nenhuma
      tela.
- [x] Anamnese (pedido do cliente, 2026-10-01; dívida de banco fechada em 2026-10-07) — modelos
      **PAR-Q** (7 perguntas Sim/Não, com aviso de liberação médica quando há "Sim") e **Padrão**
      (17 itens), preenchidos pelo personal ("Eu irei preencher") ou enviados ao aluno ("Meu aluno
      irá preencher"). Código em `src/features/anamnesis/` (catálogo de perguntas no código;
      respostas em `jsonb`). Migration `supabase/migrations/20261001120000_anamneses.sql` (tabela
      `anamneses` + RLS: personal só dos próprios alunos como autor, aluno só pendente/concluída e
      só responde a pendente; trigger impede o aluno de mudar template/autor).
      **Reconciliado em 2026-10-07**: `supabase migration list --linked` mostra as 8 migrations com
      local e remoto coerentes (incluindo `20261001120000`), então não houve `migration repair` a
      fazer — o histórico já estava alinhado. O schema real do banco foi conferido contra o arquivo
      pelo catálogo (`information_schema.columns`, `pg_policy`, `pg_trigger`, `pg_constraint`,
      `pg_indexes`, `pg_proc`): as 10 colunas, os 3 checks, as 2 FKs, o índice
      `anamneses_student_id_idx`, as 3 policies e o trigger `anamneses_guard_student_update`
      (security definer, `search_path=public`) batem com a migration — zero divergência.
      `database.types.ts` foi regenerado com `supabase gen types typescript --linked` + prettier e
      o diff deu **vazio**: a entrada `anamneses` escrita à mão estava correta (mesmas colunas,
      mesmos `Insert`/`Update` opcionais, mesmas duas `Relationships`), então nada mudou — mas
      agora é saída de CLI, não trabalho manual. Isolamento RLS coberto por
      `src/features/anamnesis/tests/anamnesisIsolation.integration.test.ts` (7 testes, passando
      contra o projeto real): personal lê só os próprios alunos, não grava com `trainer_id`
      forjado; personal de outro aluno não lê nada do aluno A; aluno A não vê o rascunho do
      personal nem a anamnese do aluno B, e o update na linha do B afeta zero linhas; o trigger
      recusa troca de `template_id`/`trainer_id`; aluno responde e conclui a própria e depois ela
      fica travada. Teardown apaga alunos antes dos personais e assere que nenhum usuário do run
      sobrou.
