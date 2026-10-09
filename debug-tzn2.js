const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://mqeptxrbdelvdumlvcle.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xZXB0eHJiZGVsdmR1bWx2Y2xlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NTc0ODAsImV4cCI6MjA4ODIzMzQ4MH0.E-wM92kHlmMd3L7tBWQRahfNIrcc7qwBlSLUU3bNiVA'
);

async function debug() {
  // Check the LAST 30 vendas for TZN project 11
  // Need to get all vendas and cross-ref with leads
  const { data: tznLeads } = await supabase
    .from('leads')
    .select('id_lead')
    .eq('id_projeto', 11);
  const tznSet = new Set((tznLeads || []).map(l => l.id_lead));

  // Get recent vendas
  const { data: recent } = await supabase
    .from('vendas')
    .select('id_venda, id_lead, valor_bruto, data_venda, data_recebimento, status_pagamento, forma_pagamento')
    .order('id_venda', { ascending: false })
    .limit(50);

  console.log("=== ÚLTIMAS VENDAS DO TZN (projeto 11) ===");
  let count = 0;
  for (const v of (recent || [])) {
    if (tznSet.has(v.id_lead) && count < 20) {
      console.log(`id=${v.id_venda} lead=${v.id_lead} bruto=${v.valor_bruto} data_venda=${v.data_venda} data_rec=${v.data_recebimento} status=${v.status_pagamento} forma=${v.forma_pagamento}`);
      count++;
    }
  }

  // Check vendas from October for TZN
  console.log("\n=== VENDAS TZN OUTUBRO (data_venda >= 2026-10-01) ===");
  const { data: outVendas } = await supabase
    .from('vendas')
    .select('id_venda, id_lead, valor_bruto, data_venda, data_recebimento, status_pagamento')
    .in('status_pagamento', ['pago', 'pendente'])
    .gte('data_venda', '2026-10-01T03:00:00.000Z')
    .lt('data_venda', '2026-11-01T03:00:00.000Z')
    .order('data_venda', { ascending: true });
  
  let fatTotal = 0;
  let vendaCount = 0;
  for (const v of (outVendas || [])) {
    if (tznSet.has(v.id_lead)) {
      console.log(`id=${v.id_venda} lead=${v.id_lead} bruto=${v.valor_bruto} data_venda=${v.data_venda} status=${v.status_pagamento}`);
      fatTotal += parseFloat(v.valor_bruto) || 0;
      vendaCount++;
    }
  }
  console.log(`\nTotal vendas TZN outubro: ${vendaCount}, Soma bruto: ${fatTotal}`);
  
  // Check: vendas de hoje that the user may have saved
  console.log("\n=== VENDAS SALVAS HOJE (created_at) ===");
  // Check if created_at column exists
  const { data: todayCreated } = await supabase
    .from('vendas')
    .select('id_venda, id_lead, valor_bruto, data_venda, data_recebimento, status_pagamento')
    .gte('data_venda', '2026-10-08T00:00:00')
    .lt('data_venda', '2026-10-09T23:59:59')
    .order('id_venda', { ascending: false });

  for (const v of (todayCreated || [])) {
    if (tznSet.has(v.id_lead)) {
      console.log(`id=${v.id_venda} lead=${v.id_lead} bruto=${v.valor_bruto} data_venda=${v.data_venda} data_rec=${v.data_recebimento} status=${v.status_pagamento}`);
    }
  }
}

debug().catch(e => console.error(e));
