-- ============================================================
-- MIGRAÇÃO: Data da call no lead
-- Ao mover um lead para Remarcado, o painel pede a nova data da
-- call. A data de entrada continua a mesma (é ela que conta nas
-- métricas por período). Execute no SQL Editor do Supabase.
-- ============================================================

ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS data_call TIMESTAMPTZ;

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
