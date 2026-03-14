const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Ler o .env.local
const envPath = path.resolve(__dirname, '../.env.local');
const envFile = fs.readFileSync(envPath, 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
    const match = line.replace('\r', '').match(/^([^=]+)="?(.*?)"?$/);
    if (match) env[match[1]] = match[2];
});

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
    console.error('Missing URL or KEY in .env.local');
    process.exit(1);
}

const supabase = createClient(url, key);

async function migrateUsers() {
    console.log('Buscando e-mails na tabela pública usuarios...');
    const { data: usuarios, error } = await supabase.from('usuarios').select('email').not('email', 'is', null);

    if (error) {
        console.error('Erro ao buscar usuários:', error);
        return;
    }

    const uniqueEmails = [...new Set(usuarios.map(u => u.email.trim().toLowerCase()))].filter(Boolean);
    console.log(`Encontrados ${uniqueEmails.length} e-mails únicos ativos.`);

    for (const email of uniqueEmails) {
        console.log(`Processando: ${email}`);
        
        // Verifica se usuário já existe para não dar erro
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
        if (users && users.some(u => u.email === email)) {
            console.log(` -> Já existe conta em auth.users para ${email}`);
            continue;
        }

        // Criar usuário com email_confirm=true para poder logar imediatamente e senha 0000
        const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
            email: email,
            password: '0000',
            email_confirm: true
        });

        if (createError) {
            console.error(` -> Erro ao criar conta para ${email}:`, createError);
        } else {
            console.log(` -> Conta criada com sucesso para ${email}!`);
        }
    }
    console.log('Migração Auth finalizada.');
}

migrateUsers();
