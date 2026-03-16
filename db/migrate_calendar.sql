-- ============================================================
-- MIGRAÇÃO: Calendário + Google Calendar
-- Execute este SQL no SQL Editor do Supabase
-- ============================================================

-- 1. Adicionar colunas faltantes na tabela chamadas
ALTER TABLE chamadas
  ADD COLUMN IF NOT EXISTS titulo TEXT DEFAULT 'Chamada',
  ADD COLUMN IF NOT EXISTS google_event_id TEXT,
  ADD COLUMN IF NOT EXISTS id_projeto INTEGER REFERENCES projetos(id_projeto) ON DELETE CASCADE;

-- 2. Criar tabela de tokens do Google Calendar
CREATE TABLE IF NOT EXISTS google_tokens (
  id SERIAL PRIMARY KEY,
  user_email TEXT UNIQUE NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
