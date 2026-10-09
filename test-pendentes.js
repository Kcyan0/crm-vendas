const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://mqeptxrbdelvdumlvcle.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xZXB0eHJiZGVsdmR1bWx2Y2xlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NTc0ODAsImV4cCI6MjA4ODIzMzQ4MH0.E-wM92kHlmMd3L7tBWQRahfNIrcc7qwBlSLUU3bNiVA');

async function test() {
    const { data: projLeads } = await supabase.from('leads').select('id_lead').eq('id_projeto', 11).not('status_atual', 'in', '("Reembolsado","Loss")');
    const validLeadIdsArray = (projLeads || []).map(l => l.id_lead);
    
    console.log("validLeadIdsArray length:", validLeadIdsArray.length);

    if (validLeadIdsArray.length > 0) {
        const { data: pendData, error } = await supabase
            .from('vendas')
            .select('id_venda, id_oportunidade, id_lead, valor_bruto')
            .eq('status_pagamento', 'pendente')
            .in('id_lead', validLeadIdsArray);
            
        console.log("Error:", error);
        console.log("pendData length:", pendData?.length);
    }
}
test();
