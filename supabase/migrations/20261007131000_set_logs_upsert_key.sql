-- Alvo do upsert da série (F10-2). O executor grava a série a cada toque do aluno ("marquei a 2ª de
-- supino com 62,5 kg"): sem um alvo único, cada toque viraria uma linha nova e o histórico de carga
-- ficaria com séries duplicadas. `(workout_log_id, exercise_id, set_index)` é a identidade natural
-- de uma série dentro da sessão — é por ela que o repositório faz `upsert(..., onConflict)`.
--
-- Vem em migration separada da criação das tabelas (20261007130000) porque aquela já estava
-- aplicada em produção quando a necessidade apareceu; reescrever migration aplicada é o caminho
-- para histórico divergente (ver skill naigo-testar-app, seção 6c).
create unique index set_logs_log_exercise_set_key
  on public.set_logs (workout_log_id, exercise_id, set_index);
