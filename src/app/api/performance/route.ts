import { NextResponse } from 'next/server';
import supabase from '@/lib/db';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const nowLocal = new Date();
        nowLocal.setMinutes(nowLocal.getMinutes() - nowLocal.getTimezoneOffset());
        const todayStr = nowLocal.toISOString().split('T')[0];

        const startDate = searchParams.get('startDate') || searchParams.get('date') || todayStr;
        const endDate = searchParams.get('endDate') || searchParams.get('date') || todayStr;
        const projectId = searchParams.get('projectId');

        // Fetch active users
        let usersQuery = supabase.from('usuarios').select('id_usuario, nome, tipo').eq('ativo', true).in('tipo', ['SDR', 'CLOSER']);
        if (projectId) usersQuery = usersQuery.eq('id_projeto', projectId);
        const { data: users } = await usersQuery;

        const performanceSDR: Record<number, any> = {};
        const performanceCloser: Record<number, any> = {};

        (users || []).forEach((u: any) => {
            if (u.tipo === 'SDR') {
                performanceSDR[u.id_usuario] = { id: u.id_usuario, nome: u.nome, conversasIniciadas: 0, primeiraResposta: 0, convitesEnviados: 0, callMarcada: 0, leadsQualificados: 0, agendamentosHoje: 0, isManual: false };
            } else {
                performanceCloser[u.id_usuario] = { id: u.id_usuario, nome: u.nome, callsAgendadas: 0, reagendamentos: 0, noShows: 0, totalCalls: 0, vendas: 0, vgv: 0, caixa: 0, isManual: false };
            }
        });

        // Leads created on this date
        let leadsQuery = supabase.from('leads').select('id_lead, id_sdr_responsavel, id_closer_responsavel, status_atual')
            .gte('data_entrada', `${startDate}T00:00:00`).lte('data_entrada', `${endDate}T23:59:59`);
        if (projectId) leadsQuery = leadsQuery.eq('id_projeto', projectId);
        const { data: leads } = await leadsQuery;

        (leads || []).forEach((l: any) => {
            const sdrId = l.id_sdr_responsavel;
            if (sdrId && performanceSDR[sdrId]) {
                performanceSDR[sdrId].conversasIniciadas += 1;
                if (l.status_atual !== 'Novo') performanceSDR[sdrId].primeiraResposta += 1;
                if (l.status_atual === 'Follow-up' || l.status_atual === 'Remarcado') performanceSDR[sdrId].convitesEnviados += 1;
                if (l.id_closer_responsavel) performanceSDR[sdrId].leadsQualificados += 1;
            }
            const closerId = l.id_closer_responsavel;
            if (closerId && performanceCloser[closerId]) {
                performanceCloser[closerId].totalCalls += 1;
                performanceCloser[closerId].callsAgendadas += 1;
            }
        });

        // Sales for closers in the selected period — query vendas by data_venda directly
        let vendasQuery = supabase
            .from('vendas')
            .select('id_lead, id_closer, valor_bruto, valor_liquido_caixa, id_oportunidade, forma_pagamento')
            .in('status_pagamento', ['pago', 'pendente'])
            .gte('data_venda', `${startDate}T00:00:00`)
            .lte('data_venda', `${endDate}T23:59:59`);

        const { data: vendasPeriod } = await vendasQuery;

        // Group by oportunidade to avoid double-counting entrada+parcelas rows as 2 sales
        const seenOport = new Set<number>();
        (vendasPeriod || []).forEach((v: any) => {
            const oportKey = v.id_oportunidade ?? v.id_lead;
            const closerId = v.id_closer;
            if (!closerId || !performanceCloser[closerId]) return;

            // Count each distinct sale once
            const saleKey = `${oportKey}-${closerId}`;
            if (!seenOport.has(saleKey as any)) {
                seenOport.add(saleKey as any);
                performanceCloser[closerId].vendas += 1;
            }

            performanceCloser[closerId].vgv += parseFloat(v.valor_bruto) || 0;
            performanceCloser[closerId].caixa += parseFloat(v.valor_liquido_caixa || v.valor_bruto) || 0;
        });

        // SDR vgv/caixa — fetch sales for leads where the SDR is responsible
        // We join via id_lead: get all leads whose SDR is known, then match with vendas
        let vendasSdrQuery = supabase
            .from('vendas')
            .select('id_lead, valor_bruto, valor_liquido_caixa')
            .in('status_pagamento', ['pago', 'pendente'])
            .gte('data_venda', `${startDate}T00:00:00`)
            .lte('data_venda', `${endDate}T23:59:59`);
        const { data: vendasSdr } = await vendasSdrQuery;

        // Build a map of lead_id -> sdr_id from the leads fetched earlier
        const leadToSdr: Record<number, number> = {};
        (leads || []).forEach((l: any) => {
            if (l.id_lead && l.id_sdr_responsavel) leadToSdr[l.id_lead] = l.id_sdr_responsavel;
        });

        // Also fetch ALL leads for this project to cover sales outside the start/end window
        let allLeadsQuery = supabase.from('leads').select('id_lead, id_sdr_responsavel, status_atual');
        if (projectId) allLeadsQuery = allLeadsQuery.eq('id_projeto', projectId);
        const { data: allLeads } = await allLeadsQuery;
        (allLeads || []).forEach((l: any) => {
            if (l.id_lead && l.id_sdr_responsavel) leadToSdr[l.id_lead] = l.id_sdr_responsavel;
        });

        (vendasSdr || []).forEach((v: any) => {
            const sdrId = leadToSdr[v.id_lead];
            if (sdrId && performanceSDR[sdrId]) {
                performanceSDR[sdrId].vgv = (performanceSDR[sdrId].vgv || 0) + (parseFloat(v.valor_bruto) || 0);
                performanceSDR[sdrId].caixa = (performanceSDR[sdrId].caixa || 0) + (parseFloat(v.valor_liquido_caixa || v.valor_bruto) || 0);
            }
        });

        // SDR vendas count — leads in period with status 'Venda'
        (leads || []).forEach((l: any) => {
            const sdrId = l.id_sdr_responsavel;
            if (sdrId && performanceSDR[sdrId] && l.status_atual === 'Venda') {
                performanceSDR[sdrId].vendasFechadas = (performanceSDR[sdrId].vendasFechadas || 0) + 1;
            }
        });

        // Reembolsos per user (all-time for conversation rate context)
        let reembolsadosQuery = supabase.from('leads').select('id_sdr_responsavel, id_closer_responsavel').eq('status_atual', 'Reembolsado');
        if (projectId) reembolsadosQuery = reembolsadosQuery.eq('id_projeto', projectId);
        const { data: reembolsados } = await reembolsadosQuery;
        (reembolsados || []).forEach((l: any) => {
            if (l.id_sdr_responsavel && performanceSDR[l.id_sdr_responsavel]) {
                performanceSDR[l.id_sdr_responsavel].reembolsos = (performanceSDR[l.id_sdr_responsavel].reembolsos || 0) + 1;
            }
            if (l.id_closer_responsavel && performanceCloser[l.id_closer_responsavel]) {
                performanceCloser[l.id_closer_responsavel].reembolsos = (performanceCloser[l.id_closer_responsavel].reembolsos || 0) + 1;
            }
        });

        // Manual overrides
        const { data: overrides } = await supabase.from('metricas_performance')
            .select('*').gte('data_referencia', startDate).lte('data_referencia', endDate);

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
