-- ============================================================
-- MIGRAÇÃO: Avisos de call no celular (2026-11-27)
-- Notificação "Call em 15 min" para o closer e o SDR do lead, no app
-- instalado (iPhone com iOS 16.4+ e Android). Execute no SQL Editor
-- do Supabase. A versão pronta, com o segredo do relógio já preenchido,
-- fica só no computador: db/add_avisos_call.local.sql (fora do Git).
-- ============================================================

-- 1. Celulares que ativaram os avisos. Pelo e-mail, porque a mesma pessoa
--    tem um id_usuario em cada projeto.
CREATE TABLE IF NOT EXISTS push_inscricoes (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    aparelho TEXT,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS push_inscricoes_email_idx ON push_inscricoes (lower(email));

-- 2. Avisos já mandados, para a mesma call não avisar duas vezes.
--    Call remarcada tem outra chave e avisa de novo.
CREATE TABLE IF NOT EXISTS avisos_call_enviados (
    chave TEXT PRIMARY KEY,
    enviado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Só o servidor (chave service_role) lê e grava essas tabelas
ALTER TABLE push_inscricoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE avisos_call_enviados ENABLE ROW LEVEL SECURITY;

-- 3. Relógio: a cada minuto o banco chama o CRM, que manda os avisos das
--    calls dos próximos 15 minutos. Troque COLE_AQUI_O_CRON_SECRET pelo
--    mesmo CRON_SECRET cadastrado na Vercel.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('avisos-de-call')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'avisos-de-call');

SELECT cron.schedule(
    'avisos-de-call',
    '* * * * *',
    $$
    SELECT net.http_get(
        url := 'https://crm-vendas-5cr9.vercel.app/api/push/calls',
        headers := jsonb_build_object('Authorization', 'Bearer COLE_AQUI_O_CRON_SECRET'),
        timeout_milliseconds := 20000
    );
    $$
);

-- Para desligar os avisos: SELECT cron.unschedule('avisos-de-call');
-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
