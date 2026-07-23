import { NextResponse } from 'next/server';
import supabase from '@/lib/db';

import { baseGateway, caixaInPeriod } from '@/lib/financial';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        // Use Brazil local date (UTC-3) for "today" default
        const nowBR = new Date(Date.now() - 3 * 60 * 60 * 1000);
        const firstDay = new Date(nowBR.getUTCFullYear(), nowBR.getUTCMonth(), 1).toISOString().split('T')[0];
        const lastDay  = new Date(nowBR.getUTCFullYear(), nowBR.getUTCMonth() + 1, 0).toISOString().split('T')[0];

        const startDate = searchParams.get('startDate') || firstDay;
        const endDate   = searchParams.get('endDate')   || lastDay;
        const projectId = searchParams.get('projectId');

        // endFilter for leads & sales queries (BRT-aware midnight)
        const endDatePlusOne = new Date(`${endDate}T03:00:00.000Z`);
        endDatePlusOne.setUTCDate(endDatePlusOne.getUTCDate() + 1);
        const endFilter = endDatePlusOne.toISOString();
        const startVendaFilter = `${startDate}T03:00:00.000Z`;

        // ─── 1. FETCH SALES (FATURAMENTO) ─────────────────────────────────────────
        // Receita Bruta = sales originated in the period (pago + pendente) based on data_venda.
        const { data: vendasFat } = await supabase
            .from('vendas')
            .select('id_venda, id_oportunidade, valor_bruto, data_venda, id_lead, forma_pagamento, status_pagamento')
            .in('status_pagamento', ['pago', 'pendente'])
            .gte('data_venda', startVendaFilter)
            .lt('data_venda', endFilter);

        
        const startDateObj = new Date(`${startDate}T00:00:00Z`);
        startDateObj.setFullYear(startDateObj.getFullYear() - 2); // 24 months back
        const caixaStartBoundary = startDateObj.toISOString().split('T')[0];

        // ─── 2. FETCH CASH (CAIXA LÍQUIDO) ────────────────────────────────────────
        // Caixa Líquido = payments received in the period (pago only) based on data_recebimento.
        // NOTE: We run TWO queries and merge because SQL NULL comparisons always return false,
        // so .lte('data_recebimento', endDate) silently drops rows where data_recebimento IS NULL.
        // For those rows, caixaInPeriod falls back to data_venda — so we fetch them separately.
        const CAIXA_SELECT_M = 'id_venda, id_oportunidade, id_closer, valor_bruto, valor_liquido_caixa, numero_parcelas, data_venda, data_recebimento, forma_pagamento, id_lead';

        const [{ data: caixaWithDate }, { data: caixaNoDate }] = await Promise.all([
            supabase
                .from('vendas')
                .select(CAIXA_SELECT_M)
                .eq('status_pagamento', 'pago')
                .gte('data_recebimento', caixaStartBoundary)
                .lte('data_recebimento', endDate),
            supabase
                .from('vendas')
                .select(CAIXA_SELECT_M)
                .eq('status_pagamento', 'pago')
                .is('data_recebimento', null)
                .gte('data_venda', startVendaFilter)
                .lt('data_venda', endFilter),
        ]);
        const vendasCaixa = [...(caixaWithDate || []), ...(caixaNoDate || [])];

        // ─── Filter by project ────────────────────────────────────────────────────
        let validLeadIds: Set<number> | null = null;
        if (projectId) {
            const { data: projLeads } = await supabase.from('leads').select('id_lead').eq('id_projeto', projectId).not('status_atual', 'in', '("Reembolsado","Loss")');
            validLeadIds = new Set((projLeads || []).map((l: any) => l.id_lead));
        } else {
            const { data: projLeads } = await supabase.from('leads').select('id_lead').not('status_atual', 'in', '("Reembolsado","Loss")');
            validLeadIds = new Set((projLeads || []).map((l: any) => l.id_lead));
        }

        const filteredFat = (vendasFat || []).filter((v: any) => validLeadIds!.has(v.id_lead));
        const filteredCaixa = (vendasCaixa || []).filter((v: any) => validLeadIds!.has(v.id_lead));

        // ─── GROUP Faturamento by id_oportunidade ─────────────────────────────────
        const mapFat: Record<number, { id_lead: number; valor_bruto: number }> = {};
        for (const v of filteredFat) {
            const oportId = v.id_oportunidade ?? v.id_lead;
            if (!mapFat[oportId]) mapFat[oportId] = { id_lead: v.id_lead, valor_bruto: 0 };
            mapFat[oportId].valor_bruto += parseFloat(v.valor_bruto) || 0;
        }
        const groupedSalesFat = Object.values(mapFat);

        // ─── GROUP Caixa by id_oportunidade ───────────────────────────────────────
        const mapCaixa: Record<number, { id_lead: number; id_closer: number | null; rows: any[] }> = {};
        for (const v of filteredCaixa) {
            const oportId = v.id_oportunidade ?? v.id_lead;
            if (!mapCaixa[oportId]) mapCaixa[oportId] = { id_lead: v.id_lead, id_closer: v.id_closer ?? null, rows: [] };
            mapCaixa[oportId].rows.push(v);
        }
        const groupedSalesCaixa = Object.values(mapCaixa);

        // ─── Receita (Faturamento Global) ─────────────────────────────────────────
        const receita = groupedSalesFat.reduce((sum, s) => sum + s.valor_bruto, 0);
        const vendasTotais = groupedSalesFat.length;

        // ─── Pagamentos Pendentes ──────────────────────────────────────────────────
        // Sum of valor_bruto for pendente rows, deduplicated by id_oportunidade so
        // split payments (Entrada + Parcelas) aren't double-counted.
        const mapPendentes: Record<number, number> = {};
        for (const v of filteredFat) {
            if (v.status_pagamento !== 'pendente') continue;
            const oportId = v.id_oportunidade ?? v.id_lead;
            mapPendentes[oportId] = (mapPendentes[oportId] || 0) + (parseFloat(v.valor_bruto) || 0);
        }
        const pagamentosPendentes = Object.values(mapPendentes).reduce((sum, v) => sum + v, 0);
        // Note: pendentesPorCloser is computed AFTER leadOwnerMap is built below.

        // ─── Caixa Líquido Global ─────────────────────────────────────────────────
        let caixaLiquido = 0;
        for (const sale of groupedSalesCaixa) {
            for (const v of sale.rows) {
                caixaLiquido += caixaInPeriod(v, startDate, endDate);
            }
        }

        // ─── Leads count ──────────────────────────────────────────────────────────
        // No-show excluído: closer não teve chance de converter, não deve penalizar a taxa
        let leadsQuery = supabase.from('leads').select('id_lead')
            .gte('data_entrada', startVendaFilter)
            .lt('data_entrada', endFilter)
            .eq('off_metricas', false)
            .neq('status_atual', 'No-show');
        if (projectId) leadsQuery = leadsQuery.eq('id_projeto', projectId);
        const { data: leadsData } = await leadsQuery;
        const leadsTotais = leadsData?.length || 0;
        const conversaoAproximada = leadsTotais > 0 ? ((vendasTotais / leadsTotais) * 100).toFixed(1) : '0.0';

        // ─── Ticket Médio (Global based on Faturamento) ───────────────────────────
        const ticketMedio = vendasTotais > 0 ? receita / vendasTotais : 0;

        // ─── Receita por Forma de Pagamento (Faturamento) ───────────────────
        const byPaymentFat: Record<string, number> = {};
        for (const v of filteredFat) {
            const gw = baseGateway(v.forma_pagamento);
            byPaymentFat[gw] = (byPaymentFat[gw] || 0) + (parseFloat(v.valor_bruto) || 0);
        }
        const receitaPorPagamentoFaturamento = Object.entries(byPaymentFat).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

        // ─── Receita por Forma de Pagamento (Caixa no período) ───────────────────
        const byPaymentCaixa: Record<string, number> = {};
        for (const sale of groupedSalesCaixa) {
            for (const v of sale.rows) {
                const gw = baseGateway(v.forma_pagamento);
                const cx = caixaInPeriod(v, startDate, endDate);
                if (cx > 0) byPaymentCaixa[gw] = (byPaymentCaixa[gw] || 0) + cx;
            }
        }
        const receitaPorPagamentoCaixa = Object.entries(byPaymentCaixa).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

        // ─── User map: names + commission % ──────────────────────────────────────
        const { data: usersData } = await supabase
            .from('usuarios')
            .select('id_usuario, nome, percentual_comissao_closer, percentual_comissao_sdr')
            .in('tipo', ['SDR', 'CLOSER', 'ADMIN']);
        const usersMap: Record<number, string> = {};
        const userCommissionMap: Record<number, { pctCloser: number; pctSdr: number }> = {};
        (usersData || []).forEach((u: any) => {
            usersMap[u.id_usuario] = u.nome;
            userCommissionMap[u.id_usuario] = {
                pctCloser: parseFloat(u.percentual_comissao_closer) || 0,
                pctSdr: parseFloat(u.percentual_comissao_sdr) || 0,
            };
        });

        // ─── Lead → owner map ─────────────────────────────────────────────────────
        const { data: leadsInfoData } = await supabase
            .from('leads')
            .select('id_lead, id_sdr_responsavel, id_closer_responsavel')
            .in('id_lead', Array.from(validLeadIds!));
        const leadOwnerMap: Record<number, { sdr: number; closer: number }> = {};
        (leadsInfoData || []).forEach((l: any) => {
            leadOwnerMap[l.id_lead] = { sdr: l.id_sdr_responsavel, closer: l.id_closer_responsavel };
        });

        // ─── Per-person stats (separated logic) ──────────────────────────────────
        const byCloser: Record<string, number> = {};
        const bySdr: Record<string, number> = {};
        const closerStats: Record<string, { faturamento: number; caixa: number; count: number }> = {};
        const sdrStats: Record<string, { faturamento: number; caixa: number; count: number }> = {};

        // Faturamento (Receita Bruta e Vendas)
        for (const sale of groupedSalesFat) {
            const owners = leadOwnerMap[sale.id_lead];
            if (owners?.closer) {
                const cName = usersMap[owners.closer] || 'Desconhecido';
                byCloser[cName] = (byCloser[cName] || 0) + sale.valor_bruto;
                if (!closerStats[cName]) closerStats[cName] = { faturamento: 0, caixa: 0, count: 0 };
                closerStats[cName].faturamento += sale.valor_bruto;
                closerStats[cName].count += 1;
            }
            if (owners?.sdr) {
                const sName = usersMap[owners.sdr] || 'Desconhecido';
                bySdr[sName] = (bySdr[sName] || 0) + sale.valor_bruto;
                if (!sdrStats[sName]) sdrStats[sName] = { faturamento: 0, caixa: 0, count: 0 };
                sdrStats[sName].faturamento += sale.valor_bruto;
                sdrStats[sName].count += 1;
            }
        }

        // Caixa (Dinheiro Recebido)
        for (const sale of groupedSalesCaixa) {
            let saleCaixa = 0;
            for (const v of sale.rows) saleCaixa += caixaInPeriod(v, startDate, endDate);
            if (saleCaixa <= 0) continue;

            // Use id_closer from the SALE row (same logic as /api/performance)
            // This is the source of truth — avoids mismatch with leadOwnerMap
            const closerIdFromSale = sale.id_closer;
            if (closerIdFromSale) {
                const cName = usersMap[closerIdFromSale] || 'Desconhecido';
                if (!closerStats[cName]) closerStats[cName] = { faturamento: 0, caixa: 0, count: 0 };
                closerStats[cName].caixa += saleCaixa;
            }

            // SDR attribution still uses leadOwnerMap (no id_sdr on vendas table)
            const owners = leadOwnerMap[sale.id_lead];
            if (owners?.sdr) {
                const sName = usersMap[owners.sdr] || 'Desconhecido';
                if (!sdrStats[sName]) sdrStats[sName] = { faturamento: 0, caixa: 0, count: 0 };
                sdrStats[sName].caixa += saleCaixa;
            }
        }

        const receitaPorCloser = Object.entries(byCloser).map(([name, value]) => ({ name, value }));
        const receitaPorSdr    = Object.entries(bySdr).map(([name, value]) => ({ name, value }));

        // ─── Commissions (derived directly from closerStats/sdrStats — no re-calc) ─
        const comissaoCloserDetalhes = Object.entries(closerStats).map(([name, stats]) => {
            const uid = Object.keys(usersMap).find(k => usersMap[parseInt(k)] === name);
            const pct = uid ? (userCommissionMap[parseInt(uid)]?.pctCloser || 0) : 0;
            return { nome: name, caixa: stats.caixa, pct, comissao: parseFloat((stats.caixa * pct / 100).toFixed(2)) };
        });
        const comissaoSdrDetalhes = Object.entries(sdrStats).map(([name, stats]) => {
            const uid = Object.keys(usersMap).find(k => usersMap[parseInt(k)] === name);
            const pct = uid ? (userCommissionMap[parseInt(uid)]?.pctSdr || 0) : 0;
            return { nome: name, caixa: stats.caixa, pct, comissao: parseFloat((stats.caixa * pct / 100).toFixed(2)) };
        });
        const comissaoCloserTotal = comissaoCloserDetalhes.reduce((s, d) => s + d.comissao, 0);
        const comissaoSdrTotal    = comissaoSdrDetalhes.reduce((s, d) => s + d.comissao, 0);

        // ─── Pendentes por Closer ─────────────────────────────────────────────────────
        // Uses the same filteredFat rows (pendentes only) + leadOwnerMap to attribute
        // each pending payment to the closer responsible for that lead.
        // Deduplicates by id_oportunidade to avoid double-counting split rows.
        const pendOportSeen = new Set<number>();
        const pendByCloser: Record<string, number> = {};
        for (const v of filteredFat) {
            if (v.status_pagamento !== 'pendente') continue;
            const oportId = v.id_oportunidade ?? v.id_lead;
            if (pendOportSeen.has(oportId)) continue;
            pendOportSeen.add(oportId);
            const owners = leadOwnerMap[v.id_lead];
            if (owners?.closer) {
                const cName = usersMap[owners.closer] || 'Desconhecido';
                pendByCloser[cName] = (pendByCloser[cName] || 0) + (parseFloat(v.valor_bruto) || 0);
            }
        }
        const pendentesPorCloser = Object.entries(pendByCloser)
            .map(([nome, valor]) => ({ nome, valor }))
            .sort((a, b) => b.valor - a.valor);

        // ─── Ticket Médio donuts ──────────────────────────────────────────────────
        const tmFaturamentoCloser = Object.entries(closerStats).map(([name, s]) => ({ name, value: s.count > 0 ? s.faturamento / s.count : 0 })).sort((a, b) => b.value - a.value);
        const tmCaixaCloser       = Object.entries(closerStats).map(([name, s]) => ({ name, value: s.count > 0 ? s.caixa / s.count : 0 })).sort((a, b) => b.value - a.value);
        const tmFaturamentoSdr    = Object.entries(sdrStats).map(([name, s]) => ({ name, value: s.count > 0 ? s.faturamento / s.count : 0 })).sort((a, b) => b.value - a.value);
        const tmCaixaSdr          = Object.entries(sdrStats).map(([name, s]) => ({ name, value: s.count > 0 ? s.caixa / s.count : 0 })).sort((a, b) => b.value - a.value);

        // ─── Funnel & Chargeback (filtered by period via data_entrada) ───────────
        const funnelStages = ['Novo', 'Follow-up', 'Agendado', 'Negociação', 'Venda', 'Reembolsado', 'Loss'];
        let periodFunnelQuery = supabase
            .from('leads')
            .select('status_atual, motivo_reembolso')
            .gte('data_entrada', startVendaFilter)
            .lt('data_entrada', endFilter)
            .eq('off_metricas', false);
        if (projectId) periodFunnelQuery = (periodFunnelQuery as any).eq('id_projeto', projectId);
        const { data: allLeads } = await periodFunnelQuery;
        const funnelData = funnelStages.map(stage => ({
            name: stage,
            value: (allLeads || []).filter((l: any) => l.status_atual === stage || (stage === 'Loss' && l.status_atual === 'Nao prosseguiu')).length
        })).filter(s => s.value > 0);

        // ─── Chargeback (same period cohort) ──────────────────────────────────────
        const reembolsados = (allLeads || []).filter((l: any) => l.status_atual === 'Reembolsado');
        const chargebackRate = (groupedSalesFat.length + reembolsados.length) > 0
            ? ((reembolsados.length / (groupedSalesFat.length + reembolsados.length)) * 100).toFixed(1)
            : '0.0';
        const recentRefundReasons = reembolsados.filter((l: any) => l.motivo_reembolso).slice(0, 5).map((l: any) => l.motivo_reembolso);

        // ─── Status dos Leads no período ─────────────────────────────────────────
        const kanbanStatuses = ['Novo', 'Follow-up', 'Remarcado', 'No-show', 'Venda', 'Reembolsado', 'Loss'];
        let periodLeadsQuery = supabase.from('leads').select('status_atual')
            .gte('data_entrada', `${startDate}T03:00:00.000Z`)
            .lt('data_entrada', endFilter)
            .eq('off_metricas', false);
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
            receitaPorPagamentoFaturamento,
            receitaPorPagamentoCaixa,
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
            pagamentosPendentes,
            pendentesPorCloser,
            period: { startDate, endDate }
        });
    } catch (error: any) {
        console.error('Metrics error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
