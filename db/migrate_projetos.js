const fs = require('fs');
const Database = require('better-sqlite3');

const dbPath = './db/database.sqlite';

if (!fs.existsSync(dbPath)) {
    console.error('Banco de dados não encontrado em', dbPath);
    process.exit(1);
}

const db = new Database(dbPath);

console.log('Iniciando migração: Suporte a Múltiplos Projetos...');

try {
    // 1. Criar a nova tabela de Projetos
    db.exec(`
        CREATE TABLE IF NOT EXISTS projetos (
            id_projeto INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            descricao TEXT,
            data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
            ativo BOOLEAN DEFAULT 1
        );
    `);

    // Inserir um projeto padrão se não existir nenhum
    const countProjetos = db.prepare('SELECT COUNT(*) as count FROM projetos').get().count;
    let projetoPadraoId = 1;
    if (countProjetos === 0) {
        console.log('Criando Projeto Padrão Inicial...');
        const stmtProjeto = db.prepare('INSERT INTO projetos (nome, descricao) VALUES (?, ?)');
        projetoPadraoId = stmtProjeto.run('Projeto Principal', 'Projeto padrão do sistema').lastInsertRowid;
    } else {
        projetoPadraoId = db.prepare('SELECT id_projeto FROM projetos ORDER BY id_projeto ASC LIMIT 1').get().id_projeto;
    }

    // 2. Adicionar id_projeto em leads se não existir
    const leadColumns = db.prepare("PRAGMA table_info(leads)").all();
    const hasIdProjeto = leadColumns.some(col => col.name === 'id_projeto');

    if (!hasIdProjeto) {
        console.log('Adicionando coluna id_projeto na tabela leads...');
        db.exec(`
            ALTER TABLE leads ADD COLUMN id_projeto INTEGER REFERENCES projetos(id_projeto) ON DELETE CASCADE;
        `);

        // Atribuir o projeto padrão a todos os leads existentes
        console.log(`Atribuindo todos os leads existentes ao projeto padrão (ID: ${projetoPadraoId})...`);
        db.prepare('UPDATE leads SET id_projeto = ?').run(projetoPadraoId);
    } else {
        console.log('A tabela leads já possui a coluna id_projeto.');
    }

    console.log('Migração de Projetos concluída com sucesso!');

} catch (error) {
    console.error('Erro na migração:', error);
} finally {
    db.close();
}
