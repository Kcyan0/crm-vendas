import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);

        // Use local-aware today
        const nowLocal = new Date();
        nowLocal.setMinutes(nowLocal.getMinutes() - nowLocal.getTimezoneOffset());
        const todayStr = nowLocal.toISOString().split('T')[0];

        const dateParam = searchParams.get('date') || todayStr;
        const projectId = searchParams.get('projectId');

        // Fetch all active users
        const users = await sql`SELECT id_usuario, nome, tipo FROM usuarios WHERE ativo = true AND tipo IN ('SDR', 'CLOSER')`;

        const performanceSDR: Record<number, any> = {};
        const performanceCloser: Record<number, any> = {};

        users.forEach((u: any) => {
            if (u.tipo === 'SDR') {
                performanceSDR[u.id_usuario] = { id: u.id_usuario, nome: u.nome, conversasIniciadas: 0, primeiraResposta: 0, convitesEnviados: 0, callMarcada: 0, leadsQualificados: 0, agendamentosHoje: 0, isManual: false };
            } else if (u.tipo === 'CLOSER') {
                performanceCloser[u.id_usuario] = { id: u.id_usuario, nome: u.nome, callsAgendadas: 0, reagendamentos: 0, noShows: 0, totalCalls: 0, vendas: 0, vgv: 0, caixa: 0, isManual: false };
            }
        });

        // SDR Automatic Metrics
        let leads;
        if (projectId) {
            leads = await sql`
                SELECT id_sdr_responsavel, status_atual FROM leads
                WHERE id_sdr_responsavel IS NOT NULL AND data_entrada::date = ${dateParam}::date AND id_projeto = ${projectId}
            `;
        } else {
            leads = await sql`
                SELECT id_sdr_responsavel, status_atual FROM leads
                WHERE id_sdr_responsavel IS NOT NULL AND data_entrada::date = ${dateParam}::date
            `;
        }

        leads.forEach((l: any) => {
            const sdrId = l.id_sdr_responsavel;
            if (performanceSDR[sdrId]) {
                performanceSDR[sdrId].conversasIniciadas += 1;
                if (l.status_atual !== 'Novo') performanceSDR[sdrId].primeiraResposta += 1;
                if (l.status_atual === 'Follow-up' || l.status_atual === 'Remarcado') performanceSDR[sdrId].convitesEnviados += 1;
            }
        });

        const sdrCalls = await sql`
            SELECT id_sdr, status_chamada, data_hora_inicio::date as call_date FROM chamadas
            WHERE id_sdr IS NOT NULL AND data_hora_inicio::date = ${dateParam}::date
        `;
        sdrCalls.forEach((c: any) => {
            if (performanceSDR[c.id_sdr]) {
                performanceSDR[c.id_sdr].callMarcada += 1;
                if (c.call_date === todayStr) performanceSDR[c.id_sdr].agendamentosHoje += 1;
            }
        });

        let qualifiedLeads;
        if (projectId) {
            qualifiedLeads = await sql`
                SELECT id_sdr_responsavel FROM leads
                WHERE id_sdr_responsavel IS NOT NULL AND id_closer_responsavel IS NOT NULL
                AND data_entrada::date = ${dateParam}::date AND id_projeto = ${projectId}
            `;
        } else {
            qualifiedLeads = await sql`
                SELECT id_sdr_responsavel FROM leads
                WHERE id_sdr_responsavel IS NOT NULL AND id_closer_responsavel IS NOT NULL
                AND data_entrada::date = ${dateParam}::date
            `;
        }
        qualifiedLeads.forEach((l: any) => {
            if (performanceSDR[l.id_sdr_responsavel]) {
                performanceSDR[l.id_sdr_responsavel].leadsQualificados += 1;
            }
        });

        // Closer Automatic Metrics
        let closerCalls;
        if (projectId) {
            closerCalls = await sql`
                SELECT id_closer_responsavel as id_closer FROM leads
                WHERE id_closer_responsavel IS NOT NULL AND data_entrada::date = ${dateParam}::date AND id_projeto = ${projectId}
            `;
        } else {
            closerCalls = await sql`
                SELECT id_closer_responsavel as id_closer FROM leads
                WHERE id_closer_responsavel IS NOT NULL AND data_entrada::date = ${dateParam}::date
            `;
        }
        closerCalls.forEach((c: any) => {
            if (performanceCloser[c.id_closer]) {
                performanceCloser[c.id_closer].totalCalls += 1;
                performanceCloser[c.id_closer].callsAgendadas += 1;
            }
        });

        let closerSales;
        if (projectId) {
            closerSales = await sql`
                SELECT v.id_closer, v.valor_bruto, v.valor_liquido_caixa FROM vendas v
                JOIN leads l ON v.id_lead = l.id_lead
                WHERE v.id_closer IS NOT NULL AND v.status_pagamento IN ('pago', 'pendente')
                AND l.status_atual NOT IN ('Reembolsado', 'Loss')
                AND l.data_entrada::date = ${dateParam}::date AND l.id_projeto = ${projectId}
            `;
        } else {
            closerSales = await sql`
                SELECT v.id_closer, v.valor_bruto, v.valor_liquido_caixa FROM vendas v
                JOIN leads l ON v.id_lead = l.id_lead
                WHERE v.id_closer IS NOT NULL AND v.status_pagamento IN ('pago', 'pendente')
                AND l.status_atual NOT IN ('Reembolsado', 'Loss')
                AND l.data_entrada::date = ${dateParam}::date
            `;
        }
        closerSales.forEach((v: any) => {
            if (performanceCloser[v.id_closer]) {
                performanceCloser[v.id_closer].vendas += 1;
                performanceCloser[v.id_closer].vgv += parseFloat(v.valor_bruto) || 0;
                performanceCloser[v.id_closer].caixa += parseFloat(v.valor_liquido_caixa || v.valor_bruto) || 0;
            }
        });

        // Manual Overrides
        const overrides = await sql`
            SELECT id_usuario,
                SUM(sdr_conversas_iniciadas) as sdr_conversas_iniciadas,
                SUM(sdr_primeira_resposta) as sdr_primeira_resposta,
                SUM(sdr_convites_enviados) as sdr_convites_enviados,
                SUM(sdr_leads_qualificados) as sdr_leads_qualificados,
                SUM(sdr_calls_marcadas) as sdr_calls_marcadas,
                SUM(closer_total_calls) as closer_total_calls,
                SUM(closer_calls_agendadas) as closer_calls_agendadas,
                SUM(closer_reagendamentos) as closer_reagendamentos,
                SUM(closer_no_shows) as closer_no_shows
            FROM metricas_performance
            WHERE data_referencia = ${dateParam}
            GROUP BY id_usuario
        `;

        overrides.forEach((ov: any) => {
            const uid = ov.id_usuario;
            if (performanceSDR[uid]) {
                performanceSDR[uid] = { ...performanceSDR[uid], conversasIniciadas: ov.sdr_conversas_iniciadas, primeiraResposta: ov.sdr_primeira_resposta, convitesEnviados: ov.sdr_convites_enviados, callMarcada: ov.sdr_calls_marcadas, leadsQualificados: ov.sdr_leads_qualificados, isManual: true };
            }
            if (performanceCloser[uid]) {
                performanceCloser[uid] = { ...performanceCloser[uid], callsAgendadas: ov.closer_calls_agendadas, reagendamentos: ov.closer_reagendamentos, noShows: ov.closer_no_shows, totalCalls: ov.closer_total_calls, isManual: true };
            }
        });

        return NextResponse.json({
            sdr: Object.values(performanceSDR),
            closer: Object.values(performanceCloser),
            period: { date: dateParam }
        });

    } catch (error) {
        console.error("API Performance Error:", error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id_usuario, data_referencia, metrics, isSDR } = body;

        if (!id_usuario || !data_referencia || !metrics) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        if (isSDR) {
            await sql`
                INSERT INTO metricas_performance (id_usuario, data_referencia, sdr_conversas_iniciadas, sdr_primeira_resposta, sdr_convites_enviados, sdr_leads_qualificados, sdr_calls_marcadas)
                VALUES (${id_usuario}, ${data_referencia}, ${metrics.conversasIniciadas || 0}, ${metrics.primeiraResposta || 0}, ${metrics.convitesEnviados || 0}, ${metrics.leadsQualificados || 0}, ${metrics.callMarcada || 0})
                ON CONFLICT (id_usuario, data_referencia) DO UPDATE SET
                    sdr_conversas_iniciadas = EXCLUDED.sdr_conversas_iniciadas,
                    sdr_primeira_resposta = EXCLUDED.sdr_primeira_resposta,
                    sdr_convites_enviados = EXCLUDED.sdr_convites_enviados,
                    sdr_leads_qualificados = EXCLUDED.sdr_leads_qualificados,
                    sdr_calls_marcadas = EXCLUDED.sdr_calls_marcadas
            `;
        } else {
            await sql`
                INSERT INTO metricas_performance (id_usuario, data_referencia, closer_total_calls, closer_calls_agendadas, closer_reagendamentos, closer_no_shows)
                VALUES (${id_usuario}, ${data_referencia}, ${metrics.totalCalls || 0}, ${metrics.callsAgendadas || 0}, ${metrics.reagendamentos || 0}, ${metrics.noShows || 0})
                ON CONFLICT (id_usuario, data_referencia) DO UPDATE SET
                    closer_total_calls = EXCLUDED.closer_total_calls,
                    closer_calls_agendadas = EXCLUDED.closer_calls_agendadas,
                    closer_reagendamentos = EXCLUDED.closer_reagendamentos,
                    closer_no_shows = EXCLUDED.closer_no_shows
            `;
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("API POST Performance Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
