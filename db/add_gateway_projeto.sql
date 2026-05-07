-- ============================================================
-- Migration: Gateways por Projeto
-- Adiciona id_projeto à tabela gateways_pagamento para
-- que cada gateway pertença a um projeto específico.
-- ============================================================

-- 1. Adiciona a coluna (nullable para não quebrar registros existentes)
ALTER TABLE gateways_pagamento
    ADD COLUMN IF NOT EXISTS id_projeto INTEGER
    REFERENCES projetos(id_projeto) ON DELETE CASCADE;

-- 2. Índice para busca rápida por projeto
CREATE INDEX IF NOT EXISTS idx_gateways_pagamento_projeto
    ON gateways_pagamento(id_projeto);

-- 3. (Opcional) Se quiser deletar/migrar os gateways globais antigos,
--    associe-os a um projeto específico. Exemplo:
--    UPDATE gateways_pagamento SET id_projeto = 1 WHERE id_projeto IS NULL;
--
--    Ou delete os que não têm projeto (use com cuidado):
--    DELETE FROM gateways_pagamento WHERE id_projeto IS NULL;
