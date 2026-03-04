-- ============================================================
-- FERA CRM - Supabase (PostgreSQL) Schema
-- Cole e execute este SQL no SQL Editor do Supabase
-- ============================================================

-- 1. Projetos
CREATE TABLE IF NOT EXISTS projetos (
    id_projeto SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    descricao TEXT DEFAULT '',
    ativo BOOLEAN DEFAULT TRUE,
    data_criacao TIMESTAMPTZ DEFAULT NOW()
);

-- Projeto padrão
INSERT INTO projetos (nome, descricao) VALUES ('FeraCRM', 'Projeto principal') ON CONFLICT DO NOTHING;

-- 2. Usuários (SDRs e Closers)
CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT,
    tipo TEXT CHECK(tipo IN ('SDR', 'CLOSER', 'ADMIN')) DEFAULT 'SDR',
    ativo BOOLEAN DEFAULT TRUE,
    salario_fixo_mensal NUMERIC(10,2) DEFAULT 0,
    percentual_comissao_sdr NUMERIC(5,2) DEFAULT 0,
    percentual_comissao_closer NUMERIC(5,2) DEFAULT 0,
    id_projeto INTEGER REFERENCES projetos(id_projeto) ON DELETE CASCADE,
    data_criacao TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Gateways de Pagamento
CREATE TABLE IF NOT EXISTS gateways_pagamento (
    id_gateway SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    taxa_percentual NUMERIC(5,2) DEFAULT 0,
    taxa_fixa NUMERIC(10,2) DEFAULT 0,
    ativo BOOLEAN DEFAULT TRUE
);

INSERT INTO gateways_pagamento (nome, taxa_percentual, taxa_fixa) VALUES 
    ('PIX', 0, 0),
    ('Cartão de Crédito', 2.99, 0),
    ('Boleto', 1.5, 2.00)
ON CONFLICT DO NOTHING;

-- 4. Leads
CREATE TABLE IF NOT EXISTS leads (
    id_lead SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    telefone TEXT,
    instagram TEXT,
    email TEXT,
    origem TEXT,
    status_atual TEXT DEFAULT 'Novo',
    id_sdr_responsavel INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    id_closer_responsavel INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    observacoes_gerais TEXT,
    id_projeto INTEGER REFERENCES projetos(id_projeto) ON DELETE CASCADE,
    data_entrada TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Oportunidades
CREATE TABLE IF NOT EXISTS oportunidades (
    id_oportunidade SERIAL PRIMARY KEY,
    id_lead INTEGER REFERENCES leads(id_lead) ON DELETE CASCADE,
    descricao_oferta TEXT,
    valor_proposta NUMERIC(10,2),
    probabilidade_fechamento INTEGER DEFAULT 50,
    etapa_pipeline TEXT DEFAULT 'Oportunidade',
    data_criacao TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Vendas
CREATE TABLE IF NOT EXISTS vendas (
    id_venda SERIAL PRIMARY KEY,
    id_oportunidade INTEGER REFERENCES oportunidades(id_oportunidade) ON DELETE SET NULL,
    id_lead INTEGER REFERENCES leads(id_lead) ON DELETE CASCADE,
    id_sdr INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    id_closer INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    valor_bruto NUMERIC(10,2) NOT NULL,
    desconto_concedido NUMERIC(10,2) DEFAULT 0,
    forma_pagamento TEXT DEFAULT 'PIX',
    numero_parcelas INTEGER DEFAULT 1,
    taxa_gateway NUMERIC(5,2) DEFAULT 0,
    valor_liquido_caixa NUMERIC(10,2),
    status_pagamento TEXT DEFAULT 'pendente',
    data_venda TIMESTAMPTZ DEFAULT NOW(),
    data_recebimento DATE DEFAULT CURRENT_DATE
);

-- 7. Chamadas
CREATE TABLE IF NOT EXISTS chamadas (
    id_chamada SERIAL PRIMARY KEY,
    id_lead INTEGER REFERENCES leads(id_lead) ON DELETE CASCADE,
    id_sdr INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    id_closer INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    status_chamada TEXT DEFAULT 'agendada',
    data_hora_inicio TIMESTAMPTZ,
    duracao_minutos INTEGER,
    observacoes TEXT
);

-- 8. Métricas de Performance (para overrides manuais)
CREATE TABLE IF NOT EXISTS metricas_performance (
    id_metrica SERIAL PRIMARY KEY,
    id_usuario INTEGER REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    data_referencia DATE NOT NULL,
    sdr_conversas_iniciadas INTEGER DEFAULT 0,
    sdr_primeira_resposta INTEGER DEFAULT 0,
    sdr_convites_enviados INTEGER DEFAULT 0,
    sdr_leads_qualificados INTEGER DEFAULT 0,
    sdr_calls_marcadas INTEGER DEFAULT 0,
    closer_total_calls INTEGER DEFAULT 0,
    closer_calls_agendadas INTEGER DEFAULT 0,
    closer_reagendamentos INTEGER DEFAULT 0,
    closer_no_shows INTEGER DEFAULT 0,
    UNIQUE(id_usuario, data_referencia)
);

-- ============================================================
-- FIM DO SCHEMA - Pronto para uso!
-- ============================================================
