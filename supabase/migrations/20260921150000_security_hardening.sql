-- Hardening de segurança — ver docs/PENTEST_REPORT.md (itens 1 a 3 do "Top 5 correções
-- priorizadas"). Fecha: (1) bypass de autorização no bootstrap de identidade, (2) forjamento de
-- `evaluator_id` em avaliações físicas, (3) upload arbitrário/DoS no bucket de fotos.

-- 1. CRÍTICA — handle_new_user() não decide mais role/trainer_id a partir de
-- raw_user_meta_data (preenchível pelo próprio cliente via `options.data` no signUp). Todo novo
-- usuário nasce como 'student', sem vínculo automático a nenhum trainer_id — o vínculo
-- aluno↔personal passa a exigir um fluxo de convite real (Edge Function com service_role),
-- ainda não implementado. `full_name` continua lido de raw_user_meta_data porque não é um dado
-- de autorização (só rótulo de exibição).
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, email)
  values (
    new.id,
    'student',
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email
  );

  return new;
end;
$$;

-- 2. ALTA — evaluator_id em physical_assessments era forjável: a policy só validava
-- is_my_student(student_id), nunca quem de fato está autenticado. Agora insert/update exigem
-- evaluator_id = auth.uid() além do vínculo trainer↔aluno.
drop policy if exists "physical_assessments_all_trainer" on public.physical_assessments;

create policy "physical_assessments_all_trainer" on public.physical_assessments
  for all
  using (public.is_my_student(student_id))
  with check (public.is_my_student(student_id) and evaluator_id = auth.uid());

-- 3. ALTA — bucket assessment-photos sem allowlist de tipo/tamanho: file.type do
-- <input type="file"> é auto-declarado pelo navegador, então sem allowed_mime_types dava para
-- subir qualquer coisa (ex.: SVG com <script>); sem file_size_limit, DoS de quota.
update storage.buckets
set file_size_limit = 5242880, -- 5MB
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'assessment-photos';
