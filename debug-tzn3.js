const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://mqeptxrbdelvdumlvcle.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xZXB0eHJiZGVsdmR1bWx2Y2xlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NTc0ODAsImV4cCI6MjA4ODIzMzQ4MH0.E-wM92kHlmMd3L7tBWQRahfNIrcc7qwBlSLUU3bNiVA'
);

async function debug() {
  // Check what the dashboard sends for "today" on 08/10
  // The dashboard page.tsx initializes:
  //   startDate = new Date().toISOString().split('T')[0]  
  //   endDate = new Date().toISOString().split('T')[0]
  // At 23:41 BRT (Oct 8), new Date() in the browser is local time Oct 8
  // BUT .toISOString() converts to UTC first!
  // 23:41 BRT = 02:41 UTC on Oct 9
  // So toISOString() = "2026-10-09T02:41:..."  
  // split('T')[0] = "2026-10-09"  <-- THIS IS THE BUG!
  
  const now = new Date(); // simulating browser
  console.log("=== SIMULAÇÃO DO FRONTEND ===");
  console.log("Date.now() local (BRT -3):", now.toString());
  console.log("toISOString():", now.toISOString());
  console.log("toISOString().split('T')[0]:", now.toISOString().split('T')[0]);
  
  // The correct date in BRT
  const nowBR = new Date(Date.now() - 3 * 60 * 60 * 1000);
  console.log("\nData correta BRT:", `${nowBR.getUTCFullYear()}-${String(nowBR.getUTCMonth()+1).padStart(2,'0')}-${String(nowBR.getUTCDate()).padStart(2,'0')}`);
  
  // Check what happens when user filters for "today" Oct 8
  // If browser sends startDate=2026-10-09 (due to UTC conversion after 21:00 BRT)
  // The API would look for vendas from Oct 9 - finding nothing
  
  console.log("\n=== VENDAS COM data_venda em 08/10/2026 (filtro correto) ===");
  const { data: v1 } = await supabase.from('vendas').select('id_venda, valor_bruto, data_venda')
    .gte('data_venda', '2026-10-08T03:00:00.000Z')
    .lt('data_venda', '2026-10-09T03:00:00.000Z');
  console.log("Vendas encontradas:", v1?.length);
  v1?.forEach(v => console.log(`  id=${v.id_venda} bruto=${v.valor_bruto} data=${v.data_venda}`));
  
  console.log("\n=== VENDAS COM data_venda em 09/10/2026 (o que o frontend pode estar pedindo) ===");
  const { data: v2 } = await supabase.from('vendas').select('id_venda, valor_bruto, data_venda')
    .gte('data_venda', '2026-10-09T03:00:00.000Z')
    .lt('data_venda', '2026-10-10T03:00:00.000Z');
  console.log("Vendas encontradas:", v2?.length);
}

debug().catch(e => console.error(e));
