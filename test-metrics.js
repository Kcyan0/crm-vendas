const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://mqeptxrbdelvdumlvcle.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xZXB0eHJiZGVsdmR1bWx2Y2xlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NTc0ODAsImV4cCI6MjA4ODIzMzQ4MH0.E-wM92kHlmMd3L7tBWQRahfNIrcc7qwBlSLUU3bNiVA');

async function test() {
    const { data: projLeads } = await supabase.from('leads').select('id_lead').eq('id_projeto', 11).not('status_atual', 'in', '("Reembolsado","Loss")');
    const validLeadIds = new Set((projLeads || []).map(l => l.id_lead));

    const { data: leadsInfoData } = await supabase.from('leads').select('id_lead, id_sdr_responsavel, id_closer_responsavel').in('id_lead', Array.from(validLeadIds));
    const leadOwnerMap = {};
    (leadsInfoData || []).forEach(l => { leadOwnerMap[l.id_lead] = { sdr: l.id_sdr_responsavel, closer: l.id_closer_responsavel }; });

    const closerStats = {};

    const { data: caixaWithDate } = await supabase.from('vendas').select('id_venda, id_oportunidade, id_closer, valor_bruto, valor_liquido_caixa, numero_parcelas, data_venda, data_recebimento, forma_pagamento, id_lead').eq('status_pagamento', 'pago').gte('data_recebimento', '2026-10-01').lte('data_recebimento', '2026-10-31');
    const { data: caixaNoDate } = await supabase.from('vendas').select('id_venda, id_oportunidade, id_closer, valor_bruto, valor_liquido_caixa, numero_parcelas, data_venda, data_recebimento, forma_pagamento, id_lead').eq('status_pagamento', 'pago').is('data_recebimento', null).gte('data_venda', '2026-10-01T00:00:00').lt('data_venda', '2026-10-31T23:59:59');

    const vendasCaixa = [...(caixaWithDate || []), ...(caixaNoDate || [])];
    const filteredCaixa = vendasCaixa.filter(v => validLeadIds.has(v.id_lead));

    const mapCaixa = {};
    for (const v of filteredCaixa) {
        const oportId = v.id_oportunidade ?? v.id_lead;
        if (!mapCaixa[oportId]) mapCaixa[oportId] = { id_lead: v.id_lead, id_closer: v.id_closer ?? null, rows: [] };
        mapCaixa[oportId].rows.push(v);
    }
    const groupedSalesCaixa = Object.values(mapCaixa);

    function caixaInPeriod(v, start, end) { return parseFloat(v.valor_liquido_caixa) || 0; }

    for (const sale of groupedSalesCaixa) {
        let saleCaixa = 0;
        for (const v of sale.rows) saleCaixa += caixaInPeriod(v, '2026-10-01', '2026-10-31');
        if (saleCaixa <= 0) continue;

        const owners = leadOwnerMap[sale.id_lead];
        const closerIdFromSale = sale.id_closer ?? owners?.closer ?? null;
        if (closerIdFromSale) {
            if (!closerStats[closerIdFromSale]) closerStats[closerIdFromSale] = { faturamento: 0, caixa: 0, count: 0 };
            closerStats[closerIdFromSale].caixa += saleCaixa;
        }
    }
    console.log("Closer Stats Final (74):", closerStats[74]);
}
test();
