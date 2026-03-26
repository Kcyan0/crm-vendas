const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase credentials in env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: vendas, error } = await supabase.from('vendas').select('*');
  if (error) {
    console.error(error);
    process.exit(1);
  }

  let updatedCount = 0;
  for (const v of vendas) {
    const bruto = parseFloat(v.valor_bruto) || 0;
    const taxa = parseFloat(v.taxa_gateway) || 0;
    const desc = parseFloat(v.desconto_concedido) || 0;

    const correto = bruto - taxa - desc;
    
    // Check if what is in the db is different by more than a cent
    if (Math.abs((parseFloat(v.valor_liquido_caixa) || 0) - correto) > 0.01) {
      await supabase.from('vendas').update({ valor_liquido_caixa: correto }).eq('id_venda', v.id_venda);
      updatedCount++;
    }
  }

  console.log(`Updated ${updatedCount} sales with correct net cash logic.`);
}

run();
