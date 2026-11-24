-- ============================================================
-- MIGRAÇÃO: Remarcado com data da call a definir
-- No pop-up do Remarcado, o botão "A definir" move o lead sem
-- nova data. A data da call que ele já tinha (call anterior)
-- continua em data_call e segue valendo nas contas por período;
-- o card mostra "Data a definir" até alguém colocar a nova data.
-- Execute no SQL Editor do Supabase antes de publicar.
-- ============================================================

ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS call_a_definir BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
