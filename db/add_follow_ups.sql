-- ============================================================
-- MIGRAÇÃO: Follow-up de leads
-- Aba Follow-up, follow atrasado e "mais fez follow" nos
-- Destaques da semana. Execute no SQL Editor do Supabase.
-- ============================================================

-- 1. Data do próximo follow no lead
--    Atrasado = data já vencida (fuso de Brasília) e lead fora de
--    Venda, Loss, Reembolsado e Nao prosseguiu.
ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS data_proximo_follow TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_leads_projeto_proximo_follow
    ON leads(id_projeto, data_proximo_follow);

-- 2. Histórico de follows feitos
--    Quem fez é sempre id_usuario (nunca nome: há pessoas com nomes iguais).
CREATE TABLE IF NOT EXISTS follow_ups (
    id_follow SERIAL PRIMARY KEY,
    id_lead INTEGER NOT NULL REFERENCES leads(id_lead) ON DELETE CASCADE,
    id_usuario INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    id_projeto INTEGER REFERENCES projetos(id_projeto) ON DELETE CASCADE,
    data_feito TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data_proximo TIMESTAMPTZ,
    observacao TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_follow_ups_projeto_data
    ON follow_ups(id_projeto, data_feito);

CREATE INDEX IF NOT EXISTS idx_follow_ups_lead
    ON follow_ups(id_lead);

-- 3. Só a API (service role) acessa a tabela. Com RLS ligado e sem
--    policies, a chave anon do navegador não lê nem grava nela.
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
