import { NextResponse } from 'next/server';
import supabase from '@/lib/db';

import { baseGateway, caixaInPeriod } from '@/lib/financial';
import { filtroCallOuEntrada } from '@/lib/periodoLead';

async function fetchAll(queryBuilder: any) {
    let allData: any[] = [];
    let from = 0;
    const step = 999;
    while (true) {
        const { data, error } = await queryBuilder.range(from, from + step);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length <= step) break;
        from += step + 1;
    }
    return allData;
}

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
        // Leads no período: pela data da call; sem call, pela data de entrada
        const leadNoPeriodo = filtroCallOuEntrada(startDate, endDate, { gte: startVendaFilter, lt: endFilter });

        const startDateObj = new Date(`${startDate}T00:00:00Z`);
        startDateObj.setFullYear(startDateObj.getFullYear() - 2); // 24 months back
        const caixaStartBoundary = startDateObj.toISOString().split('T')[0];

        const CAIXA_SELECT_M = 'id_venda, id_oportunidade, id_closer, valor_bruto, valor_liquido_caixa, numero_parcelas, data_venda, data_recebimento, forma_pagamento, id_lead';
        // Leads do projeto: vendas válidas, ticket (sem OFF) e dono de cada lead
        let leadsDoProjetoQuery = supabase.from('leads').select('id_lead, status_atual, off_metricas, id_sdr_responsavel, id_closer_responsavel');
        if (projectId) leadsDoProjetoQuery = leadsDoProjetoQuery.eq('id_projeto', projectId);
        // Leads no período (call; sem call, entrada), sem OFF: Leads Totais, funil, chargeback e status
        let leadsDoPeriodoQuery = supabase.from('leads').select('id_lead, nome, status_atual, motivo_reembolso').or(leadNoPeriodo).eq('off_metricas', false);
        if (projectId) leadsDoPeriodoQuery = leadsDoPeriodoQuery.eq('id_projeto', projectId);

        // Todas as consultas independentes saem juntas (antes eram ~10 idas ao banco, uma depois da outra).
        // Cada fetchAll tem .order estável para a paginação de 1000 em 1000 não repetir nem pular linhas.
        const [vendasFat, caixaWithDate, caixaNoDate, leadsDoProjeto, usersRes, leadsDoPeriodo] = await Promise.all([
            // ─── 1. FATURAMENTO: vendas do período (pago + pendente) pela data da venda
            fetchAll(
                supabase
                    .from('vendas')
                    .select('id_venda, id_oportunidade, valor_bruto, data_venda, id_lead, forma_pagamento, status_pagamento')
                    .in('status_pagamento', ['pago', 'pendente'])
                    .gte('data_venda', startVendaFilter)
                    .lt('data_venda', endFilter)
                    .order('id_venda', { ascending: true })
            ),
            // ─── 2. CAIXA LÍQUIDO: pagamentos recebidos no período (só pago) pela data de recebimento.
            // Duas consultas porque .lte('data_recebimento') descarta as linhas com data_recebimento NULL;
            // para essas, caixaInPeriod usa a data da venda.
            fetchAll(
                supabase
                    .from('vendas')
                    .select(CAIXA_SELECT_M)
                    .eq('status_pagamento', 'pago')
                    .gte('data_recebimento', caixaStartBoundary)
                    .lte('data_recebimento', endDate)
                    .order('id_venda', { ascending: true })
            ),
            fetchAll(
                supabase
                    .from('vendas')
                    .select(CAIXA_SELECT_M)
                    .eq('status_pagamento', 'pago')
                    .is('data_recebimento', null)
                    .gte('data_venda', startVendaFilter)
                    .lt('data_venda', endFilter)
                    .order('id_venda', { ascending: true })
            ),
            fetchAll(leadsDoProjetoQuery.order('id_lead', { ascending: true })),
            // ─── Usuários: nomes e % de comissão
            supabase
                .from('usuarios')
                .select('id_usuario, nome, percentual_comissao_closer, percentual_comissao_sdr')
                .in('tipo', ['SDR', 'CLOSER', 'ADMIN']),
            fetchAll(leadsDoPeriodoQuery.order('id_lead', { ascending: true })),
        ]);
        const vendasCaixa = [...(caixaWithDate || []), ...(caixaNoDate || [])];

        // ─── Filter by project (inclui off_metricas → caixa e faturamento completos) ──
        // Mesmo critério do antigo .not('status_atual', 'in', '("Reembolsado","Loss")'), que também deixava de fora status nulo
        const leadsValidos = (leadsDoProjeto || []).filter((l: any) =>
            l.status_atual != null && l.status_atual !== 'Reembolsado' && l.status_atual !== 'Loss');
        const validLeadIds = new Set<number>(leadsValidos.map((l: any) => l.id_lead));
        // ─── Filter sem off_metricas → usado APENAS para Ticket Médio ─────────────
        const validLeadIdsTicket = new Set<number>(leadsValidos.filter((l: any) => l.off_metricas === false).map((l: any) => l.id_lead));

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

        // ─── Faturamento — pago + pendente no período ─────────────────────────────
        const receita = groupedSalesFat.reduce((sum, s) => sum + s.valor_bruto, 0);
        const vendasTotais = groupedSalesFat.length;

        // ─── Pagamentos Pendentes (no período) ────────────────────────────────────
        // Soma os valores pendentes das vendas que ocorreram neste período.
        const mapPendentes: Record<number, number> = {};
        for (const v of filteredFat) {
            if (v.status_pagamento !== 'pendente') continue;
            const oportId = v.id_oportunidade ?? v.id_lead;
            mapPendentes[oportId] = (mapPendentes[oportId] || 0) + (parseFloat(v.valor_bruto) || 0);
        }
        const pagamentosPendentes = Object.values(mapPendentes).reduce((sum, v) => sum + v, 0);

        // ─── Vendas sem off_metricas → base para Ticket Médio ─────────────────────
        const mapFatTicket: Record<number, { valor_bruto: number }> = {};
        for (const v of (vendasFat || []).filter((v: any) => validLeadIdsTicket!.has(v.id_lead))) {
            if (v.status_pagamento !== 'pago') continue; // ticket médio só pago
            const oportId = v.id_oportunidade ?? v.id_lead;
            if (!mapFatTicket[oportId]) mapFatTicket[oportId] = { valor_bruto: 0 };
            mapFatTicket[oportId].valor_bruto += parseFloat(v.valor_bruto) || 0;
        }
        const groupedSalesFatTicket = Object.values(mapFatTicket);
        const receitaTicket = groupedSalesFatTicket.reduce((sum, s) => sum + s.valor_bruto, 0);
        const vendasTotaisTicket = groupedSalesFatTicket.length;
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
        // (mesmo critério do antigo .neq('status_atual', 'No-show'), que também deixava de fora status nulo)
        const leadsTotais = (leadsDoPeriodo || []).filter((l: any) => l.status_atual != null && l.status_atual !== 'No-show').length;
        const conversaoAproximada = leadsTotais > 0 ? ((vendasTotais / leadsTotais) * 100).toFixed(1) : '0.0';

        // ─── Ticket Médio (exclui off_metricas) ──────────────────────────────────
        const ticketMedio = vendasTotaisTicket > 0 ? receitaTicket / vendasTotaisTicket : 0;

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
        const usersData = usersRes.data;
        const usersMap: Record<number, string> = {};
        const userCommissionMap: Record<number, { pctCloser: number; pctSdr: number }> = {};
        (usersData || []).forEach((u: any) => {
            usersMap[u.id_usuario] = u.nome;
            userCommissionMap[u.id_usuario] = {
                pctCloser: parseFloat(u.percentual_comissao_closer) || 0,
                pctSdr: parseFloat(u.percentual_comissao_sdr) || 0,
            };
        });

        // ─── Lead → owner map (leads válidos do projeto, já buscados acima) ─────────
        const leadOwnerMap: Record<number, { sdr: number; closer: number }> = {};
        leadsValidos.forEach((l: any) => {
            leadOwnerMap[l.id_lead] = { sdr: l.id_sdr_responsavel, closer: l.id_closer_responsavel };
        });

        // ─── Per-person stats keyed by id_usuario (evita colisão de nomes iguais) ──
        const byCloser: Record<number, number> = {};
        const bySdr: Record<number, number> = {};
        const closerStats: Record<number, { faturamento: number; caixa: number; count: number }> = {};
        const sdrStats: Record<number, { faturamento: number; caixa: number; count: number }> = {};

        // Faturamento (Receita Bruta e Vendas)
        for (const sale of groupedSalesFat) {
            const owners = leadOwnerMap[sale.id_lead];
            if (owners?.closer) {
                const cId = owners.closer;
                byCloser[cId] = (byCloser[cId] || 0) + sale.valor_bruto;
                if (!closerStats[cId]) closerStats[cId] = { faturamento: 0, caixa: 0, count: 0 };
                closerStats[cId].faturamento += sale.valor_bruto;
                closerStats[cId].count += 1;
            }
            if (owners?.sdr) {
                const sId = owners.sdr;
                bySdr[sId] = (bySdr[sId] || 0) + sale.valor_bruto;
                if (!sdrStats[sId]) sdrStats[sId] = { faturamento: 0, caixa: 0, count: 0 };
                sdrStats[sId].faturamento += sale.valor_bruto;
                sdrStats[sId].count += 1;
            }
        }

        // Caixa (Dinheiro Recebido)
        for (const sale of groupedSalesCaixa) {
            const owners = leadOwnerMap[sale.id_lead];
            let saleCaixa = 0;
            for (const v of sale.rows) {
                const c = caixaInPeriod(v, startDate, endDate);
                saleCaixa += c;
            }
            if (saleCaixa <= 0) continue;

            // Closer: usa id_closer da venda (source of truth), com fallback ao leadOwnerMap
            // caso o campo não tenha sido preenchido em vendas antigas.
            const closerIdFromSale = sale.id_closer ?? owners?.closer ?? null;
            if (closerIdFromSale) {
                if (!closerStats[closerIdFromSale]) closerStats[closerIdFromSale] = { faturamento: 0, caixa: 0, count: 0 };
                closerStats[closerIdFromSale].caixa += saleCaixa;
            }

            // SDR: não tem id_sdr na tabela vendas, sempre usa leadOwnerMap
            if (owners?.sdr) {
                const sId = owners.sdr;
                if (!sdrStats[sId]) sdrStats[sId] = { faturamento: 0, caixa: 0, count: 0 };
                sdrStats[sId].caixa += saleCaixa;
            }
        }


        // Resolve IDs → nomes para os gráficos de receita por pessoa
        const receitaPorCloser = Object.entries(byCloser).map(([id, value]) => ({ name: usersMap[parseInt(id)] || 'Desconhecido', value }));
        const receitaPorSdr    = Object.entries(bySdr).map(([id, value]) => ({ name: usersMap[parseInt(id)] || 'Desconhecido', value }));

        // ─── Commissions — % buscado pelo id_usuario correto, sem ambiguidade ──────
        const comissaoCloserDetalhes = Object.entries(closerStats).map(([id, stats]) => {
            const uid = parseInt(id);
            const pct = userCommissionMap[uid]?.pctCloser || 0;
            const nome = usersMap[uid] || 'Desconhecido';
            return { nome, caixa: stats.caixa, pct, comissao: parseFloat((stats.caixa * pct / 100).toFixed(2)) };
        });
        const comissaoSdrDetalhes = Object.entries(sdrStats).map(([id, stats]) => {
            const uid = parseInt(id);
            const pct = userCommissionMap[uid]?.pctSdr || 0;
            const nome = usersMap[uid] || 'Desconhecido';
            return { nome, caixa: stats.caixa, pct, comissao: parseFloat((stats.caixa * pct / 100).toFixed(2)) };
        });
        const comissaoCloserTotal = comissaoCloserDetalhes.reduce((s, d) => s + d.comissao, 0);
        const comissaoSdrTotal    = comissaoSdrDetalhes.reduce((s, d) => s + d.comissao, 0);

        // ─── Pendentes por Closer ─────────────────────────────────────────────────────
        // Uses the same filteredFat rows (pendentes only) + leadOwnerMap to attribute
        // each pending payment to the closer responsible for that lead.
        // Deduplicates by id_oportunidade to avoid double-counting split rows.
        const pendOportSeen = new Set<number>();
        const pendByCloser: Record<number, number> = {};
        for (const v of filteredFat) {
            if (v.status_pagamento !== 'pendente') continue;
            const oportId = v.id_oportunidade ?? v.id_lead;
            if (pendOportSeen.has(oportId)) continue;
            pendOportSeen.add(oportId);
            const owners = leadOwnerMap[v.id_lead];
            if (owners?.closer) {
                const cId = owners.closer;
                pendByCloser[cId] = (pendByCloser[cId] || 0) + (parseFloat(v.valor_bruto) || 0);
            }
        }
        const pendentesPorCloser = Object.entries(pendByCloser)
            .map(([id, valor]) => ({ nome: usersMap[parseInt(id)] || 'Desconhecido', valor }))
            .sort((a, b) => b.valor - a.valor);

        // ─── Ticket Médio donuts ──────────────────────────────────────────────────
        const tmFaturamentoCloser = Object.entries(closerStats).map(([id, s]) => ({ name: usersMap[parseInt(id)] || 'Desconhecido', value: s.count > 0 ? s.faturamento / s.count : 0 })).sort((a, b) => b.value - a.value);
        const tmCaixaCloser       = Object.entries(closerStats).map(([id, s]) => ({ name: usersMap[parseInt(id)] || 'Desconhecido', value: s.count > 0 ? s.caixa / s.count : 0 })).sort((a, b) => b.value - a.value);
        const tmFaturamentoSdr    = Object.entries(sdrStats).map(([id, s]) => ({ name: usersMap[parseInt(id)] || 'Desconhecido', value: s.count > 0 ? s.faturamento / s.count : 0 })).sort((a, b) => b.value - a.value);
        const tmCaixaSdr          = Object.entries(sdrStats).map(([id, s]) => ({ name: usersMap[parseInt(id)] || 'Desconhecido', value: s.count > 0 ? s.caixa / s.count : 0 })).sort((a, b) => b.value - a.value);


        // ─── Funnel & Chargeback (leads no período: data da call, ou entrada sem call) ──
        const funnelStages = ['Novo', 'Follow-up', 'Agendado', 'Negociação', 'Venda', 'Reembolsado', 'Loss'];
        const allLeads = leadsDoPeriodo;
        const funnelData = funnelStages.map(stage => ({
            name: stage,
            value: (allLeads || []).filter((l: any) => l.status_atual === stage || (stage === 'Loss' && l.status_atual === 'Nao prosseguiu')).length
        })).filter(s => s.value > 0);

        // ─── Chargeback: reembolsados sobre os Leads Totais do período ───────────
        const reembolsados = (allLeads || []).filter((l: any) => l.status_atual === 'Reembolsado');
        const chargebackRate = leadsTotais > 0
            ? ((reembolsados.length / leadsTotais) * 100).toFixed(1)
            : '0.0';
        const recentRefundReasons = reembolsados.filter((l: any) => l.motivo_reembolso).slice(0, 5).map((l: any) => l.motivo_reembolso);

        // ─── Segunda leva, em paralelo: vendas dos reembolsados e produtos das vendas do período ──
        const reembolsadoLeadIds = reembolsados.map((l: any) => l.id_lead).filter(Boolean);
        const vendasIds = filteredFat.map((v: any) => v.id_venda).filter(Boolean);
        const [reembolsadasRes, vendaProdRes] = await Promise.all([
            reembolsadoLeadIds.length > 0
                ? supabase.from('vendas').select('id_venda, id_lead, valor_bruto, status_pagamento').in('id_lead', reembolsadoLeadIds)
                : Promise.resolve(null),
            vendasIds.length > 0
                ? Promise.resolve(supabase.from('venda_produtos').select('id_venda, id_produto, produtos(nome)').in('id_venda', vendasIds))
                    .catch((e) => { console.warn('Produto metrics error:', e); return null; })
                : Promise.resolve(null),
        ]);

        // ─── Valor Total Perdido por Reembolso (no período) ──────────────────────
        let valorPerdidoReembolso = 0;
        let detalhesReembolsos: { leadId: number; nome: string; valor: number; motivo: string }[] = [];

        if (reembolsadoLeadIds.length > 0) {
            const vendasReembolsadas = reembolsadasRes?.data;

            const valorPorLead: Record<number, number> = {};
            for (const vr of (vendasReembolsadas || [])) {
                valorPorLead[vr.id_lead] = (valorPorLead[vr.id_lead] || 0) + (parseFloat(vr.valor_bruto) || 0);
            }

            valorPerdidoReembolso = Object.values(valorPorLead).reduce((acc, curr) => acc + curr, 0);

            detalhesReembolsos = reembolsados.map((l: any) => ({
                leadId: l.id_lead,
                nome: l.nome || 'Lead Reembolsado',
                valor: valorPorLead[l.id_lead] || 0,
                motivo: l.motivo_reembolso || 'Sem motivo informado'
            })).sort((a, b) => b.valor - a.valor);
        }

        // ─── Status dos Leads no período ─────────────────────────────────────────
        const kanbanStatuses = ['Novo', 'Follow-up', 'Remarcado', 'No-show', 'Venda', 'Reembolsado', 'Loss'];
        const periodLeads = leadsDoPeriodo; // mesmos filtros: período, sem OFF, projeto

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

        // ─── Métricas por Produto ──────────────────────────────────────────────────
        let produtosMetrics: any[] = [];
        try {
            if (vendasIds.length > 0) {
                const vendaProdData = vendaProdRes?.data;
                const vendaPorId = new Map<number, any>(filteredFat.map((v: any) => [v.id_venda, v]));

                // Build product stats map
                const prodMap: Record<number, { nome: string; vendas: number; receita: number }> = {};
                for (const vp of (vendaProdData || [])) {
                    const pid = vp.id_produto;
                    const nomeProd = (vp as any).produtos?.nome || 'Desconhecido';
                    if (!prodMap[pid]) prodMap[pid] = { nome: nomeProd, vendas: 0, receita: 0 };
                    // Find the venda value
                    const vendaRow = vendaPorId.get(vp.id_venda);
                    if (vendaRow) prodMap[pid].receita += parseFloat(vendaRow.valor_bruto) || 0;
                    prodMap[pid].vendas += 1;
                }
                produtosMetrics = Object.values(prodMap)
                    .map(p => ({ ...p, ticketMedio: p.vendas > 0 ? p.receita / p.vendas : 0 }))
                    .sort((a, b) => b.receita - a.receita);
            }
        } catch (e) {
            console.warn('Produto metrics error:', e);
        }

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
            valorPerdidoReembolso,
            totalReembolsados: reembolsados.length,
            detalhesReembolsos,
            comissaoCloserTotal,
            comissaoSdrTotal,
            comissaoCloserDetalhes,
            comissaoSdrDetalhes,
            statusLeads,
            pagamentosPendentes,
            pendentesPorCloser,
            produtosMetrics,
            period: { startDate, endDate }
        });
    } catch (error: any) {
        console.error('Metrics error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
