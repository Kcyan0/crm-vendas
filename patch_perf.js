const fs = require('fs');

const path = 'src/app/api/performance/route.ts';
let content = fs.readFileSync(path, 'utf8');

// 1. Add import for caixaInPeriod at the top
content = content.replace("import supabase from '@/lib/db';", "import supabase from '@/lib/db';\nimport { caixaInPeriod } from '@/lib/financial';");

// 2. Remove incorrect `performanceCloser[closerId].caixa += ...` inside the FIRST `vendasPeriod` loop
const regexCaixaCloserVgv = /performanceCloser\[closerId\]\.caixa \+= [^;]+;/;
content = content.replace(regexCaixaCloserVgv, '// CAIXA is computed separately below');

// 3. Remove incorrect `performanceSDR[sdrId].caixa = ...` inside the SDR loop
const regexCaixaSdrVgv = /performanceSDR\[sdrId\]\.caixa = [^;]+;/;
content = content.replace(regexCaixaSdrVgv, '// CAIXA is computed separately below');

// 4. WE NEED TO INJECT THE NEW CAIXA QUERY.
// Let's insert it right after `// SDR vgv/caixa — fetch sales for leads where the SDR is responsible` block finishes.
const targetInjectPoint = `
        (vendasSdr || []).forEach((v: any) => {
            if (!validLeadIds.has(v.id_lead)) return; // Ignore refunded/lost sales
            
            const sdrId = leadToSdr[v.id_lead];
            if (sdrId && performanceSDR[sdrId]) {
                performanceSDR[sdrId].vgv = (performanceSDR[sdrId].vgv || 0) + (parseFloat(v.valor_bruto) || 0);
                // CAIXA is computed separately below
            }
        });`;

const newCaixaQueryBlock = `
        // ─── NEW CAIXA QUERY ───
        const startDateObj = new Date(\`\${startDate}T00:00:00Z\`);
        startDateObj.setFullYear(startDateObj.getFullYear() - 2);
        const caixaStartBoundary = startDateObj.toISOString().split('T')[0];

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
            if (cxVal > 0) {
                // Closer
                const closerId = v.id_closer;
                if (closerId && performanceCloser[closerId]) {
                    performanceCloser[closerId].caixa += cxVal;
                }
                // SDR
                const sdrId = leadToSdr[v.id_lead];
                if (sdrId && performanceSDR[sdrId]) {
                    performanceSDR[sdrId].caixa = (performanceSDR[sdrId].caixa || 0) + cxVal;
                }
            }
        });
`;

content = content.replace(targetInjectPoint, targetInjectPoint + newCaixaQueryBlock);

fs.writeFileSync(path, content);
console.log('patched performance');
