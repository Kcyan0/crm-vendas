const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('Adicionando colunas de taxa de entrada na tabela gateways...');
    const { error: e1 } = await supabase.rpc('execute_sql', {
        query: `
            ALTER TABLE public.gateways 
            ADD COLUMN IF NOT EXISTS taxa_entrada_percentual NUMERIC(10, 2) DEFAULT 0.00,
            ADD COLUMN IF NOT EXISTS taxa_entrada_fixa_valor NUMERIC(10, 2) DEFAULT 0.00;
        `
    });
    if(e1) {
        console.log('Notice: custom postgres endpoint not found or error: ', e1.message);
        console.log('Vamos tentar criar via REST as columns? Não é suportado, precisamos executar via Dashboard Supabase ou pg_query se disponível.');
    } else {
        console.log('Feito.');
    }
}
run();
