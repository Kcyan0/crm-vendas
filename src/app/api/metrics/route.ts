import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);

        // Default to current month
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

        const startDate = searchParams.get('startDate') || firstDay;
        const endDate = searchParams.get('endDate') || lastDay;
        const projectId = searchParams.get('projectId');

        // 1. Receita Total
        let receitaRows;
        if (projectId) {
            receitaRows = await sql`
                SELECT SUM(v.valor_bruto) as total FROM vendas v
                JOIN leads l ON v.id_lead = l.id_lead
                WHERE v.status_pagamento = 'pago' AND l.status_atual NOT IN ('Reembolsado', 'Loss')
                AND v.data_venda::date BETWEEN ${startDate}::date AND ${endDate}::date
                AND l.id_projeto = ${projectId}
            `;
        } else {
            receitaRows = await sql`
                SELECT SUM(v.valor_bruto) as total FROM vendas v
                JOIN leads l ON v.id_lead = l.id_lead
                WHERE v.status_pagamento = 'pago' AND l.status_atual NOT IN ('Reembolsado', 'Loss')
                AND v.data_venda::date BETWEEN ${startDate}::date AND ${endDate}::date
            `;
        }
        const receita = receitaRows[0]?.total || 0;

        // 2. Caixa Liquido (Recursive CTE - works in Postgres too)
        let caixaRows;
        if (projectId) {
            caixaRows = await sql`
                WITH RECURSIVE cte_parcelas AS (
                    SELECT v.id_venda, 1 as parcela_atual, v.numero_parcelas, v.valor_liquido_caixa,
                           v.data_venda::date as data_recebimento, l.id_projeto
                    FROM vendas v JOIN leads l ON v.id_lead = l.id_lead
                    WHERE v.status_pagamento = 'pago' AND l.status_atual NOT IN ('Reembolsado', 'Loss')
                    UNION ALL
                    SELECT id_venda, parcela_atual + 1, total_parcelas, valor_liquido_caixa,
                           (data_recebimento + INTERVAL '1 month')::date, id_projeto
                    FROM cte_parcelas WHERE parcela_atual < total_parcelas
                )
                SELECT SUM(valor_liquido_caixa / NULLIF(total_parcelas, 0)) as total
                FROM cte_parcelas
                WHERE data_recebimento BETWEEN ${startDate}::date AND ${endDate}::date
                AND id_projeto = ${projectId}
            `;
        } else {
            caixaRows = await sql`
                WITH RECURSIVE cte_parcelas AS (
                    SELECT v.id_venda, 1 as parcela_atual, v.numero_parcelas, v.valor_liquido_caixa,
                           v.data_venda::date as data_recebimento
                    FROM vendas v JOIN leads l ON v.id_lead = l.id_lead
                    WHERE v.status_pagamento = 'pago' AND l.status_atual NOT IN ('Reembolsado', 'Loss')
                    UNION ALL
                    SELECT id_venda, parcela_atual + 1, total_parcelas, valor_liquido_caixa,
                           (data_recebimento + INTERVAL '1 month')::date
                    FROM cte_parcelas WHERE parcela_atual < total_parcelas
                )
                SELECT SUM(valor_liquido_caixa / NULLIF(total_parcelas, 0)) as total
                FROM cte_parcelas
                WHERE data_recebimento BETWEEN ${startDate}::date AND ${endDate}::date
            `;
        }
        const caixaLiquido = caixaRows[0]?.total || 0;

        // 3. Quantidade de Leads
        let qtdLeadsRows;
        if (projectId) {
            qtdLeadsRows = await sql`
                SELECT COUNT(*) as total FROM leads l 
                WHERE l.data_entrada::date BETWEEN ${startDate}::date AND ${endDate}::date
                AND l.id_projeto = ${projectId}
            `;
        } else {
            qtdLeadsRows = await sql`
                SELECT COUNT(*) as total FROM leads l 
                WHERE l.data_entrada::date BETWEEN ${startDate}::date AND ${endDate}::date
            `;
        }
        const leadsTotais = parseInt(qtdLeadsRows[0]?.total) || 0;

        // 4. Vendas Totais (for conversion)
        let qtdVendasRows;
        if (projectId) {
            qtdVendasRows = await sql`
                SELECT COUNT(*) as total FROM vendas v
                JOIN leads l ON v.id_lead = l.id_lead
                WHERE v.status_pagamento IN ('pago', 'pendente') AND l.status_atual NOT IN ('Reembolsado', 'Loss')
                AND v.data_venda::date BETWEEN ${startDate}::date AND ${endDate}::date
                AND l.id_projeto = ${projectId}
            `;
        } else {
            qtdVendasRows = await sql`
                SELECT COUNT(*) as total FROM vendas v
                JOIN leads l ON v.id_lead = l.id_lead
                WHERE v.status_pagamento IN ('pago', 'pendente') AND l.status_atual NOT IN ('Reembolsado', 'Loss')
                AND v.data_venda::date BETWEEN ${startDate}::date AND ${endDate}::date
            `;
        }
        const vendasTotais = parseInt(qtdVendasRows[0]?.total) || 0;
        const conversaoAproximada = leadsTotais > 0 ? ((vendasTotais / leadsTotais) * 100).toFixed(1) : '0.0';

        // 5. Receita por Forma de Pagamento
        let receitaPorPagamento;
        if (projectId) {
            receitaPorPagamento = await sql`
                SELECT v.forma_pagamento as name, SUM(v.valor_bruto) as value
                FROM vendas v JOIN leads l ON v.id_lead = l.id_lead
                WHERE v.status_pagamento = 'pago' AND l.status_atual NOT IN ('Reembolsado', 'Loss')
                AND v.data_venda::date BETWEEN ${startDate}::date AND ${endDate}::date
                AND l.id_projeto = ${projectId}
                GROUP BY v.forma_pagamento
            `;
        } else {
            receitaPorPagamento = await sql`
                SELECT v.forma_pagamento as name, SUM(v.valor_bruto) as value
                FROM vendas v JOIN leads l ON v.id_lead = l.id_lead
                WHERE v.status_pagamento = 'pago' AND l.status_atual NOT IN ('Reembolsado', 'Loss')
                AND v.data_venda::date BETWEEN ${startDate}::date AND ${endDate}::date
                GROUP BY v.forma_pagamento
            `;
        }

        return NextResponse.json({
            receita: parseFloat(receita) || 0,
            caixaLiquido: parseFloat(caixaLiquido) || 0,
            leadsTotais,
            vendasTotais,
            conversaoAproximada,
            receitaPorPagamento,
            period: { startDate, endDate }
        });
    } catch (error) {
        console.error('Metrics error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
