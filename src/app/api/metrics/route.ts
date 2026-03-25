import { NextResponse } from 'next/server';
import supabase from '@/lib/db';

// Strip "(Entrada)" / "(Parcelas)" suffixes so we get the base gateway name
function baseGateway(forma: string): string {
    return (forma || 'PIX').replace(/ \(Entrada\)| \(Parcelas\)/g, '').trim();
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

        const startDate = searchParams.get('startDate') || firstDay;
        const endDate = searchParams.get('endDate') || lastDay;
        const projectId = searchParams.get('projectId');

        // Fetch all paid sales in period (include id_oportunidade for grouping)
        const { data: vendas } = await supabase
            .from('vendas')
            .select('id_venda, id_oportunidade, valor_bruto, valor_liquido_caixa, numero_parcelas, data_venda, data_recebimento, forma_pagamento, id_lead')
            .eq('status_pagamento', 'pago')
            .gte('data_venda', `${startDate}T00:00:00`)
            .lte('data_venda', `${endDate}T23:59:59`);

        // Filter by project through leads if projectId
        let validLeadIds: Set<number> | null = null;
        if (projectId) {
            const { data: projLeads } = await supabase.from('leads').select('id_lead').eq('id_projeto', projectId).not('status_atual', 'in', '("Reembolsado","Loss")');
            validLeadIds = new Set((projLeads || []).map((l: any) => l.id_lead));
        } else {
            const { data: projLeads } = await supabase.from('leads').select('id_lead').not('status_atual', 'in', '("Reembolsado","Loss")');
            validLeadIds = new Set((projLeads || []).map((l: any) => l.id_lead));
        }

        const filteredVendas = (vendas || []).filter((v: any) => validLeadIds!.has(v.id_lead));

        // ─── GROUP rows by id_oportunidade ───────────────────────────────────────────
        // Each sale (oportunidade) may have multiple rows (entrada + parcelas).
        // Collapse them so metrics count SALES not ROWS.
        const salesMap: Record<number, {
            id_oportunidade: number;
            id_lead: number;
            valor_bruto: number;        // total sum of all rows
            valor_liquido_caixa: number;
            gateways: string[];         // base gateway names (deduplicated)
            rows: any[];                // raw rows for caixa calculation
        }> = {};

        for (const v of filteredVendas) {
            const oportId = v.id_oportunidade ?? v.id_lead; // fallback
            if (!salesMap[oportId]) {
                salesMap[oportId] = {
                    id_oportunidade: oportId,
                    id_lead: v.id_lead,
                    valor_bruto: 0,
                    valor_liquido_caixa: 0,
                    gateways: [],
                    rows: []
                };
            }
            salesMap[oportId].valor_bruto += parseFloat(v.valor_bruto) || 0;
            salesMap[oportId].valor_liquido_caixa += parseFloat(v.valor_liquido_caixa) || 0;
            salesMap[oportId].rows.push(v);
            const gw = baseGateway(v.forma_pagamento);
            if (!salesMap[oportId].gateways.includes(gw)) {
                salesMap[oportId].gateways.push(gw);
            }
        }
        const groupedSales = Object.values(salesMap);

        // ─── Core KPIs ─────────────────────────────────────────────────────────────
        const receita = groupedSales.reduce((sum, s) => sum + s.valor_bruto, 0);
        const vendasTotais = groupedSales.length; // count distinct sales, not rows

        // Caixa líquido (simulate installments across period)
        const start = new Date(startDate);
        const end = new Date(endDate);
        let caixaLiquido = 0;
        for (const sale of groupedSales) {
            for (const v of sale.rows) {
                const parcelas = v.numero_parcelas || 1;
                const valorParcela = (parseFloat(v.valor_liquido_caixa) || parseFloat(v.valor_bruto) || 0) / parcelas;
                const dataBase = new Date(v.data_recebimento || v.data_venda);
                for (let i = 0; i < parcelas; i++) {
                    const dataParcela = new Date(dataBase);
                    dataParcela.setMonth(dataParcela.getMonth() + i);
                    if (dataParcela >= start && dataParcela <= end) {
                        caixaLiquido += valorParcela;
                    }
                }
            }
        }

        // Count leads in period
        let leadsQuery = supabase.from('leads').select('id_lead').gte('data_entrada', `${startDate}T00:00:00`).lte('data_entrada', `${endDate}T23:59:59`);
        if (projectId) leadsQuery = leadsQuery.eq('id_projeto', projectId);
        const { data: leadsData } = await leadsQuery;
        const leadsTotais = leadsData?.length || 0;

        const conversaoAproximada = leadsTotais > 0 ? ((vendasTotais / leadsTotais) * 100).toFixed(1) : '0.0';

        // Receita por forma de pagamento (use base gateway, accumulate per sale)
        const byPayment: Record<string, number> = {};
        for (const sale of groupedSales) {
            // Spread the total valor_bruto proportionally across gateways
            for (const v of sale.rows) {
                const gw = baseGateway(v.forma_pagamento);
                byPayment[gw] = (byPayment[gw] || 0) + (parseFloat(v.valor_bruto) || 0);
            }
        }
        const receitaPorPagamento = Object.entries(byPayment).map(([name, value]) => ({ name, value }));

        // Ticket Médio (per distinct sale)
        const ticketMedio = vendasTotais > 0 ? receita / vendasTotais : 0;

        // Fetch User details for naming
        const { data: usersData } = await supabase.from('usuarios').select('id_usuario, nome').in('tipo', ['SDR', 'CLOSER']);
        const usersMap: Record<number, string> = {};
        (usersData || []).forEach((u: any) => { usersMap[u.id_usuario] = u.nome; });

        // Map lead owners for the filtered sales
        const { data: leadsInfoData } = await supabase.from('leads').select('id_lead, id_sdr_responsavel, id_closer_responsavel').in('id_lead', Array.from(validLeadIds!));
        const leadOwnerMap: Record<number, { sdr: number, closer: number }> = {};
        (leadsInfoData || []).forEach((l: any) => {
            leadOwnerMap[l.id_lead] = { sdr: l.id_sdr_responsavel, closer: l.id_closer_responsavel };
        });

        const byCloser: Record<string, number> = {};
        const bySdr: Record<string, number> = {};
        const closerStats: Record<string, { faturamento: number, caixa: number, count: number }> = {};
        const sdrStats: Record<string, { faturamento: number, caixa: number, count: number }> = {};

        // Aggregate per SALE (not per row) for accurate ticket médio
        for (const sale of groupedSales) {
            const valBruto = sale.valor_bruto;

            // Caixa for this sale in period
            let valCaixa = 0;
            for (const v of sale.rows) {
                const parcelas = v.numero_parcelas || 1;
                const valorParcela = (parseFloat(v.valor_liquido_caixa) || parseFloat(v.valor_bruto) || 0) / parcelas;
                const dataBase = new Date(v.data_recebimento || v.data_venda);
                for (let i = 0; i < parcelas; i++) {
                    const dataParcela = new Date(dataBase);
                    dataParcela.setMonth(dataParcela.getMonth() + i);
                    if (dataParcela >= start && dataParcela <= end) {
                        valCaixa += valorParcela;
                    }
                }
            }

            const owners = leadOwnerMap[sale.id_lead];
            if (owners) {
                if (owners.closer) {
                    const cName = usersMap[owners.closer] || 'Desconhecido';
                    byCloser[cName] = (byCloser[cName] || 0) + valBruto;
                    if (!closerStats[cName]) closerStats[cName] = { faturamento: 0, caixa: 0, count: 0 };
                    closerStats[cName].faturamento += valBruto;
                    closerStats[cName].caixa += valCaixa;
                    closerStats[cName].count += 1;
                }
                if (owners.sdr) {
                    const sName = usersMap[owners.sdr] || 'Desconhecido';
                    bySdr[sName] = (bySdr[sName] || 0) + valBruto;
                    if (!sdrStats[sName]) sdrStats[sName] = { faturamento: 0, caixa: 0, count: 0 };
                    sdrStats[sName].faturamento += valBruto;
                    sdrStats[sName].caixa += valCaixa;
                    sdrStats[sName].count += 1;
                }
            }
        }

        const receitaPorCloser = Object.entries(byCloser).map(([name, value]) => ({ name, value }));
        const receitaPorSdr = Object.entries(bySdr).map(([name, value]) => ({ name, value }));

        const tmFaturamentoCloser = Object.entries(closerStats).map(([name, stats]) => ({ name, value: stats.count > 0 ? stats.faturamento / stats.count : 0 })).sort((a, b) => b.value - a.value);
        const tmCaixaCloser = Object.entries(closerStats).map(([name, stats]) => ({ name, value: stats.count > 0 ? stats.caixa / stats.count : 0 })).sort((a, b) => b.value - a.value);
        const tmFaturamentoSdr = Object.entries(sdrStats).map(([name, stats]) => ({ name, value: stats.count > 0 ? stats.faturamento / stats.count : 0 })).sort((a, b) => b.value - a.value);
        const tmCaixaSdr = Object.entries(sdrStats).map(([name, stats]) => ({ name, value: stats.count > 0 ? stats.caixa / stats.count : 0 })).sort((a, b) => b.value - a.value);

        return NextResponse.json({
            receita,
            caixaLiquido,
            leadsTotais,
            vendasTotais,
            conversaoAproximada,
            ticketMedio,
            receitaPorPagamento,
            receitaPorCloser,
            receitaPorSdr,
            tmFaturamentoCloser,
            tmCaixaCloser,
            tmFaturamentoSdr,
            tmCaixaSdr,
            period: { startDate, endDate }
        });
    } catch (error: any) {
        console.error('Metrics error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
