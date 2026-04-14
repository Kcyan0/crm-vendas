const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://mqeptxrbdelvdumlvcle.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xZXB0eHJiZGVsdmR1bWx2Y2xlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjY1NzQ4MCwiZXhwIjoyMDg4MjMzNDgwfQ.Bs1lZZXYfmDTKcFMbtkD8oYSQrGjO9RccRxWa194V-8";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsers() {
  const { data: users } = await supabase.from('usuarios').select('id_usuario, nome, tipo');
  const leoUser = users.find(u => u.nome.toLowerCase().includes('leo'));
  const leoId = leoUser.id_usuario;

  const { data: leads } = await supabase.from('leads')
    .select('id_lead, nome, id_sdr_responsavel, id_closer_responsavel, status_atual')
    .eq('id_sdr_responsavel', leoId)
    .neq('status_atual', 'Reembolsado')
    .neq('status_atual', 'Loss');
    
  const leadIds = leads.map(l => l.id_lead);
  
  const { data: vendas } = await supabase
    .from('vendas')
    .select('*')
    .in('id_lead', leadIds)
    .in('status_pagamento', ['pago', 'pendente']);

  let totalCaixa = 0;
  for (const v of vendas) {
    const lead = leads.find(l => l.id_lead === v.id_lead);
    console.log(`Lead: ${lead.nome} | Bruto: ${v.valor_bruto} | Caixa: ${v.valor_liquido_caixa}`);
    totalCaixa += parseFloat(v.valor_liquido_caixa || v.valor_bruto);
  }

  console.log(`\nSDR Leo Total Caixa: R$ ${totalCaixa.toFixed(2)}`);
}

checkUsers().catch(console.error);
