-- Realtime em `messages`, sem guarda silenciosa.
--
-- A migration `20261007140000_chat_conversations_messages.sql` fez o `alter publication` dentro de
-- um `if exists (select 1 from pg_publication …)`: se a publication não estivesse lá, o bloco
-- passava calado e o chat ficaria sem realtime sem ninguém notar. Medido depois do push: uma sonda
-- que assina postgres_changes em `messages` e insere uma linha recebeu ZERO eventos — ou seja, a
-- tabela não entrou na publication. Aqui o comando roda sem rede de proteção: se a publication não
-- existir, o push falha e aparece no log, em vez de mentir que o realtime está ligado.
--
-- O único erro tolerado é a tabela já ser membro (push repetido / banco já corrigido à mão).

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
end;
$$;
