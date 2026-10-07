-- Execução do treino. Até aqui o banco só tinha PRESCRIÇÃO (`workout_plans`): o aluno abria a
-- ficha e não tinha onde registrar que treinou, quanto levantou e quantas repetições fez. Sem isso
-- não existe histórico de carga — e progressão sem histórico é chute.
--
-- Duas tabelas, como decidido em docs/BACKEND_PLAN.md:
--   `workout_logs` = a SESSÃO (abriu a divisão A hoje, terminou às 19h40).
--   `set_logs`     = cada SÉRIE executada dentro dela (4 séries de supino, com carga e RPE).
--
-- Regra de sobrevivência do histórico: o log NUNCA morre com a prescrição. A ficha é editada,
-- republicada e às vezes apagada; o que o aluno levantou em março continua valendo. Por isso
-- `workout_plan_id` é `on delete set null` e tanto `division_key` quanto `exercise_id`/
-- `exercise_name` são cópias (texto), não FKs para a ficha nem para o catálogo.

create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  -- A ficha que originou a sessão, só para rastreio. `set null` porque o log sobrevive à ficha:
  -- apagar/trocar a prescrição não pode apagar o que foi treinado.
  workout_plan_id uuid references public.workout_plans (id) on delete set null,
  -- A letra da divisão ('A', 'B', …) copiada da ficha no momento do treino: identifica a sessão
  -- mesmo depois de a divisão ser renomeada ou removida da prescrição.
  division_key text not null,
  started_at timestamptz not null default now(),
  -- null = sessão em andamento (o aluno abriu o treino e ainda não finalizou).
  completed_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- O par (id, student_id) é alvo da FK composta de set_logs: é ele que garante que a coluna
  -- `student_id` denormalizada em set_logs nunca divirja do dono da sessão.
  unique (id, student_id)
);

-- Lista "meus treinos", em ordem cronológica inversa.
create index workout_logs_student_started_idx
  on public.workout_logs (student_id, started_at desc);

create table public.set_logs (
  id uuid primary key default gen_random_uuid(),
  workout_log_id uuid not null,
  -- Denormalizado de propósito (ver o índice abaixo e a RLS): a FK composta logo em seguida
  -- impede que ele aponte para um aluno diferente do dono da sessão.
  student_id uuid not null,
  -- O catálogo de exercícios é um arquivo estático versionado com o app
  -- (public/data/exercises.json), não uma tabela — então `exercise_id` é TEXT e nunca vira FK.
  -- `exercise_name` é a cópia do rótulo no dia do treino: o catálogo pode renomear ou aposentar o
  -- exercício, e o histórico continua legível.
  exercise_id text not null,
  exercise_name text not null,
  set_index smallint not null check (set_index >= 1),
  reps smallint check (reps >= 0),
  weight_kg numeric(6, 2) check (weight_kg >= 0),
  rpe smallint check (rpe between 1 and 10),
  done boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint set_logs_log_student_fkey
    foreign key (workout_log_id, student_id)
    references public.workout_logs (id, student_id)
    on delete cascade
);

-- O índice que o BACKEND_PLAN pede: `(student_id, exercise_id, completed_at)`.
--
-- Decisão: `student_id` foi DENORMALIZADO em set_logs em vez de resolvido por join com
-- workout_logs. Motivo: o hot path do executor é "qual a última carga que ESTE aluno usou NESTE
-- exercício" — com as três colunas na mesma tabela é uma única varredura de índice (e um
-- `order by completed_at desc limit 1` já sai ordenado); via join, o planner precisaria ler
-- set_logs por exercise_id, juntar com workout_logs por student_id e só então ordenar. O risco
-- clássico da denormalização (coluna divergir da origem) está fechado pela FK composta acima, que
-- só aceita o par (workout_log_id, student_id) que existe em workout_logs — não dá para gravar uma
-- série de um aluno pendurada na sessão de outro, nem por SQL direto.
create index set_logs_student_exercise_completed_idx
  on public.set_logs (student_id, exercise_id, completed_at desc);

create index set_logs_workout_log_idx on public.set_logs (workout_log_id, set_index);

alter table public.workout_logs enable row level security;
alter table public.set_logs enable row level security;

-- Quem treina é o aluno: ele é o único que ESCREVE log, e só o próprio. O `with check` amarrado a
-- auth.uid() é a mesma correção do pentest de 2026-09-21 (sem ela, um aluno autenticado gravaria
-- treino em nome de outro).
create policy "workout_logs_all_own_student" on public.workout_logs
  for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- Personal só LÊ (nenhuma policy de escrita para ele): acompanhar a execução é leitura; inventar
-- treino no lugar do aluno, não. A prescrição dele continua sendo workout_plans.
create policy "workout_logs_select_trainer" on public.workout_logs
  for select using (public.is_my_student(student_id));

create policy "set_logs_all_own_student" on public.set_logs
  for all
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

create policy "set_logs_select_trainer" on public.set_logs
  for select using (public.is_my_student(student_id));
