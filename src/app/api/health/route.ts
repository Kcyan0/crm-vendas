import { NextResponse } from 'next/server';
import supabase from '@/lib/db';

export async function GET() {
    const tabelas = ['projetos', 'usuarios', 'leads', 'vendas', 'oportunidades', 'gateways_pagamento', 'chamadas', 'metricas_performance'];
    const resultados: Record<string, unknown> = {};

    for (const tabela of tabelas) {
        const { count, error } = await supabase
            .from(tabela)
            .select('*', { count: 'exact', head: true });

        resultados[tabela] = error
            ? { erro: error.message }
            : { registros: count ?? 0 };
    }

    const temErro = Object.values(resultados).some((r: any) => r.erro);

    return NextResponse.json({
        ok: !temErro,
        supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        tabelas: resultados,
        timestamp: new Date().toISOString(),
    });
}
