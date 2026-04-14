require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function fixLegado() {
  console.log("=> Buscando todas as vendas pagas...");
  const { data: vendas, error: errVendas } = await supabase
    .from('vendas')
    .select('id_lead, valor_bruto, forma_pagamento')
    .eq('status_pagamento', 'pago');

  if (errVendas) return console.error(errVendas);

  console.log(`=> Encontradas ${vendas.length} parcelas/linhas de venda`);

  // Soma valor bruto por lead. Cuidado para não duplicar, a API de Vendas separa em 'Entrada' e 'Parcelada'. 
  // O somatório dos valor_bruto dá exatamente o valor total se a gente pegar apenas as linhas que NÃO são parcela, 
  // OU se o schema separar as parcelas nós temos que agrupar.
  // Pelo schema, cada venda registra o "bruto" que a linha parcela ou entrada cobrem.
  
  const leadTotals = {};
  for (const v of vendas) {
    if (!v.id_lead) continue;
    if (!leadTotals[v.id_lead]) leadTotals[v.id_lead] = 0;
    leadTotals[v.id_lead] += Number(v.valor_bruto);
  }

  console.log("=> Totais calculados por lead. Atualizando tabela leads...");
  let count = 0;
  for (const [id_lead, total] of Object.entries(leadTotals)) {
     await supabase
       .from('leads')
       .update({ valor_proposta: total })
       .eq('id_lead', id_lead);
     count++;
     process.stdout.write(`\r=> Leads atualizados: ${count} / ${Object.keys(leadTotals).length}`);
  }
  
  console.log("\n=> Concluído com sucesso!");
}

fixLegado();
