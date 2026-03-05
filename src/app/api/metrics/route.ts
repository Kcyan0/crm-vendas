import { NextResponse } from 'next/server';
import supabase from '@/lib/db';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

        const startDate = searchParams.get('startDate') || firstDay;
        const endDate = searchParams.get('endDate') || lastDay;
        const projectId = searchParams.get('projectId');

        // Fetch all paid sales in period
        let vendasQuery = supabase.from('vendas')
            .select('valor_bruto, valor_liquido_caixa, numero_parcelas, data_venda, data_recebimento, forma_pagamento, id_lead')
            .eq('status_pagamento', 'pago')
            .gte('data_venda', `${startDate}T00:00:00`)
            .lte('data_venda', `${endDate}T23:59:59`);

        const { data: vendas } = await vendasQuery;

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

        // Calculate receita
        const receita = filteredVendas.reduce((sum: number, v: any) => sum + (parseFloat(v.valor_bruto) || 0), 0);
        const vendasTotais = filteredVendas.length;

        // Calculate caixa liquido (simulate installments in JS)
        let caixaLiquido = 0;
        const start = new Date(startDate);
        const end = new Date(endDate);

        filteredVendas.forEach((v: any) => {
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
        });

        // Count leads in period
        let leadsQuery = supabase.from('leads').select('id_lead').gte('data_entrada', `${startDate}T00:00:00`).lte('data_entrada', `${endDate}T23:59:59`);
        if (projectId) leadsQuery = leadsQuery.eq('id_projeto', projectId);
        const { data: leadsData } = await leadsQuery;
        const leadsTotais = leadsData?.length || 0;

        const conversaoAproximada = leadsTotais > 0 ? ((vendasTotais / leadsTotais) * 100).toFixed(1) : '0.0';

        // Receita por forma de pagamento
        const byPayment: Record<string, number> = {};
        filteredVendas.forEach((v: any) => {
            const key = v.forma_pagamento || 'PIX';
            byPayment[key] = (byPayment[key] || 0) + parseFloat(v.valor_bruto || 0);
        });
        const receitaPorPagamento = Object.entries(byPayment).map(([name, value]) => ({ name, value }));

        return NextResponse.json({ receita, caixaLiquido, leadsTotais, vendasTotais, conversaoAproximada, receitaPorPagamento, period: { startDate, endDate } });
    } catch (error: any) {
        console.error('Metrics error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
