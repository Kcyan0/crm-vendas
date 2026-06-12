const fs = require('fs');

const path = 'src/app/api/performance/route.ts';
let content = fs.readFileSync(path, 'utf8');

const newBlock = `

        // ─── CAIXA QUERY (correct installment-aware calculation) ──────────────────
        // Pull all paid sales going back 2 years to capture installments landing in this period
        const caixaStartObj = new Date(\`\${startDate}T00:00:00Z\`);
        caixaStartObj.setFullYear(caixaStartObj.getFullYear() - 2);
        const caixaStartBoundary = caixaStartObj.toISOString().split('T')[0];

        let caixaQuery = supabase
            .from('vendas')
            .select('id_lead, id_closer, valor_bruto, valor_liquido_caixa, numero_parcelas, data_recebimento')
            .eq('status_pagamento', 'pago')
            .gte('data_recebimento', caixaStartBoundary)
            .lte('data_recebimento', endDate);
        const { data: caixaPeriod } = await caixaQuery;

        (caixaPeriod || []).forEach((v: any) => {
            if (!validLeadIds.has(v.id_lead)) return; // Ignore refunded/lost sales
            const cxVal = caixaInPeriod(v, startDate, endDate);
            if (cxVal <= 0) return;

            // Credit closer
            const closerId = v.id_closer;
            if (closerId && performanceCloser[closerId]) {
                performanceCloser[closerId].caixa += cxVal;
            }
            // Credit SDR (via lead attribution)
            const sdrId = leadToSdr[v.id_lead];
            if (sdrId && performanceSDR[sdrId]) {
                performanceSDR[sdrId].caixa = (performanceSDR[sdrId].caixa || 0) + cxVal;
            }
        });

`;

// Find position after the vendasSdr loop closes (after the empty lines between sdr loop and reembolsos)
const marker = '        // Reembolsos per user (all-time for conversation rate context)';
const idx = content.indexOf(marker);

if (idx === -1) {
    console.error('Marker not found');
} else {
    content = content.slice(0, idx) + newBlock + content.slice(idx);
    fs.writeFileSync(path, content);
    console.log('Injected caixa block successfully');
}
