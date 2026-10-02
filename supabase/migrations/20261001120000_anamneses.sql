-- Anamnese (questionários PAR-Q e Padrão) — preenchida pelo personal ou enviada ao aluno.
-- Dado de saúde sensível (LGPD): acesso só pelo personal dono do aluno e pelo próprio aluno.

create table public.anamneses (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  trainer_id uuid not null references public.profiles (id),
  template_id text not null check (template_id in ('parq', 'standard')),
  filled_by text not null check (filled_by in ('trainer', 'student')),
  -- draft: personal preenchendo · pending_student: aguardando o aluno · completed: fechada.
  status text not null default 'draft' check (status in ('draft', 'pending_student', 'completed')),
  -- { "<id da pergunta>": { "choice": "yes" | "no", "text": "..." } } — o catálogo de perguntas
  -- vive no código (features/anamnesis/domain/anamnesisTemplates.ts), não no banco.
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index anamneses_student_id_idx on public.anamneses (student_id);

alter table public.anamneses enable row level security;

-- Personal lê/escreve só as anamneses dos próprios alunos, e só como autor de si mesmo
-- (mesma regra de evaluator_id em physical_assessments — hardening de 2026-09-21).
create policy "anamneses_all_trainer" on public.anamneses
  for all
  using (public.is_my_student(student_id))
  with check (public.is_my_student(student_id) and trainer_id = auth.uid());

-- Aluno vê o que foi enviado para ele ou já concluído — nunca o rascunho do personal.
create policy "anamneses_select_own" on public.anamneses
  for select using (student_id = auth.uid() and status in ('pending_student', 'completed'));

-- Aluno responde só o que está pendente e só pode ir para pending_student/completed
-- (nunca voltar para draft). Concluída fica travada para ele: o `using` exige pending_student.
create policy "anamneses_update_own_pending" on public.anamneses
  for update
  using (student_id = auth.uid() and status = 'pending_student')
  with check (student_id = auth.uid() and status in ('pending_student', 'completed'));

-- RLS filtra linhas, não colunas: sem isto o aluno poderia trocar template_id/trainer_id/
-- filled_by da própria linha. Quem não é o personal do aluno só altera answers/status/datas.
create or replace function public.anamneses_guard_student_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_my_student(old.student_id) then
    if new.student_id is distinct from old.student_id
       or new.trainer_id is distinct from old.trainer_id
       or new.template_id is distinct from old.template_id
       or new.filled_by is distinct from old.filled_by
       or new.created_at is distinct from old.created_at then
      raise exception 'Campos da anamnese não podem ser alterados pelo aluno.';
    end if;
  end if;
  return new;
end;
$$;

create trigger anamneses_guard_student_update
  before update on public.anamneses
  for each row execute function public.anamneses_guard_student_update();
