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
