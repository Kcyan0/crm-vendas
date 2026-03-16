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
const ADMIN_EMAIL = 'cassiano.pn13@gmail.com';
const ADMIN_PASS = '0000';

async function createAdmin() {
    console.log(`Criando conta auth para: ${ADMIN_EMAIL}`);

    // Verificar se já existe
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) { console.error('Erro ao listar users:', listError); return; }

    const exists = users.some(u => u.email === ADMIN_EMAIL);
    if (exists) {
        console.log('Conta já existe no Auth. Atualizando senha...');
        const existing = users.find(u => u.email === ADMIN_EMAIL);
        const { error: updErr } = await supabase.auth.admin.updateUserById(existing.id, { password: ADMIN_PASS });
        if (updErr) console.error('Erro ao atualizar senha:', updErr);
        else console.log('Senha atualizada para 0000!');
    } else {
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email: ADMIN_EMAIL,
            password: ADMIN_PASS,
            email_confirm: true
        });
        if (createError) { console.error('Erro ao criar conta:', createError); return; }
        console.log('Conta criada com sucesso!', newUser.user?.id);
    }

    // Garantir que o email esteja na tabela de usuarios para ter acesso a todos os projetos
    const { data: projetos } = await supabase.from('projetos').select('id_projeto').eq('ativo', true);
    if (projetos && projetos.length > 0) {
        for (const proj of projetos) {
            // Verificar se já existe o registro
            const { data: existing } = await supabase.from('usuarios').select('id_usuario')
                .eq('email', ADMIN_EMAIL).eq('id_projeto', proj.id_projeto).single();

            if (!existing) {
                const { error: insErr } = await supabase.from('usuarios').insert({
                    nome: 'Cassiano (Admin)',
                    email: ADMIN_EMAIL,
                    tipo: 'ADMIN',
                    ativo: true,
                    id_projeto: proj.id_projeto
                });
                if (insErr) console.error(`Erro ao inserir usuario no projeto ${proj.id_projeto}:`, insErr);
                else console.log(`Admin vinculdao ao projeto ${proj.id_projeto}`);
            } else {
                console.log(`Admin já existia no projeto ${proj.id_projeto}`);
            }
        }
    }

    console.log('\n✅ Tudo pronto! Faça login com:');
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Senha: ${ADMIN_PASS}`);
}

createAdmin();
