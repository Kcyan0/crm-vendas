import { NextResponse } from 'next/server';
import supabase from '@/lib/db';
import { createClient } from '@/lib/supabase/server';

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

        // Get the logged-in user's projects
        const supabaseAuth = await createClient();
        const { data: { user } } = await supabaseAuth.auth.getUser();
        if (!user?.email) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

        // Fetch all projects this user has access to
        const { data: userRows } = await supabase
            .from('usuarios')
            .select('id_projeto')
            .eq('email', user.email.toLowerCase());
        const projectIds = [...new Set((userRows || []).map((r: any) => r.id_projeto).filter(Boolean))];

        let projectsInfo: { id_projeto: number; nome: string }[] = [];
        if (projectIds.length > 0) {
            const { data: projs } = await supabase
                .from('projetos')
                .select('id_projeto, nome')
                .in('id_projeto', projectIds)
                .eq('ativo', true);
            projectsInfo = projs || [];
        }

        // Build per-project metrics
        const projectMetrics: any[] = [];
        let totalReceita = 0;
        let totalCaixa = 0;
        let totalVendas = 0;
        let totalLeads = 0;

        for (const proj of projectsInfo) {
            const pid = proj.id_projeto;

            // Leads for this project in period
            const { data: leadsData } = await supabase
                .from('leads')
                .select('id_lead, status_atual')
                .eq('id_projeto', pid);

            const allLeadIds = (leadsData || []).map((l: any) => l.id_lead);
            const validLeadIds = new Set((leadsData || [])
                .filter((l: any) => l.status_atual !== 'Reembolsado' && l.status_atual !== 'Loss')
                .map((l: any) => l.id_lead));

            // Leads created in period
            const { data: leadsInPeriod } = await supabase
                .from('leads')
                .select('id_lead')
                .eq('id_projeto', pid)
                .gte('data_entrada', `${startDate}T00:00:00`)
                .lte('data_entrada', `${endDate}T23:59:59`);
            const leadsCount = (leadsInPeriod || []).length;

            // Sales in period
            const { data: vendas } = await supabase
                .from('vendas')
                .select('id_venda, id_oportunidade, valor_bruto, valor_liquido_caixa, numero_parcelas, data_venda, data_recebimento, forma_pagamento, id_lead')
                .eq('status_pagamento', 'pago')
                .gte('data_venda', `${startDate}T00:00:00`)
                .lte('data_venda', `${endDate}T23:59:59`)
                .in('id_lead', allLeadIds.length > 0 ? allLeadIds : [0]);

            const filteredVendas = (vendas || []).filter((v: any) => validLeadIds.has(v.id_lead));

            // Group by oportunidade
            const salesMap: Record<number, any> = {};
            for (const v of filteredVendas) {
                const oid = v.id_oportunidade ?? v.id_lead;
                if (!salesMap[oid]) salesMap[oid] = { valor_bruto: 0, valor_liquido_caixa: 0, rows: [] };
                salesMap[oid].valor_bruto += parseFloat(v.valor_bruto) || 0;
                salesMap[oid].valor_liquido_caixa += v.valor_liquido_caixa != null ? parseFloat(v.valor_liquido_caixa) : (parseFloat(v.valor_bruto) || 0);
                salesMap[oid].rows.push(v);
            }
            const groupedSales = Object.values(salesMap);

            const receita = groupedSales.reduce((s, g) => s + g.valor_bruto, 0);
            const vendasCount = groupedSales.length;

            // Caixa calculation
            const start = new Date(startDate);
            const end = new Date(endDate);
            let caixa = 0;
            for (const sale of groupedSales) {
                for (const v of sale.rows) {
                    const parcelas = v.numero_parcelas || 1;
                    const valorParcela = (v.valor_liquido_caixa != null ? parseFloat(v.valor_liquido_caixa) : (parseFloat(v.valor_bruto) || 0)) / parcelas;
                    const dataBase = new Date(v.data_recebimento || v.data_venda);
                    for (let i = 0; i < parcelas; i++) {
                        const dataParcela = new Date(dataBase);
                        dataParcela.setMonth(dataParcela.getMonth() + i);
                        if (dataParcela >= start && dataParcela <= end) {
                            caixa += valorParcela;
                        }
                    }
                }
            }

            const reembolsados = (leadsData || []).filter((l: any) => l.status_atual === 'Reembolsado').length;
            const chargebackRate = (vendasCount + reembolsados) > 0
                ? parseFloat(((reembolsados / (vendasCount + reembolsados)) * 100).toFixed(1))
                : 0;
            const conversao = leadsCount > 0 ? parseFloat(((vendasCount / leadsCount) * 100).toFixed(1)) : 0;
            const ticketFaturamento = vendasCount > 0 ? receita / vendasCount : 0;
            const ticketCaixa = vendasCount > 0 ? caixa / vendasCount : 0;

            projectMetrics.push({
                id_projeto: pid,
                nome: proj.nome,
                receita,
                caixa,
                vendas: vendasCount,
                leads: leadsCount,
                conversao,
                chargebackRate,
                ticketFaturamento,
                ticketCaixa,
            });

            totalReceita += receita;
            totalCaixa += caixa;
            totalVendas += vendasCount;
            totalLeads += leadsCount;
        }

        const totalConversao = totalLeads > 0 ? parseFloat(((totalVendas / totalLeads) * 100).toFixed(1)) : 0;
        const totalTicket = totalVendas > 0 ? totalReceita / totalVendas : 0;

        return NextResponse.json({
            totalReceita,
            totalCaixa,
            totalVendas,
            totalLeads,
            totalConversao,
            totalTicket,
            byProject: projectMetrics,
            period: { startDate, endDate },
        });
    } catch (error: any) {
        console.error('[overview]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
