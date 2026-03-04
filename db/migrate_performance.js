const Database = require('better-sqlite3');
const dbPath = './db/database.sqlite';

const db = new Database(dbPath);

console.log('Iniciando migração de performance...');

const migrations = `
CREATE TABLE IF NOT EXISTS metricas_performance (
    id_metrica INTEGER PRIMARY KEY AUTOINCREMENT,
    id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    data_referencia DATE NOT NULL,
    
    -- SDR Metrics (Manuais)
    sdr_conversas_iniciadas INTEGER DEFAULT 0,
    sdr_primeira_resposta INTEGER DEFAULT 0,
    sdr_convites_enviados INTEGER DEFAULT 0,
    sdr_leads_qualificados INTEGER DEFAULT 0,
    sdr_calls_marcadas INTEGER DEFAULT 0,
    
    -- Closer Metrics (Manuais)
    closer_total_calls INTEGER DEFAULT 0,
    closer_calls_agendadas INTEGER DEFAULT 0,
    closer_reagendamentos INTEGER DEFAULT 0,
    closer_no_shows INTEGER DEFAULT 0,

    UNIQUE(id_usuario, data_referencia)
);
`;

try {
    db.exec(migrations);
    console.log('Migração concluída com sucesso!');
} catch (e) {
    console.error('Erro na migração:', e);
}

db.close();
