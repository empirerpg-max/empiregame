-- ============================================================
-- Empire Play — Adiciona colunas faltantes
-- Gerado em: 2026-07-28
-- ============================================================

-- data_lancamento em Albuns
ALTER TABLE "Albuns"
  ADD COLUMN IF NOT EXISTS data_lancamento text;

-- data_lancamento em Music Videos
ALTER TABLE "Music Videos"
  ADD COLUMN IF NOT EXISTS data_lancamento text;

-- telegram_message_id em Comentarios_Videos
ALTER TABLE "Comentarios_Videos"
  ADD COLUMN IF NOT EXISTS telegram_message_id bigint;
