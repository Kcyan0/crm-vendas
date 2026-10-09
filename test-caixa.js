const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://mqeptxrbdelvdumlvcle.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xZXB0eHJiZGVsdmR1bWx2Y2xlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NTc0ODAsImV4cCI6MjA4ODIzMzQ4MH0.E-wM92kHlmMd3L7tBWQRahfNIrcc7qwBlSLUU3bNiVA');

async function test() {
    const { data: caixaWithDate } = await supabase.from('vendas').select('id_venda, id_oportunidade, id_closer, valor_bruto, valor_liquido_caixa, numero_parcelas, data_venda, data_recebimento, forma_pagamento, id_lead').eq('status_pagamento', 'pago').gte('data_recebimento', '2026-10-01').lte('data_recebimento', '2026-10-31');
    
    console.log("caixaWithDate count:", caixaWithDate.length);
    const thalisSales = caixaWithDate.filter(v => v.id_closer === 74);
    console.log("Thalis sales in caixaWithDate:", thalisSales);
}
test();
