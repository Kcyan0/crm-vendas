-- ============================================================
-- DIAGNÓSTICO: o que mais gasta o disco do banco (2026-11-27)
-- Só lê estatísticas, não muda nada. Rode no SQL Editor do Supabase
-- e mande o resultado (print ou "Copy as CSV").
-- - tamanho do banco e das maiores tabelas (inclui as do relógio:
--   cron.job_run_details e net._http_response)
-- - quanto o banco já escreveu em arquivos temporários (ordenação
--   que não coube na memória)
-- - as consultas que mais leram do disco desde que as estatísticas
--   foram zeradas
-- ============================================================

WITH linhas AS (
    SELECT 1 AS ordem, pg_database_size(current_database()) AS bytes,
           'banco inteiro' AS item, NULL::text AS detalhe

    UNION ALL
    SELECT * FROM (
        SELECT 2, pg_total_relation_size(relid),
               'tabela ' || schemaname || '.' || relname,
               n_live_tup || ' linhas'
        FROM pg_stat_user_tables
        ORDER BY pg_total_relation_size(relid) DESC
        LIMIT 10
    ) t

    UNION ALL
    SELECT 3, temp_bytes, 'arquivos temporários',
           temp_files || ' arquivos desde ' || coalesce(stats_reset::text, 'sempre')
    FROM pg_stat_database
    WHERE datname = current_database()

    UNION ALL
    SELECT * FROM (
        SELECT 4, (shared_blks_read + temp_blks_written) * 8192, 'consulta',
               calls || 'x · ' || left(regexp_replace(query, '\s+', ' ', 'g'), 160)
        FROM extensions.pg_stat_statements
        ORDER BY shared_blks_read + temp_blks_written DESC
        LIMIT 12
    ) c
)
SELECT item, pg_size_pretty(bytes) AS quanto, detalhe
FROM linhas
ORDER BY ordem, bytes DESC;
