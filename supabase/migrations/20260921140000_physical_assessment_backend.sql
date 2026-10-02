-- Fase 9 do docs/ROADMAP.md — Avaliação Física real no Supabase (biometria, antropometria,
-- registro visual). Ver docs/BACKEND_PLAN.md para o racional completo do schema.
--
-- Avaliação postural (docs/POSTURAL_ASSESSMENT.md) permanece como jsonb em
-- physical_assessments.postural_assessment nesta fase, em vez das tabelas normalizadas
-- (postural_assessments/postural_captures/postural_metrics) desenhadas no BACKEND_PLAN — isso
-- espelha o desenho atual do IndexedDB (docs/DECISIONS.md: "PosturalAssessment é um sub-registro
-- de PhysicalAssessment, não uma entidade própria"). Migrar para o schema normalizado fica para a
-- Fase 14 (Correção postural end-to-end), quando histórico/comparação exigirem consultar métricas
-- individualmente em vez de como blob.

create table public.physical_assessments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  evaluator_id uuid not null references public.profiles (id),
  status text not null default 'draft' check (status in ('draft', 'completed')),
  general_notes text,
  postural_assessment jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index physical_assessments_student_id_idx on public.physical_assessments (student_id);

alter table public.physical_assessments enable row level security;

-- Personal lê/escreve avaliações dos próprios alunos, em qualquer status (inclui rascunho).
create policy "physical_assessments_all_trainer" on public.physical_assessments
  for all using (public.is_my_student(student_id)) with check (public.is_my_student(student_id));

-- Aluno só vê avaliações concluídas — rascunho é ferramenta de trabalho do personal, não deve
-- aparecer pela metade no histórico do aluno.
create policy "physical_assessments_select_own_completed" on public.physical_assessments
  for select using (student_id = auth.uid() and status = 'completed');

-- body_metrics: única fonte de medidas (biometria + antropometria) de uma avaliação formal —
-- é a "body_metrics_history" citada no PRD (ver docs/BACKEND_PLAN.md). `assessment_id` é 1:1 com
-- a avaliação nesta fase (unique); fica nullable no schema para permitir, no futuro, um check-in
-- avulso sem avaliação completa — não usado ainda, é só para não fechar a porta.
create table public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid references public.physical_assessments (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  weight_kg numeric,
  height_cm numeric,
  body_fat_percent numeric,
  muscle_mass_kg numeric,
  chest_cm numeric,
  waist_cm numeric,
  hip_cm numeric,
  right_arm_cm numeric,
  left_arm_cm numeric,
  right_thigh_cm numeric,
  left_thigh_cm numeric,
  calves_cm numeric,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (assessment_id)
);

create index body_metrics_student_id_idx on public.body_metrics (student_id);

alter table public.body_metrics enable row level security;

create policy "body_metrics_all_trainer" on public.body_metrics
  for all using (public.is_my_student(student_id)) with check (public.is_my_student(student_id));

create policy "body_metrics_select_own" on public.body_metrics
  for select using (student_id = auth.uid());

-- assessment_photos: metadado do registro visual (4 vistas). O arquivo em si vive no bucket
-- privado `assessment-photos` (criado na Fase 6), em
-- `{student_id}/assessments/{assessment_id}/{view}.<ext>` — sempre servido por signed URL.
create table public.assessment_photos (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.physical_assessments (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  view text not null check (view in ('front', 'left_side', 'right_side', 'back')),
  storage_path text not null,
  created_at timestamptz not null default now(),
  unique (assessment_id, view)
);

create index assessment_photos_student_id_idx on public.assessment_photos (student_id);

alter table public.assessment_photos enable row level security;

create policy "assessment_photos_all_trainer" on public.assessment_photos
  for all using (public.is_my_student(student_id)) with check (public.is_my_student(student_id));

create policy "assessment_photos_select_own" on public.assessment_photos
  for select using (student_id = auth.uid());

-- Retomar/substituir a foto de uma vista faz upload com upsert:true, que cai num UPDATE quando o
-- path já existe — a policy de INSERT sozinha (Fase 6, storage.objects) não cobre esse caminho.
create policy "assessment_photos_trainer_update_students" on storage.objects
  for update using (
    bucket_id = 'assessment-photos'
    and public.is_my_student(((storage.foldername(name))[1])::uuid)
  );
