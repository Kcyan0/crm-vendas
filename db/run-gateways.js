const Database = require('better-sqlite3');
const db = new Database('./db/database.sqlite');
db.exec(`
CREATE TABLE IF NOT EXISTS gateways_pagamento (
    id_gateway INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    taxa_percentual REAL DEFAULT 0.00,
    taxa_fixa REAL DEFAULT 0.00,
    ativo BOOLEAN DEFAULT 1,
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO gateways_pagamento (nome, taxa_percentual, taxa_fixa, ativo) 
SELECT 'PIX', 0.00, 0.00, 1
WHERE NOT EXISTS (SELECT 1 FROM gateways_pagamento WHERE nome = 'PIX');

INSERT INTO gateways_pagamento (nome, taxa_percentual, taxa_fixa, ativo) 
SELECT 'Cartão de Crédito', 4.99, 1.00, 1
WHERE NOT EXISTS (SELECT 1 FROM gateways_pagamento WHERE nome = 'Cartão de Crédito');

INSERT INTO gateways_pagamento (nome, taxa_percentual, taxa_fixa, ativo) 
SELECT 'Boleto Bancário', 0.00, 3.50, 1
WHERE NOT EXISTS (SELECT 1 FROM gateways_pagamento WHERE nome = 'Boleto Bancário');
`);
console.log('Tabela gateways_pagamento criada com sucesso!');
