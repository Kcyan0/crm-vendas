-- ============================================================
-- MIGRAÇÃO: Índices para o CRM carregar mais rápido (2026-11-27)
-- O Postgres não cria índice sozinho nas colunas que ligam uma tabela
-- à outra (lead → vendas, oportunidades, chamadas...). Sem eles, cada
-- consulta grande lê a tabela inteira. Só acrescenta índices: não muda
-- nem apaga nenhum dado. Execute no SQL Editor do Supabase; pode rodar
-- de novo sem problema (IF NOT EXISTS).
-- ============================================================

-- Leads: filtro por projeto e período (data da call / entrada) e por responsável
CREATE INDEX IF NOT EXISTS idx_leads_projeto_call ON leads (id_projeto, data_call);
CREATE INDEX IF NOT EXISTS idx_leads_projeto_entrada ON leads (id_projeto, data_entrada);
CREATE INDEX IF NOT EXISTS idx_leads_closer ON leads (id_closer_responsavel);
CREATE INDEX IF NOT EXISTS idx_leads_sdr ON leads (id_sdr_responsavel);

-- Ligações com o lead
CREATE INDEX IF NOT EXISTS idx_oportunidades_lead ON oportunidades (id_lead);
CREATE INDEX IF NOT EXISTS idx_vendas_lead ON vendas (id_lead);
CREATE INDEX IF NOT EXISTS idx_vendas_oportunidade ON vendas (id_oportunidade);
CREATE INDEX IF NOT EXISTS idx_venda_produtos_venda ON venda_produtos (id_venda);
CREATE INDEX IF NOT EXISTS idx_chamadas_lead ON chamadas (id_lead);
CREATE INDEX IF NOT EXISTS idx_chamadas_projeto_inicio ON chamadas (id_projeto, data_hora_inicio);
CREATE INDEX IF NOT EXISTS idx_lead_historico_lead ON lead_historico (id_lead);

-- Equipe por projeto e por e-mail (login, avisos no celular)
CREATE INDEX IF NOT EXISTS idx_usuarios_projeto ON usuarios (id_projeto);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios (lower(email));

-- Log de Atividades (tela do Admin, atualiza a cada 30 s)
CREATE INDEX IF NOT EXISTS idx_atividades_log_projeto_data ON atividades_log (id_projeto, created_at DESC);

-- Atualiza as estatísticas para o Postgres usar os índices novos
ANALYZE leads, oportunidades, vendas, venda_produtos, chamadas, lead_historico, usuarios, atividades_log;

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
