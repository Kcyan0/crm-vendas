import { NextResponse } from 'next/server';
import supabase from '@/lib/db';
import { caixaInPeriod } from '@/lib/financial';
import { todayBrasilia } from '@/lib/brasilia';
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
        const todayStr = todayBrasilia();

        const startDate = searchParams.get('startDate') || searchParams.get('date') || todayStr;
        const endDate = searchParams.get('endDate') || searchParams.get('date') || todayStr;
        const projectId = searchParams.get('projectId');

        // Leads no período: data da call; sem call, data de entrada (hora de Brasília como foi digitada)
        const leadNoPeriodo = filtroCallOuEntrada(startDate, endDate, { gte: `${startDate}T00:00:00`, lte: `${endDate}T23:59:59` });

        // Caixa: pagamentos dos últimos 2 anos, para pegar parcelas que caem neste período
        const caixaStartObj = new Date(`${startDate}T00:00:00Z`);
        caixaStartObj.setFullYear(caixaStartObj.getFullYear() - 2);
        const caixaStartBoundary = caixaStartObj.toISOString().split('T')[0];
        const CAIXA_SELECT = 'id_lead, id_closer, id_oportunidade, valor_bruto, valor_liquido_caixa, numero_parcelas, data_recebimento, data_venda';

        // Active users
        let usersQuery = supabase.from('usuarios').select('id_usuario, nome, tipo').eq('ativo', true).in('tipo', ['SDR', 'CLOSER']);
        if (projectId) usersQuery = usersQuery.eq('id_projeto', projectId);

        // No-show excluído — closer não teve chance de converter
        let leadsQuery = supabase.from('leads').select('id_lead, id_sdr_responsavel, id_closer_responsavel, status_atual')
            .or(leadNoPeriodo)
            .eq('off_metricas', false)
            .neq('status_atual', 'No-show');
        if (projectId) leadsQuery = leadsQuery.eq('id_projeto', projectId);

        // Sales in the selected period (pago + pendente); o VGV soma só as pagas
        const vendasQuery = supabase
            .from('vendas')
            .select('id_lead, id_closer, valor_bruto, valor_liquido_caixa, id_oportunidade, forma_pagamento, status_pagamento')
            .in('status_pagamento', ['pago', 'pendente'])
            .gte('data_venda', `${startDate}T00:00:00`)
            .lte('data_venda', `${endDate}T23:59:59`);

        // ALL leads of the project, to cover sales outside the start/end window for SDR attribution & filtering
        let allLeadsQuery = supabase.from('leads').select('id_lead, id_sdr_responsavel, id_closer_responsavel, status_atual');
        if (projectId) allLeadsQuery = allLeadsQuery.eq('id_projeto', projectId);

        // Caixa — two queries because .lte('data_recebimento', endDate) drops rows where data_recebimento IS NULL;
        // for those rows caixaInPeriod falls back to data_venda.
        const caixaQueryA = supabase
            .from('vendas')
            .select(CAIXA_SELECT)
            .eq('status_pagamento', 'pago')
            .gte('data_recebimento', caixaStartBoundary)
            .lte('data_recebimento', endDate);
        const caixaQueryB = supabase
            .from('vendas')
            .select(CAIXA_SELECT)
            .eq('status_pagamento', 'pago')
            .is('data_recebimento', null)
            .gte('data_venda', `${startDate}T00:00:00`)
            .lte('data_venda', `${endDate}T23:59:59`);

        // Reembolsos per user — leads no período (mesmo critério dos leads acima)
        let reembolsadosQuery = supabase
            .from('leads')
            .select('id_lead, id_sdr_responsavel, id_closer_responsavel')
            .eq('status_atual', 'Reembolsado')
            .eq('off_metricas', false) // mesma base dos leads da tabela, para a taxa sobre leads
            .or(leadNoPeriodo);
        if (projectId) reembolsadosQuery = reembolsadosQuery.eq('id_projeto', projectId);

        // Todas as consultas são independentes e saem juntas (antes eram ~8 idas ao banco, uma depois da outra).
        // Cada fetchAll tem .order estável para a paginação de 1000 em 1000 não repetir nem pular linhas.
        const [users, leads, vendasPeriod, allLeads, caixaWithDate, caixaNoDate, reembolsados, overridesRes] = await Promise.all([
            fetchAll(usersQuery.order('id_usuario', { ascending: true })),
            fetchAll(leadsQuery.order('id_lead', { ascending: true })),
            fetchAll(vendasQuery.order('id_venda', { ascending: true })),
            fetchAll(allLeadsQuery.order('id_lead', { ascending: true })),
            fetchAll(caixaQueryA.order('id_venda', { ascending: true })),
            fetchAll(caixaQueryB.order('id_venda', { ascending: true })),
            fetchAll(reembolsadosQuery.order('id_lead', { ascending: true })),
            // Manual overrides
            supabase.from('metricas_performance').select('*').gte('data_referencia', startDate).lte('data_referencia', endDate),
        ]);

        const performanceSDR: Record<number, any> = {};
        const performanceCloser: Record<number, any> = {};

        (users || []).forEach((u: any) => {
            if (u.tipo === 'SDR') {
                performanceSDR[u.id_usuario] = { id: u.id_usuario, nome: u.nome, conversasIniciadas: 0, primeiraResposta: 0, convitesEnviados: 0, callMarcada: 0, leadsQualificados: 0, agendamentosHoje: 0, isManual: false };
            } else {
                performanceCloser[u.id_usuario] = { id: u.id_usuario, nome: u.nome, callsAgendadas: 0, reagendamentos: 0, noShows: 0, totalCalls: 0, vendas: 0, vgv: 0, caixa: 0, isManual: false };
            }
        });

        (leads || []).forEach((l: any) => {
            const sdrId = l.id_sdr_responsavel;
            if (sdrId && performanceSDR[sdrId]) {
                performanceSDR[sdrId].conversasIniciadas += 1;
                if (l.status_atual !== 'Novo') performanceSDR[sdrId].primeiraResposta += 1;
                if (l.status_atual === 'Follow-up' || l.status_atual === 'Remarcado') performanceSDR[sdrId].convitesEnviados += 1;
                if (l.id_closer_responsavel) performanceSDR[sdrId].leadsQualificados += 1;
                // Count vendas from period leads (same cohort as Leads column)
                if (l.status_atual === 'Venda') {
                    performanceSDR[sdrId].vendasFechadas = (performanceSDR[sdrId].vendasFechadas || 0) + 1;
                }
            }
            const closerId = l.id_closer_responsavel;
            if (closerId && performanceCloser[closerId]) {
                performanceCloser[closerId].totalCalls += 1;
                performanceCloser[closerId].callsAgendadas += 1;
                // Count vendas from period leads (same cohort as Leads column)
                if (l.status_atual === 'Venda') {
                    performanceCloser[closerId].vendas += 1;
                }
            }
        });

        const validLeadIds = new Set<number>();
        const leadToSdr: Record<number, number> = {};
        const leadToCloser: Record<number, number> = {};
        
        (allLeads || []).forEach((l: any) => {
            if (l.status_atual !== 'Reembolsado' && l.status_atual !== 'Loss') {
                validLeadIds.add(l.id_lead);
                if (l.id_sdr_responsavel) leadToSdr[l.id_lead] = l.id_sdr_responsavel;
                if (l.id_closer_responsavel) leadToCloser[l.id_lead] = l.id_closer_responsavel;
            }
        });

        // Accumulate VGV/Caixa per closer
        // VGV = faturamento: só pagamento Pago (o pendente entra quando for marcado como pago)
        (vendasPeriod || []).forEach((v: any) => {
            if (!validLeadIds.has(v.id_lead)) return; // Ignore refunded/lost sales
            if (v.status_pagamento !== 'pago') return;

            // Fallback ao closer do lead quando id_closer não está na venda
            const closerId = v.id_closer ?? leadToCloser[v.id_lead] ?? null;
            if (!closerId || !performanceCloser[closerId]) return;

            performanceCloser[closerId].vgv += parseFloat(v.valor_bruto) || 0;
            // CAIXA is computed separately below
        });


        // SDR vgv — mesmas vendas do período, só as pagas, creditadas ao SDR do lead
        (vendasPeriod || []).forEach((v: any) => {
            if (!validLeadIds.has(v.id_lead)) return; // Ignore refunded/lost sales
            if (v.status_pagamento !== 'pago') return; // VGV só pago

            const sdrId = leadToSdr[v.id_lead];
            if (sdrId && performanceSDR[sdrId]) {
                performanceSDR[sdrId].vgv = (performanceSDR[sdrId].vgv || 0) + (parseFloat(v.valor_bruto) || 0);
                // CAIXA is computed separately below
            }
        });




        // ─── CAIXA (installment-aware): pagamentos já buscados acima, com e sem data_recebimento ──
        const caixaPeriod = [...(caixaWithDate || []), ...(caixaNoDate || [])];

        // ─── Group by id_oportunidade (same deduplication as metrics API) ────────
        // Without this, a deal with "entrada + parcelas" rows would double-count
        const mapCaixaPerf: Record<number, { id_lead: number; id_closer: number; rows: any[] }> = {};
        (caixaPeriod || []).forEach((v: any) => {
            if (!validLeadIds.has(v.id_lead)) return;
            const oportId = v.id_oportunidade ?? v.id_lead;
            if (!mapCaixaPerf[oportId]) mapCaixaPerf[oportId] = { id_lead: v.id_lead, id_closer: v.id_closer, rows: [] };
            mapCaixaPerf[oportId].rows.push(v);
        });

        Object.values(mapCaixaPerf).forEach((deal) => {
            // Sum all installment rows for this opportunity in the period
            let cxVal = 0;
            for (const v of deal.rows) cxVal += caixaInPeriod(v, startDate, endDate);
            if (cxVal <= 0) return;

            // Credit closer — fallback to leadToCloser when id_closer is null on the venda
            const closerId = deal.id_closer ?? leadToCloser[deal.id_lead] ?? null;
            if (closerId && performanceCloser[closerId]) {
                performanceCloser[closerId].caixa += cxVal;
            }
            // Credit SDR (via lead attribution)
            const sdrId = leadToSdr[deal.id_lead];
            if (sdrId && performanceSDR[sdrId]) {
                performanceSDR[sdrId].caixa = (performanceSDR[sdrId].caixa || 0) + cxVal;
            }
        });


        // Reembolsos per user — leads no período (mesmo critério acima)
        (reembolsados || []).forEach((l: any) => {
            if (l.id_sdr_responsavel && performanceSDR[l.id_sdr_responsavel]) {
                performanceSDR[l.id_sdr_responsavel].reembolsos = (performanceSDR[l.id_sdr_responsavel].reembolsos || 0) + 1;
            }
            if (l.id_closer_responsavel && performanceCloser[l.id_closer_responsavel]) {
                performanceCloser[l.id_closer_responsavel].reembolsos = (performanceCloser[l.id_closer_responsavel].reembolsos || 0) + 1;
            }
        });

        // Manual overrides
        const overrides = overridesRes.data;

        (overrides || []).forEach((ov: any) => {
            const uid = ov.id_usuario;
            if (performanceSDR[uid]) {
                if (!performanceSDR[uid].isManual) {
                    performanceSDR[uid].conversasIniciadas = 0;
                    performanceSDR[uid].primeiraResposta = 0;
                    performanceSDR[uid].convitesEnviados = 0;
                    performanceSDR[uid].callMarcada = 0;
                    performanceSDR[uid].leadsQualificados = 0;
                    performanceSDR[uid].isManual = true;
                }
                performanceSDR[uid].conversasIniciadas += ov.sdr_conversas_iniciadas || 0;
                performanceSDR[uid].primeiraResposta += ov.sdr_primeira_resposta || 0;
                performanceSDR[uid].convitesEnviados += ov.sdr_convites_enviados || 0;
                performanceSDR[uid].callMarcada += ov.sdr_calls_marcadas || 0;
                performanceSDR[uid].leadsQualificados += ov.sdr_leads_qualificados || 0;
            }
            if (performanceCloser[uid]) {
                if (!performanceCloser[uid].isManual) {
                    performanceCloser[uid].callsAgendadas = 0;
                    performanceCloser[uid].reagendamentos = 0;
                    performanceCloser[uid].noShows = 0;
                    performanceCloser[uid].totalCalls = 0;
                    performanceCloser[uid].isManual = true;
                }
                performanceCloser[uid].callsAgendadas += ov.closer_calls_agendadas || 0;
                performanceCloser[uid].reagendamentos += ov.closer_reagendamentos || 0;
                performanceCloser[uid].noShows += ov.closer_no_shows || 0;
                performanceCloser[uid].totalCalls += ov.closer_total_calls || 0;
            }
        });

        return NextResponse.json({ sdr: Object.values(performanceSDR), closer: Object.values(performanceCloser), period: { startDate, endDate } });

    } catch (error: any) {
        console.error('Performance error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id_usuario, data_referencia, metrics, isSDR } = body;

        if (!id_usuario || !data_referencia || !metrics) return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });

        const upsertData: any = { id_usuario, data_referencia };
        if (isSDR) {
            Object.assign(upsertData, { sdr_conversas_iniciadas: metrics.conversasIniciadas || 0, sdr_primeira_resposta: metrics.primeiraResposta || 0, sdr_convites_enviados: metrics.convitesEnviados || 0, sdr_leads_qualificados: metrics.leadsQualificados || 0, sdr_calls_marcadas: metrics.callMarcada || 0 });
        } else {
            Object.assign(upsertData, { closer_total_calls: metrics.totalCalls || 0, closer_calls_agendadas: metrics.callsAgendadas || 0, closer_reagendamentos: metrics.reagendamentos || 0, closer_no_shows: metrics.noShows || 0 });
        }

        const { error } = await supabase.from('metricas_performance').upsert(upsertData, { onConflict: 'id_usuario,data_referencia' });
        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
