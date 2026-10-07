-- `messages.sender_id` passa a cascatear com o perfil do remetente.
--
-- Por que: `messages.sender_id` nasceu NO ACTION na migration anterior
-- (`20261007140000_chat_conversations_messages.sql`) e isso travava a exclusão de um participante
-- mesmo quando as mensagens iam cair junto. Medido contra o banco real: apagar o aluno falha com
--   23503 … violates foreign key constraint "messages_sender_id_fkey" … Key is still referenced
-- porque o Postgres valida a FK do remetente sem esperar o cascade que vem pelo outro caminho
-- (profiles → students → conversations → messages). Resultado prático: teardown de teste e
-- exclusão de conta (LGPD, direito de eliminação) ficavam impossíveis sem SQL manual.
--
-- Semântica adotada: mensagem é do participante. Se a conta do aluno sai, a conversa inteira sai
-- pelo cascade de `students`; se a conta do personal sai, as mensagens que ELE escreveu saem com
-- ele. Nenhuma mensagem fica órfã apontando para um perfil inexistente.

alter table public.messages
  drop constraint messages_sender_id_fkey,
  add constraint messages_sender_id_fkey
    foreign key (sender_id) references public.profiles (id) on delete cascade;
