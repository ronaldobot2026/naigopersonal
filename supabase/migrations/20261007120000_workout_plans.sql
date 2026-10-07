-- Ficha de treino (A–E) persistida no Supabase — antes ficava só no IndexedDB do navegador do
-- personal, então o aluno nunca via o treino montado para ele (e o personal perdia a ficha ao
-- trocar de navegador). A ficha inteira é um documento (divisões + exercícios em jsonb), gravada e
-- lida de uma vez pelo construtor.
--
-- Duas linhas por aluno, no máximo: o RASCUNHO em que o personal trabalha (`status = 'draft'`) e a
-- versão PUBLICADA que o aluno vê (`status = 'published'`). "Publicar" copia o rascunho por cima
-- da publicada — editar a ficha depois de publicada nunca vaza uma versão pela metade para o aluno.
-- O índice único garante as duas linhas e serve de alvo do upsert.
create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  -- Quem montou. Amarrado a auth.uid() no `with check` (mesma correção do pentest de 2026-09-21
  -- aplicada a physical_assessments/corrective_plans): sem isso qualquer personal autenticado
  -- poderia gravar ficha em nome de outro.
  trainer_id uuid not null references public.profiles (id),
  status text not null check (status in ('draft', 'published')),
  objective text not null default '',
  weekly_frequency smallint check (weekly_frequency between 1 and 7),
  notes text not null default '',
  -- WorkoutDivision[] (src/features/workouts/domain/workout.types.ts).
  divisions jsonb not null default '[]'::jsonb check (jsonb_typeof(divisions) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create unique index workout_plans_student_status_key on public.workout_plans (student_id, status);

alter table public.workout_plans enable row level security;

-- Personal lê/escreve só fichas dos próprios alunos, sempre como autor de si mesmo.
create policy "workout_plans_all_trainer" on public.workout_plans
  for all
  using (public.is_my_student(student_id))
  with check (public.is_my_student(student_id) and trainer_id = auth.uid());

-- Aluno só lê a própria ficha publicada — o rascunho é ferramenta de trabalho do personal.
create policy "workout_plans_select_own_published" on public.workout_plans
  for select using (student_id = auth.uid() and status = 'published');
