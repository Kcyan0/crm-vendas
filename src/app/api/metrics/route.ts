import { NextResponse } from 'next/server';
import supabase from '@/lib/db';

// Strip "(Entrada)" / "(Parcelas)" suffixes so we get the base gateway name
function baseGateway(forma: string): string {
    return (forma || 'PIX').replace(/ \(Entrada\)| \(Parcelas\)/g, '').trim();
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        // Use Brazil local date (UTC-3) for "today" default so the month boundaries
        // match what the user sees in BRT, not UTC.
        const nowBR = new Date(Date.now() - 3 * 60 * 60 * 1000);
        const firstDay = new Date(nowBR.getUTCFullYear(), nowBR.getUTCMonth(), 1).toISOString().split('T')[0];
        const lastDay  = new Date(nowBR.getUTCFullYear(), nowBR.getUTCMonth() + 1, 0).toISOString().split('T')[0];

        const startDate = searchParams.get('startDate') || firstDay;
        const endDate   = searchParams.get('endDate')   || lastDay;
        const projectId = searchParams.get('projectId');

        // Fetch all paid sales in period (include id_oportunidade for grouping)
        // We store data_venda as noon UTC (T12:00:00Z) anchored to the BRT calendar date,
        // so filtering with -03:00 midnight boundaries correctly spans each local day.
        // BRT midnight start = UTC T03:00:00 of same day
        // BRT midnight end   = UTC T03:00:00 of NEXT day
        const endDatePlusOne = new Date(`${endDate}T03:00:00.000Z`);
        endDatePlusOne.setUTCDate(endDatePlusOne.getUTCDate() + 1);
        const endFilter = endDatePlusOne.toISOString(); // e.g. 2026-04-24T03:00:00.000Z

        const { data: vendas } = await supabase
            .from('vendas')
            .select('id_venda, id_oportunidade, valor_bruto, valor_liquido_caixa, numero_parcelas, data_venda, data_recebimento, forma_pagamento, id_lead')
            .eq('status_pagamento', 'pago')
            .gte('data_venda', `${startDate}T03:00:00.000Z`)
            .lt('data_venda', endFilter);

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
            salesMap[oportId].valor_liquido_caixa += v.valor_liquido_caixa != null ? parseFloat(v.valor_liquido_caixa) : (parseFloat(v.valor_bruto) || 0);
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
                const valorParcela = (v.valor_liquido_caixa != null ? parseFloat(v.valor_liquido_caixa) : (parseFloat(v.valor_bruto) || 0)) / parcelas;
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

        // Receita por forma de pagamento (Caixa Líquido no período atual para visualização do donut)
        const byPayment: Record<string, number> = {};
        for (const sale of groupedSales) {
            for (const v of sale.rows) {
                const gw = baseGateway(v.forma_pagamento);
                const parcelas = v.numero_parcelas || 1;
                const valorParcela = (v.valor_liquido_caixa != null ? parseFloat(v.valor_liquido_caixa) : (parseFloat(v.valor_bruto) || 0)) / parcelas;
                const dataBase = new Date(v.data_recebimento || v.data_venda);
                
                let cxDaParcela = 0;
                for (let i = 0; i < parcelas; i++) {
                    const dataParcela = new Date(dataBase);
                    dataParcela.setMonth(dataParcela.getMonth() + i);
                    if (dataParcela >= start && dataParcela <= end) {
                        cxDaParcela += valorParcela;
                    }
                }
                if (cxDaParcela !== 0) {
                    byPayment[gw] = (byPayment[gw] || 0) + cxDaParcela;
                }
            }
        }
        const receitaPorPagamento = Object.entries(byPayment).map(([name, value]) => ({ name, value }));

        // Ticket Médio (per distinct sale)
        const ticketMedio = vendasTotais > 0 ? receita / vendasTotais : 0;

        // Fetch User details for naming + commission %
        const { data: usersData } = await supabase.from('usuarios').select('id_usuario, nome, percentual_comissao_closer, percentual_comissao_sdr').in('tipo', ['SDR', 'CLOSER', 'ADMIN']);
        const usersMap: Record<number, string> = {};
        const userCommissionMap: Record<number, { pctCloser: number; pctSdr: number }> = {};
        (usersData || []).forEach((u: any) => {
            usersMap[u.id_usuario] = u.nome;
            userCommissionMap[u.id_usuario] = {
                pctCloser: parseFloat(u.percentual_comissao_closer) || 0,
                pctSdr: parseFloat(u.percentual_comissao_sdr) || 0,
            };
        });

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
                const valorParcela = (v.valor_liquido_caixa != null ? parseFloat(v.valor_liquido_caixa) : (parseFloat(v.valor_bruto) || 0)) / parcelas;
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

        // ─── Commission calculation (Alternativa A) ─────────────────────────────
        // For each closer/sdr: sum (caixa * pct%) across all their sales in period
        let comissaoCloserTotal = 0;
        let comissaoSdrTotal = 0;
        const comissaoCloserDetalhes: { nome: string; caixa: number; pct: number; comissao: number }[] = [];
        const comissaoSdrDetalhes: { nome: string; caixa: number; pct: number; comissao: number }[] = [];

        for (const sale of groupedSales) {
            let saleCaixa = 0;
            for (const v of sale.rows) {
                const parcelas = v.numero_parcelas || 1;
                const valorParcela = (v.valor_liquido_caixa != null ? parseFloat(v.valor_liquido_caixa) : (parseFloat(v.valor_bruto) || 0)) / parcelas;
                const dataBase = new Date(v.data_recebimento || v.data_venda);
                for (let i = 0; i < parcelas; i++) {
                    const dataParcela = new Date(dataBase);
                    dataParcela.setMonth(dataParcela.getMonth() + i);
                    if (dataParcela >= start && dataParcela <= end) saleCaixa += valorParcela;
                }
            }
            const owners = leadOwnerMap[sale.id_lead];
            if (owners?.closer) {
                const pct = userCommissionMap[owners.closer]?.pctCloser || 0;
                comissaoCloserTotal += saleCaixa * pct / 100;
            }
            if (owners?.sdr) {
                const pct = userCommissionMap[owners.sdr]?.pctSdr || 0;
                comissaoSdrTotal += saleCaixa * pct / 100;
            }
        }

        // Per-person detail
        for (const [name, stats] of Object.entries(closerStats)) {
            const uid = Object.keys(usersMap).find(k => usersMap[parseInt(k)] === name);
            const pct = uid ? (userCommissionMap[parseInt(uid)]?.pctCloser || 0) : 0;
            comissaoCloserDetalhes.push({ nome: name, caixa: stats.caixa, pct, comissao: stats.caixa * pct / 100 });
        }
        for (const [name, stats] of Object.entries(sdrStats)) {
            const uid = Object.keys(usersMap).find(k => usersMap[parseInt(k)] === name);
            const pct = uid ? (userCommissionMap[parseInt(uid)]?.pctSdr || 0) : 0;
            comissaoSdrDetalhes.push({ nome: name, caixa: stats.caixa, pct, comissao: stats.caixa * pct / 100 });
        }

        const tmFaturamentoCloser = Object.entries(closerStats).map(([name, stats]) => ({ name, value: stats.count > 0 ? stats.faturamento / stats.count : 0 })).sort((a, b) => b.value - a.value);
        const tmCaixaCloser = Object.entries(closerStats).map(([name, stats]) => ({ name, value: stats.count > 0 ? stats.caixa / stats.count : 0 })).sort((a, b) => b.value - a.value);
        const tmFaturamentoSdr = Object.entries(sdrStats).map(([name, stats]) => ({ name, value: stats.count > 0 ? stats.faturamento / stats.count : 0 })).sort((a, b) => b.value - a.value);
        const tmCaixaSdr = Object.entries(sdrStats).map(([name, stats]) => ({ name, value: stats.count > 0 ? stats.caixa / stats.count : 0 })).sort((a, b) => b.value - a.value);

        // Funnel data — lead counts by Kanban stage (all time for the project)
        const funnelStages = ['Novo', 'Follow-up', 'Agendado', 'Negociação', 'Venda', 'Reembolsado', 'Loss'];
        let allLeadsQuery = supabase.from('leads').select('status_atual, motivo_reembolso');
        if (projectId) allLeadsQuery = (allLeadsQuery as any).eq('id_projeto', projectId);
        const { data: allLeads } = await allLeadsQuery;
        const funnelData = funnelStages.map(stage => ({
            name: stage,
            value: (allLeads || []).filter((l: any) => l.status_atual === stage || (stage === 'Loss' && l.status_atual === 'Nao prosseguiu')).length
        })).filter(s => s.value > 0);

        // Chargeback stats
        const reembolsados = (allLeads || []).filter((l: any) => l.status_atual === 'Reembolsado');
        const chargebackRate = (groupedSales.length + reembolsados.length) > 0
            ? ((reembolsados.length / (groupedSales.length + reembolsados.length)) * 100).toFixed(1)
            : '0.0';
        const recentRefundReasons = reembolsados
            .filter((l: any) => l.motivo_reembolso)
            .slice(0, 5)
            .map((l: any) => l.motivo_reembolso);

        // ─── Status dos Leads no PERÍODO (filtrado por data_entrada) ────────────
        const kanbanStatuses = ['Novo', 'Follow-up', 'Remarcado', 'No-show', 'Venda', 'Reembolsado', 'Loss'];
        let periodLeadsQuery = supabase
            .from('leads')
            .select('status_atual')
            .gte('data_entrada', `${startDate}T03:00:00.000Z`)
            .lt('data_entrada', endFilter);
        if (projectId) periodLeadsQuery = (periodLeadsQuery as any).eq('id_projeto', projectId);
        const { data: periodLeads } = await periodLeadsQuery;

        const statusCounts: Record<string, number> = {};
        for (const l of (periodLeads || [])) {
            const s = l.status_atual === 'Nao prosseguiu' ? 'Loss' : l.status_atual;
            if (kanbanStatuses.includes(s)) statusCounts[s] = (statusCounts[s] || 0) + 1;
        }
        const totalLeadsStatus = Object.values(statusCounts).reduce((a, b) => a + b, 0);
        const statusLeads = kanbanStatuses
            .filter(s => statusCounts[s] > 0)
            .map(s => ({ status: s, count: statusCounts[s], pct: totalLeadsStatus > 0 ? parseFloat(((statusCounts[s] / totalLeadsStatus) * 100).toFixed(1)) : 0 }))
            .sort((a, b) => b.count - a.count);

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
            funnelData,
            chargebackRate,
            recentRefundReasons,
            comissaoCloserTotal,
            comissaoSdrTotal,
            comissaoCloserDetalhes,
            comissaoSdrDetalhes,
            statusLeads,
            period: { startDate, endDate }
        });
    } catch (error: any) {
        console.error('Metrics error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
