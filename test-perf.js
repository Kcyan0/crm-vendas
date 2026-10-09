const { createClient } = require('@supabase/supabase-js');

const supabase = createClient('https://mqeptxrbdelvdumlvcle.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xZXB0eHJiZGVsdmR1bWx2Y2xlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NTc0ODAsImV4cCI6MjA4ODIzMzQ4MH0.E-wM92kHlmMd3L7tBWQRahfNIrcc7qwBlSLUU3bNiVA');

async function test() {
    console.log("Starting test...");
    
    const performanceCloser = {};
    const { data: users } = await supabase.from('usuarios').select('id_usuario, nome, tipo').eq('ativo', true).in('tipo', ['CLOSER']);
    (users || []).forEach(u => {
        performanceCloser[u.id_usuario] = { id: u.id_usuario, nome: u.nome, vgv: 0, caixa: 0 };
    });

    const { data: allLeads } = await supabase.from('leads').select('id_lead, id_closer_responsavel, status_atual');
    const validLeadIds = new Set();
    const leadToCloser = {};
    
    (allLeads || []).forEach(l => {
        if (l.status_atual !== 'Reembolsado' && l.status_atual !== 'Loss') {
            validLeadIds.add(l.id_lead);
            if (l.id_closer_responsavel) leadToCloser[l.id_lead] = l.id_closer_responsavel;
        }
    });

    const { data: vendasPeriod } = await supabase
        .from('vendas')
        .select('id_lead, id_closer, valor_bruto')
        .in('status_pagamento', ['pago', 'pendente'])
        .gte('data_venda', '2026-10-01T00:00:00')
        .lte('data_venda', '2026-10-31T23:59:59');

    (vendasPeriod || []).forEach(v => {
        if (!validLeadIds.has(v.id_lead)) return; 
        
        const closerId = v.id_closer ?? leadToCloser[v.id_lead] ?? null;
        if (!closerId || !performanceCloser[closerId]) return;

        performanceCloser[closerId].vgv += parseFloat(v.valor_bruto) || 0;
    });

    console.log("Perf Closer (74):", performanceCloser[74]);
}
test().catch(console.error);
