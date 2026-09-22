-- Fase 14 (Correção postural end-to-end), segunda fatia — persistência do plano corretivo.
-- Ver docs/CORRECTIVE_PRESCRIPTION.md, seção 6 (Dados). O motor de sugestão (achados + seleção de
-- exercícios) já existe como função pura no cliente; esta migration só guarda o resultado
-- revisado/publicado pelo treinador.

-- corrective_plans.evaluator_id não está no schema mínimo listado na seção 6 do doc, mas é
-- necessário para replicar aqui a correção do pentest de 2026-09-21
-- (20260921150000_security_hardening.sql, item 2): sem essa coluna, o `with check` do treinador só
-- teria `is_my_student(student_id)` para validar, e qualquer personal autenticado poderia gravar
-- um plano em nome de outro personal (o vínculo aluno↔treinador não amarra "quem publicou").
create table public.corrective_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  assessment_id uuid not null references public.physical_assessments (id) on delete cascade,
  evaluator_id uuid not null references public.profiles (id),
  status text not null default 'draft' check (status in ('draft', 'published')),
  prescription_version text not null,
  -- Achados no formato de PosturalFinding[] (domain/correctivePrescription.types.ts) — cópia
  -- imutável do que gerou a sugestão, para auditoria mesmo que a métrica/limiar mude depois.
  findings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create index corrective_plans_student_id_idx on public.corrective_plans (student_id);
create index corrective_plans_assessment_id_idx on public.corrective_plans (assessment_id);

alter table public.corrective_plans enable row level security;

-- Personal lê/escreve planos só dos próprios alunos, e só pode gravar como autor de si mesmo
-- (evaluator_id = auth.uid()) — mesmo padrão de physical_assessments_all_trainer.
create policy "corrective_plans_all_trainer" on public.corrective_plans
  for all
  using (public.is_my_student(student_id))
  with check (public.is_my_student(student_id) and evaluator_id = auth.uid());

-- Aluno só lê o próprio plano, e só depois de publicado — rascunho é ferramenta de trabalho do
-- personal (mesma regra de physical_assessments_select_own_completed). "Publicar" é o gatilho
-- explícito citado na seção 6 do doc: nada vai pro aluno sozinho.
create policy "corrective_plans_select_own_published" on public.corrective_plans
  for select using (student_id = auth.uid() and status = 'published');

-- corrective_plan_items.exercise_name não está no schema mínimo da seção 6, mas evita uma segunda
-- consulta ao catálogo (rede) só para reexibir o nome de um item já publicado.
create table public.corrective_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.corrective_plans (id) on delete cascade,
  exercise_id text not null,
  exercise_name text not null,
  finding_id text not null,
  target_muscles text[] not null default '{}',
  sets integer not null,
  reps text not null,
  origin text not null check (origin in ('suggested', 'added', 'replaced')),
  validation text not null default 'pending' check (validation in ('pending', 'accepted', 'edited', 'rejected')),
  trainer_note text
);

create index corrective_plan_items_plan_id_idx on public.corrective_plan_items (plan_id);

alter table public.corrective_plan_items enable row level security;

-- Itens não têm student_id próprio — a autorização segue o plano pai via join, mesma amarração
-- de evaluator_id do plano (não dá pra um personal inserir item num plano que não é seu).
create policy "corrective_plan_items_all_trainer" on public.corrective_plan_items
  for all
  using (
    exists (
      select 1 from public.corrective_plans cp
      where cp.id = plan_id and public.is_my_student(cp.student_id)
    )
  )
  with check (
    exists (
      select 1 from public.corrective_plans cp
      where cp.id = plan_id and public.is_my_student(cp.student_id) and cp.evaluator_id = auth.uid()
    )
  );

create policy "corrective_plan_items_select_own_published" on public.corrective_plan_items
  for select using (
    exists (
      select 1 from public.corrective_plans cp
      where cp.id = plan_id and cp.student_id = auth.uid() and cp.status = 'published'
    )
  );
