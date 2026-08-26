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
- [ ] Fase 7 — próxima. Precisa: provedor de e-mail transacional (Resend/Postmark) + DNS, OAuth
      client do Google Cloud, e decisão sobre Apple Sign In (US$99/ano) — ou seguir só com
      e-mail/senha + Google no lançamento e adicionar Apple depois.
