-- Chat personal ↔ aluno: conversa 1:1 e mensagens de TEXTO com contexto.
--
-- Por que existe (e por que não é WhatsApp): a mensagem nasce amarrada ao que o aluno estava
-- fazendo — um registro de treino, um exercício específico, uma avaliação. Daí as colunas de
-- contexto em `messages`. `context_label` é denormalizado de propósito: é o rótulo legível
-- congelado no momento do envio ("Treino A · Supino com barra"), para a mensagem continuar
-- fazendo sentido se a ficha mudar depois.
--
-- Anexo (foto/vídeo) NÃO é desta fatia: as colunas já nascem aqui, nullable, para a versão com
-- mídia não precisar de migration nova.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles (id),
  student_id uuid not null references public.students (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Atualizado pelo trigger `messages_touch_conversation` — ordena a lista de conversas.
  last_message_at timestamptz,
  unique (trainer_id, student_id)
);

create index conversations_student_id_idx on public.conversations (student_id);
create index conversations_trainer_last_message_idx
  on public.conversations (trainer_id, last_message_at desc nulls last);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id),
  body text not null check (length(trim(body)) > 0),
  -- free: conversa solta · workout_log: sessão registrada · exercise: exercício da ficha ·
  -- assessment: avaliação física/postural.
  context_kind text not null default 'free'
    check (context_kind in ('free', 'workout_log', 'exercise', 'assessment')),
  context_id uuid,
  context_label text not null default '',
  -- Anexo: um por mensagem, preenchido só na versão com mídia.
  attachment_path text,
  attachment_kind text check (attachment_kind is null or attachment_kind in ('image', 'video')),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

-- Paginação da conversa (a tela lê as últimas N e sobe).
create index messages_conversation_created_idx
  on public.messages (conversation_id, created_at desc);

-- Caminho das "não lidas" por destinatário: quem abre a conversa conta o que NÃO é dele e ainda
-- não foi lido. O índice parcial mantém esse count barato conforme a conversa cresce.
create index messages_unread_by_recipient_idx
  on public.messages (conversation_id, sender_id)
  where read_at is null;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Personal: só as conversas dos próprios alunos, e só como ele mesmo no `with check`
-- (mesmo hardening de evaluator_id/trainer_id — 2026-09-21).
create policy "conversations_all_trainer" on public.conversations
  for all
  using (public.is_my_student(student_id))
  with check (public.is_my_student(student_id) and trainer_id = auth.uid());

-- Aluno: lê só a própria conversa.
create policy "conversations_select_own" on public.conversations
  for select using (student_id = auth.uid());

-- Aluno pode abrir a conversa (mandar a primeira mensagem), mas só com o próprio personal:
-- `trainer_id` tem de ser o trainer registrado em `students`, não um id qualquer.
create policy "conversations_insert_own" on public.conversations
  for insert
  with check (
    student_id = auth.uid()
    and exists (
      select 1 from public.students s
      where s.id = auth.uid() and s.trainer_id = conversations.trainer_id
    )
  );

-- Helper SECURITY DEFINER: a policy de `messages` precisa olhar `conversations`, que tem RLS
-- própria — sem isto, o personal perderia acesso às mensagens em cenários de policy aninhada.
create or replace function public.can_access_conversation(target_conversation_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = target_conversation_id
      and (c.student_id = auth.uid() or public.is_my_student(c.student_id))
  );
$$;

-- Leitura: os dois lados da própria conversa, e só eles.
create policy "messages_select_participants" on public.messages
  for select using (public.can_access_conversation(conversation_id));

-- Escrita: dentro da própria conversa e só em nome próprio — ninguém manda mensagem assinada
-- por outro (`sender_id` amarrado a auth.uid()).
create policy "messages_insert_participants" on public.messages
  for insert
  with check (public.can_access_conversation(conversation_id) and sender_id = auth.uid());

-- Marcar como lida é ato de quem RECEBEU: quem enviou não marca a própria mensagem.
create policy "messages_update_recipient" on public.messages
  for update
  using (public.can_access_conversation(conversation_id) and sender_id <> auth.uid())
  with check (public.can_access_conversation(conversation_id) and sender_id <> auth.uid());

-- RLS filtra linhas, não colunas: sem isto o destinatário poderia reescrever o `body` ou o
-- contexto da mensagem do outro. Nesta versão mensagem não se edita — só `read_at` muda.
create or replace function public.messages_guard_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.id is distinct from old.id
     or new.conversation_id is distinct from old.conversation_id
     or new.sender_id is distinct from old.sender_id
     or new.body is distinct from old.body
     or new.context_kind is distinct from old.context_kind
     or new.context_id is distinct from old.context_id
     or new.context_label is distinct from old.context_label
     or new.attachment_path is distinct from old.attachment_path
     or new.attachment_kind is distinct from old.attachment_kind
     or new.created_at is distinct from old.created_at then
    raise exception 'Mensagem enviada não pode ser alterada; só read_at muda.';
  end if;
  return new;
end;
$$;

create trigger messages_guard_update
  before update on public.messages
  for each row execute function public.messages_guard_update();

-- `last_message_at` é derivado: quem envia mensagem não precisa (nem pode, no caso do aluno)
-- escrever em `conversations`.
create or replace function public.messages_touch_conversation()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.messages_touch_conversation();

-- Realtime: a tela do chat ouve INSERT em `messages`. A publication já filtra por RLS, então
-- cada lado só recebe o que teria direito de ler.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;
