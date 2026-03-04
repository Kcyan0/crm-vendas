const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

console.log('Iniciando migracao de usuarios...');

try {
    const tableInfo = db.prepare("PRAGMA table_info('usuarios')").all();
    const hasProjeto = tableInfo.some(col => col.name === 'id_projeto');

    if (!hasProjeto) {
        db.exec(`
      ALTER TABLE usuarios ADD COLUMN id_projeto INTEGER REFERENCES projetos(id_projeto) ON DELETE CASCADE;
    `);
        console.log('Coluna id_projeto adicionada na tabela usuarios com sucesso.');

        const firstProject = db.prepare('SELECT id_projeto FROM projetos LIMIT 1').get();
        if (firstProject) {
            db.prepare('UPDATE usuarios SET id_projeto = ?').run(firstProject.id_projeto);
            console.log('Todos os usuarios antigos vinculados ao projeto ID ' + firstProject.id_projeto + ' como fallback.');
        }

    } else {
        console.log('A coluna id_projeto ja existe na tabela usuarios.');
    }

} catch (err) {
    console.error('Erro ao executar migracao:', err.message);
} finally {
    db.close();
    console.log('Migracao concluida.');
}
