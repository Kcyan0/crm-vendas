const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://mqeptxrbdelvdumlvcle.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xZXB0eHJiZGVsdmR1bWx2Y2xlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NTc0ODAsImV4cCI6MjA4ODIzMzQ4MH0.E-wM92kHlmMd3L7tBWQRahfNIrcc7qwBlSLUU3bNiVA'
);

async function debug() {
  // TZN = project 11
  // 1. Vendas de hoje (08/10/2026) no TZN
  const { data: vendasHoje, error } = await supabase
    .from('vendas')
    .select('id_venda, id_lead, id_closer, valor_bruto, valor_liquido_caixa, data_venda, data_recebimento, status_pagamento, forma_pagamento, numero_parcelas')
    .gte('data_venda', '2026-10-08T00:00:00')
    .lt('data_venda', '2026-10-09T00:00:00')
    .order('data_venda', { ascending: true });

  console.log("=== VENDAS COM data_venda em 08/10/2026 ===");
  console.log("Total:", vendasHoje?.length);
  
  // Check which ones belong to TZN (project 11)
  if (vendasHoje?.length > 0) {
    const leadIds = vendasHoje.map(v => v.id_lead);
    const { data: leadsInfo } = await supabase
      .from('leads')
      .select('id_lead, id_projeto, nome')
      .in('id_lead', leadIds);
    
    const leadProjectMap = {};
    (leadsInfo || []).forEach(l => { leadProjectMap[l.id_lead] = { projeto: l.id_projeto, nome: l.nome }; });
    
    for (const v of vendasHoje) {
      const lead = leadProjectMap[v.id_lead] || {};
      if (lead.projeto === 11) {
        console.log(`  id_venda=${v.id_venda} lead=${lead.nome} valor_bruto=${v.valor_bruto} liq=${v.valor_liquido_caixa} data_venda=${v.data_venda} data_rec=${v.data_recebimento} status=${v.status_pagamento} forma=${v.forma_pagamento}`);
      }
    }
  }

  // 2. Now check what the API filter would select
  // startVendaFilter = '2026-10-08T03:00:00.000Z'
  // endFilter = '2026-10-09T03:00:00.000Z'
  console.log("\n=== FILTRO da API para startDate=2026-10-08 endDate=2026-10-08 ===");
  console.log("startVendaFilter: 2026-10-08T03:00:00.000Z");
  console.log("endFilter: 2026-10-09T03:00:00.000Z");
  
  const { data: vendasAPI } = await supabase
    .from('vendas')
    .select('id_venda, id_lead, valor_bruto, data_venda, status_pagamento')
    .gte('data_venda', '2026-10-08T03:00:00.000Z')
    .lt('data_venda', '2026-10-09T03:00:00.000Z');
  
  console.log("Vendas que o filtro da API pega:", vendasAPI?.length);
  
  if (vendasAPI?.length > 0) {
    const leadIds2 = vendasAPI.map(v => v.id_lead);
    const { data: leadsInfo2 } = await supabase
      .from('leads')
      .select('id_lead, id_projeto')
      .in('id_lead', leadIds2);
    
    const lp2 = {};
    (leadsInfo2 || []).forEach(l => { lp2[l.id_lead] = l.id_projeto; });
    
    const tznVendas = vendasAPI.filter(v => lp2[v.id_lead] === 11);
    console.log("Dessas, do TZN:", tznVendas.length);
    tznVendas.forEach(v => console.log(`  id_venda=${v.id_venda} valor=${v.valor_bruto} data_venda=${v.data_venda} status=${v.status_pagamento}`));
  }

  // 3. Check vendas saved today but with different data_venda timestamp
  console.log("\n=== VENDAS RECENTES (últimas 20 do TZN) ===");
  const { data: recentVendas } = await supabase
    .from('vendas')
    .select('id_venda, id_lead, valor_bruto, data_venda, data_recebimento, status_pagamento, created_at')
    .order('id_venda', { ascending: false })
    .limit(20);
    
  if (recentVendas?.length > 0) {
    const leadIds3 = recentVendas.map(v => v.id_lead);
    const { data: leadsInfo3 } = await supabase
      .from('leads')
      .select('id_lead, id_projeto, nome')
      .in('id_lead', leadIds3);
    
    const lp3 = {};
    (leadsInfo3 || []).forEach(l => { lp3[l.id_lead] = { projeto: l.id_projeto, nome: l.nome }; });
    
    for (const v of recentVendas) {
      const lead = lp3[v.id_lead] || {};
      if (lead.projeto === 11) {
        console.log(`  id=${v.id_venda} lead=${lead.nome} bruto=${v.valor_bruto} data_venda=${v.data_venda} created=${v.created_at} status=${v.status_pagamento}`);
      }
    }
  }

  // 4. Caixa vs Faturamento for outubro TZN
  console.log("\n=== CAIXA vs FATURAMENTO - TZN Outubro ===");
  const { data: tznLeads } = await supabase
    .from('leads')
    .select('id_lead')
    .eq('id_projeto', 11)
    .not('status_atual', 'in', '("Reembolsado","Loss")');
  
  const tznLeadIds = new Set((tznLeads || []).map(l => l.id_lead));
  console.log("TZN valid leads:", tznLeadIds.size);
  
  // Faturamento (data_venda no período)
  const { data: fatOut } = await supabase
    .from('vendas')
    .select('id_venda, id_lead, id_oportunidade, valor_bruto, status_pagamento')
    .in('status_pagamento', ['pago', 'pendente'])
    .gte('data_venda', '2026-10-01T03:00:00.000Z')
    .lt('data_venda', '2026-11-01T03:00:00.000Z');
  
  const fatTzn = (fatOut || []).filter(v => tznLeadIds.has(v.id_lead));
  const mapFat = {};
  for (const v of fatTzn) {
    const k = v.id_oportunidade ?? v.id_lead;
    if (!mapFat[k]) mapFat[k] = 0;
    mapFat[k] += parseFloat(v.valor_bruto) || 0;
  }
  const faturamento = Object.values(mapFat).reduce((s, v) => s + v, 0);
  console.log("Faturamento (vendas do período):", faturamento);

  // Caixa (data_recebimento ou data_venda no período, status=pago)
  const { data: caixaA } = await supabase
    .from('vendas')
    .select('id_venda, id_lead, id_oportunidade, valor_bruto, valor_liquido_caixa, numero_parcelas, data_recebimento, data_venda')
    .eq('status_pagamento', 'pago')
    .gte('data_recebimento', '2024-10-01')
    .lte('data_recebimento', '2026-10-31');
  
  const { data: caixaB } = await supabase
    .from('vendas')
    .select('id_venda, id_lead, id_oportunidade, valor_bruto, valor_liquido_caixa, numero_parcelas, data_recebimento, data_venda')
    .eq('status_pagamento', 'pago')
    .is('data_recebimento', null)
    .gte('data_venda', '2026-10-01T03:00:00.000Z')
    .lt('data_venda', '2026-11-01T03:00:00.000Z');
  
  const allCaixa = [...(caixaA || []), ...(caixaB || [])].filter(v => tznLeadIds.has(v.id_lead));
  
  function caixaInPeriod(row) {
    const parcelas = row.numero_parcelas || 1;
    const totalLiq = row.valor_liquido_caixa != null ? parseFloat(row.valor_liquido_caixa) : (parseFloat(row.valor_bruto) || 0);
    const valorParcela = totalLiq / parcelas;
    const rawDate = (row.data_recebimento || (row.data_venda || '').substring(0, 10));
    if (!rawDate) return 0;
    const parts = rawDate.split('-');
    if (parts.length < 3) return 0;
    const [y, m, d] = parts.map(Number);
    let total = 0;
    for (let i = 0; i < parcelas; i++) {
      let instY = y;
      let instM = m - 1 + i;
      instY += Math.floor(instM / 12);
      instM = instM % 12;
      const instDateStr = `${instY}-${String(instM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (instDateStr >= '2026-10-01' && instDateStr <= '2026-10-31') total += valorParcela;
    }
    return total;
  }
  
  let totalCaixa = 0;
  for (const v of allCaixa) totalCaixa += caixaInPeriod(v);
  console.log("Caixa (recebido no período):", totalCaixa);
  console.log("Diferença (Caixa - Fat):", totalCaixa - faturamento);
}

debug().catch(e => console.error(e));
