-- Fase 6 do docs/ROADMAP.md — fundação de backend: identidade, RLS, storage.
-- Ver docs/BACKEND_PLAN.md para o racional completo do schema.

create type public.user_role as enum ('trainer', 'student');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null,
  full_name text not null,
  email text not null,
  avatar_url text,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Um treinador é profiles.role = 'trainer'. Não existe tabela `trainers` (ver DECISIONS.md —
-- YAGNI: uma tabela para uma coluna nullable é indireção, não modelagem).
create table public.students (
  id uuid primary key references public.profiles (id) on delete cascade,
  trainer_id uuid not null references public.profiles (id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'inactive', 'pending')),
  birth_date date,
  sex text check (sex in ('male', 'female', 'other')),
  goals text,
  restrictions text,
  started_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index students_trainer_id_idx on public.students (trainer_id);

alter table public.profiles enable row level security;
alter table public.students enable row level security;

-- Helpers SECURITY DEFINER: rodam como o dono da função (bypassa RLS internamente), evitando a
-- policy-consultando-a-própria-tabela que causa recursão infinita no Supabase.
create or replace function public.current_role()
returns public.user_role
language sql stable security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_my_student(target_student_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.students
    where id = target_student_id and trainer_id = auth.uid()
  );
$$;

-- profiles: cada um lê/edita o próprio; personal lê o perfil dos próprios alunos.
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());

create policy "profiles_select_trainer_of_student" on public.profiles
  for select using (public.is_my_student(id));

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());

-- students: aluno lê o próprio registro; personal lê/edita só os próprios alunos.
create policy "students_select_own" on public.students
  for select using (id = auth.uid());

create policy "students_all_trainer" on public.students
  for all using (trainer_id = auth.uid()) with check (trainer_id = auth.uid());

-- Bootstrap de identidade: ao criar um usuário em auth.users (signup ou convite), cria o
-- profiles correspondente. role/trainer_id vêm de raw_user_meta_data, preenchidos pelo fluxo de
-- convite/signup real (Fase 7/8) — aqui só a mecânica, sem UI ainda.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  new_role public.user_role;
begin
  new_role := coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'student');

  insert into public.profiles (id, role, full_name, email)
  values (
    new.id,
    new_role,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email
  );

  if new_role = 'student' and (new.raw_user_meta_data ->> 'trainer_id') is not null then
    insert into public.students (id, trainer_id)
    values (new.id, (new.raw_user_meta_data ->> 'trainer_id')::uuid);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Storage: bucket privado de fotos de avaliação (schema completo da feature é Fase 9; aqui só o
-- bucket + policies, para provar o mecanismo de autorização por linha desde já). Sempre acessado
-- por signed URL, nunca público — dado sensível sob LGPD.
insert into storage.buckets (id, name, public)
values ('assessment-photos', 'assessment-photos', false)
on conflict (id) do nothing;

create policy "assessment_photos_student_read_own" on storage.objects
  for select using (
    bucket_id = 'assessment-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "assessment_photos_trainer_read_students" on storage.objects
  for select using (
    bucket_id = 'assessment-photos'
    and public.is_my_student(((storage.foldername(name))[1])::uuid)
  );

create policy "assessment_photos_trainer_write_students" on storage.objects
  for insert with check (
    bucket_id = 'assessment-photos'
    and public.is_my_student(((storage.foldername(name))[1])::uuid)
  );
