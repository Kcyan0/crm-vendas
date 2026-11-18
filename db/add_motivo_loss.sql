-- ============================================================
-- MIGRAÇÃO: Motivo do Loss
-- Ao mover um lead para Loss, o painel pede o motivo (lista fixa)
-- e um detalhe em texto. O motivo sai no CSV do Exportar e no
-- detalhe do lead. Execute no SQL Editor do Supabase ANTES de
-- publicar o código: o painel de leads passa a ler estas colunas.
-- ============================================================

-- Motivo da lista fixa (src/lib/motivosLoss.ts), detalhe livre,
-- quem marcou (id_usuario: há pessoas com nomes iguais) e quando.
-- Se o lead sair de Loss e voltar, o motivo novo substitui o antigo.
-- Os Loss antigos ficam com tudo vazio.
ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS motivo_loss TEXT,
    ADD COLUMN IF NOT EXISTS detalhe_loss TEXT,
    ADD COLUMN IF NOT EXISTS id_usuario_loss INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS data_loss TIMESTAMPTZ;

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
