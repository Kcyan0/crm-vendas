import { NextResponse } from 'next/server';
import supabase from '@/lib/db';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');
        const mes = searchParams.get('mes');
        const ano = searchParams.get('ano');

        let query = supabase.from('metas_projeto').select('*');
        if (projectId) query = query.eq('id_projeto', projectId);
        if (mes) query = query.eq('mes', mes);
        if (ano) query = query.eq('ano', ano);

        const { data, error } = await query.maybeSingle();
        if (error) throw error;
        return NextResponse.json(data || { meta_faturamento: 0, meta_caixa: 0 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id_projeto, mes, ano, meta_faturamento, meta_caixa } = body;
        if (!id_projeto || !mes || !ano) return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 });

        const { error } = await supabase
            .from('metas_projeto')
            .upsert(
                {
                    id_projeto: Number(id_projeto),
                    mes: Number(mes),
                    ano: Number(ano),
                    meta_faturamento: parseFloat(meta_faturamento) || 0,
                    meta_caixa: parseFloat(meta_caixa) || 0,
                },
                { onConflict: 'id_projeto,mes,ano' }
            );
        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
