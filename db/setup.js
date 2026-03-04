const fs = require('fs');
const Database = require('better-sqlite3');

const dbPath = './db/database.sqlite';

if (!fs.existsSync('./db')) {
    fs.mkdirSync('./db');
}

const db = new Database(dbPath);

console.log('Criando tabelas...');

const schema = `
-- ==========================================
-- 1. CRIAÇÃO DAS TABELAS (SQLite)
-- ==========================================

CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('SDR', 'CLOSER', 'EXPERT', 'ADM')),
    ativo BOOLEAN DEFAULT 1,
    salario_fixo_mensal REAL DEFAULT 0.00,
    percentual_comissao_sdr REAL DEFAULT 0.00,
    percentual_comissao_closer REAL DEFAULT 0.00,
    custo_operacional_extra REAL DEFAULT 0.00,
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leads (
    id_lead INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    telefone TEXT,
    instagram TEXT,
    email TEXT,
    origem TEXT,
    data_entrada DATETIME DEFAULT CURRENT_TIMESTAMP,
    status_atual TEXT NOT NULL DEFAULT 'Novo' 
        CHECK (status_atual IN ('Novo', 'Follow-up', 'Remarcado', 'No-show', 'Venda', 'Reembolsado', 'Loss', 'Nao prosseguiu')),
    id_sdr_responsavel INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    id_closer_responsavel INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    observacoes_gerais TEXT
);

CREATE TABLE IF NOT EXISTS oportunidades (
    id_oportunidade INTEGER PRIMARY KEY AUTOINCREMENT,
    id_lead INTEGER NOT NULL REFERENCES leads(id_lead) ON DELETE CASCADE,
    descricao_oferta TEXT,
    valor_proposta REAL NOT NULL,
    moeda TEXT DEFAULT 'BRL',
    probabilidade_fechamento INTEGER CHECK (probabilidade_fechamento BETWEEN 0 AND 100),
    etapa_pipeline TEXT NOT NULL,
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_ultima_atualizacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_fechamento_prevista DATE,
    motivo_perda TEXT
);

CREATE TABLE IF NOT EXISTS vendas (
    id_venda INTEGER PRIMARY KEY AUTOINCREMENT,
    id_oportunidade INTEGER UNIQUE NOT NULL REFERENCES oportunidades(id_oportunidade),
    id_lead INTEGER NOT NULL REFERENCES leads(id_lead),
    id_sdr INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    id_closer INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    data_venda DATETIME DEFAULT CURRENT_TIMESTAMP,
    valor_bruto REAL NOT NULL,
    desconto_concedido REAL DEFAULT 0.00,
    valor_liquido REAL GENERATED ALWAYS AS (valor_bruto - desconto_concedido) STORED,
    forma_pagamento TEXT,
    numero_parcelas INTEGER DEFAULT 1,
    status_pagamento TEXT NOT NULL DEFAULT 'pendente' 
        CHECK (status_pagamento IN ('pago', 'pendente', 'reembolsado', 'chargeback')),
    data_recebimento DATE,
    taxa_gateway REAL DEFAULT 0.00,
    valor_taxa_gateway REAL DEFAULT 0.00,
    valor_liquido_caixa REAL GENERATED ALWAYS AS ((valor_bruto - desconto_concedido) - valor_taxa_gateway) STORED
);

CREATE TABLE IF NOT EXISTS reembolsos (
    id_reembolso INTEGER PRIMARY KEY AUTOINCREMENT,
    id_venda INTEGER NOT NULL REFERENCES vendas(id_venda) ON DELETE CASCADE,
    data_reembolso DATETIME DEFAULT CURRENT_TIMESTAMP,
    valor_reembolsado REAL NOT NULL,
    motivo_reembolso TEXT,
    responsavel_aprovacao INTEGER REFERENCES usuarios(id_usuario)
);

CREATE TABLE IF NOT EXISTS chamadas (
    id_chamada INTEGER PRIMARY KEY AUTOINCREMENT,
    id_lead INTEGER NOT NULL REFERENCES leads(id_lead) ON DELETE CASCADE,
    id_sdr INTEGER REFERENCES usuarios(id_usuario),
    id_closer INTEGER REFERENCES usuarios(id_usuario),
    titulo TEXT,
    descricao TEXT,
    data_hora_inicio DATETIME NOT NULL,
    data_hora_fim DATETIME,
    status_chamada TEXT DEFAULT 'agendada' 
        CHECK (status_chamada IN ('agendada', 'concluida', 'remarcada', 'no-show', 'cancelada')),
    meio TEXT
);

CREATE TABLE IF NOT EXISTS atividades (
    id_atividade INTEGER PRIMARY KEY AUTOINCREMENT,
    id_lead INTEGER NOT NULL REFERENCES leads(id_lead) ON DELETE CASCADE,
    id_usuario INTEGER REFERENCES usuarios(id_usuario),
    tipo_atividade TEXT, 
    descricao TEXT,
    data_hora DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS configuracoes_comissao (
    id_config INTEGER PRIMARY KEY AUTOINCREMENT,
    regra_descricao TEXT,
    percentual_sdr_padrao REAL DEFAULT 0.00,
    percentual_closer_padrao REAL DEFAULT 0.00,
    percentual_expert_padrao REAL DEFAULT 0.00,
    observacoes TEXT
);

-- ==========================================
-- 2. CRIAÇÃO DE ÍNDICES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status_atual);
CREATE INDEX IF NOT EXISTS idx_vendas_data ON vendas(data_venda);
CREATE INDEX IF NOT EXISTS idx_vendas_status ON vendas(status_pagamento);
`;

db.exec(schema);

console.log('Tabelas criadas com sucesso!');

// Seeding Data
const hasUsers = db.prepare('SELECT COUNT(*) as count FROM usuarios').get().count > 0;

if (!hasUsers) {
    console.log('Inserindo dados iniciais (Seed)...');

    // Inserir Usuários
    const stmtUser = db.prepare('INSERT INTO usuarios (nome, email, tipo, salario_fixo_mensal, percentual_comissao_sdr, percentual_comissao_closer) VALUES (?, ?, ?, ?, ?, ?)');
    const idSdr1 = stmtUser.run('João SDR', 'joao@crm.com', 'SDR', 2000, 2.5, 0).lastInsertRowid;
    const idSdr2 = stmtUser.run('Maria SDR', 'maria@crm.com', 'SDR', 2000, 2.5, 0).lastInsertRowid;
    const idCloser1 = stmtUser.run('Pedro Closer', 'pedro@crm.com', 'CLOSER', 3500, 0, 5.0).lastInsertRowid;
    const idAdmin = stmtUser.run('Admin Expert', 'admin@crm.com', 'ADM', 0, 0, 0).lastInsertRowid;

    // Inserir Leads
    const stmtLead = db.prepare('INSERT INTO leads (nome, telefone, instagram, origem, status_atual, id_sdr_responsavel, id_closer_responsavel) VALUES (?, ?, ?, ?, ?, ?, ?)');
    stmtLead.run('Carlos Cliente', '11999999999', '@carlos.cliente', 'Tráfego Pago', 'Novo', idSdr1, null);
    stmtLead.run('Ana Lead', '11988888888', '@ana.lead', 'Orgânico', 'Follow-up', idSdr2, null);
    const idLeadVenda = stmtLead.run('Roberto Venda', '11977777777', '@roberto.venda', 'Indicação', 'Venda', idSdr1, idCloser1).lastInsertRowid;

    // Oportunidade Padrão
    const stmtOportunidade = db.prepare('INSERT INTO oportunidades (id_lead, descricao_oferta, valor_proposta, probabilidade_fechamento, etapa_pipeline) VALUES (?, ?, ?, ?, ?)');
    const idOportunidade = stmtOportunidade.run(idLeadVenda, 'Mentoria Completa', 5000.00, 100, 'Venda').lastInsertRowid;

    // Venda Padrão
    const stmtVenda = db.prepare('INSERT INTO vendas (id_oportunidade, id_lead, id_sdr, id_closer, valor_bruto, desconto_concedido, forma_pagamento, status_pagamento, data_recebimento, taxa_gateway, valor_taxa_gateway) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    stmtVenda.run(idOportunidade, idLeadVenda, idSdr1, idCloser1, 5000.00, 500.00, 'PIX', 'pago', new Date().toISOString().split('T')[0], 0, 0);

    console.log('Seed concluído com sucesso!');
}

db.close();
