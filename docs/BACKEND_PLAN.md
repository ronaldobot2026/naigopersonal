# Plano de Backend — Windson Wood Personal

> Arquitetura alvo para as Fases 6+ do `ROADMAP.md`. Ainda não implementado — este documento vira
> `ARCHITECTURE.md` conforme cada fase entra em produção. **Confirmado com o usuário em
> 2026-08-14**: Supabase + Mercado Pago.

## Decisão: Supabase + Mercado Pago

**Supabase** (Postgres + Auth + Storage + Realtime + RLS + Edge Functions), projeto em
`sa-east-1`, consumido direto do SPA na Vercel via `@supabase/supabase-js` — sem servidor próprio,
sem mudar o modelo de deploy atual.

| Requisito | Supabase | Firebase | Node+Postgres próprio |
|---|---|---|---|
| Dado relacional (treino→prescrição→log, agregações) | nativo | Firestore é NoSQL, denormalização manual | nativo |
| Auth email+Google+Apple+convite | nativo | nativo | 2–3 semanas, Apple é o pior pedaço |
| Storage com autorização por linha | nativo | nativo | S3 + presign manual |
| Realtime (chat) | nativo | nativo | WebSocket server próprio |
| Multi-tenant trainer↔aluno | RLS no banco, uma regra por tabela | Security Rules sem JOIN | middleware em toda rota |

Desempate: **RLS**. O app é um SPA estático sem servidor entre navegador e dados — ou a
autorização mora no banco, ou nasce uma API só para ter autorização (perde o "zero setup").

**Pagamento: Mercado Pago** (PIX nativo no Brasil) via Edge Function + webhook.

**TanStack Query entra na Fase 10** (não antes) — gatilho explícito: primeira tela que precisa
invalidar cache de outra (concluir treino → dashboard). Antes disso os repositórios mock não têm
esse problema; adicionar a dependência cedo seria especulativo.

## Código: o que muda

- `src/lib/supabase/client.ts` (singleton `createClient`) + `database.types.ts` (gerado, não
  editado à mão) substituem `src/lib/storage/db.ts` como infra principal.
- **`src/lib/storage/db.ts` não morre inteiro** — sobra só como fila local de fotos pendentes de
  upload (captura postural em academia com sinal ruim não pode depender de rede).
- Cutover duro por feature, sem interface nova (`docs/DECISIONS.md` já registra por que
  interfaces de repositório foram removidas por YAGNI): `indexedDbXRepository.ts` é deletado,
  `xRepository.ts` (Supabase) nasce com as mesmas assinaturas (`findAll`, `findById`, ...) e os
  mesmos tipos de `src/types/domain.ts`. Nunca duas implementações vivas ao mesmo tempo.
- `database.types.ts` (snake_case do Postgres) nunca vaza para fora do repositório — um
  `toDomain(row)` privado mapeia para os tipos de domínio (camelCase) já escritos à mão.

## Schema (resumo — nomes de tabela, não DDL completo)

**Identidade**: `profiles` (id = `auth.users.id`, `role`), `students` (FK `trainer_id`). Sem
tabela `trainers` — é `profiles.role = 'trainer'`. Convite via
`auth.admin.inviteUserByEmail` + trigger em `auth.users`, sem tabela de convites.

**Treinos**: `workout_plans` → `workout_sessions` → `workout_exercises` (`exercise_id text`
aponta pro catálogo estático em `public/data/exercises.json`, nunca migra pro Postgres — tem
licença própria, ver `EXERCISE_CATALOG.md`). `custom_exercises` só se o personal cadastrar os
próprios. Duplicar treino = função Postgres `duplicate_workout_plan`, não N round-trips do
cliente.

**Execução**: `workout_logs` + `set_logs` (com `exercise_id` denormalizado — o histórico de carga
sobrevive a plano editado/deletado). Índice `(student_id, exercise_id, completed_at)`.

**Avaliações**: `physical_assessments`, **`body_metrics`** (é a `body_metrics_history` pedida no
PRD — única fonte de medidas, `assessment_id` nullable para check-in avulso vs. avaliação formal;
dobras cutâneas em `jsonb`), `assessment_photos`. Postural: `postural_assessments`,
`postural_captures` (landmarks em `jsonb`), `postural_metrics` (linha por métrica — é editada
pelo treinador e comparada entre datas, por isso não é `jsonb`).

**Nutrição**: `nutrition_plans` → `meals` → `meal_items`. `daily_checkins` (peso/água/sono,
`UNIQUE (student_id, checkin_date)`). Lista de compras é agregação de `meal_items`, não tabela.

**Chat**: `conversations` (`UNIQUE (trainer_id, student_id)`), `messages` (anexo em colunas —
`attachment_path`/`attachment_kind`, um por mensagem). Broadcast é Edge Function inserindo N
mensagens, sem tabela própria.

**Notificações**: `notifications` (`scheduled_for`, disparada por `pg_cron` a cada 5min via Edge
Function), `push_subscriptions` (VAPID).

**Financeiro**: `subscriptions`, `invoices`, `payment_events`
(`gateway_event_id UNIQUE` = idempotência de webhook — sem isso, reentrega duplica fatura paga).
Nenhuma coluna financeira gravável pelo cliente; só a Edge Function com `service_role` escreve.

## Auth e RLS

1. **Implementado sem Custom Access Token Hook.** O plano original previa injetar `role`/
   `trainer_id` no JWT via hook (configurado no painel, fora de migration/SQL). A migration
   `20260814120000_identity_foundation.sql` usa só as duas funções abaixo, `SECURITY DEFINER`
   (rodam como o dono da função, que bypassa RLS internamente) — evita a mesma recursão que o
   hook evitaria, sem exigir passo manual no dashboard. `ponytail:` uma consulta extra por policy
   avaliada; se o volume de linhas checadas por RLS crescer o suficiente para pesar, promover para
   o Custom Access Token Hook (claim já pronto no JWT, zero query) fica documentado aqui como o
   upgrade.
2. Duas funções `STABLE SECURITY DEFINER`: `current_role()`, `is_my_student(uuid)`. Padrão:
   aluno só lê o próprio (`student_id = auth.uid()`, exceto onde ele escreve: logs, checkins,
   mensagens, `notifications.read_at`); treinador lê/escreve `is_my_student(student_id)`.
3. Storage: 3 buckets privados (`assessment-photos`, `postural-captures`, `chat-attachments`),
   path `{student_id}/...`, sempre servidos por signed URL de TTL curto — nunca bucket público
   (foto postural e composição corporal são dado sensível sob LGPD).
4. `RoleProvider.tsx` → `AuthProvider.tsx`; `useRole()` continua existindo (só perde `setRole`).
   `RoleShell.tsx` perde o atalho "Trocar papel (mock)". Novo `RequireRole` envolve as rotas já
   existentes em `router.tsx` sem redistribuir `ROUTES`. `LoginPage.tsx` ganha
   `signInWithOAuth` + formulário real. `MOCK_CURRENT_STUDENT_ID` /
   `MOCK_TRAINER_ID` são substituídos por `auth.uid()`.
5. **`RequireRole` é UX, não autorização** — quem impede aluno A de ler dado de aluno B é
   exclusivamente o RLS. Teste de integração obrigatório: autenticar como aluno A, afirmar que
   leitura dos dados do aluno B retorna vazio.

## O que exige o usuário (o agente não cria contas nem paga por serviços)

Ver checklist consolidado em `docs/ROADMAP.md`. Chaves VAPID de Web Push são geradas localmente,
sem conta.

## Riscos aceitos

- Plano gratuito Supabase não sustenta produção (pausa após 7 dias sem tráfego, 1GB storage) —
  orçar o Pro desde o lançamento.
- Egress (fotos/áudio/vídeo) escala mais que o banco — mitigar com compressão client-side antes
  do upload e vídeo fora do Supabase Storage.
- RLS falha em silêncio (lista vazia, não erro) — só o teste de isolamento entre alunos pega isso
  em CI.
- Toda regra que não pode ser forjada pelo cliente (pagamento, convite, broadcast) precisa de
  Edge Function com `service_role` — não existe meio-termo no modelo SPA-direto-no-banco.
